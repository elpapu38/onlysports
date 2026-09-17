import Redis from "ioredis";
import { env } from "./env";

// Redis es opcional en desarrollo. Si REDIS_ENABLED=false, se expone
// un cliente "no-op" para que el resto del código no tenga que
// verificar constantemente si Redis está disponible.
class NoopRedis {
  async get() {
    return null;
  }
  async set() {
    return "OK";
  }
  async del() {
    return 0;
  }
  async expire() {
    return 0;
  }
}

export const redis = env.redisEnabled ? new Redis(env.redisUrl) : (new NoopRedis() as unknown as Redis);
