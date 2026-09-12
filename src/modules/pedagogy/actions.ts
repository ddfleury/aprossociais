"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import {
  execute,
  queryOne,
  queryRows,
  type RowDataPacket,
} from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { localDateTimeToUtc } from "@/core/http/datetime";
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
type ProgramAccess = RowDataPacket & { id: string; unit_id: string };
type Offer = RowDataPacket & {
  id: string;
  unit_id: string;
  program_id: string;
};
type Plan = RowDataPacket & { id: string; program_id: string };
type Meeting = RowDataPacket & {
  id: string;
  unit_id: string;
  duration: number;
  status: string;
  program_unit_id: string;
  class_id: string | null;
};
type Registration = RowDataPacket & { id: string; public_id: string };

export async function createLessonPlanAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  try {
    const programPublicId = z.uuid().parse(text(formData, "programPublicId"));
    const title = z.string().min(5).max(255).parse(text(formData, "title"));
    const theme = z.string().max(255).parse(text(formData, "theme"));
    const objectives = z
      .string()
      .max(10_000)
      .parse(text(formData, "objectives"));
    const methodology = z
      .string()
      .max(50_000)
      .parse(text(formData, "methodology"));
    const safety = z.string().max(10_000).parse(text(formData, "safety"));
    const minutes = z.coerce
      .number()
      .int()
      .min(1)
      .max(1440)
      .parse(text(formData, "minutes"));
    const status = z
      .enum(["RASCUNHO", "PUBLICADO"])
      .parse(text(formData, "status"));
    const { user, scope } = await requirePermission(
      PERMISSIONS.LESSON_PLANS_MANAGE,
    );
    const scopeClause = scope.global
      ? ""
      : ` AND u.id IN (${scope.unitIds.map(() => "?").join(",")})`;
    const access = await queryOne<ProgramAccess>(
      `SELECT pr.id, u.id AS unit_id FROM programas pr JOIN programas_unidades pu ON pu.programa_id = pr.id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND pr.ativo = 1 AND pu.ativo = 1${scopeClause} ORDER BY u.id LIMIT 1`,
      [programPublicId, ...scope.unitIds],
    );
    if (!access) throw new NotFoundError("Programa não encontrado.");
    const publicId = randomUUID();
    const inserted = await execute(
      `INSERT INTO planos_aula (public_id, programa_id, titulo, tema, objetivos, metodologia, seguranca, carga_minutos, status, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        publicId,
        access.id,
        title,
        theme || null,
        objectives || null,
        methodology || null,
        safety || null,
        minutes,
        status,
        user.id,
      ],
    );
    await auditEvent({
      userId: user.id,
      action: "PLANO_AULA_CRIADO",
      entity: "PLANO_AULA",
      entityId: String(inserted.insertId),
      entityPublicId: publicId,
      metadata: { programId: access.id, status },
      context,
    });
  } catch (error) {
    console.error("Falha ao criar plano", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/planos/novo?error=${encodeURIComponent(failure)}`);
  redirect(`/planos?success=${encodeURIComponent("Plano de aula salvo.")}`);
}

export async function createMeetingAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  let publicId: string | null = null;
  try {
    const offerPublicId = z.uuid().parse(text(formData, "offerPublicId"));
    const planPublicId = text(formData, "planPublicId");
    if (planPublicId) z.uuid().parse(planPublicId);
    const startsAt = localDateTimeToUtc(
      text(formData, "startsAt"),
      getEnv().APP_TIME_ZONE,
    );
    const endsAt = localDateTimeToUtc(
      text(formData, "endsAt"),
      getEnv().APP_TIME_ZONE,
    );
    if (endsAt <= startsAt)
      throw new ConflictError("O término precisa ser posterior ao início.");
    const location = z.string().max(180).parse(text(formData, "location"));
    const offer = await queryOne<Offer>(
      `SELECT ao.id, u.id AS unit_id, a.programa_id AS program_id FROM atividades_ofertas ao JOIN atividades a ON a.id = ao.atividade_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE ao.public_id = ? AND ao.status = 'ATIVA' LIMIT 1`,
      [offerPublicId],
    );
    if (!offer) throw new NotFoundError("Oferta de atividade não encontrada.");
    const { user } = await requirePermission(
      PERMISSIONS.ATTENDANCE_RECORD,
      offer.unit_id,
    );
    const plan = planPublicId
      ? await queryOne<Plan>(
          "SELECT id, programa_id FROM planos_aula WHERE public_id = ? AND status = 'PUBLICADO' AND excluido_em IS NULL",
          [planPublicId],
        )
      : null;
    if (planPublicId && (!plan || plan.program_id !== offer.program_id))
      throw new ConflictError(
        "O plano precisa pertencer ao mesmo programa da atividade.",
      );
    publicId = randomUUID();
    const inserted = await execute(
      `INSERT INTO encontros (public_id, oferta_id, plano_id, inicio_em, fim_em, local_descricao, instrutor_id, status, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, 'AGENDADO', ?)`,
      [
        publicId,
        offer.id,
        plan?.id ?? null,
        startsAt,
        endsAt,
        location || null,
        user.id,
        user.id,
      ],
    );
    await auditEvent({
      userId: user.id,
      action: "ENCONTRO_CRIADO",
      entity: "ENCONTRO",
      entityId: String(inserted.insertId),
      entityPublicId: publicId,
      metadata: { unitId: offer.unit_id },
      context,
    });
  } catch (error) {
    console.error("Falha ao criar encontro", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/frequencia?error=${encodeURIComponent(failure)}`);
  redirect(
    `/frequencia/${publicId}?success=${encodeURIComponent("Encontro criado. Registre a chamada.")}`,
  );
}

export async function saveAttendanceAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const meeting = await queryOne<Meeting>(
      `SELECT e.id, u.id AS unit_id, TIMESTAMPDIFF(MINUTE, e.inicio_em, e.fim_em) AS duration, e.status, ao.programa_unidade_id AS program_unit_id, ao.turma_id AS class_id FROM encontros e JOIN atividades_ofertas ao ON ao.id = e.oferta_id JOIN programas_unidades pu ON pu.id = ao.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE e.public_id = ? LIMIT 1`,
      [publicId],
    );
    if (!meeting) throw new NotFoundError("Encontro não encontrado.");
    if (["CONCLUIDO", "CANCELADO"].includes(meeting.status))
      throw new ConflictError("Este encontro está fechado para alterações.");
    const { user } = await requirePermission(
      PERMISSIONS.ATTENDANCE_RECORD,
      meeting.unit_id,
    );
    await withTransaction(async (connection) => {
      const registrations = await queryRows<Registration>(
        `SELECT m.id, m.public_id FROM matriculas m JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id WHERE m.status = 'ATIVA' AND mv.programa_unidade_id = ? AND (? IS NULL OR mv.turma_id = ?) FOR UPDATE`,
        [meeting.program_unit_id, meeting.class_id, meeting.class_id],
        connection,
      );
      for (const registration of registrations) {
        const status = text(formData, `status:${registration.public_id}`);
        if (
          !["PRESENTE", "AUSENTE", "JUSTIFICADA", "NAO_APLICAVEL"].includes(
            status,
          )
        )
          throw new ConflictError("Há uma situação de frequência inválida.");
        const minutes = status === "PRESENTE" ? meeting.duration : 0;
        await execute(
          `INSERT INTO frequencias (encontro_id, matricula_id, status, minutos_creditados, registrado_por) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), minutos_creditados = VALUES(minutos_creditados), atualizado_por = VALUES(registrado_por), atualizado_em = UTC_TIMESTAMP(6)`,
          [meeting.id, registration.id, status, minutes, user.id],
          connection,
        );
      }
      if (formData.get("closeMeeting") === "on")
        await execute(
          "UPDATE encontros SET status = 'CONCLUIDO', fechado_por = ?, fechado_em = UTC_TIMESTAMP(6) WHERE id = ?",
          [user.id, meeting.id],
          connection,
        );
      else
        await execute(
          "UPDATE encontros SET status = 'EM_ANDAMENTO' WHERE id = ? AND status = 'AGENDADO'",
          [meeting.id],
          connection,
        );
      await auditEvent({
        userId: user.id,
        action:
          formData.get("closeMeeting") === "on"
            ? "CHAMADA_FECHADA"
            : "CHAMADA_SALVA",
        entity: "ENCONTRO",
        entityId: meeting.id,
        entityPublicId: publicId,
        metadata: { records: registrations.length, unitId: meeting.unit_id },
        context,
        connection,
      });
    });
  } catch (error) {
    console.error("Falha ao salvar frequência", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/frequencia/${publicId}?error=${encodeURIComponent(failure)}`);
  redirect(
    `/frequencia/${publicId}?success=${encodeURIComponent(formData.get("closeMeeting") === "on" ? "Chamada concluída." : "Frequência salva.")}`,
  );
}
