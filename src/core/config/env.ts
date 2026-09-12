import "server-only";

import { z } from "zod";

const base64Key = z
  .string()
  .min(1)
  .refine(
    (value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    },
    { message: "deve ser uma chave Base64 de 32 bytes" },
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_NAME: z.string().trim().min(2).max(80).default("APROS Sociais"),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  APP_TIME_ZONE: z.string().trim().min(1).default("America/Sao_Paulo"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  TRUST_PROXY: z.stringbool().default(false),
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_$-]+$/),
  DB_USER: z.string().trim().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(2).max(50).default(10),
  DB_SSL: z.stringbool().default(false),
  DATA_ENCRYPTION_KEY_BASE64: base64Key,
  DATA_HMAC_KEY_BASE64: base64Key,
  PRIVATE_STORAGE_PATH: z.string().trim().min(1).default("./storage/private"),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(10),
  CRON_SECRET: z.string().min(32).optional(),
  WHATSAPP_API_URL: z.url().optional(),
  WHATSAPP_API_TOKEN: z.string().min(20).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração inválida: ${details}`);
  }

  if (
    parsed.data.DATA_ENCRYPTION_KEY_BASE64 === parsed.data.DATA_HMAC_KEY_BASE64
  ) {
    throw new Error(
      "As chaves de criptografia e HMAC precisam ser diferentes.",
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
