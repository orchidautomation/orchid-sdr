# Demo Inputs

Inputs are the payloads you can send into the Trellis agent.

- `demo-form-payload.json` is the website form-fill signal used for the BDR demo.

These files are safe synthetic examples. They are not private leads.

Run the default input:

```bash
npm run demo:seed-bdr
```

Run a custom input by pointing `TRELLIS_DEMO_PAYLOAD` at another JSON file:

```bash
TRELLIS_DEMO_PAYLOAD=inputs/my-signal.json npm run demo:seed-bdr
```
