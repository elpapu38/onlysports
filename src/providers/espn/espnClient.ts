// Cliente compartido para la API pública (no oficial, pero estable)
// de ESPN. La misma forma de respuesta sirve para fútbol, básquet,
// etc. — solo cambia el "sportPath" en la URL (ej:
// "soccer/arg.1", "basketball/nba").
import type { NormalizedGame, NormalizedMatchEvent } from "@/types/provider";

const BASE_SITE = "https://site.api.espn.com/apis/site/v2/sports";

export interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  /**
   * Confirmado contra un JSON real: ESPN manda esto explícito,
   * independiente de si el partido se definió en tiempo regular o
   * por penales. Mucho más confiable que comparar el marcador (que
   * queda empatado en un partido de eliminación directa que se fue a
   * penales, haciendo imposible saber el ganador solo con el score).
   */
  winner?: boolean;
  team?: { id?: string; displayName?: string };
}

export interface EspnEvent {
  id: string;
  date: string; // ISO 8601 UTC — se puede pasar directo a `new Date()`
  status?: { type?: { completed?: boolean; state?: string } };
  /** Ej: {"year":2026,"type":13989,"slug":"round-of-16"} — confirmado contra una respuesta real. */
  season?: { slug?: string };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    altGameNote?: string;
    /**
     * Confirmado contra un JSON real de NBA Finals: acá SÍ viene la
     * ronda para NBA (ej: "NBA Finals - Game 1"). altGameNote no
     * existe en absoluto en los eventos de NBA — solo lo usa fútbol.
     * Para fútbol, este campo (notes) casi siempre viene vacío o
     * solo se usa para anotar resultados de penales puntuales, no la
     * ronda — por eso se prueba DESPUÉS de altGameNote, como
     * respaldo específico para deportes que no tienen altGameNote.
     */
    notes?: Array<{ headline?: string }>;
    /** Confirmado contra un JSON real (Copa Argentina / NBA): la cancha viene en venue.fullName. */
    venue?: { fullName?: string };
    /**
     * Confirmado contra un JSON real de Liga Profesional (partidos
     * FULL_TIME): cada entrada trae type.text ("Goal", "Goal - Header",
     * "Penalty - Scored", "Yellow Card"...), clock.displayValue (minuto),
     * team.id, banderas booleanas (scoringPlay, penaltyKick, ownGoal,
     * yellowCard, redCard, shootout) y athletesInvolved[].displayName.
     * En partidos programados viene como [].
     */
    details?: Array<{
      type?: { text?: string };
      clock?: { value?: number; displayValue?: string };
      team?: { id?: string };
      scoringPlay?: boolean;
      penaltyKick?: boolean;
      ownGoal?: boolean;
      yellowCard?: boolean;
      redCard?: boolean;
      shootout?: boolean;
      athletesInvolved?: Array<{ displayName?: string; shortName?: string; team?: { id?: string } }>;
    }>;
  }>;
}

// Traducción best-effort de fases de copa a español. Si no matchea
// ninguna, se muestra el texto de ESPN tal cual (en inglés) antes que
// no mostrar nada.
const ROUND_TRANSLATIONS: Array<[RegExp, string]> = [
  [/round of 32/i, "32vos de Final"],
  [/round of 16/i, "Octavos de Final"],
  [/quarterfinal/i, "Cuartos de Final"],
  [/semifinal/i, "Semifinal"],
  [/^finals?$/i, "Final"],
  [/group stage/i, "Fase de Grupos"],
];

function translateRound(text: string): string {
  for (const [pattern, label] of ROUND_TRANSLATIONS) {
    if (pattern.test(text)) return label;
  }
  return text;
}

/** Extrae y traduce la ronda de un evento, priorizando altGameNote (más específico, incluye el nombre de la competencia) sobre season.slug. */
function extractRound(ev: EspnEvent): string | undefined {
  const altGameNote = ev.competitions?.[0]?.altGameNote;
  if (altGameNote) {
    const roundPart = altGameNote.split(",").pop()?.trim();
    if (roundPart) return translateRound(roundPart);
  }

  // Respaldo para deportes sin altGameNote (ej: NBA) — notes[0].headline
  // trae algo como "NBA Finals - Game 1".
  const noteHeadline = ev.competitions?.[0]?.notes?.[0]?.headline;
  if (noteHeadline) return translateRound(noteHeadline);

  const slug = ev.season?.slug;
  if (slug) return translateRound(slug.replace(/-/g, " "));
  return undefined;
}

function fmtDateParam(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * ESPN dejó de aceptar rangos en `dates=YYYYMMDD-YYYYMMDD` (responde
 * 400 "Failed to get events endpoint"), pero un solo día
 * (`dates=YYYYMMDD`) y la consulta sin `dates` siguen andando — esto
 * se confirmó a mano contra la API real. null = todavía no se probó;
 * se decide con el primer pedido y se recuerda mientras el proceso
 * siga vivo.
 */
let rangeSupported: boolean | null = null;
/** Función (no lectura directa) para que TypeScript no "recuerde" un valor viejo de la variable tras un await. */
const rangesKnownUnsupported = () => rangeSupported === false;

const DAY_FETCH_CONCURRENCY = 4;
/** Tope de días a pedir uno por uno cuando no hay calendario disponible (ej. NBA, que usa otro formato de calendario). */
const MAX_BLIND_DAYS = 120;
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Caché por día del scoreboard. Sin esto, los crons frecuentes (live
 * cada 1 min, today cada 10 min) repetirían decenas de pedidos por
 * liga en cada pasada, porque el modo día-por-día mira 90 días
 * hacia adelante. Solo ayer/hoy/mañana cambian seguido (marcadores
 * en vivo); el resto se refresca cada tanto.
 */
const NEAR_DAY_TTL_MS = 45 * 1000;
const FAR_DAY_TTL_MS = 2 * 60 * 60 * 1000;
const dayCache = new Map<string, { at: number; events: EspnEvent[] }>();

function dayTtlMs(dayKey: string): number {
  const diffDays = Math.abs(dayKeyToDate(dayKey).getTime() - dayKeyToDate(fmtDateParam(new Date())).getTime()) / 86_400_000;
  return diffDays <= 1 ? NEAR_DAY_TTL_MS : FAR_DAY_TTL_MS;
}

interface EspnCalendar {
  /** Días con partidos, formato YYYYMMDD, ordenados. */
  days: string[];
}
const calendarCache = new Map<string, { at: number; value: EspnCalendar | null }>();

function isoToDayKey(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function dayKeyToDate(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
}

/**
 * Calendario de días con partidos que ESPN manda dentro de la propia
 * respuesta del scoreboard (leagues[0].calendar, lista de strings ISO
 * cuando calendarType es "day" — confirmado con arg.1). Sin `anchor`
 * es el de la temporada actual; con `anchor` se pide un día puntual y
 * ESPN devuelve el calendario de la temporada a la que pertenece ese
 * día (no verificado: si lo ignora, quien llama lo detecta y corta).
 * Devuelve null si no hay calendario en formato de días (ej. NBA).
 */
async function fetchCalendar(sportPath: string, anchor?: Date): Promise<EspnCalendar | null> {
  const cacheKey = `${sportPath}:${anchor ? fmtDateParam(anchor) : "now"}`;
  const cached = calendarCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CALENDAR_TTL_MS) return cached.value;

  let value: EspnCalendar | null = null;
  try {
    const url = `${BASE_SITE}/${sportPath}/scoreboard${anchor ? `?dates=${fmtDateParam(anchor)}` : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { leagues?: Array<{ calendar?: unknown[] }> };
      const raw = data.leagues?.[0]?.calendar ?? [];
      const days = raw.filter((c): c is string => typeof c === "string").map(isoToDayKey);
      if (days.length > 0) value = { days: [...new Set(days)].sort() };
    }
  } catch {
    // sin calendario → se cae al modo "todos los días" con tope
  }
  calendarCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** Trae un rango pidiendo cada día por separado (y solo los que tienen partidos, si hay calendario). */
async function fetchEspnScoreboardByDays(sportPath: string, from: Date, to: Date): Promise<EspnEvent[]> {
  // Un día antes de `from`: un partido en vivo que arrancó "ayer" (en el día de ESPN) sigue siendo relevante.
  const fromPad = new Date(from);
  fromPad.setDate(fromPad.getDate() - 1);
  const startKey = fmtDateParam(fromPad);
  const endKey = fmtDateParam(to);
  const inRange = (k: string) => k >= startKey && k <= endKey;

  const days = new Set<string>();
  const current = await fetchCalendar(sportPath);

  if (current) {
    current.days.filter(inRange).forEach((k) => days.add(k));

    // Si el rango arranca antes de la temporada actual (se usa para
    // buscar la final de la edición anterior), de las temporadas
    // previas solo se piden los últimos días del calendario — ahí
    // está la final — en vez de todos los partidos.
    let cursorKey = current.days[0];
    for (let i = 0; i < 3 && startKey < cursorKey; i++) {
      const anchor = dayKeyToDate(cursorKey);
      anchor.setDate(anchor.getDate() - 30);
      if (fmtDateParam(anchor) < startKey) break;
      const prev = await fetchCalendar(sportPath, anchor);
      if (!prev || prev.days[0] >= cursorKey) break; // ESPN ignoró el ancla
      prev.days.slice(-3).filter(inRange).forEach((k) => days.add(k));
      cursorKey = prev.days[0];
    }
  } else {
    // Sin calendario: todos los días del rango, quedándonos con los
    // MAX_BLIND_DAYS más cercanos a hoy para no disparar cientos de pedidos.
    const all: string[] = [];
    const cursor = dayKeyToDate(startKey);
    const end = dayKeyToDate(endKey);
    while (cursor <= end) {
      all.push(fmtDateParam(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    const todayKey = fmtDateParam(new Date());
    const dist = (k: string) => Math.abs(dayKeyToDate(k).getTime() - dayKeyToDate(todayKey).getTime());
    all.sort((x, y) => dist(x) - dist(y)).slice(0, MAX_BLIND_DAYS).forEach((k) => days.add(k));
    if (all.length > MAX_BLIND_DAYS) {
      console.warn(`[espn] ${sportPath}: sin calendario de días, se pidieron solo ${MAX_BLIND_DAYS} de ${all.length} días del rango.`);
    }
  }

  const list = [...days].sort();
  const seen = new Map<string, EspnEvent>();
  let failed = 0;

  for (let i = 0; i < list.length; i += DAY_FETCH_CONCURRENCY) {
    await Promise.all(
      list.slice(i, i + DAY_FETCH_CONCURRENCY).map(async (key) => {
        try {
          const cacheKey = `${sportPath}:${key}`;
          const hit = dayCache.get(cacheKey);
          let events: EspnEvent[];
          if (hit && Date.now() - hit.at < dayTtlMs(key)) {
            events = hit.events;
          } else {
            const res = await fetch(`${BASE_SITE}/${sportPath}/scoreboard?dates=${key}`);
            if (!res.ok) throw new Error(`ESPN respondió ${res.status}`);
            const data = (await res.json()) as { events?: EspnEvent[] };
            events = data.events ?? [];
            dayCache.set(cacheKey, { at: Date.now(), events });
          }
          for (const ev of events) seen.set(ev.id, ev);
        } catch {
          failed++;
        }
      })
    );
  }

  if (list.length > 0 && failed === list.length) {
    throw new Error(`ESPN falló en los ${list.length} días pedidos de ${sportPath}`);
  }
  if (failed > 0) console.warn(`[espn] ${sportPath}: fallaron ${failed} de ${list.length} días pedidos.`);
  return [...seen.values()];
}

export async function fetchEspnScoreboard(sportPath: string, from: Date, to: Date): Promise<EspnEvent[]> {
  if (rangeSupported !== false) {
    const url = `${BASE_SITE}/${sportPath}/scoreboard?dates=${fmtDateParam(from)}-${fmtDateParam(to)}`;
    const res = await fetch(url);
    if (res.ok) {
      rangeSupported = true;
      const data = (await res.json()) as { events?: EspnEvent[] };
      return data.events ?? [];
    }
    if (res.status !== 400) throw new Error(`ESPN respondió ${res.status} en ${url}`);
    if (rangeSupported === null) {
      console.warn("[espn] ESPN rechaza rangos de fechas (400): se pasa a pedir día por día.");
    }
    rangeSupported = false;
  }
  return fetchEspnScoreboardByDays(sportPath, from, to);
}

/**
 * Igual que fetchEspnScoreboard, pero partiendo el rango en pedazos
 * de como máximo `chunkDays` cada uno. ESPN devuelve 400 (Bad
 * Request) si el rango es demasiado ancho de una — nos pasó justo
 * pidiendo 730 días de una sola vez para buscar la final de la
 * edición anterior. 90 días es un tamaño que ya veníamos usando sin
 * problemas en otros lados de la app.
 */
export async function fetchEspnScoreboardChunked(
  sportPath: string,
  from: Date,
  to: Date,
  chunkDays = 90
): Promise<EspnEvent[]> {
  // Si ya sabemos que ESPN no acepta rangos, una sola pasada por días
  // (los pedazos de 90 días repetirían el mismo trabajo).
  if (rangesKnownUnsupported()) return fetchEspnScoreboardByDays(sportPath, from, to);

  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays);
    chunks.push({ from: new Date(cursor), to: chunkEnd > to ? to : chunkEnd });
    cursor = chunkEnd;
  }

  const seen = new Map<string, EspnEvent>();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const events = await fetchEspnScoreboard(sportPath, chunk.from, chunk.to);
      for (const ev of events) seen.set(ev.id, ev);
      // El primer pedazo recién descubrió que no hay rangos: el
      // resto del período se resuelve de una sola vez por días.
      if (rangesKnownUnsupported() && i + 1 < chunks.length) {
        const rest = await fetchEspnScoreboardByDays(sportPath, chunks[i + 1].from, to);
        for (const ev of rest) seen.set(ev.id, ev);
        break;
      }
    } catch (err) {
      // Un pedazo puntual puede fallar (rate limit, etc.) sin que
      // haga falta abortar toda la búsqueda — seguimos con el resto.
      console.warn(`[espn] Falló un pedazo de ${sportPath} (${fmtDateParam(chunk.from)}-${fmtDateParam(chunk.to)}):`, err);
    }
  }
  return [...seen.values()];
}

/**
 * Goles y tarjetas del partido a partir de competitions[0].details.
 * Se ignoran los penales de la tanda (shootout) y todo lo que no sea
 * gol/tarjeta (cambios, etc.). Para goles en contra no hay certeza de
 * a qué equipo los asigna ESPN (no se vio un ejemplo real todavía):
 * se respeta tal cual el team.id que manda.
 */
function extractMatchEvents(ev: EspnEvent, homeId?: string, awayId?: string): NormalizedMatchEvent[] {
  const details = ev.competitions?.[0]?.details ?? [];
  const out: NormalizedMatchEvent[] = [];

  for (const d of details) {
    if (d.shootout) continue;

    let kind: NormalizedMatchEvent["kind"] | null = null;
    if (d.scoringPlay) kind = d.ownGoal ? "own_goal" : d.penaltyKick ? "penalty" : "goal";
    else if (d.redCard) kind = "red";
    else if (d.yellowCard) kind = "yellow";
    if (!kind) continue;

    const athlete = d.athletesInvolved?.[0];
    const teamId = d.team?.id ?? athlete?.team?.id;
    const side: "home" | "away" | undefined = teamId === homeId ? "home" : teamId === awayId ? "away" : undefined;

    out.push({
      kind,
      minute: d.clock?.displayValue ?? "",
      seconds: d.clock?.value,
      player: athlete?.displayName ?? athlete?.shortName ?? "Jugador sin identificar",
      side,
    });
  }

  return out.sort((a, b) => (a.seconds ?? 0) - (b.seconds ?? 0));
}

export function normalizeEspnEvent(
  ev: EspnEvent,
  sportSlug: string,
  leagueSlug: string,
  status: NormalizedGame["status"]
): NormalizedGame | null {
  const competitors = ev.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.displayName || !away?.team?.displayName) return null;

  const homeScore = home.score !== undefined ? Number(home.score) : undefined;
  const awayScore = away.score !== undefined ? Number(away.score) : undefined;
  const round = extractRound(ev);
  const winnerSide: "home" | "away" | undefined = home.winner ? "home" : away.winner ? "away" : undefined;
  const venue = ev.competitions?.[0]?.venue?.fullName?.trim() || undefined;
  const matchEvents = extractMatchEvents(ev, home.team.id, away.team.id);

  return {
    externalId: ev.id,
    sportSlug,
    leagueSlug,
    round,
    winnerSide,
    venue,
    matchEvents: matchEvents.length > 0 ? matchEvents : undefined,
    homeTeam: { externalId: home.team.id ?? home.team.displayName, name: home.team.displayName },
    awayTeam: { externalId: away.team.id ?? away.team.displayName, name: away.team.displayName },
    date: new Date(ev.date),
    status,
    homeScore: Number.isNaN(homeScore) ? undefined : homeScore,
    awayScore: Number.isNaN(awayScore) ? undefined : awayScore,
  };
}
