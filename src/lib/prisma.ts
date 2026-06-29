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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
