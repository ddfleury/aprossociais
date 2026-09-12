import { AuthorizationError } from "@/core/security/errors";

export const PERMISSIONS = {
  USERS_MANAGE: "USUARIOS_GERENCIAR",
  AUDIT_VIEW: "AUDITORIA_VISUALIZAR",
  UNITS_MANAGE: "UNIDADES_GERENCIAR",
  PARTICIPANTS_VIEW: "PARTICIPANTES_VISUALIZAR",
  PARTICIPANTS_CREATE: "PARTICIPANTES_CADASTRAR",
  PARTICIPANTS_EDIT: "PARTICIPANTES_EDITAR",
  SENSITIVE_VIEW: "DADOS_SENSIVEIS_VISUALIZAR",
  SENSITIVE_EDIT: "DADOS_SENSIVEIS_EDITAR",
  REGISTRATIONS_MANAGE: "MATRICULAS_GERENCIAR",
  TRANSFERS_REQUEST: "TRANSFERENCIAS_SOLICITAR",
  TRANSFERS_APPROVE: "TRANSFERENCIAS_APROVAR",
  DOCUMENTS_VIEW: "DOCUMENTOS_VISUALIZAR",
  DOCUMENTS_MANAGE: "DOCUMENTOS_GERENCIAR",
  CURRICULUM_MANAGE: "CURRICULO_GERENCIAR",
  LESSON_PLANS_MANAGE: "PLANOS_GERENCIAR",
  ATTENDANCE_RECORD: "FREQUENCIA_REGISTRAR",
  ATTENDANCE_REPORTS: "FREQUENCIA_RELATORIOS",
  ASSESSMENTS_MANAGE: "AVALIACOES_GERENCIAR",
  EVENTS_MANAGE: "EVENTOS_GERENCIAR",
  COMMUNICATIONS_CREATE: "COMUNICACOES_CRIAR",
  COMMUNICATIONS_SEND: "COMUNICACOES_ENVIAR",
  CERTIFICATES_ISSUE: "CERTIFICADOS_EMITIR",
  CERTIFICATES_REVOKE: "CERTIFICADOS_REVOGAR",
  VERIFICATIONS_ANALYZE: "VERIFICACOES_ANALISAR",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionScope = {
  global: boolean;
  unitIds: string[];
};

export type PermissionAwareUser = {
  globalPermissions: string[];
  unitPermissions: Record<string, string[]>;
};

export function permissionScope(
  user: PermissionAwareUser,
  permission: PermissionCode,
): PermissionScope {
  if (user.globalPermissions.includes(permission))
    return { global: true, unitIds: [] };
  const unitIds = Object.entries(user.unitPermissions)
    .filter(([, permissions]) => permissions.includes(permission))
    .map(([unitId]) => unitId);
  return { global: false, unitIds };
}

export function assertPermission(
  user: PermissionAwareUser,
  permission: PermissionCode,
  unitId?: string,
): PermissionScope {
  const scope = permissionScope(user, permission);
  if (scope.global) return scope;
  if (unitId && scope.unitIds.includes(unitId)) return scope;
  if (!unitId && scope.unitIds.length > 0) return scope;
  throw new AuthorizationError();
}

export function can(
  user: PermissionAwareUser,
  permission: PermissionCode,
  unitId?: string,
): boolean {
  try {
    assertPermission(user, permission, unitId);
    return true;
  } catch {
    return false;
  }
}
