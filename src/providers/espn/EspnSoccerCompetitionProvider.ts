import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";
import { fetchEspnScoreboard, fetchEspnScoreboardChunked, normalizeEspnEvent } from "./espnClient";

interface EspnStandingStat {
  name?: string;
  value?: number;
}
interface EspnStandingEntry {
  team?: { displayName?: string };
  stats?: EspnStandingStat[];
}
interface EspnStandingGroup {
  name?: string;
  abbreviation?: string;
  standings?: { entries?: EspnStandingEntry[] };
}

function statValue(entry: EspnStandingEntry, ...names: string[]): number | undefined {
  for (const name of names) {
    const found = entry.stats?.find((s) => s.name === name);
    if (found?.value !== undefined) return found.value;
  }
  return undefined;
}

export interface EspnSoccerCompetitionConfig {
  /** Slug que usa ESPN en la URL (ej: "arg.1", "conmebol.libertadores"). */
  espnSportPath: string;
  sportSlug: string;
  leagueSlug: string;
  /**
   * Nombre "base" de temporada — si la competencia tiene zonas, cada
   * una se guarda como "<seasonBaseName> · <nombre de zona>" para que
   * puedan convivir como temporadas separadas sin migrar el schema.
   */
  seasonBaseName?: string;
}

/**
 * Provider genérico para competencias de fútbol vía la API pública de
 * ESPN — sirve tanto para ligas con tabla de posiciones simple como
 * para las que se dividen en zonas/grupos (ESPN ya trae esa división
 * en el campo "children" de la respuesta de standings; acá se
 * respeta esa división en vez de aplanar todo en una sola tabla).
 */
export class EspnSoccerCompetitionProvider implements SportsProvider {
  readonly source: string;

  constructor(private readonly cfg: EspnSoccerCompetitionConfig) {
    this.source = `espn:${cfg.leagueSlug}`;
  }

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 90); // copas de eliminación directa (Copa Argentina, Sudamericana...) tienen fases muy espaciadas — 45 días se quedaba corto

      const events = await fetchEspnScoreboard(this.cfg.espnSportPath, from, to);
      const games = events
        .filter((ev) => !ev.status?.type?.completed)
        .map((ev) =>
          normalizeEspnEvent(ev, this.cfg.sportSlug, this.cfg.leagueSlug, ev.status?.type?.state === "in" ? "LIVE" : "SCHEDULED")
        )
        .filter((g): g is NormalizedGame => g !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (games.length === 0) {
        console.warn(`[espn] ${this.cfg.leagueSlug}: 0 próximos partidos en el scoreboard.`);
      }
      return games;
    } catch (err) {
      console.error(`[espn] Falló fetchUpcoming (${this.cfg.leagueSlug}):`, err);
      return [];
    }
  }

  async fetchFinishedGames(): Promise<NormalizedGame[]> {
    try {
      const to = new Date();
      const from = new Date();
      // Ventana amplia (2 años) para poder alcanzar la final de la
      // edición anterior — necesaria para el campeón vigente/histórico.
      // Copa América en particular no es anual (se juega cada 2-4
      // años), así que 90 días o incluso 1 año se quedaban cortos.
      from.setDate(from.getDate() - 730);

      const events = await fetchEspnScoreboardChunked(this.cfg.espnSportPath, from, to);
      const allGames = events
        .filter((ev) => ev.status?.type?.completed)
        .map((ev) => normalizeEspnEvent(ev, this.cfg.sportSlug, this.cfg.leagueSlug, "FINISHED"))
        .filter((g): g is NormalizedGame => g !== null);

      // No queremos inundar /resultados con 2 años de partidos viejos
      // de fase de grupos — nos quedamos con los recientes (90 días,
      // lo que ya se mostraba antes) MÁS cualquier final de cualquier
      // antigüedad (para poder calcular el campeón de ediciones
      // anteriores). Todo lo demás (partidos viejos que no son
      // finales) se descarta acá.
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 90);
      const games = allGames.filter((g) => g.date >= recentCutoff || (g.round && /final/i.test(g.round) && !/semi|cuartos|quarter/i.test(g.round)));

      if (games.length === 0) {
        console.warn(`[espn] ${this.cfg.leagueSlug}: 0 partidos finalizados en el scoreboard.`);
      }
      return games;
    } catch (err) {
      console.error(`[espn] Falló fetchFinishedGames (${this.cfg.leagueSlug}):`, err);
      return [];
    }
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    const url = `https://site.api.espn.com/apis/v2/sports/${this.cfg.espnSportPath}/standings`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ESPN respondió ${res.status} en ${url}`);
      const data = (await res.json()) as {
        standings?: { entries?: EspnStandingEntry[] };
        children?: EspnStandingGroup[];
      };

      const baseSeasonName = this.cfg.seasonBaseName ?? String(new Date().getFullYear());
      const standings: NormalizedStanding[] = [];

      // Sin zonas: entries viene directo en data.standings.
      if (data.standings?.entries) {
        this.pushEntries(standings, data.standings.entries, baseSeasonName);
      }

      // Con zonas/grupos: cada child trae su propio nombre + entries.
      // Se guarda cada una como una "temporada" separada
      // ("<base> · <zona>") para poder mostrarlas como tablas
      // independientes sin necesitar una columna nueva en la base.
      const children = data.children ?? [];
      children.forEach((child, index) => {
        const entries = child.standings?.entries;
        if (!entries || entries.length === 0) return;
        const zoneName = child.name || child.abbreviation || `Grupo ${index + 1}`;
        this.pushEntries(standings, entries, `${baseSeasonName} · ${zoneName}`);
      });

      if (standings.length === 0) {
        console.warn(`[espn] ${this.cfg.leagueSlug}: no se pudo parsear standings de ${url}`);
      }
      return standings;
    } catch (err) {
      console.error(`[espn] Falló fetchStandings (${this.cfg.leagueSlug}):`, err);
      return [];
    }
  }

  private pushEntries(out: NormalizedStanding[], entries: EspnStandingEntry[], seasonName: string) {
    for (const entry of entries) {
      const teamName = entry.team?.displayName;
      if (!teamName) continue;

      const wins = statValue(entry, "wins") ?? 0;
      const losses = statValue(entry, "losses") ?? 0;
      const draws = statValue(entry, "ties", "draws") ?? 0;
      const points = statValue(entry, "points") ?? 0;
      const played = statValue(entry, "gamesPlayed") ?? wins + losses + draws;
      const rank = statValue(entry, "rank");

      out.push({
        leagueSlug: this.cfg.leagueSlug,
        seasonName,
        teamExternalId: teamName,
        played,
        wins,
        losses,
        draws,
        points,
        rank,
      });
    }
  }
}
