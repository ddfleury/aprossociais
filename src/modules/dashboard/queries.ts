import "server-only";

import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryOne, queryRows, type RowDataPacket } from "@/core/db/pool";

type CountRow = RowDataPacket & { total: number };
type AttendanceRow = RowDataPacket & { percentage: number | null };
type ProgramRow = RowDataPacket & { name: string; total: number };
type TransferRow = RowDataPacket & {
  public_id: string;
  participant_name: string;
  origin_name: string;
  destination_name: string;
  status: string;
  requested_at: string;
};
type EventRow = RowDataPacket & {
  public_id: string;
  title: string;
  unit_name: string;
  starts_at: string;
  status: string;
};

function scoped(scope: { global: boolean; unitIds: string[] }, alias = "u") {
  if (scope.global) return { sql: "", values: [] as string[] };
  const placeholders = scope.unitIds.map(() => "?").join(",");
  return {
    sql: ` AND ${alias}.id IN (${placeholders})`,
    values: scope.unitIds,
  };
}

export async function getDashboardData() {
  const { scope } = await requirePermission(PERMISSIONS.PARTICIPANTS_VIEW);
  const filter = scoped(scope);
  const [
    participants,
    registrations,
    attendance,
    transfers,
    events,
    programs,
    recentTransfers,
    upcomingEvents,
  ] = await Promise.all([
    queryOne<CountRow>(
      `SELECT COUNT(DISTINCT p.id) AS total FROM participantes p JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE p.ativo = 1 AND p.excluido_em IS NULL${filter.sql}`,
      filter.values,
    ),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM matriculas m JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.status = 'ATIVA'${filter.sql}`,
      filter.values,
    ),
    queryOne<AttendanceRow>(
      `SELECT ROUND(100 * SUM(f.status = 'PRESENTE') / NULLIF(SUM(f.status IN ('PRESENTE','AUSENTE','JUSTIFICADA')),0), 1) AS percentage FROM frequencias f JOIN encontros e ON e.id = f.encontro_id JOIN atividades_ofertas ao ON ao.id = e.oferta_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE e.inicio_em >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)${filter.sql}`,
      filter.values,
    ),
    queryOne<CountRow>(
      `SELECT COUNT(DISTINCT mt.id) AS total FROM matriculas_transferencias mt JOIN matriculas_vinculos mv ON mv.id = mt.origem_vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE mt.status IN ('SOLICITADA','APROVADA')${filter.sql}`,
      filter.values,
    ),
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM eventos e JOIN programas_unidades pu ON pu.id = e.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE e.status IN ('PLANEJADO','ABERTO') AND e.fim_em >= UTC_TIMESTAMP()${filter.sql}`,
      filter.values,
    ),
    queryRows<ProgramRow>(
      `SELECT pr.nome AS name, COUNT(*) AS total FROM matriculas m JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.status = 'ATIVA'${filter.sql} GROUP BY pr.id, pr.nome ORDER BY total DESC LIMIT 6`,
      filter.values,
    ),
    queryRows<TransferRow>(
      `SELECT mt.public_id, pe.nome AS participant_name, u.nome AS origin_name, ud.nome AS destination_name, mt.status, mt.solicitada_em AS requested_at FROM matriculas_transferencias mt JOIN matriculas m ON m.id = mt.matricula_id JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculos mv ON mv.id = mt.origem_vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id JOIN programas_unidades pud ON pud.id = mt.destino_programa_unidade_id JOIN unidades ud ON ud.id = pud.unidade_id WHERE mt.status IN ('SOLICITADA','APROVADA')${filter.sql} ORDER BY mt.solicitada_em DESC LIMIT 5`,
      filter.values,
    ),
    queryRows<EventRow>(
      `SELECT e.public_id, e.titulo AS title, u.nome AS unit_name, e.inicio_em AS starts_at, e.status FROM eventos e JOIN programas_unidades pu ON pu.id = e.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE e.status IN ('PLANEJADO','ABERTO') AND e.fim_em >= UTC_TIMESTAMP()${filter.sql} ORDER BY e.inicio_em LIMIT 5`,
      filter.values,
    ),
  ]);
  return {
    participants: participants?.total ?? 0,
    registrations: registrations?.total ?? 0,
    attendance: attendance?.percentage ?? 0,
    transfers: transfers?.total ?? 0,
    events: events?.total ?? 0,
    programs,
    recentTransfers,
    upcomingEvents,
  };
}
