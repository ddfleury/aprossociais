import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileBadge, ShieldX } from "lucide-react";

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
import {
  issueCertificateAction,
  revokeCertificateAction,
} from "@/modules/certificates/actions";
import { listCertificates } from "@/modules/certificates/queries";

export const metadata: Metadata = { title: "Certificados" };
export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [data, user] = await Promise.all([
    listCertificates(page),
    requireCurrentUser(),
  ]);
  const zone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Documentos oficiais"
        title="Certificados"
        description="Emissão em PDF, identificador público, QR Code e revogação auditada."
      />
      <FlashMessage success={params.success} error={params.error} />
      <details className="card no-print" style={{ marginBottom: 14 }}>
        <summary
          className="card-header"
          style={{ cursor: "pointer", fontWeight: 750 }}
        >
          <span>
            <FileBadge
              size={15}
              style={{ verticalAlign: "middle", marginRight: 7 }}
            />
            Emitir certificado
          </span>
        </summary>
        <form action={issueCertificateAction} className="card-body">
          <div className="form-grid">
            <div className="field full">
              <label className="required" htmlFor="registrationPublicId">
                Participante e matrícula
              </label>
              <select
                className="select"
                id="registrationPublicId"
                name="registrationPublicId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {data.registrations.map((item) => (
                  <option key={item.public_id} value={item.public_id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="required" htmlFor="title">
                Título / formação concluída
              </label>
              <input
                className="input"
                id="title"
                name="title"
                minLength={5}
                maxLength={180}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="componentPublicId">Componente curricular</label>
              <select
                className="select"
                id="componentPublicId"
                name="componentPublicId"
                defaultValue=""
              >
                <option value="">Certificado geral do programa</option>
                {data.components.map((item) => (
                  <option key={item.public_id} value={item.public_id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field quarter">
              <label htmlFor="minutes">Carga em minutos</label>
              <input
                className="input"
                id="minutes"
                name="minutes"
                type="number"
                min={1}
                max={1000000}
              />
            </div>
          </div>
          <div className="form-actions">
            <SubmitButton>
              <FileBadge size={15} /> Emitir certificado
            </SubmitButton>
          </div>
        </form>
      </details>
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Certificado</th>
                  <th>Programa / unidade</th>
                  <th>Emissão</th>
                  <th>Status</th>
                  <th>Ações</th>
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
                    <td>
                      <span className="cell-title">{row.title}</span>
                      <span className="cell-subtitle">
                        {row.component_name ?? "Geral"} ·{" "}
                        {row.minutes
                          ? `${row.minutes} min`
                          : "carga não informada"}
                      </span>
                    </td>
                    <td>
                      <span className="cell-title">{row.program_name}</span>
                      <span className="cell-subtitle">{row.unit_name}</span>
                    </td>
                    <td>{formatUtcDateTime(row.issued_at, zone)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="button secondary small"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`/validar/${row.public_id}`}
                        >
                          Validar
                        </Link>
                        <a
                          className="button secondary small"
                          href={`/api/certificados/${row.public_id}`}
                        >
                          <Download size={13} /> PDF
                        </a>
                        {row.status === "VALIDO" &&
                        can(
                          user,
                          PERMISSIONS.CERTIFICATES_REVOKE,
                          row.unit_id,
                        ) ? (
                          <details>
                            <summary className="button danger small">
                              <ShieldX size={13} /> Revogar
                            </summary>
                            <form
                              action={revokeCertificateAction}
                              style={{
                                position: "absolute",
                                right: 20,
                                zIndex: 5,
                                width: 300,
                                padding: 12,
                                background: "white",
                                border: "1px solid var(--line)",
                                borderRadius: 10,
                                boxShadow: "var(--shadow)",
                              }}
                            >
                              <input
                                type="hidden"
                                name="publicId"
                                value={row.public_id}
                              />
                              <label
                                htmlFor={`reason-${row.public_id}`}
                                className="required"
                              >
                                Justificativa
                              </label>
                              <textarea
                                className="textarea"
                                id={`reason-${row.public_id}`}
                                name="reason"
                                minLength={10}
                                maxLength={500}
                                required
                              />
                              <SubmitButton className="button danger small">
                                Confirmar revogação
                              </SubmitButton>
                            </form>
                          </details>
                        ) : null}
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
            pathname="/certificados"
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum certificado"
            description="Emita o primeiro certificado de uma matrícula ativa."
          />
        </div>
      )}
    </>
  );
}
