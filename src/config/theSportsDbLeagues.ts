export interface TheSportsDbLeagueConfig {
  /** ID de la liga en TheSportsDB (ver thesportsdb.com/sport/leagues) */
  theSportsDbLeagueId: string;
  /** Slug interno de OnlySports — se crea solo si no existe */
  sportSlug: string;
  sportName: string;
  /** Slug interno de OnlySports — se crea solo si no existe */
  leagueSlug: string;
  leagueName: string;
  /**
   * Temporada actual tal como la identifica TheSportsDB (campo
   * strSeason en sus respuestas) — ej: "2026" para Liga Profesional
   * Argentina (usa año calendario), "2025-2026" para NBA (cruza dos
   * años). Se usa para pedir eventsseason.php como complemento de
   * eventsnextleague.php: este último a veces solo trae 1-2 partidos
   * aunque haya más cargados a futuro en el calendario completo de la
   * temporada (nos pasó justo con Liga Profesional). Si no se
   * especifica, la liga se queda solo con lo que traiga
   * eventsnextleague.php.
   */
  currentSeason?: string;
}

/**
 * Ligas que se sincronizan automáticamente al arrancar la app y en
 * cada corrida del scheduler. Para agregar una liga nueva:
 *
 *   1. Buscá su ID en https://www.thesportsdb.com/sport/leagues
 *      (o con la API: search_all_leagues.php?c=PAIS&s=DEPORTE)
 *   2. Agregá una entrada acá abajo.
 *
 * No hace falta crear el Sport/League desde Gestión primero: se crean
 * solos la primera vez que se sincronizan.
 */
export const theSportsDbLeagues: TheSportsDbLeagueConfig[] = [
  { theSportsDbLeagueId: "4387", sportSlug: "basquet", sportName: "Básquet", leagueSlug: "nba", leagueName: "NBA", currentSeason: "2025-2026" },
  { theSportsDbLeagueId: "4734", sportSlug: "basquet", sportName: "Básquet", leagueSlug: "liga-nacional", leagueName: "Liga Nacional de Básquet", currentSeason: "2025-2026" },
  // "2026" confirmado contra la respuesta real de la API (strSeason) —
  // a diferencia de NBA, el fútbol argentino usa año calendario simple.
  { theSportsDbLeagueId: "4406", sportSlug: "futbol", sportName: "Fútbol", leagueSlug: "liga-profesional", leagueName: "Liga Profesional Argentina", currentSeason: "2026" },
  // Ejemplo listo para descomentar si más adelante querés MLB también:
  // { theSportsDbLeagueId: "4424", sportSlug: "beisbol", sportName: "Béisbol", leagueSlug: "mlb", leagueName: "MLB" },
];
