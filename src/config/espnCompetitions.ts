import type { EspnSoccerCompetitionConfig } from "@/providers/espn/EspnSoccerCompetitionProvider";

/**
 * Competencias de fútbol que se sincronizan 100% vía ESPN (no pasan
 * por TheSportsDB en absoluto — a diferencia de Liga Profesional, acá
 * directamente no vale la pena intentar con la key gratuita de
 * TheSportsDB dado lo topada que viene esa key para todo lo que no
 * sea "el próximo partido nomás").
 *
 * Slugs de ESPN confirmados contra su propia documentación pública
 * (no adivinados): conmebol.libertadores, conmebol.sudamericana,
 * conmebol.america, arg.copa.
 */
export const espnCompetitions: EspnSoccerCompetitionConfig[] = [
  {
    espnSportPath: "soccer/conmebol.libertadores",
    sportSlug: "futbol",
    leagueSlug: "libertadores",
    seasonBaseName: "Libertadores 2026",
  },
  {
    espnSportPath: "soccer/conmebol.sudamericana",
    sportSlug: "futbol",
    leagueSlug: "sudamericana",
    seasonBaseName: "Sudamericana 2026",
  },
  {
    espnSportPath: "soccer/conmebol.america",
    sportSlug: "futbol",
    leagueSlug: "copa-america",
    seasonBaseName: "Copa América",
  },
  {
    espnSportPath: "soccer/arg.copa",
    sportSlug: "futbol",
    leagueSlug: "copa-argentina",
    seasonBaseName: "Copa Argentina 2026",
  },
];
