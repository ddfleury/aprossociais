import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Play, Send } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  authorizeQueueAction,
  processQueueAction,
} from "@/modules/communications/actions";
import { getQueue } from "@/modules/communications/queries";

export const metadata: Metadata = { title: "Fila de comunicação" };
export default async function QueuePage({
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
  const data = await getQueue(publicId);
  const queue = data.queue;
  const maySend = queue.unit_id
    ? can(user, PERMISSIONS.COMMUNICATIONS_SEND, queue.unit_id)
    : user.globalPermissions.includes(PERMISSIONS.COMMUNICATIONS_SEND);
  const providerReady = Boolean(
    getEnv().WHATSAPP_API_URL &&
    getEnv().WHATSAPP_API_TOKEN &&
    getEnv().WHATSAPP_PHONE_NUMBER_ID,
  );
  const zone = getEnv().APP_TIME_ZONE;
  return (
    <>
      <PageHeader
        eyebrow="Fila de comunicação"
        title={queue.title}
        description={`${queue.unit_name ?? "Global"} · ${queue.total} destinatário(s) · criada por ${queue.creator_name}`}
      >
        <Link className="button secondary" href="/comunicacoes">
          <ArrowLeft size={15} /> Voltar
        </Link>
      </PageHeader>
      <FlashMessage success={flash.success} error={flash.error} />
      {!providerReady ? (
        <div className="alert info">
          O provedor WhatsApp ainda não está configurado. A fila e os
          destinatários estão preservados, mas nenhum envio externo será
          iniciado.
        </div>
      ) : null}
      <section className="grid cols-2">
        <article className="card">
          <div className="card-header">
            <h2>Conteúdo</h2>
            <StatusBadge status={queue.status} />
          </div>
          <div className="card-body">
            <p style={{ whiteSpace: "pre-wrap" }}>{queue.message}</p>
            <p className="field-help">
              Agendada: {formatUtcDateTime(queue.scheduled_at, zone)}
            </p>
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <h2>Resumo</h2>
          </div>
          <div className="card-body">
            <dl className="detail-list">
              <div className="detail-item">
                <dt>Total</dt>
                <dd>{queue.total}</dd>
              </div>
              <div className="detail-item">
                <dt>Enviados</dt>
                <dd>{queue.sent ?? 0}</dd>
              </div>
              <div className="detail-item">
                <dt>Pendentes</dt>
                <dd>{queue.pending ?? 0}</dd>
              </div>
              <div className="detail-item">
                <dt>Falhas / bloqueios</dt>
                <dd>
                  {queue.failed ?? 0} / {queue.blocked ?? 0}
                </dd>
              </div>
            </dl>
            {maySend && queue.status === "RASCUNHO" ? (
              <form action={authorizeQueueAction} className="form-actions">
                <input type="hidden" name="publicId" value={publicId} />
                <SubmitButton>
                  <Send size={15} /> Autorizar fila
                </SubmitButton>
              </form>
            ) : null}
            {maySend && ["AGENDADA", "PROCESSANDO"].includes(queue.status) ? (
              <form action={processQueueAction} className="form-actions">
                <input type="hidden" name="publicId" value={publicId} />
                <SubmitButton pendingLabel="Processando lote...">
                  <Play size={15} /> Processar até 25
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </article>
      </section>
      <article className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <h2>Destinatários</h2>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Contato</th>
                  <th>Tentativas</th>
                  <th>Enviado em</th>
                  <th>Status</th>
                  <th>Retorno</th>
                </tr>
              </thead>
              <tbody>
                {data.recipients.map((recipient) => (
                  <tr key={recipient.public_id}>
                    <td>{recipient.name ?? "—"}</td>
                    <td>{recipient.destination}</td>
                    <td>{recipient.attempts}</td>
                    <td>{formatUtcDateTime(recipient.sent_at, zone)}</td>
                    <td>
                      <StatusBadge status={recipient.status} />
                    </td>
                    <td>{recipient.error_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </>
  );
}
