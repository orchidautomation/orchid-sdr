# Churn Playbook

Turn the risk score into a concrete save plan. The plan should be short enough for a CSM, AE, and support lead to execute.

## Input

- `score`
- optional account context

## Output

Return:

- `headline`
- `highestLeverageAction`
- `actions`
- `stopDoing`

Each action must include:

- owner
- buyer persona
- timeframe
- action
- definition of done

## Rules

- Maximum 6 actions.
- Match intensity to band.
- Red requires executive engagement and written remediation.
- Do not recommend expansion, case study, or product preview asks while active support escalation or Red risk exists.
- Every action must land with a named buyer persona.
- If the buyer persona is missing from CRM, make buyer re-mapping the first action.
