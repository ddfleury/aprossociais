import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { saveAttendanceAction } from "@/modules/pedagogy/actions";
import { getMeeting } from "@/modules/pedagogy/queries";

export const metadata: Metadata = { title: "Chamada" };
export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ publicId }, flash, user] = await Promise.all([
    params,
    searchParams,
    requireCurrentUser(),
  ]);
  const data = await getMeeting(publicId);
  const meeting = data.meeting;
  const editable =
    !["CONCLUIDO", "CANCELADO"].includes(meeting.status) &&
    can(user, PERMISSIONS.ATTENDANCE_RECORD, meeting.unit_id);
  const timeZone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Chamada"
        title={meeting.activity_name}
        description={`${meeting.unit_name} · ${meeting.class_name ?? "Todas as turmas"} · ${formatUtcDateTime(meeting.starts_at, timeZone)}`}
      >
        <Link className="button secondary" href="/frequencia">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <PrintButton label="Imprimir chamada" />
      </PageHeader>
      <FlashMessage success={flash.success} error={flash.error} />
      <form action={saveAttendanceAction}>
        <input type="hidden" name="publicId" value={publicId} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Matrícula</th>
                <th>Presença</th>
                <th>Minutos</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.registration_public_id}>
                  <td className="cell-title">{row.participant_name}</td>
                  <td>{row.registration_number}</td>
                  <td>
                    {editable ? (
                      <select
                        className="select"
                        style={{ minWidth: 165 }}
                        name={`status:${row.registration_public_id}`}
                        defaultValue={row.status ?? "PRESENTE"}
                      >
                        {[
                          "PRESENTE",
                          "AUSENTE",
                          "JUSTIFICADA",
                          "NAO_APLICAVEL",
                        ].map((status) => (
                          <option key={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={row.status ?? "SEM REGISTRO"} />
                    )}
                  </td>
                  <td>
                    {row.credited_minutes ??
                      (editable ? meeting.duration_minutes : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editable ? (
          <div className="card no-print" style={{ marginTop: 14 }}>
            <div className="card-body">
              <label className="checkbox">
                <input type="checkbox" name="closeMeeting" /> Concluir e
                bloquear a chamada após salvar
              </label>
              <div className="form-actions">
                <SubmitButton>
                  <Save size={15} /> Salvar frequência
                </SubmitButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="alert info" style={{ marginTop: 14 }}>
            Encontro {meeting.status.toLowerCase()}; a chamada está somente para
            consulta.
          </div>
        )}
      </form>
    </>
  );
}
