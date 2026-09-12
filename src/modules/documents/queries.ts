import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
type DocumentRow = RowDataPacket & {
  public_id: string;
  participant_public_id: string;
  participant_name: string;
  type_name: string;
  sensitive: number;
  original_name: string;
  mime_type: string;
  size: string;
  status: string;
  valid_until: string | null;
  created_at: string;
  unit_name: string;
};
type TypeOption = RowDataPacket & {
  code: string;
  name: string;
  sensitive: number;
};
type ParticipantOption = RowDataPacket & {
  public_id: string;
  name: string;
  unit_name: string;
};
export type DownloadDocument = RowDataPacket & {
  id: string;
  public_id: string;
  unit_id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size: string;
  sensitive: number;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listDocuments(filters: {
  participant?: string;
  page: number;
}) {
  const { scope } = await requirePermission(PERMISSIONS.DOCUMENTS_VIEW);
  const filter = scopeSql(scope);
  const values: string[] = [];
  const where = ["d.excluido_em IS NULL"];
  if (filters.participant) {
    where.push("p.public_id = ?");
    values.push(filters.participant);
  }
  const from = `FROM documentos d JOIN documentos_tipos dt ON dt.id = d.tipo_id JOIN participantes p ON p.id = d.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE ${where.join(" AND ")}${filter.clause}`;
  values.push(...filter.values);
  const offset = (filters.page - 1) * DEFAULT_PAGE_SIZE;
  const [count, rows, types, participants] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(DISTINCT d.id) AS total ${from}`, values),
    queryRows<DocumentRow>(
      `SELECT DISTINCT d.public_id, p.public_id AS participant_public_id, pe.nome AS participant_name, dt.nome AS type_name, dt.contem_dado_sensivel AS sensitive, d.nome_original AS original_name, d.mime_type, d.tamanho_bytes AS size, d.status, d.valido_ate AS valid_until, d.criado_em AS created_at, u.nome AS unit_name ${from} ORDER BY d.criado_em DESC LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<TypeOption>(
      "SELECT codigo AS code, nome AS name, contem_dado_sensivel AS sensitive FROM documentos_tipos WHERE ativo = 1 ORDER BY nome",
    ),
    queryRows<ParticipantOption>(
      `SELECT DISTINCT p.public_id, pe.nome AS name, u.nome AS unit_name FROM participantes p JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE p.ativo = 1${filter.clause} ORDER BY pe.nome LIMIT 2000`,
      filter.values,
    ),
  ]);
  return {
    rows,
    total: count?.total ?? 0,
    pageSize: DEFAULT_PAGE_SIZE,
    types,
    participants,
  };
}

export async function getDocumentForDownload(
  publicId: string,
): Promise<DownloadDocument> {
  const { scope } = await requirePermission(PERMISSIONS.DOCUMENTS_VIEW);
  const filter = scopeSql(scope);
  const row = await queryOne<DownloadDocument>(
    `SELECT d.id, d.public_id, u.id AS unit_id, d.storage_key, d.nome_original AS original_name, d.mime_type, d.tamanho_bytes AS size, dt.contem_dado_sensivel AS sensitive FROM documentos d JOIN documentos_tipos dt ON dt.id = d.tipo_id JOIN participantes p ON p.id = d.participante_id JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE d.public_id = ? AND d.status = 'ATIVO' AND d.excluido_em IS NULL${filter.clause} LIMIT 1`,
    [publicId, ...filter.values],
  );
  if (!row) throw new NotFoundError("Documento não encontrado no seu escopo.");
  return row;
}
