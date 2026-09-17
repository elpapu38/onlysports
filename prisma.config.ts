import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 movió la configuración de conexión fuera de schema.prisma.
// Este archivo la reemplaza para todo lo que corre por CLI
// (generate, migrate, studio, seed). En desarrollo apunta a un
// archivo SQLite local; en producción (empaquetado con Electron)
// la app arma su propio DATABASE_URL en tiempo de ejecución.
export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
