# Churn Radar demo runbook

## 30-minute arc

### 0:00–4:00 — Who and pain

“I built this for a VP of Customer Success at a B2B technology company with
roughly 200 strategic accounts.

On Tuesday morning, each CSM opens the renewal list, then checks news,
LinkedIn, job postings, engineering blogs, and account notes. They are trying
to answer one question: what changed outside our product that changes the
renewal?

That takes about two hours per CSM each week, still misses implicit signals,
and produces inconsistent account reviews.”

Open **Briefing deck → Slide 1**.

### 4:00–7:00 — Why existing tools break

“The useful signal almost never says ‘we plan to churn from Exa.’ For a search
API, it could say ‘we are hiring five retrieval infrastructure engineers,’
‘we standardized on a cloud suite that now bundles search,’ or ‘our new
geography requires a different data posture.’

A keyword alert cannot connect those sentences to the customer job at risk.
That semantic gap is why Exa is doing real work here.”

Open **Slide 2**, then **Method**. Briefly show the eight signal archetypes.

### 7:00–20:00 — Live demo

1. Return to **Live Radar** and enter `exa.ai`.
2. Before clicking, state the expected workflow:
   - `/contents` learns Exa's search/retrieval product surface;
   - deep `/search` proves real customers rather than collecting logos;
   - deep-reasoning `/search` looks for indirect changes and returns structured,
     grounded output.
3. Click **Scan accounts** and narrate the visible phases.
4. On results:
   - read the extracted customer job and product surfaces;
   - point out latency, request IDs, result counts, and cost in the Exa trace;
   - show the prioritized account list rather than reading every row;
   - open one urgent/investigate row;
   - read the signal, then the “why vendor-specific” causal bridge;
   - open one citation;
   - finish with the recommended, non-alarmist CSM play.
5. Filter to **Clear** and explain that “no public signal” is preserved. The
   system does not make up risk to fill the dashboard.
6. Point to the evidence warning: this is a prioritization layer to combine
   with first-party health data, not an autonomous churn verdict.

If the live web is slow, stay on the progress panel and explain why deep
research trades latency for a defensible output. Keep one exported JSON result
available as a backup before the interview.

### 20:00–24:00 — Business impact

Open **Slide 3**.

“Using illustrative discovery assumptions: eight CSMs times two hours a week
times 48 working weeks is 768 hours of capacity returned. More importantly,
the system changes the unit of work from ‘research every account’ to ‘validate
the 12 accounts that deserve attention.’

The economic-buyer story is retention leverage: one earlier save on a $100k ARR
account can fund the workflow. In discovery I would replace every assumption
with the customer's seat count, loaded labor cost, current GRR, and
ARR-at-risk.”

### 24:00–30:00 — Q&A

Use the answers below, then close with:

“Exa is not just retrieving links. It is turning an ambiguous outside-in
question into a structured, grounded decision object that fits the CSM's
existing renewal workflow.”

## Rehearsed Q&A

### How does this scale to 10x the accounts or users?

Split the current synchronous demo into an event-driven pipeline:

- profile each vendor once and cache the product model by domain;
- import account lists from the CRM rather than rediscovering known customers;
- queue account research in bounded batches with idempotency keys;
- persist evidence and only re-search changed accounts;
- use Exa Monitors for incremental signal detection;
- write ranked briefs back to Salesforce, Gainsight, or Slack;
- add tenant-level budgets, request tracing, and human feedback on signal
  usefulness.

The UI then reads stored results immediately while workers refresh evidence in
the background.

### Why Exa instead of keyword search or scraping?

The hard part is retrieval, not HTML download. A scraper still needs a source
discovery strategy and breaks across thousands of changing sites. Keyword
search requires the author to use our vocabulary.

Exa contributes:

1. semantic retrieval for long, fuzzy descriptions of change;
2. clean contents across heterogeneous public pages;
3. deep multi-step research for cross-account investigation;
4. structured outputs that fit an operational workflow; and
5. field-level grounding so a CSM can inspect the source.

### What is the ROI for the economic buyer?

Use a customer-specific model:

```text
annual capacity value
  = CSM count × weekly research hours × working weeks × loaded hourly cost

retention upside
  = earlier at-risk accounts × intervention success rate × average ARR
```

Keep capacity savings and retention upside separate. Do not claim that public
signals alone caused a save; measure whether surfaced signals changed account
plans and whether those interventions improved GRR.

### What would you build next?

1. CRM/Gainsight import and write-back.
2. Exa Monitors for recurring, incremental alerts.
3. Private health-data joins (usage, support, NPS, executive engagement).
4. User feedback (“useful / stale / wrong causal link”) to calibrate ranking.
5. Team-level rollups by renewal window, ARR, region, and signal archetype.

### How do you evaluate quality?

Create a labeled account-review set with CS leaders. Score separately:

- customer relationship precision,
- evidence freshness and source quality,
- vendor-specific causal relevance,
- citation correctness,
- account coverage,
- false-positive rate by risk band, and
- whether a result changes the CSM's next action.

The last measure keeps the evaluation tied to the job, not just retrieval
metrics.

### What are the main risks?

- Public evidence is incomplete and biased toward well-known companies.
- A real organizational change may have no effect on the vendor relationship.
- Published dates can be missing or misleading.
- Customer lists can confuse partners and users.
- Research cost and latency require caching and incremental refresh at scale.

The product mitigates these with relationship proof, skeptical scoring,
field-level citations, explicit caveats, and human validation.
