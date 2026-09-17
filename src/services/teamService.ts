import { teamRepository, type TeamInput } from "@/repositories/teamRepository";

export const teamService = {
  list: () => teamRepository.findAll(),
  get: (id: number) => teamRepository.findById(id),
  create: (data: TeamInput) => teamRepository.create(data),
  update: (id: number, data: Partial<TeamInput>) => teamRepository.update(id, data),
  remove: (id: number) => teamRepository.remove(id),
};
