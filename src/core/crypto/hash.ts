import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/core/config/env";

export function sha256(value: string | Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

export function hmac(value: string): Buffer {
  const key = Buffer.from(getEnv().DATA_HMAC_KEY_BASE64, "base64");
  return createHmac("sha256", key).update(value, "utf8").digest();
}

export function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeLogin(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function maskPhone(value: string): string {
  const phone = normalizePhone(value);
  if (phone.length < 10) return "***";
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  return `(${local.slice(0, 2)}) *****-${local.slice(-4)}`;
}

export function maskEmail(value: string): string {
  const [name, domain] = normalizeEmail(value).split("@");
  if (!name || !domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}
