# Core Brief

Given a structured webhook event:

1. summarize what happened
2. extract only verified facts
3. recommend the next concrete actions
4. list open questions for any missing information
5. assign a confidence score between 0 and 1

Return strict JSON with:

- `summary`
- `keyFacts`
- `nextActions`
- `openQuestions`
- `confidence`

