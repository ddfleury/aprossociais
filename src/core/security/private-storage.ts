import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "@/core/config/env";
import { NotFoundError } from "@/core/security/errors";

function rootPath(): string {
  const root = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    getEnv().PRIVATE_STORAGE_PATH,
  );
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`))
    throw new Error("PRIVATE_STORAGE_PATH não pode ficar dentro de public/.");
  return root;
}

export function resolveStorageKey(storageKey: string): string {
  if (!/^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{1,10}$/i.test(storageKey))
    throw new NotFoundError("Arquivo inválido.");
  const root = rootPath();
  const target = path.resolve(/* turbopackIgnore: true */ root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new NotFoundError("Arquivo inválido.");
  return target;
}

export async function storePrivateFile(
  storageKey: string,
  bytes: Uint8Array,
): Promise<void> {
  const target = resolveStorageKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
}

export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  try {
    return await readFile(resolveStorageKey(storageKey));
  } catch {
    throw new NotFoundError("Arquivo não encontrado no armazenamento privado.");
  }
}
export async function removePrivateFile(storageKey: string): Promise<void> {
  await unlink(resolveStorageKey(storageKey)).catch(() => undefined);
}
