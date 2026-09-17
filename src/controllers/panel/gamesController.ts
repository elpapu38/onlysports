import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { gameService } from "@/services/gameService";
import { sportService } from "@/services/sportService";
import { leagueService } from "@/services/leagueService";
import { seasonService } from "@/services/seasonService";
import { teamService } from "@/services/teamService";

const statusEnum = z.enum(["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"]);

const inputSchema = z
  .object({
    sportId: z.coerce.number().int().positive(),
    leagueId: z.coerce.number().int().positive(),
    seasonId: z.coerce.number().int().positive().optional().or(z.literal("")),
    homeTeamId: z.coerce.number().int().positive(),
    awayTeamId: z.coerce.number().int().positive(),
    date: z.string().min(1), // datetime-local
    status: statusEnum,
    homeScore: z.coerce.number().int().optional().or(z.literal("")),
    awayScore: z.coerce.number().int().optional().or(z.literal("")),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "El equipo local y el visitante no pueden ser el mismo",
    path: ["awayTeamId"],
  });

async function loadFormOptions() {
  const [sports, leagues, seasons, teams] = await Promise.all([
    sportService.list(),
    leagueService.list(),
    seasonService.list(),
    teamService.list(),
  ]);
  return { sports, leagues, seasons, teams };
}

export const panelGamesController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const games = await gameService.listForPanel();
      res.render("panel/games/index", { title: "Partidos", games });
    } catch (err) {
      next(err);
    }
  },

  async newForm(_req: Request, res: Response, next: NextFunction) {
    try {
      const options = await loadFormOptions();
      res.render("panel/games/form", { title: "Nuevo partido", game: null, ...options });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await gameService.create({
        sportId: parsed.sportId,
        leagueId: parsed.leagueId,
        seasonId: parsed.seasonId ? Number(parsed.seasonId) : null,
        homeTeamId: parsed.homeTeamId,
        awayTeamId: parsed.awayTeamId,
        date: new Date(parsed.date),
        status: parsed.status,
        homeScore: parsed.homeScore === "" || parsed.homeScore === undefined ? null : Number(parsed.homeScore),
        awayScore: parsed.awayScore === "" || parsed.awayScore === undefined ? null : Number(parsed.awayScore),
      });
      res.redirect("/panel/games");
    } catch (err) {
      next(err);
    }
  },

  async editForm(req: Request, res: Response, next: NextFunction) {
    try {
      const [game, options] = await Promise.all([gameService.byId(Number(req.params.id)), loadFormOptions()]);
      if (!game) return res.status(404).render("errors/404", { title: "No encontrado" });
      res.render("panel/games/form", { title: "Editar partido", game, ...options });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = inputSchema.parse(req.body);
      await gameService.update(Number(req.params.id), {
        sportId: parsed.sportId,
        leagueId: parsed.leagueId,
        seasonId: parsed.seasonId ? Number(parsed.seasonId) : null,
        homeTeamId: parsed.homeTeamId,
        awayTeamId: parsed.awayTeamId,
        date: new Date(parsed.date),
        status: parsed.status,
        homeScore: parsed.homeScore === "" || parsed.homeScore === undefined ? null : Number(parsed.homeScore),
        awayScore: parsed.awayScore === "" || parsed.awayScore === undefined ? null : Number(parsed.awayScore),
      });
      res.redirect("/panel/games");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await gameService.remove(Number(req.params.id));
      res.redirect("/panel/games");
    } catch (err) {
      next(err);
    }
  },
};
