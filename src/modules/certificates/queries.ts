import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
export type CertificateRow = RowDataPacket & {
  id: string;
  public_id: string;
  registration_id: string;
  participant_name: string;
  registration_number: string;
  program_name: string;
  unit_name: string;
  component_name: string | null;
  title: string;
  model_version: string;
  minutes: number | null;
  issued_at: string;
  status: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  issuer_name: string;
  unit_id: string;
};
export type PublicCertificateRow = RowDataPacket & {
  public_id: string;
  participant_name: string;
  program_name: string;
  unit_name: string;
  component_name: string | null;
  title: string;
  minutes: number | null;
  issued_at: string;
  status: string;
};
type RegistrationOption = RowDataPacket & { public_id: string; label: string };
type ComponentOption = RowDataPacket & {
  public_id: string;
  label: string;
  program_public_id: string;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listCertificates(page: number) {
  const { scope } = await requirePermission(PERMISSIONS.CERTIFICATES_ISSUE);
  const filter = scopeSql(scope);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const from = `FROM certificados c JOIN matriculas m ON m.id = c.matricula_id JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id LEFT JOIN componentes_curriculares cc ON cc.id = c.componente_id JOIN usuarios ue ON ue.id = c.emitido_por LEFT JOIN pessoas pie ON pie.id = ue.pessoa_id WHERE 1=1${filter.clause}`;
  const [count, rows, registrations, components] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}`, filter.values),
    queryRows<CertificateRow>(
      `SELECT c.id, c.public_id, m.id AS registration_id, c.participante_nome_snapshot AS participant_name, c.matricula_numero_snapshot AS registration_number, c.programa_nome_snapshot AS program_name, c.unidade_nome_snapshot AS unit_name, c.componente_nome_snapshot AS component_name, c.titulo AS title, c.modelo_versao AS model_version, c.carga_minutos AS minutes, c.emitido_em AS issued_at, c.status, c.revogado_em AS revoked_at, c.motivo_revogacao AS revocation_reason, COALESCE(pie.nome, ue.login) AS issuer_name, u.id AS unit_id ${from} ORDER BY c.emitido_em DESC LIMIT ? OFFSET ?`,
      [...filter.values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<RegistrationOption>(
      `SELECT m.public_id, CONCAT(pe.nome, ' · ', m.numero, ' · ', pr.nome, ' · ', u.nome) AS label FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.status = 'ATIVA'${filter.clause} ORDER BY pe.nome`,
      filter.values,
    ),
    queryRows<ComponentOption>(
      `SELECT cc.public_id, CONCAT(cc.nome, ' · ', pr.nome) AS label, pr.public_id AS program_public_id FROM componentes_curriculares cc JOIN programas pr ON pr.id = cc.programa_id WHERE cc.ativo = 1 ORDER BY pr.nome, cc.ordem, cc.nome`,
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    registrations,
    components,
  };
}

export async function getCertificate(
  publicId: string,
): Promise<CertificateRow> {
  const { scope } = await requirePermission(PERMISSIONS.CERTIFICATES_ISSUE);
  const filter = scopeSql(scope);
  const row = await queryOne<CertificateRow>(
    `SELECT c.id, c.public_id, m.id AS registration_id, c.participante_nome_snapshot AS participant_name, c.matricula_numero_snapshot AS registration_number, c.programa_nome_snapshot AS program_name, c.unidade_nome_snapshot AS unit_name, c.componente_nome_snapshot AS component_name, c.titulo AS title, c.modelo_versao AS model_version, c.carga_minutos AS minutes, c.emitido_em AS issued_at, c.status, c.revogado_em AS revoked_at, c.motivo_revogacao AS revocation_reason, COALESCE(pie.nome, ue.login) AS issuer_name, u.id AS unit_id FROM certificados c JOIN matriculas m ON m.id = c.matricula_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id JOIN usuarios ue ON ue.id = c.emitido_por LEFT JOIN pessoas pie ON pie.id = ue.pessoa_id WHERE c.public_id = ?${filter.clause} LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!row) throw new NotFoundError("Certificado não encontrado.");
  return row;
}

export async function getPublicCertificate(
  publicId: string,
): Promise<PublicCertificateRow> {
  const row = await queryOne<PublicCertificateRow>(
    `SELECT public_id, participante_nome_snapshot AS participant_name, programa_nome_snapshot AS program_name, unidade_nome_snapshot AS unit_name, componente_nome_snapshot AS component_name, titulo AS title, carga_minutos AS minutes, emitido_em AS issued_at, status FROM certificados WHERE public_id = ? LIMIT 1`,
    [publicId],
  );
  if (!row) throw new NotFoundError("Certificado não encontrado.");
  return row;
}
