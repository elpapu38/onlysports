import { Router } from "express";
import { homeController } from "@/controllers/homeController";
import { gamesController } from "@/controllers/gamesController";
import { channelsController } from "@/controllers/channelsController";
import { backupController } from "@/controllers/backupController";
import { legalController } from "@/controllers/legalController";
import { standingsController } from "@/controllers/standingsController";

export const webRoutes = Router();

webRoutes.get("/legal/disclaimer", legalController.showDisclaimer);
webRoutes.post("/legal/disclaimer/accept", legalController.acceptDisclaimer);

webRoutes.get("/", homeController.index);

webRoutes.get("/resultados", gamesController.results);
webRoutes.get("/en-vivo", gamesController.live);
webRoutes.get("/posiciones", standingsController.index);
webRoutes.get("/partidos/:id", gamesController.show);

webRoutes.get("/channels", channelsController.index);
webRoutes.get("/channels/new", channelsController.newForm);
webRoutes.get("/channels/:id", channelsController.show);
webRoutes.post("/channels", channelsController.create);
webRoutes.post("/channels/:id/delete", channelsController.remove);

webRoutes.get("/settings/backup", backupController.page);
webRoutes.get("/settings/backup/export", backupController.export);
webRoutes.post("/settings/backup/import", backupController.import);
