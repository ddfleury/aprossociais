"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PoolConnection } from "mysql2/promise";

import { auditEvent } from "@/core/audit/audit";
import { assertPermission, PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { encryptText } from "@/core/crypto/sensitive";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { getRequestContext } from "@/core/http/request-context";
import {
  ConflictError,
  NotFoundError,
  publicErrorMessage,
} from "@/core/security/errors";

type Registration = RowDataPacket & {
  id: string;
  participant_id: string;
  program_id: string;
  origin_link_id: string;
  origin_program_unit_id: string;
  origin_unit_id: string;
  participant_name: string;
};
type ProgramUnit = RowDataPacket & {
  id: string;
  unit_id: string;
  program_id: string;
  unit_name: string;
};
type ClassRow = RowDataPacket & { id: string };
type TransferLocked = RowDataPacket & {
  id: string;
  public_id: string;
  registration_id: string;
  participant_id: string;
  origin_link_id: string;
  origin_program_unit_id: string;
  destination_program_unit_id: string;
  destination_class_id: string | null;
  origin_unit_id: string;
  destination_unit_id: string;
  status: string;
  reason: string;
};
type Duplicate = RowDataPacket & { id: string };
const uuid = z.uuid();
function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function findRegistration(
  publicId: string,
  connection?: PoolConnection,
): Promise<Registration> {
  const row = await queryOne<Registration>(
    `SELECT m.id, m.participante_id AS participant_id, m.programa_id AS program_id, mva.vinculo_id AS origin_link_id, mv.programa_unidade_id AS origin_program_unit_id, u.id AS origin_unit_id, pe.nome AS participant_name FROM matriculas m JOIN participantes p ON p.id = m.participante_id JOIN pessoas pe ON pe.id = p.pessoa_id JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id JOIN unidades u ON u.id = pu.unidade_id WHERE m.public_id = ? AND m.status = 'ATIVA' LIMIT 1`,
    [publicId],
    connection,
  );
  if (!row) throw new NotFoundError("Matrícula ativa não encontrada.");
  return row;
}

export async function requestTransferAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  let success: string | null = null;
  let failure: string | null = null;
  try {
    const registrationPublicId = uuid.parse(
      text(formData, "registrationPublicId"),
    );
    const destination = text(formData, "destination");
    const [programPublicId, unitPublicId] = destination.split(":");
    uuid.parse(programPublicId);
    uuid.parse(unitPublicId);
    const classPublicId = text(formData, "classPublicId");
    if (classPublicId) uuid.parse(classPublicId);
    const reason = z
      .string()
      .min(10, "Descreva o motivo com ao menos 10 caracteres.")
      .max(500)
      .parse(text(formData, "reason"));
    const notes = z.string().max(3000).parse(text(formData, "notes"));
    const registration = await findRegistration(registrationPublicId);
    const { user } = await requirePermission(
      PERMISSIONS.TRANSFERS_REQUEST,
      registration.origin_unit_id,
    );
    const target = await queryOne<ProgramUnit>(
      `SELECT pu.id, pu.unidade_id AS unit_id, pu.programa_id AS program_id, u.nome AS unit_name FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND u.public_id = ? AND pu.ativo = 1 LIMIT 1`,
      [programPublicId, unitPublicId],
    );
    if (!target || target.program_id !== registration.program_id)
      throw new ConflictError(
        "O destino precisa executar o mesmo programa da matrícula.",
      );
    if (target.id === registration.origin_program_unit_id)
      throw new ConflictError(
        "A unidade de destino deve ser diferente da origem.",
      );
    const targetClass = classPublicId
      ? await queryOne<ClassRow>(
          "SELECT id FROM turmas WHERE public_id = ? AND programa_unidade_id = ? AND status = 'ATIVA' LIMIT 1",
          [classPublicId, target.id],
        )
      : null;
    if (classPublicId && !targetClass)
      throw new ConflictError("A turma não pertence à unidade de destino.");
    success = await withTransaction(async (connection) => {
      const duplicate = await queryOne<Duplicate>(
        "SELECT id FROM matriculas_transferencias WHERE matricula_id = ? AND status IN ('SOLICITADA','APROVADA') FOR UPDATE",
        [registration.id],
        connection,
      );
      if (duplicate)
        throw new ConflictError(
          "Já existe uma transferência pendente para esta matrícula.",
        );
      const publicId = randomUUID();
      const inserted = await execute(
        `INSERT INTO matriculas_transferencias (public_id, matricula_id, origem_vinculo_id, destino_programa_unidade_id, destino_turma_id, motivo, observacao_cifrada, status, solicitada_por) VALUES (?, ?, ?, ?, ?, ?, ?, 'SOLICITADA', ?)`,
        [
          publicId,
          registration.id,
          registration.origin_link_id,
          target.id,
          targetClass?.id ?? null,
          reason,
          notes ? encryptText(notes) : null,
          user.id,
        ],
        connection,
      );
      await execute(
        `INSERT INTO participantes_historico (public_id, participante_id, matricula_id, tipo_evento, resumo, detalhes_json, usuario_id) VALUES (?, ?, ?, 'TRANSFERENCIA_SOLICITADA', ?, ?, ?)`,
        [
          randomUUID(),
          registration.participant_id,
          registration.id,
          `Transferência solicitada para ${target.unit_name}.`,
          JSON.stringify({ transferPublicId: publicId }),
          user.id,
        ],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: "TRANSFERENCIA_SOLICITADA",
        entity: "MATRICULA_TRANSFERENCIA",
        entityId: String(inserted.insertId),
        entityPublicId: publicId,
        metadata: {
          originUnitId: registration.origin_unit_id,
          destinationUnitId: target.unit_id,
        },
        context,
        connection,
      });
      return publicId;
    });
  } catch (error) {
    console.error("Falha ao solicitar transferência", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(`/transferencias/nova?error=${encodeURIComponent(failure)}`);
  redirect(
    `/transferencias/${success}?success=${encodeURIComponent("Transferência solicitada.")}`,
  );
}

async function lockTransfer(
  publicId: string,
  connection: PoolConnection,
): Promise<TransferLocked> {
  const row = await queryOne<TransferLocked>(
    `SELECT mt.id, mt.public_id, mt.matricula_id AS registration_id, m.participante_id AS participant_id, mt.origem_vinculo_id AS origin_link_id, mvo.programa_unidade_id AS origin_program_unit_id, mt.destino_programa_unidade_id AS destination_program_unit_id, mt.destino_turma_id AS destination_class_id, uo.id AS origin_unit_id, ud.id AS destination_unit_id, mt.status, mt.motivo AS reason FROM matriculas_transferencias mt JOIN matriculas m ON m.id = mt.matricula_id JOIN matriculas_vinculos mvo ON mvo.id = mt.origem_vinculo_id JOIN programas_unidades puo ON puo.id = mvo.programa_unidade_id JOIN unidades uo ON uo.id = puo.unidade_id JOIN programas_unidades pud ON pud.id = mt.destino_programa_unidade_id JOIN unidades ud ON ud.id = pud.unidade_id WHERE mt.public_id = ? FOR UPDATE`,
    [publicId],
    connection,
  );
  if (!row) throw new NotFoundError("Transferência não encontrada.");
  return row;
}

export async function analyzeTransferAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  const decision = text(formData, "decision");
  try {
    uuid.parse(publicId);
    if (!["approve", "reject"].includes(decision))
      throw new ConflictError("Decisão inválida.");
    const { user } = await requirePermission(PERMISSIONS.TRANSFERS_APPROVE);
    await withTransaction(async (connection) => {
      const transfer = await lockTransfer(publicId, connection);
      assertPermission(
        user,
        PERMISSIONS.TRANSFERS_APPROVE,
        transfer.origin_unit_id,
      );
      assertPermission(
        user,
        PERMISSIONS.TRANSFERS_APPROVE,
        transfer.destination_unit_id,
      );
      if (transfer.status !== "SOLICITADA")
        throw new ConflictError("Esta solicitação já foi analisada.");
      const status = decision === "approve" ? "APROVADA" : "RECUSADA";
      await execute(
        "UPDATE matriculas_transferencias SET status = ?, analisada_por = ?, analisada_em = UTC_TIMESTAMP(6) WHERE id = ?",
        [status, user.id, transfer.id],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: `TRANSFERENCIA_${status}`,
        entity: "MATRICULA_TRANSFERENCIA",
        entityId: transfer.id,
        entityPublicId: publicId,
        context,
        connection,
      });
    });
  } catch (error) {
    console.error("Falha ao analisar transferência", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(
      `/transferencias/${publicId}?error=${encodeURIComponent(failure)}`,
    );
  redirect(
    `/transferencias/${publicId}?success=${encodeURIComponent(decision === "approve" ? "Transferência aprovada. Agora ela pode ser efetivada." : "Transferência recusada.")}`,
  );
}

export async function effectTransferAction(formData: FormData): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    uuid.parse(publicId);
    const { user } = await requirePermission(PERMISSIONS.TRANSFERS_APPROVE);
    await withTransaction(async (connection) => {
      const transfer = await lockTransfer(publicId, connection);
      assertPermission(
        user,
        PERMISSIONS.TRANSFERS_APPROVE,
        transfer.origin_unit_id,
      );
      assertPermission(
        user,
        PERMISSIONS.TRANSFERS_APPROVE,
        transfer.destination_unit_id,
      );
      if (transfer.status !== "APROVADA")
        throw new ConflictError("A transferência precisa estar aprovada.");
      const current = await queryOne<Duplicate>(
        "SELECT vinculo_id AS id FROM matriculas_vinculo_atual WHERE matricula_id = ? FOR UPDATE",
        [transfer.registration_id],
        connection,
      );
      if (!current || current.id !== transfer.origin_link_id)
        throw new ConflictError(
          "O vínculo atual mudou depois da solicitação. Cancele e refaça a transferência.",
        );
      await execute(
        "UPDATE matriculas_vinculos SET data_fim = UTC_DATE(), motivo_fim = ? WHERE id = ? AND data_fim IS NULL",
        [`Transferência: ${transfer.reason}`, transfer.origin_link_id],
        connection,
      );
      const targetLink = await execute(
        "INSERT INTO matriculas_vinculos (matricula_id, programa_unidade_id, turma_id, data_inicio, criado_por) VALUES (?, ?, ?, UTC_DATE(), ?)",
        [
          transfer.registration_id,
          transfer.destination_program_unit_id,
          transfer.destination_class_id,
          user.id,
        ],
        connection,
      );
      const targetLinkId = String(targetLink.insertId);
      await execute(
        "UPDATE matriculas_vinculo_atual SET vinculo_id = ? WHERE matricula_id = ?",
        [targetLinkId, transfer.registration_id],
        connection,
      );
      await execute(
        "UPDATE matriculas_transferencias SET status = 'EFETIVADA', destino_vinculo_id = ?, efetivada_por = ?, efetivada_em = UTC_TIMESTAMP(6) WHERE id = ?",
        [targetLinkId, user.id, transfer.id],
        connection,
      );
      await execute(
        `INSERT INTO participantes_historico (public_id, participante_id, matricula_id, tipo_evento, resumo, detalhes_json, usuario_id) VALUES (?, ?, ?, 'TRANSFERENCIA_EFETIVADA', 'Transferência de unidade efetivada.', ?, ?)`,
        [
          randomUUID(),
          transfer.participant_id,
          transfer.registration_id,
          JSON.stringify({
            transferPublicId: publicId,
            originUnitId: transfer.origin_unit_id,
            destinationUnitId: transfer.destination_unit_id,
          }),
          user.id,
        ],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: "TRANSFERENCIA_EFETIVADA",
        entity: "MATRICULA_TRANSFERENCIA",
        entityId: transfer.id,
        entityPublicId: publicId,
        metadata: {
          originUnitId: transfer.origin_unit_id,
          destinationUnitId: transfer.destination_unit_id,
        },
        context,
        connection,
      });
    });
  } catch (error) {
    console.error("Falha ao efetivar transferência", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(
      `/transferencias/${publicId}?error=${encodeURIComponent(failure)}`,
    );
  redirect(
    `/transferencias/${publicId}?success=${encodeURIComponent("Transferência efetivada e registrada no histórico.")}`,
  );
}
