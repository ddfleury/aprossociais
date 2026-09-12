import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";

import { execute, getPool } from "@/core/db/pool";
import type { RequestContext } from "@/core/http/request-context";

const forbiddenMetadataKeys =
  /password|senha|token|cpf|saude|endereco|telefone|email|secret/i;

function safeMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;
  const sanitized = Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !forbiddenMetadataKeys.test(key))
      .slice(0, 30),
  );
  const serialized = JSON.stringify(sanitized);
  return serialized.length > 8_000 ? serialized.slice(0, 8_000) : serialized;
}

export async function auditEvent(input: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  entityPublicId?: string | null;
  metadata?: Record<string, unknown>;
  context?: RequestContext;
  connection?: PoolConnection;
}): Promise<void> {
  await execute(
    `INSERT INTO auditoria_eventos
      (public_id, usuario_id, acao, entidade, entidade_id, entidade_public_id,
       request_id, ip, user_agent, metadados_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.userId ?? null,
      input.action.slice(0, 80),
      input.entity.slice(0, 80),
      input.entityId ?? null,
      input.entityPublicId ?? null,
      input.context?.requestId ?? null,
      input.context?.ip ?? null,
      input.context?.userAgent ?? null,
      safeMetadata(input.metadata),
    ],
    input.connection ?? getPool(),
  );
}
