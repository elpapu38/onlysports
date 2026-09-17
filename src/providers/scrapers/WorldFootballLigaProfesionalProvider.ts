import { CheerioScraperProvider } from "./CheerioScraperProvider";
import type * as cheerio from "cheerio";
import type { NormalizedGame, NormalizedStanding } from "@/types/provider";

// URL estable: worldfootball.net muestra la temporada actual acá sin
// necesidad de indicar el semestre/año a mano (Apertura/Clausura).
const ALL_MATCHES_URL = "https://www.worldfootball.net/competition/co103/argentina-primera-division/all-matches/";

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
const SCORE_RE = /^\d+:\d+$/;
// Los links a la ficha del partido siempre tienen esta forma:
// /match-report/co103/<algo>/ma<id>/<slug-local>_<slug-visitante>/
const MATCH_LINK_RE = /\/match-report\/co103\/[a-z0-9-]+\/(ma\d+)\/([a-z0-9-]+)_([a-z0-9-]+)\//;

interface ScrapedMatch {
  date: string; // dd.mm.yyyy
  matchId: string;
  homeSlug: string;
  awaySlug: string;
  homeScore: number;
  awayScore: number;
}

function slugToName(slug: string): string {
  // Aproximación razonable ("belgrano-de-cordoba" -> "Belgrano De
  // Cordoba"). No siempre va a coincidir carácter por carácter con el
  // nombre que usa TheSportsDB (acentos, "de"/"De", abreviaturas), así
  // que en el peor caso este scraper crea una fila de equipo duplicada
  // en vez de reusar la existente — no rompe nada, pero puede generar
  // algún equipo repetido en Gestión que convenga fusionar a mano.
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Recorre el documento en el orden en que aparece el texto, sin
 * depender de clases/ids de tabla puntuales (que no pudimos verificar
 * contra el HTML real al escribir esto — worldfootball.net no está
 * accesible desde el entorno donde se generó este código). Cada vez
 * que aparece un texto con forma de fecha ("15.08.2026") lo recuerda
 * como "fecha actual", y cada link a /match-report/ con un marcador
 * "N:N" como texto (el resultado) se guarda con esa fecha. Es más
 * robusto a cambios de maquetado que un selector CSS específico,
 * porque solo depende de que el orden fecha→partidos se mantenga.
 */
function extractMatches($: cheerio.CheerioAPI): ScrapedMatch[] {
  const results: ScrapedMatch[] = [];
  let currentDate: string | null = null;

  function walk(node: any) {
    if (!node) return;
    if (node.type === "text") {
      const text = (node.data ?? "").trim();
      if (DATE_RE.test(text)) currentDate = text;
    } else if (node.type === "tag" && node.name === "a") {
      const href: string | undefined = node.attribs?.href;
      const match = href?.match(MATCH_LINK_RE);
      if (match) {
        const text = $(node).text().trim();
        if (SCORE_RE.test(text) && currentDate) {
          const [home, away] = text.split(":").map((n) => parseInt(n, 10));
          if (!Number.isNaN(home) && !Number.isNaN(away)) {
            results.push({
              date: currentDate,
              matchId: match[1],
              homeSlug: match[2],
              awaySlug: match[3],
              homeScore: home,
              awayScore: away,
            });
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  }

  walk($.root().get(0));
  return results;
}

/**
 * Scraper de respaldo para resultados de Liga Profesional Argentina
 * (fútbol) — se usa cuando TheSportsDB no devuelve partidos jugados
 * (pasó con la key gratuita "123" en agosto 2026, ver notas en
 * TheSportsDbProvider.ts).
 *
 * IMPORTANTE — a diferencia del scraper de NBA (basketball-reference),
 * este está escrito SIN poder verificar el HTML real de
 * worldfootball.net contra selectores CSS concretos: el entorno donde
 * se escribió este código no tenía salida de red hacia ese sitio. Por
 * eso usa una técnica más genérica (recorrer el documento buscando
 * patrones de texto/links en vez de clases puntuales, ver
 * `extractMatches`), pero si worldfootball.net cambia su maquetado o
 * el patrón no encaja como se esperaba, puede devolver 0 resultados
 * en vez de romper — revisá la consola si eso pasa y avisá para
 * ajustar este archivo con el HTML real.
 *
 * No incluye standings todavía: la tabla de posiciones de esta liga
 * está dividida en zonas con pestañas (Overall/Home/Away) en
 * worldfootball.net, una estructura bastante más compleja de scrapear
 * de forma confiable sin poder inspeccionar el HTML real primero.
 */
export class WorldFootballLigaProfesionalProvider extends CheerioScraperProvider {
  readonly source = "scraper:worldfootball:liga-profesional";

  async fetchFinishedGames(): Promise<NormalizedGame[]> {
    try {
      const $ = await this.fetchHtml(ALL_MATCHES_URL);
      const matches = extractMatches($);

      if (matches.length === 0) {
        console.warn(
          `[scraper:worldfootball] liga-profesional: no se encontró ningún partido en ${ALL_MATCHES_URL}. Es probable que worldfootball.net haya cambiado su maquetado — este scraper depende de patrones de texto que se escribieron sin poder ver el HTML real (ver comentario en el archivo).`
        );
        return [];
      }

      // Nos quedamos con los más recientes: alcanza y sobra para
      // "últimos 5" en /resultados, y evita persistir cientos de
      // partidos viejos en cada sync.
      const sorted = matches
        .slice()
        .sort((a, b) => parseDdMmYyyy(b.date).getTime() - parseDdMmYyyy(a.date).getTime())
        .slice(0, 20);

      return sorted.map((m) => {
        const date = parseDdMmYyyy(m.date);
        return {
          externalId: m.matchId,
          sportSlug: "futbol",
          leagueSlug: "liga-profesional",
          homeTeam: { externalId: m.homeSlug, name: slugToName(m.homeSlug) },
          awayTeam: { externalId: m.awaySlug, name: slugToName(m.awaySlug) },
          date,
          status: "FINISHED",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        } satisfies NormalizedGame;
      });
    } catch (err) {
      console.error("[scraper:worldfootball] Falló fetchFinishedGames (liga-profesional):", err);
      return [];
    }
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    // Ver nota de la clase: no implementado todavía por la
    // complejidad de las tablas por zona en worldfootball.net.
    return [];
  }
}

function parseDdMmYyyy(s: string): Date {
  const [dd, mm, yyyy] = s.split(".").map((n) => parseInt(n, 10));
  // Igual que en el scraper de NBA: precisión de solo fecha (mediodía
  // UTC), suficiente para lo que muestra /resultados.
  return new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
}
