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

/**
 * Evento cronológico de un partido (gol, tarjeta). Hoy lo llena
 * solo ESPN (competitions[0].details[]), pero el formato es genérico.
 */
export interface NormalizedMatchEvent {
  kind: "goal" | "penalty" | "own_goal" | "yellow" | "red";
  /** Minuto tal cual lo muestra el proveedor, ej: "56'" o "90'+3'". */
  minute: string;
  /** Segundos desde el inicio (para ordenar). */
  seconds?: number;
  player: string;
  /** Equipo al que ESPN asigna el evento (local/visitante). */
  side?: "home" | "away";
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
  /** Cancha/estadio donde se juega, si el proveedor lo informa (ej: ESPN → competitions[0].venue.fullName). */
  venue?: string;
  /** Goles y tarjetas del partido, si el proveedor los informa. */
  matchEvents?: NormalizedMatchEvent[];
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
