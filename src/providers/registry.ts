import type { SportsProvider } from "@/types/provider";
import { NbaProvider } from "./nba/NbaProvider";
import { MlbProvider } from "./mlb/MlbProvider";
import { FootballProvider } from "./football/FootballProvider";
import { LigaNacionalProvider } from "./liga-nacional/LigaNacionalProvider";
import { TheSportsDbProvider } from "./thesportsdb/TheSportsDbProvider";
import { BasketballReferenceNbaProvider } from "./scrapers/BasketballReferenceNbaProvider";
import { WorldFootballLigaProfesionalProvider } from "./scrapers/WorldFootballLigaProfesionalProvider";
import { EspnSoccerCompetitionProvider } from "./espn/EspnSoccerCompetitionProvider";
import { EspnNbaUpcomingProvider } from "./espn/EspnNbaUpcomingProvider";
import { FallbackChainProvider } from "./FallbackChainProvider";
import { theSportsDbLeagues } from "@/config/theSportsDbLeagues";
import { espnCompetitions } from "@/config/espnCompetitions";

// Registro central de proveedores. Agregar un deporte nuevo implica:
// crear su Provider (API o scraper) + agregarlo acá. Nada más del
// sistema necesita cambiar.
//
// El resto (NbaProvider/MlbProvider/FootballProvider/LigaNacional
// Provider) siguen siendo esqueletos vacíos — quedan como punto de
// partida por si en algún momento conectás una fuente distinta.
//
// IMPORTANTE sobre el orden de las cadenas: no alcanza con "TheSportsDB
// primero, scraper de respaldo después" para NADA de lo que involucre
// más de 1-2 resultados. Con la key gratuita ("123"), TheSportsDB
// devuelve como máximo 1-2 eventos en eventsnextleague.php, y
// eventsseason.php (que en teoría trae el calendario completo) tiene
// un límite documentado de 1 resultado en el plan gratis. El problema
// es que como esos endpoints NO devuelven vacío (devuelven 1 evento
// válido), el FallbackChainProvider los toma como "éxito" y nunca
// prueba el scraper/ESPN — por eso invertimos el orden acá: la fuente
// más completa va primero, TheSportsDB queda de respaldo.
const espnLigaProfesional = new EspnSoccerCompetitionProvider({
  espnSportPath: "soccer/arg.1",
  sportSlug: "futbol",
  leagueSlug: "liga-profesional",
  seasonBaseName: "2026",
});

const chainBuildersByLeagueSlug: Record<string, (primary: SportsProvider) => SportsProvider[]> = {
  nba: (primary) => [new EspnNbaUpcomingProvider(), new BasketballReferenceNbaProvider(), primary],
  "liga-profesional": (primary) => [espnLigaProfesional, primary, new WorldFootballLigaProfesionalProvider()],
};

const leagueProviders: SportsProvider[] = theSportsDbLeagues.map((cfg) => {
  const primary = new TheSportsDbProvider(cfg);
  const chain = chainBuildersByLeagueSlug[cfg.leagueSlug]?.(primary) ?? [primary];
  if (chain.length === 1) return primary;
  return new FallbackChainProvider(cfg.leagueSlug, chain);
});

// Copas de CONMEBOL/Argentina: no pasan por TheSportsDB en absoluto,
// van directo con ESPN como única fuente (ver nota en
// config/espnCompetitions.ts).
const cupProviders: SportsProvider[] = espnCompetitions.map((cfg) => new EspnSoccerCompetitionProvider(cfg));

export const providers: SportsProvider[] = [
  ...leagueProviders,
  ...cupProviders,
  new NbaProvider(),
  new MlbProvider(),
  new FootballProvider(),
  new LigaNacionalProvider(),
];
