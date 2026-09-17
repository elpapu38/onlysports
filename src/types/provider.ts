// Contrato genérico que debe cumplir cualquier proveedor deportivo
// (NBA, MLB, fútbol, Liga Nacional, o uno nuevo en el futuro).
// El objetivo: poder reemplazar una API externa sin tocar el resto
// de la aplicación (Provider / Adapter pattern).

export interface NormalizedTeam {
  externalId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
}

export interface NormalizedGame {
  externalId: string;
  sportSlug: string;
  leagueSlug: string;
  seasonName?: string;
  /** Fase/ronda del torneo si el proveedor la informa (ej: "Final", "Semifinal", "Regular Season - 12"). */
  round?: string;
  /**
   * Quién ganó, cuando el proveedor lo informa explícito (ej: campo
   * "winner" de ESPN) — necesario para partidos de eliminación
   * directa que terminan empatados en tiempo regular y se definen
   * por penales, donde comparar homeScore/awayScore no alcanza para
   * saber el ganador.
   */
  winnerSide?: "home" | "away";
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  date: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore?: number;
  awayScore?: number;
}

export interface NormalizedStanding {
  leagueSlug: string;
  seasonName: string;
  teamExternalId: string;
  played: number;
  wins: number;
  losses: number;
  draws?: number;
  points: number;
  rank?: number;
}

export interface SportsProvider {
  /** Identificador único, ej: "nba-provider" */
  readonly source: string;

  /** Trae partidos próximos y en vivo. */
  fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]>;

  /** Trae partidos finalizados en un rango de fechas (histórico). */
  fetchFinishedGames(from: Date, to: Date): Promise<NormalizedGame[]>;

  /** Trae la tabla de posiciones actual. */
  fetchStandings(): Promise<NormalizedStanding[]>;
}
