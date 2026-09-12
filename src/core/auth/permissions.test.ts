import { describe, expect, it } from "vitest";

import { can, permissionScope, PERMISSIONS } from "@/core/auth/permissions";

describe("autorização por escopo", () => {
  it("reconhece uma permissão global", () => {
    const user = {
      globalPermissions: [PERMISSIONS.PARTICIPANTS_VIEW],
      unitPermissions: {},
    };
    expect(permissionScope(user, PERMISSIONS.PARTICIPANTS_VIEW)).toEqual({
      global: true,
      unitIds: [],
    });
    expect(can(user, PERMISSIONS.PARTICIPANTS_VIEW, "99")).toBe(true);
  });

  it("limita uma permissão operacional à unidade concedida", () => {
    const user = {
      globalPermissions: [],
      unitPermissions: { "10": [PERMISSIONS.PARTICIPANTS_VIEW] },
    };
    expect(can(user, PERMISSIONS.PARTICIPANTS_VIEW, "10")).toBe(true);
    expect(can(user, PERMISSIONS.PARTICIPANTS_VIEW, "11")).toBe(false);
  });

  it("nega quando a permissão não foi concedida", () => {
    const user = { globalPermissions: [], unitPermissions: {} };
    expect(can(user, PERMISSIONS.USERS_MANAGE)).toBe(false);
  });
});
