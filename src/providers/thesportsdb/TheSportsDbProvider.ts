import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";
import { env } from "@/config/env";
import type { TheSportsDbLeagueConfig } from "@/config/theSportsDbLeagues";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";

interface RawEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  dateEvent: string;
  strTime: string | null;
  /** ISO 8601 en UTC (con "Z"), cuando TheSportsDB lo provee — más confiable que dateEvent+strTime. */
  strTimestamp: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  strSeason: string | null;
  /** Fase del torneo cuando viene como texto: "Regular Season - 12", "Semifinal", "Final", etc. */
  strRound: string | null;
  /**
   * Fecha/jornada como número (ej: "6") — es lo que trae
   * eventsnextleague.php/eventsseason.php para ligas de fútbol como
   * Liga Profesional Argentina, en vez de strRound. No sirve para
   * detectar finales (es solo un número de fecha del campeonato
   * regular), pero lo guardamos igual para mostrarlo.
   */
  intRound: string | null;
}

interface RawStandingRow {
  idTeam: string;
  strSeason?: string;
  intPlayed?: string;
  intWin?: string;
  intLoss?: string;
  intDraw?: string;
  intPoints?: string;
  intRank?: string;
}

/**
 * Fuerza la lectura de una fecha/hora de TheSportsDB como UTC, sin
 * asumir un formato exacto. Motivo: dábamos por sentado que
 * `strTimestamp` venía en ISO 8601 con "Z" (ej:
 * "2026-08-20T21:00:00Z"), pero en la práctica TheSportsDB lo manda
 * como "2026-08-20 21:00:00" — con espacio en vez de "T" y SIN
 * offset. Sin offset explícito, un string así puede terminar
 * interpretado de forma inconsistente según el motor/versión de
 * Node, y fue la causa de un desfase de 2 horas que reportó el
 * usuario (distinto del desfase de 3 horas que ya habíamos
 * arreglado en dateEvent+strTime). Esta función cubre los dos casos
 * (strTimestamp y dateEvent+strTime) con la misma lógica: normaliza
 * el separador y agrega "Z" si no hay ya un offset explícito.
 */
function parseThesportsdbDate(raw: string): Date {
  let iso = raw.trim().replace(" ", "T");
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  if (!hasOffset) iso += "Z";
  return new Date(iso);
}

function normalizeEvent(raw: RawEvent, cfg: TheSportsDbLeagueConfig): NormalizedGame {
  const date = raw.strTimestamp
    ? parseThesportsdbDate(raw.strTimestamp)
    : parseThesportsdbDate(raw.strTime ? `${raw.dateEvent}T${raw.strTime}` : `${raw.dateEvent}T00:00:00`);

  const homeScore = raw.intHomeScore !== null && raw.intHomeScore !== undefined ? Number(raw.intHomeScore) : undefined;
  const awayScore = raw.intAwayScore !== null && raw.intAwayScore !== undefined ? Number(raw.intAwayScore) : undefined;

  let status: NormalizedGame["status"] = "SCHEDULED";
  if (raw.strStatus && /postponed/i.test(raw.strStatus)) status = "POSTPONED";
  else if (raw.strStatus && /cancel/i.test(raw.strStatus)) status = "CANCELLED";
  else if (homeScore !== undefined && awayScore !== undefined) status = "FINISHED";

  return {
    externalId: String(raw.idEvent),
    sportSlug: cfg.sportSlug,
    leagueSlug: cfg.leagueSlug,
    seasonName: raw.strSeason ?? undefined,
    round: raw.strRound ?? (raw.intRound ? `Fecha ${raw.intRound}` : undefined),
    homeTeam: { externalId: String(raw.idHomeTeam), name: raw.strHomeTeam },
    awayTeam: { externalId: String(raw.idAwayTeam), name: raw.strAwayTeam },
    date,
    status,
    homeScore,
    awayScore,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE_URL}/${env.providers.theSportsDb}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("TheSportsDB: límite de pedidos por minuto alcanzado (30/min en el plan gratis).");
    }
    throw new Error(`TheSportsDB respondió ${res.status} en ${path}`);
  }
  const text = await res.text();
  if (!text.trim()) {
    // Body vacío con status 200: típico de un endpoint al que la key
    // actual no tiene acceso (ej: lookuptable.php con la key pública
    // gratuita "123"). Antes esto reventaba con un SyntaxError de
    // JSON.parse poco claro — ahora queda explícito qué pasó.
    throw new Error(
      `TheSportsDB devolvió una respuesta vacía en ${path} — probablemente la key actual (THESPORTSDB_API_KEY) no tiene acceso a este endpoint. Con la key pública gratuita ("123") esto es esperable en lookuptable.php/eventspastleague.php; una key personal gratuita (thesportsdb.com) suele destrabarlo.`
    );
  }
  return JSON.parse(text) as T;
}

/**
 * Antes esto quedaba en silencio total: la request respondía 200 OK
 * pero con una lista vacía (liga fuera de temporada, o directamente
 * sin cobertura de calendario para la temporada actual — pasa bastante
 * con ligas regionales/menos populares en TheSportsDB, que depende de
 * que su comunidad cargue los partidos). Este warning lo hace visible
 * en los logs para poder diagnosticarlo en vez de preguntarse por qué
 * una liga nunca trae nada.
 */
function warnEmpty(leagueSlug: string, path: string) {
  const isPast = path.startsWith("eventspastleague");
  const hint = isPast
    ? "Si esto pasa con TODAS las ligas configuradas a la vez (no solo una), probablemente no sea falta de cobertura de una liga puntual: la key pública gratuita de TheSportsDB (\"123\") suele dejar de responder resultados históricos. Solución: crear una cuenta gratis en thesportsdb.com y poner tu key personal en THESPORTSDB_API_KEY (.env)."
    : "Puede ser que TheSportsDB no tenga cargado el calendario de la temporada actual para esta liga.";
  console.warn(
    `[thesportsdb] ${leagueSlug}: ${path} respondió 0 eventos. ${hint} Para confirmarlo, abrí a mano: ${BASE_URL}/${env.providers.theSportsDb}/${path}`
  );
}

/**
 * Provider real conectado a TheSportsDB (thesportsdb.com).
 * Usa la key gratuita por defecto ("123"): 30 pedidos/minuto, alcanza
 * para sincronizar las ligas configuradas en config/theSportsDbLeagues.ts.
 *
 * El plan gratis no incluye livescores reales (eso es Premium), así
 * que el estado LIVE no se puede calcular con precisión — un partido
 * queda como SCHEDULED hasta que aparece con resultado, ahí pasa a
 * FINISHED. Para livescores de verdad hace falta una key Premium
 * (~9 USD/mes, ver thesportsdb.com/pricing) — sólo hay que setear
 * THESPORTSDB_API_KEY en el .env, no hace falta tocar código.
 */
export class TheSportsDbProvider implements SportsProvider {
  constructor(private readonly league: TheSportsDbLeagueConfig) {}

  get source() {
    return `thesportsdb:${this.league.leagueSlug}`;
  }

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    const cfg = this.league;
    const games: NormalizedGame[] = [];
    const seenIds = new Set<string>();

    try {
      const path = `eventsnextleague.php?id=${cfg.theSportsDbLeagueId}`;
      const data = await fetchJson<{ events: RawEvent[] | null }>(path);
      const events = data.events ?? [];
      if (events.length === 0) warnEmpty(cfg.leagueSlug, path);
      for (const raw of events) {
        seenIds.add(String(raw.idEvent));
        games.push(normalizeEvent(raw, cfg));
      }
    } catch (err) {
      console.error(`[thesportsdb] Falló fetchUpcoming (${cfg.leagueSlug}):`, err);
    }

    // eventsnextleague.php a veces solo trae 1-2 partidos aunque haya
    // más cargados a futuro en el calendario de la temporada — nos
    // pasó justo con Liga Profesional (traía 1 solo mientras la web
    // mostraba varios más). eventsseason.php trae el calendario
    // completo; lo usamos como complemento, descartando acá los que
    // ya se jugaron (esos los trae el fallback de resultados por otro
    // lado — si los sumáramos acá también, terminarían duplicados).
    if (cfg.currentSeason) {
      try {
        const path = `eventsseason.php?id=${cfg.theSportsDbLeagueId}&s=${cfg.currentSeason}`;
        const data = await fetchJson<{ events: RawEvent[] | null }>(path);
        const events = data.events ?? [];
        for (const raw of events) {
          const id = String(raw.idEvent);
          if (seenIds.has(id)) continue;
          const alreadyPlayed = raw.intHomeScore !== null && raw.intHomeScore !== undefined;
          if (alreadyPlayed) continue;
          seenIds.add(id);
          games.push(normalizeEvent(raw, cfg));
        }
      } catch (err) {
        console.error(`[thesportsdb] Falló fetchUpcoming vía eventsseason (${cfg.leagueSlug}):`, err);
      }
    }

    return games.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    // Nota: eventspastleague.php no acepta rango de fechas — ya
    // devuelve un set acotado de "resultados recientes" por su cuenta
    // (definido por TheSportsDB, no por nosotros). Filtrar de nuevo
    // acá por una ventana corta puede descartar resultados válidos
    // sin motivo (ej: en un receso de temporada, "lo más reciente"
    // puede tener semanas), así que persistimos todo lo que la API
    // ya decidió devolver.
    const cfg = this.league;
    try {
      const path = `eventspastleague.php?id=${cfg.theSportsDbLeagueId}`;
      const data = await fetchJson<{ results: RawEvent[] | null }>(path);
      const results = data.results ?? [];
      if (results.length === 0) warnEmpty(cfg.leagueSlug, path);
      return results.map((raw) => normalizeEvent(raw, cfg));
    } catch (err) {
      console.error(`[thesportsdb] Falló fetchFinished (${cfg.leagueSlug}):`, err);
      return [];
    }
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    const cfg = this.league;
    try {
      const data = await fetchJson<{ table: RawStandingRow[] | null }>(`lookuptable.php?l=${cfg.theSportsDbLeagueId}`);
      return (data.table ?? []).map((row) => ({
        leagueSlug: cfg.leagueSlug,
        seasonName: row.strSeason ?? "actual",
        teamExternalId: String(row.idTeam),
        played: Number(row.intPlayed ?? 0),
        wins: Number(row.intWin ?? 0),
        losses: Number(row.intLoss ?? 0),
        draws: row.intDraw !== undefined ? Number(row.intDraw) : undefined,
        points: Number(row.intPoints ?? 0),
        rank: row.intRank !== undefined ? Number(row.intRank) : undefined,
      }));
    } catch (err) {
      console.error(`[thesportsdb] Falló fetchStandings (${cfg.leagueSlug}):`, err);
      return [];
    }
  }
}
