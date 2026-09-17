import { prisma } from "@/config/database";

export interface SeasonInput {
  name: string;
  year: number;
  leagueId: number;
}

export const seasonRepository = {
  findAll() {
    return prisma.season.findMany({
      include: { league: { include: { sport: true } } },
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
  },
  findById(id: number) {
    return prisma.season.findUnique({ where: { id }, include: { league: true } });
  },
  create(data: SeasonInput) {
    return prisma.season.create({ data });
  },
  update(id: number, data: Partial<SeasonInput>) {
    return prisma.season.update({ where: { id }, data });
  },
  remove(id: number) {
    return prisma.season.delete({ where: { id } });
  },
};
