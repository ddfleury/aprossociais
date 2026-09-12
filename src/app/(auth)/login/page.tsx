import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="APROS Sociais">
        <div className="brand-lockup">
          <div className="brand-mark">AP</div>
          <div>
            <h2 className="brand-title">APROS Sociais</h2>
            <p className="brand-caption">Gestão integrada e responsável</p>
          </div>
        </div>
        <div className="auth-message">
          <ShieldCheck size={34} aria-hidden />
          <h2>Informação protegida. Gestão mais humana.</h2>
          <p>
            Uma plataforma única para acompanhar participantes, unidades,
            atividades, frequência, eventos, documentos e comunicações.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Área restrita</p>
          <h1>Bem-vindo</h1>
          <p>Use suas credenciais pessoais para acessar o sistema.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
