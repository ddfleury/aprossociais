import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { parsePage } from "@/core/http/pagination";
import {
  EmptyState,
  FlashMessage,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createMeetingAction } from "@/modules/pedagogy/actions";
import { listMeetings } from "@/modules/pedagogy/queries";

export const metadata: Metadata = { title: "Frequência" };
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [data, user] = await Promise.all([
    listMeetings(page),
    requireCurrentUser(),
  ]);
  const mayCreate = can(user, PERMISSIONS.ATTENDANCE_RECORD);
  const timeZone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Pedagógico"
        title="Frequência"
        description="Crie encontros, registre a chamada e acompanhe a presença por turma."
      />
      <FlashMessage success={params.success} error={params.error} />
      {mayCreate ? (
        <details className="card no-print" style={{ marginBottom: 14 }}>
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <Plus
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Criar encontro
            </span>
          </summary>
          <form action={createMeetingAction} className="card-body">
            <div className="form-grid">
              <div className="field">
                <label className="required" htmlFor="offerPublicId">
                  Atividade / unidade / turma
                </label>
                <select
                  className="select"
                  id="offerPublicId"
                  name="offerPublicId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.offers.map((offer) => (
                    <option key={offer.public_id} value={offer.public_id}>
                      {offer.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="planPublicId">Plano publicado</label>
                <select
                  className="select"
                  id="planPublicId"
                  name="planPublicId"
                  defaultValue=""
                >
                  <option value="">Sem plano vinculado</option>
                  {data.plans.map((plan) => (
                    <option key={plan.public_id} value={plan.public_id}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field third">
                <label className="required" htmlFor="startsAt">
                  Início
                </label>
                <input
                  className="input"
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="field third">
                <label className="required" htmlFor="endsAt">
                  Término
                </label>
                <input
                  className="input"
                  id="endsAt"
                  name="endsAt"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="field third">
                <label htmlFor="location">Local</label>
                <input
                  className="input"
                  id="location"
                  name="location"
                  maxLength={180}
                />
              </div>
            </div>
            <p className="field-help">
              Horários informados em {timeZone} e armazenados em UTC.
            </p>
            <div className="form-actions">
              <SubmitButton>
                <Plus size={15} /> Criar e abrir chamada
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Atividade</th>
                  <th>Unidade / turma</th>
                  <th>Início</th>
                  <th>Registros</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td className="cell-title">{row.activity_name}</td>
                    <td>
                      <span className="cell-title">{row.unit_name}</span>
                      <span className="cell-subtitle">
                        {row.class_name ?? "Todas as turmas"}
                      </span>
                    </td>
                    <td>{formatUtcDateTime(row.starts_at, timeZone)}</td>
                    <td>{row.total_records}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <Link
                        className="button secondary small"
                        href={`/frequencia/${row.public_id}`}
                      >
                        <ClipboardCheck size={13} /> Chamada
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
            pathname="/frequencia"
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum encontro"
            description="Crie uma atividade e sua oferta para começar a registrar presença."
          />
        </div>
      )}
    </>
  );
}
