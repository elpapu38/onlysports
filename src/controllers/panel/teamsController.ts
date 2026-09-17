import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { teamService } from "@/services/teamService";
import { sportService } from "@/services/sportService";
import { leagueService } from "@/services/leagueService";

const inputSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  sportId: z.coerce.number().int().positive(),
  leagueId: z.coerce.number().int().positive().optional().or(z.literal("")),
});

export const teamsController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const teams = await teamService.list();
      res.render("panel/teams/index", { title: "Equipos", teams });
    } catch (err) {
      next(err);
    }
  },

  async newForm(_req: Request, res: Response, next: NextFunction) {
    try {
      const [sports, leagues] = await Promise.all([sportService.list(), leagueService.list()]);
      res.render("panel/teams/form", { title: "Nuevo equipo", team: null, sports, leagues });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await teamService.create({
        name: parsed.name,
        shortName: parsed.shortName || null,
        logoUrl: parsed.logoUrl || null,
        sportId: parsed.sportId,
        leagueId: parsed.leagueId ? Number(parsed.leagueId) : null,
      });
      res.redirect("/panel/teams");
    } catch (err) {
      next(err);
    }
  },

  async editForm(req: Request, res: Response, next: NextFunction) {
    try {
      const [team, sports, leagues] = await Promise.all([
        teamService.get(Number(req.params.id)),
        sportService.list(),
        leagueService.list(),
      ]);
      if (!team) return res.status(404).render("errors/404", { title: "No encontrado" });
      res.render("panel/teams/form", { title: "Editar equipo", team, sports, leagues });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await teamService.update(Number(req.params.id), {
        name: parsed.name,
        shortName: parsed.shortName || null,
        logoUrl: parsed.logoUrl || null,
        sportId: parsed.sportId,
        leagueId: parsed.leagueId ? Number(parsed.leagueId) : null,
      });
      res.redirect("/panel/teams");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await teamService.remove(Number(req.params.id));
      res.redirect("/panel/teams");
    } catch (err) {
      next(err);
    }
  },
};
