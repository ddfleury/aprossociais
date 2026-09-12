import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
type PlanRow = RowDataPacket & {
  public_id: string;
  title: string;
  theme: string | null;
  program_name: string;
  minutes: number | null;
  status: string;
  version: number;
  updated_at: string;
  author_name: string;
};
type ProgramOption = RowDataPacket & { public_id: string; name: string };
type MeetingRow = RowDataPacket & {
  public_id: string;
  activity_name: string;
  unit_name: string;
  class_name: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  total_records: number;
};
type OfferOption = RowDataPacket & { public_id: string; label: string };
type PlanOption = RowDataPacket & { public_id: string; label: string };
type MeetingDetail = RowDataPacket & {
  id: string;
  public_id: string;
  activity_name: string;
  unit_name: string;
  unit_id: string;
  class_name: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  duration_minutes: number;
  offer_id: string;
  program_unit_id: string;
  class_id: string | null;
};
type AttendanceRow = RowDataPacket & {
  registration_id: string;
  registration_public_id: string;
  registration_number: string;
  participant_name: string;
  status: string | null;
  credited_minutes: number | null;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listLessonPlans(page: number) {
  const { scope } = await requirePermission(PERMISSIONS.LESSON_PLANS_MANAGE);
  const filter = scopeSql(scope);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const from = `FROM planos_aula pa JOIN programas pr ON pr.id = pa.programa_id JOIN usuarios uc ON uc.id = pa.criado_por LEFT JOIN pessoas pc ON pc.id = uc.pessoa_id WHERE pa.excluido_em IS NULL AND EXISTS (SELECT 1 FROM programas_unidades pu JOIN unidades u ON u.id = pu.unidade_id WHERE pu.programa_id = pr.id${filter.clause})`;
  const [count, rows, programs] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}`, filter.values),
    queryRows<PlanRow>(
      `SELECT pa.public_id, pa.titulo AS title, pa.tema AS theme, pr.nome AS program_name, pa.carga_minutos AS minutes, pa.status, pa.versao AS version, pa.atualizado_em AS updated_at, COALESCE(pc.nome, uc.login) AS author_name ${from} ORDER BY pa.atualizado_em DESC LIMIT ? OFFSET ?`,
      [...filter.values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<ProgramOption>(
      `SELECT DISTINCT pr.public_id, pr.nome AS name FROM programas pr JOIN programas_unidades pu ON pu.programa_id = pr.id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.ativo = 1 AND pu.ativo = 1${filter.clause} ORDER BY pr.nome`,
      filter.values,
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    programs,
  };
}

export async function getPlanPrograms() {
  return (await listLessonPlans(1)).programs;
}

export async function listMeetings(page: number) {
  const { scope } = await requirePermission(PERMISSIONS.ATTENDANCE_REPORTS);
  const filter = scopeSql(scope);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const from =
    "FROM encontros e JOIN atividades_ofertas ao ON ao.id = e.oferta_id JOIN atividades a ON a.id = ao.atividade_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN turmas t ON t.id = ao.turma_id";
  const where = `WHERE 1=1${filter.clause}`;
  const [count, rows, offers, plans] = await Promise.all([
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total ${from} ${where}`,
      filter.values,
    ),
    queryRows<MeetingRow>(
      `SELECT e.public_id, a.nome AS activity_name, u.nome AS unit_name, t.nome AS class_name, e.inicio_em AS starts_at, e.fim_em AS ends_at, e.status, COUNT(f.id) AS total_records ${from} LEFT JOIN frequencias f ON f.encontro_id = e.id ${where} GROUP BY e.id, e.public_id, a.nome, u.nome, t.nome, e.inicio_em, e.fim_em, e.status ORDER BY e.inicio_em DESC LIMIT ? OFFSET ?`,
      [...filter.values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<OfferOption>(
      `SELECT ao.public_id, CONCAT(a.nome, ' · ', u.nome, IF(t.nome IS NULL, '', CONCAT(' · ', t.nome))) AS label FROM atividades_ofertas ao JOIN atividades a ON a.id = ao.atividade_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN turmas t ON t.id = ao.turma_id WHERE ao.status = 'ATIVA'${filter.clause} ORDER BY u.nome, a.nome`,
      filter.values,
    ),
    queryRows<PlanOption>(
      `SELECT pa.public_id, CONCAT(pa.titulo, ' · ', pr.nome) AS label FROM planos_aula pa JOIN programas pr ON pr.id = pa.programa_id WHERE pa.status = 'PUBLICADO' AND pa.excluido_em IS NULL ORDER BY pa.titulo`,
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    offers,
    plans,
  };
}

export async function getMeeting(publicId: string) {
  const { scope } = await requirePermission(PERMISSIONS.ATTENDANCE_REPORTS);
  const filter = scopeSql(scope);
  const meeting = await queryOne<MeetingDetail>(
    `SELECT e.id, e.public_id, a.nome AS activity_name, u.nome AS unit_name, u.id AS unit_id, t.nome AS class_name, e.inicio_em AS starts_at, e.fim_em AS ends_at, e.status, TIMESTAMPDIFF(MINUTE, e.inicio_em, e.fim_em) AS duration_minutes, ao.id AS offer_id, ao.programa_unidade_id AS program_unit_id, ao.turma_id AS class_id FROM encontros e JOIN atividades_ofertas ao ON ao.id = e.oferta_id JOIN atividades a ON a.id = ao.atividade_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN turmas t ON t.id = ao.turma_id WHERE e.public_id = ?${filter.clause} LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!meeting)
    throw new NotFoundError("Encontro não encontrado no seu escopo.");
  const rows = await queryRows<AttendanceRow>(
    `SELECT m.id AS registration_id, m.public_id AS registration_public_id, m.numero AS registration_number, pe.nome AS participant_name, f.status, f.minutos_creditados AS credited_minutes FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id LEFT JOIN frequencias f ON f.matricula_id = m.id AND f.encontro_id = ? WHERE m.status = 'ATIVA' AND mv.programa_unidade_id = ? AND (? IS NULL OR mv.turma_id = ?) ORDER BY pe.nome`,
    [meeting.id, meeting.program_unit_id, meeting.class_id, meeting.class_id],
  );
  return { meeting, rows };
}
