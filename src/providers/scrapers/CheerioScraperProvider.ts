import * as cheerio from "cheerio";
import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * Base genérica para providers que scrapean HTML en vez de llamar una
 * API. Un provider concreto extiende esto e implementa `parseGames` /
 * `parseStandings` sobre el $ (cheerio) ya cargado — el fetch + manejo
 * de errores queda resuelto acá.
 *
 * Por diseño, cada subclase declara qué URL scrapear y cómo convertir
 * las filas de la tabla al formato normalizado — el resto del sistema
 * (scheduler, syncService, repositories) no distingue un scraper de
 * una API real, ambos son un SportsProvider más.
 */
export abstract class CheerioScraperProvider implements SportsProvider {
  abstract readonly source: string;

  protected async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const res = await fetch(url, {
      headers: {
        // Solo User-Agent no alcanzó para worldfootball.net (devolvía
        // 403) — algunos sitios chequean también estos otros headers
        // típicos de un navegador real antes de dejar pasar la
        // request. basketball-reference no los necesitaba, pero no
        // está de más tenerlos acá para cualquier scraper futuro.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        Referer: `${new URL(url).origin}/`,
      },
    });
    if (!res.ok) {
      throw new Error(`Scraper: ${url} respondió ${res.status}`);
    }
    const html = await res.text();
    return cheerio.load(html);
  }

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    return [];
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    return [];
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    return [];
  }
}
