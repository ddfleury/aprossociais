import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv, isProduction } from "@/core/config/env";
import { sha256 } from "@/core/crypto/hash";
import {
  execute,
  queryOne,
  queryRows,
  type RowDataPacket,
} from "@/core/db/pool";
import { getRequestContext } from "@/core/http/request-context";
import type { PermissionCode, PermissionScope } from "@/core/auth/permissions";
import { assertPermission } from "@/core/auth/permissions";

export function sessionCookieName(): string {
  return isProduction() ? "__Host-apros_session" : "apros_session";
}

export type CurrentUser = {
  id: string;
  publicId: string;
  login: string;
  name: string;
  email: string;
  unitId: string | null;
  unitName: string | null;
  sessionId: string;
  roles: string[];
  globalPermissions: string[];
  unitPermissions: Record<string, string[]>;
};

type SessionRow = RowDataPacket & {
  session_id: string;
  usuario_id: string;
  public_id: string;
  login: string;
  email_login: string;
  nome: string | null;
  unidade_id: string | null;
  unidade_nome: string | null;
  ultimo_acesso_em: string;
};

type RoleRow = RowDataPacket & { codigo: string };
type PermissionRow = RowDataPacket & {
  codigo: string;
  unidade_id: string | null;
};

export async function createSession(userId: string): Promise<void> {
  const env = getEnv();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const context = await getRequestContext();
  const maxAge = env.SESSION_TTL_HOURS * 60 * 60;

  await execute(
    `INSERT INTO usuarios_sessoes
      (usuario_id, token_hash, ip, user_agent, expira_em)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND))`,
    [userId, tokenHash, context.ip, context.userAgent, maxAge],
  );

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge,
    priority: "high",
  });
}

export async function revokeCurrentSession(reason = "LOGOUT"): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (token) {
    await execute(
      `UPDATE usuarios_sessoes
          SET revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = ?
        WHERE token_hash = ? AND revogado_em IS NULL`,
      [reason.slice(0, 120), sha256(token)],
    );
  }
  cookieStore.delete(sessionCookieName());
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const session = await queryOne<SessionRow>(
    `SELECT s.id AS session_id, u.id AS usuario_id, u.public_id, u.login,
            u.email_login, COALESCE(NULLIF(p.nome_social, ''), p.nome, u.login) AS nome,
            u.unidade_id, un.nome AS unidade_nome, s.ultimo_acesso_em
       FROM usuarios_sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       LEFT JOIN pessoas p ON p.id = u.pessoa_id
       LEFT JOIN unidades un ON un.id = u.unidade_id
      WHERE s.token_hash = ?
        AND s.revogado_em IS NULL
        AND s.expira_em > UTC_TIMESTAMP(6)
        AND u.status = 'ATIVO'
        AND u.excluido_em IS NULL
      LIMIT 1`,
    [sha256(token)],
  );
  if (!session) return null;

  const [roles, permissions] = await Promise.all([
    queryRows<RoleRow>(
      `SELECT DISTINCT pa.codigo
         FROM papeis pa
         JOIN (
           SELECT papel_id FROM usuarios_papeis
            WHERE usuario_id = ? AND (expira_em IS NULL OR expira_em > UTC_TIMESTAMP(6))
           UNION ALL
           SELECT papel_id FROM usuarios_papeis_unidades
            WHERE usuario_id = ? AND (expira_em IS NULL OR expira_em > UTC_TIMESTAMP(6))
         ) r ON r.papel_id = pa.id`,
      [session.usuario_id, session.usuario_id],
    ),
    queryRows<PermissionRow>(
      `SELECT DISTINCT pe.codigo, x.unidade_id
         FROM permissoes pe
         JOIN papeis_permissoes pp ON pp.permissao_id = pe.id
         JOIN (
           SELECT papel_id, CAST(NULL AS UNSIGNED) AS unidade_id
             FROM usuarios_papeis
            WHERE usuario_id = ? AND (expira_em IS NULL OR expira_em > UTC_TIMESTAMP(6))
           UNION ALL
           SELECT papel_id, unidade_id
             FROM usuarios_papeis_unidades
            WHERE usuario_id = ? AND (expira_em IS NULL OR expira_em > UTC_TIMESTAMP(6))
         ) x ON x.papel_id = pp.papel_id`,
      [session.usuario_id, session.usuario_id],
    ),
  ]);

  const globalPermissions = permissions
    .filter((permission) => permission.unidade_id === null)
    .map((permission) => permission.codigo);
  const unitPermissions: Record<string, string[]> = {};
  for (const permission of permissions) {
    if (permission.unidade_id === null) continue;
    unitPermissions[permission.unidade_id] ??= [];
    unitPermissions[permission.unidade_id].push(permission.codigo);
  }

  if (Date.now() - Date.parse(`${session.ultimo_acesso_em}Z`) > 5 * 60 * 1000) {
    void execute(
      "UPDATE usuarios_sessoes SET ultimo_acesso_em = UTC_TIMESTAMP(6) WHERE id = ?",
      [session.session_id],
    ).catch(() => undefined);
  }

  return {
    id: session.usuario_id,
    publicId: session.public_id,
    login: session.login,
    name: session.nome ?? session.login,
    email: session.email_login,
    unitId: session.unidade_id,
    unitName: session.unidade_nome,
    sessionId: session.session_id,
    roles: roles.map((role) => role.codigo),
    globalPermissions,
    unitPermissions,
  };
});

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(
  permission: PermissionCode,
  unitId?: string,
): Promise<{ user: CurrentUser; scope: PermissionScope }> {
  const user = await requireCurrentUser();
  return { user, scope: assertPermission(user, permission, unitId) };
}
