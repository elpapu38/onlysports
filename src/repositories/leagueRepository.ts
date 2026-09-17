import { prisma } from "@/config/database";

export interface LeagueInput {
  name: string;
  slug: string;
  sportId: number;
}

export const leagueRepository = {
  findAll() {
    return prisma.league.findMany({ include: { sport: true }, orderBy: { name: "asc" } });
  },
  findById(id: number) {
    return prisma.league.findUnique({ where: { id }, include: { sport: true } });
  },
  create(data: LeagueInput) {
    return prisma.league.create({ data });
  },
  update(id: number, data: Partial<LeagueInput>) {
    return prisma.league.update({ where: { id }, data });
  },
  remove(id: number) {
    return prisma.league.delete({ where: { id } });
  },
};
