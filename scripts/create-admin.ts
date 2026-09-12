import { randomUUID } from "node:crypto";

import { z } from "zod";

import { auditEvent } from "../src/core/audit/audit";
import { hashPassword } from "../src/core/auth/password";
import {
  execute,
  getPool,
  queryOne,
  type RowDataPacket,
} from "../src/core/db/pool";
import { withTransaction } from "../src/core/db/transaction";

const inputSchema = z.object({
  name: z.string().trim().min(3).max(180),
  login: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,80}$/)
    .transform((value) => value.toLowerCase()),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(14).max(200),
});

type IdRow = RowDataPacket & { id: string };

async function main(): Promise<void> {
  const input = inputSchema.safeParse({
    name: process.env.ADMIN_NAME,
    login: process.env.ADMIN_LOGIN,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (!input.success) {
    throw new Error(
      `Informe ADMIN_NAME, ADMIN_LOGIN, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 14 caracteres). ${input.error.issues[0]?.message ?? ""}`,
    );
  }

  const adminPublicId = randomUUID();
  await withTransaction(async (connection) => {
    const duplicate = await queryOne<IdRow>(
      "SELECT id FROM usuarios WHERE login = ? OR email_login = ? LIMIT 1",
      [input.data.login, input.data.email],
      connection,
    );
    if (duplicate)
      throw new Error("Já existe usuário com o login ou e-mail informado.");

    const role = await queryOne<IdRow>(
      "SELECT id FROM papeis WHERE codigo = 'ADMINISTRADOR' LIMIT 1",
      [],
      connection,
    );
    if (!role)
      throw new Error(
        "Papel ADMINISTRADOR ausente. Importe o banco completo antes de criar a conta.",
      );

    const person = await execute(
      "INSERT INTO pessoas (public_id, nome) VALUES (?, ?)",
      [randomUUID(), input.data.name],
      connection,
    );
    const user = await execute(
      `INSERT INTO usuarios
        (public_id, pessoa_id, login, email_login, senha_hash, status)
       VALUES (?, ?, ?, ?, ?, 'ATIVO')`,
      [
        adminPublicId,
        String(person.insertId),
        input.data.login,
        input.data.email,
        await hashPassword(input.data.password),
      ],
      connection,
    );
    const userId = String(user.insertId);
    await execute(
      "INSERT INTO usuarios_papeis (usuario_id, papel_id, concedido_por) VALUES (?, ?, NULL)",
      [userId, role.id],
      connection,
    );
    await auditEvent({
      userId,
      action: "ADMIN_INICIAL_CRIADO",
      entity: "USUARIO",
      entityId: userId,
      entityPublicId: adminPublicId,
      connection,
    });
  });

  console.log(`Administrador ${input.data.login} criado com sucesso.`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha ao criar administrador.",
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
