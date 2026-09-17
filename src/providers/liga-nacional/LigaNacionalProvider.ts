import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * LigaNacionalProvider
 *
 * Stub inicial: implementa el contrato SportsProvider pero todavía
 * no llama a ninguna API externa real. Reemplazá el cuerpo de cada
 * método por el fetch + normalización correspondiente.
 *
 * Flujo esperado:
 *   API externa -> este Provider -> Normalizer -> Repository -> MySQL
 */
export class LigaNacionalProvider implements SportsProvider {
  readonly source = "liga-nacional-provider";

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de LigaNacional y normalizar la respuesta.
    return [];
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de LigaNacional (histórico) y normalizar.
    return [];
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    // TODO: llamar a la API externa de LigaNacional y normalizar posiciones.
    return [];
  }
}
