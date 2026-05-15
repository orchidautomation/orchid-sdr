# Demo Inputs

Inputs are the payloads you can send into the Trellis agent.

- `demo-form-payload.json` is the website form-fill signal used for the BDR demo.
- `demo-notion-command-center-payload.json` is a Notion-style workspace event that maps to the same Trellis signal shape.

These files are safe synthetic examples. They are not private leads.

Run the default input:

```bash
npm run demo:seed-bdr
```

Run a custom input:

```bash
TRELLIS_DEMO_PAYLOAD=inputs/demo-notion-command-center-payload.json npm run demo:seed-bdr
```
