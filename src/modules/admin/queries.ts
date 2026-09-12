import "server-only";

import { PERMISSIONS } from "@/core/auth/permissions";
import { requirePermission } from "@/core/auth/session";
import { queryRows, type RowDataPacket } from "@/core/db/pool";

type UnitRow = RowDataPacket & {
  public_id: string;
  code: string;
  name: string;
  acronym: string | null;
  type: string;
  city: string | null;
  state: string | null;
  active: number;
  programs: string | null;
};
type ProgramRow = RowDataPacket & {
  public_id: string;
  code: string;
  name: string;
  min_age: number | null;
  max_age: number | null;
  active: number;
};
type ProgramUnitRow = RowDataPacket & { option_value: string; label: string };
type ClassRow = RowDataPacket & {
  public_id: string;
  code: string;
  name: string;
  unit_name: string;
  program_name: string;
  year: number;
  shift: string;
  capacity: number | null;
  status: string;
};
type UserRow = RowDataPacket & {
  public_id: string;
  name: string;
  login: string;
  email: string;
  unit_name: string | null;
  status: string;
  roles: string | null;
  last_login: string | null;
};
type RoleRow = RowDataPacket & { code: string; name: string };

export async function getStructureData() {
  await requirePermission(PERMISSIONS.UNITS_MANAGE);
  const [units, programs, programUnits, classes] = await Promise.all([
    queryRows<UnitRow>(
      `SELECT u.public_id, u.codigo AS code, u.nome AS name, u.sigla AS acronym, u.tipo AS type, u.cidade AS city, u.uf AS state, u.ativo AS active, GROUP_CONCAT(DISTINCT pr.nome ORDER BY pr.nome SEPARATOR ', ') AS programs FROM unidades u LEFT JOIN programas_unidades pu ON pu.unidade_id = u.id AND pu.ativo = 1 LEFT JOIN programas pr ON pr.id = pu.programa_id WHERE u.excluido_em IS NULL GROUP BY u.id, u.public_id, u.codigo, u.nome, u.sigla, u.tipo, u.cidade, u.uf, u.ativo ORDER BY u.nome`,
    ),
    queryRows<ProgramRow>(
      "SELECT public_id, codigo AS code, nome AS name, idade_minima AS min_age, idade_maxima AS max_age, ativo AS active FROM programas WHERE excluido_em IS NULL ORDER BY nome",
    ),
    queryRows<ProgramUnitRow>(
      `SELECT CONCAT(pr.public_id, ':', u.public_id) AS option_value, CONCAT(pr.nome, ' · ', u.nome) AS label FROM programas_unidades pu JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id WHERE pu.ativo = 1 ORDER BY pr.nome, u.nome`,
    ),
    queryRows<ClassRow>(
      `SELECT t.public_id, t.codigo AS code, t.nome AS name, u.nome AS unit_name, pr.nome AS program_name, t.ano_referencia AS year, t.turno_codigo AS shift, t.capacidade AS capacity, t.status FROM turmas t JOIN programas_unidades pu ON pu.id = t.programa_unidade_id JOIN programas pr ON pr.id = pu.programa_id JOIN unidades u ON u.id = pu.unidade_id ORDER BY t.ano_referencia DESC, u.nome, t.nome`,
    ),
  ]);
  return { units, programs, programUnits, classes };
}

export async function getUsersData() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [users, units, roles] = await Promise.all([
    queryRows<UserRow>(
      `SELECT u.public_id, COALESCE(p.nome, u.login) AS name, u.login, u.email_login AS email, un.nome AS unit_name, u.status, GROUP_CONCAT(DISTINCT CONCAT(pa.nome, IF(ur.unidade_id IS NULL, ' (global)', CONCAT(' · ', us.nome))) ORDER BY pa.nome, us.nome SEPARATOR ', ') AS roles, u.ultimo_login_em AS last_login FROM usuarios u LEFT JOIN pessoas p ON p.id = u.pessoa_id LEFT JOIN unidades un ON un.id = u.unidade_id LEFT JOIN (SELECT usuario_id, papel_id, CAST(NULL AS UNSIGNED) AS unidade_id FROM usuarios_papeis UNION ALL SELECT usuario_id, papel_id, unidade_id FROM usuarios_papeis_unidades) ur ON ur.usuario_id = u.id LEFT JOIN papeis pa ON pa.id = ur.papel_id LEFT JOIN unidades us ON us.id = ur.unidade_id WHERE u.excluido_em IS NULL GROUP BY u.id, u.public_id, p.nome, u.login, u.email_login, un.nome, u.status, u.ultimo_login_em ORDER BY name`,
    ),
    queryRows<UnitRow>(
      "SELECT public_id, codigo AS code, nome AS name, sigla AS acronym, tipo AS type, cidade AS city, uf AS state, ativo AS active, NULL AS programs FROM unidades WHERE ativo = 1 AND excluido_em IS NULL ORDER BY nome",
    ),
    queryRows<RoleRow>(
      "SELECT codigo AS code, nome AS name FROM papeis ORDER BY nome",
    ),
  ]);
  return { users, units, roles };
}
