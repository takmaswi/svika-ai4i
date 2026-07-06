import { startSpineServer } from "./server";

const port = Number(process.env.PORT ?? 8787);
startSpineServer(port);
console.log(`svika spine listening on :${port}`);
