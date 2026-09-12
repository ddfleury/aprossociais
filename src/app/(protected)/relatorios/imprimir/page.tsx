import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";

import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui";
import { getEnv } from "@/core/config/env";
import { getReportPrintRows } from "@/modules/reports/queries";

export const metadata: Metadata = {
  title: "Imprimir relatório",
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;
type Column =
  | "name"
  | "age"
  | "gender"
  | "registration"
  | "program"
  | "unit"
  | "class"
  | "signature";
const AVAILABLE_COLUMNS: Array<{ key: Column; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "age", label: "Idade" },
  { key: "gender", label: "Gênero" },
  { key: "registration", label: "Matrícula" },
  { key: "program", label: "Programa" },
  { key: "unit", label: "Unidade" },
  { key: "class", label: "Turma" },
  { key: "signature", label: "Assinatura" },
];
const DEFAULT_COLUMNS: Column[] = [
  "name",
  "age",
  "gender",
  "unit",
  "signature",
];

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function selectedColumns(value: string | string[] | undefined): Column[] {
  if (value === undefined) return DEFAULT_COLUMNS;
  const values = Array.isArray(value) ? value : [value];
  const allowed = new Set(AVAILABLE_COLUMNS.map((column) => column.key));
  const selected = values.filter((item): item is Column =>
    allowed.has(item as Column),
  );
  return selected.length ? selected : ["name"];
}

function gender(value: string | null): string {
  if (value === "FEMININO") return "Feminino";
  if (value === "MASCULINO") return "Masculino";
  if (value === "OUTRO") return "Outro";
  return "Não informado";
}

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const columns = selectedColumns(params.columns);
  const filters = {
    unit: one(params.unit),
    program: one(params.program),
    gender: one(params.gender),
    ageBand: one(params.ageBand),
  };
  const data = await getReportPrintRows(filters);
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: getEnv().APP_TIME_ZONE,
  }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow="Relatório para conferência"
        title="Relação de participantes"
        description={`${data.rows.length.toLocaleString("pt-BR")} registro(s) · gerado em ${generatedAt}`}
      >
        <Link className="button secondary" href="/relatorios">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <PrintButton label="Imprimir relação" />
      </PageHeader>

      <form className="card print-config no-print" method="get">
        {filters.unit ? (
          <input type="hidden" name="unit" value={filters.unit} />
        ) : null}
        {filters.program ? (
          <input type="hidden" name="program" value={filters.program} />
        ) : null}
        {filters.gender ? (
          <input type="hidden" name="gender" value={filters.gender} />
        ) : null}
        {filters.ageBand ? (
          <input type="hidden" name="ageBand" value={filters.ageBand} />
        ) : null}
        <div>
          <strong>
            <ListChecks size={16} /> Escolha as colunas
          </strong>
          <p>Marque somente as informações necessárias para esta impressão.</p>
        </div>
        <div className="print-column-options">
          {AVAILABLE_COLUMNS.map((column) => (
            <label className="checkbox" key={column.key}>
              <input
                type="checkbox"
                name="columns"
                value={column.key}
                defaultChecked={columns.includes(column.key)}
              />{" "}
              {column.label}
            </label>
          ))}
        </div>
        <button className="button" type="submit">
          Atualizar prévia
        </button>
      </form>

      {data.truncated ? (
        <div className="alert warning no-print">
          A impressão foi limitada aos primeiros 5.000 registros. Restrinja os
          filtros antes de imprimir.
        </div>
      ) : null}

      <div className="print-document-heading">
        <strong>{getEnv().APP_NAME}</strong>
        <span>Relação de participantes · {generatedAt}</span>
      </div>
      <div className="table-wrap print-report-wrap">
        <table className="data-table print-report-table">
          <thead>
            <tr>
              {columns.includes("name") ? <th>Nome</th> : null}
              {columns.includes("age") ? <th>Idade</th> : null}
              {columns.includes("gender") ? <th>Gênero</th> : null}
              {columns.includes("registration") ? <th>Matrícula</th> : null}
              {columns.includes("program") ? <th>Programa</th> : null}
              {columns.includes("unit") ? <th>Unidade</th> : null}
              {columns.includes("class") ? <th>Turma</th> : null}
              {columns.includes("signature") ? (
                <th className="signature-column">Assinatura</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.public_id}>
                {columns.includes("name") ? (
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                ) : null}
                {columns.includes("age") ? (
                  <td>{row.age === null ? "—" : `${row.age} anos`}</td>
                ) : null}
                {columns.includes("gender") ? (
                  <td>{gender(row.gender)}</td>
                ) : null}
                {columns.includes("registration") ? (
                  <td>{row.registrations ?? "—"}</td>
                ) : null}
                {columns.includes("program") ? (
                  <td>{row.programs ?? "—"}</td>
                ) : null}
                {columns.includes("unit") ? <td>{row.units ?? "—"}</td> : null}
                {columns.includes("class") ? (
                  <td>{row.classes ?? "—"}</td>
                ) : null}
                {columns.includes("signature") ? (
                  <td className="signature-cell">
                    <span />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
