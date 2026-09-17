import { prisma } from "@/config/database";
import { env } from "@/config/env";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const CHECKED_KEY = "detalle_checked";
const SCORER_KEY = "gol";

/**
 * Forma real de la respuesta de lookuptimeline.php no verificada
 * contra un pedido en vivo (este entorno no tiene salida a internet
 * hacia thesportsdb.com) — mapeamos a los nombres de campo más
 * comunes documentados/vistos en ejemplos de la API, pero si
 * TheSportsDB devuelve otra forma, esto simplemente no encuentra
 * nada y no rompe la página. Si ves en la consola que sí hay datos
 * pero no se muestran, avisame la forma real del JSON y lo ajusto.
 */
interface RawTimelineEntry {
  strTimelineType?: string | null; // ej: "Goal", "Yellow Card"
  strTimelineDetail?: string | null;
  strTimelinePlayer?: string | null;
  strTimelineTeam?: string | null;
  strTimelineHome?: string | null; // "1" = local, "0" = visitante, según el evento
  intTimelineTime?: string | null; // minuto
  strTime?: string | null;
}

async function fetchTimeline(externalId: string): Promise<RawTimelineEntry[]> {
  const url = `${BASE_URL}/${env.providers.theSportsDb}/lookuptimeline.php?id=${externalId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB timeline respondió ${res.status}`);
  const data = (await res.json()) as { timeline: RawTimelineEntry[] | null };
  return data.timeline ?? [];
}

function isGoalEvent(entry: RawTimelineEntry): boolean {
  const type = entry.strTimelineType?.toLowerCase() ?? "";
  return type.includes("goal") && !type.includes("disallowed") && !type.includes("own"); // los goles en contra los queremos igual, pero con aclaración aparte si hace falta más adelante
}

function describeScorer(entry: RawTimelineEntry): string {
  const minute = entry.intTimelineTime ?? entry.strTime;
  const player = entry.strTimelinePlayer ?? "Jugador sin identificar";
  const team = entry.strTimelineTeam;
  const minutePart = minute ? `${minute}' ` : "";
  const teamPart = team ? ` (${team})` : "";
  return `${minutePart}${player}${teamPart}`;
}

export const matchDetailsService = {
  /**
   * Intenta completar el detalle de goleadores de un partido de
   * fútbol ya finalizado, sincronizado vía TheSportsDB, y lo cachea
   * como GameStatistic para no volver a pedirlo. No hace nada (ni
   * tira error) si:
   *  - el partido no es de fútbol/no vino de TheSportsDB,
   *  - ya se intentó antes (se marca "detalle_checked" haya o no
   *    encontrado datos, para no golpear la API en cada visita),
   *  - la key configurada es la gratuita pública ("123"): en la
   *    práctica ese endpoint casi no funciona con esa key.
   */
  async ensureGoalScorers(game: {
    id: number;
    externalId: string | null;
    providerSource: string | null;
    status: string;
    sportSlug?: string;
    statistics: { key: string }[];
  }): Promise<void> {
    if (game.status !== "FINISHED") return;
    if (!game.externalId || !game.providerSource?.startsWith("thesportsdb:")) return;
    if (env.providers.theSportsDb === "123") return; // ver nota arriba
    if (game.statistics.some((s) => s.key === CHECKED_KEY)) return;

    try {
      const timeline = await fetchTimeline(game.externalId);
      const goals = timeline.filter(isGoalEvent);

      for (const goal of goals) {
        await prisma.gameStatistic.create({
          data: { gameId: game.id, key: SCORER_KEY, value: describeScorer(goal) },
        });
      }
    } catch (err) {
      console.warn(`[matchDetails] No se pudo traer el timeline del partido ${game.id}:`, err);
    } finally {
      // Se marca "checked" incluso si falló o vino vacío, para no
      // reintentar en cada visita a la página del partido.
      await prisma.gameStatistic.create({ data: { gameId: game.id, key: CHECKED_KEY, value: "1" } }).catch(() => {});
    }
  },
};
