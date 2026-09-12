import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getEnv } from "@/core/config/env";

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key(): Buffer {
  return Buffer.from(getEnv().DATA_ENCRYPTION_KEY_BASE64, "base64");
}

export function encryptText(value: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

export function decryptText(
  payload: Buffer | Uint8Array | null,
): string | null {
  if (!payload) return null;
  const data = Buffer.from(payload);
  if (data.length < 1 + IV_LENGTH + TAG_LENGTH || data[0] !== VERSION) {
    throw new Error("Envelope criptográfico inválido.");
  }
  const iv = data.subarray(1, 1 + IV_LENGTH);
  const tag = data.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptJson(value: unknown): Buffer {
  return encryptText(JSON.stringify(value));
}

export function decryptJson<T>(payload: Buffer | Uint8Array | null): T | null {
  const text = decryptText(payload);
  return text === null ? null : (JSON.parse(text) as T);
}
