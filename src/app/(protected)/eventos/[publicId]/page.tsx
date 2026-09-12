import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { saveEventParticipantsAction } from "@/modules/events/actions";
import { getEvent } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Gerenciar evento" };
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ publicId }, flash] = await Promise.all([params, searchParams]);
  const data = await getEvent(publicId);
  const event = data.event;
  const zone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Evento"
        title={event.title}
        description={`${event.unit_name} · ${formatUtcDateTime(event.starts_at, zone)} · ${event.location ?? "Local a definir"}`}
      >
        <Link className="button secondary" href="/eventos">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <PrintButton label="Imprimir lista" />
      </PageHeader>
      <FlashMessage success={flash.success} error={flash.error} />
      <article className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2>Informações</h2>
          <StatusBadge status={event.status} />
        </div>
        <div className="card-body">
          <dl className="detail-list">
            <div className="detail-item">
              <dt>Tipo</dt>
              <dd>{event.type}</dd>
            </div>
            <div className="detail-item">
              <dt>Período</dt>
              <dd>
                {formatUtcDateTime(event.starts_at, zone)} a{" "}
                {formatUtcDateTime(event.ends_at, zone)}
              </dd>
            </div>
            <div className="detail-item">
              <dt>Capacidade</dt>
              <dd>{event.capacity ?? "Sem limite informado"}</dd>
            </div>
            <div className="detail-item">
              <dt>Selecionados</dt>
              <dd>{event.participant_count}</dd>
            </div>
          </dl>
          {event.description ? <p>{event.description}</p> : null}
        </div>
      </article>
      <form action={saveEventParticipantsAction}>
        <input type="hidden" name="publicId" value={publicId} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="no-print">Selecionar</th>
                <th>Participante</th>
                <th>Matrícula</th>
                <th>Situação</th>
                <th className="print-only">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((candidate) => {
                const selected =
                  candidate.selected_status &&
                  candidate.selected_status !== "CANCELADO";
                return (
                  <tr key={candidate.registration_public_id}>
                    <td className="no-print">
                      <input
                        type="checkbox"
                        name={`include:${candidate.registration_public_id}`}
                        defaultChecked={Boolean(selected)}
                        aria-label={`Selecionar ${candidate.participant_name}`}
                      />
                    </td>
                    <td className="cell-title">{candidate.participant_name}</td>
                    <td>{candidate.registration_number}</td>
                    <td>
                      <select
                        className="select no-print"
                        name={`status:${candidate.registration_public_id}`}
                        defaultValue={
                          selected
                            ? (candidate.selected_status ?? "INSCRITO")
                            : "INSCRITO"
                        }
                      >
                        <option value="INSCRITO">Inscrito</option>
                        <option value="CONFIRMADO">Confirmado</option>
                        <option value="LISTA_ESPERA">Lista de espera</option>
                      </select>
                      <span className="print-only">
                        {selected
                          ? candidate.selected_status?.replaceAll("_", " ")
                          : ""}
                      </span>
                    </td>
                    <td className="print-only" style={{ minWidth: 180 }}>
                      ________________________________
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="form-actions no-print">
          <SubmitButton>
            <Save size={15} /> Salvar participantes
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
