import cron from "node-cron";
import { env } from "@/config/env";
import { providers } from "@/providers/registry";
import { syncService } from "@/services/syncService";
import { syncNbaFinalsHistory } from "./nbaFinalsSync";

// Sincronización periódica. Cada tarea recorre todos los providers
// registrados; agregar un deporte nuevo no requiere tocar este archivo.

export function startScheduler() {
  cron.schedule(env.cron.upcoming, () => runSync("upcoming"));
  cron.schedule(env.cron.today, () => runSync("today"));
  cron.schedule(env.cron.live, () => runSync("live"));
  cron.schedule(env.cron.historical, () => runSync("historical"));
  cron.schedule("0 4 * * *", () => runSync("standings")); // una vez al día alcanza

  // Corremos una sincronización apenas arranca la app, para no tener
  // que esperar al primer disparo del cron y ver algo de una.
  runSync("upcoming");
  runSync("historical");
  runSync("standings");
}

export async function runSync(kind: "upcoming" | "today" | "live" | "historical" | "standings") {
  const summary: { source: string; created: number; updated: number }[] = [];

  if (kind === "historical") {
    await syncNbaFinalsHistory();
  }

  for (const provider of providers) {
    try {
      if (kind === "standings") {
        const standings = await provider.fetchStandings();
        if (standings.length > 0) {
          const result = await syncService.persistStandings(standings);
          summary.push({ source: provider.source, ...result });
          console.log(`[scheduler] ${provider.source} (standings): ${result.created} nuevos, ${result.updated} actualizados.`);
        }
        continue;
      }

      let games;
      if (kind === "historical") {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 7);
        games = await provider.fetchFinishedGames(from, to);
      } else {
        games = await provider.fetchUpcomingAndLiveGames();
      }

      if (games.length > 0) {
        const result = await syncService.persistGames(provider.source, games);
        summary.push({ source: provider.source, ...result });
        console.log(`[scheduler] ${provider.source} (${kind}): ${result.created} nuevos, ${result.updated} actualizados.`);

        if (kind === "upcoming" || kind === "today" || kind === "live") {
          const { deleted } = await syncService.pruneStaleUpcoming(provider.source, games);
          if (deleted > 0) {
            console.log(`[scheduler] ${provider.source} (${kind}): ${deleted} partido(s) viejo(s) de otra fuente eliminados (ya no coincidían).`);
          }
        }
      }
    } catch (err) {
      console.error(`[scheduler] Falló sincronización (${kind}) de ${provider.source}:`, err);
    }
  }
  return summary;
}

/** Sincronización manual disparada por el usuario desde Gestión. */
export async function runManualSync() {
  const upcoming = await runSync("upcoming");
  const historical = await runSync("historical");
  const standings = await runSync("standings");
  return [...upcoming, ...historical, ...standings];
}
