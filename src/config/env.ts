import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 3000),
  appName: process.env.APP_NAME ?? "OnlySports",

  sessionSecret: required("SESSION_SECRET", "dev-secret"),
  csrfSecret: required("CSRF_SECRET", "dev-csrf-secret"),

  databaseUrl: required("DATABASE_URL", "file:./prisma/dev.db"),

  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  redisEnabled: process.env.REDIS_ENABLED === "true",

  providers: {
    nba: process.env.NBA_PROVIDER_API_KEY ?? "",
    mlb: process.env.MLB_PROVIDER_API_KEY ?? "",
    football: process.env.FOOTBALL_PROVIDER_API_KEY ?? "",
    ligaNacional: process.env.LIGA_NACIONAL_PROVIDER_API_KEY ?? "",
    // "123" es la key gratuita pública de TheSportsDB (30 pedidos/min).
    // Si en algún momento pasás a un plan pago, reemplazá acá o seteá
    // THESPORTSDB_API_KEY en el .env.
    theSportsDb: process.env.THESPORTSDB_API_KEY ?? "123",
  },

  cron: {
    upcoming: process.env.SYNC_UPCOMING_CRON ?? "0 */6 * * *",
    today: process.env.SYNC_TODAY_CRON ?? "*/10 * * * *",
    live: process.env.SYNC_LIVE_CRON ?? "*/1 * * * *",
    historical: process.env.SYNC_HISTORICAL_CRON ?? "0 3 * * *",
  },

  admin: {
    user: process.env.ADMIN_USER ?? "admin",
    password: process.env.ADMIN_PASSWORD ?? "change-me",
  },
};
