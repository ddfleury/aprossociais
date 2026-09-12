import { NextResponse } from "next/server";
import { z } from "zod";

import { PERMISSIONS } from "@/core/auth/permissions";
import { requireCurrentUser, requirePermission } from "@/core/auth/session";
import { execute } from "@/core/db/pool";
import { getRequestContext } from "@/core/http/request-context";
import { readPrivateFile } from "@/core/security/private-storage";
import { getDocumentForDownload } from "@/modules/documents/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    z.uuid().parse(publicId);
    const user = await requireCurrentUser();
    const document = await getDocumentForDownload(publicId);
    if (document.sensitive)
      await requirePermission(PERMISSIONS.SENSITIVE_VIEW, document.unit_id);
    const purpose =
      new URL(request.url).searchParams
        .get("finalidade")
        ?.trim()
        .slice(0, 200) || "Consulta administrativa autorizada";
    if (purpose.length < 3)
      return NextResponse.json(
        { error: "Informe a finalidade do acesso." },
        { status: 400 },
      );
    const bytes = await readPrivateFile(document.storage_key);
    const context = await getRequestContext();
    await execute(
      `INSERT INTO documentos_acessos (documento_id, usuario_id, acao, finalidade, ip) VALUES (?, ?, 'BAIXAR', ?, ?)`,
      [document.id, user.id, purpose, context.ip],
    );
    const safeAscii = document.original_name
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .slice(0, 120);
    const encoded = encodeURIComponent(document.original_name).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.mime_type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Documento não encontrado ou acesso não autorizado." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
