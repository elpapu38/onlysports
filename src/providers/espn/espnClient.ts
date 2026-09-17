// Cliente compartido para la API pública (no oficial, pero estable)
// de ESPN. La misma forma de respuesta sirve para fútbol, básquet,
// etc. — solo cambia el "sportPath" en la URL (ej:
// "soccer/arg.1", "basketball/nba").
import type { NormalizedGame } from "@/types/provider";

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

export async function fetchEspnScoreboard(sportPath: string, from: Date, to: Date): Promise<EspnEvent[]> {
  const url = `${BASE_SITE}/${sportPath}/scoreboard?dates=${fmtDateParam(from)}-${fmtDateParam(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN respondió ${res.status} en ${url}`);
  const data = (await res.json()) as { events?: EspnEvent[] };
  return data.events ?? [];
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
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays);
    chunks.push({ from: new Date(cursor), to: chunkEnd > to ? to : chunkEnd });
    cursor = chunkEnd;
  }

  const seen = new Map<string, EspnEvent>();
  for (const chunk of chunks) {
    try {
      const events = await fetchEspnScoreboard(sportPath, chunk.from, chunk.to);
      for (const ev of events) seen.set(ev.id, ev);
    } catch (err) {
      // Un pedazo puntual puede fallar (rate limit, etc.) sin que
      // haga falta abortar toda la búsqueda — seguimos con el resto.
      console.warn(`[espn] Falló un pedazo de ${sportPath} (${fmtDateParam(chunk.from)}-${fmtDateParam(chunk.to)}):`, err);
    }
  }
  return [...seen.values()];
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

  return {
    externalId: ev.id,
    sportSlug,
    leagueSlug,
    round,
    winnerSide,
    homeTeam: { externalId: home.team.id ?? home.team.displayName, name: home.team.displayName },
    awayTeam: { externalId: away.team.id ?? away.team.displayName, name: away.team.displayName },
    date: new Date(ev.date),
    status,
    homeScore: Number.isNaN(homeScore) ? undefined : homeScore,
    awayScore: Number.isNaN(awayScore) ? undefined : awayScore,
  };
}
