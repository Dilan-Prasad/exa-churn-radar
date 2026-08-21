# Churn Radar

Churn Radar is an outside-in account risk briefing for Customer Success leaders.
Give it a B2B company URL and, optionally, a comma-separated known customer
portfolio. It:

1. learns the vendor's actual product surface and customer job,
2. uses the supplied portfolio or finds 10–15 publicly evidenced customers,
3. searches for indirect, business-specific churn signals for every account, and
4. returns a prioritized, cited watchlist with a next best action.

The key design choice is that a result is a **risk hypothesis**, not a churn
prediction. A CSM validates it against private product usage, support, CRM, and
conversation data before acting.

## Why Exa

Keyword alerts work when a source says, "we are replacing Vendor X." Most useful
signals do not. They look like a new internal infrastructure team, a competitor
appearing in architecture docs, a cost-control mandate, a new platform leader,
or a strategy shift that removes the underlying customer job.

Churn Radar uses Exa for two or three distinct retrieval jobs:

| Step | Endpoint | Exa capability | Why it matters |
| --- | --- | --- | --- |
| Understand the vendor | `POST /contents` | Subpage crawling + structured summary | Builds the vendor-specific model that makes later signals relevant |
| Prove customers | `POST /search` (`deep`) | Semantic retrieval + structured output + grounding | Finds relationship evidence beyond the literal word "customer" |
| Scan risk | `POST /search` (`deep-reasoning`) | Multi-step research across indirect signal archetypes | Connects public changes to the exact product surface at risk |

When an internal team supplies customer names, the relationship-discovery call
is deliberately skipped. Exa still profiles the vendor and researches every
provided account, reducing latency and cost while respecting the team's source
of truth.

The UI exposes request IDs, latency, output counts, citations, and reported API
cost so the workflow is inspectable during the demo.

## Run locally

Requirements: Node.js 20+ and an [Exa API key](https://dashboard.exa.ai/api-keys).

```bash
npm install
cp .env.example .env.local
# Add EXA_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The key stays server-side
inside the Next.js route and is never sent to the browser.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Demo assets

- **Live Radar**: the input-to-watchlist workflow.
- **Method**: the eight risk archetypes and evidence contract.
- **Briefing deck**: three print-ready slides for customer/problem framing,
  Exa differentiation, and the business case.
- **Talk track**: [`docs/demo-runbook.md`](docs/demo-runbook.md) contains the
  30-minute narrative and rehearsed Q&A.

## Production-thinking choices

- URL validation rejects malformed and non-public targets.
- supplied customer portfolios are normalized, deduplicated, and capped at 20
  accounts per interactive scan.
- `/contents` status objects are checked because page-level crawl failures can
  arrive inside an HTTP 200 response.
- transient Exa `429` and `5xx` responses are retried with backoff; all calls
  have a bounded timeout.
- fewer than five defensible customer relationships returns a useful error.
  Fewer than ten returns a transparent caveat rather than fabricated customers.
- if deep research omits an account, it is preserved as "no material public
  signal" rather than silently disappearing.
- scores are derived into deterministic risk bands in application code, and
  every result is labeled as decision support rather than churn truth.

## Architecture

```text
Browser
  └─ POST /api/analyze { url, customers? }
      ├─ Exa /contents → vendor-specific product model
      ├─ supplied customer list, or Exa /search → grounded customer list
      └─ Exa /search   → one grounded risk hypothesis per customer
          └─ normalized AnalysisResult → watchlist + export
```

No separate LLM provider or scraping stack is required.
