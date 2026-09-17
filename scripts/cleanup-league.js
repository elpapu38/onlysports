// Script de limpieza puntual — NO se ejecuta como parte del flujo
// normal de la app. Sirve para encontrar y borrar una liga duplicada
// (con todo lo que cuelga de ella: equipos, partidos, standings,
// temporadas) sin romper foreign keys, ya que el schema no tiene
// onDelete: Cascade configurado.
//
// Uso:
//   1) Listar ligas (no borra nada):
//      node scripts/cleanup-league.js
//
//   2) Borrar una liga puntual por su slug exacto (ver columna "slug"
//      del listado del paso 1) — requiere los dos flags juntos como
//      doble confirmación:
//      node scripts/cleanup-league.js --delete-slug=NBA --confirm
//
// Por defecto apunta a la base real de la app de escritorio
// (%APPDATA%\OnlySports\onlysports.db en Windows). Si tu instalación
// vive en otro lado, pasá la ruta a mano:
//      node scripts/cleanup-league.js --db="C:\ruta\a\onlysports.db"

const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value ?? true;
  }
  return args;
}

function defaultDbPath() {
  const appData = process.env.APPDATA; // Windows: C:\Users\<user>\AppData\Roaming
  if (!appData) return null;
  // En modo desarrollo (electron dist/electron/main.js sin empaquetar),
  // Electron arma la carpeta de userData a partir del campo "name" del
  // package.json ("onlysports", minúscula) — no del "productName"
  // ("OnlySports") que solo se usa en el build empaquetado. Probamos
  // ambas variantes por las dudas.
  const candidates = ["OnlySports", "onlysports", "Electron"].map((folder) => path.join(appData, folder, "onlysports.db"));
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

async function main() {
  const args = parseArgs();
  const dbPath = args.db || defaultDbPath();

  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error(
      `No encontré la base en "${dbPath}". Pasá la ruta exacta con --db="C:\\ruta\\a\\onlysports.db" (la encontrás en %APPDATA%\\OnlySports\\onlysports.db).`
    );
    process.exit(1);
  }

  console.log(`Usando base: ${dbPath}\n`);
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  try {
    if (!args["delete-slug"]) {
      await listLeagues(prisma);
      console.log(
        `\nPara borrar una liga puntual (con todo lo que cuelga de ella): node scripts/cleanup-league.js --delete-slug="<slug exacto de arriba>" --confirm`
      );
      return;
    }

    if (!args.confirm) {
      console.error(`Falta --confirm. Volvé a correr el mismo comando agregando --confirm al final para confirmar el borrado.`);
      process.exit(1);
    }

    await deleteLeague(prisma, args["delete-slug"]);
  } finally {
    await prisma.$disconnect();
  }
}

async function listLeagues(prisma) {
  const leagues = await prisma.league.findMany({
    include: {
      sport: true,
      _count: { select: { teams: true, games: true, standings: true, seasons: true, channels: true } },
    },
    orderBy: [{ sport: { name: "asc" } }, { name: "asc" }],
  });

  if (leagues.length === 0) {
    console.log("No hay ninguna liga cargada todavía.");
    return;
  }

  console.log("Ligas encontradas:\n");
  for (const l of leagues) {
    console.log(
      `- slug="${l.slug}"  name="${l.name}"  sport="${l.sport.name}"  equipos=${l._count.teams}  partidos=${l._count.games}  standings=${l._count.standings}  temporadas=${l._count.seasons}  canales=${l._count.channels}`
    );
  }
}

async function deleteLeague(prisma, slug) {
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) {
    console.error(`No existe ninguna liga con slug="${slug}". Corré el script sin --delete-slug para ver el listado exacto.`);
    process.exit(1);
  }

  console.log(`Borrando liga slug="${league.slug}" (name="${league.name}")...\n`);

  await prisma.$transaction(async (tx) => {
    const games = await tx.game.findMany({ where: { leagueId: league.id }, select: { id: true } });
    const gameIds = games.map((g) => g.id);

    if (gameIds.length > 0) {
      await tx.favoriteGame.deleteMany({ where: { gameId: { in: gameIds } } });
      await tx.stream.deleteMany({ where: { gameId: { in: gameIds } } });
      await tx.video.deleteMany({ where: { gameId: { in: gameIds } } });
      await tx.gameStatistic.deleteMany({ where: { gameId: { in: gameIds } } });
      await tx.game.deleteMany({ where: { id: { in: gameIds } } });
      console.log(`  - ${gameIds.length} partido(s) borrados (con sus streams/videos/estadísticas/favoritos).`);
    }

    const standingsDeleted = await tx.standing.deleteMany({ where: { leagueId: league.id } });
    console.log(`  - ${standingsDeleted.count} standing(s) borrado(s).`);

    // No borramos los canales del usuario — por las dudas cargó algo
    // ahí a mano. Solo los desvinculamos de la liga que se va a borrar.
    const channelsUpdated = await tx.channel.updateMany({ where: { leagueId: league.id }, data: { leagueId: null } });
    if (channelsUpdated.count > 0) {
      console.log(`  - ${channelsUpdated.count} canal(es) desvinculado(s) de la liga (no se borraron).`);
    }

    const teams = await tx.team.findMany({ where: { leagueId: league.id }, select: { id: true, name: true } });
    let deletedTeams = 0;
    let reassignedTeams = 0;

    for (const team of teams) {
      // OJO: ensureTeam() en syncService matchea equipos por
      // (nombre, deporte) únicamente, sin mirar la liga — así que un
      // equipo con leagueId=<liga duplicada> puede en realidad estar
      // referenciado por partidos de OTRA liga (la buena), si ese
      // equipo se creó originalmente bajo la duplicada por casualidad
      // de orden de sync. Borrarlo a lo bruto rompería esos partidos.
      // Por eso primero chequeamos si tiene partidos en otras ligas:
      // si los tiene, lo reasignamos ahí en vez de borrarlo.
      const gamesElsewhere = await tx.game.findMany({
        where: {
          leagueId: { not: league.id },
          OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
        },
        select: { leagueId: true },
        distinct: ["leagueId"],
      });

      if (gamesElsewhere.length > 0) {
        const targetLeagueId = gamesElsewhere[0].leagueId;
        if (gamesElsewhere.length > 1) {
          console.warn(
            `  ! El equipo "${team.name}" tiene partidos en ${gamesElsewhere.length} ligas distintas fuera de la que se borra — se lo reasigna a la liga id=${targetLeagueId} (la primera encontrada), revisá si hace falta ajustar a mano.`
          );
        }
        await tx.team.update({ where: { id: team.id }, data: { leagueId: targetLeagueId } });
        reassignedTeams++;
        continue;
      }

      // Sin partidos en otras ligas: seguro borrarlo del todo.
      const players = await tx.player.findMany({ where: { teamId: team.id }, select: { id: true } });
      const playerIds = players.map((p) => p.id);
      if (playerIds.length > 0) {
        await tx.gameStatistic.deleteMany({ where: { playerId: { in: playerIds } } });
        await tx.player.deleteMany({ where: { id: { in: playerIds } } });
      }
      await tx.gameStatistic.deleteMany({ where: { teamId: team.id } });
      await tx.team.delete({ where: { id: team.id } });
      deletedTeams++;
    }

    if (reassignedTeams > 0) console.log(`  - ${reassignedTeams} equipo(s) reasignado(s) a su liga real (tenían partidos ahí).`);
    if (deletedTeams > 0) console.log(`  - ${deletedTeams} equipo(s) borrado(s).`);

    const seasonsDeleted = await tx.season.deleteMany({ where: { leagueId: league.id } });
    console.log(`  - ${seasonsDeleted.count} temporada(s) borrada(s).`);

    await tx.league.delete({ where: { id: league.id } });
    console.log(`  - Liga "${league.name}" borrada.`);
  });

  console.log("\nListo. Reiniciá la app para ver los cambios.");
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});