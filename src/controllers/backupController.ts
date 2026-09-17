import type { Request, Response, NextFunction } from "express";
import { exportImportService } from "@/services/exportImportService";
import { env } from "@/config/env";

export const backupController = {
  // Página con explicación + botones de exportar/importar.
  page(_req: Request, res: Response) {
    res.render("settings/export-import", { title: "Backup de mis datos" });
  },

  // Descarga un .json con canales, streams manuales y favoritos del usuario.
  async export(_req: Request, res: Response, next: NextFunction) {
    try {
      const backup = await exportImportService.buildBackup();
      const filename = `onlysports-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
      next(err);
    }
  },

  // Recibe un .json (subido por el usuario) y restaura lo que pueda.
  async import(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body?.backup ?? req.body;
      const summary = await exportImportService.restoreBackup(body);
      res.json({ ok: true, appName: env.appName, summary });
    } catch (err) {
      next(err);
    }
  },
};
