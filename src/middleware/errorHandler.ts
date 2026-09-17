import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).render("errors/404", { title: "No encontrado", path: req.path });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof ZodError) {
    if (req.path.startsWith("/api/")) {
      return res.status(400).json({ ok: false, error: "Datos inválidos", details: err.issues });
    }
    return res.status(400).render("errors/400", { title: "Datos inválidos", issues: err.issues });
  }

  const status = 500;
  if (req.path.startsWith("/api/")) {
    return res.status(status).json({ ok: false, error: "Error interno" });
  }
  res.status(status).render("errors/500", { title: "Error interno" });
}
