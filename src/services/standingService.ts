import { standingRepository } from "@/repositories/standingRepository";

export const standingService = {
  allGroupedByLeague: () => standingRepository.findAllGroupedByLeague(),
};
