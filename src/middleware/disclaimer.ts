import type { Request, Response, NextFunction } from "express";

// Antes de usar cualquier parte de la app que involucre contenido
// multimedia (canales, streams, backup), se le pide al usuario que
// acepte explícitamente que es responsable de las fuentes que carga.
// Se guarda en una cookie simple (no requiere cuenta/sesión) por
// instancia/navegador.

const COOKIE_NAME = "onlysports.disclaimer_accepted";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365; // 1 año

const EXEMPT_PATHS = ["/legal/disclaimer", "/legal/disclaimer/accept"];
const EXEMPT_PREFIXES = ["/api/", "/css/", "/js/", "/images/", "/icons/"];

export function disclaimerGate(req: Request, res: Response, next: NextFunction) {
  if (EXEMPT_PATHS.includes(req.path) || EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const accepted = req.cookies?.[COOKIE_NAME] === "1";
  if (accepted) return next();

  return res.redirect(`/legal/disclaimer?next=${encodeURIComponent(req.originalUrl)}`);
}

export const disclaimerCookie = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE_MS,
};
