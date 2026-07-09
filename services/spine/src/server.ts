// Minimal dependency-free HTTP surface for the spine service. /health and
// GET /eta (Spine 1 arrival prediction) are wired; the other inference
// routes land with their models. Kept on node:http so the scaffold carries
// no framework weight.
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { health } from "./spine.ts";
import { anonClient, loadRouteData } from "./eta/data.ts";
import {
  cachedRouteLoader,
  createEtaHandler,
  readServedEngine,
  type EtaResponse,
} from "./eta/service.ts";

export type EtaEndpoint = (params: URLSearchParams) => Promise<EtaResponse>;

const METRICS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "metrics");

/** Built on first use so importing the server never requires database env. */
function lazyEtaEndpoint(): EtaEndpoint {
  let handler: EtaEndpoint | null = null;
  return async (params) => {
    if (!handler) {
      const client = anonClient();
      handler = createEtaHandler({
        loadRoute: cachedRouteLoader((code) => loadRouteData(client, code)),
        served: readServedEngine(METRICS_DIR),
      });
    }
    return handler(params);
  };
}

export function createSpineServer(eta: EtaEndpoint = lazyEtaEndpoint()): Server {
  return createServer((req, res) => {
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    const url = new URL(req.url ?? "/", "http://spine.local");
    if (req.method === "GET" && url.pathname === "/health") {
      respond(200, health());
      return;
    }
    if (req.method === "GET" && url.pathname === "/eta") {
      eta(url.searchParams)
        .then(({ status, body }) => respond(status, body))
        .catch(() => respond(503, { error: "eta unavailable" }));
      return;
    }
    respond(404, { error: "not found" });
  });
}

export function startSpineServer(port = Number(process.env.PORT ?? 8787)): Server {
  const server = createSpineServer();
  server.listen(port);
  return server;
}
