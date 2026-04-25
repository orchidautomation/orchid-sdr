function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function renderDashboardLoginPage(input?: {
  error?: string;
}) {
  const error = input?.error ? `<p class="error">${escapeAttribute(input.error)}</p>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orchid SDR Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #07090d;
        --bg-alt: #0d1117;
        --surface-soft: rgba(255, 255, 255, 0.03);
        --ink: #f5f7fa;
        --muted: #9aa6b2;
        --line: rgba(255, 255, 255, 0.08);
        --line-strong: rgba(255, 255, 255, 0.14);
        --accent: #7ab8ff;
        --accent-strong: #4f8df2;
        --danger: #f28c79;
        --shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(122,184,255,0.18), transparent 30%),
          radial-gradient(circle at 85% 12%, rgba(99,210,151,0.08), transparent 24%),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-alt) 100%);
        color: var(--ink);
        font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.04), transparent 16%),
          radial-gradient(circle at 50% -20%, rgba(255,255,255,0.08), transparent 42%);
        opacity: 0.45;
      }
      .panel {
        width: min(100%, 460px);
        margin: 24px;
        padding: 34px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(20, 26, 35, 0.96), rgba(13, 17, 23, 0.96)),
          linear-gradient(135deg, rgba(122,184,255,0.08), rgba(99,210,151,0.04));
        box-shadow: var(--shadow);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 18px;
        color: var(--muted);
        font: 600 0.72rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .eyebrow::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 6px rgba(122,184,255,0.14);
      }
      h1 {
        margin: 0 0 12px;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: clamp(2.2rem, 8vw, 3.2rem);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }
      p {
        margin: 0 0 22px;
        color: var(--muted);
        line-height: 1.7;
      }
      form {
        display: grid;
        gap: 14px;
      }
      label {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font: 600 0.72rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      input {
        width: 100%;
        padding: 15px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: var(--surface-soft);
        font: inherit;
        color: var(--ink);
      }
      input:focus-visible {
        outline: none;
        border-color: var(--line-strong);
        box-shadow: 0 0 0 3px rgba(122,184,255,0.18);
      }
      button {
        width: 100%;
        min-height: 50px;
        padding: 0 18px;
        border: 0;
        border-radius: 16px;
        background: linear-gradient(180deg, var(--accent), var(--accent-strong));
        color: #08111d;
        font: 600 0.84rem/1 "IBM Plex Mono", ui-monospace, monospace;
        cursor: pointer;
        box-shadow: 0 16px 32px rgba(79,141,242,0.22);
        transition: transform 140ms ease, box-shadow 140ms ease;
      }
      button:hover {
        transform: translateY(-1px);
      }
      button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(122,184,255,0.18), 0 16px 32px rgba(79,141,242,0.22);
      }
      .meta {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 0.9rem;
      }
      .error {
        margin: 0 0 14px;
        color: var(--danger);
      }
      @media (max-width: 640px) {
        .panel {
          margin: 14px;
          padding: 24px;
          border-radius: 22px;
        }
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <p class="eyebrow">Orchid SDR / Protected Access</p>
      <h1>Operator dashboard</h1>
      <p>Dark, minimal access to discovery, qualification, research, and handoff flow.</p>
      ${error}
      <form method="post" action="/dashboard/login">
        <div>
          <label for="password">Dashboard password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button type="submit">Open dashboard</button>
      </form>
      <p class="meta">Internal-only surface. Use your dashboard password to continue.</p>
    </main>
  </body>
</html>`;
}

export function renderDashboardPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orchid SDR Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #050608;
        --surface: #090b0f;
        --surface-2: #0d1015;
        --surface-3: #131720;
        --line: #191d25;
        --line-soft: #141821;
        --line-strong: #262c37;
        --ink: #f5f7fa;
        --ink-soft: #d4d8de;
        --muted: #8b93a1;
        --accent: #7c9cff;
        --accent-strong: #6387ff;
        --success: #69d48e;
        --warning: #f0c164;
        --danger: #ef8978;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      body {
        min-height: 100vh;
        background: var(--bg);
        color: var(--ink);
        font-family: "Geist", "Segoe UI", sans-serif;
      }
      a { color: inherit; }
      form { margin: 0; }
      button, input { font: inherit; }
      code {
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 0.74rem;
        color: var(--ink-soft);
      }
      .inline-link {
        color: var(--accent);
        text-decoration: none;
      }
      .inline-link:hover {
        text-decoration: underline;
      }
      .app {
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
        min-height: 100vh;
      }
      .sidebar {
        padding: 20px 16px 18px;
        border-right: 1px solid var(--line);
        background: linear-gradient(180deg, #050608 0%, #06080c 100%);
      }
      .sidebar-inner {
        position: sticky;
        top: 0;
        display: grid;
        gap: 18px;
        min-height: calc(100vh - 38px);
      }
      .sidebar-section {
        padding: 0 4px 18px;
        border-bottom: 1px solid var(--line);
      }
      .sidebar-section:last-child {
        margin-top: auto;
        padding-bottom: 0;
        border-bottom: 0;
      }
      .brand {
        display: grid;
        gap: 10px;
      }
      .brand-mark {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 4px rgba(124, 156, 255, 0.12);
      }
      .brand-copy {
        display: grid;
        gap: 4px;
      }
      .brand-kicker {
        margin: 0;
        color: var(--muted);
        font: 600 0.67rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .brand h1 {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .brand-note {
        margin: 0;
        color: var(--muted);
        font-size: 0.84rem;
        line-height: 1.55;
      }
      .section-label {
        margin: 0 0 10px;
        color: var(--muted);
        font: 600 0.64rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .status-list {
        display: grid;
        gap: 8px;
      }
      .status-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface-2);
      }
      .status-dot {
        width: 8px;
        height: 8px;
        margin-top: 5px;
        border-radius: 999px;
        background: var(--muted);
      }
      .status-dot.success { background: var(--success); }
      .status-dot.warn { background: var(--warning); }
      .status-dot.danger { background: var(--danger); }
      .status-copy {
        display: grid;
        gap: 3px;
        min-width: 0;
      }
      .status-meta {
        color: var(--muted);
        font: 600 0.61rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .status-value {
        font-size: 0.88rem;
        line-height: 1.3;
        letter-spacing: -0.02em;
      }
      .tab-list {
        display: grid;
        gap: 4px;
      }
      .tab-button {
        appearance: none;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid transparent;
        border-radius: 12px;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        text-align: left;
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
      }
      .tab-button:hover {
        background: var(--surface-2);
      }
      .tab-button.active {
        border-color: var(--line-strong);
        background: var(--surface-2);
        color: var(--ink);
      }
      .tab-copy {
        display: grid;
        gap: 3px;
      }
      .tab-label {
        font-size: 0.88rem;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .tab-hint {
        color: var(--muted);
        font: 500 0.69rem/1.4 "IBM Plex Mono", ui-monospace, monospace;
      }
      .sidebar-actions {
        display: grid;
        gap: 8px;
      }
      .btn {
        appearance: none;
        width: 100%;
        height: 38px;
        padding: 0 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface-2);
        color: var(--ink);
        cursor: pointer;
        font: 600 0.71rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: border-color 140ms ease, background 140ms ease;
      }
      .btn:hover {
        border-color: var(--line-strong);
        background: var(--surface-3);
      }
      .btn-primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #0a0d12;
      }
      .btn-primary:hover {
        background: var(--accent-strong);
        border-color: var(--accent-strong);
      }
      .btn-ghost {
        color: var(--muted);
      }
      .btn-danger {
        background: rgba(239, 137, 120, 0.14);
        border-color: rgba(239, 137, 120, 0.34);
        color: #ffd7d0;
      }
      .btn-danger:hover {
        background: rgba(239, 137, 120, 0.2);
        border-color: rgba(239, 137, 120, 0.48);
      }
      .btn:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }
      .btn:disabled:hover {
        border-color: var(--line);
        background: var(--surface-2);
      }
      .btn:focus-visible,
      .tab-button:focus-visible,
      .inline-link:focus-visible {
        outline: none;
        border-color: var(--accent);
      }
      .main {
        min-width: 0;
        padding: 20px 22px 28px;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 16px;
        margin-bottom: 14px;
      }
      .toolbar-copy {
        display: grid;
        gap: 8px;
      }
      .toolbar-kicker {
        margin: 0;
        color: var(--muted);
        font: 600 0.66rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .toolbar-line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 10px 14px;
      }
      .toolbar h2 {
        margin: 0;
        font-size: 1.15rem;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }
      .toolbar-subtle {
        margin: 0;
        color: var(--muted);
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .toolbar-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        color: var(--muted);
        font-size: 0.84rem;
      }
      .meta-pill {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface-2);
        color: var(--muted);
        font: 600 0.64rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .metric-strip {
        margin-bottom: 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        overflow: hidden;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      .stat {
        display: grid;
        gap: 12px;
        min-height: 76px;
        padding: 14px 16px;
        box-shadow: inset -1px 0 0 var(--line), inset 0 -1px 0 var(--line);
      }
      .stat .label {
        color: var(--muted);
        font: 600 0.61rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .stat .value {
        font-size: 1.82rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.05em;
      }
      .panel {
        display: none;
      }
      .panel.active {
        display: block;
      }
      .panel-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        align-items: start;
      }
      .card {
        grid-column: span 12;
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface-2);
        overflow: hidden;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.01);
      }
      .card-head h2 {
        margin: 0;
        font-size: 0.98rem;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .card-head p {
        margin: 0;
        color: var(--muted);
        font-size: 0.84rem;
        line-height: 1.45;
      }
      .card-body {
        padding: 14px;
      }
      .card-body.tight {
        padding: 0;
      }
      .table-shell {
        overflow: auto;
      }
      table {
        width: 100%;
        min-width: 640px;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line-soft);
        vertical-align: top;
        word-break: break-word;
      }
      th {
        color: var(--muted);
        background: var(--surface-2);
        font: 600 0.61rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      tbody tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }
      tbody tr:last-child td {
        border-bottom: 0;
      }
      td strong {
        display: block;
        margin-bottom: 4px;
        font-size: 0.96rem;
        line-height: 1.3;
        letter-spacing: -0.02em;
      }
      .feed {
        display: grid;
        gap: 0;
      }
      .feed-item {
        padding: 12px 0;
        border-bottom: 1px solid var(--line-soft);
      }
      .feed-item:first-child {
        padding-top: 0;
      }
      .feed-item:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }
      .feed-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .feed-event {
        color: var(--ink-soft);
        font: 600 0.68rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .feed-subtle {
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.55;
      }
      .cell-stack {
        display: grid;
        gap: 4px;
      }
      .compact-stack {
        display: grid;
        gap: 2px;
      }
      .badge,
      .chip {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 0 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        font: 600 0.62rem/1 "IBM Plex Mono", ui-monospace, monospace;
        white-space: nowrap;
      }
      .badge { color: var(--ink-soft); }
      .badge.success,
      .chip.success { color: var(--success); }
      .badge.warn,
      .chip.warn { color: var(--warning); }
      .badge.danger,
      .chip.danger { color: var(--danger); }
      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .reasoning-list {
        display: grid;
        gap: 0;
      }
      .reasoning-item {
        padding: 14px 0;
        border-bottom: 1px solid var(--line-soft);
      }
      .reasoning-item:first-child {
        padding-top: 0;
      }
      .reasoning-item:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }
      .reasoning-item h3 {
        margin: 0 0 8px;
        font-size: 0.96rem;
        letter-spacing: -0.02em;
      }
      .reasoning-item p {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 0.86rem;
        line-height: 1.55;
      }
      .actor-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .actor {
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
      }
      .actor h3 {
        margin: 0 0 10px;
        color: var(--ink-soft);
        font: 600 0.67rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .meta {
        display: grid;
        gap: 7px;
        margin: 0;
      }
      .meta div {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        font-size: 0.84rem;
      }
      .meta dt {
        color: var(--muted);
      }
      .meta dd {
        margin: 0;
        text-align: right;
        color: var(--ink-soft);
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 0.72rem;
      }
      .empty {
        color: var(--muted);
        font-style: italic;
      }
      .toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        max-width: 320px;
        padding: 11px 13px;
        border: 1px solid var(--line-strong);
        border-radius: 10px;
        background: #0e1117;
        color: var(--ink);
        font: 600 0.72rem/1.5 "IBM Plex Mono", ui-monospace, monospace;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      }
      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.12);
        border-radius: 999px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      @media (max-width: 1180px) {
        .app {
          grid-template-columns: 1fr;
        }
        .sidebar {
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }
        .sidebar-inner {
          position: static;
          min-height: 0;
        }
        .tab-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .actor-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 780px) {
        .sidebar,
        .main {
          padding: 14px;
        }
        .toolbar,
        .card-head,
        .feed-top {
          flex-direction: column;
          align-items: flex-start;
        }
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .tab-list {
          grid-template-columns: 1fr;
        }
        .actor-grid {
          grid-template-columns: 1fr;
        }
        table {
          min-width: 560px;
        }
      }
      @media (min-width: 1101px) {
        .span-4 { grid-column: span 4; }
        .span-5 { grid-column: span 5; }
        .span-7 { grid-column: span 7; }
        .span-8 { grid-column: span 8; }
        .span-12 { grid-column: span 12; }
      }
    </style>
  </head>
  <body>
    <main class="app">
      <aside class="sidebar">
        <div class="sidebar-inner">
          <section class="sidebar-section">
            <div class="brand">
              <div class="brand-mark">
                <span class="brand-dot"></span>
                <div class="brand-copy">
                  <p class="brand-kicker">Orchid SDR</p>
                  <h1>Operator Console</h1>
                </div>
              </div>
              <p class="brand-note">Minimal visibility into discovery, qualification, and handoff state.</p>
            </div>
          </section>

          <section class="sidebar-section">
            <p class="section-label">System</p>
            <div class="status-list">
              <div class="status-row">
                <span id="service-dot" class="status-dot"></span>
                <div class="status-copy">
                  <span class="status-meta">Service</span>
                  <strong id="service-status" class="status-value">Loading...</strong>
                </div>
              </div>
              <div class="status-row">
                <span id="sends-dot" class="status-dot warn"></span>
                <div class="status-copy">
                  <span class="status-meta">Send Mode</span>
                  <strong id="sends-status" class="status-value">Checking...</strong>
                </div>
              </div>
              <div class="status-row">
                <span id="kill-dot" class="status-dot"></span>
                <div class="status-copy">
                  <span class="status-meta">Kill Switch</span>
                  <strong id="kill-status" class="status-value">Checking...</strong>
                </div>
              </div>
              <div class="status-row">
                <span id="pause-dot" class="status-dot"></span>
                <div class="status-copy">
                  <span class="status-meta">Automation</span>
                  <strong id="pause-status" class="status-value">Checking...</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="sidebar-section">
            <p class="section-label">Views</p>
            <nav class="tab-list" role="tablist" aria-label="Dashboard sections">
              <button class="tab-button active" type="button" data-tab="overview">
                <span class="tab-copy">
                  <span class="tab-label">Overview</span>
                  <span class="tab-hint">threads and activity</span>
                </span>
              </button>
              <button class="tab-button" type="button" data-tab="pipeline">
                <span class="tab-copy">
                  <span class="tab-label">Pipeline</span>
                  <span class="tab-hint">qualified leads and ICP</span>
                </span>
              </button>
              <button class="tab-button" type="button" data-tab="signals">
                <span class="tab-copy">
                  <span class="tab-label">Signals</span>
                  <span class="tab-hint">provider runs and sources</span>
                </span>
              </button>
              <button class="tab-button" type="button" data-tab="runtime">
                <span class="tab-copy">
                  <span class="tab-label">Runtime</span>
                  <span class="tab-hint">actors and async jobs</span>
                </span>
              </button>
            </nav>
          </section>

          <section class="sidebar-section">
            <p class="section-label">Actions</p>
            <div class="sidebar-actions">
              <button id="toggle-pause" class="btn btn-danger" type="button">Pause Automation</button>
              <button id="trigger-discovery" class="btn btn-primary" type="button">Run Discovery</button>
              <button id="run-probe" class="btn" type="button">Run Probe</button>
              <form method="post" action="/dashboard/logout">
                <button class="btn btn-ghost" type="submit">Log Out</button>
              </form>
            </div>
          </section>
        </div>
      </aside>

      <section class="main">
        <header class="toolbar">
          <div class="toolbar-copy">
            <p class="toolbar-kicker">Operator Surface</p>
            <div class="toolbar-line">
              <h2 id="panel-title">Overview</h2>
              <p id="panel-description" class="toolbar-subtle">Live threads, feed, and current throughput.</p>
            </div>
          </div>
          <div class="toolbar-meta">
            <span class="meta-pill">Auto Refresh 10s</span>
            <span id="generated-at">Waiting for first refresh...</span>
          </div>
        </header>

        <section class="metric-strip">
          <div id="stats" class="summary-grid"></div>
        </section>

        <section class="panel active" data-panel="overview">
          <div class="panel-grid">
            <article class="card span-8">
              <div class="card-head">
                <h2>Pipeline</h2>
                <p>Prospects currently moving through the workflow</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Prospect</th><th>Qualification</th><th>Stage</th><th>LinkedIn</th><th>Updated</th></tr>
                    </thead>
                    <tbody id="active-threads"></tbody>
                  </table>
                </div>
              </div>
            </article>

            <article class="card span-4">
              <div class="card-head">
                <h2>Activity</h2>
                <p>Recent workflow events</p>
              </div>
              <div class="card-body">
                <div id="audit-feed" class="feed"></div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel" data-panel="pipeline">
          <div class="panel-grid">
            <article class="card span-8">
              <div class="card-head">
                <h2>Qualified Leads</h2>
                <p>Current leads with stored assessment context</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Prospect</th><th>Email</th><th>Qualification</th><th>Research</th><th>Thread</th><th>Updated</th></tr>
                    </thead>
                    <tbody id="qualified-leads"></tbody>
                  </table>
                </div>
              </div>
            </article>

            <article class="card span-4">
              <div class="card-head">
                <h2>Qualification Notes</h2>
                <p>Recent ICP decisions</p>
              </div>
              <div class="card-body">
                <div id="qualification-overview" class="reasoning-list"></div>
              </div>
            </article>

            <article class="card span-12">
              <div class="card-head">
                <h2>Recent Records</h2>
                <p>Newest qualification entries</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Qualification</th><th>Status</th><th>Updated</th></tr>
                    </thead>
                    <tbody id="recent-prospects"></tbody>
                  </table>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel" data-panel="signals">
          <div class="panel-grid">
            <article class="card span-7">
              <div class="card-head">
                <h2>Provider Runs</h2>
                <p>Discovery runs, durations, and failures</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Provider</th><th>Run</th><th>Status</th><th>Duration</th><th>Result</th></tr>
                    </thead>
                    <tbody id="provider-runs"></tbody>
                  </table>
                </div>
              </div>
            </article>

            <article class="card span-5">
              <div class="card-head">
                <h2>Recent Signals</h2>
                <p>New source captures entering the pipeline</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Source</th><th>Author</th><th>Topic</th><th>Captured</th></tr>
                    </thead>
                    <tbody id="recent-signals"></tbody>
                  </table>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel" data-panel="runtime">
          <div class="panel-grid">
            <article class="card span-12">
              <div class="card-head">
                <h2>Actor State</h2>
                <p>Flags, runtime health, and discovery coordinators</p>
              </div>
              <div class="card-body">
                <div id="actors" class="actor-grid"></div>
              </div>
            </article>

            <article class="card span-12">
              <div class="card-head">
                <h2>Sandbox Jobs</h2>
                <p>Recent async turns</p>
              </div>
              <div class="card-body tight">
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr><th>Job</th><th>Stage</th><th>Status</th><th>Duration</th><th>Result</th></tr>
                    </thead>
                    <tbody id="sandbox-jobs"></tbody>
                  </table>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <script>
      const currencyDuration = (value) => {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
        const ms = Number(value);
        if (ms < 1000) return \`\${ms}ms\`;
        const seconds = ms / 1000;
        if (seconds < 60) return \`\${seconds.toFixed(1)}s\`;
        return \`\${(seconds / 60).toFixed(1)}m\`;
      };

      const formatter = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const byId = (id) => document.getElementById(id);
      const tabs = Array.from(document.querySelectorAll("[data-tab]"));
      const panels = Array.from(document.querySelectorAll("[data-panel]"));
      let latestState = null;
      const tabMeta = {
        overview: {
          title: "Overview",
          description: "Live threads, feed, and current throughput.",
        },
        pipeline: {
          title: "Pipeline",
          description: "Qualified leads, stored ICP reasoning, and recent decisions.",
        },
        signals: {
          title: "Signals",
          description: "Provider activity and the latest source captures.",
        },
        runtime: {
          title: "Runtime",
          description: "Actor state, flags, and recent async execution.",
        },
      };

      function readStoredTab() {
        try {
          return localStorage.getItem("orchid-dashboard-tab");
        } catch {
          return null;
        }
      }

      function writeStoredTab(value) {
        try {
          localStorage.setItem("orchid-dashboard-tab", value);
        } catch {}
      }

      function setActiveTab(value) {
        const next = tabs.some((button) => button.dataset.tab === value) ? value : "overview";
        writeStoredTab(next);
        tabs.forEach((button) => {
          button.classList.toggle("active", button.dataset.tab === next);
        });
        panels.forEach((panel) => {
          const isActive = panel.dataset.panel === next;
          panel.classList.toggle("active", isActive);
          panel.hidden = !isActive;
        });
        const meta = tabMeta[next] || tabMeta.overview;
        byId("panel-title").textContent = meta.title;
        byId("panel-description").textContent = meta.description;
      }

      setActiveTab(readStoredTab() || "overview");
      tabs.forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));

      function timeLabel(value) {
        if (!value) return "—";
        try { return formatter.format(new Date(value)); } catch { return String(value); }
      }

      function truncateText(value, limit = 180) {
        const text = String(value ?? "");
        if (text.length <= limit) return text;
        return text.slice(0, Math.max(0, limit - 3)).trimEnd() + "...";
      }

      function badge(status) {
        const value = String(status || "unknown");
        const kind = /failed|error|paused|kill/i.test(value)
          ? "danger"
          : /queued|running|active|warning/i.test(value)
            ? "warn"
            : "success";
        return \`<span class="badge \${kind}">\${escapeHtml(value)}</span>\`;
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function renderRows(targetId, rows, renderRow, colspan) {
        const target = byId(targetId);
        if (!rows || rows.length === 0) {
          target.innerHTML = \`<tr><td class="empty" colspan="\${colspan}">No data yet.</td></tr>\`;
          return;
        }
        target.innerHTML = rows.map(renderRow).join("");
      }

      function renderStats(summary) {
        const cards = [
          ["Signals", summary.signals],
          ["Prospects", summary.prospects],
          ["Qualified", summary.qualifiedLeads],
          ["Active Threads", summary.activeThreads],
          ["Paused Threads", summary.pausedThreads],
          ["Provider Runs / 24h", summary.providerRuns24h],
        ];
        byId("stats").innerHTML = cards.map(([label, value]) => \`
          <article class="stat">
            <span class="label">\${escapeHtml(label)}</span>
            <span class="value">\${escapeHtml(value)}</span>
          </article>
        \`).join("");
      }

      function renderActors(actors, discovery) {
        const actorCards = [];

        if (actors?.sourceIngest) {
          const state = actors.sourceIngest.state || {};
          actorCards.push(\`
            <article class="actor">
              <h3>sourceIngest</h3>
              <dl class="meta">
                <div><dt>Runs ingested</dt><dd>\${escapeHtml(state.ingestedRuns ?? 0)}</dd></div>
                <div><dt>Last run</dt><dd>\${escapeHtml(state.lastActorRunId || "—")}</dd></div>
              </dl>
            </article>
          \`);
        }

        if (actors?.sandboxBroker) {
          const state = actors.sandboxBroker.state || {};
          const counts = Array.isArray(actors.sandboxBroker.jobCounts) ? actors.sandboxBroker.jobCounts : [];
          actorCards.push(\`
            <article class="actor">
              <h3>sandboxBroker</h3>
              <dl class="meta">
                <div><dt>Total turns</dt><dd>\${escapeHtml(state.runs ?? 0)}</dd></div>
                <div><dt>Last stage</dt><dd>\${escapeHtml(state.lastStage || "—")}</dd></div>
                <div><dt>Last prospect</dt><dd>\${escapeHtml(state.lastProspectId || "—")}</dd></div>
                <div><dt>Last job</dt><dd>\${escapeHtml(state.lastJobId || "—")}</dd></div>
                <div><dt>Job counts</dt><dd>\${escapeHtml(counts.map((entry) => \`\${entry.status}:\${entry.count}\`).join(" ") || "—")}</dd></div>
              </dl>
            </article>
          \`);
        }

        if (actors?.campaignOps) {
          const state = actors.campaignOps.state || {};
          const flags = actors.campaignOps.flags || {};
          actorCards.push(\`
            <article class="actor">
              <h3>campaignOps</h3>
              <dl class="meta">
                <div><dt>No sends</dt><dd>\${escapeHtml(flags.noSendsMode ? "on" : "off")}</dd></div>
                <div><dt>Kill switch</dt><dd>\${escapeHtml(flags.globalKillSwitch ? "on" : "off")}</dd></div>
                <div><dt>Paused campaigns</dt><dd>\${escapeHtml((flags.pausedCampaignIds || []).length)}</dd></div>
                <div><dt>Last mutation</dt><dd>\${escapeHtml(timeLabel(state.lastMutationAt || null))}</dd></div>
              </dl>
            </article>
          \`);
        }

        for (const [key, snapshot] of Object.entries(discovery)) {
          if (!snapshot) continue;
          const state = snapshot.state || {};
          actorCards.push(\`
            <article class="actor">
              <h3>\${escapeHtml(key)}</h3>
              <dl class="meta">
                <div><dt>Status</dt><dd>\${escapeHtml(state.lastStatus || "idle")}</dd></div>
                <div><dt>Ticks</dt><dd>\${escapeHtml(state.ticks ?? 0)}</dd></div>
                <div><dt>Planner</dt><dd>\${escapeHtml(state.lastPlanner || "fallback")}</dd></div>
                <div><dt>Last term</dt><dd>\${escapeHtml(state.lastTerm || "—")}</dd></div>
                <div><dt>Next tick</dt><dd>\${escapeHtml(timeLabel(state.nextTickAt || null))}</dd></div>
                <div><dt>Latest run</dt><dd>\${escapeHtml(snapshot.runs?.[0]?.actor_run_id || "—")}</dd></div>
              </dl>
            </article>
          \`);
        }

        byId("actors").innerHTML = actorCards.join("") || '<p class="empty">No actor snapshots available.</p>';
      }

      function renderFeed(events) {
        const target = byId("audit-feed");
        if (!events || events.length === 0) {
          target.innerHTML = '<p class="empty">No workflow events yet.</p>';
          return;
        }

        target.innerHTML = events.map((event) => \`
          <article class="feed-item">
            <div class="feed-top">
              <span class="feed-event">\${escapeHtml(event.eventName)}</span>
              <span class="feed-subtle">\${escapeHtml(timeLabel(event.createdAt))}</span>
            </div>
            <div class="feed-subtle">\${escapeHtml(event.entityType)} / <code>\${escapeHtml(event.entityId)}</code></div>
            <div class="feed-subtle">\${escapeHtml(truncateText(JSON.stringify(event.payload || {}), 220))}</div>
          </article>
        \`).join("");
      }

      function chipClass(check) {
        if (check?.passed) return "success";
        if (check?.kind === "negative") return "danger";
        return "warn";
      }

      function renderQualificationChips(qualification) {
        if (!qualification?.checks?.length) {
          return '<span class="chip">No stored checks</span>';
        }

        return qualification.checks
          .slice(0, 4)
          .map((check) => \`<span class="chip \${chipClass(check)}">\${escapeHtml(check.label)}</span>\`)
          .join("");
      }

      function renderQualificationOverview(prospects) {
        const target = byId("qualification-overview");
        const withAssessments = (prospects || []).filter((prospect) => prospect.qualification);

        if (withAssessments.length === 0) {
          target.innerHTML = '<p class="empty">No qualification assessments stored yet.</p>';
          return;
        }

        const engine = withAssessments[0].qualification;
        const engineChecks = engine?.checks || [];
        const requiredChecks = engineChecks.filter((check) => check.kind === "required");

        target.innerHTML = [
          \`
            <article class="reasoning-item">
              <div class="feed-top">
                <span class="feed-event">\${escapeHtml(engine.engine || "unknown engine")}</span>
                <span class="feed-subtle">\${escapeHtml(engine.ruleVersion || "—")}</span>
              </div>
              <p>\${escapeHtml(engine.summary || "No ICP summary captured yet.")}</p>
              <div class="chip-row">
                \${requiredChecks.map((check) => \`<span class="chip \${chipClass(check)}">\${escapeHtml(check.label)}</span>\`).join("")}
              </div>
            </article>
          \`,
          ...withAssessments.slice(0, 4).map((prospect) => \`
            <article class="reasoning-item">
              <h3>\${escapeHtml(prospect.fullName)}</h3>
              <p>\${escapeHtml(prospect.qualification.summary || prospect.qualification.reason || "No summary")}</p>
              <div class="chip-row">
                <span class="chip \${prospect.qualification.ok ? "success" : "danger"}">\${escapeHtml(prospect.qualification.decision)}</span>
                <span class="chip">\${escapeHtml("confidence " + Math.round(Number(prospect.qualification.confidence || 0) * 100) + "%")}</span>
                \${(prospect.qualification.matchedSegments || []).slice(0, 2).map((segment) => \`<span class="chip success">\${escapeHtml(segment)}</span>\`).join("")}
              </div>
            </article>
          \`),
        ].join("");
      }

      function renderLinkedinCell(url) {
        if (!url) {
          return '<span class="feed-subtle">—</span>';
        }

        return \`<a class="inline-link" href="\${escapeHtml(url)}" target="_blank" rel="noreferrer">Open profile</a>\`;
      }

      function isCampaignPaused(state) {
        const campaignId = state?.campaignId || "cmp_default";
        const pausedCampaignIds = Array.isArray(state?.actors?.campaignOps?.flags?.pausedCampaignIds)
          ? state.actors.campaignOps.flags.pausedCampaignIds
          : [];
        return pausedCampaignIds.includes(campaignId);
      }

      function updateTopline(state) {
        const summary = state.summary;
        const campaignPaused = isCampaignPaused(state);
        const killSwitchOn = Boolean(state?.actors?.campaignOps?.flags?.globalKillSwitch ?? summary.globalKillSwitch);
        const automationPaused = campaignPaused || killSwitchOn;
        const pauseButton = byId("toggle-pause");

        byId("service-status").textContent = "Dashboard online";
        byId("sends-status").textContent = summary.noSendsMode ? "No sends mode ON" : "Sending enabled";
        byId("kill-status").textContent = summary.globalKillSwitch ? "Kill switch ON" : "Kill switch OFF";
        byId("pause-status").textContent = killSwitchOn
          ? "Blocked by kill switch"
          : campaignPaused
            ? "AI pause ON"
            : "AI active";
        byId("service-dot").className = "status-dot success";
        byId("sends-dot").className = \`status-dot \${summary.noSendsMode ? "warn" : "success"}\`.trim();
        byId("kill-dot").className = \`status-dot \${summary.globalKillSwitch ? "danger" : "success"}\`.trim();
        byId("pause-dot").className = \`status-dot \${killSwitchOn ? "danger" : campaignPaused ? "warn" : "success"}\`.trim();

        pauseButton.textContent = campaignPaused ? "Resume Automation" : "Pause Automation";
        pauseButton.className = campaignPaused ? "btn btn-primary" : "btn btn-danger";
        pauseButton.disabled = killSwitchOn;
        pauseButton.setAttribute("aria-pressed", campaignPaused ? "true" : "false");

        byId("trigger-discovery").disabled = automationPaused;
        byId("run-probe").disabled = automationPaused;
      }

      function showToast(message) {
        const toast = byId("toast");
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(showToast.timeoutId);
        showToast.timeoutId = setTimeout(() => toast.classList.remove("show"), 2800);
      }

      async function postJson(path, body) {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {}),
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || JSON.stringify(payload));
          }
          throw new Error(await response.text());
        }

        return await response.json();
      }

      async function refresh() {
        const response = await fetch("/api/dashboard/state");
        if (response.status === 401) {
          window.location.href = "/dashboard";
          return;
        }

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const state = await response.json();
        latestState = state;
        renderStats(state.summary);
        renderActors(state.actors, state.discovery);
        renderFeed(state.auditEvents);
        renderQualificationOverview(state.recentProspects);
        updateTopline(state);
        byId("generated-at").textContent = "Updated " + timeLabel(state.generatedAt);

        renderRows("sandbox-jobs", state.sandboxJobs, (job) => \`
          <tr>
            <td><code>\${escapeHtml(job.id)}</code></td>
            <td>\${escapeHtml(job.stage)}</td>
            <td>\${badge(job.status)}</td>
            <td>\${escapeHtml(currencyDuration(job.durationMs))}</td>
            <td>\${escapeHtml(truncateText(job.error || job.outputText || "—", 160))}</td>
          </tr>
        \`, 5);

        renderRows("active-threads", state.activeThreads, (thread) => \`
          <tr>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(thread.fullName)}</strong>
                <span class="feed-subtle">\${escapeHtml([thread.company || "Unknown company", thread.title].filter(Boolean).join(" · "))}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(thread.qualification?.summary || thread.qualificationReason || "No qualification summary")}</span>
                <div class="chip-row">\${renderQualificationChips(thread.qualification)}</div>
              </div>
            </td>
            <td>
              <div class="compact-stack">
                <span>\${badge(thread.stage)}</span>
                <span class="feed-subtle">next: \${escapeHtml(timeLabel(thread.nextFollowUpAt))}</span>
              </div>
            </td>
            <td>\${renderLinkedinCell(thread.linkedinUrl)}</td>
            <td>\${escapeHtml(timeLabel(thread.updatedAt))}</td>
          </tr>
        \`, 5);

        renderRows("provider-runs", state.providerRuns, (run) => \`
          <tr>
            <td>\${escapeHtml(run.provider)}</td>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(run.kind)}</strong>
                <span class="feed-subtle">term: \${escapeHtml(run.requestTerm || "—")}</span>
                <span class="feed-subtle">created: \${escapeHtml(timeLabel(run.createdAt))}</span>
              </div>
            </td>
            <td>\${badge(run.status)}</td>
            <td>\${escapeHtml(currencyDuration(run.durationMs))}</td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(truncateText(run.error || run.externalId || "—", 120))}</span>
                \${run.externalId ? \`<span class="feed-subtle"><code>\${escapeHtml(run.externalId)}</code></span>\` : ""}
              </div>
            </td>
          </tr>
        \`, 5);

        renderRows("qualified-leads", state.qualifiedLeads, (lead) => \`
          <tr>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(lead.fullName)}</strong>
                <span class="feed-subtle">\${escapeHtml(lead.company || "Unknown company")}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(lead.email || "—")}</span>
                <span class="feed-subtle">\${escapeHtml(lead.emailConfidence ?? "—")}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(lead.qualification?.summary || lead.qualificationReason || "No assessment summary")}</span>
                <span class="feed-subtle">\${escapeHtml(lead.qualification?.engine || "unstructured")}</span>
                <div class="chip-row">\${renderQualificationChips(lead.qualification)}</div>
              </div>
            </td>
            <td>\${escapeHtml(lead.researchConfidence ?? "—")}</td>
            <td>\${badge(lead.threadStatus)}</td>
            <td>\${escapeHtml(timeLabel(lead.updatedAt))}</td>
          </tr>
        \`, 6);

        renderRows("recent-prospects", state.recentProspects, (prospect) => \`
          <tr>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(prospect.fullName)}</strong>
                <span class="feed-subtle">\${escapeHtml(prospect.company || "Unknown company")}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(prospect.qualification?.summary || prospect.qualificationReason || "No qualification note")}</span>
                <span class="feed-subtle">\${escapeHtml(prospect.qualification?.engine || prospect.stage)}</span>
                <div class="chip-row">
                  <span class="chip \${prospect.isQualified ? "success" : "danger"}">\${prospect.isQualified ? "qualified" : "rejected"}</span>
                  \${renderQualificationChips(prospect.qualification)}
                </div>
              </div>
            </td>
            <td>
              <div class="compact-stack">
                <span>\${badge(prospect.status)}</span>
                <span class="feed-subtle">\${escapeHtml(prospect.pausedReason || "—")}</span>
              </div>
            </td>
            <td>\${escapeHtml(timeLabel(prospect.updatedAt))}</td>
          </tr>
        \`, 4);

        renderRows("recent-signals", state.recentSignals, (signal) => \`
          <tr>
            <td>\${escapeHtml(signal.source)}</td>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(signal.authorName)}</strong>
                <span class="feed-subtle">\${escapeHtml(signal.authorCompany || "—")}</span>
              </div>
            </td>
            <td>\${escapeHtml(signal.topic)}</td>
            <td>\${escapeHtml(timeLabel(signal.capturedAt))}</td>
          </tr>
        \`, 4);
      }

      byId("toggle-pause").addEventListener("click", async () => {
        const button = byId("toggle-pause");
        const nextPaused = !isCampaignPaused(latestState);
        button.disabled = true;
        try {
          await postJson("/api/dashboard/automation-pause", {
            paused: nextPaused,
          });
          showToast(
            nextPaused
              ? "Automation paused · in-flight work will finish"
              : "Automation resumed",
          );
          await refresh();
        } catch (error) {
          showToast(\`Pause update failed: \${error.message || error}\`);
        } finally {
          button.disabled = false;
        }
      });

      byId("trigger-discovery").addEventListener("click", async () => {
        try {
          const result = await postJson("/api/dashboard/discovery-tick", {});
          showToast(\`Discovery queued for \${result.source}\`);
          await refresh();
        } catch (error) {
          showToast(\`Discovery trigger failed: \${error.message || error}\`);
        }
      });

      byId("run-probe").addEventListener("click", async () => {
        try {
          const result = await postJson("/api/dashboard/sandbox-probe", {});
          showToast(\`Firecrawl probe queued: \${result.jobId}\`);
          await refresh();
        } catch (error) {
          showToast(\`Probe failed: \${error.message || error}\`);
        }
      });

      refresh().catch((error) => showToast(\`Initial load failed: \${error.message || error}\`));
      setInterval(() => refresh().catch(() => {}), 10000);
    </script>
  </body>
</html>`;
}
