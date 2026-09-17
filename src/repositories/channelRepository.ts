import { prisma } from "@/config/database";
import type { StreamType } from "@prisma/client";

export interface ChannelInput {
  name: string;
  type: StreamType;
  value: string;
  logoUrl?: string | null;
  sportId?: number | null;
  leagueId?: number | null;
  isLive?: boolean;
  notes?: string | null;
}

export const channelRepository = {
  findAll() {
    return prisma.channel.findMany({
      include: { sport: true, league: true },
      orderBy: { name: "asc" },
    });
  },

  findById(id: number) {
    return prisma.channel.findUnique({ where: { id }, include: { sport: true, league: true } });
  },

  create(data: ChannelInput) {
    return prisma.channel.create({ data });
  },

  update(id: number, data: Partial<ChannelInput>) {
    return prisma.channel.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.channel.delete({ where: { id } });
  },

  // Usado por el export/import: trae todo tal cual está guardado.
  findAllRaw() {
    return prisma.channel.findMany({ orderBy: { id: "asc" } });
  },
};
