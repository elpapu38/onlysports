import type { Request, Response, NextFunction } from "express";
import { gameService } from "@/services/gameService";
import { matchDetailsService } from "@/services/matchDetailsService";

export const gamesController = {
  async results(req: Request, res: Response, next: NextFunction) {
    try {
      const { sport, league, team, from, to } = req.query;
      const hasFilters = Boolean(sport || league || team || from || to);

      if (!hasFilters) {
        // Vista por defecto: últimos 5 resultados de cada liga con
        // partidos finalizados, no una lista plana de todo mezclado.
        const groups = await gameService.recentResultsByLeague(5);
        const leagueSlugs = groups.map((g) => g.league.slug);
        const [champions, currentPhase] = await Promise.all([
          gameService.championsByLeagueSlug(leagueSlugs),
          gameService.currentPhaseByLeagueSlug(leagueSlugs),
        ]);
        return res.render("games/index", { title: "Resultados", groups, games: null, champions, currentPhase });
      }

      const games = await gameService.results({
        sportSlug: typeof sport === "string" ? sport : undefined,
        leagueSlug: typeof league === "string" ? league : undefined,
        teamId: typeof team === "string" ? Number(team) : undefined,
        from: typeof from === "string" ? new Date(from) : undefined,
        to: typeof to === "string" ? new Date(to) : undefined,
      });
      const filteredLeagueSlugs = [...new Set(games.map((g) => g.league.slug))];
      const [champions, currentPhase] = await Promise.all([
        gameService.championsByLeagueSlug(filteredLeagueSlugs),
        gameService.currentPhaseByLeagueSlug(filteredLeagueSlugs),
      ]);
      res.render("games/index", { title: "Resultados", games, groups: null, champions, currentPhase });
    } catch (err) {
      next(err);
    }
  },

  async live(_req: Request, res: Response, next: NextFunction) {
    try {
      const games = await gameService.live();
      res.render("games/live", { title: "En vivo", games });
    } catch (err) {
      next(err);
    }
  },

  async show(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      let game = await gameService.byId(id);
      if (!game) return res.status(404).render("errors/404", { title: "No encontrado" });

      // Mejor esfuerzo: si es un partido de fútbol finalizado y no
      // se intentó antes, trata de completar quién anotó. Si falla o
      // no aplica, no afecta el resto de la página.
      await matchDetailsService.ensureGoalScorers(game);
      game = (await gameService.byId(id)) ?? game; // releer por si se agregaron statistics nuevas

      res.render("games/show", { title: `${game.homeTeam.name} vs ${game.awayTeam.name}`, game });
    } catch (err) {
      next(err);
    }
  },

  // API JSON (para futuros clientes: móvil, SPA, widgets)
  async apiUpcoming(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await gameService.upcoming());
    } catch (err) {
      next(err);
    }
  },
  async apiLive(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await gameService.live());
    } catch (err) {
      next(err);
    }
  },
};
