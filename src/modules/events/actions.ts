"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { getEnv } from "@/core/config/env";
import { encryptText } from "@/core/crypto/sensitive";
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
type ProgramUnit = RowDataPacket & { id: string; unit_id: string };
type EventLock = RowDataPacket & {
  id: string;
  unit_id: string;
  program_unit_id: string;
  status: string;
  capacity: number | null;
};
type Registration = RowDataPacket & { id: string; public_id: string };

export async function createEventAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  let failure: string | null = null;
  let publicId: string | null = null;
  try {
    const [programPublicId, unitPublicId] = text(formData, "programUnit").split(
      ":",
    );
    z.uuid().parse(programPublicId);
    z.uuid().parse(unitPublicId);
    const title = z.string().min(5).max(180).parse(text(formData, "title"));
    const type = z
      .enum(["PASSEIO", "FORMATURA", "REUNIAO", "CAMPANHA", "OUTRO"])
      .parse(text(formData, "type"));
    const description = z
      .string()
      .max(10_000)
      .parse(text(formData, "description"));
    const location = z.string().max(180).parse(text(formData, "location"));
    const address = z.string().max(1000).parse(text(formData, "address"));
    const capacityText = text(formData, "capacity");
    const capacity = capacityText
      ? z.coerce.number().int().min(1).max(100_000).parse(capacityText)
      : null;
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
    const programUnit = await queryOne<ProgramUnit>(
      `SELECT pu.id, u.id AS unit_id FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND u.public_id = ? AND pu.ativo = 1 LIMIT 1`,
      [programPublicId, unitPublicId],
    );
    if (!programUnit)
      throw new NotFoundError("Programa e unidade não encontrados.");
    const { user } = await requirePermission(
      PERMISSIONS.EVENTS_MANAGE,
      programUnit.unit_id,
    );
    publicId = randomUUID();
    const inserted = await execute(
      `INSERT INTO eventos (public_id, programa_unidade_id, tipo, titulo, descricao, inicio_em, fim_em, local_nome, endereco_cifrado, capacidade, status, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANEJADO', ?)`,
      [
        publicId,
        programUnit.id,
        type,
        title,
        description || null,
        startsAt,
        endsAt,
        location || null,
        address ? encryptText(address) : null,
        capacity,
        user.id,
      ],
    );
    await auditEvent({
      userId: user.id,
      action: "EVENTO_CRIADO",
      entity: "EVENTO",
      entityId: String(inserted.insertId),
      entityPublicId: publicId,
      metadata: { unitId: programUnit.unit_id, type },
      context,
    });
  } catch (error) {
    console.error("Falha ao criar evento", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`/eventos/novo?error=${encodeURIComponent(failure)}`);
  redirect(
    `/eventos/${publicId}?success=${encodeURIComponent("Evento criado. Selecione os participantes.")}`,
  );
}

export async function saveEventParticipantsAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    await withTransaction(async (connection) => {
      const event = await queryOne<EventLock>(
        `SELECT e.id, u.id AS unit_id, e.programa_unidade_id AS program_unit_id, e.status, e.capacidade AS capacity FROM eventos e JOIN programas_unidades pu ON pu.id = e.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE e.public_id = ? FOR UPDATE`,
        [publicId],
        connection,
      );
      if (!event) throw new NotFoundError("Evento não encontrado.");
      if (event.status === "CANCELADO")
        throw new ConflictError(
          "Evento cancelado não pode receber participantes.",
        );
      const { user } = await requirePermission(
        PERMISSIONS.EVENTS_MANAGE,
        event.unit_id,
      );
      const registrations = await queryRows<Registration>(
        `SELECT m.id, m.public_id FROM matriculas m JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id WHERE m.status = 'ATIVA' AND mv.programa_unidade_id = ? FOR UPDATE`,
        [event.program_unit_id],
        connection,
      );
      let selected = 0;
      for (const registration of registrations) {
        const included =
          formData.get(`include:${registration.public_id}`) === "on";
        if (!included) {
          await execute(
            "UPDATE eventos_participantes SET status = 'CANCELADO', atualizado_em = UTC_TIMESTAMP(6) WHERE evento_id = ? AND matricula_id = ?",
            [event.id, registration.id],
            connection,
          );
          continue;
        }
        selected += 1;
        const status = text(formData, `status:${registration.public_id}`);
        if (!["INSCRITO", "CONFIRMADO", "LISTA_ESPERA"].includes(status))
          throw new ConflictError("Situação de participação inválida.");
        await execute(
          `INSERT INTO eventos_participantes (evento_id, matricula_id, status, confirmado_em, registrado_por) VALUES (?, ?, ?, IF(? = 'CONFIRMADO', UTC_TIMESTAMP(6), NULL), ?) ON DUPLICATE KEY UPDATE status = VALUES(status), confirmado_em = VALUES(confirmado_em), registrado_por = VALUES(registrado_por), atualizado_em = UTC_TIMESTAMP(6)`,
          [event.id, registration.id, status, status, user.id],
          connection,
        );
      }
      if (event.capacity && selected > event.capacity)
        throw new ConflictError(
          `A seleção excede a capacidade de ${event.capacity} participantes.`,
        );
      await auditEvent({
        userId: user.id,
        action: "EVENTO_PARTICIPANTES_ATUALIZADOS",
        entity: "EVENTO",
        entityId: event.id,
        entityPublicId: publicId,
        metadata: { selected, unitId: event.unit_id },
        context,
        connection,
      });
    });
  } catch (error) {
    console.error("Falha ao salvar participantes do evento", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/eventos/${publicId}?error=${encodeURIComponent(failure)}`);
  redirect(
    `/eventos/${publicId}?success=${encodeURIComponent("Lista de participantes atualizada.")}`,
  );
}
