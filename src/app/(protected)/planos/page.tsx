import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  EmptyState,
  FlashMessage,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { parsePage } from "@/core/http/pagination";
import { listLessonPlans } from "@/modules/pedagogy/queries";

export const metadata: Metadata = { title: "Planos de aula" };
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const data = await listLessonPlans(page);
  return (
    <>
      <PageHeader
        eyebrow="Pedagógico"
        title="Planos de aula"
        description="Planejamento pedagógico versionado por programa."
      >
        <Link className="button" href="/planos/novo">
          <Plus size={15} /> Novo plano
        </Link>
      </PageHeader>
      <FlashMessage success={params.success} error={params.error} />
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Programa</th>
                  <th>Carga</th>
                  <th>Versão</th>
                  <th>Autor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td>
                      <strong className="cell-title">{row.title}</strong>
                      <span className="cell-subtitle">
                        {row.theme || "Sem tema informado"}
                      </span>
                    </td>
                    <td>{row.program_name}</td>
                    <td>{row.minutes ? `${row.minutes} min` : "—"}</td>
                    <td>v{row.version}</td>
                    <td>{row.author_name}</td>
                    <td>
                      <StatusBadge status={row.status} />
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
            pathname="/planos"
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum plano de aula"
            description="Crie o primeiro planejamento do programa."
          />
        </div>
      )}
    </>
  );
}
