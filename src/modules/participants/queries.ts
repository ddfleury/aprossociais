import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE, escapeLike } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

export type ParticipantFilters = {
  q?: string;
  status?: string;
  gender?: string;
  unit?: string;
  ageMin?: string;
  ageMax?: string;
  page: number;
};
type CountRow = RowDataPacket & { total: number };
type ParticipantRow = RowDataPacket & {
  public_id: string;
  name: string;
  social_name: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  active: number;
  registration_number: string | null;
  program_name: string | null;
  unit_name: string | null;
  class_name: string | null;
};
type UnitRow = RowDataPacket & { public_id: string; name: string };
type ProgramUnitRow = RowDataPacket & {
  option_value: string;
  program_name: string;
  unit_name: string;
};
type ClassRow = RowDataPacket & {
  public_id: string;
  name: string;
  option_value: string;
};
type ResponsibleRow = RowDataPacket & {
  name: string;
  relationship: string;
  legal: number;
  pickup: number;
  masked_contact: string | null;
};
type HistoryRow = RowDataPacket & {
  public_id: string;
  event_type: string;
  summary: string;
  occurred_at: string;
  user_name: string | null;
};
export type ParticipantEditRow = RowDataPacket & {
  public_id: string;
  name: string;
  social_name: string | null;
  birth_date: string | null;
  gender: string | null;
  blood_type: string | null;
  active: number;
  whatsapp_consent: number;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listParticipants(filters: ParticipantFilters) {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_VIEW);
  const scopeFilter = scopeSql(scope);
  const where = ["pe.excluido_em IS NULL", "pt.excluido_em IS NULL"];
  const values: (string | number)[] = [];
  if (filters.q?.trim()) {
    const search = `%${escapeLike(filters.q.trim())}%`;
    where.push("(pe.nome LIKE ? OR pe.nome_social LIKE ? OR m.numero LIKE ?)");
    values.push(search, search, search);
  }
  if (filters.status === "active") where.push("pt.ativo = 1");
  if (filters.status === "inactive") where.push("pt.ativo = 0");
  if (
    filters.gender &&
    ["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"].includes(filters.gender)
  ) {
    where.push("pe.sexo_codigo = ?");
    values.push(filters.gender);
  }
  if (filters.unit) {
    where.push("u.public_id = ?");
    values.push(filters.unit);
  }
  const ageMin = Number.parseInt(filters.ageMin ?? "", 10);
  if (Number.isFinite(ageMin) && ageMin >= 0 && ageMin <= 120) {
    where.push("TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) >= ?");
    values.push(ageMin);
  }
  const ageMax = Number.parseInt(filters.ageMax ?? "", 10);
  if (Number.isFinite(ageMax) && ageMax >= 0 && ageMax <= 120) {
    where.push("TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= ?");
    values.push(ageMax);
  }
  const from = `FROM participantes pt JOIN pessoas pe ON pe.id = pt.pessoa_id LEFT JOIN matriculas m ON m.participante_id = pt.id AND m.status = 'ATIVA' LEFT JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id LEFT JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id LEFT JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id LEFT JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN programas pr ON pr.id = m.programa_id LEFT JOIN turmas t ON t.id = mv.turma_id WHERE ${where.join(" AND ")}${scopeFilter.clause}`;
  values.push(...scopeFilter.values);
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const [count, rows, units] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(DISTINCT pt.id) AS total ${from}`, values),
    queryRows<ParticipantRow>(
      `SELECT pt.public_id, pe.nome AS name, pe.nome_social AS social_name, pe.data_nascimento AS birth_date, TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) AS age, pe.sexo_codigo AS gender, pt.ativo AS active, MIN(m.numero) AS registration_number, GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS program_name, GROUP_CONCAT(DISTINCT u.nome ORDER BY u.nome SEPARATOR ', ') AS unit_name, GROUP_CONCAT(DISTINCT t.nome ORDER BY t.nome SEPARATOR ', ') AS class_name ${from} GROUP BY pt.id, pt.public_id, pe.nome, pe.nome_social, pe.data_nascimento, pe.sexo_codigo, pt.ativo ORDER BY pe.nome LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
    listAccessibleUnits(scope),
  ]);
  return { rows, total: count?.total ?? 0, units, pageSize: DEFAULT_PAGE_SIZE };
}

export async function listAccessibleUnits(
  scope?: PermissionScope,
): Promise<UnitRow[]> {
  const actualScope =
    scope ?? (await requirePermission(PERMISSIONS.PARTICIPANTS_VIEW)).scope;
  const filter = scopeSql(actualScope);
  return queryRows<UnitRow>(
    `SELECT DISTINCT u.public_id, u.nome AS name FROM unidades u WHERE u.ativo = 1 AND u.excluido_em IS NULL${filter.clause} ORDER BY u.nome`,
    filter.values,
  );
}

export async function getEnrollmentOptions() {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_CREATE);
  const filter = scopeSql(scope);
  const [programUnits, classes] = await Promise.all([
    queryRows<ProgramUnitRow>(
      `SELECT CONCAT(pr.public_id, ':', u.public_id) AS option_value, pr.nome AS program_name, u.nome AS unit_name FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pu.ativo = 1 AND pr.ativo = 1 AND u.ativo = 1 AND (pu.data_fim IS NULL OR pu.data_fim >= UTC_DATE())${filter.clause} ORDER BY pr.nome, u.nome`,
      filter.values,
    ),
    queryRows<ClassRow>(
      `SELECT t.public_id, t.nome AS name, CONCAT(pr.public_id, ':', u.public_id) AS option_value FROM turmas t JOIN programas_unidades pu ON pu.id = t.programa_unidade_id JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE t.status = 'ATIVA'${filter.clause} ORDER BY t.ano_referencia DESC, t.nome`,
      filter.values,
    ),
  ]);
  return { programUnits, classes };
}

export async function getParticipant(publicId: string) {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_VIEW);
  const filter = scopeSql(scope);
  const participant = await queryOne<ParticipantRow>(
    `SELECT pt.public_id, pe.nome AS name, pe.nome_social AS social_name, pe.data_nascimento AS birth_date, TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) AS age, pe.sexo_codigo AS gender, pt.ativo AS active, MIN(m.numero) AS registration_number, GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS program_name, GROUP_CONCAT(DISTINCT u.nome ORDER BY u.nome SEPARATOR ', ') AS unit_name, GROUP_CONCAT(DISTINCT t.nome ORDER BY t.nome SEPARATOR ', ') AS class_name FROM participantes pt JOIN pessoas pe ON pe.id = pt.pessoa_id LEFT JOIN matriculas m ON m.participante_id = pt.id LEFT JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id LEFT JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id LEFT JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id LEFT JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN programas pr ON pr.id = m.programa_id LEFT JOIN turmas t ON t.id = mv.turma_id WHERE pt.public_id = ? AND pt.excluido_em IS NULL${filter.clause} GROUP BY pt.id, pt.public_id, pe.nome, pe.nome_social, pe.data_nascimento, pe.sexo_codigo, pt.ativo`,
    [publicId, ...filter.values],
  );
  if (!participant)
    throw new NotFoundError(
      "Participante não encontrado no seu escopo de acesso.",
    );
  const [responsibles, history] = await Promise.all([
    queryRows<ResponsibleRow>(
      `SELECT rp.nome AS name, pr.parentesco_codigo AS relationship, pr.responsavel_legal AS legal, pr.autorizado_retirada AS pickup, MAX(pc.valor_mascarado) AS masked_contact FROM participantes pt JOIN participantes_responsaveis pr ON pr.participante_id = pt.id AND pr.valido_ate IS NULL JOIN pessoas rp ON rp.id = pr.responsavel_pessoa_id LEFT JOIN pessoas_contatos pc ON pc.pessoa_id = rp.id AND pc.excluido_em IS NULL WHERE pt.public_id = ? GROUP BY pr.id, rp.nome, pr.parentesco_codigo, pr.responsavel_legal, pr.autorizado_retirada ORDER BY pr.responsavel_legal DESC, rp.nome`,
      [publicId],
    ),
    queryRows<HistoryRow>(
      `SELECT ph.public_id, ph.tipo_evento AS event_type, ph.resumo AS summary, ph.ocorrido_em AS occurred_at, COALESCE(pu.nome, u.login) AS user_name FROM participantes_historico ph JOIN participantes pt ON pt.id = ph.participante_id LEFT JOIN usuarios u ON u.id = ph.usuario_id LEFT JOIN pessoas pu ON pu.id = u.pessoa_id WHERE pt.public_id = ? ORDER BY ph.ocorrido_em DESC LIMIT 30`,
      [publicId],
    ),
  ]);
  return { participant, responsibles, history };
}

export async function getParticipantForEdit(
  publicId: string,
): Promise<ParticipantEditRow> {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_EDIT);
  const filter = scopeSql(scope);
  const participant = await queryOne<ParticipantEditRow>(
    `SELECT DISTINCT pt.public_id, pe.nome AS name, pe.nome_social AS social_name,
            pe.data_nascimento AS birth_date, pe.sexo_codigo AS gender,
            pt.tipo_sanguineo AS blood_type, pt.ativo AS active,
            IF(EXISTS (
              SELECT 1
                FROM consentimentos c
                JOIN consentimentos_tipos ct ON ct.id = c.tipo_id
               WHERE c.participante_id = pt.id
                 AND ct.codigo = 'COMUNICACAO_WHATSAPP'
                 AND c.concedido = 1 AND c.revogado_em IS NULL
            ), 1, 0) AS whatsapp_consent
       FROM participantes pt
       JOIN pessoas pe ON pe.id = pt.pessoa_id
       JOIN matriculas m ON m.participante_id = pt.id AND m.status = 'ATIVA'
       JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id
       JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id
       JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id
       JOIN unidades u ON u.id = pu.unidade_id
      WHERE pt.public_id = ? AND pt.excluido_em IS NULL${filter.clause}
      LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!participant)
    throw new NotFoundError(
      "Participante não encontrado no seu escopo de edição.",
    );
  return participant;
}
