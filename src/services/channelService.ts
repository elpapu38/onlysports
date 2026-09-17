import { channelRepository, type ChannelInput } from "@/repositories/channelRepository";

export const channelService = {
  list: () => channelRepository.findAll(),
  get: (id: number) => channelRepository.findById(id),
  create: (data: ChannelInput) => channelRepository.create(data),
  update: (id: number, data: Partial<ChannelInput>) => channelRepository.update(id, data),
  remove: (id: number) => channelRepository.remove(id),
};
