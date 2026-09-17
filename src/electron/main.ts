import { app, BrowserWindow, shell, session } from "electron";
import path from "node:path";
import { bootstrapEnv } from "./dbBootstrap";
import { findFreePort } from "./findFreePort";

// Sin esto, en modo desarrollo (sin empaquetar) Electron usa su
// nombre por defecto ("Electron") para la carpeta de userData en vez
// de "OnlySports" — lo cual hacía bastante confuso encontrar dónde
// vive la base real (ver dbBootstrap.ts para la migración que cubre
// instalaciones que ya pisaron esa carpeta por defecto).
app.setName("OnlySports");

// ── Hardening general ──────────────────────────────────────────
// Una sola instancia corriendo a la vez: dos instancias escribiendo
// al mismo tiempo en el mismo archivo SQLite pueden corromperlo.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Desactiva features de Chromium que no usamos y reducen superficie
// de ataque (WebGL/plugins no hacen falta para una app EJS+Tailwind).
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

let mainWindow: BrowserWindow | null = null;
let allowedOrigin = "";

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function startBackend(): Promise<number> {
  bootstrapEnv();

  // Import dinámico: tiene que pasar DESPUÉS de que bootstrapEnv()
  // setee DATABASE_URL/SESSION_SECRET/etc, porque config/env.ts los
  // lee al cargarse el módulo.
  const { createApp } = await import("../app");
  const { startScheduler } = await import("@/jobs/scheduler");
  const expressApp = createApp();

  const port = await findFreePort(3000);
  await new Promise<void>((resolve) => {
    expressApp.listen(port, "127.0.0.1", () => resolve());
  });

  // Igual que en server.ts (modo navegador): dispara la sync inicial
  // (upcoming/historical/standings) y arranca los crons periódicos.
  // Sin esto, en modo Electron el backend levanta pero la base nunca
  // se llena — los providers y el scraper nunca se llegan a llamar.
  startScheduler();

  return port;
}

function hardenSession() {
  // Bloquea permisos que esta app no necesita (cámara, micrófono,
  // geolocalización, notificaciones, etc.)
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

function createWindow(port: number) {
  allowedOrigin = `http://localhost:${port}`;
  hardenSession();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    // Saca la barra de título nativa (gris, clara, desentona con la
    // app) y deja solo los botones de minimizar/maximizar/cerrar,
    // coloreados para que combinen con el tema oscuro. El resto de esa
    // franja la ocupa nuestro propio header (ver partials/header.ejs),
    // que además funciona como zona para mover la ventana.
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0a",
      symbolColor: "#d4d4d4",
      height: 40,
    },
    webPreferences: {
      // Superficie de ataque mínima: la ventana solo muestra HTML
      // servido por nuestro propio Express local, como si fuera un
      // navegador apuntando a una sola pestaña de confianza. No
      // necesita (ni tiene) acceso a Node ni IPC hacia el proceso
      // principal.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  mainWindow.setMenu(null);

  // Cualquier intento de abrir una URL externa (target=_blank, o un
  // <a href> a otro dominio) se abre en el navegador del sistema,
  // nunca dentro de la ventana de la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(allowedOrigin)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (app.isPackaged) {
    // No exponer DevTools en el build final.
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.loadURL(allowedOrigin);
}

app.whenReady().then(async () => {
  const port = await startBackend();
  createWindow(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Nunca permitir que una web cargada adentro cree otra ventana de
// Electron sin pasar por el chequeo de arriba.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(allowedOrigin)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
});
