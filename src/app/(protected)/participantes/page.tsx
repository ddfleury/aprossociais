import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus, Search } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { parsePage } from "@/core/http/pagination";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { listParticipants } from "@/modules/participants/queries";

export const metadata: Metadata = { title: "Participantes" };
type Params = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    status: one(params.status),
    gender: one(params.gender),
    unit: one(params.unit),
    ageMin: one(params.ageMin),
    ageMax: one(params.ageMax),
    page: parsePage(one(params.page)),
  };
  const [data, user] = await Promise.all([
    listParticipants(filters),
    requireCurrentUser(),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Cadastros"
        title="Participantes"
        description="Consulte crianças e adolescentes conforme as unidades autorizadas."
      >
        <PrintButton label="Imprimir lista" />
        {can(user, PERMISSIONS.PARTICIPANTS_CREATE) ? (
          <Link className="button" href="/participantes/novo">
            <Plus size={15} /> Novo participante
          </Link>
        ) : null}
      </PageHeader>
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="q">Nome ou matrícula</label>
          <input
            className="input"
            id="q"
            name="q"
            defaultValue={filters.q}
            placeholder="Pesquisar..."
          />
        </div>
        <div className="field">
          <label htmlFor="unit">Unidade</label>
          <select
            className="select"
            id="unit"
            name="unit"
            defaultValue={filters.unit ?? ""}
          >
            <option value="">Todas</option>
            {data.units.map((unit) => (
              <option key={unit.public_id} value={unit.public_id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="gender">Gênero</label>
          <select
            className="select"
            id="gender"
            name="gender"
            defaultValue={filters.gender ?? ""}
          >
            <option value="">Todos</option>
            <option value="FEMININO">Feminino</option>
            <option value="MASCULINO">Masculino</option>
            <option value="OUTRO">Outro</option>
            <option value="NAO_INFORMADO">Não informado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Situação</label>
          <select
            className="select"
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">Todas</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
        <div className="field" style={{ flex: "0 1 92px" }}>
          <label htmlFor="ageMin">Idade mín.</label>
          <input
            className="input"
            id="ageMin"
            name="ageMin"
            type="number"
            min="0"
            max="120"
            defaultValue={filters.ageMin}
          />
        </div>
        <div className="field" style={{ flex: "0 1 92px" }}>
          <label htmlFor="ageMax">Idade máx.</label>
          <input
            className="input"
            id="ageMax"
            name="ageMax"
            type="number"
            min="0"
            max="120"
            defaultValue={filters.ageMax}
          />
        </div>
        <button className="button" type="submit">
          <Search size={14} /> Filtrar
        </button>
        <Link className="button secondary" href="/participantes">
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
                  <th>Idade</th>
                  <th>Gênero</th>
                  <th>Matrícula / programa</th>
                  <th>Unidade / turma</th>
                  <th>Status</th>
                  <th className="no-print">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td>
                      <strong className="cell-title">
                        {row.social_name || row.name}
                      </strong>
                      {row.social_name ? (
                        <span className="cell-subtitle">Civil: {row.name}</span>
                      ) : null}
                    </td>
                    <td>{row.age === null ? "—" : `${row.age} anos`}</td>
                    <td>{row.gender?.replaceAll("_", " ") ?? "—"}</td>
                    <td>
                      <span className="cell-title">
                        {row.registration_number ?? "Sem matrícula ativa"}
                      </span>
                      <span className="cell-subtitle">
                        {row.program_name ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="cell-title">{row.unit_name ?? "—"}</span>
                      <span className="cell-subtitle">
                        {row.class_name ?? "Sem turma"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={row.active ? "ATIVO" : "INATIVO"} />
                    </td>
                    <td className="no-print">
                      <div className="table-actions">
                        <Link
                          className="button secondary small"
                          href={`/participantes/${row.public_id}`}
                        >
                          <Eye size={13} /> Abrir
                        </Link>
                      </div>
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
            pathname="/participantes"
            query={{
              q: filters.q,
              status: filters.status,
              gender: filters.gender,
              unit: filters.unit,
              ageMin: filters.ageMin,
              ageMax: filters.ageMax,
            }}
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
