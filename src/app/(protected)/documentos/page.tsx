import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileUp, ShieldX } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
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
  revokeDocumentAction,
  uploadDocumentAction,
} from "@/modules/documents/actions";
import { listDocuments } from "@/modules/documents/queries";

export const metadata: Metadata = { title: "Documentos" };
function size(value: string) {
  const bytes = Number(value);
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    participante?: string;
    page?: string;
    success?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [data, user] = await Promise.all([
    listDocuments({ participant: params.participante, page }),
    requireCurrentUser(),
  ]);
  const mayUpload = can(user, PERMISSIONS.DOCUMENTS_MANAGE);
  return (
    <>
      <PageHeader
        eyebrow="Cofre documental"
        title="Documentos"
        description="Arquivos privados com validação de conteúdo, controle de acesso e trilha de auditoria."
      />
      <FlashMessage success={params.success} error={params.error} />
      {mayUpload ? (
        <details
          className="card no-print"
          style={{ marginBottom: 14 }}
          open={Boolean(params.participante)}
        >
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <FileUp
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Enviar documento
            </span>
          </summary>
          <form action={uploadDocumentAction} className="card-body">
            <div className="form-grid">
              <div className="field">
                <label className="required" htmlFor="participantPublicId">
                  Participante
                </label>
                <select
                  className="select"
                  id="participantPublicId"
                  name="participantPublicId"
                  defaultValue={params.participante ?? ""}
                  required
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.participants.map((participant) => (
                    <option
                      key={participant.public_id}
                      value={participant.public_id}
                    >
                      {participant.name} · {participant.unit_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="required" htmlFor="typeCode">
                  Tipo
                </label>
                <select
                  className="select"
                  id="typeCode"
                  name="typeCode"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.types.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.name}
                      {type.sensitive ? " · sensível" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="required" htmlFor="file">
                  Arquivo
                </label>
                <input
                  className="input"
                  id="file"
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                />
                <p className="field-help">
                  PDF, JPG, PNG ou WebP. O conteúdo real é inspecionado no
                  servidor.
                </p>
              </div>
              <div className="field third">
                <label htmlFor="validUntil">Válido até</label>
                <input
                  className="input"
                  id="validUntil"
                  name="validUntil"
                  type="date"
                />
              </div>
              <div className="field full">
                <label className="checkbox">
                  <input type="checkbox" name="replaceExisting" /> Substituir
                  documentos ativos do mesmo tipo
                </label>
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton pendingLabel="Validando e enviando...">
                <FileUp size={15} /> Armazenar documento
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="participante">Filtrar participante</label>
          <select
            className="select"
            id="participante"
            name="participante"
            defaultValue={params.participante ?? ""}
          >
            <option value="">Todos</option>
            {data.participants.map((participant) => (
              <option key={participant.public_id} value={participant.public_id}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button secondary" type="submit">
          Filtrar
        </button>
      </form>
      {data.rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Participante</th>
                  <th>Tipo</th>
                  <th>Tamanho</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.public_id}>
                    <td>
                      <strong className="cell-title">
                        {row.original_name}
                      </strong>
                      <span className="cell-subtitle">{row.mime_type}</span>
                    </td>
                    <td>
                      <Link
                        href={`/participantes/${row.participant_public_id}`}
                        className="cell-title"
                      >
                        {row.participant_name}
                      </Link>
                      <span className="cell-subtitle">{row.unit_name}</span>
                    </td>
                    <td>
                      {row.type_name}
                      {row.sensitive ? (
                        <span
                          className="badge warning"
                          style={{ marginLeft: 6 }}
                        >
                          Sensível
                        </span>
                      ) : null}
                    </td>
                    <td>{size(row.size)}</td>
                    <td>{row.valid_until ?? "—"}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        {row.status === "ATIVO" ? (
                          <a
                            className="button secondary small"
                            href={`/api/documentos/${row.public_id}?finalidade=Consulta%20administrativa`}
                          >
                            <Download size={13} /> Baixar
                          </a>
                        ) : null}
                        {mayUpload && row.status === "ATIVO" ? (
                          <form action={revokeDocumentAction}>
                            <input
                              type="hidden"
                              name="publicId"
                              value={row.public_id}
                            />
                            <SubmitButton className="button danger small">
                              <ShieldX size={13} /> Revogar
                            </SubmitButton>
                          </form>
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
            pathname="/documentos"
            query={{ participante: params.participante }}
          />
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum documento"
            description="Envie o primeiro arquivo do participante selecionado."
          />
        </div>
      )}
    </>
  );
}
