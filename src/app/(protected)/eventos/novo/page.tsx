import type { Metadata } from "next";
import Link from "next/link";
import { Save } from "lucide-react";

import { FlashMessage, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getEnv } from "@/core/config/env";
import { createEventAction } from "@/modules/events/actions";
import { getEventOptions } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Novo evento" };
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, options] = await Promise.all([
    searchParams,
    getEventOptions(),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Eventos"
        title="Novo evento"
        description={`Horários serão interpretados em ${getEnv().APP_TIME_ZONE}.`}
      />
      <FlashMessage error={params.error} />
      <form action={createEventAction} className="card">
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
                {options.map((option) => (
                  <option key={option.option_value} value={option.option_value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="required" htmlFor="title">
                Título
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
            <div className="field third">
              <label className="required" htmlFor="type">
                Tipo
              </label>
              <select
                className="select"
                id="type"
                name="type"
                defaultValue="OUTRO"
                required
              >
                {["PASSEIO", "FORMATURA", "REUNIAO", "CAMPANHA", "OUTRO"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
            </div>
            <div className="field third">
              <label className="required" htmlFor="startsAt">
                Início
              </label>
              <input
                className="input"
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
              />
            </div>
            <div className="field third">
              <label className="required" htmlFor="endsAt">
                Término
              </label>
              <input
                className="input"
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                required
              />
            </div>
            <div className="field third">
              <label htmlFor="location">Local</label>
              <input
                className="input"
                id="location"
                name="location"
                maxLength={180}
              />
            </div>
            <div className="field third">
              <label htmlFor="capacity">Capacidade</label>
              <input
                className="input"
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={100000}
              />
            </div>
            <div className="field full">
              <label htmlFor="address">Endereço completo</label>
              <input
                className="input"
                id="address"
                name="address"
                maxLength={1000}
              />
              <p className="field-help">Armazenado cifrado.</p>
            </div>
            <div className="field full">
              <label htmlFor="description">Descrição</label>
              <textarea
                className="textarea"
                id="description"
                name="description"
                maxLength={10000}
              />
            </div>
          </div>
          <div className="form-actions">
            <Link className="button secondary" href="/eventos">
              Cancelar
            </Link>
            <SubmitButton>
              <Save size={15} /> Salvar evento
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
