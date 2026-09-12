import type { Metadata } from "next";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { FlashMessage, PageHeader } from "@/components/ui";
import { requireCurrentUser } from "@/core/auth/session";
import {
  changePasswordAction,
  revokeOtherSessionsAction,
  updateProfileAction,
} from "@/modules/account/actions";

export const metadata: Metadata = { title: "Minha conta" };
type Params = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const [user, params] = await Promise.all([
    requireCurrentUser(),
    searchParams,
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Conta e segurança"
        title="Minha conta"
        description="Atualize seus dados de acesso e controle as sessões conectadas."
      />
      <FlashMessage success={one(params.success)} error={one(params.error)} />
      <div className="grid cols-2 account-grid">
        <section className="card">
          <div className="card-header">
            <h2>
              <UserRound size={17} /> Dados do perfil
            </h2>
          </div>
          <div className="card-body">
            <form action={updateProfileAction}>
              <div className="form-grid">
                <div className="field full">
                  <label className="required" htmlFor="name">
                    Nome completo
                  </label>
                  <input
                    className="input"
                    id="name"
                    name="name"
                    defaultValue={user.name}
                    required
                    minLength={3}
                    maxLength={180}
                    autoComplete="name"
                  />
                </div>
                <div className="field full">
                  <label className="required" htmlFor="email">
                    E-mail de acesso
                  </label>
                  <input
                    className="input"
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    required
                    maxLength={254}
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label>Login</label>
                  <input className="input" value={user.login} readOnly />
                </div>
                <div className="field">
                  <label>Unidade principal</label>
                  <input
                    className="input"
                    value={user.unitName ?? "Acesso global"}
                    readOnly
                  />
                </div>
              </div>
              <div className="form-actions">
                <SubmitButton pendingLabel="Salvando...">
                  Salvar perfil
                </SubmitButton>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>
              <KeyRound size={17} /> Alterar senha
            </h2>
          </div>
          <div className="card-body">
            <form action={changePasswordAction}>
              <div className="form-grid">
                <div className="field full">
                  <label className="required" htmlFor="currentPassword">
                    Senha atual
                  </label>
                  <input
                    className="input"
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    maxLength={200}
                    autoComplete="current-password"
                  />
                </div>
                <div className="field">
                  <label className="required" htmlFor="newPassword">
                    Nova senha
                  </label>
                  <input
                    className="input"
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={14}
                    maxLength={200}
                    autoComplete="new-password"
                  />
                  <p className="field-help">
                    Use ao menos 14 caracteres e uma frase exclusiva.
                  </p>
                </div>
                <div className="field">
                  <label className="required" htmlFor="confirmation">
                    Confirmar nova senha
                  </label>
                  <input
                    className="input"
                    id="confirmation"
                    name="confirmation"
                    type="password"
                    required
                    minLength={14}
                    maxLength={200}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="form-actions">
                <SubmitButton pendingLabel="Atualizando...">
                  Alterar senha
                </SubmitButton>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="card security-strip">
        <div>
          <ShieldCheck size={20} />
          <div>
            <strong>Encerrar outras sessões</strong>
            <p>
              Revoga acessos em outros navegadores sem desconectar esta sessão.
            </p>
          </div>
        </div>
        <form action={revokeOtherSessionsAction}>
          <SubmitButton
            className="button secondary"
            pendingLabel="Encerrando..."
          >
            Encerrar outras sessões
          </SubmitButton>
        </form>
      </section>
    </>
  );
}
