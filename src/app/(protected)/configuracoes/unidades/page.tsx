import type { Metadata } from "next";
import { Building2, GraduationCap, Link2, Plus } from "lucide-react";

import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  createActivityOfferAction,
  createClassAction,
  createProgramAction,
  createUnitAction,
  linkProgramUnitAction,
} from "@/modules/admin/actions";
import { getStructureData } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Estrutura" };
export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, data] = await Promise.all([searchParams, getStructureData()]);
  const today = new Date().toISOString().slice(0, 10);
  const year = new Date().getUTCFullYear();
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Estrutura institucional"
        description="Cadastre programas, unidades, turmas e ofertas antes de iniciar as matrículas."
      />
      <FlashMessage success={params.success} error={params.error} />
      <section className="grid cols-2" style={{ marginBottom: 14 }}>
        <details className="card">
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <Building2
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Nova unidade
            </span>
          </summary>
          <form action={createUnitAction} className="card-body">
            <div className="form-grid">
              <div className="field third">
                <label className="required" htmlFor="unit-code">
                  Código
                </label>
                <input
                  className="input"
                  id="unit-code"
                  name="code"
                  maxLength={30}
                  required
                />
              </div>
              <div className="field">
                <label className="required" htmlFor="unit-name">
                  Nome
                </label>
                <input
                  className="input"
                  id="unit-name"
                  name="name"
                  maxLength={180}
                  required
                />
              </div>
              <div className="field third">
                <label htmlFor="unit-acronym">Sigla</label>
                <input
                  className="input"
                  id="unit-acronym"
                  name="acronym"
                  maxLength={30}
                />
              </div>
              <div className="field">
                <label htmlFor="unit-city">Cidade</label>
                <input
                  className="input"
                  id="unit-city"
                  name="city"
                  maxLength={100}
                />
              </div>
              <div className="field third">
                <label htmlFor="unit-state">UF</label>
                <input
                  className="input"
                  id="unit-state"
                  name="state"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton>
                <Plus size={14} /> Criar unidade
              </SubmitButton>
            </div>
          </form>
        </details>
        <details className="card">
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <GraduationCap
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Novo programa
            </span>
          </summary>
          <form action={createProgramAction} className="card-body">
            <div className="form-grid">
              <div className="field third">
                <label className="required" htmlFor="program-code">
                  Código
                </label>
                <input
                  className="input"
                  id="program-code"
                  name="code"
                  maxLength={30}
                  required
                />
              </div>
              <div className="field">
                <label className="required" htmlFor="program-name">
                  Nome
                </label>
                <input
                  className="input"
                  id="program-name"
                  name="name"
                  maxLength={150}
                  required
                />
              </div>
              <div className="field third">
                <label htmlFor="min-age">Idade mín.</label>
                <input
                  className="input"
                  id="min-age"
                  name="minAge"
                  type="number"
                  min={0}
                  max={120}
                />
              </div>
              <div className="field third">
                <label htmlFor="max-age">Idade máx.</label>
                <input
                  className="input"
                  id="max-age"
                  name="maxAge"
                  type="number"
                  min={0}
                  max={120}
                />
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton>
                <Plus size={14} /> Criar programa
              </SubmitButton>
            </div>
          </form>
        </details>
        <details className="card">
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <Link2
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Vincular programa à unidade
            </span>
          </summary>
          <form action={linkProgramUnitAction} className="card-body">
            <div className="form-grid">
              <div className="field">
                <label className="required" htmlFor="link-program">
                  Programa
                </label>
                <select
                  className="select"
                  id="link-program"
                  name="programPublicId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.programs
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.public_id} value={item.public_id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label className="required" htmlFor="link-unit">
                  Unidade
                </label>
                <select
                  className="select"
                  id="link-unit"
                  name="unitPublicId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.units
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.public_id} value={item.public_id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field third">
                <label className="required" htmlFor="link-start">
                  Início
                </label>
                <input
                  className="input"
                  id="link-start"
                  name="startDate"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton>
                <Link2 size={14} /> Vincular
              </SubmitButton>
            </div>
          </form>
        </details>
        <details className="card">
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <GraduationCap
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Nova turma
            </span>
          </summary>
          <form action={createClassAction} className="card-body">
            <div className="form-grid">
              <div className="field full">
                <label className="required" htmlFor="class-pu">
                  Programa e unidade
                </label>
                <select
                  className="select"
                  id="class-pu"
                  name="programUnit"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.programUnits.map((item) => (
                    <option key={item.option_value} value={item.option_value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field third">
                <label className="required" htmlFor="class-code">
                  Código
                </label>
                <input
                  className="input"
                  id="class-code"
                  name="code"
                  maxLength={40}
                  required
                />
              </div>
              <div className="field">
                <label className="required" htmlFor="class-name">
                  Nome
                </label>
                <input
                  className="input"
                  id="class-name"
                  name="name"
                  maxLength={120}
                  required
                />
              </div>
              <div className="field third">
                <label className="required" htmlFor="class-year">
                  Ano
                </label>
                <input
                  className="input"
                  id="class-year"
                  name="year"
                  type="number"
                  min={2000}
                  max={2200}
                  defaultValue={year}
                  required
                />
              </div>
              <div className="field third">
                <label className="required" htmlFor="class-shift">
                  Turno
                </label>
                <select
                  className="select"
                  id="class-shift"
                  name="shift"
                  defaultValue="MATUTINO"
                >
                  {[
                    "MATUTINO",
                    "VESPERTINO",
                    "NOTURNO",
                    "INTEGRAL",
                    "OUTRO",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field third">
                <label htmlFor="class-capacity">Capacidade</label>
                <input
                  className="input"
                  id="class-capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  max={5000}
                />
              </div>
              <div className="field third">
                <label className="required" htmlFor="class-start">
                  Início
                </label>
                <input
                  className="input"
                  id="class-start"
                  name="startDate"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton>
                <Plus size={14} /> Criar turma
              </SubmitButton>
            </div>
          </form>
        </details>
        <details className="card">
          <summary
            className="card-header"
            style={{ cursor: "pointer", fontWeight: 750 }}
          >
            <span>
              <Plus
                size={15}
                style={{ verticalAlign: "middle", marginRight: 7 }}
              />
              Nova atividade e oferta
            </span>
          </summary>
          <form action={createActivityOfferAction} className="card-body">
            <div className="form-grid">
              <div className="field full">
                <label className="required" htmlFor="activity-pu">
                  Programa e unidade
                </label>
                <select
                  className="select"
                  id="activity-pu"
                  name="programUnit"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.programUnits.map((item) => (
                    <option key={item.option_value} value={item.option_value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field third">
                <label className="required" htmlFor="activity-code">
                  Código
                </label>
                <input
                  className="input"
                  id="activity-code"
                  name="code"
                  maxLength={40}
                  required
                />
              </div>
              <div className="field">
                <label className="required" htmlFor="activity-name">
                  Atividade
                </label>
                <input
                  className="input"
                  id="activity-name"
                  name="name"
                  maxLength={180}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="activity-class">Turma</label>
                <select
                  className="select"
                  id="activity-class"
                  name="classPublicId"
                  defaultValue=""
                >
                  <option value="">Todas as turmas</option>
                  {data.classes
                    .filter((item) => item.status === "ATIVA")
                    .map((item) => (
                      <option key={item.public_id} value={item.public_id}>
                        {item.name} · {item.unit_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field third">
                <label className="required" htmlFor="activity-start">
                  Início
                </label>
                <input
                  className="input"
                  id="activity-start"
                  name="startDate"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <SubmitButton>
                <Plus size={14} /> Criar oferta
              </SubmitButton>
            </div>
          </form>
        </details>
      </section>
      <section className="grid cols-2">
        <article className="card">
          <div className="card-header">
            <h2>Unidades e programas</h2>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Local</th>
                    <th>Programas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.units.map((unit) => (
                    <tr key={unit.public_id}>
                      <td>
                        <strong className="cell-title">{unit.name}</strong>
                        <span className="cell-subtitle">
                          {unit.code}
                          {unit.acronym ? ` · ${unit.acronym}` : ""}
                        </span>
                      </td>
                      <td>
                        {[unit.city, unit.state].filter(Boolean).join("/") ||
                          "—"}
                      </td>
                      <td>{unit.programs ?? "Sem vínculo"}</td>
                      <td>
                        <StatusBadge
                          status={unit.active ? "ATIVA" : "INATIVA"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <h2>Turmas</h2>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Turma</th>
                    <th>Programa / unidade</th>
                    <th>Turno</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((item) => (
                    <tr key={item.public_id}>
                      <td>
                        <strong className="cell-title">{item.name}</strong>
                        <span className="cell-subtitle">
                          {item.code} · {item.year}
                        </span>
                      </td>
                      <td>
                        <span className="cell-title">{item.program_name}</span>
                        <span className="cell-subtitle">{item.unit_name}</span>
                      </td>
                      <td>{item.shift}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
