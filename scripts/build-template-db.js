// Genera prisma/app-template.db: una base SQLite en blanco pero con
// todas las tablas ya creadas (corriendo las migraciones). Este
// archivo es el que se copia a la carpeta de datos del usuario la
// primera vez que abre la app de escritorio.
//
// Se corre como parte de `npm run electron:build` / `npm run electron:dev`.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const templatePath = path.join(__dirname, "..", "prisma", "app-template.db");

if (fs.existsSync(templatePath)) {
  fs.rmSync(templatePath);
}

const env = {
  ...process.env,
  DATABASE_URL: `file:${templatePath}`,
};

console.log("Generando base SQLite de plantilla en", templatePath);
// db push (en vez de migrate deploy) crea las tablas directo desde
// schema.prisma, sin depender de un historial de migraciones.
execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env });

// Generamos el cliente de Prisma de forma explícita: no siempre queda
// garantizado que `db push` lo regenere solo.
console.log("Generando cliente de Prisma...");
execSync("npx prisma generate", { stdio: "inherit", env: process.env });

console.log("Listo.");
