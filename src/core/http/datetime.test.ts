import { describe, expect, it } from "vitest";

import { localDateTimeToUtc } from "@/core/http/datetime";

describe("datas institucionais", () => {
  it("mantém o horário quando a zona é UTC", () => {
    expect(localDateTimeToUtc("2026-09-12T10:30", "UTC")).toBe(
      "2026-09-12 10:30:00",
    );
  });

  it("converte America/Sao_Paulo para UTC", () => {
    expect(localDateTimeToUtc("2026-09-12T10:30", "America/Sao_Paulo")).toBe(
      "2026-09-12 13:30:00",
    );
  });

  it("recusa um formato incompleto", () => {
    expect(() => localDateTimeToUtc("12/09/2026", "UTC")).toThrow(
      "Data e hora inválidas",
    );
  });
});
