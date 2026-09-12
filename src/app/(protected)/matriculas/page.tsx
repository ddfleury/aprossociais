import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Search } from "lucide-react";

import {
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { parsePage } from "@/core/http/pagination";
import { listRegistrations } from "@/modules/registrations/queries";

export const metadata: Metadata = { title: "Matrículas" };
function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const page = parsePage(one(params.page));
  const data = await listRegistrations({ q, page });
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Matrículas ativas"
        description="Vínculos atuais por programa, unidade e turma."
      >
        <PrintButton label="Imprimir lista" />
      </PageHeader>
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="q">Participante ou número</label>
          <input
            className="input"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Pesquisar matrícula..."
          />
        </div>
        <button className="button" type="submit">
          <Search size={14} /> Pesquisar
        </button>
        <Link className="button secondary" href="/matriculas">
          Limpar
        </Link>
      </form>
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Participante</th>
                  <th>Programa</th>
                  <th>Unidade / turma</th>
                  <th>Vínculo desde</th>
                  <th>Status</th>
                  <th className="no-print">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td className="cell-title">{row.number}</td>
                    <td>{row.participant_name}</td>
                    <td>{row.program_name}</td>
                    <td>
                      <span className="cell-title">{row.unit_name}</span>
                      <span className="cell-subtitle">
                        {row.class_name ?? "Sem turma"}
                      </span>
                    </td>
                    <td>{date(row.start_date)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="no-print">
                      <div className="table-actions">
                        <Link
                          className="button secondary small"
                          href={`/participantes/${row.participant_public_id}`}
                        >
                          <Eye size={13} /> Participante
                        </Link>
                        <Link
                          className="button small"
                          href={`/transferencias/nova?matricula=${row.public_id}`}
                        >
                          Transferir
                        </Link>
                      </div>
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
            pathname="/matriculas"
            query={{ q }}
          />
        </>
      ) : (
        <div className="card">
          <EmptyState />
        </div>
      )}
    </>
  );
}
