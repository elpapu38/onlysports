import { prisma } from "@/config/database";
import {
  backupFileSchema,
  type BackupFile,
  type BackupChannel,
  type BackupStream,
  type BackupFavorite,
} from "@/types/backup";

const APP_NAME = "OnlySports";
const BACKUP_VERSION = 1 as const;

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Exporta todo lo que el usuario cargó manualmente:
 *  - Canales en vivo (Channel)
 *  - Streams que agregó a partidos puntuales (Stream.isUserAdded = true)
 *  - Partidos que marcó como favoritos/seguidos (FavoriteGame)
 *
 * No exporta nada que venga de los providers automáticos, porque
 * eso se puede volver a traer con una sincronización.
 */
export const exportImportService = {
  async buildBackup(): Promise<BackupFile> {
    const [channels, streams, favorites] = await Promise.all([
      prisma.channel.findMany({ include: { sport: true, league: true } }),
      prisma.stream.findMany({
        where: { isUserAdded: true },
        include: { game: { include: { sport: true, league: true, homeTeam: true, awayTeam: true } } },
      }),
      prisma.favoriteGame.findMany({
        include: { game: { include: { sport: true, league: true, homeTeam: true, awayTeam: true } } },
      }),
    ]);

    const backupChannels: BackupChannel[] = channels.map((c: (typeof channels)[number]) => ({
      name: c.name,
      type: c.type,
      value: c.value,
      logoUrl: c.logoUrl,
      sportSlug: c.sport?.slug ?? null,
      leagueSlug: c.league?.slug ?? null,
      isLive: c.isLive,
      notes: c.notes,
    }));

    const backupStreams: BackupStream[] = streams.map((s: (typeof streams)[number]) => ({
      type: s.type,
      value: s.value,
      label: s.label,
      game: {
        sportSlug: s.game.sport.slug,
        leagueSlug: s.game.league.slug,
        homeTeam: s.game.homeTeam.name,
        awayTeam: s.game.awayTeam.name,
        date: s.game.date.toISOString(),
      },
    }));

    const backupFavorites: BackupFavorite[] = favorites.map((f: (typeof favorites)[number]) => ({
      note: f.note,
      game: {
        sportSlug: f.game.sport.slug,
        leagueSlug: f.game.league.slug,
        homeTeam: f.game.homeTeam.name,
        awayTeam: f.game.awayTeam.name,
        date: f.game.date.toISOString(),
      },
    }));

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appName: APP_NAME,
      channels: backupChannels,
      streams: backupStreams,
      favorites: backupFavorites,
    };
  },

  /**
   * Importa un backup previamente exportado. Es idempotente:
   * correrlo dos veces con el mismo archivo no duplica datos.
   * Devuelve un resumen con lo que se pudo importar y lo que se
   * tuvo que omitir (por ejemplo, streams de partidos que todavía
   * no existen en esta base porque no se sincronizaron).
   */
  async restoreBackup(raw: unknown) {
    const backup = backupFileSchema.parse(raw);

    const summary = {
      channels: { imported: 0, skipped: 0 },
      streams: { imported: 0, skipped: 0 },
      favorites: { imported: 0, skipped: 0 },
    };

    // ── Canales ──
    for (const ch of backup.channels) {
      const sport = ch.sportSlug ? await prisma.sport.findUnique({ where: { slug: ch.sportSlug } }) : null;
      const league = ch.leagueSlug ? await prisma.league.findUnique({ where: { slug: ch.leagueSlug } }) : null;

      const existing = await prisma.channel.findFirst({ where: { name: ch.name, value: ch.value } });
      if (existing) {
        await prisma.channel.update({
          where: { id: existing.id },
          data: {
            type: ch.type,
            logoUrl: ch.logoUrl ?? null,
            sportId: sport?.id ?? null,
            leagueId: league?.id ?? null,
            isLive: ch.isLive ?? true,
            notes: ch.notes ?? null,
          },
        });
      } else {
        await prisma.channel.create({
          data: {
            name: ch.name,
            type: ch.type,
            value: ch.value,
            logoUrl: ch.logoUrl ?? null,
            sportId: sport?.id ?? null,
            leagueId: league?.id ?? null,
            isLive: ch.isLive ?? true,
            notes: ch.notes ?? null,
          },
        });
      }
      summary.channels.imported += 1;
    }

    // ── Streams (requieren que el partido ya exista) ──
    for (const s of backup.streams) {
      const game = await findMatchingGame(s.game);
      if (!game) {
        summary.streams.skipped += 1;
        continue;
      }
      const existing = await prisma.stream.findFirst({
        where: { gameId: game.id, type: s.type, value: s.value },
      });
      if (!existing) {
        await prisma.stream.create({
          data: { gameId: game.id, type: s.type, value: s.value, label: s.label ?? null, isUserAdded: true },
        });
      }
      summary.streams.imported += 1;
    }

    // ── Favoritos (requieren que el partido ya exista) ──
    for (const f of backup.favorites) {
      const game = await findMatchingGame(f.game);
      if (!game) {
        summary.favorites.skipped += 1;
        continue;
      }
      await prisma.favoriteGame.upsert({
        where: { gameId: game.id },
        update: { note: f.note ?? null },
        create: { gameId: game.id, note: f.note ?? null },
      });
      summary.favorites.imported += 1;
    }

    return summary;
  },
};

async function findMatchingGame(ref: BackupFavorite["game"]) {
  const target = new Date(ref.date);
  const dayStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const candidates = await prisma.game.findMany({
    where: {
      date: { gte: dayStart, lt: dayEnd },
      sport: { slug: ref.sportSlug },
      league: { slug: ref.leagueSlug },
      homeTeam: { name: ref.homeTeam },
      awayTeam: { name: ref.awayTeam },
    },
    take: 1,
  });

  return candidates[0] ?? null;
}
