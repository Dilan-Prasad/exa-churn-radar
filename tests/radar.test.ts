import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCompanyUrl,
  parseStructuredSummary,
  riskBandForScore,
  toCustomers,
  toSignals,
} from "../lib/radar";

test("normalizes public company URLs", () => {
  assert.equal(normalizeCompanyUrl("exa.ai"), "https://exa.ai/");
  assert.equal(
    normalizeCompanyUrl("https://www.exa.ai/?utm_source=test#hero"),
    "https://www.exa.ai/",
  );
});

test("rejects local and private URLs", () => {
  assert.throws(() => normalizeCompanyUrl("localhost:3000"), /public http/);
  assert.throws(() => normalizeCompanyUrl("http://192.168.1.4"), /public http/);
  assert.throws(() => normalizeCompanyUrl("ftp://example.com"), /public http/);
});

test("parses plain and fenced structured summaries", () => {
  assert.deepEqual(parseStructuredSummary('{"companyName":"Exa"}'), {
    companyName: "Exa",
  });
  assert.deepEqual(
    parseStructuredSummary('```json\n{"companyName":"Exa"}\n```'),
    { companyName: "Exa" },
  );
  assert.equal(parseStructuredSummary("not-json"), undefined);
});

test("maps score thresholds to calibrated risk bands", () => {
  assert.equal(riskBandForScore(85), "high");
  assert.equal(riskBandForScore(69), "medium");
  assert.equal(riskBandForScore(44), "low");
  assert.equal(riskBandForScore(19), "clear");
});

test("deduplicates customers and attaches field-level grounding", () => {
  const customers = toCustomers(
    {
      customers: [
        {
          name: "Acme, Inc.",
          relationship: "Uses the API in production.",
          confidence: "high",
        },
        {
          name: "Acme",
          relationship: "Duplicate result.",
          confidence: "medium",
        },
      ],
    },
    [
      {
        field: "customers[0].relationship",
        citations: [{ title: "Acme engineering", url: "https://acme.test/blog" }],
      },
    ],
  );

  assert.equal(customers.length, 1);
  assert.equal(customers[0].citations[0].url, "https://acme.test/blog");
});

test("returns one signal per customer and fills missing assessments safely", () => {
  const customers = [
    {
      name: "Acme",
      relationship: "Uses the API.",
      confidence: "high" as const,
      citations: [],
    },
    {
      name: "Beta Corp",
      relationship: "Customer story.",
      confidence: "high" as const,
      citations: [],
    },
  ];
  const signals = toSignals(
    {
      accounts: [
        {
          customerName: "Acme Inc",
          riskScore: 82,
          signalType: "Build in-house",
          headline: "Acme formed a retrieval team",
          evidence: "Acme is hiring search infrastructure engineers.",
          whySpecific: "The team could absorb the vendor's search API workflow.",
          recommendedPlay: "Review build-versus-buy goals.",
          freshness: "August 2026",
        },
      ],
    },
    [],
    customers,
  );

  assert.equal(signals.length, 2);
  assert.equal(signals[0].customerName, "Acme");
  assert.equal(signals[0].riskBand, "high");
  assert.equal(signals[1].customerName, "Beta Corp");
  assert.equal(signals[1].riskBand, "clear");
});
