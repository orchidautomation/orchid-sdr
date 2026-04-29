import type { Hono } from "hono";

export function registerRivetManagerRoutes(app: Hono) {
  app.all("/api/rivet", (c) => proxyRivetManagerRequest(c.req.raw));
  app.all("/api/rivet/*", (c) => proxyRivetManagerRequest(c.req.raw));
}

async function proxyRivetManagerRequest(request: Request) {
  const incomingUrl = new URL(request.url);
  const managerUrl = new URL(`http://127.0.0.1:6420${stripRivetPrefix(incomingUrl.pathname)}${incomingUrl.search}`);
  return await fetch(
    new Request(managerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
      redirect: "manual",
    }),
  );
}

function stripRivetPrefix(pathname: string) {
  if (pathname === "/api/rivet") {
    return "/";
  }

  if (pathname.startsWith("/api/rivet/")) {
    const stripped = pathname.slice("/api/rivet".length);
    return stripped.length > 0 ? stripped : "/";
  }

  return pathname;
}
