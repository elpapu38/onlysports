import { leagueRepository, type LeagueInput } from "@/repositories/leagueRepository";

export const leagueService = {
  list: () => leagueRepository.findAll(),
  get: (id: number) => leagueRepository.findById(id),
  create: (data: LeagueInput) => leagueRepository.create(data),
  update: (id: number, data: Partial<LeagueInput>) => leagueRepository.update(id, data),
  remove: (id: number) => leagueRepository.remove(id),
};
