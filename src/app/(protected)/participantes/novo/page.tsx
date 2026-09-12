import type { Metadata } from "next";
import Link from "next/link";
import { Save } from "lucide-react";

import { FlashMessage, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createParticipantAction } from "@/modules/participants/actions";
import { WHATSAPP_CONSENT_TEXT } from "@/modules/participants/consent";
import { getEnrollmentOptions } from "@/modules/participants/queries";

export const metadata: Metadata = { title: "Novo participante" };
export default async function NewParticipantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, options] = await Promise.all([
    searchParams,
    getEnrollmentOptions(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader
        eyebrow="Cadastros"
        title="Novo participante"
        description="O participante, responsável, matrícula e vínculo inicial serão gravados em uma única transação."
      />
      <FlashMessage error={error} />
      <form action={createParticipantAction} className="card">
        <div className="card-header">
          <h2>Dados do participante</h2>
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
                maxLength={180}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="socialName">Nome social</label>
              <input
                className="input"
                id="socialName"
                name="socialName"
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
                max={today}
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
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
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
                defaultValue=""
              >
                <option value="">Não informado</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cpf">CPF (opcional)</label>
              <input
                className="input"
                id="cpf"
                name="cpf"
                inputMode="numeric"
                maxLength={18}
                autoComplete="off"
              />
              <p className="field-help">
                Armazenado cifrado; a pesquisa usa HMAC.
              </p>
            </div>
          </div>
        </div>
        <div
          className="card-header"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <h2>Responsável principal</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="required" htmlFor="guardianName">
                Nome completo
              </label>
              <input
                className="input"
                id="guardianName"
                name="guardianName"
                maxLength={180}
                required
              />
            </div>
            <div className="field third">
              <label className="required" htmlFor="relationship">
                Parentesco
              </label>
              <select
                className="select"
                id="relationship"
                name="relationship"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                <option value="MAE">Mãe</option>
                <option value="PAI">Pai</option>
                <option value="AVO">Avó/avô</option>
                <option value="TUTOR">Tutor</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div className="field third">
              <label className="required" htmlFor="guardianPhone">
                Telefone / WhatsApp
              </label>
              <input
                className="input"
                id="guardianPhone"
                name="guardianPhone"
                inputMode="tel"
                maxLength={30}
                required
              />
            </div>
            <div className="field third">
              <label htmlFor="guardianEmail">E-mail</label>
              <input
                className="input"
                id="guardianEmail"
                name="guardianEmail"
                type="email"
                maxLength={254}
              />
            </div>
            <div className="field full">
              <label className="checkbox">
                <input type="checkbox" name="legalGuardian" defaultChecked />{" "}
                Responsável legal
              </label>{" "}
              <label className="checkbox" style={{ marginLeft: 22 }}>
                <input type="checkbox" name="pickupAuthorized" defaultChecked />{" "}
                Autorizado a retirar
              </label>
            </div>
            <div className="field full consent-box">
              <label className="checkbox">
                <input type="checkbox" name="whatsappConsent" />
                Registrar autorização expressa para comunicação por WhatsApp
              </label>
              <p className="field-help">{WHATSAPP_CONSENT_TEXT}</p>
              <p className="field-help">
                Não marque sem a manifestação do responsável. A decisão, o
                operador, a data e a versão do termo ficarão registrados.
              </p>
            </div>
          </div>
        </div>
        <div
          className="card-header"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <h2>Matrícula inicial</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="required" htmlFor="programUnit">
                Programa e unidade
              </label>
              <select
                className="select"
                id="programUnit"
                name="programUnit"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {options.programUnits.map((option) => (
                  <option key={option.option_value} value={option.option_value}>
                    {option.program_name} · {option.unit_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field third">
              <label htmlFor="classPublicId">Turma (opcional)</label>
              <select
                className="select"
                id="classPublicId"
                name="classPublicId"
                defaultValue=""
              >
                <option value="">Sem turma</option>
                {options.classes.map((item) => (
                  <option key={item.public_id} value={item.public_id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field third">
              <label className="required" htmlFor="enrollmentDate">
                Data da matrícula
              </label>
              <input
                className="input"
                id="enrollmentDate"
                name="enrollmentDate"
                type="date"
                defaultValue={today}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <Link className="button secondary" href="/participantes">
              Cancelar
            </Link>
            <SubmitButton>
              <Save size={15} /> Salvar cadastro
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
