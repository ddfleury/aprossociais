import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
type EventRow = RowDataPacket & {
  public_id: string;
  title: string;
  type: string;
  unit_name: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  capacity: number | null;
  status: string;
  participant_count: number;
};
type ProgramUnitOption = RowDataPacket & {
  option_value: string;
  label: string;
};
type EventDetail = EventRow &
  RowDataPacket & {
    id: string;
    program_unit_id: string;
    unit_id: string;
    description: string | null;
  };
type CandidateRow = RowDataPacket & {
  registration_id: string;
  registration_public_id: string;
  registration_number: string;
  participant_name: string;
  selected_status: string | null;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listEvents(page: number) {
  const { scope } = await requirePermission(PERMISSIONS.EVENTS_MANAGE);
  const filter = scopeSql(scope);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const from =
    "FROM eventos e JOIN programas_unidades pu ON pu.id = e.programa_unidade_id JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id";
  const where = `WHERE 1=1${filter.clause}`;
  const [count, rows, programUnits] = await Promise.all([
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total ${from} ${where}`,
      filter.values,
    ),
    queryRows<EventRow>(
      `SELECT e.public_id, e.titulo AS title, e.tipo AS type, u.nome AS unit_name, e.inicio_em AS starts_at, e.fim_em AS ends_at, e.local_nome AS location, e.capacidade AS capacity, e.status, COUNT(ep.id) AS participant_count ${from} LEFT JOIN eventos_participantes ep ON ep.evento_id = e.id AND ep.status <> 'CANCELADO' ${where} GROUP BY e.id, e.public_id, e.titulo, e.tipo, u.nome, e.inicio_em, e.fim_em, e.local_nome, e.capacidade, e.status ORDER BY e.inicio_em DESC LIMIT ? OFFSET ?`,
      [...filter.values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<ProgramUnitOption>(
      `SELECT CONCAT(pr.public_id, ':', u.public_id) AS option_value, CONCAT(pr.nome, ' · ', u.nome) AS label FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pu.ativo = 1 AND pr.ativo = 1 AND u.ativo = 1${filter.clause} ORDER BY pr.nome, u.nome`,
      filter.values,
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    programUnits,
  };
}

export async function getEventOptions() {
  return (await listEvents(1)).programUnits;
}

export async function getEvent(publicId: string) {
  const { scope } = await requirePermission(PERMISSIONS.EVENTS_MANAGE);
  const filter = scopeSql(scope);
  const event = await queryOne<EventDetail>(
    `SELECT e.id, e.public_id, e.programa_unidade_id AS program_unit_id, u.id AS unit_id, e.titulo AS title, e.tipo AS type, e.descricao AS description, u.nome AS unit_name, e.inicio_em AS starts_at, e.fim_em AS ends_at, e.local_nome AS location, e.capacidade AS capacity, e.status, COUNT(ep.id) AS participant_count FROM eventos e JOIN programas_unidades pu ON pu.id = e.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN eventos_participantes ep ON ep.evento_id = e.id AND ep.status <> 'CANCELADO' WHERE e.public_id = ?${filter.clause} GROUP BY e.id, e.public_id, e.programa_unidade_id, u.id, e.titulo, e.tipo, e.descricao, u.nome, e.inicio_em, e.fim_em, e.local_nome, e.capacidade, e.status LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!event) throw new NotFoundError("Evento não encontrado no seu escopo.");
  const candidates = await queryRows<CandidateRow>(
    `SELECT m.id AS registration_id, m.public_id AS registration_public_id, m.numero AS registration_number, pe.nome AS participant_name, ep.status AS selected_status FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id LEFT JOIN eventos_participantes ep ON ep.matricula_id = m.id AND ep.evento_id = ? WHERE m.status = 'ATIVA' AND mv.programa_unidade_id = ? ORDER BY pe.nome`,
    [event.id, event.program_unit_id],
  );
  return { event, candidates };
}
