import { trellis } from "@trellis/gtm";

export default trellis.state({
  tables: {
    account_health_runs: {
      primaryKey: "id",
      fields: {
        id: "signal.id",
        account_name: "signal.payload.accountName",
        account_id: "signal.payload.accountId",
        risk_band: "score.band",
        risk_score: {
          source: "score.score",
          type: "number",
        },
        confidence: "score.confidence",
        top_driver: "score.topDrivers.0.driver",
        updated_at: "run.completedAt",
      },
      indexes: [
        { name: "account_health_by_account", fields: ["account_name"] },
        { name: "account_health_by_band", fields: ["risk_band"] },
      ],
    },
  },
});
