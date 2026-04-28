import type { Hono } from "hono";

export interface DefaultSdrDashboardActionMount {
  path: string;
  handle(input: { body: Record<string, unknown> }): Promise<{
    status?: number;
    body: Record<string, unknown>;
  }>;
}

export function mountDefaultSdrDashboardActionRoutes(
  app: Hono,
  input: {
    requireAuth(request: Request): boolean;
    actions: DefaultSdrDashboardActionMount[];
  },
) {
  for (const action of input.actions) {
    app.post(action.path, async (c) => {
      if (!input.requireAuth(c.req.raw)) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
      const result = await action.handle({ body });
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });
  }
}
