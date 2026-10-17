# AI cost controls

All roles default to `gpt-6.1-sol`, including the critic. Explicit server overrides remain supported. Requests select Standard service (`service_tier: default`), low reasoning effort, zero SDK retries and no provider storage. Research permits three web actions and five captures, using low search context.

| Role | Output tokens per response | Maximum SDK turns |
| --- | ---: | ---: |
| Intake | 4,000 | 1 |
| Researcher | 12,000 | 7 |
| Strategist | 10,000 | 1 |
| Monetizer | 6,000 | 2 |
| Experimenter | 12,000 | 1 |
| Critic | 8,000 | 3 |

All allowed turns total 146,000 output tokens. At Standard Sol's documented $10/million output rate, that is **$1.46 of output allocation**, excluding input/tool charges. This is an allowance, not an expected invoice or guaranteed total-run price.

`AI_AUTO_REPAIR=false` prevents automatic extra paid correction rounds. The critic can return `needs_attention` for owner review and an explicit focused follow-up. Configuration is frozen per run. Specialist context omits question UI hints while retaining question text, answers, facts and source material.

## Limits

Run/day defaults are $7/$15 per UTC day. They are estimated budgets and reservations **within one database**, not provider account caps. Local and hosted databases do not share a global allowance. Explicit deployment model overrides must be updated to use the new defaults.

Timeouts may retain uncertain reservations because the provider may have completed billable work. These are not silently reset and ambiguous calls are not automatically repeated. Actual charges must be reconciled with provider billing. A replacement key does not reduce token prices.

## Paid tests

CI and `npm run verify` make no paid calls. Paid scripts require `AI_ALLOW_PAID_TESTS=true`. Full/role evaluations additionally require `0 < AI_EVAL_MAX_USD <= 7` and lower their local estimated run ceiling. HTTP smoke tests use the target server's budgets rather than a client-side dollar guarantee. The connectivity doctor also requires opt-in.

Use one narrow scenario and inspect usage before another call. Offline tests do not establish live model quality.

References: [pricing](https://developers.openai.com/api/docs/pricing), [cost optimization](https://developers.openai.com/api/docs/guides/cost-optimization), [reasoning controls](https://developers.openai.com/api/docs/guides/reasoning). Recheck rates before future paid evaluations.
