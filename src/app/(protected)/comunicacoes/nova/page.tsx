import type { Metadata } from "next";
import Link from "next/link";
import { Save } from "lucide-react";

import { RecipientSelector } from "@/components/recipient-selector";
import { FlashMessage, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { can, PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser } from "@/core/auth/session";
import { createQueueAction } from "@/modules/communications/actions";
import { getComposerData } from "@/modules/communications/queries";

export const metadata: Metadata = { title: "Nova comunicação" };
export default async function NewCommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [data, user] = await Promise.all([
    getComposerData(params.unidade),
    requireCurrentUser(),
  ]);
  const selectedUnit = data.units.find(
    (unit) => unit.public_id === data.selectedUnit,
  );
  const maySend = selectedUnit
    ? can(user, PERMISSIONS.COMMUNICATIONS_SEND, selectedUnit.id)
    : false;
  const safeCandidates = data.candidates.map((item) => ({
    registration_public_id: item.registration_public_id,
    registration_number: item.registration_number,
    participant_name: item.participant_name,
    unit_name: item.unit_name,
    masked_destination: item.masked_destination,
    eligible: Number(item.eligible),
    reason: item.reason,
  }));
  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        title="Preparar mensagem"
        description="Somente contatos com consentimento vigente e sem bloqueio podem ser selecionados."
      />
      <FlashMessage error={params.error} />
      <form className="card filters" method="get">
        <div className="field">
          <label htmlFor="unidade">Unidade</label>
          <select
            className="select"
            id="unidade"
            name="unidade"
            defaultValue={data.selectedUnit}
          >
            <option value="" disabled>
              Selecione
            </option>
            {data.units.map((unit) => (
              <option key={unit.public_id} value={unit.public_id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button secondary" type="submit">
          Carregar participantes
        </button>
      </form>
      {data.selectedUnit ? (
        <form action={createQueueAction} className="card">
          <input type="hidden" name="unitPublicId" value={data.selectedUnit} />
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label className="required" htmlFor="title">
                  Título interno
                </label>
                <input
                  className="input"
                  id="title"
                  name="title"
                  minLength={4}
                  maxLength={180}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="scheduledAt">Agendar para (opcional)</label>
                <input
                  className="input"
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                />
              </div>
              <div className="field full">
                <label className="required" htmlFor="message">
                  Mensagem
                </label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 150 }}
                  id="message"
                  name="message"
                  minLength={3}
                  maxLength={4000}
                  required
                  placeholder="Olá, {{nome}}. Mensagem referente à matrícula {{matricula}}."
                />
                <p className="field-help">
                  Variáveis permitidas: {"{{nome}}"} e {"{{matricula}}"}. O
                  texto será armazenado cifrado.
                </p>
              </div>
            </div>
            <h3>Destinatários de {selectedUnit?.name}</h3>
            <RecipientSelector candidates={safeCandidates} />
            <div className="form-actions">
              <Link className="button secondary" href="/comunicacoes">
                Cancelar
              </Link>
              {maySend ? (
                <label className="checkbox" style={{ marginRight: "auto" }}>
                  <input type="checkbox" name="authorize" /> Autorizar
                  processamento após salvar
                </label>
              ) : null}
              <SubmitButton>
                <Save size={15} /> Criar fila
              </SubmitButton>
            </div>
          </div>
        </form>
      ) : (
        <div className="card">
          <div className="empty-state">
            Cadastre ou autorize uma unidade para preparar mensagens.
          </div>
        </div>
      )}
    </>
  );
}
