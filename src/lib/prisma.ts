import { PrismaClient } from "@prisma/client";

// PowerShell `echo` silently prepends a UTF-8 BOM (﻿) when piping values
// to `vercel env add`. Strip it from every critical env var at startup so a
// mis-set variable never crashes the app.
const BOM = 0xfeff;
const strip = (key: string) => {
  if (process.env[key]?.charCodeAt(0) === BOM)
    process.env[key] = process.env[key]!.slice(1);
};
strip("DATABASE_URL");
strip("AUTH_SECRET");
strip("NEXTAUTH_URL");
strip("AADHAAR_ENC_KEY");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Neon serverless terminates idle connections (E57P01).
  // Middleware retries the query once after forcing a reconnect.
  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      const isConnectionErr =
        msg.includes("terminating connection") ||
        msg.includes("Connection refused") ||
        msg.includes("connect ECONNREFUSED") ||
        msg.includes("Can't reach database") ||
        msg.includes("Server has closed the connection");

      if (isConnectionErr) {
        console.warn("[prisma] Connection dropped by Neon — reconnecting...");
        await client.$disconnect().catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
        await client.$connect().catch(() => {});
        return await next(params);
      }
      throw err;
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
