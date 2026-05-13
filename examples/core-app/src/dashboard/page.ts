function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderDashboardLoginPage(input?: { error?: string }) {
  return `<!doctype html>
<html>
  <body style="font-family: ui-sans-serif, system-ui; background:#0b0f14; color:#f5f7fb; display:grid; min-height:100vh; place-items:center;">
    <form method="post" action="/dashboard/login" style="width:320px; padding:24px; background:#111823; border:1px solid #263041; border-radius:12px;">
      <h1 style="margin:0 0 12px;">Trellis</h1>
      <p style="margin:0 0 16px; color:#a6b3c7;">Core operator surface</p>
      ${input?.error ? `<p style="color:#ff8b8b;">${escapeHtml(input.error)}</p>` : ""}
      <label style="display:block; margin-bottom:8px;">Password</label>
      <input type="password" name="password" style="width:100%; padding:10px; border-radius:8px; border:1px solid #3a465a; background:#0b0f14; color:#f5f7fb;" />
      <button type="submit" style="margin-top:12px; width:100%; padding:10px; border-radius:8px; border:none; background:#7c96ff; color:#08111f; font-weight:600;">Login</button>
    </form>
  </body>
</html>`;
}

export function renderDashboardPage() {
  return `<!doctype html>
<html>
  <body style="font-family: ui-sans-serif, system-ui; background:#0b0f14; color:#f5f7fb; margin:0;">
    <main style="max-width:1100px; margin:0 auto; padding:32px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
        <div>
          <div style="letter-spacing:0.12em; text-transform:uppercase; color:#8ea2c2; font-size:12px;">Trellis</div>
          <h1 style="margin:8px 0 0;">Core Operator Console</h1>
        </div>
        <form method="post" action="/dashboard/logout"><button style="padding:10px 14px; border-radius:8px; border:1px solid #32415b; background:#111823; color:#f5f7fb;">Logout</button></form>
      </div>
      <p style="color:#a6b3c7;">Use <code>/api/dashboard/state</code> for live JSON state and <code>/mcp/trellis</code> for natural-language control.</p>
    </main>
  </body>
</html>`;
}

