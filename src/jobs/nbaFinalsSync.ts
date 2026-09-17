import { fetchEspnScoreboardChunked, normalizeEspnEvent } from "@/providers/espn/espnClient";
import { syncService } from "@/services/syncService";
import type { NormalizedGame } from "@/types/provider";

/**
 * Sincroniza específicamente los partidos de las Finales de la NBA
 * (actual + edición anterior), para poder calcular el campeón.
 *
 * Por qué esto va separado del resto de la cadena de NBA: el scraper
 * de basketball-reference (que ya funciona bien para resultados) no
 * trae info de ronda/fase. Si intentáramos meter esto como parte de
 * la cadena normal (FallbackChainProvider), como esta consulta a
 * ESPN casi siempre va a devolver ALGO no vacío (la final del año
 * pasado ya jugó), terminaría "ganando" la cadena y reemplazando los
 * resultados ricos de basketball-reference por solo 1-2 partidos de
 * final. Por eso corre aparte, solo para completar el dato de
 * campeón sin tocar lo que ya andaba bien.
 *
 * ADVERTENCIA: a diferencia del resto de las traducciones de ronda
 * (confirmadas contra un JSON real de fútbol), el formato exacto que
 * usa ESPN para la ronda en partidos de NBA no se pudo verificar en
 * vivo. Si esto no encuentra la final, revisá la consola por el
 * mensaje de "0 finales encontradas" y avisame.
 */
export async function syncNbaFinalsHistory(): Promise<void> {
  try {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 730);

    const events = await fetchEspnScoreboardChunked("basketball/nba", from, to);
    const allFinished = events
      .filter((ev) => ev.status?.type?.completed)
      .map((ev) => normalizeEspnEvent(ev, "basquet", "nba", "FINISHED"))
      .filter((g): g is NormalizedGame => g !== null);

    const distinctRounds = [...new Set(allFinished.map((g) => g.round).filter(Boolean))];
    console.log(
      `[champion-debug] nba: ${allFinished.length} partidos finalizados en 2 años. Rondas distintas encontradas: ${
        distinctRounds.length > 0 ? distinctRounds.join(" | ") : "(ninguna — ESPN no está mandando season.slug/altGameNote para NBA, o vienen vacíos)"
      }`
    );

    const finals = allFinished.filter((g) => g.round && /\bfinals?\b/i.test(g.round) && !/conference/i.test(g.round));

    if (finals.length === 0) {
      console.warn(
        "[scheduler] espn:nba-finals-history: 0 finales encontradas en 2 años de scoreboard — puede ser que ESPN etiquete la ronda distinto para NBA (no verificado en vivo)."
      );
      return;
    }

    const result = await syncService.persistGames("espn:nba-finals-history", finals);
    console.log(`[scheduler] espn:nba-finals-history: ${result.created} nuevos, ${result.updated} actualizados.`);
  } catch (err) {
    console.error("[scheduler] Falló sync de finales históricas de NBA:", err);
  }
}
