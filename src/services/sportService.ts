import { sportRepository, type SportInput } from "@/repositories/sportRepository";

export const sportService = {
  list: () => sportRepository.findAll(),
  get: (id: number) => sportRepository.findById(id),
  create: (data: SportInput) => sportRepository.create(data),
  update: (id: number, data: Partial<SportInput>) => sportRepository.update(id, data),
  remove: (id: number) => sportRepository.remove(id),
};
