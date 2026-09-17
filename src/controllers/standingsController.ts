import type { Request, Response, NextFunction } from "express";
import { standingService } from "@/services/standingService";
import { gameService } from "@/services/gameService";
import { espnCompetitions } from "@/config/espnCompetitions";

// Solo las copas (eliminación directa) tienen sentido de "campeón
// definido por una final" — una liga regular (NBA, Liga Profesional)
// no necesariamente lo decide así, así que no le mostramos el aviso
// de "sin campeón todavía" para no confundir.
const cupLeagueSlugs = new Set(espnCompetitions.map((c) => c.leagueSlug));

export const standingsController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await standingService.allGroupedByLeague();
      const leagueSlugs = groups.map((g) => g.league.slug);
      const [champions, currentPhase] = await Promise.all([
        gameService.championsByLeagueSlug(leagueSlugs),
        gameService.currentPhaseByLeagueSlug(leagueSlugs),
      ]);
      res.render("standings/index", { title: "Posiciones", groups, champions, currentPhase, cupLeagueSlugs });
    } catch (err) {
      next(err);
    }
  },
};
