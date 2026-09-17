import { prisma } from "@/config/database";

export interface SportInput {
  name: string;
  slug: string;
}

export const sportRepository = {
  findAll() {
    return prisma.sport.findMany({ orderBy: { name: "asc" } });
  },
  findById(id: number) {
    return prisma.sport.findUnique({ where: { id } });
  },
  create(data: SportInput) {
    return prisma.sport.create({ data });
  },
  update(id: number, data: Partial<SportInput>) {
    return prisma.sport.update({ where: { id }, data });
  },
  remove(id: number) {
    return prisma.sport.delete({ where: { id } });
  },
};
