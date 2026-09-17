import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { leagueService } from "@/services/leagueService";
import { sportService } from "@/services/sportService";
import { slugify } from "@/utils/slugify";

const inputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  sportId: z.coerce.number().int().positive(),
});

export const leaguesController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const leagues = await leagueService.list();
      res.render("panel/leagues/index", { title: "Ligas", leagues });
    } catch (err) {
      next(err);
    }
  },

  async newForm(_req: Request, res: Response, next: NextFunction) {
    try {
      const sports = await sportService.list();
      res.render("panel/leagues/form", { title: "Nueva liga", league: null, sports });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      const slug = parsed.slug?.trim() || slugify(parsed.name);
      await leagueService.create({ name: parsed.name, slug, sportId: parsed.sportId });
      res.redirect("/panel/leagues");
    } catch (err) {
      next(err);
    }
  },

  async editForm(req: Request, res: Response, next: NextFunction) {
    try {
      const [league, sports] = await Promise.all([leagueService.get(Number(req.params.id)), sportService.list()]);
      if (!league) return res.status(404).render("errors/404", { title: "No encontrado" });
      res.render("panel/leagues/form", { title: "Editar liga", league, sports });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      const slug = parsed.slug?.trim() || slugify(parsed.name);
      await leagueService.update(Number(req.params.id), { name: parsed.name, slug, sportId: parsed.sportId });
      res.redirect("/panel/leagues");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await leagueService.remove(Number(req.params.id));
      res.redirect("/panel/leagues");
    } catch (err) {
      next(err);
    }
  },
};
