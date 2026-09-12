"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { createSession, revokeCurrentSession } from "@/core/auth/session";
import { verifyPassword } from "@/core/auth/password";
import { hmac, normalizeLogin } from "@/core/crypto/hash";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { getRequestContext } from "@/core/http/request-context";
import type { ActionState } from "@/core/security/action-state";
import { publicErrorMessage } from "@/core/security/errors";

const DUMMY_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$PUtW1jLEFqbsimAHIMSjag$T6UXTStFJcqumyF6ymDx3yad1i5McdYGLzRN5Y2TCjI";

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(8).max(200),
});

type LoginUserRow = RowDataPacket & {
  id: string;
  password_hash: string;
  status: "ATIVO" | "BLOQUEADO" | "INATIVO";
  blocked_until: string | null;
};

type CountRow = RowDataPacket & { total: number };

async function recordAttempt(input: {
  identifierHash: Buffer;
  ip: Buffer | null;
  success: boolean;
  reason: string;
  userId?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO login_tentativas (identificador_hash, ip, sucesso, motivo)
     VALUES (?, ?, ?, ?)`,
    [input.identifierHash, input.ip, input.success ? 1 : 0, input.reason],
  );
  if (!input.userId) return;

  if (input.success) {
    await execute(
      `UPDATE usuarios
          SET tentativas_falhas = 0, bloqueado_ate = NULL, status = 'ATIVO',
              ultimo_login_em = UTC_TIMESTAMP(6), ultimo_login_ip = ?
        WHERE id = ?`,
      [input.ip, input.userId],
    );
  } else {
    await execute(
      `UPDATE usuarios
          SET tentativas_falhas = tentativas_falhas + 1,
              status = IF(tentativas_falhas + 1 >= 5, 'BLOQUEADO', status),
              bloqueado_ate = IF(tentativas_falhas + 1 >= 5,
                DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE), bloqueado_ate)
        WHERE id = ? AND status <> 'INATIVO'`,
      [input.userId],
    );
  }
}

export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Informe usuário/e-mail e senha válidos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const context = await getRequestContext();
  const identifier = normalizeLogin(parsed.data.identifier);
  const identifierHash = hmac(identifier);
  let authenticatedUserId: string | null = null;

  try {
    const recent = await queryOne<CountRow>(
      `SELECT COUNT(*) AS total
         FROM login_tentativas
        WHERE identificador_hash = ?
          AND sucesso = 0
          AND ocorrido_em >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE)`,
      [identifierHash],
    );
    if ((recent?.total ?? 0) >= 12) {
      return {
        status: "error",
        message:
          "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
      };
    }

    const candidate = await queryOne<LoginUserRow>(
      `SELECT id, senha_hash AS password_hash, status, bloqueado_ate AS blocked_until
         FROM usuarios
        WHERE (login = ? OR email_login = ?) AND excluido_em IS NULL
        LIMIT 1`,
      [identifier, identifier],
    );

    if (
      candidate?.status === "BLOQUEADO" &&
      candidate.blocked_until &&
      Date.parse(`${candidate.blocked_until}Z`) <= Date.now()
    ) {
      await execute(
        "UPDATE usuarios SET status = 'ATIVO', bloqueado_ate = NULL, tentativas_falhas = 0 WHERE id = ?",
        [candidate.id],
      );
      candidate.status = "ATIVO";
      candidate.blocked_until = null;
    }

    const validPassword = await verifyPassword(
      candidate?.password_hash ?? DUMMY_HASH,
      parsed.data.password,
    );
    const eligible = candidate?.status === "ATIVO" && validPassword;
    await recordAttempt({
      identifierHash,
      ip: context.ip,
      success: Boolean(eligible),
      reason: eligible ? "SUCESSO" : "CREDENCIAIS_INVALIDAS",
      userId: candidate?.id,
    });

    if (!eligible || !candidate) {
      return { status: "error", message: "Usuário ou senha inválidos." };
    }

    await createSession(candidate.id);
    await auditEvent({
      userId: candidate.id,
      action: "LOGIN_SUCESSO",
      entity: "USUARIO",
      entityId: candidate.id,
      context,
    });
    authenticatedUserId = candidate.id;
  } catch (error) {
    console.error("Falha de autenticação", {
      requestId: context.requestId,
      error,
    });
    return {
      status: "error",
      message: `${publicErrorMessage(error)} Protocolo: ${context.requestId}`,
    };
  }

  if (authenticatedUserId) redirect("/painel");
  return { status: "error", message: "Usuário ou senha inválidos." };
}

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  redirect("/login");
}
