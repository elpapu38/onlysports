import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const basketball = await prisma.sport.upsert({
    where: { slug: "basquet" },
    update: {},
    create: { name: "Básquet", slug: "basquet" },
  });

  const nba = await prisma.league.upsert({
    where: { slug: "nba" },
    update: {},
    create: { name: "NBA", slug: "nba", sportId: basketball.id },
  });

  const lakers =
    (await prisma.team.findFirst({ where: { name: "Lakers", leagueId: nba.id } })) ??
    (await prisma.team.create({
      data: { name: "Lakers", shortName: "LAL", sportId: basketball.id, leagueId: nba.id },
    }));

  const celtics =
    (await prisma.team.findFirst({ where: { name: "Celtics", leagueId: nba.id } })) ??
    (await prisma.team.create({
      data: { name: "Celtics", shortName: "BOS", sportId: basketball.id, leagueId: nba.id },
    }));

  await prisma.game.upsert({
    where: { providerSource_externalId: { providerSource: "seed", externalId: "demo-1" } },
    update: {},
    create: {
      sportId: basketball.id,
      leagueId: nba.id,
      homeTeamId: lakers.id,
      awayTeamId: celtics.id,
      date: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: "SCHEDULED",
      providerSource: "seed",
      externalId: "demo-1",
    },
  });

  console.log("✅ Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
