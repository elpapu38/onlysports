import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * NbaProvider
 *
 * Stub inicial: implementa el contrato SportsProvider pero todavía
 * no llama a ninguna API externa real. Reemplazá el cuerpo de cada
 * método por el fetch + normalización correspondiente.
 *
 * Flujo esperado:
 *   API externa -> este Provider -> Normalizer -> Repository -> MySQL
 */
export class NbaProvider implements SportsProvider {
  readonly source = "nba-provider";

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Nba y normalizar la respuesta.
    return [];
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Nba (histórico) y normalizar.
    return [];
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    // TODO: llamar a la API externa de Nba y normalizar posiciones.
    return [];
  }
}
