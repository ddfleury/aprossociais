import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Printer, RotateCcw } from "lucide-react";

import { PrintButton } from "@/components/print-button";
import { PageHeader, Pagination, StatCard } from "@/components/ui";
import { parsePage } from "@/core/http/pagination";
import { getReportsData, type ReportFilters } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Relatórios gerenciais" };

type Params = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function queryHref(
  filters: ReportFilters,
  change: Partial<ReportFilters>,
): string {
  const params = new URLSearchParams();
  const next = { ...filters, ...change, page: 1 };
  if (next.unit) params.set("unit", next.unit);
  if (next.program) params.set("program", next.program);
  if (next.gender) params.set("gender", next.gender);
  if (next.ageBand) params.set("ageBand", next.ageBand);
  return `/relatorios?${params.toString()}`;
}

function printHref(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.unit) params.set("unit", filters.unit);
  if (filters.program) params.set("program", filters.program);
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.ageBand) params.set("ageBand", filters.ageBand);
  return `/relatorios/imprimir?${params.toString()}`;
}

function DistributionCard({
  title,
  rows,
  dimension,
  filters,
  total,
}: {
  title: string;
  rows: { key: string; label: string; total: number }[];
  dimension: "gender" | "ageBand" | "unit" | "program";
  filters: ReportFilters;
  total: number;
}) {
  return (
    <section className="card report-card">
      <div className="card-header">
        <h2>{title}</h2>
        <span className="cell-subtitle">Clique para ver quem são</span>
      </div>
      <div className="card-body">
        <ul className="metric-list">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                className="report-metric"
                href={queryHref(filters, { [dimension]: row.key })}
              >
                <span>
                  <strong>{row.label}</strong>
                  <span className="progress" aria-hidden>
                    <span
                      style={{
                        width: `${total ? Math.max(3, (row.total / total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </span>
                <b>{row.total.toLocaleString("pt-BR")}</b>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const filters: ReportFilters = {
    unit: one(params.unit),
    program: one(params.program),
    gender: one(params.gender),
    ageBand: one(params.ageBand),
    page: parsePage(one(params.page)),
  };
  const data = await getReportsData(filters);
  const query = {
    unit: filters.unit,
    program: filters.program,
    gender: filters.gender,
    ageBand: filters.ageBand,
  };

  return (
    <>
      <PageHeader
        eyebrow="Inteligência operacional"
        title="Relatórios gerenciais"
        description="Os totais e a relação nominal consideram somente participantes ativos dentro do seu escopo de acesso."
      >
        <PrintButton label="Imprimir esta página" />
        <Link className="button" href={printHref(filters)}>
          <Printer size={15} /> Configurar impressão
        </Link>
      </PageHeader>

      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="unit">Unidade</label>
          <select
            className="select"
            id="unit"
            name="unit"
            defaultValue={filters.unit ?? ""}
          >
            <option value="">Todas as unidades</option>
            {data.unitOptions.map((option) => (
              <option key={option.public_id} value={option.public_id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="program">Programa</label>
          <select
            className="select"
            id="program"
            name="program"
            defaultValue={filters.program ?? ""}
          >
            <option value="">Todos os programas</option>
            {data.programOptions.map((option) => (
              <option key={option.public_id} value={option.public_id}>
                {option.name}
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
          <label htmlFor="ageBand">Faixa etária</label>
          <select
            className="select"
            id="ageBand"
            name="ageBand"
            defaultValue={filters.ageBand ?? ""}
          >
            <option value="">Todas</option>
            <option value="0-5">0 a 5 anos</option>
            <option value="6-9">6 a 9 anos</option>
            <option value="10-12">10 a 12 anos</option>
            <option value="13-15">13 a 15 anos</option>
            <option value="16-17">16 a 17 anos</option>
            <option value="18+">18 anos ou mais</option>
            <option value="UNKNOWN">Não informada</option>
          </select>
        </div>
        <button className="button" type="submit">
          <Filter size={14} /> Aplicar
        </button>
        <Link className="button secondary" href="/relatorios">
          <RotateCcw size={14} /> Limpar
        </Link>
      </form>

      <div className="stats-grid">
        <StatCard
          label="Participantes no recorte"
          value={data.summary.total.toLocaleString("pt-BR")}
          note="Pessoas únicas com matrícula ativa"
        />
        <StatCard
          label="Idade média"
          value={
            data.summary.averageAge === null
              ? "—"
              : `${data.summary.averageAge} anos`
          }
          note="Calculada na data atual"
        />
        <StatCard
          label="Sem nascimento"
          value={data.summary.withoutBirthDate.toLocaleString("pt-BR")}
          note="Cadastros a revisar"
        />
        <StatCard
          label="Filtros ativos"
          value={
            [
              filters.unit,
              filters.program,
              filters.gender,
              filters.ageBand,
            ].filter(Boolean).length
          }
          note="O detalhamento segue o mesmo recorte"
        />
      </div>

      <div className="grid cols-2 report-grid no-print">
        <DistributionCard
          title="Perfil por gênero"
          rows={data.distributions.genders}
          dimension="gender"
          filters={filters}
          total={data.summary.total}
        />
        <DistributionCard
          title="Perfil por idade"
          rows={data.distributions.ages}
          dimension="ageBand"
          filters={filters}
          total={data.summary.total}
        />
        <DistributionCard
          title="Participantes por unidade"
          rows={data.distributions.units}
          dimension="unit"
          filters={filters}
          total={data.summary.total}
        />
        <DistributionCard
          title="Participantes por programa"
          rows={data.distributions.programs}
          dimension="program"
          filters={filters}
          total={data.summary.total}
        />
      </div>

      <section className="card report-details">
        <div className="card-header">
          <div>
            <h2>Quem compõe este indicador</h2>
            <span className="cell-subtitle">
              {data.total.toLocaleString("pt-BR")} participante(s) no recorte
              atual
            </span>
          </div>
        </div>
        <div className="table-wrap report-table-wrap">
          <table className="data-table report-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Idade</th>
                <th>Gênero</th>
                <th>Matrícula / programa</th>
                <th>Unidade / turma</th>
                <th className="no-print">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {data.details.map((row) => (
                <tr key={row.public_id}>
                  <td>
                    <strong className="cell-title">{row.name}</strong>
                  </td>
                  <td>{row.age === null ? "—" : `${row.age} anos`}</td>
                  <td>{row.gender?.replaceAll("_", " ") ?? "Não informado"}</td>
                  <td>
                    <span className="cell-title">
                      {row.registrations ?? "—"}
                    </span>
                    <span className="cell-subtitle">{row.programs ?? "—"}</span>
                  </td>
                  <td>
                    <span className="cell-title">{row.units ?? "—"}</span>
                    <span className="cell-subtitle">
                      {row.classes ?? "Sem turma"}
                    </span>
                  </td>
                  <td className="no-print">
                    <Link
                      className="button secondary small"
                      href={`/participantes/${row.public_id}`}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body">
          <Pagination
            page={filters.page}
            total={data.total}
            pageSize={data.pageSize}
            pathname="/relatorios"
            query={query}
          />
        </div>
      </section>
    </>
  );
}
