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
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #07090d;
        --bg-alt: #0d1117;
        --surface: rgba(16, 21, 29, 0.94);
        --surface-strong: rgba(20, 26, 35, 0.98);
        --surface-soft: rgba(255, 255, 255, 0.025);
        --surface-hover: rgba(122, 184, 255, 0.06);
        --ink: #f5f7fa;
        --ink-soft: #d6dde6;
        --muted: #9aa6b2;
        --line: rgba(255, 255, 255, 0.08);
        --line-strong: rgba(255, 255, 255, 0.14);
        --accent: #7ab8ff;
        --accent-strong: #4f8df2;
        --success: #63d297;
        --warning: #f2be5c;
        --danger: #f28c79;
        --shadow: 0 24px 64px rgba(0, 0, 0, 0.38);
        --shadow-soft: 0 16px 36px rgba(0, 0, 0, 0.24);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      body {
        min-height: 100vh;
        color: var(--ink);
        font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(122,184,255,0.16), transparent 32%),
          radial-gradient(circle at 85% 10%, rgba(99,210,151,0.08), transparent 24%),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-alt) 100%);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.04), transparent 14%),
          radial-gradient(circle at 50% -20%, rgba(255,255,255,0.08), transparent 48%);
        opacity: 0.4;
      }
      a { color: inherit; }
      button, input { font: inherit; }
      code {
        padding: 0.18rem 0.42rem;
        border-radius: 8px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.04);
        font-family: "IBM Plex Mono", ui-monospace, monospace;
      }
      .inline-link {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }
      .inline-link:hover {
        text-decoration: underline;
      }
      .shell {
        max-width: 1600px;
        margin: 0 auto;
        padding: 28px 24px 56px;
      }
      .masthead {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.8fr);
        gap: 24px;
        padding: 30px;
        margin-bottom: 18px;
        border: 1px solid var(--line);
        border-radius: 30px;
        background:
          linear-gradient(180deg, rgba(20, 26, 35, 0.96), rgba(13, 17, 23, 0.96)),
          linear-gradient(135deg, rgba(122,184,255,0.08), rgba(99,210,151,0.04));
        box-shadow: var(--shadow);
      }
      .masthead-copy {
        display: grid;
        gap: 24px;
        align-content: start;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        color: var(--ink-soft);
        font: 600 0.73rem/1 "IBM Plex Mono", ui-monospace, monospace;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .eyebrow::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 6px rgba(122,184,255,0.14);
      }
      .title-lockup {
        display: grid;
        gap: 12px;
        max-width: 64ch;
      }
      h1 {
        margin: 0;
        max-width: 12ch;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: clamp(2.6rem, 5vw, 4.6rem);
        line-height: 0.94;
        letter-spacing: -0.05em;
      }
      .lede {
        margin: 0;
        max-width: 58ch;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.72;
      }
      .hero-facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .hero-fact {
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
      }
      .hero-fact .label {
        display: block;
        margin-bottom: 10px;
        color: var(--muted);
        font: 600 0.7rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .hero-fact strong {
        display: block;
        margin-bottom: 6px;
        font-size: 1rem;
        line-height: 1.3;
        letter-spacing: -0.02em;
      }
      .hero-fact span {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.5;
      }
      .masthead-side {
        display: grid;
        gap: 14px;
        align-content: start;
      }
      .side-card {
        padding: 18px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: var(--surface-soft);
      }
      .side-card h2 {
        margin: 0 0 6px;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: 1rem;
        letter-spacing: -0.03em;
      }
      .side-card p {
        margin: 0;
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.65;
      }
      .status-stack {
        display: grid;
        gap: 10px;
      }
      .status-pill {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px 15px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.025);
      }
      .status-copy {
        display: grid;
        gap: 4px;
      }
      .status-copy strong {
        font-size: 0.95rem;
        letter-spacing: -0.02em;
      }
      .status-copy span {
        font: 600 0.68rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .status-dot {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        margin-top: 4px;
        border-radius: 999px;
        background: rgba(154,166,178,0.7);
        box-shadow: 0 0 0 6px rgba(154,166,178,0.12);
      }
      .status-dot.success {
        background: var(--success);
        box-shadow: 0 0 0 6px rgba(99,210,151,0.16);
      }
      .status-dot.warn {
        background: var(--warning);
        box-shadow: 0 0 0 6px rgba(242,190,92,0.14);
      }
      .status-dot.danger {
        background: var(--danger);
        box-shadow: 0 0 0 6px rgba(242,140,121,0.14);
      }
      .toolbar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .toolbar button,
      .toolbar form button {
        width: 100%;
      }
      .toolbar form {
        margin: 0;
        grid-column: span 2;
      }
      button, .ghost-link {
        appearance: none;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 16px;
        border: 1px solid transparent;
        cursor: pointer;
        font: 600 0.86rem/1 "IBM Plex Mono", ui-monospace, monospace;
        letter-spacing: 0.01em;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
      }
      button:hover, .ghost-link:hover {
        transform: translateY(-1px);
      }
      button:focus-visible, .ghost-link:focus-visible, .inline-link:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(122,184,255,0.18);
      }
      button.primary {
        background: linear-gradient(180deg, var(--accent), var(--accent-strong));
        color: #08111d;
        box-shadow: 0 16px 32px rgba(79,141,242,0.22);
      }
      button.secondary {
        background: rgba(255,255,255,0.06);
        border-color: var(--line);
        color: var(--ink);
      }
      button.ghost, .ghost-link {
        background: transparent;
        border-color: var(--line);
        color: var(--muted);
        text-decoration: none;
      }
      button.ghost:hover, .ghost-link:hover, button.secondary:hover {
        background: rgba(255,255,255,0.04);
        border-color: var(--line-strong);
        color: var(--ink);
      }
      .control-note {
        display: grid;
        gap: 10px;
      }
      .control-note strong {
        font: 600 0.7rem/1 "IBM Plex Mono", ui-monospace, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      .control-note p {
        margin: 0;
        color: var(--muted);
        font-size: 0.93rem;
        line-height: 1.65;
      }
      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        align-items: start;
      }
      .card {
        grid-column: span 12;
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(18,23,31,0.96), rgba(12,16,22,0.96));
        box-shadow: var(--shadow-soft);
        overflow: hidden;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 20px 22px 16px;
        border-bottom: 1px solid var(--line);
      }
      .card-head h2 {
        margin: 0;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: 1.08rem;
        line-height: 1.15;
        letter-spacing: -0.03em;
      }
      .card-head p {
        margin: 0;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.55;
      }
      .card-body {
        padding: 18px 22px 22px;
      }
      .subsection-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 14px;
        margin-top: 20px;
        margin-bottom: 12px;
      }
      .subsection-head h3 {
        margin: 6px 0 0;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: 0.98rem;
        letter-spacing: -0.03em;
      }
      .subsection-head p {
        margin: 0;
        color: var(--muted);
        font-size: 0.88rem;
      }
      .stats {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .stat {
        min-height: 136px;
        padding: 18px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.025);
      }
      .stat .label {
        display: block;
        margin-bottom: 24px;
        color: var(--muted);
        font: 600 0.7rem/1 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .stat .value {
        display: block;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: clamp(2rem, 3vw, 3rem);
        line-height: 1;
        letter-spacing: -0.06em;
      }
      .actor-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .actor {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.025);
        border: 1px solid var(--line);
      }
      .actor h3 {
        margin: 0 0 12px;
        font: 600 0.84rem/1.2 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-soft);
      }
      .meta {
        display: grid;
        gap: 8px;
        margin: 0;
      }
      .meta div {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 14px;
        font-size: 0.92rem;
      }
      .meta dt {
        color: var(--muted);
      }
      .meta dd {
        margin: 0;
        text-align: right;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 0.8rem;
        color: var(--ink-soft);
      }
      .table-shell {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255,255,255,0.02);
      }
      .table-shell.tall {
        max-height: 560px;
      }
      .table-shell.medium {
        max-height: 420px;
      }
      .table-shell.compact {
        max-height: 280px;
      }
      table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        font-size: 0.93rem;
      }
      th, td {
        text-align: left;
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
        word-break: break-word;
      }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: rgba(17,22,29,0.96);
        backdrop-filter: blur(14px);
        color: var(--muted);
        font: 600 0.68rem/1.1 "IBM Plex Mono", ui-monospace, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      tbody tr:hover td {
        background: var(--surface-hover);
      }
      tbody tr:last-child td { border-bottom: 0; }
      td strong {
        display: block;
        margin-bottom: 4px;
        font-weight: 700;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.04);
        font: 600 0.7rem/1 "IBM Plex Mono", ui-monospace, monospace;
        color: var(--ink-soft);
        white-space: nowrap;
      }
      .badge.success { color: var(--success); }
      .badge.warn { color: var(--warning); }
      .badge.danger { color: var(--danger); }
      .feed {
        display: grid;
        gap: 12px;
        max-height: 560px;
        overflow: auto;
        padding-right: 4px;
      }
      .feed-item {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.025);
        border: 1px solid var(--line);
      }
      .feed-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .feed-event {
        font: 600 0.82rem/1.2 "IBM Plex Mono", ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-soft);
      }
      .feed-subtle {
        color: var(--muted);
        font-size: 0.86rem;
        line-height: 1.6;
      }
      .empty {
        padding: 22px 16px !important;
        color: var(--muted);
        font-style: italic;
      }
      .toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        max-width: 360px;
        padding: 13px 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(14, 18, 24, 0.98);
        box-shadow: var(--shadow-soft);
        font: 600 0.8rem/1.5 "IBM Plex Mono", ui-monospace, monospace;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      }
      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      .cell-stack {
        display: grid;
        gap: 6px;
      }
      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        color: var(--muted);
        font: 600 0.66rem/1 "IBM Plex Mono", ui-monospace, monospace;
      }
      .chip.success {
        color: var(--success);
      }
      .chip.warn {
        color: var(--warning);
      }
      .chip.danger {
        color: var(--danger);
      }
      .reasoning-list {
        display: grid;
        gap: 12px;
      }
      .reasoning-item {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.025);
        border: 1px solid var(--line);
      }
      .reasoning-item h3 {
        margin: 0 0 10px;
        font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
        font-size: 1rem;
        letter-spacing: -0.03em;
      }
      .reasoning-item p {
        margin: 0 0 12px;
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.6;
      }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
      ::-webkit-scrollbar-track { background: transparent; }
      @media (max-width: 1180px) {
        .masthead { grid-template-columns: 1fr; }
        .hero-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .actor-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 780px) {
        .shell { padding: 16px 14px 40px; }
        .masthead { padding: 20px; border-radius: 24px; }
        h1 { max-width: none; font-size: clamp(2.2rem, 12vw, 3.2rem); }
        .hero-facts,
        .toolbar,
        .stats { grid-template-columns: 1fr; }
        .card-head,
        .subsection-head,
        .feed-top { flex-direction: column; align-items: flex-start; }
        .card, .table-shell, .actor, .stat, .feed-item, .reasoning-item, .side-card { border-radius: 18px; }
        table { min-width: 640px; }
      }
      @media (min-width: 1101px) {
        .span-4 { grid-column: span 4; }
        .span-5 { grid-column: span 5; }
        .span-6 { grid-column: span 6; }
        .span-7 { grid-column: span 7; }
        .span-8 { grid-column: span 8; }
        .span-12 { grid-column: span 12; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="masthead">
        <div class="masthead-copy">
          <div class="title-lockup">
            <p class="eyebrow">Orchid SDR / Operator Console</p>
            <h1>Clean visibility into discovery, qualification, and handoff.</h1>
            <p class="lede">Track actors, queued work, ICP decisions, and thread movement without digging through logs or raw tables. The goal is simple: make the operational state obvious at a glance.</p>
          </div>
          <div class="hero-facts">
            <article class="hero-fact">
              <span class="label">Cadence</span>
              <strong>10 second refresh</strong>
              <span>Live state stays current while actor work continues in the background.</span>
            </article>
            <article class="hero-fact">
              <span class="label">Coverage</span>
              <strong>Discovery to handoff</strong>
              <span>Signals, qualification, research, threads, and provider runs in one surface.</span>
            </article>
            <article class="hero-fact">
              <span class="label">Evidence</span>
              <strong>Stored ICP checks</strong>
              <span>Qualification decisions stay inspectable instead of disappearing into logs.</span>
            </article>
          </div>
        </div>
        <div class="masthead-side">
          <div class="side-card">
            <h2>System Status</h2>
            <div class="status-stack">
              <div class="status-pill">
                <span id="service-dot" class="status-dot"></span>
                <div class="status-copy">
                  <span>Service</span>
                  <strong id="service-status">Loading…</strong>
                </div>
              </div>
              <div class="status-pill">
                <span id="sends-dot" class="status-dot warn"></span>
                <div class="status-copy">
                  <span>Send Mode</span>
                  <strong id="sends-status">Checking send mode…</strong>
                </div>
              </div>
              <div class="status-pill">
                <span id="kill-dot" class="status-dot"></span>
                <div class="status-copy">
                  <span>Kill Switch</span>
                  <strong id="kill-status">Checking kill switch…</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="side-card">
            <h2>Actions</h2>
            <div class="toolbar">
              <button id="trigger-discovery" class="primary" type="button">Run Discovery</button>
              <button id="run-probe" class="secondary" type="button">Run Probe</button>
              <form method="post" action="/dashboard/logout">
                <button class="ghost" type="submit">Log Out</button>
              </form>
            </div>
          </div>
          <div class="side-card control-note">
            <strong>Runtime</strong>
            <p>The dashboard refreshes every 10 seconds. Discovery ticks and sandbox turns run as queued actor work, and qualification now stores explicit ICP-fit checks so you can see why a lead passed or failed.</p>
          </div>
        </div>
      </section>

      <section class="grid">
        <article class="card span-8">
          <div class="card-head">
            <h2>System Summary</h2>
            <p id="generated-at">Waiting for first refresh…</p>
          </div>
          <div class="card-body">
            <div id="stats" class="stats"></div>
          </div>
        </article>

        <article class="card span-4">
          <div class="card-head">
            <h2>Runtime</h2>
            <p>Actor state and queued sandbox work</p>
          </div>
          <div class="card-body">
            <div id="actors" class="actor-grid"></div>
            <div class="subsection-head">
              <div>
                <h3>Sandbox Jobs</h3>
              </div>
              <p>Recent async turns</p>
            </div>
            <div class="table-shell compact">
              <table>
                <thead>
                  <tr><th>Job</th><th>Stage</th><th>Status</th><th>Duration</th><th>Result</th></tr>
                </thead>
                <tbody id="sandbox-jobs"></tbody>
              </table>
            </div>
          </div>
        </article>

        <article class="card span-12">
          <div class="card-head">
            <h2>Active Threads</h2>
            <p>Workflow threads still in flight, with LinkedIn context</p>
          </div>
          <div class="card-body">
            <div class="table-shell medium">
              <table>
                <thead>
                  <tr><th>Prospect</th><th>Qualification</th><th>Stage</th><th>LinkedIn</th><th>Updated</th></tr>
                </thead>
                <tbody id="active-threads"></tbody>
              </table>
            </div>
          </div>
        </article>

        <article class="card span-8">
          <div class="card-head">
            <h2>Qualified Leads</h2>
            <p>Best current prospects with ICP reasoning, research, and thread state</p>
          </div>
          <div class="card-body">
            <div class="table-shell tall">
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
            <h2>Qualification Logic</h2>
            <p>ICP-backed checks and recent decisions</p>
          </div>
          <div class="card-body">
            <div id="qualification-overview" class="reasoning-list"></div>
          </div>
        </article>

        <article class="card span-5">
          <div class="card-head">
            <h2>Workflow Feed</h2>
            <p>What the system just did and why</p>
          </div>
          <div class="card-body">
            <div id="audit-feed" class="feed"></div>
          </div>
        </article>

        <article class="card span-7">
          <div class="card-head">
            <h2>Provider Calls</h2>
            <p>Discovery runs, terms, durations, and failures</p>
          </div>
          <div class="card-body">
            <div class="table-shell tall">
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
            <h2>Recent Prospects</h2>
            <p>Newest records with their stored qualification reasoning</p>
          </div>
          <div class="card-body">
            <div class="table-shell tall">
              <table>
                <thead>
                  <tr><th>Name</th><th>Qualification</th><th>Status</th><th>Updated</th></tr>
                </thead>
                <tbody id="recent-prospects"></tbody>
              </table>
            </div>
          </div>
        </article>

        <article class="card span-12">
          <div class="card-head">
            <h2>Recent Signals</h2>
            <p>New source captures entering the pipeline</p>
          </div>
          <div class="card-body">
            <div class="table-shell medium">
              <table>
                <thead>
                  <tr><th>Source</th><th>Author</th><th>Topic</th><th>Captured</th></tr>
                </thead>
                <tbody id="recent-signals"></tbody>
              </table>
            </div>
          </div>
        </article>
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

      function timeLabel(value) {
        if (!value) return "—";
        try { return formatter.format(new Date(value)); } catch { return String(value); }
      }

      function badge(status) {
        const value = String(status || "unknown");
        const kind = /failed|error|paused|kill/i.test(value) ? "danger" : /queued|running|active|warning/i.test(value) ? "warn" : "success";
        return \`<span class="badge \${kind}">\${value}</span>\`;
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
            <span class="label">\${label}</span>
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
            <div class="feed-subtle">\${escapeHtml(JSON.stringify(event.payload || {}))}</div>
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

      function updateTopline(summary) {
        byId("service-status").textContent = "Dashboard online";
        byId("sends-status").textContent = summary.noSendsMode ? "No sends mode ON" : "Sending enabled";
        byId("kill-status").textContent = summary.globalKillSwitch ? "Kill switch ON" : "Kill switch OFF";
        byId("service-dot").className = "status-dot success";
        byId("sends-dot").className = \`status-dot \${summary.noSendsMode ? "warn" : "success"}\`.trim();
        byId("kill-dot").className = \`status-dot \${summary.globalKillSwitch ? "danger" : "success"}\`.trim();
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
        const state = await response.json();
        renderStats(state.summary);
        renderActors(state.actors, state.discovery);
        renderFeed(state.auditEvents);
        renderQualificationOverview(state.recentProspects);
        updateTopline(state.summary);
        byId("generated-at").textContent = "Updated " + timeLabel(state.generatedAt);

        renderRows("sandbox-jobs", state.sandboxJobs, (job) => \`
          <tr>
            <td><code>\${escapeHtml(job.id)}</code></td>
            <td>\${escapeHtml(job.stage)}</td>
            <td>\${badge(job.status)}</td>
            <td>\${escapeHtml(currencyDuration(job.durationMs))}</td>
            <td>\${escapeHtml(job.error || job.outputText || "—").slice(0, 160)}</td>
          </tr>
        \`, 5);

        renderRows("active-threads", state.activeThreads, (thread) => \`
          <tr>
            <td>
              <div class="cell-stack">
                <strong>\${escapeHtml(thread.fullName)}</strong>
                <span class="feed-subtle">\${escapeHtml(thread.company || "Unknown company")}</span>
                <span class="feed-subtle">\${escapeHtml(thread.title || "No title captured")}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${escapeHtml(thread.qualification?.summary || thread.qualificationReason || "No qualification summary")}</span>
                <div class="chip-row">\${renderQualificationChips(thread.qualification)}</div>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>\${badge(thread.stage)}</span>
                <span class="feed-subtle">next follow-up: \${escapeHtml(timeLabel(thread.nextFollowUpAt))}</span>
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
                <span>\${escapeHtml(run.error || run.externalId || "—")}</span>
                \${run.externalId ? \`<span class="feed-subtle"><code>\${escapeHtml(run.externalId)}</code></span>\` : ""}
              </div>
            </td>
          </tr>
        \`, 5);

        renderRows("qualified-leads", state.qualifiedLeads, (lead) => \`
          <tr>
            <td>
              <strong>\${escapeHtml(lead.fullName)}</strong><br />
              <span class="feed-subtle">\${escapeHtml(lead.company || "Unknown company")}</span><br />
              <span class="feed-subtle">\${escapeHtml(lead.qualificationReason || "No qualification note")}</span>
            </td>
            <td>
              \${escapeHtml(lead.email || "—")}<br />
              <span class="feed-subtle">\${escapeHtml(lead.emailConfidence ?? "—")}</span>
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
              <strong>\${escapeHtml(prospect.fullName)}</strong><br />
              <span class="feed-subtle">\${escapeHtml(prospect.company || "Unknown company")}</span>
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
              \${badge(prospect.status)}
              <div class="feed-subtle">\${escapeHtml(prospect.pausedReason || "—")}</div>
            </td>
            <td>\${escapeHtml(timeLabel(prospect.updatedAt))}</td>
          </tr>
        \`, 4);

        renderRows("recent-signals", state.recentSignals, (signal) => \`
          <tr>
            <td>\${escapeHtml(signal.source)}</td>
            <td>
              <strong>\${escapeHtml(signal.authorName)}</strong><br />
              <span class="feed-subtle">\${escapeHtml(signal.authorCompany || "—")}</span>
            </td>
            <td>\${escapeHtml(signal.topic)}</td>
            <td>\${escapeHtml(timeLabel(signal.capturedAt))}</td>
          </tr>
        \`, 4);
      }

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
