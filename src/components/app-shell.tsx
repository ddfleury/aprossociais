import { LogOut, Menu } from "lucide-react";

import { can, PERMISSIONS } from "@/core/auth/permissions";
import type { CurrentUser } from "@/core/auth/session";
import { AppSidebar, type NavigationItem } from "@/components/sidebar";
import { logoutAction } from "@/modules/auth/actions";

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const items: NavigationItem[] = [
    {
      label: "Visão geral",
      href: "/painel",
      icon: "dashboard",
      group: "Gestão",
    },
    ...(can(user, PERMISSIONS.PARTICIPANTS_VIEW)
      ? [
          {
            label: "Participantes",
            href: "/participantes",
            icon: "participants",
            group: "Gestão",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.REGISTRATIONS_MANAGE)
      ? [
          {
            label: "Matrículas",
            href: "/matriculas",
            icon: "registrations",
            group: "Gestão",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.TRANSFERS_REQUEST)
      ? [
          {
            label: "Transferências",
            href: "/transferencias",
            icon: "transfers",
            group: "Gestão",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.ATTENDANCE_REPORTS)
      ? [
          {
            label: "Frequência",
            href: "/frequencia",
            icon: "attendance",
            group: "Pedagógico",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.LESSON_PLANS_MANAGE)
      ? [
          {
            label: "Planos de aula",
            href: "/planos",
            icon: "plans",
            group: "Pedagógico",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.EVENTS_MANAGE)
      ? [
          {
            label: "Eventos",
            href: "/eventos",
            icon: "events",
            group: "Operações",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.COMMUNICATIONS_CREATE)
      ? [
          {
            label: "Comunicações",
            href: "/comunicacoes",
            icon: "messages",
            group: "Operações",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.CERTIFICATES_ISSUE)
      ? [
          {
            label: "Certificados",
            href: "/certificados",
            icon: "certificates",
            group: "Documentos",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.DOCUMENTS_VIEW)
      ? [
          {
            label: "Arquivos",
            href: "/documentos",
            icon: "documents",
            group: "Documentos",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.ATTENDANCE_REPORTS)
      ? [
          {
            label: "Relatórios",
            href: "/relatorios",
            icon: "reports",
            group: "Inteligência",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.USERS_MANAGE)
      ? [
          {
            label: "Usuários",
            href: "/configuracoes/usuarios",
            icon: "users",
            group: "Administração",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.UNITS_MANAGE)
      ? [
          {
            label: "Unidades",
            href: "/configuracoes/unidades",
            icon: "units",
            group: "Administração",
          },
        ]
      : []),
    ...(can(user, PERMISSIONS.AUDIT_VIEW)
      ? [
          {
            label: "Auditoria",
            href: "/auditoria",
            icon: "audit",
            group: "Administração",
          },
        ]
      : []),
    {
      label: "Minha conta",
      href: "/minha-conta",
      icon: "profile",
      group: "Conta",
    },
  ];
  return (
    <div className="app-layout">
      <AppSidebar
        items={items}
        userName={user.name}
        unitName={user.unitName ?? "Acesso global"}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-actions">
            <button
              id="menu-trigger"
              className="button secondary icon-button menu-button"
              type="button"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
            <span className="topbar-title">
              Plataforma de gestão institucional
            </span>
          </div>
          <form action={logoutAction}>
            <button className="button ghost small" type="submit">
              <LogOut size={15} /> Sair
            </button>
          </form>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
