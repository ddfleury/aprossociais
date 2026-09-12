"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { requireCurrentUser } from "@/core/auth/session";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { getRequestContext } from "@/core/http/request-context";
import { ConflictError, publicErrorMessage } from "@/core/security/errors";

type UserRow = RowDataPacket & {
  password_hash: string;
  person_id: string | null;
};
type IdRow = RowDataPacket & { id: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function finishAccountAction(
  work: (input: {
    userId: string;
    sessionId: string;
    requestId: string;
    context: Awaited<ReturnType<typeof getRequestContext>>;
  }) => Promise<void>,
  success: string,
): Promise<never> {
  const context = await getRequestContext();
  let errorMessage: string | null = null;
  try {
    const user = await requireCurrentUser();
    await work({
      userId: user.id,
      sessionId: user.sessionId,
      requestId: context.requestId,
      context,
    });
  } catch (error) {
    console.error("Falha ao atualizar a conta", {
      requestId: context.requestId,
      error,
    });
    errorMessage = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (errorMessage)
    redirect(`/minha-conta?error=${encodeURIComponent(errorMessage)}`);
  redirect(`/minha-conta?success=${encodeURIComponent(success)}`);
}

export async function updateProfileAction(formData: FormData): Promise<never> {
  return finishAccountAction(async ({ userId, context }) => {
    const name = z.string().min(3).max(180).parse(text(formData, "name"));
    const email = z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .parse(text(formData, "email"));
    const [current, duplicate] = await Promise.all([
      queryOne<UserRow>(
        "SELECT pessoa_id AS person_id, senha_hash AS password_hash FROM usuarios WHERE id = ?",
        [userId],
      ),
      queryOne<IdRow>(
        "SELECT id FROM usuarios WHERE email_login = ? AND id <> ? AND excluido_em IS NULL",
        [email, userId],
      ),
    ]);
    if (!current) throw new ConflictError("Conta não encontrada.");
    if (duplicate)
      throw new ConflictError("Este e-mail já está associado a outra conta.");

    await withTransaction(async (connection) => {
      if (current.person_id) {
        await execute(
          "UPDATE pessoas SET nome = ? WHERE id = ?",
          [name, current.person_id],
          connection,
        );
      } else {
        throw new ConflictError(
          "A conta não possui uma pessoa vinculada. Solicite correção ao administrador.",
        );
      }
      await execute(
        "UPDATE usuarios SET email_login = ? WHERE id = ?",
        [email, userId],
        connection,
      );
      await auditEvent({
        userId,
        action: "PERFIL_ATUALIZADO",
        entity: "USUARIO",
        entityId: userId,
        context,
        connection,
      });
    });
  }, "Perfil atualizado com sucesso.");
}

export async function changePasswordAction(formData: FormData): Promise<never> {
  return finishAccountAction(async ({ userId, sessionId, context }) => {
    const currentPassword = z
      .string()
      .min(1)
      .max(200)
      .parse(text(formData, "currentPassword"));
    const newPassword = z
      .string()
      .min(14)
      .max(200)
      .parse(text(formData, "newPassword"));
    const confirmation = text(formData, "confirmation");
    if (newPassword !== confirmation)
      throw new ConflictError("A confirmação da nova senha não confere.");

    const current = await queryOne<UserRow>(
      "SELECT pessoa_id AS person_id, senha_hash AS password_hash FROM usuarios WHERE id = ? AND status = 'ATIVO'",
      [userId],
    );
    if (
      !current ||
      !(await verifyPassword(current.password_hash, currentPassword))
    ) {
      throw new ConflictError("A senha atual está incorreta.");
    }
    if (await verifyPassword(current.password_hash, newPassword)) {
      throw new ConflictError(
        "A nova senha precisa ser diferente da senha atual.",
      );
    }

    const newHash = await hashPassword(newPassword);
    await withTransaction(async (connection) => {
      await execute(
        "UPDATE usuarios SET senha_hash = ?, senha_alterada_em = UTC_TIMESTAMP(6), tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?",
        [newHash, userId],
        connection,
      );
      await execute(
        "UPDATE usuarios_sessoes SET revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = 'SENHA_ALTERADA' WHERE usuario_id = ? AND id <> ? AND revogado_em IS NULL",
        [userId, sessionId],
        connection,
      );
      await auditEvent({
        userId,
        action: "SENHA_ALTERADA",
        entity: "USUARIO",
        entityId: userId,
        context,
        connection,
      });
    });
  }, "Senha alterada; as outras sessões foram encerradas.");
}

export async function revokeOtherSessionsAction(): Promise<never> {
  return finishAccountAction(async ({ userId, sessionId, context }) => {
    await withTransaction(async (connection) => {
      await execute(
        "UPDATE usuarios_sessoes SET revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = 'REVOGADA_PELO_USUARIO' WHERE usuario_id = ? AND id <> ? AND revogado_em IS NULL",
        [userId, sessionId],
        connection,
      );
      await auditEvent({
        userId,
        action: "OUTRAS_SESSOES_REVOGADAS",
        entity: "USUARIO_SESSAO",
        entityId: userId,
        context,
        connection,
      });
    });
  }, "As outras sessões foram encerradas.");
}
