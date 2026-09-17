import { createApp } from "./app";
import { env } from "@/config/env";
import { startScheduler } from "@/jobs/scheduler";

const app = createApp();

app.listen(env.port, () => {
  console.log(`⚡️ ${env.appName} corriendo en http://localhost:${env.port} (${env.nodeEnv})`);
  startScheduler();
});
