import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { FlashMessage, PageHeader } from "@/components/ui";
import { updateParticipantAction } from "@/modules/participants/actions";
import { WHATSAPP_CONSENT_TEXT } from "@/modules/participants/consent";
import { getParticipantForEdit } from "@/modules/participants/queries";

export const metadata: Metadata = { title: "Editar participante" };

export default async function EditParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ publicId }, flash] = await Promise.all([params, searchParams]);
  const participant = await getParticipantForEdit(publicId);
  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Editar participante"
        description="A alteração mantém o histórico e não modifica matrículas ou transferências anteriores."
      >
        <Link className="button secondary" href={`/participantes/${publicId}`}>
          <ArrowLeft size={15} /> Cancelar
        </Link>
      </PageHeader>
      <FlashMessage error={flash.error} />
      <form action={updateParticipantAction} className="card">
        <input type="hidden" name="publicId" value={publicId} />
        <div className="card-header">
          <h2>Dados pessoais</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="required" htmlFor="name">
                Nome completo
              </label>
              <input
                className="input"
                id="name"
                name="name"
                defaultValue={participant.name}
                required
                minLength={3}
                maxLength={180}
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="socialName">Nome social</label>
              <input
                className="input"
                id="socialName"
                name="socialName"
                defaultValue={participant.social_name ?? ""}
                maxLength={180}
              />
            </div>
            <div className="field third">
              <label className="required" htmlFor="birthDate">
                Nascimento
              </label>
              <input
                className="input"
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={participant.birth_date?.slice(0, 10) ?? ""}
                required
              />
            </div>
            <div className="field third">
              <label className="required" htmlFor="gender">
                Gênero
              </label>
              <select
                className="select"
                id="gender"
                name="gender"
                defaultValue={participant.gender ?? "NAO_INFORMADO"}
                required
              >
                <option value="FEMININO">Feminino</option>
                <option value="MASCULINO">Masculino</option>
                <option value="OUTRO">Outro</option>
                <option value="NAO_INFORMADO">Não informado</option>
              </select>
            </div>
            <div className="field third">
              <label htmlFor="bloodType">Tipo sanguíneo</label>
              <select
                className="select"
                id="bloodType"
                name="bloodType"
                defaultValue={participant.blood_type ?? ""}
              >
                <option value="">Não informado</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </div>
            <div className="field full">
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={Boolean(participant.active)}
                />{" "}
                Participante ativo
              </label>
              <p className="field-help">
                Desmarcar inativa o cadastro, mas preserva matrícula,
                documentos, frequência e histórico.
              </p>
            </div>
            <div className="field full consent-box">
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="whatsappConsent"
                  defaultChecked={Boolean(participant.whatsapp_consent)}
                />
                Autorização para comunicação por WhatsApp ativa
              </label>
              <p className="field-help">{WHATSAPP_CONSENT_TEXT}</p>
              <p className="field-help">
                Ao desmarcar e salvar, a autorização vigente será revogada e o
                contato deixará de ser elegível para novas filas.
              </p>
            </div>
          </div>
          <div className="form-actions">
            <SubmitButton pendingLabel="Salvando...">
              <Save size={15} /> Salvar alterações
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
