import { startSpineServer } from "./server.ts";
import { loadRepoEnv } from "./lib/env.ts";

loadRepoEnv();

const port = Number(process.env.PORT ?? 8787);
startSpineServer(port);
console.log(`svika spine listening on :${port}`);
