# Legacy Convex + Vercel Runbook

This document is retained only as historical reference for the old AI SDR deployment.

It is not the v3 production path.

Use the v3 Cloudflare path instead:

```bash
trellis init acme-sdr
trellis docs add ./knowledge
trellis doctor
trellis smoke
trellis deploy
```

Old concepts such as Convex Cloud, Vercel app hosting, Vercel Sandbox, Vercel AI Gateway, and Rivet remain useful for understanding the existing reference app, but they should not appear in the v3 first-run setup.
