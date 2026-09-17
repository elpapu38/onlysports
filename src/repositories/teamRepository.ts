import { prisma } from "@/config/database";

export interface TeamInput {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
  sportId: number;
  leagueId?: number | null;
}

export const teamRepository = {
  findAll() {
    return prisma.team.findMany({ include: { sport: true, league: true }, orderBy: { name: "asc" } });
  },
  findById(id: number) {
    return prisma.team.findUnique({ where: { id }, include: { sport: true, league: true } });
  },
  create(data: TeamInput) {
    return prisma.team.create({ data });
  },
  update(id: number, data: Partial<TeamInput>) {
    return prisma.team.update({ where: { id }, data });
  },
  remove(id: number) {
    return prisma.team.delete({ where: { id } });
  },
};
