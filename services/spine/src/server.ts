// Minimal dependency-free HTTP surface for the spine service. Only /health is
// wired for P0; the inference routes land with the models in P4. Kept on
// node:http so the scaffold carries no framework weight.
import { createServer, type Server } from "node:http";
import { health } from "./spine";

export function createSpineServer(): Server {
  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(health()));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
}

export function startSpineServer(port = Number(process.env.PORT ?? 8787)): Server {
  const server = createSpineServer();
  server.listen(port);
  return server;
}
