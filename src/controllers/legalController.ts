import type { Request, Response } from "express";
import { disclaimerCookie } from "@/middleware/disclaimer";

function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  // Solo permitimos rutas internas relativas, nunca URLs externas.
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export const legalController = {
  showDisclaimer(req: Request, res: Response) {
    res.render("legal/disclaimer", { title: "Antes de continuar", next: safeNext(req.query.next) });
  },

  acceptDisclaimer(req: Request, res: Response) {
    res.cookie(disclaimerCookie.name, "1", {
      maxAge: disclaimerCookie.maxAge,
      httpOnly: true,
      sameSite: "lax",
    });
    res.redirect(safeNext(req.body?.next));
  },
};
