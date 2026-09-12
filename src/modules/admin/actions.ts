"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/core/audit/audit";
import { hashPassword } from "@/core/auth/password";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { execute, queryOne, type RowDataPacket } from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
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
function code(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}
type IdRow = RowDataPacket & { id: string };
type ProgramUnit = RowDataPacket & {
  id: string;
  program_id: string;
  unit_id: string;
};
async function runAdminAction(
  returnPath: string,
  action: (
    userId: string,
    context: Awaited<ReturnType<typeof getRequestContext>>,
  ) => Promise<void>,
): Promise<never> {
  const context = await getRequestContext();
  let failure: string | null = null;
  try {
    const { user } = await requirePermission(
      returnPath.includes("usuarios")
        ? PERMISSIONS.USERS_MANAGE
        : PERMISSIONS.UNITS_MANAGE,
    );
    await action(user.id, context);
  } catch (error) {
    console.error("Falha administrativa", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure) redirect(`${returnPath}?error=${encodeURIComponent(failure)}`);
  redirect(
    `${returnPath}?success=${encodeURIComponent("Alteração salva com sucesso.")}`,
  );
}

export async function createUnitAction(formData: FormData): Promise<never> {
  return runAdminAction("/configuracoes/unidades", async (userId, context) => {
    const unitCode = z
      .string()
      .min(2)
      .max(30)
      .parse(code(text(formData, "code")));
    const name = z.string().min(3).max(180).parse(text(formData, "name"));
    const acronym = z.string().max(30).parse(text(formData, "acronym"));
    const city = z.string().max(100).parse(text(formData, "city"));
    const state = text(formData, "state").toUpperCase();
    if (state && !/^[A-Z]{2}$/.test(state))
      throw new ConflictError("UF inválida.");
    const publicId = randomUUID();
    const result = await execute(
      "INSERT INTO unidades (public_id, codigo, nome, sigla, tipo, cidade, uf) VALUES (?, ?, ?, ?, 'UNIDADE', ?, ?)",
      [publicId, unitCode, name, acronym || null, city || null, state || null],
    );
    await auditEvent({
      userId,
      action: "UNIDADE_CRIADA",
      entity: "UNIDADE",
      entityId: String(result.insertId),
      entityPublicId: publicId,
      context,
    });
  });
}

export async function createProgramAction(formData: FormData): Promise<never> {
  return runAdminAction("/configuracoes/unidades", async (userId, context) => {
    const programCode = z
      .string()
      .min(2)
      .max(30)
      .parse(code(text(formData, "code")));
    const name = z.string().min(3).max(150).parse(text(formData, "name"));
    const minText = text(formData, "minAge");
    const maxText = text(formData, "maxAge");
    const min = minText
      ? z.coerce.number().int().min(0).max(120).parse(minText)
      : null;
    const max = maxText
      ? z.coerce.number().int().min(0).max(120).parse(maxText)
      : null;
    if (min !== null && max !== null && min > max)
      throw new ConflictError("A idade mínima não pode superar a máxima.");
    const publicId = randomUUID();
    const result = await execute(
      "INSERT INTO programas (public_id, codigo, nome, idade_minima, idade_maxima) VALUES (?, ?, ?, ?, ?)",
      [publicId, programCode, name, min, max],
    );
    await auditEvent({
      userId,
      action: "PROGRAMA_CRIADO",
      entity: "PROGRAMA",
      entityId: String(result.insertId),
      entityPublicId: publicId,
      context,
    });
  });
}

export async function linkProgramUnitAction(
  formData: FormData,
): Promise<never> {
  return runAdminAction("/configuracoes/unidades", async (userId, context) => {
    const programPublicId = z.uuid().parse(text(formData, "programPublicId"));
    const unitPublicId = z.uuid().parse(text(formData, "unitPublicId"));
    const startDate = z.iso.date().parse(text(formData, "startDate"));
    const program = await queryOne<IdRow>(
      "SELECT id FROM programas WHERE public_id = ? AND ativo = 1",
      [programPublicId],
    );
    const unit = await queryOne<IdRow>(
      "SELECT id FROM unidades WHERE public_id = ? AND ativo = 1",
      [unitPublicId],
    );
    if (!program || !unit)
      throw new NotFoundError("Programa ou unidade não encontrado.");
    const result = await execute(
      "INSERT INTO programas_unidades (programa_id, unidade_id, data_inicio) VALUES (?, ?, ?)",
      [program.id, unit.id, startDate],
    );
    await auditEvent({
      userId,
      action: "PROGRAMA_VINCULADO_UNIDADE",
      entity: "PROGRAMA_UNIDADE",
      entityId: String(result.insertId),
      metadata: { programId: program.id, unitId: unit.id },
      context,
    });
  });
}

export async function createClassAction(formData: FormData): Promise<never> {
  return runAdminAction("/configuracoes/unidades", async (userId, context) => {
    const [programPublicId, unitPublicId] = text(formData, "programUnit").split(
      ":",
    );
    z.uuid().parse(programPublicId);
    z.uuid().parse(unitPublicId);
    const pu = await queryOne<ProgramUnit>(
      `SELECT pu.id, pu.programa_id AS program_id, pu.unidade_id AS unit_id FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND u.public_id = ? AND pu.ativo = 1`,
      [programPublicId, unitPublicId],
    );
    if (!pu)
      throw new NotFoundError(
        "Vínculo entre programa e unidade não encontrado.",
      );
    const classCode = z
      .string()
      .min(1)
      .max(40)
      .parse(code(text(formData, "code")));
    const name = z.string().min(2).max(120).parse(text(formData, "name"));
    const year = z.coerce
      .number()
      .int()
      .min(2000)
      .max(2200)
      .parse(text(formData, "year"));
    const shift = z
      .enum(["MATUTINO", "VESPERTINO", "NOTURNO", "INTEGRAL", "OUTRO"])
      .parse(text(formData, "shift"));
    const capacityText = text(formData, "capacity");
    const capacity = capacityText
      ? z.coerce.number().int().min(1).max(5000).parse(capacityText)
      : null;
    const startDate = z.iso.date().parse(text(formData, "startDate"));
    const publicId = randomUUID();
    const result = await execute(
      "INSERT INTO turmas (public_id, programa_unidade_id, codigo, nome, ano_referencia, turno_codigo, capacidade, data_inicio, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ATIVA')",
      [publicId, pu.id, classCode, name, year, shift, capacity, startDate],
    );
    await auditEvent({
      userId,
      action: "TURMA_CRIADA",
      entity: "TURMA",
      entityId: String(result.insertId),
      entityPublicId: publicId,
      metadata: { unitId: pu.unit_id, programId: pu.program_id },
      context,
    });
  });
}

export async function createActivityOfferAction(
  formData: FormData,
): Promise<never> {
  return runAdminAction("/configuracoes/unidades", async (userId, context) => {
    const [programPublicId, unitPublicId] = text(formData, "programUnit").split(
      ":",
    );
    z.uuid().parse(programPublicId);
    z.uuid().parse(unitPublicId);
    const pu = await queryOne<ProgramUnit>(
      `SELECT pu.id, pu.programa_id AS program_id, pu.unidade_id AS unit_id FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND u.public_id = ? AND pu.ativo = 1`,
      [programPublicId, unitPublicId],
    );
    if (!pu) throw new NotFoundError("Programa e unidade não encontrados.");
    const activityCode = z
      .string()
      .min(1)
      .max(40)
      .parse(code(text(formData, "code")));
    const name = z.string().min(2).max(180).parse(text(formData, "name"));
    const classPublicId = text(formData, "classPublicId");
    if (classPublicId) z.uuid().parse(classPublicId);
    const classRow = classPublicId
      ? await queryOne<IdRow>(
          "SELECT id FROM turmas WHERE public_id = ? AND programa_unidade_id = ?",
          [classPublicId, pu.id],
        )
      : null;
    if (classPublicId && !classRow)
      throw new ConflictError("A turma não pertence ao vínculo selecionado.");
    const startDate = z.iso.date().parse(text(formData, "startDate"));
    await withTransaction(async (connection) => {
      let activity = await queryOne<IdRow>(
        "SELECT id FROM atividades WHERE programa_id = ? AND codigo = ?",
        [pu.program_id, activityCode],
        connection,
      );
      if (!activity) {
        const inserted = await execute(
          "INSERT INTO atividades (public_id, programa_id, codigo, nome, criado_por) VALUES (?, ?, ?, ?, ?)",
          [randomUUID(), pu.program_id, activityCode, name, userId],
          connection,
        );
        activity = { id: String(inserted.insertId) } as IdRow;
      }
      const publicId = randomUUID();
      const offer = await execute(
        "INSERT INTO atividades_ofertas (public_id, atividade_id, programa_unidade_id, turma_id, data_inicio, status, criado_por) VALUES (?, ?, ?, ?, ?, 'ATIVA', ?)",
        [publicId, activity.id, pu.id, classRow?.id ?? null, startDate, userId],
        connection,
      );
      await auditEvent({
        userId,
        action: "ATIVIDADE_OFERTA_CRIADA",
        entity: "ATIVIDADE_OFERTA",
        entityId: String(offer.insertId),
        entityPublicId: publicId,
        metadata: { unitId: pu.unit_id, programId: pu.program_id },
        context,
        connection,
      });
    });
  });
}

export async function createUserAction(formData: FormData): Promise<never> {
  return runAdminAction("/configuracoes/usuarios", async (userId, context) => {
    const name = z.string().min(3).max(180).parse(text(formData, "name"));
    const login = z
      .string()
      .regex(/^[a-zA-Z0-9._-]{3,80}$/)
      .transform((value) => value.toLowerCase())
      .parse(text(formData, "login"));
    const email = z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .parse(text(formData, "email"));
    const password = z
      .string()
      .min(14)
      .max(200)
      .parse(text(formData, "password"));
    const roleCode = z
      .string()
      .min(2)
      .max(50)
      .parse(text(formData, "roleCode"));
    const unitPublicId = text(formData, "unitPublicId");
    if (unitPublicId) z.uuid().parse(unitPublicId);
    if (roleCode !== "ADMINISTRADOR" && !unitPublicId)
      throw new ConflictError(
        "Papéis operacionais devem ser limitados a uma unidade.",
      );
    const role = await queryOne<IdRow>(
      "SELECT id FROM papeis WHERE codigo = ?",
      [roleCode],
    );
    const unit = unitPublicId
      ? await queryOne<IdRow>(
          "SELECT id FROM unidades WHERE public_id = ? AND ativo = 1",
          [unitPublicId],
        )
      : null;
    if (!role || (unitPublicId && !unit))
      throw new NotFoundError("Papel ou unidade não encontrado.");
    const passwordHash = await hashPassword(password);
    const publicId = randomUUID();
    await withTransaction(async (connection) => {
      const person = await execute(
        "INSERT INTO pessoas (public_id, nome) VALUES (?, ?)",
        [randomUUID(), name],
        connection,
      );
      const user = await execute(
        "INSERT INTO usuarios (public_id, pessoa_id, unidade_id, login, email_login, senha_hash) VALUES (?, ?, ?, ?, ?, ?)",
        [
          publicId,
          String(person.insertId),
          unit?.id ?? null,
          login,
          email,
          passwordHash,
        ],
        connection,
      );
      const newUserId = String(user.insertId);
      if (roleCode === "ADMINISTRADOR") {
        await execute(
          "INSERT INTO usuarios_papeis (usuario_id, papel_id, concedido_por) VALUES (?, ?, ?)",
          [newUserId, role.id, userId],
          connection,
        );
      } else {
        if (!unit)
          throw new ConflictError(
            "Selecione a unidade do usuário operacional.",
          );
        await execute(
          "INSERT INTO usuarios_papeis_unidades (usuario_id, papel_id, unidade_id, concedido_por) VALUES (?, ?, ?, ?)",
          [newUserId, role.id, unit.id, userId],
          connection,
        );
      }
      await auditEvent({
        userId,
        action: "USUARIO_CRIADO",
        entity: "USUARIO",
        entityId: newUserId,
        entityPublicId: publicId,
        metadata: { roleCode, unitId: unit?.id ?? null },
        context,
        connection,
      });
    });
  });
}

export async function changeUserStatusAction(
  formData: FormData,
): Promise<never> {
  return runAdminAction("/configuracoes/usuarios", async (userId, context) => {
    const publicId = z.uuid().parse(text(formData, "publicId"));
    const status = z
      .enum(["ATIVO", "BLOQUEADO", "INATIVO"])
      .parse(text(formData, "status"));
    const target = await queryOne<IdRow>(
      "SELECT id FROM usuarios WHERE public_id = ? AND excluido_em IS NULL",
      [publicId],
    );
    if (!target) throw new NotFoundError("Usuário não encontrado.");
    if (target.id === userId && status !== "ATIVO")
      throw new ConflictError(
        "Você não pode bloquear ou inativar a própria conta.",
      );
    await withTransaction(async (connection) => {
      await execute(
        "UPDATE usuarios SET status = ?, bloqueado_ate = NULL WHERE id = ?",
        [status, target.id],
        connection,
      );
      if (status !== "ATIVO")
        await execute(
          "UPDATE usuarios_sessoes SET revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = 'STATUS_ALTERADO' WHERE usuario_id = ? AND revogado_em IS NULL",
          [target.id],
          connection,
        );
      await auditEvent({
        userId,
        action: "USUARIO_STATUS_ALTERADO",
        entity: "USUARIO",
        entityId: target.id,
        entityPublicId: publicId,
        metadata: { status },
        context,
        connection,
      });
    });
  });
}
