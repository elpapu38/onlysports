import { seasonRepository, type SeasonInput } from "@/repositories/seasonRepository";

export const seasonService = {
  list: () => seasonRepository.findAll(),
  get: (id: number) => seasonRepository.findById(id),
  create: (data: SeasonInput) => seasonRepository.create(data),
  update: (id: number, data: Partial<SeasonInput>) => seasonRepository.update(id, data),
  remove: (id: number) => seasonRepository.remove(id),
};
