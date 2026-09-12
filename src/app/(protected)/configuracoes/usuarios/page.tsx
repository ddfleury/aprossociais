import type { Metadata } from "next";
import { Plus, ShieldCheck } from "lucide-react";

import { FlashMessage, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  changeUserStatusAction,
  createUserAction,
} from "@/modules/admin/actions";
import { getUsersData } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Usuários" };
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, data] = await Promise.all([searchParams, getUsersData()]);
  return (
    <>
      <PageHeader
        eyebrow="Segurança"
        title="Usuários e acessos"
        description="Contas individuais, papéis e escopo por unidade. Nunca compartilhe credenciais."
      />
      <FlashMessage success={params.success} error={params.error} />
      <details className="card no-print" style={{ marginBottom: 14 }}>
        <summary
          className="card-header"
          style={{ cursor: "pointer", fontWeight: 750 }}
        >
          <span>
            <Plus
              size={15}
              style={{ verticalAlign: "middle", marginRight: 7 }}
            />
            Novo usuário
          </span>
        </summary>
        <form action={createUserAction} className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="required" htmlFor="user-name">
                Nome completo
              </label>
              <input
                className="input"
                id="user-name"
                name="name"
                minLength={3}
                maxLength={180}
                required
              />
            </div>
            <div className="field third">
              <label className="required" htmlFor="user-login">
                Login
              </label>
              <input
                className="input"
                id="user-login"
                name="login"
                pattern="[A-Za-z0-9._-]{3,80}"
                required
              />
            </div>
            <div className="field">
              <label className="required" htmlFor="user-email">
                E-mail
              </label>
              <input
                className="input"
                id="user-email"
                name="email"
                type="email"
                maxLength={254}
                required
              />
            </div>
            <div className="field">
              <label className="required" htmlFor="user-password">
                Senha inicial
              </label>
              <input
                className="input"
                id="user-password"
                name="password"
                type="password"
                minLength={14}
                maxLength={200}
                autoComplete="new-password"
                required
              />
              <p className="field-help">
                Mínimo de 14 caracteres. Envie por canal seguro.
              </p>
            </div>
            <div className="field third">
              <label className="required" htmlFor="user-role">
                Papel
              </label>
              <select
                className="select"
                id="user-role"
                name="roleCode"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {data.roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="user-unit">Unidade de atuação</label>
              <select
                className="select"
                id="user-unit"
                name="unitPublicId"
                defaultValue=""
              >
                <option value="">Apenas Administrador global</option>
                {data.units.map((unit) => (
                  <option key={unit.public_id} value={unit.public_id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="alert info" style={{ marginTop: 14 }}>
            <ShieldCheck
              size={15}
              style={{ verticalAlign: "middle", marginRight: 6 }}
            />
            Papéis operacionais exigem unidade. Administrador recebe escopo
            global.
          </div>
          <div className="form-actions">
            <SubmitButton>
              <Plus size={14} /> Criar usuário
            </SubmitButton>
          </div>
        </form>
      </details>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Login</th>
              <th>Unidade base</th>
              <th>Papéis</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.public_id}>
                <td>
                  <strong className="cell-title">{user.name}</strong>
                  <span className="cell-subtitle">{user.email}</span>
                </td>
                <td>{user.login}</td>
                <td>{user.unit_name ?? "Global"}</td>
                <td>{user.roles ?? "Sem papel"}</td>
                <td>
                  <StatusBadge status={user.status} />
                </td>
                <td>
                  <form
                    action={changeUserStatusAction}
                    className="table-actions"
                  >
                    <input
                      type="hidden"
                      name="publicId"
                      value={user.public_id}
                    />
                    <select
                      className="select"
                      name="status"
                      defaultValue={user.status}
                      aria-label={`Alterar status de ${user.name}`}
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="BLOQUEADO">Bloqueado</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                    <SubmitButton className="button secondary small">
                      Salvar
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
