import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";

import {
  EmptyState,
  FlashMessage,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { parsePage } from "@/core/http/pagination";
import { listQueues } from "@/modules/communications/queries";

export const metadata: Metadata = { title: "Comunicações" };
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const data = await listQueues(page);
  const zone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Operações"
        title="Comunicações"
        description="Filas rastreáveis, com consentimento, seleção explícita e proteção contra envio duplicado."
      >
        <Link className="button" href="/comunicacoes/nova">
          <Plus size={15} /> Nova mensagem
        </Link>
      </PageHeader>
      <FlashMessage success={params.success} error={params.error} />
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mensagem</th>
                  <th>Unidade</th>
                  <th>Agendamento</th>
                  <th>Progresso</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td>
                      <strong className="cell-title">{row.title}</strong>
                      <span className="cell-subtitle">
                        {row.channel} · criada em{" "}
                        {formatUtcDateTime(row.created_at, zone)}
                      </span>
                    </td>
                    <td>{row.unit_name ?? "Global"}</td>
                    <td>{formatUtcDateTime(row.scheduled_at, zone)}</td>
                    <td>
                      <span className="cell-title">
                        {row.sent ?? 0} / {row.total}
                      </span>
                      <span className="cell-subtitle">
                        {row.failed ?? 0} falha(s) · {row.blocked ?? 0}{" "}
                        bloqueado(s)
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <Link
                        className="button secondary small"
                        href={`/comunicacoes/${row.public_id}`}
                      >
                        <Eye size={13} /> Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={data.total}
            pageSize={data.pageSize}
            pathname="/comunicacoes"
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhuma fila"
            description="Prepare uma mensagem e selecione os destinatários autorizados."
          />
        </div>
      )}
    </>
  );
}
