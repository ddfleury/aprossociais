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
import { listEvents } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Eventos" };
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const data = await listEvents(page);
  const zone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Operações"
        title="Eventos"
        description="Planejamento, capacidade e participantes dos eventos de cada unidade."
      >
        <Link className="button" href="/eventos/novo">
          <Plus size={15} /> Novo evento
        </Link>
      </PageHeader>
      <FlashMessage success={params.success} error={params.error} />
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Unidade</th>
                  <th>Data</th>
                  <th>Participantes</th>
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
                        {row.type} · {row.location ?? "Local a definir"}
                      </span>
                    </td>
                    <td>{row.unit_name}</td>
                    <td>{formatUtcDateTime(row.starts_at, zone)}</td>
                    <td>
                      {row.participant_count}
                      {row.capacity ? ` / ${row.capacity}` : ""}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <Link
                        className="button secondary small"
                        href={`/eventos/${row.public_id}`}
                      >
                        <Eye size={13} /> Gerenciar
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
            pathname="/eventos"
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum evento"
            description="Crie o primeiro evento para uma unidade."
          />
        </div>
      )}
    </>
  );
}
