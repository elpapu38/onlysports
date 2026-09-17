import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";
import { fetchEspnScoreboard, normalizeEspnEvent } from "./espnClient";

const SPORT_PATH = "basketball/nba";

/**
 * Solo trae próximos partidos de NBA vía ESPN — resultados y
 * standings de NBA ya los cubre bien BasketballReferenceNbaProvider
 * (scraper, ya probado y funcionando). Este provider existe porque
 * TheSportsDB con la key gratuita también viene capado acá
 * (eventsnextleague.php trae 1 solo partido, y eventsseason.php tiene
 * un límite documentado de 1 resultado en el plan gratis).
 */
export class EspnNbaUpcomingProvider implements SportsProvider {
  readonly source = "espn:nba-upcoming";

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    try {
      const from = new Date();
      const to = new Date();
      // 60 días (no 30): en pleno receso (jul-sep) los próximos
      // partidos pueden estar a más de un mes — la pretemporada suele
      // arrancar recién en octubre. Con 30 días, en receso esta
      // consulta siempre volvía vacía y caía de nuevo a TheSportsDB
      // (que solo tiene 1 partido cargado).
      to.setDate(to.getDate() + 60);

      const events = await fetchEspnScoreboard(SPORT_PATH, from, to);
      const games = events
        .filter((ev) => !ev.status?.type?.completed)
        .map((ev) => normalizeEspnEvent(ev, "basquet", "nba", ev.status?.type?.state === "in" ? "LIVE" : "SCHEDULED"))
        .filter((g): g is NormalizedGame => g !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (games.length === 0) {
        console.warn("[espn] nba: 0 próximos partidos en el scoreboard — puede ser receso de temporada (jul-sep) o cambió la respuesta.");
      }
      return games;
    } catch (err) {
      console.error("[espn] Falló fetchUpcoming (nba):", err);
      return [];
    }
  }

  async fetchFinishedGames(): Promise<NormalizedGame[]> {
    return []; // lo cubre BasketballReferenceNbaProvider
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    return []; // lo cubre BasketballReferenceNbaProvider
  }
}
