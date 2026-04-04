// backend/src/lib/db.js
// ─── PRISMA CLIENT SINGLETON ──────────────────────────────────────────────────
// Import this everywhere instead of creating new PrismaClient() instances.
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const db = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

export default db;