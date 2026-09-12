import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";

import {
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { parsePage } from "@/core/http/pagination";
import { listTransfers } from "@/modules/registrations/queries";

export const metadata: Metadata = { title: "Transferências" };
function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = one(params.status);
  const page = parsePage(one(params.page));
  const data = await listTransfers({ status, page });
  return (
    <>
      <PageHeader
        eyebrow="Matrículas"
        title="Transferências"
        description="Fluxo rastreável de solicitação, análise e efetivação entre unidades."
      >
        <Link className="button" href="/transferencias/nova">
          <Plus size={15} /> Nova transferência
        </Link>
      </PageHeader>
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            className="select"
            id="status"
            name="status"
            defaultValue={status ?? ""}
          >
            <option value="">Todos</option>
            {[
              "SOLICITADA",
              "APROVADA",
              "RECUSADA",
              "EFETIVADA",
              "CANCELADA",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">
          Filtrar
        </button>
        <Link className="button secondary" href="/transferencias">
          Limpar
        </Link>
      </form>
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Solicitação</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td>
                      <strong className="cell-title">
                        {row.participant_name}
                      </strong>
                      <span className="cell-subtitle">
                        {row.registration_number}
                      </span>
                    </td>
                    <td>{row.origin_name}</td>
                    <td>{row.destination_name}</td>
                    <td>{dateTime(row.requested_at)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <Link
                        className="button secondary small"
                        href={`/transferencias/${row.public_id}`}
                      >
                        <Eye size={13} /> Analisar
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
            pathname="/transferencias"
            query={{ status }}
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhuma transferência"
            description="As solicitações aparecerão nesta fila."
          />
        </div>
      )}
    </>
  );
}
