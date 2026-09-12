import { describe, expect, it } from "vitest";

import {
  isValidCpf,
  participantCreateSchema,
} from "@/modules/participants/schemas";

describe("cadastro de participante", () => {
  it("valida os dígitos verificadores do CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("normaliza CPF e parentesco", () => {
    const result = participantCreateSchema.safeParse({
      name: "Participante Exemplo",
      socialName: "",
      birthDate: "2015-04-20",
      gender: "FEMININO",
      cpf: "529.982.247-25",
      bloodType: "O+",
      guardianName: "Responsável Exemplo",
      relationship: "mãe",
      guardianPhone: "(61) 99999-9999",
      guardianEmail: "",
      programUnit: `${"a".repeat(36)}:${"b".repeat(36)}`,
      classPublicId: "",
      enrollmentDate: "2026-02-01",
      legalGuardian: true,
      pickupAuthorized: true,
      whatsappConsent: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cpf).toBe("52998224725");
      expect(result.data.relationship).toBe("MÃE");
    }
  });
});
