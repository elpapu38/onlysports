import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { seasonService } from "@/services/seasonService";
import { leagueService } from "@/services/leagueService";

const inputSchema = z.object({
  name: z.string().min(1),
  year: z.coerce.number().int(),
  leagueId: z.coerce.number().int().positive(),
});

export const seasonsController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const seasons = await seasonService.list();
      res.render("panel/seasons/index", { title: "Temporadas", seasons });
    } catch (err) {
      next(err);
    }
  },

  async newForm(_req: Request, res: Response, next: NextFunction) {
    try {
      const leagues = await leagueService.list();
      res.render("panel/seasons/form", { title: "Nueva temporada", season: null, leagues });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await seasonService.create(parsed);
      res.redirect("/panel/seasons");
    } catch (err) {
      next(err);
    }
  },

  async editForm(req: Request, res: Response, next: NextFunction) {
    try {
      const [season, leagues] = await Promise.all([seasonService.get(Number(req.params.id)), leagueService.list()]);
      if (!season) return res.status(404).render("errors/404", { title: "No encontrado" });
      res.render("panel/seasons/form", { title: "Editar temporada", season, leagues });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await seasonService.update(Number(req.params.id), parsed);
      res.redirect("/panel/seasons");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await seasonService.remove(Number(req.params.id));
      res.redirect("/panel/seasons");
    } catch (err) {
      next(err);
    }
  },
};
