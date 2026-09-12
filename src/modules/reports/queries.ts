import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";

export type ReportFilters = {
  unit?: string;
  program?: string;
  gender?: string;
  ageBand?: string;
  page: number;
};

type SummaryRow = RowDataPacket & {
  total: number;
  average_age: number | null;
  without_birth_date: number;
};
type DistributionRow = RowDataPacket & {
  key: string;
  label: string;
  total: number;
};
type DetailRow = RowDataPacket & {
  public_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  registrations: string | null;
  programs: string | null;
  units: string | null;
  classes: string | null;
};
type CountRow = RowDataPacket & { total: number };
type OptionRow = RowDataPacket & { public_id: string; name: string };

const AGE_BANDS: Record<
  string,
  { min?: number; max?: number; unknown?: boolean }
> = {
  "0-5": { min: 0, max: 5 },
  "6-9": { min: 6, max: 9 },
  "10-12": { min: 10, max: 12 },
  "13-15": { min: 13, max: 15 },
  "16-17": { min: 16, max: 17 },
  "18+": { min: 18 },
  UNKNOWN: { unknown: true },
};

function scopeSql(scope: PermissionScope): {
  clause: string;
  values: string[];
} {
  if (scope.global) return { clause: "", values: [] };
  return {
    clause: ` AND u.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

function buildBase(scope: PermissionScope, filters: ReportFilters) {
  const where = [
    "pt.ativo = 1",
    "pt.excluido_em IS NULL",
    "pe.excluido_em IS NULL",
    "m.status = 'ATIVA'",
  ];
  const values: (string | number)[] = [];

  if (filters.unit) {
    where.push("u.public_id = ?");
    values.push(filters.unit);
  }
  if (filters.program) {
    where.push("pr.public_id = ?");
    values.push(filters.program);
  }
  if (
    filters.gender &&
    ["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"].includes(filters.gender)
  ) {
    where.push("COALESCE(pe.sexo_codigo, 'NAO_INFORMADO') = ?");
    values.push(filters.gender);
  }

  const ageBand = filters.ageBand ? AGE_BANDS[filters.ageBand] : undefined;
  if (ageBand?.unknown) {
    where.push("pe.data_nascimento IS NULL");
  } else if (ageBand) {
    where.push("pe.data_nascimento IS NOT NULL");
    if (ageBand.min !== undefined) {
      where.push("TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) >= ?");
      values.push(ageBand.min);
    }
    if (ageBand.max !== undefined) {
      where.push("TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= ?");
      values.push(ageBand.max);
    }
  }

  const scopeFilter = scopeSql(scope);
  values.push(...scopeFilter.values);
  const from = `FROM participantes pt
    JOIN pessoas pe ON pe.id = pt.pessoa_id
    JOIN matriculas m ON m.participante_id = pt.id
    JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id
    JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id
    JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id
    JOIN unidades u ON u.id = pu.unidade_id
    JOIN programas pr ON pr.id = m.programa_id
    LEFT JOIN turmas t ON t.id = mv.turma_id
    WHERE ${where.join(" AND ")}${scopeFilter.clause}`;
  return { from, values };
}

export async function getReportsData(filters: ReportFilters) {
  const { scope } = await requirePermission(PERMISSIONS.ATTENDANCE_REPORTS);
  const { from, values } = buildBase(scope, filters);
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const scopedUnits = scopeSql(scope);

  const [
    summary,
    genders,
    ages,
    units,
    programs,
    count,
    details,
    unitOptions,
    programOptions,
  ] = await Promise.all([
    queryOne<SummaryRow>(
      `SELECT COUNT(*) AS total,
                ROUND(AVG(x.age), 1) AS average_age,
                SUM(x.age IS NULL) AS without_birth_date
           FROM (
             SELECT DISTINCT pt.id,
                    TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) AS age
             ${from}
           ) x`,
      values,
    ),
    queryRows<DistributionRow>(
      `SELECT COALESCE(pe.sexo_codigo, 'NAO_INFORMADO') AS \`key\`,
                CASE COALESCE(pe.sexo_codigo, 'NAO_INFORMADO')
                  WHEN 'FEMININO' THEN 'Feminino'
                  WHEN 'MASCULINO' THEN 'Masculino'
                  WHEN 'OUTRO' THEN 'Outro'
                  ELSE 'Não informado'
                END AS label,
                COUNT(DISTINCT pt.id) AS total
           ${from}
          GROUP BY COALESCE(pe.sexo_codigo, 'NAO_INFORMADO')
          ORDER BY total DESC, label`,
      values,
    ),
    queryRows<DistributionRow>(
      `SELECT age_data.\`key\`, age_data.label, COUNT(*) AS total
           FROM (
             SELECT DISTINCT pt.id,
               CASE
                 WHEN pe.data_nascimento IS NULL THEN 'UNKNOWN'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 5 THEN '0-5'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 9 THEN '6-9'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 12 THEN '10-12'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 15 THEN '13-15'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 17 THEN '16-17'
                 ELSE '18+'
               END AS \`key\`,
               CASE
                 WHEN pe.data_nascimento IS NULL THEN 'Não informada'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 5 THEN '0 a 5 anos'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 9 THEN '6 a 9 anos'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 12 THEN '10 a 12 anos'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 15 THEN '13 a 15 anos'
                 WHEN TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) <= 17 THEN '16 a 17 anos'
                 ELSE '18 anos ou mais'
               END AS label
             ${from}
           ) age_data
          GROUP BY age_data.\`key\`, age_data.label
          ORDER BY FIELD(age_data.\`key\`, '0-5', '6-9', '10-12', '13-15', '16-17', '18+', 'UNKNOWN')`,
      values,
    ),
    queryRows<DistributionRow>(
      `SELECT u.public_id AS \`key\`, u.nome AS label, COUNT(DISTINCT pt.id) AS total
           ${from}
          GROUP BY u.id, u.public_id, u.nome
          ORDER BY total DESC, u.nome`,
      values,
    ),
    queryRows<DistributionRow>(
      `SELECT pr.public_id AS \`key\`, pr.nome AS label, COUNT(DISTINCT pt.id) AS total
           ${from}
          GROUP BY pr.id, pr.public_id, pr.nome
          ORDER BY total DESC, pr.nome`,
      values,
    ),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM (SELECT DISTINCT pt.id ${from}) filtered`,
      values,
    ),
    queryRows<DetailRow>(
      `SELECT pt.public_id,
                COALESCE(NULLIF(pe.nome_social, ''), pe.nome) AS name,
                TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) AS age,
                pe.sexo_codigo AS gender,
                GROUP_CONCAT(DISTINCT m.numero ORDER BY m.numero SEPARATOR ', ') AS registrations,
                GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS programs,
                GROUP_CONCAT(DISTINCT u.nome ORDER BY u.nome SEPARATOR ', ') AS units,
                GROUP_CONCAT(DISTINCT t.nome ORDER BY t.nome SEPARATOR ', ') AS classes
           ${from}
          GROUP BY pt.id, pt.public_id, pe.nome, pe.nome_social, pe.data_nascimento, pe.sexo_codigo
          ORDER BY name
          LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<OptionRow>(
      `SELECT u.public_id, u.nome AS name
           FROM unidades u
          WHERE u.ativo = 1 AND u.excluido_em IS NULL${scopedUnits.clause}
          ORDER BY u.nome`,
      scopedUnits.values,
    ),
    queryRows<OptionRow>(
      `SELECT DISTINCT pr.public_id, pr.nome AS name
           FROM programas pr
           JOIN programas_unidades pu ON pu.programa_id = pr.id AND pu.ativo = 1
           JOIN unidades u ON u.id = pu.unidade_id
          WHERE pr.ativo = 1 AND pr.excluido_em IS NULL${scopedUnits.clause}
          ORDER BY pr.nome`,
      scopedUnits.values,
    ),
  ]);

  return {
    summary: {
      total: summary?.total ?? 0,
      averageAge: summary?.average_age ?? null,
      withoutBirthDate: summary?.without_birth_date ?? 0,
    },
    distributions: { genders, ages, units, programs },
    details,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    unitOptions,
    programOptions,
  };
}

export async function getReportPrintRows(filters: Omit<ReportFilters, "page">) {
  const { scope } = await requirePermission(PERMISSIONS.ATTENDANCE_REPORTS);
  const { from, values } = buildBase(scope, { ...filters, page: 1 });
  const rows = await queryRows<DetailRow>(
    `SELECT pt.public_id,
            COALESCE(NULLIF(pe.nome_social, ''), pe.nome) AS name,
            TIMESTAMPDIFF(YEAR, pe.data_nascimento, UTC_DATE()) AS age,
            pe.sexo_codigo AS gender,
            GROUP_CONCAT(DISTINCT m.numero ORDER BY m.numero SEPARATOR ', ') AS registrations,
            GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS programs,
            GROUP_CONCAT(DISTINCT u.nome ORDER BY u.nome SEPARATOR ', ') AS units,
            GROUP_CONCAT(DISTINCT t.nome ORDER BY t.nome SEPARATOR ', ') AS classes
       ${from}
      GROUP BY pt.id, pt.public_id, pe.nome, pe.nome_social, pe.data_nascimento, pe.sexo_codigo
      ORDER BY name
      LIMIT 5001`,
    values,
  );
  return { rows: rows.slice(0, 5000), truncated: rows.length > 5000 };
}
