import { Hono } from "hono";

import { createApp } from "./examples/ai-sdr/src/server.js";

const app: Hono = createApp();

export default app;
