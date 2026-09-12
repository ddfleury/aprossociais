import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Play, X } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  analyzeTransferAction,
  effectTransferAction,
} from "@/modules/registrations/actions";
import { getTransfer } from "@/modules/registrations/queries";

export const metadata: Metadata = { title: "Analisar transferência" };
function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

export default async function TransferDetailPage({
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
  const transfer = await getTransfer(publicId);
  const mayApprove =
    can(user, PERMISSIONS.TRANSFERS_APPROVE, transfer.origin_unit_id) &&
    can(user, PERMISSIONS.TRANSFERS_APPROVE, transfer.destination_unit_id);
  return (
    <>
      <PageHeader
        eyebrow="Transferência"
        title={transfer.participant_name}
        description={`${transfer.registration_number} · ${transfer.origin_name} → ${transfer.destination_name}`}
      >
        <Link className="button secondary" href="/transferencias">
          <ArrowLeft size={15} /> Voltar
        </Link>
      </PageHeader>
      <FlashMessage success={flash.success} error={flash.error} />
      <section className="grid cols-2">
        <article className="card">
          <div className="card-header">
            <h2>Movimentação solicitada</h2>
            <StatusBadge status={transfer.status} />
          </div>
          <div className="card-body">
            <dl className="detail-list">
              <div className="detail-item">
                <dt>Origem</dt>
                <dd>{transfer.origin_name}</dd>
              </div>
              <div className="detail-item">
                <dt>Destino</dt>
                <dd>{transfer.destination_name}</dd>
              </div>
              <div className="detail-item">
                <dt>Turma de destino</dt>
                <dd>{transfer.destination_class_name ?? "Não definida"}</dd>
              </div>
              <div className="detail-item">
                <dt>Solicitante</dt>
                <dd>{transfer.requester_name}</dd>
              </div>
              <div className="detail-item">
                <dt>Solicitada em</dt>
                <dd>{dateTime(transfer.requested_at)}</dd>
              </div>
              <div className="detail-item">
                <dt>Analisada em</dt>
                <dd>{dateTime(transfer.analyzed_at)}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <h2>Justificativa</h2>
          </div>
          <div className="card-body">
            <p style={{ whiteSpace: "pre-wrap" }}>{transfer.reason}</p>
            {transfer.analyst_name ? (
              <p className="field-help">
                Analisada por {transfer.analyst_name}
              </p>
            ) : null}
            {transfer.effector_name ? (
              <p className="field-help">
                Efetivada por {transfer.effector_name} em{" "}
                {dateTime(transfer.effected_at)}
              </p>
            ) : null}
          </div>
        </article>
      </section>
      {mayApprove && transfer.status === "SOLICITADA" ? (
        <article className="card no-print" style={{ marginTop: 14 }}>
          <div className="card-header">
            <h2>Decisão</h2>
          </div>
          <div className="card-body">
            <p>
              A aprovação ainda não altera o vínculo. Confira origem e destino
              antes de decidir.
            </p>
            <div className="form-actions">
              <form action={analyzeTransferAction}>
                <input type="hidden" name="publicId" value={publicId} />
                <input type="hidden" name="decision" value="reject" />
                <SubmitButton className="button danger">
                  <X size={15} /> Recusar
                </SubmitButton>
              </form>
              <form action={analyzeTransferAction}>
                <input type="hidden" name="publicId" value={publicId} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton>
                  <Check size={15} /> Aprovar
                </SubmitButton>
              </form>
            </div>
          </div>
        </article>
      ) : null}
      {mayApprove && transfer.status === "APROVADA" ? (
        <article className="card no-print" style={{ marginTop: 14 }}>
          <div className="card-header">
            <h2>Efetivação</h2>
          </div>
          <div className="card-body">
            <div className="alert info">
              Esta ação encerra o vínculo atual, cria o vínculo de destino e
              registra o histórico em uma única transação.
            </div>
            <form action={effectTransferAction} className="form-actions">
              <input type="hidden" name="publicId" value={publicId} />
              <SubmitButton pendingLabel="Efetivando...">
                <Play size={15} /> Efetivar transferência
              </SubmitButton>
            </form>
          </div>
        </article>
      ) : null}
    </>
  );
}
