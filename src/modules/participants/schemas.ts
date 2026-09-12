import { z } from "zod";

export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let digit = 9; digit < 11; digit += 1) {
    let sum = 0;
    for (let index = 0; index < digit; index += 1)
      sum += Number(cpf[index]) * (digit + 1 - index);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[digit])) return false;
  }
  return true;
}

const optionalCpf = z
  .string()
  .trim()
  .max(18)
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => !value || isValidCpf(value), "CPF inválido.");

export const participantCreateSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(180),
  socialName: z.string().trim().max(180).optional().default(""),
  birthDate: z.iso.date("Informe uma data de nascimento válida."),
  gender: z.enum(["FEMININO", "MASCULINO", "OUTRO", "NAO_INFORMADO"]),
  cpf: optionalCpf,
  bloodType: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  guardianName: z
    .string()
    .trim()
    .min(3, "Informe o nome do responsável.")
    .max(180),
  relationship: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),
  guardianPhone: z.string().trim().min(10).max(30),
  guardianEmail: z.union([z.literal(""), z.email().max(254)]),
  programUnit: z.string().min(73).max(73),
  classPublicId: z.union([z.literal(""), z.uuid()]),
  enrollmentDate: z.iso.date(),
  legalGuardian: z.boolean(),
  pickupAuthorized: z.boolean(),
  whatsappConsent: z.boolean(),
});

export type ParticipantCreateInput = z.infer<typeof participantCreateSchema>;
