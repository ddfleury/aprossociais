"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auditEvent } from "@/core/audit/audit";
import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { encryptText } from "@/core/crypto/sensitive";
import {
  hmac,
  maskEmail,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  sha256,
} from "@/core/crypto/hash";
import {
  execute,
  queryOne,
  type PoolConnection,
  type RowDataPacket,
} from "@/core/db/pool";
import { withTransaction } from "@/core/db/transaction";
import { getRequestContext } from "@/core/http/request-context";
import { ConflictError, publicErrorMessage } from "@/core/security/errors";
import {
  WHATSAPP_CONSENT_TEXT,
  WHATSAPP_CONSENT_VERSION,
} from "@/modules/participants/consent";
import { participantCreateSchema } from "@/modules/participants/schemas";

type ProgramUnit = RowDataPacket & {
  id: string;
  program_id: string;
  unit_id: string;
  program_name: string;
  unit_name: string;
};
type ClassRow = RowDataPacket & { id: string };
type ExistingPerson = RowDataPacket & { id: string };
type EditableParticipant = RowDataPacket & {
  id: string;
  person_id: string;
  unit_id: string;
  guardian_person_id: string | null;
  whatsapp_consent: number;
};
type ConsentType = RowDataPacket & { id: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function recordWhatsAppConsent(input: {
  connection: PoolConnection;
  participantId: string;
  responsiblePersonId: string | null;
  granted: boolean;
  userId: string;
  context: Awaited<ReturnType<typeof getRequestContext>>;
}): Promise<void> {
  const consentType = await queryOne<ConsentType>(
    "SELECT id FROM consentimentos_tipos WHERE codigo = 'COMUNICACAO_WHATSAPP' AND ativo = 1 LIMIT 1",
    [],
    input.connection,
  );
  if (!consentType)
    throw new ConflictError(
      "O tipo de consentimento para WhatsApp não está configurado no banco.",
    );

  // O registro anterior é encerrado, e não apagado, para manter a auditoria.
  await execute(
    `UPDATE consentimentos
        SET revogado_em = UTC_TIMESTAMP(6)
      WHERE participante_id = ? AND tipo_id = ?
        AND concedido = 1 AND revogado_em IS NULL`,
    [input.participantId, consentType.id],
    input.connection,
  );
  await execute(
    `INSERT INTO consentimentos
      (public_id, participante_id, tipo_id, responsavel_pessoa_id,
       versao_termo, concedido, concedido_em, evidencia_hash, ip,
       user_agent, registrado_por)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6), ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.participantId,
      consentType.id,
      input.responsiblePersonId,
      WHATSAPP_CONSENT_VERSION,
      input.granted ? 1 : 0,
      sha256(`${WHATSAPP_CONSENT_VERSION}\n${WHATSAPP_CONSENT_TEXT}`),
      input.context.ip,
      input.context.userAgent,
      input.userId,
    ],
    input.connection,
  );
}

export async function createParticipantAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  let resultPublicId: string | null = null;
  let errorMessage: string | null = null;
  try {
    const parsed = participantCreateSchema.safeParse({
      name: text(formData, "name"),
      socialName: text(formData, "socialName"),
      birthDate: text(formData, "birthDate"),
      gender: text(formData, "gender"),
      cpf: text(formData, "cpf"),
      bloodType: text(formData, "bloodType"),
      guardianName: text(formData, "guardianName"),
      relationship: text(formData, "relationship"),
      guardianPhone: text(formData, "guardianPhone"),
      guardianEmail: text(formData, "guardianEmail"),
      programUnit: text(formData, "programUnit"),
      classPublicId: text(formData, "classPublicId"),
      enrollmentDate: text(formData, "enrollmentDate"),
      legalGuardian: formData.get("legalGuardian") === "on",
      pickupAuthorized: formData.get("pickupAuthorized") === "on",
      whatsappConsent: formData.get("whatsappConsent") === "on",
    });
    if (!parsed.success)
      throw new ConflictError(
        parsed.error.issues[0]?.message ?? "Revise os dados informados.",
      );
    if (new Date(`${parsed.data.birthDate}T00:00:00Z`) > new Date())
      throw new ConflictError("A data de nascimento não pode estar no futuro.");
    const [programPublicId, unitPublicId] = parsed.data.programUnit.split(":");
    z.uuid().parse(programPublicId);
    z.uuid().parse(unitPublicId);
    const programUnit = await queryOne<ProgramUnit>(
      `SELECT pu.id, pu.programa_id AS program_id, pu.unidade_id AS unit_id, pr.nome AS program_name, u.nome AS unit_name FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pr.public_id = ? AND u.public_id = ? AND pu.ativo = 1 AND pr.ativo = 1 AND u.ativo = 1 LIMIT 1`,
      [programPublicId, unitPublicId],
    );
    if (!programUnit)
      throw new ConflictError(
        "Programa e unidade selecionados não estão disponíveis.",
      );
    const { user } = await requirePermission(
      PERMISSIONS.PARTICIPANTS_CREATE,
      programUnit.unit_id,
    );
    const classRow = parsed.data.classPublicId
      ? await queryOne<ClassRow>(
          "SELECT id FROM turmas WHERE public_id = ? AND programa_unidade_id = ? AND status = 'ATIVA' LIMIT 1",
          [parsed.data.classPublicId, programUnit.id],
        )
      : null;
    if (parsed.data.classPublicId && !classRow)
      throw new ConflictError(
        "A turma selecionada não pertence ao programa e à unidade.",
      );

    resultPublicId = await withTransaction(async (connection) => {
      const participantPublicId = randomUUID();
      const cpfHash = parsed.data.cpf ? hmac(parsed.data.cpf) : null;
      if (cpfHash) {
        const duplicate = await queryOne<ExistingPerson>(
          "SELECT id FROM pessoas WHERE cpf_busca = ? AND excluido_em IS NULL LIMIT 1",
          [cpfHash],
          connection,
        );
        if (duplicate)
          throw new ConflictError(
            "Já existe uma pessoa cadastrada com este CPF.",
          );
      }
      const person = await execute(
        `INSERT INTO pessoas (public_id, nome, nome_social, data_nascimento, sexo_codigo, cpf_cifrado, cpf_busca, cpf_ultimos4) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          parsed.data.name,
          parsed.data.socialName || null,
          parsed.data.birthDate,
          parsed.data.gender,
          parsed.data.cpf ? encryptText(parsed.data.cpf) : null,
          cpfHash,
          parsed.data.cpf ? parsed.data.cpf.slice(-4) : null,
        ],
        connection,
      );
      const personId = String(person.insertId);
      const participant = await execute(
        "INSERT INTO participantes (public_id, pessoa_id, tipo_sanguineo) VALUES (?, ?, ?)",
        [participantPublicId, personId, parsed.data.bloodType || null],
        connection,
      );
      const participantId = String(participant.insertId);
      const phone = normalizePhone(parsed.data.guardianPhone);
      const phoneHash = hmac(phone);
      let responsibleId = (
        await queryOne<ExistingPerson>(
          `SELECT p.id FROM pessoas p JOIN pessoas_contatos pc ON pc.pessoa_id = p.id AND pc.valor_busca = ? AND pc.tipo = 'TELEFONE' AND pc.excluido_em IS NULL WHERE p.nome = ? AND p.excluido_em IS NULL LIMIT 1`,
          [phoneHash, parsed.data.guardianName],
          connection,
        )
      )?.id;
      if (!responsibleId) {
        const responsible = await execute(
          "INSERT INTO pessoas (public_id, nome) VALUES (?, ?)",
          [randomUUID(), parsed.data.guardianName],
          connection,
        );
        responsibleId = String(responsible.insertId);
        await execute(
          `INSERT INTO pessoas_contatos (pessoa_id, tipo, rotulo, valor_cifrado, valor_busca, valor_mascarado, principal, permite_whatsapp) VALUES (?, 'TELEFONE', 'Principal', ?, ?, ?, 1, 1)`,
          [responsibleId, encryptText(phone), phoneHash, maskPhone(phone)],
          connection,
        );
        if (parsed.data.guardianEmail) {
          const email = normalizeEmail(parsed.data.guardianEmail);
          await execute(
            `INSERT INTO pessoas_contatos (pessoa_id, tipo, rotulo, valor_cifrado, valor_busca, valor_mascarado, principal, permite_whatsapp) VALUES (?, 'EMAIL', 'Principal', ?, ?, ?, 0, 0)`,
            [responsibleId, encryptText(email), hmac(email), maskEmail(email)],
            connection,
          );
        }
      }
      const relation = await execute(
        `INSERT INTO participantes_responsaveis (participante_id, responsavel_pessoa_id, parentesco_codigo, responsavel_legal, autorizado_retirada, valido_desde, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          participantId,
          responsibleId,
          parsed.data.relationship,
          parsed.data.legalGuardian ? 1 : 0,
          parsed.data.pickupAuthorized ? 1 : 0,
          parsed.data.enrollmentDate,
          user.id,
        ],
        connection,
      );
      await execute(
        "INSERT INTO participantes_responsavel_principal (participante_id, participante_responsavel_id) VALUES (?, ?)",
        [participantId, String(relation.insertId)],
        connection,
      );
      await recordWhatsAppConsent({
        connection,
        participantId,
        responsiblePersonId: responsibleId,
        granted: parsed.data.whatsappConsent,
        userId: user.id,
        context,
      });
      const registrationNumber = `AP-${new Date().getUTCFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      const registration = await execute(
        `INSERT INTO matriculas (public_id, numero, participante_id, programa_id, data_matricula, status, criado_por) VALUES (?, ?, ?, ?, ?, 'ATIVA', ?)`,
        [
          randomUUID(),
          registrationNumber,
          participantId,
          programUnit.program_id,
          parsed.data.enrollmentDate,
          user.id,
        ],
        connection,
      );
      const registrationId = String(registration.insertId);
      const link = await execute(
        "INSERT INTO matriculas_vinculos (matricula_id, programa_unidade_id, turma_id, data_inicio, criado_por) VALUES (?, ?, ?, ?, ?)",
        [
          registrationId,
          programUnit.id,
          classRow?.id ?? null,
          parsed.data.enrollmentDate,
          user.id,
        ],
        connection,
      );
      await execute(
        "INSERT INTO matriculas_vinculo_atual (matricula_id, vinculo_id) VALUES (?, ?)",
        [registrationId, String(link.insertId)],
        connection,
      );
      await execute(
        `INSERT INTO participantes_historico (public_id, participante_id, matricula_id, tipo_evento, resumo, detalhes_json, usuario_id) VALUES (?, ?, ?, 'CADASTRO_INICIAL', ?, ?, ?)`,
        [
          randomUUID(),
          participantId,
          registrationId,
          "Participante cadastrado e vinculado ao programa.",
          JSON.stringify({
            program: programUnit.program_name,
            unit: programUnit.unit_name,
            registration: registrationNumber,
            whatsappConsent: parsed.data.whatsappConsent,
          }),
          user.id,
        ],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: "PARTICIPANTE_CRIADO",
        entity: "PARTICIPANTE",
        entityId: participantId,
        entityPublicId: participantPublicId,
        metadata: {
          unitId: programUnit.unit_id,
          programId: programUnit.program_id,
        },
        context,
        connection,
      });
      return participantPublicId;
    });
  } catch (error) {
    console.error("Falha ao cadastrar participante", {
      requestId: context.requestId,
      error,
    });
    errorMessage = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (errorMessage)
    redirect(`/participantes/novo?error=${encodeURIComponent(errorMessage)}`);
  redirect(
    `/participantes/${resultPublicId}?success=${encodeURIComponent("Cadastro realizado com sucesso.")}`,
  );
}

export async function updateParticipantAction(
  formData: FormData,
): Promise<void> {
  const context = await getRequestContext();
  const publicId = text(formData, "publicId");
  let failure: string | null = null;
  try {
    z.uuid().parse(publicId);
    const name = z
      .string()
      .trim()
      .min(3)
      .max(180)
      .parse(text(formData, "name"));
    const socialName = z
      .string()
      .trim()
      .max(180)
      .parse(text(formData, "socialName"));
    const birthDate = z.iso.date().parse(text(formData, "birthDate"));
    if (new Date(`${birthDate}T00:00:00Z`) > new Date())
      throw new ConflictError("A data de nascimento não pode estar no futuro.");
    const gender = z
      .enum(["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"])
      .parse(text(formData, "gender"));
    const bloodType = z
      .enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .parse(text(formData, "bloodType"));
    const active = formData.get("active") === "on";
    const whatsappConsent = formData.get("whatsappConsent") === "on";
    const { user, scope } = await requirePermission(
      PERMISSIONS.PARTICIPANTS_EDIT,
    );
    const scopeClause = scope.global
      ? ""
      : ` AND u.id IN (${scope.unitIds.map(() => "?").join(",")})`;

    await withTransaction(async (connection) => {
      const participant = await queryOne<EditableParticipant>(
        `SELECT pt.id, pt.pessoa_id AS person_id, u.id AS unit_id,
                pr.responsavel_pessoa_id AS guardian_person_id,
                IF(EXISTS (
                  SELECT 1
                    FROM consentimentos c
                    JOIN consentimentos_tipos ct ON ct.id = c.tipo_id
                   WHERE c.participante_id = pt.id
                     AND ct.codigo = 'COMUNICACAO_WHATSAPP'
                     AND c.concedido = 1 AND c.revogado_em IS NULL
                ), 1, 0) AS whatsapp_consent
           FROM participantes pt
           JOIN matriculas m ON m.participante_id = pt.id AND m.status = 'ATIVA'
           JOIN matriculas_vinculo_atual mva ON mva.matricula_id = m.id
           JOIN matriculas_vinculos mv ON mv.id = mva.vinculo_id
           JOIN programas_unidades pu ON pu.id = mv.programa_unidade_id
           JOIN unidades u ON u.id = pu.unidade_id
           LEFT JOIN participantes_responsavel_principal prp
             ON prp.participante_id = pt.id
           LEFT JOIN participantes_responsaveis pr
             ON pr.id = prp.participante_responsavel_id
          WHERE pt.public_id = ? AND pt.excluido_em IS NULL${scopeClause}
          ORDER BY m.id LIMIT 1 FOR UPDATE`,
        [publicId, ...scope.unitIds],
        connection,
      );
      if (!participant)
        throw new ConflictError(
          "Participante não encontrado no seu escopo de edição.",
        );
      await execute(
        "UPDATE pessoas SET nome = ?, nome_social = ?, data_nascimento = ?, sexo_codigo = ? WHERE id = ?",
        [name, socialName || null, birthDate, gender, participant.person_id],
        connection,
      );
      await execute(
        "UPDATE participantes SET tipo_sanguineo = ?, ativo = ? WHERE id = ?",
        [bloodType || null, active ? 1 : 0, participant.id],
        connection,
      );
      const consentChanged =
        Boolean(participant.whatsapp_consent) !== whatsappConsent;
      if (consentChanged) {
        await recordWhatsAppConsent({
          connection,
          participantId: participant.id,
          responsiblePersonId: participant.guardian_person_id,
          granted: whatsappConsent,
          userId: user.id,
          context,
        });
      }
      await execute(
        `INSERT INTO participantes_historico
          (public_id, participante_id, tipo_evento, resumo, detalhes_json, usuario_id)
         VALUES (?, ?, 'CADASTRO_ATUALIZADO', ?, ?, ?)`,
        [
          randomUUID(),
          participant.id,
          active
            ? "Dados cadastrais do participante atualizados."
            : "Participante inativado durante atualização cadastral.",
          JSON.stringify({
            active,
            unitId: participant.unit_id,
            whatsappConsent,
            consentChanged,
          }),
          user.id,
        ],
        connection,
      );
      await auditEvent({
        userId: user.id,
        action: active ? "PARTICIPANTE_ATUALIZADO" : "PARTICIPANTE_INATIVADO",
        entity: "PARTICIPANTE",
        entityId: participant.id,
        entityPublicId: publicId,
        metadata: {
          active,
          unitId: participant.unit_id,
          whatsappConsent,
          consentChanged,
        },
        context,
        connection,
      });
    });
  } catch (error) {
    console.error("Falha ao atualizar participante", {
      requestId: context.requestId,
      error,
    });
    failure = `${publicErrorMessage(error)} Protocolo: ${context.requestId}`;
  }
  if (failure)
    redirect(
      `/participantes/${publicId}/editar?error=${encodeURIComponent(failure)}`,
    );
  redirect(
    `/participantes/${publicId}?success=${encodeURIComponent("Cadastro atualizado com histórico preservado.")}`,
  );
}
