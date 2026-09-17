import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/env";

// Autenticación básica para el panel admin. Suficiente para uso
// personal/self-hosted; para exponerlo públicamente conviene
// reemplazar esto por un sistema de sesiones/usuarios real.
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [user, password] = decoded.split(":");
    if (user === env.admin.user && password === env.admin.password) {
      return next();
    }
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="OnlySports Admin"');
  res.status(401).send("Autenticación requerida");
}
