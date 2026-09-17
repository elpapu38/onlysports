import { z } from "zod";

// Formato del archivo de backup que exporta/importa el usuario.
// Solo contiene datos que el propio usuario cargó: canales,
// streams manuales y partidos que marcó como favoritos/seguidos.
// NO incluye nada descargado automáticamente de los providers,
// porque eso se puede volver a sincronizar en cualquier momento.

export const streamTypeSchema = z.enum(["YOUTUBE", "M3U8", "TWITCH", "VIMEO", "MP4", "WEBM", "URL"]);

export const backupGameRefSchema = z.object({
  sportSlug: z.string(),
  leagueSlug: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  date: z.string(), // ISO date, se compara por día
});

export const backupChannelSchema = z.object({
  name: z.string().min(1),
  type: streamTypeSchema,
  value: z.string().min(1),
  logoUrl: z.string().url().optional().nullable(),
  sportSlug: z.string().optional().nullable(),
  leagueSlug: z.string().optional().nullable(),
  isLive: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

export const backupStreamSchema = z.object({
  type: streamTypeSchema,
  value: z.string().min(1),
  label: z.string().optional().nullable(),
  game: backupGameRefSchema,
});

export const backupFavoriteSchema = z.object({
  note: z.string().optional().nullable(),
  game: backupGameRefSchema,
});

export const backupFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  appName: z.string().optional(),
  channels: z.array(backupChannelSchema).default([]),
  streams: z.array(backupStreamSchema).default([]),
  favorites: z.array(backupFavoriteSchema).default([]),
});

export type BackupFile = z.infer<typeof backupFileSchema>;
export type BackupChannel = z.infer<typeof backupChannelSchema>;
export type BackupStream = z.infer<typeof backupStreamSchema>;
export type BackupFavorite = z.infer<typeof backupFavoriteSchema>;
