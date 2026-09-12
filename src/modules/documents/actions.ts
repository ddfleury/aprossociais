"use server";

import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import { sha256 } from "@/core/crypto/hash";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { getRequestContext } from "@/core/http/request-context";
import {
  removePrivateFile,
  storePrivateFile,
} from "@/core/security/private-storage";
import {
  ConflictError,
  NotFoundError,
  publicErrorMessage,
} from "@/core/security/errors";

const allowedTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
type UploadContext = RowDataPacket & {
  participant_id: string;
  unit_id: string;
  type_id: string;
  type_sensitive: number;
};
type RevocationContext = RowDataPacket & { id: string; unit_id: string };

export async function uploadDocumentAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  let storageKey: string | null = null;
  try {
    const participantPublicId = z
      .uuid()
      .parse(text(formData, "participantPublicId"));
    const typeCode = z
      .string()
      .min(2)
      .max(50)
      .parse(text(formData, "typeCode"));
    const validUntil = text(formData, "validUntil");
    if (validUntil) z.iso.date().parse(validUntil);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0)
      throw new ConflictError("Selecione um arquivo.");
    if (file.size > getEnv().MAX_UPLOAD_MB * 1024 * 1024)
      throw new ConflictError(`O arquivo excede ${getEnv().MAX_UPLOAD_MB} MB.`);
    const uploadContext = await queryOne<UploadContext>(
      `SELECT p.id AS participant_id, u.id AS unit_id, dt.id AS type_id, dt.contem_dado_sensivel AS type_sensitive FROM participantes p JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id JOIN documentos_tipos dt ON dt.codigo = ? AND dt.ativo = 1 WHERE p.public_id = ? LIMIT 1`,
      [typeCode, participantPublicId],
    );
    if (!uploadContext)
      throw new NotFoundError(
        "Participante ou tipo de documento não encontrado.",
      );
    const { user } = await requirePermission(
      PERMISSIONS.DOCUMENTS_MANAGE,
      uploadContext.unit_id,
    );
    if (uploadContext.type_sensitive)
      await requirePermission(
        PERMISSIONS.SENSITIVE_EDIT,
        uploadContext.unit_id,
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(bytes);
    const extension = detected ? allowedTypes[detected.mime] : undefined;
    if (!detected || !extension)
      throw new ConflictError(
        "Formato não permitido. Envie PDF, JPG, PNG ou WebP válido.",
      );
    const date = new Date();
    storageKey = `documents/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension}`;
    await storePrivateFile(storageKey, bytes);
    const publicId = randomUUID();
    await withTransaction(async (connection) => {
      if (formData.get("replaceExisting") === "on")
        await execute(
          "UPDATE documentos SET status = 'SUBSTITUIDO' WHERE participante_id = ? AND tipo_id = ? AND status = 'ATIVO'",
          [uploadContext.participant_id, uploadContext.type_id],
          connection,
        );
      const inserted = await execute(
        `INSERT INTO documentos (public_id, participante_id, tipo_id, storage_key, nome_original, extensao, mime_type, tamanho_bytes, hash_sha256, status, valido_ate, enviado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?)`,
        [
          publicId,
          uploadContext.participant_id,
          uploadContext.type_id,
          storageKey,
          file.name.slice(0, 255),
          extension,
          detected.mime,
          file.size,
          sha256(Buffer.from(bytes)),
          validUntil || null,
          user.id,
        ],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: "DOCUMENTO_ENVIADO",
        entity: "DOCUMENTO",
        entityId: String(inserted.insertId),
        entityPublicId: publicId,
        metadata: {
          unitId: uploadContext.unit_id,
          documentTypeId: uploadContext.type_id,
          size: file.size,
        },
        context,
        connection,
      });
    });
  } catch (error) {
    if (storageKey) await removePrivateFile(storageKey);
    console.error("Falha no upload", { requestId: context.requestId, error });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/documentos?error=${encodeURIComponent(failure)}`);
  redirect(
    `/documentos?success=${encodeURIComponent("Documento armazenado com segurança.")}`,
  );
}

export async function revokeDocumentAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const document = await queryOne<RevocationContext>(
      `SELECT d.id, u.id AS unit_id FROM documentos d JOIN participantes p ON p.id = d.participante_id JOIN matriculas m ON m.participante_id = p.id AND m.status = 'ATIVA' JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE d.public_id = ? AND d.status = 'ATIVO' LIMIT 1`,
      [publicId],
    );
    if (!document) throw new NotFoundError("Documento ativo não encontrado.");
    const { user } = await requirePermission(
      PERMISSIONS.DOCUMENTS_MANAGE,
      document.unit_id,
    );
    await execute("UPDATE documentos SET status = 'REVOGADO' WHERE id = ?", [
      document.id,
    ]);
    await auditEvent({
      userId: user.id,
      action: "DOCUMENTO_REVOGADO",
      entity: "DOCUMENTO",
      entityId: document.id,
      entityPublicId: publicId,
      metadata: { unitId: document.unit_id },
      context,
    });
  } catch (error) {
    console.error("Falha ao revogar documento", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/documentos?error=${encodeURIComponent(failure)}`);
  redirect(
    `/documentos?success=${encodeURIComponent("Documento revogado sem apagar o histórico.")}`,
  );
}
