import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE, escapeLike } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
type RegistrationRow = RowDataPacket & {
  public_id: string;
  number: string;
  participant_public_id: string;
  participant_name: string;
  program_name: string;
  unit_name: string;
  class_name: string | null;
  start_date: string;
  status: string;
};
type TransferRow = RowDataPacket & {
  public_id: string;
  registration_public_id: string;
  registration_number: string;
  participant_name: string;
  origin_name: string;
  destination_name: string;
  status: string;
  reason: string;
  requested_at: string;
  analyzed_at: string | null;
  effected_at: string | null;
};
type TransferDetailRow = TransferRow &
  RowDataPacket & {
    id: string;
    registration_id: string;
    origin_unit_id: string;
    destination_unit_id: string;
    destination_class_name: string | null;
    requester_name: string;
    analyst_name: string | null;
    effector_name: string | null;
  };
type TransferOptionRow = RowDataPacket & {
  public_id: string;
  label: string;
  participant_public_id: string;
  current_unit: string;
};
type DestinationRow = RowDataPacket & { option_value: string; label: string };
type ClassRow = RowDataPacket & {
  public_id: string;
  label: string;
  option_value: string;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listRegistrations(filters: { q?: string; page: number }) {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_VIEW);
  const filter = scopeSql(scope);
  const where = ["m.status = 'ATIVA'", "p.excluido_em IS NULL"];
  const values: (string | number)[] = [];
  if (filters.q?.trim()) {
    const search = `%${escapeLike(filters.q.trim())}%`;
    where.push("(m.numero LIKE ? OR pe.nome LIKE ?)");
    values.push(search, search);
  }
  const from = `FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN turmas t ON t.id = mv.turma_id WHERE ${where.join(" AND ")}${filter.clause}`;
  values.push(...filter.values);
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const [count, rows] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}`, values),
    queryRows<RegistrationRow>(
      `SELECT m.public_id, m.numero AS number, p.public_id AS participant_public_id, pe.nome AS participant_name, pr.nome AS program_name, u.nome AS unit_name, t.nome AS class_name, mv.data_inicio AS start_date, m.status ${from} ORDER BY pe.nome LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
  ]);
  return { rows, total: count?.total ?? 0, pageSize: DEFAULT_PAGE_SIZE };
}

export async function listTransfers(filters: {
  status?: string;
  page: number;
}) {
  const { scope } = await requirePermission(PERMISSIONS.TRANSFERS_REQUEST);
  const filter = scopeSql(scope, "uo");
  const values: (string | number)[] = [];
  const where = ["1=1"];
  if (
    filters.status &&
    ["SOLICITADA", "APROVADA", "RECUSADA", "EFETIVADA", "CANCELADA"].includes(
      filters.status,
    )
  ) {
    where.push("mt.status = ?");
    values.push(filters.status);
  }
  const from = `FROM matriculas_transferencias mt JOIN matriculas m ON m.id = mt.matricula_id JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculos mvo ON mvo.id = mt.origem_vinculo_id JOIN programas_unidades puo ON puo.id = mvo.programa_unidade_id JOIN unidades uo ON uo.id = puo.unidade_id JOIN programas_unidades pud ON pud.id = mt.destino_programa_unidade_id JOIN unidades ud ON ud.id = pud.unidade_id WHERE ${where.join(" AND ")}${filter.clause}`;
  values.push(...filter.values);
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const [count, rows] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}`, values),
    queryRows<TransferRow>(
      `SELECT mt.public_id, m.public_id AS registration_public_id, m.numero AS registration_number, pe.nome AS participant_name, uo.nome AS origin_name, ud.nome AS destination_name, mt.status, mt.motivo AS reason, mt.solicitada_em AS requested_at, mt.analisada_em AS analyzed_at, mt.efetivada_em AS effected_at ${from} ORDER BY mt.solicitada_em DESC LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
  ]);
  return { rows, total: count?.total ?? 0, pageSize: DEFAULT_PAGE_SIZE };
}

export async function getTransferOptions(participantPublicId?: string) {
  const { scope } = await requirePermission(PERMISSIONS.TRANSFERS_REQUEST);
  const filter = scopeSql(scope);
  const registrations = await queryRows<TransferOptionRow>(
    `SELECT m.public_id, CONCAT(pe.nome, ' · ', m.numero, ' · ', pr.nome) AS label, p.public_id AS participant_public_id, u.nome AS current_unit FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.status = 'ATIVA'${participantPublicId ? " AND p.public_id = ?" : ""}${filter.clause} ORDER BY pe.nome`,
    [...(participantPublicId ? [participantPublicId] : []), ...filter.values],
  );
  const destinations = await queryRows<DestinationRow>(
    `SELECT CONCAT(pr.public_id, ':', u.public_id) AS option_value, CONCAT(pr.nome, ' · ', u.nome) AS label FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pu.ativo = 1 AND pr.ativo = 1 AND u.ativo = 1 ORDER BY pr.nome, u.nome`,
  );
  const classes = await queryRows<ClassRow>(
    `SELECT t.public_id, CONCAT(t.nome, ' · ', u.nome) AS label, CONCAT(pr.public_id, ':', u.public_id) AS option_value FROM turmas t JOIN programas_unidades pu ON pu.id = t.programa_unidade_id JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE t.status = 'ATIVA' ORDER BY u.nome, t.nome`,
  );
  return { registrations, destinations, classes };
}

export async function getTransfer(publicId: string) {
  const { scope } = await requirePermission(PERMISSIONS.TRANSFERS_REQUEST);
  const filter = scopeSql(scope, "uo");
  const row = await queryOne<TransferDetailRow>(
    `SELECT mt.id, mt.public_id, mt.matricula_id AS registration_id, m.public_id AS registration_public_id, m.numero AS registration_number, pe.nome AS participant_name, uo.id AS origin_unit_id, uo.nome AS origin_name, ud.id AS destination_unit_id, ud.nome AS destination_name, td.nome AS destination_class_name, mt.status, mt.motivo AS reason, mt.solicitada_em AS requested_at, mt.analisada_em AS analyzed_at, mt.efetivada_em AS effected_at, COALESCE(ps.nome, us.login) AS requester_name, COALESCE(pa.nome, ua.login) AS analyst_name, COALESCE(pef.nome, ue.login) AS effector_name FROM matriculas_transferencias mt JOIN matriculas m ON m.id = mt.matricula_id JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculos mvo ON mvo.id = mt.origem_vinculo_id JOIN programas_unidades puo ON puo.id = mvo.programa_unidade_id JOIN unidades uo ON uo.id = puo.unidade_id JOIN programas_unidades pud ON pud.id = mt.destino_programa_unidade_id JOIN unidades ud ON ud.id = pud.unidade_id LEFT JOIN turmas td ON td.id = mt.destino_turma_id JOIN usuarios us ON us.id = mt.solicitada_por LEFT JOIN pessoas ps ON ps.id = us.pessoa_id LEFT JOIN usuarios ua ON ua.id = mt.analisada_por LEFT JOIN pessoas pa ON pa.id = ua.pessoa_id LEFT JOIN usuarios ue ON ue.id = mt.efetivada_por LEFT JOIN pessoas pef ON pef.id = ue.pessoa_id WHERE mt.public_id = ?${filter.clause} LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!row)
    throw new NotFoundError("Transferência não encontrada no seu escopo.");
  return row;
}
