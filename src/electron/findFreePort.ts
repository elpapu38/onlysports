import net from "node:net";

/**
 * Busca un puerto TCP libre en 127.0.0.1, empezando por `preferred`.
 * Sirve para no chocar si el usuario ya tiene algo corriendo en el
 * puerto por defecto (3000).
 */
export function findFreePort(preferred: number, attempts = 20): Promise<number> {
  return tryPort(preferred, attempts);
}

function tryPort(port: number, attemptsLeft: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      if (attemptsLeft <= 1) {
        reject(new Error("No se encontró un puerto libre."));
        return;
      }
      resolve(tryPort(port + 1, attemptsLeft - 1));
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(port));
    });
  });
}
