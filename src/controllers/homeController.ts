import type { Request, Response, NextFunction } from "express";
import { gameService } from "@/services/gameService";
import { env } from "@/config/env";

export const homeController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const [live, upcomingGroups] = await Promise.all([gameService.live(), gameService.upcomingByLeague(5)]);
      const currentPhase = await gameService.currentPhaseByLeagueSlug(upcomingGroups.map((g) => g.league.slug));
      res.render("home/index", { title: env.appName, live, upcomingGroups, currentPhase });
    } catch (err) {
      next(err);
    }
  },
};
