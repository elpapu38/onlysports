import express from "express";
import path from "node:path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";

import { env } from "@/config/env";
import { webRoutes } from "@/routes/webRoutes";
import { apiRoutes } from "@/routes/apiRoutes";
import { panelRoutes } from "@/routes/panelRoutes";
import { notFoundHandler, errorHandler } from "@/middleware/errorHandler";
import { disclaimerGate } from "@/middleware/disclaimer";
import { fmtDate, fmtTime, fmtDateTime } from "@/utils/datetime";
import { championName, findRound, findVenue, parseMatchEvents, championLines } from "@/utils/gamePresentation";

export function createApp() {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Nada de scripts inline: todo el JS del cliente vive en
          // /public/js/*.js. La única fuente externa es el CDN de hls.js
          // (necesario para reproducir streams M3U8/HLS del lado del navegador).
          scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "https:", "data:"],
          // Los canales/streams los carga el propio usuario, pueden venir
          // de cualquier dominio — por eso mediaSrc/connectSrc quedan
          // abiertos a https, no restringidos a un origen fijo.
          mediaSrc: ["'self'", "https:", "blob:"],
          connectSrc: ["'self'", "https:"],
          frameSrc: [
            "https://www.youtube.com",
            "https://www.youtube-nocookie.com",
            "https://player.twitch.tv",
            "https://player.vimeo.com",
          ],
        },
      },
      // Helmet manda "no-referrer" por defecto. YouTube (y otras
      // plataformas) necesitan un Referer válido para verificar que el
      // embed viene de una página real — sin esto, el video tira
      // "Error 153: video player configuration error".
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );
  app.use(cors());
  app.use(compression());
  app.use(morgan(env.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "2mb" })); // 2mb: suficiente para un backup personal
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // CSRF (doble submit cookie) para formularios renderizados con EJS.
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => env.csrfSecret,
    // App sin sesiones (self-hosted, uso personal): usamos la IP como
    // identificador. Si más adelante se agregan sesiones/usuarios,
    // conviene reemplazar esto por el id de sesión real.
    getSessionIdentifier: (req) => req.ip ?? "onlysports",
    cookieName: "onlysports.csrf",
    cookieOptions: { sameSite: "lax", secure: env.isProd },
    // Por defecto csrf-csrf solo busca el token en el header x-csrf-token.
    // Nuestros <form> de EJS lo mandan como campo oculto "_csrf" en el
    // body, así que hay que leerlo de ahí también (los fetch() del
    // frontend siguen mandándolo por header).
    getCsrfTokenFromRequest: (req) => (req.body && req.body._csrf) || req.headers["x-csrf-token"],
  });
  app.use((req, res, next) => {
    res.locals.csrfToken = generateCsrfToken(req, res);
    next();
  });
  app.use((req, res, next) => {
    // La API JSON (pensada también para clientes externos) queda fuera del CSRF de formularios.
    if (req.path.startsWith("/api/")) return next();
    return doubleCsrfProtection(req, res, next);
  });

  app.locals.appName = env.appName;
  // Disponibles en cualquier vista EJS como fmtDate(...)/fmtTime(...)/fmtDateTime(...),
  // siempre en horario de Argentina sin importar el huso horario del sistema.
  app.locals.fmtDate = fmtDate;
  app.locals.fmtTime = fmtTime;
  app.locals.fmtDateTime = fmtDateTime;
  app.locals.championName = championName;
  app.locals.findRound = findRound;
  app.locals.findVenue = findVenue;
  app.locals.parseMatchEvents = parseMatchEvents;
  app.locals.championLines = championLines;

  // Antes de dejar pasar a cualquier ruta que involucre contenido
  // multimedia (todo lo que no sea /api), el usuario tiene que haber
  // aceptado el disclaimer de responsabilidad sobre las fuentes que carga.
  app.use(disclaimerGate);

  app.use("/api", apiRoutes);
  app.use("/panel", panelRoutes);
  app.use("/", webRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
