import { Router } from "express";
import { sportsController } from "@/controllers/panel/sportsController";
import { leaguesController } from "@/controllers/panel/leaguesController";
import { seasonsController } from "@/controllers/panel/seasonsController";
import { teamsController } from "@/controllers/panel/teamsController";
import { panelGamesController } from "@/controllers/panel/gamesController";
import { runManualSync } from "@/jobs/scheduler";

// Nota: /panel NO pide usuario/clave. Es una app de escritorio de uso
// local — cualquiera que tenga la app abierta en su PC ya tiene acceso
// físico a la máquina, así que un login acá no suma seguridad real,
// solo fricción. Si en algún momento esto se expone como servicio web
// compartido (ver docker-compose.yml), ahí sí conviene volver a poner
// algún tipo de autenticación real.
export const panelRoutes = Router();

panelRoutes.get("/", (_req, res) => {
  res.render("panel/dashboard", { title: "Gestión" });
});

panelRoutes.post("/sync", async (_req, res, next) => {
  try {
    const summary = await runManualSync();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

// Deportes
panelRoutes.get("/sports", sportsController.index);
panelRoutes.get("/sports/new", sportsController.newForm);
panelRoutes.post("/sports", sportsController.create);
panelRoutes.get("/sports/:id/edit", sportsController.editForm);
panelRoutes.post("/sports/:id", sportsController.update);
panelRoutes.post("/sports/:id/delete", sportsController.remove);

// Ligas
panelRoutes.get("/leagues", leaguesController.index);
panelRoutes.get("/leagues/new", leaguesController.newForm);
panelRoutes.post("/leagues", leaguesController.create);
panelRoutes.get("/leagues/:id/edit", leaguesController.editForm);
panelRoutes.post("/leagues/:id", leaguesController.update);
panelRoutes.post("/leagues/:id/delete", leaguesController.remove);

// Temporadas
panelRoutes.get("/seasons", seasonsController.index);
panelRoutes.get("/seasons/new", seasonsController.newForm);
panelRoutes.post("/seasons", seasonsController.create);
panelRoutes.get("/seasons/:id/edit", seasonsController.editForm);
panelRoutes.post("/seasons/:id", seasonsController.update);
panelRoutes.post("/seasons/:id/delete", seasonsController.remove);

// Equipos
panelRoutes.get("/teams", teamsController.index);
panelRoutes.get("/teams/new", teamsController.newForm);
panelRoutes.post("/teams", teamsController.create);
panelRoutes.get("/teams/:id/edit", teamsController.editForm);
panelRoutes.post("/teams/:id", teamsController.update);
panelRoutes.post("/teams/:id/delete", teamsController.remove);

// Partidos / resultados
panelRoutes.get("/games", panelGamesController.index);
panelRoutes.get("/games/new", panelGamesController.newForm);
panelRoutes.post("/games", panelGamesController.create);
panelRoutes.get("/games/:id/edit", panelGamesController.editForm);
panelRoutes.post("/games/:id", panelGamesController.update);
panelRoutes.post("/games/:id/delete", panelGamesController.remove);
