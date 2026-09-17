import { prisma } from "@/config/database";

export const standingRepository = {
  /**
   * Trae la tabla de posiciones de cada liga que tenga standings
   * guardados. Si la liga se divide en zonas/grupos (ej: Liga
   * Profesional Zona A/B), cada una se guardó como una "temporada"
   * separada con el mismo año — acá se agrupan todas las del año más
   * reciente de esa liga y se devuelven como "zonas" distintas, en
   * vez de mezclarlas en una sola tabla o mostrar solo una.
   */
  async findAllGroupedByLeague() {
    const leagues = await prisma.league.findMany({
      where: { standings: { some: {} } },
      include: { sport: true },
      orderBy: { name: "asc" },
    });

    const groups = await Promise.all(
      leagues.map(async (league) => {
        const seasons = await prisma.season.findMany({
          where: { leagueId: league.id, standings: { some: {} } },
          orderBy: { id: "desc" },
        });
        if (seasons.length === 0) return null;

        const maxYear = Math.max(...seasons.map((s) => s.year));
        const currentSeasons = seasons.filter((s) => s.year === maxYear);

        const zones = await Promise.all(
          currentSeasons.map(async (season) => {
            const standings = await prisma.standing.findMany({
              where: { leagueId: league.id, seasonId: season.id },
              include: { team: true },
              orderBy: [{ rank: "asc" }, { points: "desc" }],
            });
            return { season, standings };
          })
        );

        return { league, zones: zones.filter((z) => z.standings.length > 0) };
      })
    );

    return groups.filter((g): g is NonNullable<typeof g> => g !== null && g.zones.length > 0);
  },
};
