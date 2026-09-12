import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { PageHeader, Pagination } from "@/components/ui";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { parsePage } from "@/core/http/pagination";
import { listAuditEvents, type AuditFilters } from "@/modules/audit/queries";

export const metadata: Metadata = { title: "Auditoria" };
type Params = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const filters: AuditFilters = {
    q: one(params.q),
    action: one(params.action),
    entity: one(params.entity),
    from: one(params.from),
    to: one(params.to),
    page: parsePage(one(params.page)),
  };
  const data = await listAuditEvents(filters);
  const timeZone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Segurança e conformidade"
        title="Trilha de auditoria"
        description="Registro somente leitura das ações relevantes. Senhas, tokens e dados sensíveis não são exibidos."
      />
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="q">Usuário, protocolo ou identificador</label>
          <input className="input" id="q" name="q" defaultValue={filters.q} />
        </div>
        <div className="field">
          <label htmlFor="action">Ação</label>
          <select
            className="select"
            id="action"
            name="action"
            defaultValue={filters.action ?? ""}
          >
            <option value="">Todas</option>
            {data.actions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="entity">Entidade</label>
          <select
            className="select"
            id="entity"
            name="entity"
            defaultValue={filters.entity ?? ""}
          >
            <option value="">Todas</option>
            {data.entities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">De</label>
          <input
            className="input"
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </div>
        <div className="field">
          <label htmlFor="to">Até</label>
          <input
            className="input"
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to}
          />
        </div>
        <button className="button" type="submit">
          <Search size={14} /> Filtrar
        </button>
        <Link className="button secondary" href="/auditoria">
          Limpar
        </Link>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data e hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Identificador público</th>
              <th>Protocolo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.public_id}>
                <td>{formatUtcDateTime(row.occurred_at, timeZone)}</td>
                <td>
                  <strong className="cell-title">
                    {row.user_name ?? "Sistema"}
                  </strong>
                  {row.login ? (
                    <span className="cell-subtitle">{row.login}</span>
                  ) : null}
                </td>
                <td>
                  <span className="badge info">
                    {row.action.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{row.entity.replaceAll("_", " ")}</td>
                <td>
                  <code>{row.entity_public_id ?? "—"}</code>
                </td>
                <td>
                  <code>{row.request_id ?? "—"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={filters.page}
        total={data.total}
        pageSize={data.pageSize}
        pathname="/auditoria"
        query={{
          q: filters.q,
          action: filters.action,
          entity: filters.entity,
          from: filters.from,
          to: filters.to,
        }}
      />
    </>
  );
}
