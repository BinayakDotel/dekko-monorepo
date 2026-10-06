# Dogfood log

One row per `analyzePr` run. Cost is computed from the provider prices below. The quality note is one line:
was the summary right, were the questions answerable from their cited hunks, anything marked wrong.

## Prices used (per 1M tokens, checked 2026-10-06)
- groq `openai/gpt-oss-120b`: $0.15 in, $0.60 out
- anthropic `claude-sonnet-5-5`: $2 in, $10 out

## Runs

| date | PR | model | attempts | in | out | cost | quality note |
|---|---|---|---|---|---|---|---|
| 2026-10-06 | skills-marketplace#5 | gpt-oss-120b (groq) | 1 | 3493 | 1423 | $0.0014 | summary accurate; questions answerable from cited hunks |

Totals: 1 run · $0.0014 · avg $0.0014 per PR