"use client";

import { AlertTriangle } from "lucide-react";

export default function ProtectedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card empty-state" role="alert">
      <AlertTriangle size={34} />
      <h3>Não foi possível carregar esta área</h3>
      <p>
        Tente novamente. Se o erro persistir, informe o protocolo exibido nos
        logs ao suporte.
      </p>
      <button className="button" type="button" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
