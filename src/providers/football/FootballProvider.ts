import type { SportsProvider, NormalizedGame, NormalizedStanding } from "@/types/provider";

/**
 * FootballProvider
 *
 * Stub inicial: implementa el contrato SportsProvider pero todavía
 * no llama a ninguna API externa real. Reemplazá el cuerpo de cada
 * método por el fetch + normalización correspondiente.
 *
 * Flujo esperado:
 *   API externa -> este Provider -> Normalizer -> Repository -> MySQL
 */
export class FootballProvider implements SportsProvider {
  readonly source = "football-provider";

  async fetchUpcomingAndLiveGames(): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Football y normalizar la respuesta.
    return [];
  }

  async fetchFinishedGames(_from: Date, _to: Date): Promise<NormalizedGame[]> {
    // TODO: llamar a la API externa de Football (histórico) y normalizar.
    return [];
  }

  async fetchStandings(): Promise<NormalizedStanding[]> {
    // TODO: llamar a la API externa de Football y normalizar posiciones.
    return [];
  }
}
