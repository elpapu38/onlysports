import { prisma } from "@/config/database";

export const gameRepository = {
  findUpcoming(limit = 20) {
    return prisma.game.findMany({
      where: { status: "SCHEDULED", date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: limit,
      include: { homeTeam: true, awayTeam: true, sport: true, league: true },
    });
  },

  /**
   * Próximos N partidos de cada liga que tenga al menos uno
   * programado. Igual que findRecentResultsByLeague pero para
   * SCHEDULED: sin esto, una liga con muchos partidos cargados podía
   * "tapar" a las demás en un límite global compartido (ej: 10 en
   * total repartidos sin garantía entre ligas).
   */
  async findUpcomingByLeague(limitPerLeague = 5) {
    const leagues = await prisma.league.findMany({
      where: { games: { some: { status: "SCHEDULED", date: { gte: new Date() } } } },
      include: { sport: true },
      orderBy: { name: "asc" },
    });

    const groups = await Promise.all(
      leagues.map(async (league) => {
        const games = await prisma.game.findMany({
          where: { leagueId: league.id, status: "SCHEDULED", date: { gte: new Date() } },
          orderBy: { date: "asc" },
          take: limitPerLeague,
          include: { homeTeam: true, awayTeam: true, sport: true, league: true, statistics: true },
        });
        return { league, games };
      })
    );

    return groups.filter((g) => g.games.length > 0);
  },

  findLive() {
    return prisma.game.findMany({
      where: { status: "LIVE" },
      include: { homeTeam: true, awayTeam: true, sport: true, league: true, streams: true },
    });
  },

  findResults(params: { from?: Date; to?: Date; sportSlug?: string; leagueSlug?: string; teamId?: number }) {
    return prisma.game.findMany({
      where: {
        status: "FINISHED",
        date: { gte: params.from, lte: params.to },
        sport: params.sportSlug ? { slug: params.sportSlug } : undefined,
        league: params.leagueSlug ? { slug: params.leagueSlug } : undefined,
        OR: params.teamId ? [{ homeTeamId: params.teamId }, { awayTeamId: params.teamId }] : undefined,
      },
      orderBy: { date: "desc" },
      include: { homeTeam: true, awayTeam: true, sport: true, league: true, statistics: true },
    });
  },

  /**
   * Últimos N partidos finalizados de cada liga que tenga al menos
   * uno. Se usa como vista por defecto de /resultados (sin filtros):
   * un pantallazo rápido "qué pasó" por deporte/liga, en vez de una
   * lista plana mezclando todo.
   */
  async findRecentResultsByLeague(limitPerLeague = 5) {
    const leagues = await prisma.league.findMany({
      where: { games: { some: { status: "FINISHED" } } },
      include: { sport: true },
      orderBy: { name: "asc" },
    });

    const groups = await Promise.all(
      leagues.map(async (league) => {
        const games = await prisma.game.findMany({
          where: { leagueId: league.id, status: "FINISHED" },
          orderBy: { date: "desc" },
          take: limitPerLeague,
          include: { homeTeam: true, awayTeam: true, sport: true, league: true, statistics: true },
        });
        return { league, games };
      })
    );

    // Ligas sin partidos finalizados no deberían poder llegar acá
    // (el where de arriba ya las filtra), pero por las dudas evitamos
    // mostrar una tarjeta vacía si algo cambió entre las dos queries.
    return groups.filter((g) => g.games.length > 0);
  },

  findById(id: number) {
    return prisma.game.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        sport: true,
        league: true,
        season: true,
        statistics: true,
        streams: true,
        videos: true,
      },
    });
  },

  /**
   * Busca, para cada liga, el partido de "Final" ya finalizado más
   * reciente — de ahí se calcula el campeón (ver isFinalRound/
   * championName en utils/gamePresentation.ts). No se limita a los
   * últimos 5 resultados mostrados en /resultados: revisa hasta 20
   * partidos finalizados por liga, por si la final quedó "tapada" por
   * partidos de otra competencia jugados después.
   */
  async findChampionshipFinals(leagueSlugs: string[]) {
    if (leagueSlugs.length === 0) return [];

    const leagues = await prisma.league.findMany({ where: { slug: { in: leagueSlugs } } });

    const results = await Promise.all(
      leagues.map(async (league) => {
        const recentFinished = await prisma.game.findMany({
          where: { leagueId: league.id, status: "FINISHED" },
          orderBy: { date: "desc" },
          take: 60,
          include: { homeTeam: true, awayTeam: true, statistics: true },
        });
        return { league, games: recentFinished };
      })
    );

    return results;
  },

  /**
   * Para cada liga, busca la ronda del próximo partido más cercano
   * (o del último jugado si no hay próximos) — se usa para mostrar
   * "Fase actual: Cuartos de Final" en Posiciones cuando todavía no
   * hay campeón definido.
   */
  async findCurrentRoundByLeague(leagueSlugs: string[]) {
    if (leagueSlugs.length === 0) return [];
    const leagues = await prisma.league.findMany({ where: { slug: { in: leagueSlugs } } });

    return Promise.all(
      leagues.map(async (league) => {
        const upcoming = await prisma.game.findFirst({
          where: { leagueId: league.id, status: "SCHEDULED", date: { gte: new Date() } },
          orderBy: { date: "asc" },
          include: { statistics: true },
        });
        if (upcoming) return { league, game: upcoming };

        const lastFinished = await prisma.game.findFirst({
          where: { leagueId: league.id, status: "FINISHED" },
          orderBy: { date: "desc" },
          include: { statistics: true },
        });
        return { league, game: lastFinished };
      })
    );
  },

  // ── Usado por el panel de gestión ──
  findAllForPanel(limit = 100) {
    return prisma.game.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: { homeTeam: true, awayTeam: true, sport: true, league: true },
    });
  },

  create(data: {
    sportId: number;
    leagueId: number;
    seasonId?: number | null;
    homeTeamId: number;
    awayTeamId: number;
    date: Date;
    status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
    homeScore?: number | null;
    awayScore?: number | null;
  }) {
    return prisma.game.create({ data });
  },

  update(
    id: number,
    data: Partial<{
      sportId: number;
      leagueId: number;
      seasonId: number | null;
      homeTeamId: number;
      awayTeamId: number;
      date: Date;
      status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
      homeScore: number | null;
      awayScore: number | null;
    }>
  ) {
    return prisma.game.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.game.delete({ where: { id } });
  },
};
