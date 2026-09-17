import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * Envuelve varias fuentes (API principal, API secundaria, scraper...)
 * para una misma liga y las prueba en orden: la primera que responda
 * con datos gana. Si todas fallan o devuelven vacío, se resigna a
 * devolver vacío — el "caché" en ese caso es simplemente que la base
 * SQLite conserva lo último que se sincronizó con éxito, porque el
 * resto del sistema siempre lee de ahí, nunca de un provider directo.
 *
 * Uso:
 *   new FallbackChainProvider("nba", [theSportsDbNba, bbrefScraperNba])
 */
export class FallbackChainProvider implements SportsProvider {
  constructor(
    public readonly source: string,
    private readonly chain: SportsProvider[]
  ) {}

  fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    return this.tryChain(
      (p) => p.fetchUpcomingAndLiveGames(),
      (r) => r.length === 0
    );
  }

  fetchFinishedGames(from: Date, to: Date): Promise<NormalizedGame[]> {
    return this.tryChain(
      (p) => p.fetchFinishedGames(from, to),
      (r) => r.length === 0
    );
  }

  fetchStandings(): Promise<NormalizedStanding[]> {
    return this.tryChain(
      (p) => p.fetchStandings(),
      (r) => r.length === 0
    );
  }

  private async tryChain<T extends unknown[]>(
    run: (provider: SportsProvider) => Promise<T>,
    isEmpty: (result: T) => boolean
  ): Promise<T> {
    for (const provider of this.chain) {
      try {
        const result = await run(provider);
        if (!isEmpty(result)) {
          return result;
        }
        console.warn(`[fallback:${this.source}] ${provider.source} no trajo datos, probando la siguiente fuente...`);
      } catch (err) {
        console.warn(`[fallback:${this.source}] ${provider.source} falló, probando la siguiente fuente...`, err);
      }
    }
    return [] as unknown as T;
  }
}
