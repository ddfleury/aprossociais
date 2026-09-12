import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, FileUp, Pencil } from "lucide-react";

import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { getParticipant } from "@/modules/participants/queries";
import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";

export const metadata: Metadata = { title: "Participante" };
function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

export default async function ParticipantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ publicId }, flash] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getParticipant(publicId),
    requireCurrentUser(),
  ]);
  const item = data.participant;
  return (
    <>
      <PageHeader
        eyebrow="Participante"
        title={item.social_name || item.name}
        description={`${item.registration_number ?? "Sem matrícula ativa"} · ${item.unit_name ?? "Sem unidade atual"}`}
      >
        <Link className="button secondary" href="/participantes">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <PrintButton label="Imprimir ficha" />
        {can(user, PERMISSIONS.PARTICIPANTS_EDIT) ? (
          <Link
            className="button secondary"
            href={`/participantes/${publicId}/editar`}
          >
            <Pencil size={15} /> Editar
          </Link>
        ) : null}
        <Link
          className="button secondary"
          href={`/documentos?participante=${publicId}`}
        >
          <FileUp size={15} /> Documentos
        </Link>
        <Link
          className="button"
          href={`/transferencias/nova?participante=${publicId}`}
        >
          <ArrowRightLeft size={15} /> Transferir
        </Link>
      </PageHeader>
      <FlashMessage success={flash.success} error={flash.error} />
      <section className="grid cols-2">
        <article className="card">
          <div className="card-header">
            <h2>Dados cadastrais</h2>
            <StatusBadge status={item.active ? "ATIVO" : "INATIVO"} />
          </div>
          <div className="card-body">
            <dl className="detail-list">
              <div className="detail-item">
                <dt>Nome civil</dt>
                <dd>{item.name}</dd>
              </div>
              <div className="detail-item">
                <dt>Nome social</dt>
                <dd>{item.social_name || "—"}</dd>
              </div>
              <div className="detail-item">
                <dt>Nascimento</dt>
                <dd>
                  {formatDate(item.birth_date)}
                  {item.age !== null ? ` · ${item.age} anos` : ""}
                </dd>
              </div>
              <div className="detail-item">
                <dt>Gênero</dt>
                <dd>{item.gender?.replaceAll("_", " ") ?? "—"}</dd>
              </div>
              <div className="detail-item">
                <dt>Programa</dt>
                <dd>{item.program_name ?? "—"}</dd>
              </div>
              <div className="detail-item">
                <dt>Turma</dt>
                <dd>{item.class_name ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <h2>Responsáveis vigentes</h2>
          </div>
          <div className="card-body">
            {data.responsibles.length ? (
              <ul className="metric-list">
                {data.responsibles.map((responsible, index) => (
                  <li key={`${responsible.name}-${index}`}>
                    <div>
                      <strong>{responsible.name}</strong>
                      <span className="cell-subtitle">
                        {responsible.relationship.replaceAll("_", " ")} ·{" "}
                        {responsible.masked_contact ?? "Sem contato"}
                      </span>
                    </div>
                    <span className="badge info">
                      {responsible.legal
                        ? "Legal"
                        : responsible.pickup
                          ? "Retirada"
                          : "Contato"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum responsável vigente.</p>
            )}
          </div>
        </article>
      </section>
      <article className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <h2>Histórico</h2>
        </div>
        <div className="card-body">
          {data.history.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Evento</th>
                    <th>Descrição</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((history) => (
                    <tr key={history.public_id}>
                      <td>{formatDateTime(history.occurred_at)}</td>
                      <td>
                        <StatusBadge status={history.event_type} />
                      </td>
                      <td>{history.summary}</td>
                      <td>{history.user_name ?? "Sistema"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum evento cadastral registrado.</p>
          )}
        </div>
      </article>
    </>
  );
}
