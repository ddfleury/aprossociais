"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  FileBadge,
  FileLock2,
  Gauge,
  History,
  MessageSquareText,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
};
const icons: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: Gauge,
  participants: UsersRound,
  registrations: ClipboardCheck,
  transfers: ArrowRightLeft,
  attendance: BookOpenCheck,
  plans: FileBadge,
  events: CalendarDays,
  messages: MessageSquareText,
  certificates: ShieldCheck,
  documents: FileLock2,
  reports: BarChart3,
  users: UserCog,
  units: Building2,
  audit: History,
  profile: CircleUserRound,
};
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AppSidebar({
  items,
  userName,
  unitName,
}: {
  items: NavigationItem[];
  userName: string;
  unitName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const trigger = document.getElementById("menu-trigger");
    const show = () => setOpen(true);
    trigger?.addEventListener("click", show);
    return () => trigger?.removeEventListener("click", show);
  }, []);
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <>
      {open ? (
        <button
          className="mobile-overlay"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`sidebar${open ? " open" : ""}`}
        aria-label="Menu principal"
      >
        <div className="sidebar-head">
          <div className="brand-lockup">
            <div className="brand-mark">AP</div>
            <div>
              <h2 className="brand-title">APROS Sociais</h2>
              <p className="brand-caption">Gestão integrada</p>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="nav-group-label">{group}</div>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = icons[item.icon] ?? Gauge;
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`nav-link${active ? " active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={17} />
                      {item.label}
                    </a>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-compact">
            <div className="avatar">{initials(userName)}</div>
            <div>
              <strong>{userName}</strong>
              <small>{unitName}</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
