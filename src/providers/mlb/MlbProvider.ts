import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * MlbProvider
 *
 * Stub inicial: implementa el contrato SportsProvider pero todavía
 * no llama a ninguna API externa real. Reemplazá el cuerpo de cada
 * método por el fetch + normalización correspondiente.
 *
 * Flujo esperado:
 *   API externa -> este Provider -> Normalizer -> Repository -> MySQL
 */
export class MlbProvider implements SportsProvider {
  readonly source = "mlb-provider";

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Mlb y normalizar la respuesta.
    return [];
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Mlb (histórico) y normalizar.
    return [];
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    // TODO: llamar a la API externa de Mlb y normalizar posiciones.
    return [];
  }
}
