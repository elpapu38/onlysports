import { CheerioScraperProvider } from "./CheerioScraperProvider";
import type { NormalizedGame, NormalizedStanding } from "@/types/provider";

const CONFERENCE_TABLE_IDS = ["confs_standings_E", "confs_standings_W"];

// Meses de temporada regular + playoffs, en el orden en que basketball-reference
// los expone como páginas separadas: NBA_<year>_games-<mes>.html
const SEASON_MONTHS = ["october", "november", "december", "january", "february", "march", "april", "may", "june"];

function currentNbaSeasonEndYear(): number {
  // La temporada "2025-26" se identifica en basketball-reference como
  // "2026" (el año en que termina). La temporada corre de octubre a
  // junio; de julio a septiembre seguimos mostrando la que acaba de
  // terminar hasta que arranque la nueva.
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return month >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Determina qué páginas mensuales de basketball-reference conviene
 * scrapear para tener partidos "recientes" (para /resultados, que
 * solo necesita los últimos 5 por liga, no el historial completo).
 * Devuelve los últimos 1-2 meses con partidos jugados, sin importar
 * si estamos en plena temporada o en receso (jul-sep).
 */
function recentMonthsToScrape(): { seasonEndYear: number; months: string[] } {
  const now = new Date();
  const m = now.getMonth() + 1; // 1-12

  if (m >= 10) {
    // Oct-Dic: temporada en curso, termina el año que viene
    const idx = m - 10; // 0=oct,1=nov,2=dic
    const months = idx > 0 ? [SEASON_MONTHS[idx], SEASON_MONTHS[idx - 1]] : [SEASON_MONTHS[idx]];
    return { seasonEndYear: now.getFullYear() + 1, months };
  }
  if (m <= 6) {
    // Ene-Jun: temporada en curso (incluye playoffs en abr/may/jun)
    const idx = m - 1 + 3; // ene=3 (oct=0,nov=1,dic=2,ene=3,...)
    const months = idx > 0 ? [SEASON_MONTHS[idx], SEASON_MONTHS[idx - 1]] : [SEASON_MONTHS[idx]];
    return { seasonEndYear: now.getFullYear(), months };
  }
  // Jul-Sep: receso, no hay partidos nuevos — traer el cierre de la
  // temporada que acaba de terminar (mayo/junio, cuando están las
  // Finals) para que "últimos 5" no quede vacío todo el verano.
  return { seasonEndYear: now.getFullYear(), months: ["june", "may"] };
}

/**
 * Scraper de respaldo para NBA (resultados + standings) — se usa
 * cuando TheSportsDB no devuelve datos (caída, fuera de temporada,
 * límite de pedidos alcanzado, o directamente porque la key gratuita
 * de TheSportsDB dejó de servir eventspastleague.php/lookuptable.php,
 * que es lo que nos pasó en agosto 2026).
 *
 * Depende del HTML público de basketball-reference.com. Usa los
 * atributos `data-stat` de sus tablas, que es la convención que usa
 * toda la red Sports-Reference — más estable que depender de si la
 * celda es <td> o <th>, pero igual puede romperse si el sitio cambia
 * de estructura; si eso pasa, solo hay que tocar este archivo.
 */
export class BasketballReferenceNbaProvider extends CheerioScraperProvider {
  readonly source = "scraper:basketball-reference:nba";

  async fetchStandings(): Promise<NormalizedStanding[]> {
    const year = currentNbaSeasonEndYear();
    const url = `https://www.basketball-reference.com/leagues/NBA_${year}_standings.html`;

    try {
      const $ = await this.fetchHtml(url);
      const standings: NormalizedStanding[] = [];

      for (const tableId of CONFERENCE_TABLE_IDS) {
        let rank = 0;
        $(`table#${tableId} tbody tr`).each((_index, row) => {
          const $row = $(row);
          if ($row.hasClass("thead")) return; // fila de encabezado repetida en medio de la tabla

          const teamCell = $row.find('[data-stat="team_name"]');
          const teamName = teamCell.find("a").text().trim() || teamCell.text().replace(/\*/g, "").trim();
          const wins = parseInt($row.find('[data-stat="wins"]').text(), 10);
          const losses = parseInt($row.find('[data-stat="losses"]').text(), 10);

          if (!teamName || Number.isNaN(wins) || Number.isNaN(losses)) return;

          rank += 1;
          standings.push({
            leagueSlug: "nba",
            seasonName: `${year - 1}-${String(year).slice(2)}`,
            teamExternalId: teamName, // basketball-reference no da un id numérico simple acá; matcheamos por nombre
            played: wins + losses,
            wins,
            losses,
            points: wins, // la NBA no tiene "puntos" de posición, se ordena por W/L%
            rank,
          });
        });
      }

      return standings;
    } catch (err) {
      console.error("[scraper:basketball-reference] Falló fetchStandings:", err);
      return [];
    }
  }

  async fetchFinishedGames(): Promise<NormalizedGame[]> {
    const { seasonEndYear, months } = recentMonthsToScrape();
    const games: NormalizedGame[] = [];

    for (const month of months) {
      const url = `https://www.basketball-reference.com/leagues/NBA_${seasonEndYear}_games-${month}.html`;
      try {
        const $ = await this.fetchHtml(url);

        $("table#schedule tbody tr").each((_index, row) => {
          const $row = $(row);
          if ($row.hasClass("thead")) return;

          // El link del box score trae el id único del partido y su
          // fecha en el propio nombre de archivo, ej:
          // /boxscores/202510210OKC.html -> 2025-10-21, id "202510210OKC".
          // Es más confiable que parsear la celda de fecha a mano, y de
          // paso nos da un externalId listo para usar. Si todavía no se
          // jugó, este link no existe — así filtramos automáticamente
          // los partidos pendientes.
          const boxScoreHref = $row.find('[data-stat="box_score_text"] a').attr("href");
          const match = boxScoreHref?.match(/\/boxscores\/(\d{4})(\d{2})(\d{2})0[A-Z]+\.html/);
          if (!match) return;

          const [full, yyyy, mm, dd] = match;
          const externalId = full.replace(/^\/boxscores\//, "").replace(/\.html$/, "");

          const visitorName = $row.find('[data-stat="visitor_team_name"] a').text().trim();
          const homeName = $row.find('[data-stat="home_team_name"] a').text().trim();
          const visitorPts = parseInt($row.find('[data-stat="visitor_pts"]').text(), 10);
          const homePts = parseInt($row.find('[data-stat="home_pts"]').text(), 10);

          if (!visitorName || !homeName || Number.isNaN(visitorPts) || Number.isNaN(homePts)) return;

          games.push({
            // Mismo formato de externalId que usa basketball-reference
            // para el box score — único por partido en su sitio.
            externalId,
            sportSlug: "basquet",
            leagueSlug: "nba",
            homeTeam: { externalId: homeName, name: homeName },
            awayTeam: { externalId: visitorName, name: visitorName },
            // Precisión de solo fecha (mediodía UTC): esto alimenta la
            // sección de Resultados, que muestra el día pero no la
            // hora exacta — evita tener que convertir el horario ET
            // que muestra basketball-reference a UTC real.
            date: new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`),
            status: "FINISHED",
            homeScore: homePts,
            awayScore: visitorPts,
          });
        });
      } catch (err) {
        console.error(`[scraper:basketball-reference] Falló fetchFinishedGames (${month}):`, err);
      }
    }

    return games;
  }
}
