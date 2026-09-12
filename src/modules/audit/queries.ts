import "server-only";

import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE, escapeLike } from "@/core/http/pagination";

export type AuditFilters = {
  q?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page: number;
};

type AuditRow = RowDataPacket & {
  public_id: string;
  action: string;
  entity: string;
  entity_public_id: string | null;
  request_id: string | null;
  occurred_at: string;
  user_name: string | null;
  login: string | null;
};
type CountRow = RowDataPacket & { total: number };
type ValueRow = RowDataPacket & { value: string };

function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function listAuditEvents(filters: AuditFilters) {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const where = ["1 = 1"];
  const values: string[] = [];

  if (filters.q?.trim()) {
    const search = `%${escapeLike(filters.q.trim())}%`;
    where.push(
      "(a.request_id LIKE ? OR a.entidade_public_id LIKE ? OR p.nome LIKE ? OR u.login LIKE ?)",
    );
    values.push(search, search, search, search);
  }
  if (filters.action && /^[A-Z0-9_]{2,80}$/.test(filters.action)) {
    where.push("a.acao = ?");
    values.push(filters.action);
  }
  if (filters.entity && /^[A-Z0-9_]{2,80}$/.test(filters.entity)) {
    where.push("a.entidade = ?");
    values.push(filters.entity);
  }
  if (validDate(filters.from)) {
    where.push("a.ocorrido_em >= ?");
    values.push(`${filters.from} 00:00:00`);
  }
  if (validDate(filters.to)) {
    where.push("a.ocorrido_em < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(`${filters.to} 00:00:00`);
  }

  const from = `FROM auditoria_eventos a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN pessoas p ON p.id = u.pessoa_id
    WHERE ${where.join(" AND ")}`;
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const [count, rows, actions, entities] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}`, values),
    queryRows<AuditRow>(
      `SELECT a.public_id, a.acao AS action, a.entidade AS entity,
              a.entidade_public_id, a.request_id, a.ocorrido_em AS occurred_at,
              COALESCE(p.nome, u.login) AS user_name, u.login
         ${from}
        ORDER BY a.ocorrido_em DESC
        LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<ValueRow>(
      "SELECT DISTINCT acao AS value FROM auditoria_eventos ORDER BY acao",
    ),
    queryRows<ValueRow>(
      "SELECT DISTINCT entidade AS value FROM auditoria_eventos ORDER BY entidade",
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    actions: actions.map((item) => item.value),
    entities: entities.map((item) => item.value),
  };
}
