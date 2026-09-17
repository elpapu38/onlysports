# 🏆 Sports Hub — *OnlySports*

> Plataforma deportiva personal y extensible para consultar partidos, resultados, calendarios,
> estadísticas y centralizar diferentes fuentes de transmisión, canales en vivo y video.

Este proyecto también se conoce como **OnlySports**. Ambos nombres refieren al mismo repo: `Sports Hub`
es el nombre conceptual del proyecto (agregador deportivo multideporte) y `OnlySports` es el nombre de
producto/paquete (`package.json`, título de la app, etc.).

---

## 📌 Qué es

Un agregador deportivo y multimedia de uso **personal**: resultados, próximos partidos, partidos en vivo,
estadísticas, posiciones y, además, un lugar centralizado para:

* 📺 **Canales en vivo** — vos (o quien clone este repo) cargás tus propios enlaces de YouTube, Twitch,
  M3U8/HLS, Vimeo, MP4/WebM o cualquier URL. **El repositorio no trae ningún enlace incluido**: la base de
  datos arranca vacía y cada instancia carga los suyos desde `/channels` o el panel admin.
* 💾 **Backup personal (export/import)** — todo lo que cargues a mano (canales, streams que asociaste a un
  partido puntual, y partidos que marcaste como favoritos/seguidos) se puede exportar a un `.json` y volver
  a importar en cualquier momento, por ejemplo si migrás de servidor o reinstalás la base de datos.

No busca ser un servicio público de streaming ni competir con YouTube o ESPN: es un **agregador de
información y de enlaces que el propio usuario decide cargar**, no un proveedor de infraestructura de
streaming.

---

## 🎯 Objetivos

* Consultar varios deportes desde una única interfaz (arranca con NBA, Liga Nacional Argentina, MLB y
  fútbol argentino, pensado para agregar más sin reescribir nada).
* Resultados, próximos partidos y partidos en vivo, con históricos.
* Estadísticas y posiciones, con un modelo de datos genérico (no una tabla por deporte).
* Canales/streams cargados manualmente por el usuario, asociados a un partido o de forma independiente.
* Backup exportable/importable de todo lo cargado manualmente.
* Frontend liviano (EJS + Tailwind, sin SPA) compatible con dispositivos de gama baja y alta.

---

## 🏗️ Stack

| Capa       | Tecnología                                                                 |
|------------|------------------------------------------------------------------------------|
| Backend    | Node.js 22+, TypeScript 7, Express 5                                        |
| Base datos | SQLite (archivo local) + Prisma ORM 7                                       |
| Escritorio | Electron 43 (última estable) + electron-builder                             |
| Frontend   | EJS 6, Tailwind CSS 4 (CLI), JS/TS mínimo                                   |
| Seguridad  | helmet, cors, express-rate-limit, csrf-csrf (double-submit), zod            |

Las versiones exactas están fijadas con `^` en `package.json` sobre las últimas estables disponibles en
npm al momento de crear este scaffold; correr `npm outdated` de tanto en tanto para mantenerlas al día.
`npm audit` no reporta vulnerabilidades conocidas en ninguna de las dependencias (runtime ni build).

---

## 🚀 Cómo correrlo

OnlySports corre como **app de escritorio (Electron)**: no hace falta Docker, ni Laragon, ni instalar
ningún motor de base de datos aparte — cada instalación trae su propia base SQLite (un solo archivo)
dentro de la carpeta de datos del usuario. También se puede correr como sitio web normal en el navegador
si preferís eso (por ejemplo para probarlo mientras desarrollás).

### Modo escritorio (Electron) — recomendado

```bash
npm install
npm run electron:dev     # compila, arma la base SQLite de prueba, recompila el driver de SQLite
                          # para el motor interno de Electron, y abre la ventana de la app
```

> **Sobre `better-sqlite3` y Electron:** Electron trae su propio Node.js interno, con una versión
> distinta a la de tu Node normal — un módulo nativo compilado para uno no sirve para el otro. Por eso
> `electron:dev`/`electron:build` recompilan automáticamente `better-sqlite3` para el motor de Electron
> (`@electron/rebuild`) antes de abrir la app. **Efecto secundario:** si después de correr
> `npm run electron:dev` querés volver a usar `npm run dev` (modo navegador), vas a necesitar devolver
> el módulo a la versión de Node normal con `npm rebuild better-sqlite3` primero — alternar entre los
> dos modos sin recompilar tira el mismo tipo de error (`NODE_MODULE_VERSION ... requires ...`).

Eso levanta el backend Express **adentro** del proceso de Electron (en un puerto local libre, ej.
`127.0.0.1:3000`) y abre una ventana mostrando la app — no hay URL pública, no hay servidor externo.

Para generar el instalador que le pasás a alguien (`.exe` en Windows, `.dmg` en Mac, `.AppImage` en
Linux):

```bash
npm run electron:build
```

El instalador queda en `release/`. La persona que lo instale no necesita tener Node, ni Laragon, ni nada
— abre el instalador y listo. Cada instalación tiene su propia base de datos local, en:

* Windows: `%APPDATA%\OnlySports\onlysports.db`
* Mac: `~/Library/Application Support/OnlySports/onlysports.db`
* Linux: `~/.config/OnlySports/onlysports.db`

> **Seguridad de la ventana de Electron:** la ventana corre en modo `sandbox`, sin `nodeIntegration` y
> con `contextIsolation` — o sea que la página que se muestra no tiene ningún acceso a Node ni al sistema
> de archivos, funciona como si fuera una pestaña de navegador mostrando tu propio backend local. Cualquier
> link que apunte fuera de la app se abre en el navegador del sistema, nunca dentro de la ventana. Se usa
> la versión estable más reciente de Electron disponible al armar este proyecto.

### Modo navegador (para desarrollar)

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate      # crea prisma/dev.db con todas las tablas
npm run db:seed             # datos de ejemplo (opcional)
npm run css:build
npm run dev                 # http://localhost:3000
```

> **Nota sobre Prisma 7:** la URL de conexión ya no va en `prisma/schema.prisma`, vive en
> `prisma.config.ts`. Además, `PrismaClient` en runtime (`src/config/database.ts`) usa un *driver
> adapter* (`@prisma/adapter-better-sqlite3`) en vez de leer la URL directamente — es un cambio de
> Prisma 7, no algo específico de este proyecto. Guía oficial:
> https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

Panel admin: `http://localhost:3000/admin` (usuario/clave desde `.env`, `ADMIN_USER` / `ADMIN_PASSWORD`).

### Docker (opcional, avanzado)

Solo tiene sentido si en algún momento querés un servicio web **compartido** entre varias personas al
mismo tiempo (no es el caso de uso principal del proyecto, que es de escritorio/personal):

```bash
cp .env.example .env
docker compose up --build
```

La app queda en `http://localhost:3000`, con la base SQLite guardada en un volumen de Docker.

---

## 📺 Canales en vivo

* `/channels` — listado + alta de canales (nombre, tipo, enlace, notas).
* `POST /channels` — crea un canal.
* `GET /api/channels` — listado en JSON.
* Tipos soportados: `YOUTUBE`, `TWITCH`, `M3U8`, `VIMEO`, `MP4`, `WEBM`, `URL`.

Un canal puede además asociarse opcionalmente a un deporte/liga para poder filtrarlo más adelante. Los
M3U8/HLS se reproducen en el navegador con `hls.js`; no hay proxy de video en el backend, así que
restricciones de CORS, tokens o DRM del lado de la fuente original pueden impedir la reproducción — la app
debe mostrar un error claro en ese caso, no intentar evadirlas.

---

## 💾 Backup de datos personales (export/import)

Desde `/settings/backup`:

* **Exportar** (`GET /settings/backup/export` o `GET /api/backup/export`): descarga un `.json` con:
  * todos los **canales** cargados;
  * los **streams** que agregaste manualmente a partidos puntuales (`isUserAdded = true`);
  * los **partidos marcados como favoritos/seguidos**.
* **Importar** (`POST /settings/backup/import` o `POST /api/backup/import`): sube ese mismo `.json` y
  restaura todo lo que pueda:
  * los canales se crean o actualizan siempre;
  * los streams y favoritos se restauran solo si el partido correspondiente ya existe en esa base de datos
    (se busca por deporte, liga, equipos y fecha) — por ejemplo, después de correr una sincronización o el
    seed. Si el partido todavía no existe, esa entrada se cuenta como "omitida" en la respuesta, no se
    pierde el resto del backup.

La operación es idempotente: importar el mismo archivo varias veces no duplica datos.

> Esto **no** reemplaza a un backup de la base de datos completa (`mysqldump`), pensalo como un backup
> liviano y portable de "lo que yo cargué a mano", útil para mover esa configuración entre instancias.

---

# 🗄️ Base de datos

Modelo genérico (no hay tabla por deporte):

```text
Sport → League → Season → Game → { GameStatistic, Stream, Video, FavoriteGame }
                        ↘ Team → Player
Channel (independiente, opcionalmente asociado a Sport/League)
```

Ver `prisma/schema.prisma` para el detalle completo.

---

# 🧩 Arquitectura

```text
src/
├── config/        # env, prisma client
├── controllers/    # home, games, channels, backup, legal (disclaimer)
├── services/       # lógica de negocio
├── repositories/   # acceso a datos (Prisma)
├── routes/         # web, api, admin
├── middleware/      # error handler, auth admin, csrf, disclaimer gate
├── providers/       # adapters por deporte (nba, mlb, football, liga-nacional)
├── jobs/           # scheduler de sincronización
├── electron/        # proceso principal de Electron (bootstrap de la app de escritorio)
├── types/          # contratos (SportsProvider, Backup)
├── styles/         # entrada de Tailwind
└── app.ts / server.ts
```

### Provider / Adapter pattern

```text
API externa → Provider → Normalizer → Repository → SQLite
```

Agregar un deporte nuevo implica: crear `src/providers/<deporte>/<Deporte>Provider.ts` implementando
`SportsProvider` (`src/types/provider.ts`) y registrarlo en `src/providers/registry.ts`. El resto del
sistema (scheduler, repositories, vistas) no necesita cambios.

**`TheSportsDbProvider` es el único conectado a una API real hoy** (`thesportsdb.com`, gratis, key
pública `123` ya configurada por defecto — 30 pedidos/minuto). Sincroniza automáticamente al arrancar
la app y después según los horarios de `SYNC_*_CRON` en `.env`. Para agregar una liga:

1. Buscá su ID en https://www.thesportsdb.com/sport/leagues
2. Agregá una entrada en `src/config/theSportsDbLeagues.ts`

No hace falta crear el Sport/League desde Gestión primero — se crean solos la primera vez que se
sincronizan (podés después editarles el nombre desde ahí si querés). `NbaProvider`, `MlbProvider`,
`FootballProvider` y `LigaNacionalProvider` siguen siendo esqueletos vacíos — quedan como punto de
partida por si en algún momento querés una fuente distinta para alguna liga en particular (TheSportsDB
no tiene todo — por ejemplo, ligas muy locales como una liga barrial siguen dependiendo 100% del panel
de Gestión).

---

# 🔌 API interna

```text
GET  /api/games/upcoming
GET  /api/games/live
GET  /api/channels
GET  /api/backup/export
POST /api/backup/import
```

Preparada para crecer (`/api/sports`, `/api/leagues`, `/api/teams`, `/api/standings`, etc. — ver Roadmap)
sin depender del frontend EJS, pensando en una futura app móvil, SPA o widgets.

---

# ⚠️ Sobre las transmisiones

Este proyecto funciona como **agregador/reproductor de fuentes que el propio usuario decide cargar**. No
incluye enlaces propios, no descarga contenido protegido, no retransmite señales sin autorización y no
evade DRM ni restricciones de plataformas. Las fuentes que cargues deben ser reproducibles legítimamente
mediante los mecanismos de embedding o reproducción permitidos por cada proveedor (YouTube, Twitch, etc.).

---

# 🚀 Roadmap

* [x] Fase 1 — Scaffold: Node.js + TypeScript + Express + EJS + Tailwind + Prisma + MySQL, arquitectura MVC.
* [ ] Fase 2 — CRUD completo de deportes/ligas/temporadas/equipos/partidos.
* [ ] Fase 3 — Providers reales (NBA, MLB, fútbol, Liga Nacional) + normalización + sync automática.
* [ ] Fase 4 — Multimedia: YouTube, M3U8/HLS (`hls.js`), Twitch, Vimeo, MP4/WebM.
* [ ] Fase 5 — Estadísticas y boxscores por deporte, standings.
* [ ] Fase 6 — Panel admin completo (CRUD de todo, sincronización manual).
* [ ] Fase 7 — Redis cache, jobs, CDN, monitoring.
* [ ] Fase 8 — Más deportes, favoritos avanzados, notificaciones, PWA.

---

# 📁 Estructura del proyecto

```text
onlysports/
├── src/
├── prisma/
├── public/
├── views/
├── tests/
├── scripts/
├── docs/
├── .env.example
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile
└── README.md
```
