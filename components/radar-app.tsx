"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  LoaderCircle,
  Orbit,
  Radar,
  ScanSearch,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type {
  AccountSignal,
  AnalysisResult,
  RiskBand,
} from "@/lib/types";

type View = "radar" | "method" | "briefing";
type Filter = "all" | RiskBand;

const discoveryLoadingPhases = [
  {
    eyebrow: "POST /contents",
    title: "Learning the product surface",
    detail: "Crawling product, solution, customer, and pricing pages.",
  },
  {
    eyebrow: "POST /search · deep",
    title: "Proving customer relationships",
    detail: "Separating real users from partners, mentions, and integrations.",
  },
  {
    eyebrow: "POST /search · deep-reasoning",
    title: "Hunting indirect churn signals",
    detail: "Connecting strategy, hiring, architecture, and budget changes.",
  },
  {
    eyebrow: "FIELD-LEVEL GROUNDING",
    title: "Building the account brief",
    detail: "Attaching source evidence and calibrating each risk hypothesis.",
  },
];

const providedLoadingPhases = [
  discoveryLoadingPhases[0],
  {
    eyebrow: "KNOWN CUSTOMER PORTFOLIO",
    title: "Loading the supplied account set",
    detail: "Using the operator's customer truth instead of rediscovering it.",
  },
  discoveryLoadingPhases[2],
  discoveryLoadingPhases[3],
];

const bandMeta: Record<
  RiskBand,
  { label: string; shortLabel: string; color: string }
> = {
  high: { label: "Urgent review", shortLabel: "High", color: "var(--coral)" },
  medium: {
    label: "Investigate",
    shortLabel: "Medium",
    color: "var(--amber)",
  },
  low: { label: "Watch", shortLabel: "Low", color: "var(--blue)" },
  clear: {
    label: "No material signal",
    shortLabel: "Clear",
    color: "var(--mint)",
  },
};

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function SignalMark({ score, band }: { score: number; band: RiskBand }) {
  const color = bandMeta[band].color;
  return (
    <div
      className="signal-mark"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, var(--line) 0deg)`,
      }}
      aria-label={`Risk score ${score} out of 100`}
    >
      <div className="signal-mark__inner">
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

function RadarArtwork() {
  return (
    <div className="radar-art" aria-hidden="true">
      <div className="radar-art__glow" />
      <div className="radar-art__grid">
        <span className="radar-art__ring radar-art__ring--one" />
        <span className="radar-art__ring radar-art__ring--two" />
        <span className="radar-art__ring radar-art__ring--three" />
        <span className="radar-art__cross radar-art__cross--x" />
        <span className="radar-art__cross radar-art__cross--y" />
        <span className="radar-art__sweep" />
        <span className="radar-art__dot radar-art__dot--one" />
        <span className="radar-art__dot radar-art__dot--two" />
        <span className="radar-art__dot radar-art__dot--three" />
        <span className="radar-art__dot radar-art__dot--four" />
      </div>
      <div className="radar-art__caption">
        <span>OUTSIDE-IN INTELLIGENCE</span>
        <strong>Weak signals. Clear action.</strong>
      </div>
    </div>
  );
}

function LoadingPanel({
  phase,
  usesProvidedPortfolio,
}: {
  phase: number;
  usesProvidedPortfolio: boolean;
}) {
  const phases = usesProvidedPortfolio
    ? providedLoadingPhases
    : discoveryLoadingPhases;
  return (
    <section className="loading-panel" aria-live="polite">
      <div className="loading-orbit">
        <LoaderCircle size={28} />
        <span />
        <span />
      </div>
      <div>
        <p className="eyebrow">{phases[phase].eyebrow}</p>
        <h2>{phases[phase].title}</h2>
        <p>{phases[phase].detail}</p>
      </div>
      <div className="loading-steps">
        {phases.map((item, index) => (
          <div
            className={`loading-step ${index < phase ? "is-done" : ""} ${
              index === phase ? "is-active" : ""
            }`}
            key={item.title}
          >
            <span>{index < phase ? <Check size={13} /> : index + 1}</span>
            <small>{item.title}</small>
          </div>
        ))}
      </div>
      <p className="loading-note">
        Deep research trades a little latency for defensible, grounded output.
      </p>
    </section>
  );
}

function TracePanel({ result }: { result: AnalysisResult }) {
  return (
    <section className="trace-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE EXA WORKFLOW</p>
          <h2>From account portfolio to grounded brief</h2>
        </div>
        <div className="trace-total">
          <Clock3 size={14} />
          {formatDuration(result.totalDurationMs)}
          {typeof result.totalCostDollars === "number" && (
            <span>${result.totalCostDollars.toFixed(3)}</span>
          )}
        </div>
      </div>
      <div
        className={`trace-grid ${
          result.trace.length === 2 ? "trace-grid--compact" : ""
        }`}
      >
        {result.trace.map((item, index) => (
          <article className="trace-card" key={item.step}>
            <div className="trace-card__top">
              <span>0{index + 1}</span>
              <code>POST {item.endpoint}</code>
            </div>
            <h3>{item.step}</h3>
            <p>{item.capability}</p>
            <div className="trace-card__meta">
              <span>{item.resultCount} outputs</span>
              <span>{formatDuration(item.durationMs)}</span>
              {item.requestId && (
                <span title={item.requestId}>
                  req · {item.requestId.slice(0, 6)}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SignalDetail({ signal }: { signal: AccountSignal }) {
  const meta = bandMeta[signal.riskBand];
  return (
    <article className="signal-detail">
      <div className="signal-detail__header">
        <div>
          <p className="eyebrow">ACCOUNT HYPOTHESIS</p>
          <h2>{signal.customerName}</h2>
          <div className="signal-detail__tags">
            <span
              className={`risk-pill risk-pill--${signal.riskBand}`}
            >
              {meta.label}
            </span>
            <span>{signal.signalType}</span>
            <span>{signal.freshness}</span>
          </div>
        </div>
        <SignalMark score={signal.riskScore} band={signal.riskBand} />
      </div>

      <div className="signal-thesis">
        <span>THE SIGNAL</span>
        <h3>{signal.headline}</h3>
        <blockquote>“{signal.evidence}”</blockquote>
      </div>

      <div className="signal-detail__split">
        <div>
          <span className="mini-label">WHY THIS IS VENDOR-SPECIFIC</span>
          <p>{signal.whySpecific}</p>
        </div>
        <div className="next-play">
          <span className="mini-label">NEXT BEST PLAY</span>
          <p>{signal.recommendedPlay}</p>
        </div>
      </div>

      <div className="evidence-block">
        <div>
          <ShieldCheck size={16} />
          <span className="mini-label">GROUNDED EVIDENCE</span>
        </div>
        {signal.citations.length > 0 ? (
          <div className="source-list">
            {signal.citations.map((citation, index) => (
              <a
                href={citation.url}
                key={`${citation.url}-${index}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{citation.title}</strong>
                  <small>{sourceHostname(citation.url)}</small>
                </div>
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        ) : (
          <p className="empty-evidence">
            No field-level source was returned. Treat this row as unverified.
          </p>
        )}
      </div>
    </article>
  );
}

function ResultsDashboard({
  result,
  onDownload,
}: {
  result: AnalysisResult;
  onDownload: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filteredSignals = useMemo(
    () =>
      filter === "all"
        ? result.signals
        : result.signals.filter((signal) => signal.riskBand === filter),
    [filter, result.signals],
  );
  const [activeName, setActiveName] = useState(result.signals[0]?.customerName);
  const activeSignal =
    filteredSignals.find((signal) => signal.customerName === activeName) ??
    filteredSignals[0];

  const urgent = result.signals.filter(
    (signal) => signal.riskBand === "high",
  ).length;
  const investigate = result.signals.filter(
    (signal) => signal.riskBand === "medium",
  ).length;
  const sources = new Set(
    result.signals.flatMap((signal) =>
      signal.citations.map((citation) => citation.url),
    ),
  ).size;

  return (
    <div className="results">
      <section className="result-intro">
        <div>
          <p className="eyebrow">RADAR COMPLETE · {result.profile.domain}</p>
          <h1>
            {result.profile.companyName} customer risk,{" "}
            <em>seen from the outside.</em>
          </h1>
          <p>{result.profile.oneLiner}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onDownload}>
          <Download size={16} />
          Export JSON
        </button>
      </section>

      <section className="metric-grid" aria-label="Analysis summary">
        <div>
          <span>Accounts mapped</span>
          <strong>{result.customers.length}</strong>
          <small>
            {result.portfolioSource === "provided"
              ? "Operator-provided portfolio"
              : "Publicly evidenced relationships"}
          </small>
        </div>
        <div>
          <span>Urgent review</span>
          <strong className="metric--coral">{urgent}</strong>
          <small>Score of 70 or higher</small>
        </div>
        <div>
          <span>Investigate</span>
          <strong className="metric--amber">{investigate}</strong>
          <small>Score from 45 to 69</small>
        </div>
        <div>
          <span>Sources attached</span>
          <strong>{sources}</strong>
          <small>Open-web citations</small>
        </div>
      </section>

      <section className="profile-strip">
        <div>
          <span className="mini-label">CUSTOMER JOB</span>
          <p>{result.profile.customerJob}</p>
        </div>
        <div>
          <span className="mini-label">PRODUCT SURFACE AT RISK</span>
          <div className="chip-row">
            {result.profile.productSurface.slice(0, 4).map((product) => (
              <span key={product}>{product}</span>
            ))}
          </div>
        </div>
        <div className="profile-strip__source">
          <FileSearch size={16} />
          Structured with Exa Contents
        </div>
      </section>

      <TracePanel result={result} />

      <section className="watchlist-section">
        <div className="section-heading section-heading--watchlist">
          <div>
            <p className="eyebrow">PRIORITIZED WATCHLIST</p>
            <h2>Where should the CSM look first?</h2>
          </div>
          <div className="filter-row" role="group" aria-label="Filter accounts">
            {(["all", "high", "medium", "low", "clear"] as Filter[]).map(
              (option) => (
                <button
                  className={filter === option ? "is-active" : ""}
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                >
                  {option === "all" ? "All" : bandMeta[option].shortLabel}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="watchlist-grid">
          <div className="account-list">
            {filteredSignals.map((signal, index) => (
              <button
                className={
                  signal.customerName === activeSignal?.customerName
                    ? "account-row is-active"
                    : "account-row"
                }
                key={signal.customerName}
                type="button"
                onClick={() => setActiveName(signal.customerName)}
              >
                <span className="account-rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="account-copy">
                  <strong>{signal.customerName}</strong>
                  <small>{signal.headline}</small>
                </span>
                <span
                  className={`account-score account-score--${signal.riskBand}`}
                >
                  {signal.riskScore}
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
            {filteredSignals.length === 0 && (
              <div className="empty-filter">
                <SearchCheck size={20} />
                No accounts in this risk band.
              </div>
            )}
          </div>
          {activeSignal && <SignalDetail signal={activeSignal} />}
        </div>
      </section>

      <section className="caveat-panel">
        <TriangleAlert size={18} />
        <div>
          <strong>Decision support, not a churn oracle</strong>
          {result.caveats.map((caveat) => (
            <p key={caveat}>{caveat}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

function Methodology() {
  const archetypes = [
    ["Competitive evaluation", "A customer adopts, benchmarks, or hires for an alternative."],
    ["Build in-house", "A team or architecture begins absorbing the vendor’s customer job."],
    ["Budget pressure", "Cost controls make discretionary tooling or usage vulnerable."],
    ["Strategic change", "The product direction shifts away from the underlying need."],
    ["Technical friction", "Public complaints or constraints touch the exact product surface."],
    ["Leadership change", "A new owner may standardize stack, policy, or procurement."],
    ["Vendor consolidation", "A broader suite could displace a point solution."],
    ["M&A or shutdown", "Ownership or operating status changes the account’s need."],
  ];

  return (
    <main className="content-page">
      <div className="content-hero">
        <p className="eyebrow">METHOD, NOT MAGIC</p>
        <h1>A defensible outside-in risk model.</h1>
        <p>
          Churn Radar does not search for the phrase “customer churn.” It first
          models the vendor’s customer job, then asks what real-world changes
          could make that job disappear, move, shrink, or switch.
        </p>
      </div>
      <section className="method-steps">
        <article>
          <span>01</span>
          <FileSearch />
          <h2>Understand</h2>
          <p>
            Exa Contents crawls the company and priority subpages, then returns
            a structured product and switching-trigger model.
          </p>
        </article>
        <article>
          <span>02</span>
          <SearchCheck />
          <h2>Prove</h2>
          <p>
            Deep semantic search finds customer relationships even when pages
            say “powered by” or describe a workflow instead of saying
            “customer.”
          </p>
        </article>
        <article>
          <span>03</span>
          <ScanSearch />
          <h2>Connect</h2>
          <p>
            Deep reasoning connects indirect public changes to a specific
            product surface and returns field-level grounding.
          </p>
        </article>
      </section>
      <section className="archetype-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE SEARCH SPACE</p>
            <h2>Eight ways risk hides in plain sight</h2>
          </div>
        </div>
        <div className="archetype-grid">
          {archetypes.map(([title, detail], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="evidence-contract">
        <ShieldCheck />
        <div>
          <p className="eyebrow">THE EVIDENCE CONTRACT</p>
          <h2>A signal earns attention, not a verdict.</h2>
          <p>
            High risk requires both a specific public fact and a causal link to
            the vendor’s product. Every finding should be validated with
            first-party usage, support, CRM, and customer conversation data.
          </p>
        </div>
      </section>
    </main>
  );
}

function BriefingDeck() {
  return (
    <main className="deck-page">
      <div className="deck-toolbar">
        <div>
          <p className="eyebrow">3-SLIDE CUSTOMER BRIEFING</p>
          <span>Illustrative assumptions are labeled for discussion.</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => window.print()}
        >
          <Download size={16} />
          Print deck
        </button>
      </div>

      <section className="slide slide--one">
        <div className="slide-number">01 / 03</div>
        <div className="slide-copy">
          <p className="eyebrow">WHO + PAIN</p>
          <h1>
            Your CSM learns about account change{" "}
            <em>after the customer does.</em>
          </h1>
          <p>
            Buyer: VP of Customer Success at a B2B technology company with 200+
            strategic accounts.
          </p>
        </div>
        <div className="tuesday-flow">
          <span>TUESDAY, 8:30 AM</span>
          <div>
            <small>01</small>
            <p>Open CRM renewal list</p>
          </div>
          <div>
            <small>02</small>
            <p>Check news, LinkedIn, jobs, engineering blogs</p>
          </div>
          <div>
            <small>03</small>
            <p>Guess which account changes matter</p>
          </div>
          <strong>2 hours / CSM / week*</strong>
        </div>
        <small className="slide-footnote">
          *Illustrative discovery assumption; validate in customer discovery.
        </small>
      </section>

      <section className="slide slide--two">
        <div className="slide-number">02 / 03</div>
        <p className="eyebrow">WHY THE STATUS QUO BREAKS</p>
        <h1>
          The signal rarely says <em>“we plan to churn.”</em>
        </h1>
        <div className="broken-grid">
          <article>
            <SearchCheck />
            <span>KEYWORD ALERTS SEE</span>
            <p>“Vendor name” + cancel, replace, churn, migration</p>
          </article>
          <ArrowRight />
          <article className="broken-grid__exa">
            <Sparkles />
            <span>EXA CAN CONNECT</span>
            <p>
              “Hiring a retrieval infra team” → plausible build-in-house risk
              for a search API
            </p>
          </article>
        </div>
        <div className="difference-row">
          <div><strong>Semantic</strong><span>Find meaning, not exact words</span></div>
          <div><strong>Fresh</strong><span>Research the live public web</span></div>
          <div><strong>Grounded</strong><span>Structured output with citations</span></div>
        </div>
      </section>

      <section className="slide slide--three">
        <div className="slide-number">03 / 03</div>
        <p className="eyebrow">BUSINESS CASE</p>
        <h1>
          Move from 200 accounts to the{" "}
          <em>12 that deserve attention.</em>
        </h1>
        <div className="impact-grid">
          <article>
            <span>CAPACITY</span>
            <strong>768 hrs</strong>
            <p>returned annually across 8 CSMs*</p>
          </article>
          <article>
            <span>FOCUS</span>
            <strong>1 brief</strong>
            <p>customer proof, risk, evidence, next play</p>
          </article>
          <article>
            <span>UPSIDE</span>
            <strong>1 save</strong>
            <p>of a $100k ARR account can fund the workflow</p>
          </article>
        </div>
        <div className="impact-equation">
          <span>8 CSMs</span><b>×</b><span>2 hrs/week</span><b>×</b>
          <span>48 weeks</span><b>=</b><strong>768 hours</strong>
        </div>
        <small className="slide-footnote">
          *Illustrative ROI model. Replace seats, loaded labor rate, time saved,
          and ARR-at-risk with customer data.
        </small>
      </section>
    </main>
  );
}

export function RadarApp() {
  const [view, setView] = useState<View>("radar");
  const [url, setUrl] = useState("exa.ai");
  const [customerList, setCustomerList] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanUsesProvidedPortfolio, setScanUsesProvidedPortfolio] =
    useState(false);
  const providedCustomerCount = customerList
    .split(/[,\n;]/)
    .map((name) => name.trim())
    .filter(Boolean).length;

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setPhase((current) =>
        Math.min(current + 1, discoveryLoadingPhases.length - 1),
      );
    }, 7_500);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function runScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const usesProvidedPortfolio = providedCustomerCount > 0;
    setPhase(0);
    setScanUsesProvidedPortfolio(usesProvidedPortfolio);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, customers: customerList }),
      });
      const payload = (await response.json()) as
        | AnalysisResult
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "The scan could not be completed.",
        );
      }
      setResult(payload as AnalysisResult);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "The scan could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${result.profile.domain}-churn-radar.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          className="brand"
          type="button"
          onClick={() => setView("radar")}
          aria-label="Churn Radar home"
        >
          <span><Radar size={18} /></span>
          CHURN<span>/</span>RADAR
        </button>
        <nav aria-label="Main navigation">
          <button
            className={view === "radar" ? "is-active" : ""}
            type="button"
            onClick={() => setView("radar")}
          >
            Live radar
          </button>
          <button
            className={view === "method" ? "is-active" : ""}
            type="button"
            onClick={() => setView("method")}
          >
            Method
          </button>
          <button
            className={view === "briefing" ? "is-active" : ""}
            type="button"
            onClick={() => setView("briefing")}
          >
            Briefing deck
          </button>
        </nav>
        <a className="powered-by" href="https://exa.ai" target="_blank" rel="noreferrer">
          Powered by <strong>exa</strong>
          <ArrowUpRight size={13} />
        </a>
      </header>

      {view === "method" && <Methodology />}
      {view === "briefing" && <BriefingDeck />}
      {view === "radar" && (
        <main>
          {!result && !loading && (
            <section className="hero">
              <div className="hero__copy">
                <div className="status-chip">
                  <span />
                  LIVE WEB SIGNALS · GROUNDED BY EXA
                </div>
                <h1>
                  See churn risk
                  <br />
                  <em>before renewal day.</em>
                </h1>
                <p>
                  Enter any B2B company, then bring your known customer
                  portfolio or let Exa discover it. Churn Radar finds
                  business-specific risk signals and gives each CSM a sourced
                  next move.
                </p>
                <form className="scan-form" onSubmit={runScan}>
                  <label htmlFor="company-url">COMPANY WEBSITE</label>
                  <div className="url-input-row">
                    <span>https://</span>
                    <input
                      id="company-url"
                      value={url.replace(/^https?:\/\//i, "")}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="exa.ai"
                      autoComplete="url"
                      required
                    />
                  </div>
                  <div className="customer-list-field">
                    <div>
                      <label htmlFor="customer-list">
                        KNOWN CUSTOMER PORTFOLIO <span>OPTIONAL</span>
                      </label>
                      <small>{providedCustomerCount}/20 accounts</small>
                    </div>
                    <div className="customer-list-input">
                      <UsersRound size={17} />
                      <textarea
                        id="customer-list"
                        value={customerList}
                        onChange={(event) => setCustomerList(event.target.value)}
                        placeholder="Cursor, Vercel, Databricks, ..."
                        rows={2}
                      />
                    </div>
                    <p>
                      Comma-separated. Leave blank to have Exa discover and
                      verify public customers.
                    </p>
                  </div>
                  <button className="scan-submit" type="submit">
                    Scan accounts
                    <ArrowRight size={17} />
                  </button>
                </form>
                {error && (
                  <div className="error-banner" role="alert">
                    <TriangleAlert size={17} />
                    {error}
                  </div>
                )}
                <div className="example-row">
                  <span>Try</span>
                  {["exa.ai", "stripe.com", "snowflake.com"].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setUrl(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <div className="hero__proof">
                  <div><FileSearch /><span><strong>Understands</strong> the product</span></div>
                  <div><Orbit /><span><strong>Finds</strong> indirect signals</span></div>
                  <div><ShieldCheck /><span><strong>Grounds</strong> every claim</span></div>
                </div>
              </div>
              <RadarArtwork />
            </section>
          )}
          {loading && (
            <LoadingPanel
              phase={phase}
              usesProvidedPortfolio={scanUsesProvidedPortfolio}
            />
          )}
          {result && (
            <ResultsDashboard result={result} onDownload={downloadResult} />
          )}
        </main>
      )}

      <footer className="site-footer">
        <span>Churn Radar · Outside-in retention intelligence</span>
        <span>
          <Gauge size={14} /> Built for Customer Success
        </span>
        <span>
          <Zap size={14} /> Search + Contents + structured output
        </span>
      </footer>
    </div>
  );
}
