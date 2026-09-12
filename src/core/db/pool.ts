import "server-only";

import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import type { ExecuteValues } from "mysql2";

import { getEnv } from "@/core/config/env";

declare global {
  var __aprosPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.__aprosPool) return globalThis.__aprosPool;

  const env = getEnv();
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: true,
    multipleStatements: false,
    ssl: env.DB_SSL ? { rejectUnauthorized: true } : undefined,
  });

  if (process.env.NODE_ENV !== "production") globalThis.__aprosPool = pool;
  return pool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  values: readonly ExecuteValues[] = [],
  connection: Pool | PoolConnection = getPool(),
): Promise<T[]> {
  const [rows] = await connection.execute<T[]>(sql, [...values]);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  values: readonly ExecuteValues[] = [],
  connection: Pool | PoolConnection = getPool(),
): Promise<T | null> {
  const rows = await queryRows<T>(sql, values, connection);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  values: readonly ExecuteValues[] = [],
  connection: Pool | PoolConnection = getPool(),
): Promise<ResultSetHeader> {
  const [result] = await connection.execute<ResultSetHeader>(sql, [...values]);
  return result;
}

export type { PoolConnection, RowDataPacket };
