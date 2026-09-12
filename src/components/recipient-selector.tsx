"use client";

import { useMemo, useState } from "react";
import type { RecipientCandidate } from "@/modules/communications/queries";

export function RecipientSelector({
  candidates,
}: {
  candidates: RecipientCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return normalized
      ? candidates.filter((item) =>
          `${item.participant_name} ${item.registration_number}`
            .toLocaleLowerCase("pt-BR")
            .includes(normalized),
        )
      : candidates;
  }, [candidates, query]);
  const eligibleVisible = visible.filter((item) => Boolean(item.eligible));
  const selectVisible = () =>
    setSelected(
      (current) =>
        new Set([
          ...current,
          ...eligibleVisible.map((item) => item.registration_public_id),
        ]),
    );
  const clear = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div>
      <div className="filters" style={{ paddingInline: 0 }}>
        <div className="field">
          <label htmlFor="recipientSearch">Pesquisar destinatário</label>
          <input
            id="recipientSearch"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome ou matrícula"
          />
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={selectVisible}
        >
          Selecionar disponíveis ({eligibleVisible.length})
        </button>
        <button className="button secondary" type="button" onClick={clear}>
          Limpar
        </button>
        <span className="badge info">{selected.size} selecionado(s)</span>
      </div>
      <div className="table-wrap" style={{ maxHeight: 440 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Selecionar</th>
              <th>Participante</th>
              <th>Matrícula</th>
              <th>Contato</th>
              <th>Validação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.registration_public_id}>
                <td>
                  <input
                    type="checkbox"
                    name={`recipient:${item.registration_public_id}`}
                    checked={selected.has(item.registration_public_id)}
                    disabled={!item.eligible}
                    onChange={() => toggle(item.registration_public_id)}
                    aria-label={`Selecionar ${item.participant_name}`}
                  />
                </td>
                <td className="cell-title">{item.participant_name}</td>
                <td>{item.registration_number}</td>
                <td>{item.masked_destination}</td>
                <td>
                  <span
                    className={`badge ${item.eligible ? "success" : "danger"}`}
                  >
                    {item.reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
