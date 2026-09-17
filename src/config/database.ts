import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { env } from "./env";

// Cliente único de Prisma (singleton) para evitar agotar conexiones
// en desarrollo con hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Desde Prisma 7, PrismaClient necesita un "driver adapter". Con
// SQLite es un solo archivo local: en la app de escritorio (Electron)
// process.env.DATABASE_URL se arma en tiempo de ejecución apuntando
// al archivo dentro de la carpeta de datos del usuario.
const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: env.isProd ? ["error", "warn"] : ["error", "warn"],
  });

if (!env.isProd) {
  global.__prisma = prisma;
}
