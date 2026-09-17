// Heurística para detectar si un partido fue una final de campeonato
// a partir de la ronda que informa el proveedor (guardada como
// GameStatistic con key "round").
//
// BUG ENCONTRADO Y ARREGLADO ACÁ: las etiquetas en español que arma
// este mismo sistema ("Octavos de Final", "Cuartos de Final", "32vos
// de Final") TERMINAN con la palabra "Final" — el chequeo anterior
// solo excluía "semi/cuartos/quarter" y se olvidaba de "octavos"
// (y "32vos"/"dieciseisavos"), así que casi cualquier partido de
// octavos con ganador quedaba marcado como si fuera LA final. Ahora
// se excluye explícitamente cualquier frase que sea claramente una
// ronda previa, y recién ahí se busca la palabra "final" como
// palabra completa.
function isFinalRound(round?: string | null): boolean {
  if (!round) return false;
  const normalized = round.trim().toLowerCase();
  const isEarlierRound = /octavos|cuartos|semi|dieciseisavos|32vos|16vos|quarterfinal|quarter-final|round of|regular season|fecha\s*\d|conference/i.test(
    normalized
  );
  if (isEarlierRound) return false;
  return /\bfinals?\b/i.test(normalized);
}

export { isFinalRound };

export function findRound(statistics: { key: string; value: string }[] | undefined): string | undefined {
  return statistics?.find((s) => s.key === "round")?.value;
}

function findWinnerSide(statistics: { key: string; value: string }[] | undefined): "home" | "away" | undefined {
  const value = statistics?.find((s) => s.key === "winner")?.value;
  return value === "home" || value === "away" ? value : undefined;
}

/**
 * Nombre del equipo campeón si el partido es una final ya finalizada,
 * o undefined si no aplica.
 *
 * BUG ENCONTRADO Y ARREGLADO ACÁ: antes esto solo comparaba
 * homeScore/awayScore, y devolvía undefined si estaban empatados —
 * pero una final de copa que se define por penales queda empatada en
 * tiempo regular (ej: Copa Argentina, Libertadores), así que nunca
 * se detectaba el campeón en esos casos aunque la ronda sí matcheara
 * como "Final". Ahora se usa primero el dato explícito de ganador que
 * informa el proveedor (ESPN manda esto en su propio JSON,
 * independiente del resultado en tiempo regular), y solo si no está
 * disponible se cae a comparar el marcador.
 */
export function championName(game: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  statistics?: { key: string; value: string }[];
}): string | undefined {
  const round = findRound(game.statistics);
  if (game.status !== "FINISHED" || !isFinalRound(round)) return undefined;

  const winnerSide = findWinnerSide(game.statistics);
  if (winnerSide) return winnerSide === "home" ? game.homeTeam.name : game.awayTeam.name;

  if (game.homeScore === null || game.awayScore === null) return undefined;
  if (game.homeScore === game.awayScore) return undefined; // empate sin dato de ganador explícito — no podemos saber quién ganó
  return game.homeScore > game.awayScore ? game.homeTeam.name : game.awayTeam.name;
}

export interface ChampionState {
  previous?: { team: string; year: number };
  /** undefined = la edición actual todavía no tiene campeón definido. */
  current?: { team: string; year: number };
  isBackToBack: boolean;
}

/**
 * Devuelve 1 o 2 líneas en español para mostrar el estado del
 * campeonato, siempre explícito:
 * - Si hay campeón anterior: "Campeón edición anterior (2025): Boca"
 * - Si la actual ya se definió: "Campeón edición actual (2026): River" (+ bicampeón si aplica)
 * - Si la actual NO se definió: "Campeón edición actual: todavía no definido" (nunca se omite en silencio)
 */
export function championLines(info: ChampionState): string[] {
  const lines: string[] = [];

  if (info.previous) {
    lines.push(`🏆 Campeón edición anterior (${info.previous.year}): ${info.previous.team}`);
  }

  if (info.current) {
    const suffix = info.isBackToBack ? " 🔁 (bicampeón — también ganó la edición anterior)" : "";
    lines.push(`🏆 Campeón edición actual (${info.current.year}): ${info.current.team}${suffix}`);
  } else {
    lines.push(`⏳ Campeón edición actual: todavía no definido`);
  }

  return lines;
}
