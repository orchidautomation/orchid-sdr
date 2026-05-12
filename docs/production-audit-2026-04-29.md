# Legacy Production Audit - 2026-04-29

This audit belongs to the old AI SDR production deployment.

It is kept only to preserve migration context and should not be used as a v3 operating guide.

The useful migration lessons are:

- runtime state must be honest
- stalled workflow stages need visible audit events
- knowledge packs must be present and verifiable before deploy
- discovery normalization must be strict enough for operator trust
- no-send and pause semantics must be reflected in the dashboard and MCP

Each of those lessons now maps to v3 work in `@trellis/gtm`, `trellis doctor`, `trellis smoke`, and the Cloudflare-backed runtime surfaces.
