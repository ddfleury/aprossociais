import "server-only";

import { PERMISSIONS, type PermissionScope } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { decryptText } from "@/core/crypto/sensitive";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";
import { DEFAULT_PAGE_SIZE } from "@/core/http/pagination";
import { NotFoundError } from "@/core/security/errors";

type CountRow = RowDataPacket & { total: number };
type QueueRow = RowDataPacket & {
  public_id: string;
  title: string;
  channel: string;
  unit_name: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  total: number;
  pending: number;
  sent: number;
  failed: number;
  blocked: number;
};
type UnitOption = RowDataPacket & {
  id: string;
  public_id: string;
  name: string;
};
export type RecipientCandidate = {
  registration_public_id: string;
  registration_number: string;
  participant_name: string;
  unit_name: string;
  masked_destination: string;
  eligible: number;
  reason: string;
};
type RecipientCandidateRow = RowDataPacket & RecipientCandidate;
type QueueDetailRow = QueueRow &
  RowDataPacket & {
    id: string;
    unit_id: string | null;
    encrypted_message: Buffer;
    creator_name: string;
    started_at: string | null;
    completed_at: string | null;
  };
type RecipientRow = RowDataPacket & {
  public_id: string;
  name: string | null;
  destination: string;
  status: string;
  attempts: number;
  sent_at: string | null;
  error_code: string | null;
};

function scopeSql(scope: PermissionScope, alias = "u") {
  if (scope.global) return { clause: "", values: [] as string[] };
  return {
    clause: ` AND ${alias}.id IN (${scope.unitIds.map(() => "?").join(",")})`,
    values: scope.unitIds,
  };
}

export async function listQueues(page: number) {
  const { scope } = await requirePermission(PERMISSIONS.COMMUNICATIONS_CREATE);
  const filter = scopeSql(scope);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const from =
    "FROM comunicacoes_filas cf LEFT JOIN unidades u ON u.id = cf.unidade_id";
  const where = scope.global
    ? ""
    : ` WHERE u.id IN (${scope.unitIds.map(() => "?").join(",")})`;
  const values = scope.global ? [] : scope.unitIds;
  const [count, rows, units] = await Promise.all([
    queryOne<CountRow>(`SELECT COUNT(*) AS total ${from}${where}`, values),
    queryRows<QueueRow>(
      `SELECT cf.public_id, cf.titulo AS title, cf.canal AS channel, u.nome AS unit_name, cf.status, cf.agendada_para AS scheduled_at, cf.criado_em AS created_at, COUNT(cd.id) AS total, SUM(cd.status = 'PENDENTE') AS pending, SUM(cd.status IN ('ENVIADA','ENTREGUE','LIDA')) AS sent, SUM(cd.status = 'FALHOU') AS failed, SUM(cd.status = 'BLOQUEADA') AS blocked ${from} LEFT JOIN comunicacoes_destinatarios cd ON cd.fila_id = cf.id${where} GROUP BY cf.id, cf.public_id, cf.titulo, cf.canal, u.nome, cf.status, cf.agendada_para, cf.criado_em ORDER BY cf.criado_em DESC LIMIT ? OFFSET ?`,
      [...values, DEFAULT_PAGE_SIZE, offset],
    ),
    queryRows<UnitOption>(
      `SELECT u.id, u.public_id, u.nome AS name FROM unidades u WHERE u.ativo = 1 AND u.excluido_em IS NULL${filter.clause} ORDER BY u.nome`,
      filter.values,
    ),
  ]);
  return { rows, total: count?.total ?? 0, pageSize: DEFAULT_PAGE_SIZE, units };
}

export async function getComposerData(unitPublicId?: string) {
  const { scope } = await requirePermission(PERMISSIONS.COMMUNICATIONS_CREATE);
  const filter = scopeSql(scope);
  const units = await queryRows<UnitOption>(
    `SELECT u.id, u.public_id, u.nome AS name FROM unidades u WHERE u.ativo = 1 AND u.excluido_em IS NULL${filter.clause} ORDER BY u.nome`,
    filter.values,
  );
  const selectedUnit =
    unitPublicId && units.some((unit) => unit.public_id === unitPublicId)
      ? unitPublicId
      : units[0]?.public_id;
  if (!selectedUnit)
    return {
      units,
      selectedUnit: undefined,
      candidates: [] as RecipientCandidate[],
    };
  const candidates = await queryRows<RecipientCandidateRow>(
    `SELECT m.public_id AS registration_public_id, m.numero AS registration_number, pe.nome AS participant_name, u.nome AS unit_name, pc.valor_mascarado AS masked_destination, IF(EXISTS (SELECT 1 FROM consentimentos c JOIN consentimentos_tipos ct ON ct.id = c.tipo_id WHERE c.participante_id = p.id AND ct.codigo = 'COMUNICACAO_WHATSAPP' AND c.concedido = 1 AND c.revogado_em IS NULL) AND NOT EXISTS (SELECT 1 FROM comunicacoes_bloqueios cb WHERE cb.canal = 'WHATSAPP' AND cb.destino_hash = pc.valor_busca AND cb.revogado_em IS NULL AND (cb.programa_id IS NULL OR cb.programa_id = m.programa_id)), 1, 0) AS eligible, CASE WHEN NOT EXISTS (SELECT 1 FROM consentimentos c JOIN consentimentos_tipos ct ON ct.id = c.tipo_id WHERE c.participante_id = p.id AND ct.codigo = 'COMUNICACAO_WHATSAPP' AND c.concedido = 1 AND c.revogado_em IS NULL) THEN 'Sem consentimento' WHEN EXISTS (SELECT 1 FROM comunicacoes_bloqueios cb WHERE cb.canal = 'WHATSAPP' AND cb.destino_hash = pc.valor_busca AND cb.revogado_em IS NULL AND (cb.programa_id IS NULL OR cb.programa_id = m.programa_id)) THEN 'Contato bloqueado' ELSE 'Disponível' END AS reason FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id JOIN participantes_responsavel_principal prp ON prp.participante_id = p.id JOIN participantes_responsaveis pr ON pr.id = prp.participante_responsavel_id JOIN pessoas_contatos pc ON pc.id = (SELECT pc2.id FROM pessoas_contatos pc2 WHERE pc2.pessoa_id = pr.responsavel_pessoa_id AND pc2.tipo = 'TELEFONE' AND pc2.permite_whatsapp = 1 AND pc2.excluido_em IS NULL ORDER BY pc2.principal DESC, pc2.id LIMIT 1) WHERE m.status = 'ATIVA' AND u.public_id = ? ORDER BY pe.nome LIMIT 1000`,
    [selectedUnit],
  );
  return { units, selectedUnit, candidates };
}

export async function getQueue(publicId: string) {
  const { scope } = await requirePermission(PERMISSIONS.COMMUNICATIONS_CREATE);
  const values: string[] = [publicId];
  const scopeClause = scope.global
    ? ""
    : ` AND u.id IN (${scope.unitIds.map(() => "?").join(",")})`;
  values.push(...scope.unitIds);
  const row = await queryOne<QueueDetailRow>(
    `SELECT cf.id, cf.public_id, cf.titulo AS title, cf.canal AS channel, cf.unidade_id AS unit_id, u.nome AS unit_name, cf.status, cf.agendada_para AS scheduled_at, cf.criado_em AS created_at, cf.iniciado_em AS started_at, cf.concluido_em AS completed_at, cf.mensagem_cifrada AS encrypted_message, COALESCE(p.nome, us.login) AS creator_name, COUNT(cd.id) AS total, SUM(cd.status = 'PENDENTE') AS pending, SUM(cd.status IN ('ENVIADA','ENTREGUE','LIDA')) AS sent, SUM(cd.status = 'FALHOU') AS failed, SUM(cd.status = 'BLOQUEADA') AS blocked FROM comunicacoes_filas cf LEFT JOIN unidades u ON u.id = cf.unidade_id JOIN usuarios us ON us.id = cf.criado_por LEFT JOIN pessoas p ON p.id = us.pessoa_id LEFT JOIN comunicacoes_destinatarios cd ON cd.fila_id = cf.id WHERE cf.public_id = ?${scopeClause} GROUP BY cf.id, cf.public_id, cf.titulo, cf.canal, cf.unidade_id, u.nome, cf.status, cf.agendada_para, cf.criado_em, cf.iniciado_em, cf.concluido_em, cf.mensagem_cifrada, p.nome, us.login LIMIT 1`,
    values,
  );
  if (!row) throw new NotFoundError("Fila não encontrada no seu escopo.");
  const recipients = await queryRows<RecipientRow>(
    `SELECT cd.public_id, cd.nome_snapshot AS name, cd.destino_mascarado AS destination, cd.status, cd.tentativas AS attempts, cd.enviado_em AS sent_at, cd.erro_codigo AS error_code FROM comunicacoes_destinatarios cd WHERE cd.fila_id = ? ORDER BY cd.nome_snapshot`,
    [row.id],
  );
  return {
    queue: { ...row, message: decryptText(row.encrypted_message) ?? "" },
    recipients,
  };
}
