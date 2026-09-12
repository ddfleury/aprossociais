import Link from "next/link";
import { Inbox } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="header-actions">{children}</div> : null}
    </header>
  );
}
export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <article className="card stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note ? <div className="stat-note">{note}</div> : null}
    </article>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone = [
    "ATIVA",
    "ATIVO",
    "VALIDO",
    "CONCLUIDA",
    "PRESENTE",
    "APROVADA",
    "EFETIVADA",
  ].includes(normalized)
    ? "success"
    : [
          "PENDENTE",
          "SOLICITADA",
          "AGENDADA",
          "PLANEJADO",
          "RASCUNHO",
          "LISTA_ESPERA",
        ].includes(normalized)
      ? "warning"
      : [
            "INATIVO",
            "CANCELADA",
            "CANCELADO",
            "REVOGADO",
            "RECUSADA",
            "FALHOU",
            "AUSENTE",
          ].includes(normalized)
        ? "danger"
        : "info";
  return <span className={`badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}
export function EmptyState({
  title = "Nenhum registro encontrado",
  description = "Altere os filtros ou cadastre um novo item.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} aria-hidden />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  pathname,
  query = {},
}: {
  page: number;
  total: number;
  pageSize: number;
  pathname: string;
  query?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", String(target));
    return `${pathname}?${params}`;
  };
  return (
    <div className="pagination">
      <span>
        {total} registro(s) · Página {page} de {pages}
      </span>
      <div className="pagination-actions">
        <Link
          className="button secondary small"
          aria-disabled={page <= 1}
          href={page <= 1 ? href(1) : href(page - 1)}
        >
          Anterior
        </Link>
        <Link
          className="button secondary small"
          aria-disabled={page >= pages}
          href={page >= pages ? href(pages) : href(page + 1)}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
export function FlashMessage({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  if (error)
    return (
      <div className="alert error" role="alert">
        {error}
      </div>
    );
  if (success)
    return (
      <div className="alert success" role="status">
        {success}
      </div>
    );
  return null;
}
