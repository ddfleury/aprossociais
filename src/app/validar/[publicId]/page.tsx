import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, BadgeX } from "lucide-react";
import { z } from "zod";

import { getEnv } from "@/core/config/env";
import { formatUtcDateTime } from "@/core/http/datetime";
import { getPublicCertificate } from "@/modules/certificates/queries";

export const metadata: Metadata = {
  title: "Validar certificado",
  robots: { index: false, follow: false },
};
export default async function ValidateCertificatePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!z.uuid().safeParse(publicId).success) notFound();
  let certificate;
  try {
    certificate = await getPublicCertificate(publicId);
  } catch {
    notFound();
  }
  const valid = certificate.status === "VALIDO";
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "linear-gradient(145deg, #061a2e, #103a61)",
      }}
    >
      <article
        className="card"
        style={{ width: "min(100%, 620px)", padding: 30 }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          {valid ? (
            <BadgeCheck size={48} color="#137447" />
          ) : (
            <BadgeX size={48} color="#b42318" />
          )}
          <div>
            <p className="eyebrow">Verificação pública</p>
            <h1 style={{ margin: 0 }}>
              {valid ? "Certificado válido" : "Certificado sem validade"}
            </h1>
          </div>
        </div>
        <dl className="detail-list">
          <div className="detail-item">
            <dt>Participante</dt>
            <dd>{certificate.participant_name}</dd>
          </div>
          <div className="detail-item">
            <dt>Certificado</dt>
            <dd>{certificate.title}</dd>
          </div>
          <div className="detail-item">
            <dt>Programa</dt>
            <dd>{certificate.program_name}</dd>
          </div>
          <div className="detail-item">
            <dt>Unidade</dt>
            <dd>{certificate.unit_name}</dd>
          </div>
          <div className="detail-item">
            <dt>Emissão</dt>
            <dd>
              {formatUtcDateTime(certificate.issued_at, getEnv().APP_TIME_ZONE)}
            </dd>
          </div>
          <div className="detail-item">
            <dt>Identificador</dt>
            <dd style={{ wordBreak: "break-all" }}>{certificate.public_id}</dd>
          </div>
        </dl>
        {!valid ? (
          <div className="alert error" style={{ marginTop: 18 }}>
            Este certificado foi revogado ou substituído pela instituição.
          </div>
        ) : null}
        <p className="field-help" style={{ marginTop: 20 }}>
          Esta página confirma somente a autenticidade e o status do documento.
          Nenhum dado de contato é exibido.
        </p>
      </article>
    </main>
  );
}
