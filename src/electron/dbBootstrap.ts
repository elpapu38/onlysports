import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "electron";

/**
 * La primera vez que se abre la app, copiamos una base SQLite ya
 * migrada (con todas las tablas creadas) desde los recursos
 * empaquetados a la carpeta de datos del usuario. Las veces
 * siguientes, se reutiliza esa misma base (ahí vive todo lo que el
 * usuario cargó: canales, streams, favoritos).
 */
/**
 * Antes de este cambio la app no llamaba a `app.setName(...)`, así que
 * en modo desarrollo (sin empaquetar) Electron usaba su carpeta de
 * userData por defecto ("Electron"), no "OnlySports". Si alguien ya
 * usó la app antes de este fix, toda su base y configuración vive en
 * `%APPDATA%\Electron\onlysports.db` — sin esta migración, al fijar
 * el nombre correcto la app arrancaría de cero como si fuera la
 * primera vez, perdiendo de vista (no borrando, pero sí ignorando)
 * todo lo ya sincronizado.
 */
function migrateLegacyElectronUserData(userDataDir: string, dbPath: string): void {
  if (fs.existsSync(dbPath)) return; // ya hay base en la carpeta nueva, nada que migrar

  const appDataRoot = path.dirname(userDataDir);
  const legacyDir = path.join(appDataRoot, "Electron");
  const legacyDbPath = path.join(legacyDir, "onlysports.db");
  if (!fs.existsSync(legacyDbPath)) return; // no había instalación previa afectada por esto

  console.log(`[dbBootstrap] Migrando datos de ${legacyDir} a ${userDataDir}...`);
  for (const file of ["onlysports.db", ".session-secret", ".csrf-secret", ".admin-secret"]) {
    const from = path.join(legacyDir, file);
    const to = path.join(userDataDir, file);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
  console.log("[dbBootstrap] Migración completa.");
}

function resolveDbPath(): string {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const dbPath = path.join(userDataDir, "onlysports.db");
  migrateLegacyElectronUserData(userDataDir, dbPath);

  if (!fs.existsSync(dbPath)) {
    const templatePath = app.isPackaged
      ? path.join(process.resourcesPath, "app-template.db")
      : path.join(__dirname, "..", "..", "prisma", "app-template.db");

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);
    } else {
      // Fallback de desarrollo: si todavía no generaste la plantilla
      // (npm run prisma:template), Prisma va a crear el archivo vacío
      // solo con `prisma migrate deploy`/`db push` corrido a mano.
      fs.closeSync(fs.openSync(dbPath, "w"));
    }
  }

  return dbPath;
}

/**
 * Genera (o reutiliza, si ya existe en esta sesión) un secreto
 * aleatorio para CSRF/sesión. No hace falta que sea el mismo entre
 * reinstalaciones: solo protege la instancia local de este usuario.
 */
function ensureLocalSecret(userDataDir: string, filename: string): string {
  const secretPath = path.join(userDataDir, filename);
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600 });
  return secret;
}

export function bootstrapEnv() {
  const dbPath = resolveDbPath();
  const userDataDir = app.getPath("userData");

  process.env.NODE_ENV = process.env.NODE_ENV ?? "production";
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.REDIS_ENABLED = "false"; // no tiene sentido en un empaquetado de escritorio
  process.env.SESSION_SECRET = ensureLocalSecret(userDataDir, ".session-secret");
  process.env.CSRF_SECRET = ensureLocalSecret(userDataDir, ".csrf-secret");
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ensureLocalSecret(userDataDir, ".admin-secret");

  return { dbPath };
}
