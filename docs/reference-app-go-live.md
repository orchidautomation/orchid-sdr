# Reference App Go-Live

This is now a legacy runbook.

The reference app can still be used to validate existing AI SDR behavior, but it is not the v3 go-live path.

For v3, use:

```bash
npm run trellis -- init ../acme-sdr --name acme-sdr
cd ../acme-sdr
npm run trellis -- docs add ./knowledge
npm run trellis -- doctor
npm run trellis -- smoke
npm run trellis -- deploy
```

## When To Use This Legacy App

Use `examples/reference-app` only when you need to inspect or preserve behavior that has not been ported yet:

- discovery
- research
- qualification
- outbound drafting
- CRM sync
- reply handling
- handoff
- dashboard and MCP tools

Do not use it as the public setup story.

## Migration Target

Each go-live requirement from the old app should become a v3 primitive:

- environment readiness becomes `trellis doctor`
- demo verification becomes `trellis smoke`
- hosted deploy becomes `trellis deploy`
- provider setup becomes `trellis connect`
- knowledge setup becomes `trellis docs add`
- safe outbound becomes approval records and no-send gates
