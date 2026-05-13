import { Hono } from "hono";

import { createApp } from "./examples/reference-app/src/server.js";

const app: Hono = createApp();

export default app;
