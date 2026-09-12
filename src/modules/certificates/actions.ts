"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { getRequestContext } from "@/core/http/request-context";
import {
  ConflictError,
  NotFoundError,
  publicErrorMessage,
} from "@/core/security/errors";

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
type Registration = RowDataPacket & {
  id: string;
  program_id: string;
  unit_id: string;
  participant_name: string;
  registration_number: string;
  program_name: string;
  unit_name: string;
};
type Component = RowDataPacket & {
  id: string;
  program_id: string;
  name: string;
};
type Certificate = RowDataPacket & {
  id: string;
  unit_id: string;
  status: string;
};

export async function issueCertificateAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  try {
    const registrationPublicId = z
      .uuid()
      .parse(text(formData, "registrationPublicId"));
    const componentPublicId = text(formData, "componentPublicId");
    if (componentPublicId) z.uuid().parse(componentPublicId);
    const title = z.string().min(5).max(180).parse(text(formData, "title"));
    const minutesText = text(formData, "minutes");
    const minutes = minutesText
      ? z.coerce.number().int().min(1).max(1_000_000).parse(minutesText)
      : null;
    const registration = await queryOne<Registration>(
      `SELECT m.id, m.programa_id AS program_id, u.id AS unit_id, pe.nome AS participant_name, m.numero AS registration_number, pr.nome AS program_name, u.nome AS unit_name FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN programas pr ON pr.id = m.programa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.public_id = ? AND m.status = 'ATIVA' LIMIT 1`,
      [registrationPublicId],
    );
    if (!registration)
      throw new NotFoundError("Matrícula ativa não encontrada.");
    const { user } = await requirePermission(
      PERMISSIONS.CERTIFICATES_ISSUE,
      registration.unit_id,
    );
    const component = componentPublicId
      ? await queryOne<Component>(
          "SELECT id, programa_id AS program_id, nome AS name FROM componentes_curriculares WHERE public_id = ? AND ativo = 1",
          [componentPublicId],
        )
      : null;
    if (
      componentPublicId &&
      (!component || component.program_id !== registration.program_id)
    )
      throw new ConflictError(
        "O componente curricular não pertence ao programa da matrícula.",
      );
    const publicId = randomUUID();
    const inserted = await execute(
      `INSERT INTO certificados (public_id, matricula_id, componente_id, titulo, modelo_versao, carga_minutos, participante_nome_snapshot, matricula_numero_snapshot, programa_nome_snapshot, unidade_nome_snapshot, componente_nome_snapshot, status, emitido_por) VALUES (?, ?, ?, ?, 'APROS-NEXT-1.0', ?, ?, ?, ?, ?, ?, 'VALIDO', ?)`,
      [
        publicId,
        registration.id,
        component?.id ?? null,
        title,
        minutes,
        registration.participant_name,
        registration.registration_number,
        registration.program_name,
        registration.unit_name,
        component?.name ?? null,
        user.id,
      ],
    );
    await auditEvent({
      userId: user.id,
      action: "CERTIFICADO_EMITIDO",
      entity: "CERTIFICADO",
      entityId: String(inserted.insertId),
      entityPublicId: publicId,
      metadata: { unitId: registration.unit_id, model: "APROS-NEXT-1.0" },
      context,
    });
  } catch (error) {
    console.error("Falha ao emitir certificado", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/certificados?error=${encodeURIComponent(failure)}`);
  redirect(
    `/certificados?success=${encodeURIComponent("Certificado emitido com verificação pública.")}`,
  );
}

export async function revokeCertificateAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const reason = z.string().min(10).max(500).parse(text(formData, "reason"));
    const certificate = await queryOne<Certificate>(
      `SELECT c.id, u.id AS unit_id, c.status FROM certificados c JOIN matriculas m ON m.id = c.matricula_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE c.public_id = ? LIMIT 1`,
      [publicId],
    );
    if (!certificate) throw new NotFoundError("Certificado não encontrado.");
    if (certificate.status !== "VALIDO")
      throw new ConflictError("O certificado não está válido.");
    const { user } = await requirePermission(
      PERMISSIONS.CERTIFICATES_REVOKE,
      certificate.unit_id,
    );
    await execute(
      "UPDATE certificados SET status = 'REVOGADO', revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = ? WHERE id = ?",
      [reason, certificate.id],
    );
    await auditEvent({
      userId: user.id,
      action: "CERTIFICADO_REVOGADO",
      entity: "CERTIFICADO",
      entityId: certificate.id,
      entityPublicId: publicId,
      metadata: { unitId: certificate.unit_id },
      context,
    });
  } catch (error) {
    console.error("Falha ao revogar certificado", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/certificados?error=${encodeURIComponent(failure)}`);
  redirect(
    `/certificados?success=${encodeURIComponent("Certificado revogado.")}`,
  );
}
