import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import ipaddr from "ipaddr.js";

import { getEnv } from "@/core/config/env";

export type RequestContext = {
  requestId: string;
  ip: Buffer | null;
  userAgent: string | null;
};

function parseIp(value: string | null): Buffer | null {
  if (!value) return null;
  const candidate = value.split(",")[0]?.trim();
  if (!candidate || !ipaddr.isValid(candidate)) return null;
  const address = ipaddr.parse(candidate);
  return Buffer.from(address.toByteArray());
}

export async function getRequestContext(): Promise<RequestContext> {
  const requestHeaders = await headers();
  const ipValue = getEnv().TRUST_PROXY
    ? (requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip"))
    : null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;
  return { requestId: randomUUID(), ip: parseIp(ipValue), userAgent };
}
