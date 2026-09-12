import type { Metadata } from "next";
import Link from "next/link";
import { Save } from "lucide-react";

import { FlashMessage, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requestTransferAction } from "@/modules/registrations/actions";
import { getTransferOptions } from "@/modules/registrations/queries";

export const metadata: Metadata = { title: "Nova transferência" };
export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<{
    participante?: string;
    matricula?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const options = await getTransferOptions(params.participante);
  const selected =
    params.matricula ?? options.registrations[0]?.public_id ?? "";
  return (
    <>
      <PageHeader
        eyebrow="Matrículas"
        title="Solicitar transferência"
        description="A matrícula atual não será alterada até a aprovação e efetivação por usuário autorizado."
      />
      <FlashMessage error={params.error} />
      <form action={requestTransferAction} className="card">
        <div className="card-body">
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
                defaultValue={selected}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {options.registrations.map((item) => (
                  <option key={item.public_id} value={item.public_id}>
                    {item.label} · origem: {item.current_unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="required" htmlFor="destination">
                Programa e unidade de destino
              </label>
              <select
                className="select"
                id="destination"
                name="destination"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {options.destinations.map((item) => (
                  <option key={item.option_value} value={item.option_value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="field-help">
                O destino precisa executar o mesmo programa da matrícula.
              </p>
            </div>
            <div className="field">
              <label htmlFor="classPublicId">Turma de destino (opcional)</label>
              <select
                className="select"
                id="classPublicId"
                name="classPublicId"
                defaultValue=""
              >
                <option value="">Definir depois</option>
                {options.classes.map((item) => (
                  <option key={item.public_id} value={item.public_id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label className="required" htmlFor="reason">
                Motivo
              </label>
              <textarea
                className="textarea"
                id="reason"
                name="reason"
                minLength={10}
                maxLength={500}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="notes">Observação confidencial</label>
              <textarea
                className="textarea"
                id="notes"
                name="notes"
                maxLength={3000}
              />
              <p className="field-help">
                Este conteúdo é armazenado com criptografia autenticada.
              </p>
            </div>
          </div>
          <div className="form-actions">
            <Link className="button secondary" href="/transferencias">
              Cancelar
            </Link>
            <SubmitButton>
              <Save size={15} /> Solicitar
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
