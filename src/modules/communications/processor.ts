import "server-only";

import { getEnv } from "@/core/config/env";
import { decryptJson, decryptText, encryptText } from "@/core/crypto/sensitive";
import { execute, queryRows, type RowDataPacket } from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";

type ClaimedRecipient = RowDataPacket & {
  id: string;
  queue_id: string;
  queue_public_id: string;
  attempts: number;
  encrypted_destination: Buffer;
  encrypted_message: Buffer;
  encrypted_variables: Buffer | null;
};
type MessageVariables = { nome?: string; matricula?: string };
type ProviderResult = {
  success: boolean;
  status: number | null;
  providerId: string | null;
  code: string | null;
  response: string;
};

function renderMessage(template: string, variables: MessageVariables): string {
  return template
    .replace(
      /\{\{(nome|matricula)\}\}/g,
      (_match, key: keyof MessageVariables) => variables[key] ?? "",
    )
    .trim();
}

async function sendWhatsApp(
  destination: string,
  body: string,
): Promise<ProviderResult> {
  const env = getEnv();
  if (
    !env.WHATSAPP_API_URL ||
    !env.WHATSAPP_API_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  )
    return {
      success: false,
      status: null,
      providerId: null,
      code: "PROVIDER_NOT_CONFIGURED",
      response: "Provedor não configurado.",
    };
  try {
    const response = await fetch(env.WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destination,
        type: "text",
        text: { preview_url: false, body },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const responseText = (await response.text()).slice(0, 8_000);
    let providerId: string | null = null;
    try {
      const parsed = JSON.parse(responseText) as {
        messages?: Array<{ id?: string }>;
      };
      providerId = parsed.messages?.[0]?.id ?? null;
    } catch {
      /* A resposta não é JSON; será preservada cifrada no log. */
    }
    return {
      success: response.ok,
      status: response.status,
      providerId,
      code: response.ok ? null : `HTTP_${response.status}`,
      response: responseText,
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      providerId: null,
      code:
        error instanceof Error && error.name === "TimeoutError"
          ? "TIMEOUT"
          : "NETWORK_ERROR",
      response:
        error instanceof Error ? error.message.slice(0, 1_000) : "Erro de rede",
    };
  }
}

export async function processMessageQueue(
  options: { queuePublicId?: string; limit?: number } = {},
) {
  const env = getEnv();
  if (
    !env.WHATSAPP_API_URL ||
    !env.WHATSAPP_API_TOKEN ||
    !env.WHATSAPP_PHONE_NUMBER_ID
  )
    return { processed: 0, sent: 0, failed: 0, configurationMissing: true };
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const claimed = await withTransaction(async (connection) => {
    const conditions = [
      `cf.status IN ('AGENDADA','PROCESSANDO')`,
      "(cf.agendada_para IS NULL OR cf.agendada_para <= UTC_TIMESTAMP(6))",
      "cd.status IN ('PENDENTE','FALHOU')",
      "cd.tentativas < 5",
      "(cd.tentar_novamente_em IS NULL OR cd.tentar_novamente_em <= UTC_TIMESTAMP(6))",
    ];
    const values: string[] = [];
    if (options.queuePublicId) {
      conditions.push("cf.public_id = ?");
      values.push(options.queuePublicId);
    }
    const rows = await queryRows<ClaimedRecipient>(
      `SELECT cd.id, cf.id AS queue_id, cf.public_id AS queue_public_id, cd.tentativas AS attempts, cd.destino_cifrado AS encrypted_destination, cf.mensagem_cifrada AS encrypted_message, cd.variaveis_cifradas AS encrypted_variables FROM comunicacoes_destinatarios cd JOIN comunicacoes_filas cf ON cf.id = cd.fila_id WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(cf.agendada_para, cf.criado_em), cd.id LIMIT ${limit} FOR UPDATE SKIP LOCKED`,
      values,
      connection,
    );
    for (const row of rows) {
      await execute(
        "UPDATE comunicacoes_destinatarios SET status = 'PROCESSANDO', tentativas = tentativas + 1 WHERE id = ?",
        [row.id],
        connection,
      );
      await execute(
        "UPDATE comunicacoes_filas SET status = 'PROCESSANDO', iniciado_em = COALESCE(iniciado_em, UTC_TIMESTAMP(6)) WHERE id = ?",
        [row.queue_id],
        connection,
      );
    }
    return rows;
  });

  let sent = 0;
  let failed = 0;
  const touchedQueues = new Set<string>();
  for (const row of claimed) {
    touchedQueues.add(row.queue_id);
    let result: ProviderResult;
    try {
      const destination = decryptText(row.encrypted_destination);
      const message = decryptText(row.encrypted_message);
      const variables =
        decryptJson<MessageVariables>(row.encrypted_variables) ?? {};
      if (!destination || !message)
        throw new Error("Conteúdo cifrado ausente.");
      result = await sendWhatsApp(
        destination,
        renderMessage(message, variables),
      );
    } catch (error) {
      result = {
        success: false,
        status: null,
        providerId: null,
        code: "DECRYPTION_ERROR",
        response: error instanceof Error ? error.message : "Falha de leitura",
      };
    }
    const attemptNumber = row.attempts + 1;
    await withTransaction(async (connection) => {
      await execute(
        `INSERT INTO comunicacoes_tentativas (destinatario_id, numero_tentativa, finalizada_em, sucesso, http_status, erro_codigo, resposta_cifrada) VALUES (?, ?, UTC_TIMESTAMP(6), ?, ?, ?, ?)`,
        [
          row.id,
          attemptNumber,
          result.success ? 1 : 0,
          result.status,
          result.code,
          encryptText(result.response),
        ],
        connection,
      );
      if (result.success) {
        sent += 1;
        await execute(
          `UPDATE comunicacoes_destinatarios SET status = 'ENVIADA', enviado_em = UTC_TIMESTAMP(6), tentar_novamente_em = NULL, erro_codigo = NULL, provedor = 'WHATSAPP', provedor_mensagem_id = ? WHERE id = ?`,
          [result.providerId, row.id],
          connection,
        );
      } else {
        failed += 1;
        const retryMinutes = Math.min(60, 2 ** attemptNumber);
        await execute(
          `UPDATE comunicacoes_destinatarios SET status = 'FALHOU', falhou_em = UTC_TIMESTAMP(6), erro_codigo = ?, tentar_novamente_em = IF(tentativas < 5, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? MINUTE), NULL) WHERE id = ?`,
          [result.code, retryMinutes, row.id],
          connection,
        );
      }
    });
  }
  for (const queueId of touchedQueues)
    await execute(
      `UPDATE comunicacoes_filas SET status = IF(EXISTS (SELECT 1 FROM comunicacoes_destinatarios cd WHERE cd.fila_id = comunicacoes_filas.id AND (cd.status IN ('PENDENTE','PROCESSANDO') OR (cd.status = 'FALHOU' AND cd.tentativas < 5))), 'PROCESSANDO', 'CONCLUIDA'), concluido_em = IF(EXISTS (SELECT 1 FROM comunicacoes_destinatarios cd WHERE cd.fila_id = comunicacoes_filas.id AND (cd.status IN ('PENDENTE','PROCESSANDO') OR (cd.status = 'FALHOU' AND cd.tentativas < 5))), NULL, UTC_TIMESTAMP(6)) WHERE id = ?`,
      [queueId],
    );
  return {
    processed: claimed.length,
    sent,
    failed,
    configurationMissing: false,
  };
}
