import { prisma } from "@/config/database";
import type { NormalizedGame, NormalizedStanding } from "@/types/provider";

async function ensureSport(slug: string, name: string) {
  return prisma.sport.upsert({
    where: { slug },
    update: {},
    create: { slug, name },
  });
}

async function ensureLeague(slug: string, name: string, sportId: number) {
  return prisma.league.upsert({
    where: { slug },
    update: {},
    create: { slug, name, sportId },
  });
}

async function ensureTeam(name: string, sportId: number, leagueId: number) {
  const existing = await prisma.team.findFirst({ where: { name, sportId } });
  if (existing) return existing;
  return prisma.team.create({ data: { name, sportId, leagueId } });
}

/** Crea o actualiza un GameStatistic "genérico" (sin equipo/jugador asociado) por su key, ej: "round", "winner". */
async function upsertGameStatKey(gameId: number, key: string, value: string) {
  const existing = await prisma.gameStatistic.findFirst({ where: { gameId, key, teamId: null, playerId: null } });
  if (existing) {
    if (existing.value !== value) {
      await prisma.gameStatistic.update({ where: { id: existing.id }, data: { value } });
    }
  } else {
    await prisma.gameStatistic.create({ data: { gameId, key, value } });
  }
}

/**
 * Persiste lo que devuelve un provider (ya normalizado) en la base:
 * crea Sport/League/Team si hace falta, y crea o actualiza el Game
 * correspondiente (matcheando por providerSource + externalId, que
 * es único por partido en el proveedor de origen).
 */
export const syncService = {
  async persistGames(providerSource: string, games: NormalizedGame[]) {
    let created = 0;
    let updated = 0;

    for (const g of games) {
      try {
        const sport = await ensureSport(g.sportSlug, capitalize(g.sportSlug));
        const league = await ensureLeague(g.leagueSlug, capitalize(g.leagueSlug), sport.id);
        const homeTeam = await ensureTeam(g.homeTeam.name, sport.id, league.id);
        const awayTeam = await ensureTeam(g.awayTeam.name, sport.id, league.id);

        const existing = await prisma.game.findUnique({
          where: { providerSource_externalId: { providerSource, externalId: g.externalId } },
        });

        const data = {
          sportId: sport.id,
          leagueId: league.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          date: g.date,
          status: g.status,
          homeScore: g.homeScore ?? null,
          awayScore: g.awayScore ?? null,
          providerSource,
          externalId: g.externalId,
        };

        if (existing) {
          await prisma.game.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.game.create({ data });
          created++;
        }

        // Guardamos ronda/fase y ganador (cuando el proveedor lo
        // informa explícito, ej. ESPN) como GameStatistic genérico
        // en vez de agregar columnas nuevas a Game: así no hace
        // falta ninguna migración de schema para estas features.
        // "winner" es necesario para partidos de eliminación directa
        // que terminan empatados en tiempo regular y se definen por
        // penales — ahí comparar homeScore/awayScore no alcanza.
        const gameRowForStats =
          existing ?? (await prisma.game.findUnique({ where: { providerSource_externalId: { providerSource, externalId: g.externalId } } }));
        if (gameRowForStats) {
          if (g.round) await upsertGameStatKey(gameRowForStats.id, "round", g.round);
          if (g.winnerSide) await upsertGameStatKey(gameRowForStats.id, "winner", g.winnerSide);
          if (g.venue) await upsertGameStatKey(gameRowForStats.id, "venue", g.venue);
          // Goles/tarjetas: un solo GameStatistic con la lista en JSON (mismo patrón que round/winner/venue).
          if (g.matchEvents?.length) await upsertGameStatKey(gameRowForStats.id, "events", JSON.stringify(g.matchEvents));
        }
      } catch (err) {
        console.error(`[sync] Falló al guardar partido ${g.externalId}:`, err);
      }
    }

    return { created, updated };
  },

  /**
   * Limpia partidos "huérfanos" que quedaron de una sincronización
   * anterior con OTRA fuente ganadora para la misma liga. Motivo: el
   * FallbackChainProvider guarda siempre el mismo providerSource (el
   * nombre de la liga, ej. "liga-profesional"), sin importar cuál
   * proveedor interno ganó esa vez (ESPN, TheSportsDB, scraper...).
   * Si ESPN empieza a ganar donde antes ganaba TheSportsDB, sus
   * externalId son distintos para "el mismo" partido real, así que el
   * upsert de persistGames no los reconoce como el mismo — el
   * registro viejo queda dando vueltas sin que nada lo borre, on
   * pantalla se ve como partido duplicado.
   *
   * Solo se llama para sync de PRÓXIMOS partidos (upcoming/today/live)
   * — nunca para históricos, ahí jamás se debe borrar un FINISHED.
   */
  async pruneStaleUpcoming(providerSource: string, freshGames: NormalizedGame[]) {
    if (freshGames.length === 0) return { deleted: 0 };

    const leagueSlugs = [...new Set(freshGames.map((g) => g.leagueSlug))];
    let deleted = 0;

    for (const leagueSlug of leagueSlugs) {
      const league = await prisma.league.findUnique({ where: { slug: leagueSlug } });
      if (!league) continue;

      const freshExternalIds = freshGames.filter((g) => g.leagueSlug === leagueSlug).map((g) => g.externalId);

      const staleGames = await prisma.game.findMany({
        where: {
          leagueId: league.id,
          providerSource,
          status: "SCHEDULED",
          externalId: { notIn: freshExternalIds },
        },
        select: { id: true },
      });
      if (staleGames.length === 0) continue;
      const staleIds = staleGames.map((g) => g.id);

      // Hay que borrar lo que cuelga del partido ANTES que el partido
      // mismo (GameStatistic incluye la ronda que le agregamos hace
      // poco) — si no, esto rompe con foreign key constraint. Es
      // exactamente lo que pasó: al agregar la ronda como
      // GameStatistic, esta función (escrita antes de eso) se olvidó
      // de borrarla primero.
      await prisma.gameStatistic.deleteMany({ where: { gameId: { in: staleIds } } });
      await prisma.stream.deleteMany({ where: { gameId: { in: staleIds } } });
      await prisma.video.deleteMany({ where: { gameId: { in: staleIds } } });
      await prisma.favoriteGame.deleteMany({ where: { gameId: { in: staleIds } } });

      const result = await prisma.game.deleteMany({ where: { id: { in: staleIds } } });
      deleted += result.count;
    }

    return { deleted };
  },

  /**
   * Persiste standings: como no siempre tenemos un id numérico del
   * equipo (el scraper de respaldo solo tiene el nombre), se busca
   * primero por nombre dentro del deporte/liga correspondiente.
   */
  async persistStandings(standings: NormalizedStanding[]) {
    let created = 0;
    let updated = 0;

    for (const s of standings) {
      try {
        const league = await prisma.league.findUnique({ where: { slug: s.leagueSlug } });
        if (!league) continue;


        const team = await ensureTeam(s.teamExternalId, league.sportId, league.id);
        // Antes: si el equipo no existía todavía (ej. porque sus
        // partidos de fase de grupos quedaron fuera de la ventana de
        // "resultados recientes" y nunca se sincronizaron), la fila
        // de standing se descartaba en silencio — eso era lo que
        // "cortaba" los grupos de Libertadores/Sudamericana a 2-3
        // equipos en vez de 4. Ahora se crea el equipo acá mismo, sin
        // depender de que haya llegado antes por el lado de partidos.

        const season = await prisma.season.upsert({
          where: { leagueId_name: { leagueId: league.id, name: s.seasonName } },
          update: {},
          create: { leagueId: league.id, name: s.seasonName, year: new Date().getFullYear() },
        });

        const existing = await prisma.standing.findUnique({
          where: { leagueId_seasonId_teamId: { leagueId: league.id, seasonId: season.id, teamId: team.id } },
        });

        const data = {
          played: s.played,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws ?? 0,
          points: s.points,
          rank: s.rank ?? null,
        };

        if (existing) {
          await prisma.standing.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.standing.create({ data: { leagueId: league.id, seasonId: season.id, teamId: team.id, ...data } });
          created++;
        }
      } catch (err) {
        console.error(`[sync] Falló al guardar standing de ${s.teamExternalId}:`, err);
      }
    }

    return { created, updated };
  },
};

function capitalize(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}
