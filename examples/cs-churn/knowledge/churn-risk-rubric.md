# Churn Risk Rubric

The score is a 0-100 sum of explicit risk flags. Cap the total at 100.

| Flag | Source | Weight |
|---|---|---:|
| Renewal within 90 days | Salesforce | 20 |
| Renewal within 30 days of plan-year cutover | Salesforce | +10 |
| No executive sponsor on file | Salesforce | 10 |
| No QBR in last 120 days | Salesforce | 10 |
| CSM health score dropped more than 15 points QoQ | Salesforce | 15 |
| Champion left | Salesforce | 20 |
| Ticket volume up more than 50% | Zendesk | 10 |
| Executive escalation in last 90 days | Zendesk | 20 |
| CSAT below 3.5 | Zendesk | 15 |
| Recurring unresolved theme | Zendesk | 10 |
| P1 open longer than 7 days | Zendesk | 15 |
| Registration rate below 20% | Usage | 15 |
| Utilization rate below 8% | Usage | 15 |
| SpringLife activity down more than 20% | Usage | 10 |
| HR admin dormant for more than 90 days | Usage | 20 |
| Power admin gone dark | Usage | 15 |
| One care modality above 80% of usage | Usage | 10 |

## Bands

| Score | Band | Posture |
|---:|---|---|
| 0-24 | Green | healthy; maintain cadence |
| 25-49 | Yellow | watch; intervene on one root cause |
| 50-74 | Orange | intervene; multi-pronged save motion |
| 75-100 | Red | escalate today; exec engagement and written remediation |

## Plan-Year Override

If renewal is within 30 days of the customer's plan-year cutover and the score would otherwise be Yellow or Orange, escalate the band by one step.

## Confidence

- High: Salesforce, Zendesk, and usage all returned recent data.
- Medium: one source is stale or partial.
- Low: one source is missing entirely or any source is clearly simulated.

If confidence is Low, put that in the headline.
