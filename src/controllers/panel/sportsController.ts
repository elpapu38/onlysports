import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sportService } from "@/services/sportService";
import { slugify } from "@/utils/slugify";

const inputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
});

export const sportsController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const sports = await sportService.list();
      res.render("panel/sports/index", { title: "Deportes", sports });
    } catch (err) {
      next(err);
    }
  },

  newForm(_req: Request, res: Response) {
    res.render("panel/sports/form", { title: "Nuevo deporte", sport: null });
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      const slug = parsed.slug?.trim() || slugify(parsed.name);
      await sportService.create({ name: parsed.name, slug });
      res.redirect("/panel/sports");
    } catch (err) {
      next(err);
    }
  },

  async editForm(req: Request, res: Response, next: NextFunction) {
    try {
      const sport = await sportService.get(Number(req.params.id));
      if (!sport) return res.status(404).render("errors/404", { title: "No encontrado" });
      res.render("panel/sports/form", { title: "Editar deporte", sport });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      const slug = parsed.slug?.trim() || slugify(parsed.name);
      await sportService.update(Number(req.params.id), { name: parsed.name, slug });
      res.redirect("/panel/sports");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await sportService.remove(Number(req.params.id));
      res.redirect("/panel/sports");
    } catch (err) {
      next(err);
    }
  },
};
