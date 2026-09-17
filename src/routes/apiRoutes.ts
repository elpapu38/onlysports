import { Router } from "express";
import { gamesController } from "@/controllers/gamesController";
import { channelsController } from "@/controllers/channelsController";
import { backupController } from "@/controllers/backupController";

export const apiRoutes = Router();

// GET /api/sports, /api/leagues, /api/teams, /api/standings quedan
// como próximos endpoints (Fase 2/3 del roadmap); ya está la base
// para agregarlos como controllers + routes siguiendo el mismo patrón.

apiRoutes.get("/games/upcoming", gamesController.apiUpcoming);
apiRoutes.get("/games/live", gamesController.apiLive);

apiRoutes.get("/channels", channelsController.apiIndex);

apiRoutes.get("/backup/export", backupController.export);
apiRoutes.post("/backup/import", backupController.import);
