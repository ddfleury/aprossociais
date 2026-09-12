"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { assertPermission, PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { encryptJson, encryptText } from "@/core/crypto/sensitive";
import { sha256 } from "@/core/crypto/hash";
import {
  execute,
  queryOne,
  queryRows,
  type RowDataPacket,
} from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { localDateTimeToUtc } from "@/core/http/datetime";
import { getRequestContext } from "@/core/http/request-context";
import { getEnv } from "@/core/config/env";
import {
  ConflictError,
  NotFoundError,
  publicErrorMessage,
} from "@/core/security/errors";
import { processMessageQueue } from "@/modules/communications/processor";

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
type Unit = RowDataPacket & { id: string };
type Target = RowDataPacket & {
  registration_id: string;
  registration_public_id: string;
  contact_id: string;
  encrypted_destination: Buffer;
  destination_hash: Buffer;
  masked_destination: string;
  participant_name: string;
  registration_number: string;
  eligible: number;
};
type Queue = RowDataPacket & { id: string; unit_id: string };

export async function createQueueAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  let publicId: string | null = null;
  try {
    const unitPublicId = z.uuid().parse(text(formData, "unitPublicId"));
    const title = z.string().min(4).max(180).parse(text(formData, "title"));
    const message = z
      .string()
      .min(3)
      .max(4000)
      .parse(text(formData, "message"));
    const scheduledText = text(formData, "scheduledAt");
    const authorize = formData.get("authorize") === "on";
    const selected = [
      ...new Set(
        [...formData.keys()]
          .filter(
            (key) => key.startsWith("recipient:") && formData.get(key) === "on",
          )
          .map((key) => key.slice(10))
          .filter((id) => z.uuid().safeParse(id).success),
      ),
    ];
    if (!selected.length)
      throw new ConflictError("Selecione ao menos um destinatário.");
    if (selected.length > 1000)
      throw new ConflictError(
        "Cada fila pode conter no máximo 1.000 destinatários.",
      );
    const unit = await queryOne<Unit>(
      "SELECT id FROM unidades WHERE public_id = ? AND ativo = 1 AND excluido_em IS NULL",
      [unitPublicId],
    );
    if (!unit) throw new NotFoundError("Unidade não encontrada.");
    const { user } = await requirePermission(
      PERMISSIONS.COMMUNICATIONS_CREATE,
      unit.id,
    );
    if (authorize)
      assertPermission(user, PERMISSIONS.COMMUNICATIONS_SEND, unit.id);
    const placeholders = selected.map(() => "?").join(",");
    const targets = await queryRows<Target>(
      `SELECT m.id AS registration_id, m.public_id AS registration_public_id, pc.id AS contact_id, pc.valor_cifrado AS encrypted_destination, pc.valor_busca AS destination_hash, pc.valor_mascarado AS masked_destination, pe.nome AS participant_name, m.numero AS registration_number, IF(EXISTS (SELECT 1 FROM consentimentos c JOIN consentimentos_tipos ct ON ct.id = c.tipo_id WHERE c.participante_id = p.id AND ct.codigo = 'COMUNICACAO_WHATSAPP' AND c.concedido = 1 AND c.revogado_em IS NULL) AND NOT EXISTS (SELECT 1 FROM comunicacoes_bloqueios cb WHERE cb.canal = 'WHATSAPP' AND cb.destino_hash = pc.valor_busca AND cb.revogado_em IS NULL AND (cb.programa_id IS NULL OR cb.programa_id = m.programa_id)), 1, 0) AS eligible FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id JOIN participantes_responsavel_principal prp ON prp.participante_id = p.id JOIN participantes_responsaveis pr ON pr.id = prp.participante_responsavel_id JOIN pessoas_contatos pc ON pc.id = (SELECT pc2.id FROM pessoas_contatos pc2 WHERE pc2.pessoa_id = pr.responsavel_pessoa_id AND pc2.tipo = 'TELEFONE' AND pc2.permite_whatsapp = 1 AND pc2.excluido_em IS NULL ORDER BY pc2.principal DESC, pc2.id LIMIT 1) WHERE m.status = 'ATIVA' AND u.id = ? AND m.public_id IN (${placeholders})`,
      [unit.id, ...selected],
    );
    if (!targets.length)
      throw new ConflictError(
        "Nenhum dos destinatários selecionados está disponível.",
      );
    const scheduledAt = scheduledText
      ? localDateTimeToUtc(scheduledText, getEnv().APP_TIME_ZONE)
      : null;
    const status = authorize ? "AGENDADA" : "RASCUNHO";
    publicId = await withTransaction(async (connection) => {
      const queuePublicId = randomUUID();
      const queue = await execute(
        `INSERT INTO comunicacoes_filas (public_id, unidade_id, canal, titulo, mensagem_cifrada, agendada_para, status, criado_por) VALUES (?, ?, 'WHATSAPP', ?, ?, ?, ?, ?)`,
        [
          queuePublicId,
          unit.id,
          title,
          encryptText(message),
          scheduledAt ??
            (authorize
              ? new Date().toISOString().slice(0, 19).replace("T", " ")
              : null),
          status,
          user.id,
        ],
        connection,
      );
      const queueId = String(queue.insertId);
      for (const target of targets) {
        const recipientPublicId = randomUUID();
        const recipientStatus = target.eligible ? "PENDENTE" : "BLOQUEADA";
        await execute(
          `INSERT INTO comunicacoes_destinatarios (public_id, fila_id, matricula_id, contato_id, idempotencia_chave, destino_cifrado, destino_hash, destino_mascarado, nome_snapshot, variaveis_cifradas, status, bloqueado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'BLOQUEADA', UTC_TIMESTAMP(6), NULL))`,
          [
            recipientPublicId,
            queueId,
            target.registration_id,
            target.contact_id,
            sha256(
              `${queuePublicId}:${target.registration_id}:${target.contact_id}`,
            ).toString("hex"),
            target.encrypted_destination,
            target.destination_hash,
            target.masked_destination,
            target.participant_name,
            encryptJson({
              nome: target.participant_name,
              matricula: target.registration_number,
            }),
            recipientStatus,
            recipientStatus,
          ],
          connection,
        );
      }
      await auditEvent({
        userId: user.id,
        action: authorize ? "COMUNICACAO_AGENDADA" : "COMUNICACAO_RASCUNHO",
        entity: "COMUNICACAO_FILA",
        entityId: queueId,
        entityPublicId: queuePublicId,
        metadata: {
          unitId: unit.id,
          recipients: targets.length,
          eligible: targets.filter((item) => item.eligible).length,
        },
        context,
        connection,
      });
      return queuePublicId;
    });
  } catch (error) {
    console.error("Falha ao criar fila", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/comunicacoes/nova?error=${encodeURIComponent(failure)}`);
  redirect(
    `/comunicacoes/${publicId}?success=${encodeURIComponent("Fila criada com os destinatários selecionados.")}`,
  );
}

export async function authorizeQueueAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const queue = await queryOne<Queue>(
      "SELECT id, unidade_id FROM comunicacoes_filas WHERE public_id = ? AND status = 'RASCUNHO'",
      [publicId],
    );
    if (!queue)
      throw new ConflictError("A fila não está disponível para autorização.");
    const { user } = await requirePermission(
      PERMISSIONS.COMMUNICATIONS_SEND,
      queue.unit_id,
    );
    await execute(
      "UPDATE comunicacoes_filas SET status = 'AGENDADA', agendada_para = COALESCE(agendada_para, UTC_TIMESTAMP(6)) WHERE id = ?",
      [queue.id],
    );
    await auditEvent({
      userId: user.id,
      action: "COMUNICACAO_AUTORIZADA",
      entity: "COMUNICACAO_FILA",
      entityId: queue.id,
      entityPublicId: publicId,
      metadata: { unitId: queue.unit_id },
      context,
    });
  } catch (error) {
    console.error("Falha ao autorizar fila", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/comunicacoes/${publicId}?error=${encodeURIComponent(failure)}`);
  redirect(
    `/comunicacoes/${publicId}?success=${encodeURIComponent("Fila autorizada para processamento.")}`,
  );
}

export async function processQueueAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const queue = await queryOne<Queue>(
      "SELECT id, unidade_id FROM comunicacoes_filas WHERE public_id = ?",
      [publicId],
    );
    if (!queue) throw new NotFoundError("Fila não encontrada.");
    await requirePermission(PERMISSIONS.COMMUNICATIONS_SEND, queue.unit_id);
    const result = await processMessageQueue({
      queuePublicId: publicId,
      limit: 25,
    });
    if (result.configurationMissing)
      throw new ConflictError(
        "Configure o provedor do WhatsApp no arquivo .env antes de processar.",
      );
  } catch (error) {
    console.error("Falha ao processar fila", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/comunicacoes/${publicId}?error=${encodeURIComponent(failure)}`);
  redirect(
    `/comunicacoes/${publicId}?success=${encodeURIComponent("Lote processado. Consulte os resultados abaixo.")}`,
  );
}
