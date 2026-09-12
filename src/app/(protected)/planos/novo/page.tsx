import type { Metadata } from "next";
import Link from "next/link";
import { Save } from "lucide-react";

import { FlashMessage, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createLessonPlanAction } from "@/modules/pedagogy/actions";
import { getPlanPrograms } from "@/modules/pedagogy/queries";

export const metadata: Metadata = { title: "Novo plano de aula" };
export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, programs] = await Promise.all([
    searchParams,
    getPlanPrograms(),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Pedagógico"
        title="Novo plano de aula"
        description="Estruture objetivos, metodologia, avaliação e cuidados de segurança."
      />
      <FlashMessage error={params.error} />
      <form action={createLessonPlanAction} className="card">
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="required" htmlFor="programPublicId">
                Programa
              </label>
              <select
                className="select"
                id="programPublicId"
                name="programPublicId"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {programs.map((program) => (
                  <option key={program.public_id} value={program.public_id}>
                    {program.name}
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
                maxLength={255}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="theme">Tema</label>
              <input
                className="input"
                id="theme"
                name="theme"
                maxLength={255}
              />
            </div>
            <div className="field quarter">
              <label className="required" htmlFor="minutes">
                Carga (minutos)
              </label>
              <input
                className="input"
                id="minutes"
                name="minutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={60}
                required
              />
            </div>
            <div className="field quarter">
              <label className="required" htmlFor="status">
                Status
              </label>
              <select
                className="select"
                id="status"
                name="status"
                defaultValue="RASCUNHO"
              >
                <option value="RASCUNHO">Rascunho</option>
                <option value="PUBLICADO">Publicado</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="objectives">Objetivos</label>
              <textarea
                className="textarea"
                id="objectives"
                name="objectives"
                maxLength={10000}
              />
            </div>
            <div className="field full">
              <label htmlFor="methodology">Metodologia e desenvolvimento</label>
              <textarea
                className="textarea"
                style={{ minHeight: 150 }}
                id="methodology"
                name="methodology"
                maxLength={50000}
              />
            </div>
            <div className="field full">
              <label htmlFor="safety">Orientações de segurança</label>
              <textarea
                className="textarea"
                id="safety"
                name="safety"
                maxLength={10000}
              />
            </div>
          </div>
          <div className="form-actions">
            <Link className="button secondary" href="/planos">
              Cancelar
            </Link>
            <SubmitButton>
              <Save size={15} /> Salvar plano
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
