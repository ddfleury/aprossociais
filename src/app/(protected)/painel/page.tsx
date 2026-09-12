import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { getDashboardData } from "@/modules/dashboard/queries";

export const metadata: Metadata = { title: "Painel" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.replace(" ", "T")}Z`));
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const largest = Math.max(...data.programs.map((program) => program.total), 1);
  return (
    <>
      <PageHeader
        eyebrow="Inteligência operacional"
        title="Visão geral"
        description="Indicadores atualizados de participantes, frequência e atividades nas unidades autorizadas."
      />
      <section className="stats-grid" aria-label="Indicadores principais">
        <StatCard
          label="Participantes ativos"
          value={data.participants.toLocaleString("pt-BR")}
          note="Com vínculo atual"
        />
        <StatCard
          label="Matrículas ativas"
          value={data.registrations.toLocaleString("pt-BR")}
          note="Em todos os programas"
        />
        <StatCard
          label="Presença · 30 dias"
          value={`${data.attendance.toLocaleString("pt-BR")} %`}
          note="Chamadas registradas"
        />
        <StatCard
          label="Transferências pendentes"
          value={data.transfers}
          note={`${data.events} evento(s) futuro(s)`}
        />
      </section>
      <section className="section-grid">
        <article className="card">
          <div className="card-header">
            <h2>Participantes por programa</h2>
            <Link className="button ghost small" href="/relatorios">
              Ver relatórios <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {data.programs.length ? (
              <ul className="metric-list">
                {data.programs.map((program) => (
                  <li key={program.name}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 5,
                        }}
                      >
                        <span>{program.name}</span>
                        <strong>{program.total}</strong>
                      </div>
                      <div className="progress">
                        <span
                          style={{
                            width: `${Math.max(4, (program.total / largest) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="As matrículas ativas aparecerão aqui." />
            )}
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <h2>Próximos eventos</h2>
            <CalendarDays size={17} />
          </div>
          <div className="card-body">
            {data.upcomingEvents.length ? (
              <ul className="metric-list">
                {data.upcomingEvents.map((event) => (
                  <li key={event.public_id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span className="cell-subtitle">
                        {event.unit_name} · {formatDate(event.starts_at)}
                      </span>
                    </div>
                    <StatusBadge status={event.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="Nenhum evento futuro nas unidades autorizadas." />
            )}
          </div>
        </article>
      </section>
      <article className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <h2>Transferências que exigem atenção</h2>
          <Link className="button secondary small" href="/transferencias">
            Abrir fila
          </Link>
        </div>
        <div className="card-body">
          {data.recentTransfers.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Participante</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Solicitada em</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransfers.map((transfer) => (
                    <tr key={transfer.public_id}>
                      <td>
                        <Link
                          className="cell-title"
                          href={`/transferencias/${transfer.public_id}`}
                        >
                          {transfer.participant_name}
                        </Link>
                      </td>
                      <td>{transfer.origin_name}</td>
                      <td>{transfer.destination_name}</td>
                      <td>{formatDate(transfer.requested_at)}</td>
                      <td>
                        <StatusBadge status={transfer.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Fila em dia"
              description="Não existem transferências aguardando análise."
            />
          )}
        </div>
      </article>
    </>
  );
}
