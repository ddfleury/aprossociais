"use client";

import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { useActionState } from "react";

import { loginAction } from "@/modules/auth/actions";
import { INITIAL_ACTION_STATE } from "@/core/security/action-state";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, INITIAL_ACTION_STATE);
  return (
    <form action={action} noValidate>
      {state.status === "error" ? (
        <div className="alert error" role="alert">
          {state.message}
        </div>
      ) : null}
      <div className="field full">
        <label htmlFor="identifier" className="required">
          Usuário ou e-mail
        </label>
        <div style={{ position: "relative" }}>
          <UserRound
            size={16}
            aria-hidden
            style={{
              position: "absolute",
              left: 11,
              top: 12,
              color: "#6d7b8f",
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            id="identifier"
            name="identifier"
            autoComplete="username"
            maxLength={254}
            required
            autoFocus
          />
        </div>
      </div>
      <div className="field full" style={{ marginTop: 14 }}>
        <label htmlFor="password" className="required">
          Senha
        </label>
        <div style={{ position: "relative" }}>
          <LockKeyhole
            size={16}
            aria-hidden
            style={{
              position: "absolute",
              left: 11,
              top: 12,
              color: "#6d7b8f",
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={200}
            required
          />
        </div>
      </div>
      <SubmitButton className="button" pendingLabel="Verificando...">
        <LogIn size={16} aria-hidden /> Entrar com segurança
      </SubmitButton>
      <p className="field-help" style={{ marginTop: 12 }}>
        O acesso e as operações administrativas são registrados para auditoria.
      </p>
    </form>
  );
}
