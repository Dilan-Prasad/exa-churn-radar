import type {
  AccountSignal,
  Citation,
  CompanyProfile,
  Customer,
  ExaGrounding,
  RiskBand,
} from "@/lib/types";

export class RadarError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "ANALYSIS_FAILED") {
    super(message);
    this.name = "RadarError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueCitations(citations: Citation[]): Citation[] {
  return Array.from(
    new Map(
      citations
        .filter((citation) => citation.url)
        .map((citation) => [
          citation.url,
          {
            title: citation.title || new URL(citation.url).hostname,
            url: citation.url,
          },
        ]),
    ).values(),
  );
}

function groundingForIndex(
  grounding: ExaGrounding[] | undefined,
  collection: "customers" | "accounts",
  index: number,
): Citation[] {
  const exactPath = new RegExp(
    `(?:^|\\.)${collection}\\[${index}\\](?:\\.|$)`,
    "i",
  );
  return uniqueCitations(
    (grounding ?? [])
      .filter((item) => exactPath.test(item.field))
      .flatMap((item) => item.citations ?? []),
  );
}

function groundingForName(
  grounding: ExaGrounding[] | undefined,
  name: string,
): Citation[] {
  const normalized = name.toLowerCase();
  return uniqueCitations(
    (grounding ?? [])
      .filter((item) => item.field.toLowerCase().includes(normalized))
      .flatMap((item) => item.citations ?? []),
  );
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|company|co)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function namesMatch(left: string, right: string): boolean {
  const a = normalizeName(left);
  const b = normalizeName(right);
  return a === b || (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a)));
}

export function normalizeCompanyUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new RadarError("Enter a company website to begin.", 400, "INVALID_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new RadarError(
      "That does not look like a valid company website.",
      400,
      "INVALID_URL",
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const isPrivateIp =
    /^(10|127|0)\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "::1";

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    isPrivateIp
  ) {
    throw new RadarError(
      "Use a public http(s) company website.",
      400,
      "INVALID_URL",
    );
  }

  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

export function parseStructuredSummary(summary: string | undefined): unknown {
  if (!summary) return undefined;
  try {
    return JSON.parse(summary);
  } catch {
    const fenced = summary.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced?.[1]) return undefined;
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return undefined;
    }
  }
}

export function toCompanyProfile(
  content: unknown,
  url: string,
): CompanyProfile {
  const value = isRecord(content) ? content : {};
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const companyName = asString(
    value.companyName,
    domain.split(".")[0].replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
  );

  return {
    companyName,
    domain,
    oneLiner: asString(
      value.oneLiner,
      `${companyName} provides products and services described on ${domain}.`,
    ),
    businessModel: asString(value.businessModel, "B2B technology"),
    customerJob: asString(
      value.customerJob,
      "The customer job could not be confidently extracted from the homepage.",
    ),
    productSurface: asStringArray(value.productSurface).slice(0, 6),
    switchingTriggers: asStringArray(value.switchingTriggers).slice(0, 7),
    competitorCategories: asStringArray(value.competitorCategories).slice(0, 6),
  };
}

export function toCustomers(
  content: unknown,
  grounding: ExaGrounding[] | undefined,
): Customer[] {
  const rawCustomers =
    isRecord(content) && Array.isArray(content.customers) ? content.customers : [];

  const customers = rawCustomers
    .filter(isRecord)
    .map((item, index): Customer | null => {
      const name = asString(item.name);
      if (!name) return null;
      const confidenceValue = asString(item.confidence, "medium").toLowerCase();
      const confidence =
        confidenceValue === "high" || confidenceValue === "low"
          ? confidenceValue
          : "medium";

      return {
        name,
        relationship: asString(
          item.relationship,
          "Publicly associated with the vendor.",
        ),
        confidence,
        citations: uniqueCitations([
          ...groundingForIndex(grounding, "customers", index),
          ...groundingForName(grounding, name),
        ]).slice(0, 4),
      };
    })
    .filter((item): item is Customer => item !== null);

  return Array.from(
    new Map(customers.map((customer) => [normalizeName(customer.name), customer])).values(),
  ).slice(0, 15);
}

export function riskBandForScore(score: number): RiskBand {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  if (score >= 20) return "low";
  return "clear";
}

export function toSignals(
  content: unknown,
  grounding: ExaGrounding[] | undefined,
  customers: Customer[],
): AccountSignal[] {
  const rawAccounts =
    isRecord(content) && Array.isArray(content.accounts) ? content.accounts : [];
  const parsedAccounts = rawAccounts.filter(isRecord);

  return customers
    .map((customer): AccountSignal => {
      const matchIndex = parsedAccounts.findIndex((account) =>
        namesMatch(asString(account.customerName), customer.name),
      );
      const match = matchIndex >= 0 ? parsedAccounts[matchIndex] : undefined;

      if (!match) {
        return {
          customerName: customer.name,
          riskScore: 10,
          riskBand: "clear",
          signalType: "No material signal",
          headline: "No credible public churn signal found",
          evidence:
            "The scan did not find enough grounded public evidence to raise a risk hypothesis.",
          whySpecific:
            "Absence of public evidence is not proof of account health; validate against product usage and relationship data.",
          recommendedPlay: "Keep in the normal health-check cadence.",
          freshness: "No dated signal",
          citations: customer.citations,
        };
      }

      const riskScore = Math.max(0, Math.min(100, Math.round(asNumber(match.riskScore))));
      return {
        customerName: customer.name,
        riskScore,
        riskBand: riskBandForScore(riskScore),
        signalType: asString(match.signalType, "Strategic change"),
        headline: asString(match.headline, "Potential account change detected"),
        evidence: asString(
          match.evidence,
          "The source supports a change worth validating with the account.",
        ),
        whySpecific: asString(
          match.whySpecific,
          "This change may affect the customer job served by the vendor.",
        ),
        recommendedPlay: asString(
          match.recommendedPlay,
          "Validate the signal with the account owner before taking action.",
        ),
        freshness: asString(match.freshness, "Date unavailable"),
        citations: uniqueCitations([
          ...groundingForIndex(grounding, "accounts", matchIndex),
          ...groundingForName(grounding, customer.name),
          ...customer.citations,
        ]).slice(0, 5),
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore);
}
