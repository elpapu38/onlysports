import type { Request, Response, NextFunction } from "express";
import { channelService } from "@/services/channelService";
import { buildChannelEmbed } from "@/utils/embed";
import { z } from "zod";

const channelInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["YOUTUBE", "M3U8", "TWITCH", "VIMEO", "MP4", "WEBM", "URL"]),
  value: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal("")),
  isLive: z.coerce.boolean().optional(),
  notes: z.string().optional(),
});

export const channelsController = {
  async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const channels = await channelService.list();
      res.render("channels/index", { title: "Canales en vivo", channels });
    } catch (err) {
      next(err);
    }
  },

  newForm(_req: Request, res: Response) {
    res.render("channels/form", { title: "Agregar canal", channel: null });
  },

  async show(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const channel = await channelService.get(id);
      if (!channel) return res.status(404).render("errors/404", { title: "No encontrado" });
      const embed = buildChannelEmbed(channel.type, channel.value, req.hostname);
      res.render("channels/show", { title: channel.name, channel, embed });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = channelInputSchema.parse(req.body);
      await channelService.create({ ...parsed, logoUrl: parsed.logoUrl || null });
      res.redirect("/channels");
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await channelService.remove(Number(req.params.id));
      res.redirect("/channels");
    } catch (err) {
      next(err);
    }
  },

  // API JSON
  async apiIndex(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await channelService.list());
    } catch (err) {
      next(err);
    }
  },
};
