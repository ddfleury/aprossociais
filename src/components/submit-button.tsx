"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Salvando...",
  className = "button",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
