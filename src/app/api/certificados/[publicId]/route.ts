import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUser } from "@/core/auth/session";
import { execute } from "@/core/db/pool";
import { getRequestContext } from "@/core/http/request-context";
import { createCertificatePdf } from "@/modules/certificates/pdf";
import { getCertificate } from "@/modules/certificates/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    z.uuid().parse(publicId);
    const user = await requireCurrentUser();
    const certificate = await getCertificate(publicId);
    const context = await getRequestContext();
    const pdf = await createCertificatePdf(certificate);
    await execute(
      `INSERT INTO certificados_acessos (certificado_id, usuario_id, resultado, ip, user_agent) VALUES (?, ?, 'AUTORIZADO', ?, ?)`,
      [certificate.id, user.id, context.ip, context.userAgent],
    );
    return new Response(Uint8Array.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificado-${certificate.public_id}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Certificado não encontrado ou acesso não autorizado." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
