import { gameRepository } from "@/repositories/gameRepository";
import { championName, findRound, isFinalRound, type ChampionState } from "@/utils/gamePresentation";

export const gameService = {
  upcoming: (limit?: number) => gameRepository.findUpcoming(limit),
  upcomingByLeague: (limitPerLeague?: number) => gameRepository.findUpcomingByLeague(limitPerLeague),
  live: () => gameRepository.findLive(),
  results: (params: Parameters<typeof gameRepository.findResults>[0]) => gameRepository.findResults(params),
  recentResultsByLeague: (limitPerLeague?: number) => gameRepository.findRecentResultsByLeague(limitPerLeague),
  byId: (id: number) => gameRepository.findById(id),

  /**
   * Devuelve, por slug de liga, el estado del campeonato: campeón de
   * la edición anterior, campeón de la edición actual (undefined si
   * todavía no se definió — nunca se omite en silencio), y si es
   * bicampeón (mismo equipo ganó las dos). Solo se busca el
   * resultado de la final, no importa el resto del historial.
   */
  async championsByLeagueSlug(leagueSlugs: string[]): Promise<Record<string, ChampionState>> {
    const results = await gameRepository.findChampionshipFinals(leagueSlugs);
    const map: Record<string, ChampionState> = {};
    const currentYear = new Date().getFullYear();

    for (const { league, games } of results) {
      const distinctRounds = [...new Set(games.map((g) => findRound(g.statistics)).filter(Boolean))];
      console.log(
        `[champion-debug] ${league.slug}: ${games.length} partido(s) finalizado(s) revisados. Rondas encontradas: ${
          distinctRounds.length > 0 ? distinctRounds.join(" | ") : "(ninguna — no hay round guardado en estos partidos)"
        }`
      );

      const finals = games.filter((g) => isFinalRound(findRound(g.statistics)));
      console.log(`[champion-debug] ${league.slug}: de esos, ${finals.length} matchean como "Final".`);
      if (finals.length === 0) continue;

      const latest = finals[0]; // games ya viene ordenado desc por fecha
      const latestTeam = championName(latest);
      if (!latestTeam) continue;
      const latestYear = latest.date.getFullYear();

      const prevGame = finals.find((g) => g.date.getFullYear() !== latestYear);
      const prevTeam = prevGame ? championName(prevGame) : undefined;
      const prevYear = prevGame?.date.getFullYear();

      const state: ChampionState = { isBackToBack: false };

      if (latestYear === currentYear) {
        // La edición actual ya tiene un campeón definido.
        state.current = { team: latestTeam, year: latestYear };
        if (prevTeam && prevYear !== undefined) {
          state.previous = { team: prevTeam, year: prevYear };
          state.isBackToBack = prevTeam === latestTeam;
        }
      } else {
        // La edición actual todavía no terminó — lo más reciente que
        // encontramos es el campeón vigente, de la edición anterior.
        // "current" queda undefined a propósito: se muestra como
        // "todavía no definido", nunca se omite.
        state.previous = { team: latestTeam, year: latestYear };
      }

      map[league.slug] = state;
    }

    return map;
  },

  /**
   * Fase actual de cada liga (ej: "Cuartos de Final"), tomada de la
   * ronda del próximo partido más cercano (o el último jugado si no
   * hay próximos). Se usa en Posiciones cuando todavía no hay
   * campeón definido, para no dejar la sección en silencio ni con un
   * mensaje genérico sin info real.
   */
  async currentPhaseByLeagueSlug(leagueSlugs: string[]): Promise<Record<string, string>> {
    const results = await gameRepository.findCurrentRoundByLeague(leagueSlugs);
    const map: Record<string, string> = {};
    for (const { league, game } of results) {
      if (!game) continue;
      const round = findRound(game.statistics);
      if (round) map[league.slug] = round;
    }
    return map;
  },

  // ── Panel de gestión ──
  listForPanel: (limit?: number) => gameRepository.findAllForPanel(limit),
  create: (data: Parameters<typeof gameRepository.create>[0]) => gameRepository.create(data),
  update: (id: number, data: Parameters<typeof gameRepository.update>[1]) => gameRepository.update(id, data),
  remove: (id: number) => gameRepository.remove(id),
};
