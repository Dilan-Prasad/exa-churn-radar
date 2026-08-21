import { RadarError } from "@/lib/radar";
import type {
  CompanyProfile,
  Customer,
  ExaContentsResponse,
  ExaSearchResponse,
  ExaTrace,
} from "@/lib/types";

const EXA_API_BASE = "https://api.exa.ai";
const REQUEST_TIMEOUT_MS = 120_000;

type ExaEndpoint = "/contents" | "/search";

type TimedResponse<T> = {
  data: T;
  durationMs: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveApiKey(apiKey?: string): string {
  const resolved = apiKey?.trim() || process.env.EXA_API_KEY?.trim();
  if (!resolved) {
    throw new RadarError(
      "Add an Exa API key in the app or set EXA_API_KEY on the server.",
      400,
      "MISSING_API_KEY",
    );
  }
  return resolved;
}

async function exaPost<T>(
  endpoint: ExaEndpoint,
  body: Record<string, unknown>,
  apiKey?: string,
): Promise<TimedResponse<T>> {
  const resolvedKey = resolveApiKey(apiKey);

  const startedAt = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${EXA_API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": resolvedKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        return {
          data: (await response.json()) as T,
          durationMs: Date.now() - startedAt,
        };
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      const detail = payload?.error || payload?.message || response.statusText;

      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(600 * 2 ** attempt);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new RadarError(
          "Exa rejected the API key. Check the key in the app or server configuration.",
          401,
          "EXA_AUTH_FAILED",
        );
      }

      throw new RadarError(
        `Exa ${endpoint} request failed: ${detail}`,
        response.status >= 500 ? 502 : 422,
        "EXA_REQUEST_FAILED",
      );
    } catch (error) {
      if (error instanceof RadarError) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 2) {
        await sleep(600 * 2 ** attempt);
      }
    }
  }

  const timedOut =
    lastError?.name === "TimeoutError" || lastError?.name === "AbortError";
  throw new RadarError(
    timedOut
      ? "Exa took too long to respond. Try the scan again."
      : "Could not reach Exa. Check the network and try again.",
    504,
    timedOut ? "EXA_TIMEOUT" : "EXA_UNAVAILABLE",
  );
}

export async function extractCompanyProfile(
  url: string,
  apiKey?: string,
): Promise<TimedResponse<ExaContentsResponse>> {
  return exaPost<ExaContentsResponse>(
    "/contents",
    {
    urls: [url],
    subpages: 6,
    subpageTarget: [
      "product",
      "solutions",
      "customers",
      "case studies",
      "pricing",
      "integrations",
    ],
    livecrawlTimeout: 15_000,
    summary: {
      query:
        "Analyze this vendor for a Customer Success churn-monitoring workflow. Identify exactly what it sells, the customer job it performs, the surfaces a customer would replace, plausible reasons a customer would switch or build internally, and categories of alternatives. Be concrete and specific to this company.",
      schema: {
        type: "object",
        properties: {
          companyName: {
            type: "string",
            description: "Canonical company or product name.",
          },
          oneLiner: {
            type: "string",
            description: "Specific one-sentence description of what the vendor sells.",
          },
          businessModel: {
            type: "string",
            description: "Business and pricing model, if evident.",
          },
          customerJob: {
            type: "string",
            description: "The core job customers hire this vendor to perform.",
          },
          productSurface: {
            type: "array",
            items: { type: "string" },
            description: "Concrete products, APIs, or workflows customers depend on.",
          },
          switchingTriggers: {
            type: "array",
            items: { type: "string" },
            description: "Vendor-specific events that could cause replacement or reduced usage.",
          },
          competitorCategories: {
            type: "array",
            items: { type: "string" },
            description: "Categories of direct, adjacent, and build-in-house alternatives.",
          },
        },
        required: [
          "companyName",
          "oneLiner",
          "businessModel",
          "customerJob",
          "productSurface",
          "switchingTriggers",
          "competitorCategories",
        ],
      },
    },
    },
    apiKey,
  );
}

export async function discoverCustomers(
  profile: CompanyProfile,
  apiKey?: string,
): Promise<TimedResponse<ExaSearchResponse>> {
  return exaPost<ExaSearchResponse>(
    "/search",
    {
    query: `Identify 12 to 15 well-known organizations that are publicly evidenced customers or production users of ${profile.companyName} (${profile.domain}). The relationship must involve ${profile.customerJob}. Distinguish a real customer/user relationship from a partnership, integration, investor, or mere mention.`,
    additionalQueries: [
      `${profile.companyName} official customer case studies and customer stories`,
      `companies publicly describing how they use ${profile.companyName} in production`,
      `${profile.companyName} customer logos testimonials implementation`,
    ],
    type: "deep",
    numResults: 40,
    systemPrompt:
      "Return only organizations with credible public relationship evidence. Prefer official customer stories, the customer's own engineering or company writing, conference talks, and reputable reporting. Never invent a customer to reach the requested count. Exclude technology partners unless they are also explicitly a user. Keep relationship descriptions factual and concise.",
    outputSchema: {
      type: "object",
      properties: {
        customers: {
          type: "array",
          minItems: 10,
          maxItems: 15,
          description:
            "Well-known publicly evidenced customers, ordered by relationship confidence and recognizability.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              relationship: {
                type: "string",
                description:
                  "One sentence describing the publicly evidenced usage relationship.",
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
            required: ["name", "relationship", "confidence"],
          },
        },
      },
      required: ["customers"],
    },
    contents: {
      highlights: {
        query: `evidence that the named organization uses ${profile.companyName}`,
        maxCharacters: 1200,
      },
    },
    },
    apiKey,
  );
}

export async function scanChurnSignals(
  profile: CompanyProfile,
  customers: Customer[],
  apiKey?: string,
): Promise<TimedResponse<ExaSearchResponse>> {
  const customerList = customers
    .map((customer, index) => `${index + 1}. ${customer.name}`)
    .join("\n");
  const products = profile.productSurface.join("; ") || profile.customerJob;
  const triggers =
    profile.switchingTriggers.join("; ") ||
    "competitive evaluation; internal build; budget pressure; strategic change";

  return exaPost<ExaSearchResponse>("/search", {
    query: `Act as a Customer Success risk analyst for ${profile.companyName}. Research every named customer below and find the strongest current public signal that could plausibly precede reduced use, replacement, downsell, or non-renewal of ${profile.companyName}.

Vendor-specific context:
- Customer job: ${profile.customerJob}
- Product surfaces at risk: ${products}
- Plausible switching triggers: ${triggers}
- Alternative categories: ${profile.competitorCategories.join("; ")}

Customers:
${customerList}

Look broadly for indirect, semantically related evidence: adoption or hiring around a competing approach; an internal build team; new technical architecture; cost cutting or layoffs; acquisition or shutdown; a new executive standardizing vendors; procurement consolidation; geographic or regulatory constraints; product strategy changes; complaints about the exact workflow; or reduced need for the underlying job. A signal does not need to mention ${profile.companyName}, but its connection to this vendor's product must be explicit in whySpecific. If no credible evidence exists for a customer, return a low score and say so.`,
    additionalQueries: [
      `recent competitor adoption, vendor migration, replacement, or internal build among these customers: ${customers.map((customer) => customer.name).join(", ")}`,
      `recent engineering architecture changes, relevant technical hiring, or platform consolidation among these customers`,
      `recent layoffs, cost reduction, acquisitions, shutdowns, leadership changes, or procurement shifts among these customers`,
      `recent strategic launches that reduce the need for ${profile.customerJob} among these customers`,
    ],
    type: "deep-reasoning",
    numResults: 70,
    systemPrompt: `Prioritize evidence from the last 18 months and primary sources, but use older evidence when it describes an active strategy. Analyze every supplied customer exactly once. A high score requires specific evidence plus a clear causal link to ${profile.companyName}'s product—not generic bad news. Treat the output as hypotheses for a CSM to validate, never as proof of churn. Be skeptical: use a score below 20 when no material public signal exists.`,
    outputSchema: {
      type: "object",
      properties: {
        accounts: {
          type: "array",
          minItems: customers.length,
          maxItems: customers.length,
          description:
            "Exactly one account-level assessment for every customer in the input list.",
          items: {
            type: "object",
            properties: {
              customerName: { type: "string" },
              riskScore: {
                type: "number",
                description:
                  "0-100 hypothesis score. 70+ urgent, 45-69 investigate, 20-44 watch, under 20 no material public signal.",
              },
              signalType: {
                type: "string",
                enum: [
                  "Competitive evaluation",
                  "Build in-house",
                  "Budget pressure",
                  "Strategic change",
                  "Technical friction",
                  "Leadership change",
                  "Vendor consolidation",
                  "M&A or shutdown",
                  "Regulatory or geographic",
                  "No material signal",
                ],
              },
              headline: {
                type: "string",
                description: "Short, factual description of the risk hypothesis.",
              },
              evidence: {
                type: "string",
                description:
                  "Specific public fact or excerpt supporting the hypothesis.",
              },
              whySpecific: {
                type: "string",
                description:
                  `Why this evidence could affect this customer's use of ${profile.companyName}, tied to the product surface.`,
              },
              recommendedPlay: {
                type: "string",
                description:
                  "A concrete, non-alarmist next step for the account owner.",
              },
              freshness: {
                type: "string",
                description: "Publication date or a concise freshness label.",
              },
            },
            required: [
              "customerName",
              "riskScore",
              "signalType",
              "headline",
              "evidence",
              "whySpecific",
              "recommendedPlay",
              "freshness",
            ],
          },
        },
      },
      required: ["accounts"],
    },
    contents: {
      highlights: {
        query: `specific evidence of a change that could affect use of ${profile.companyName}'s ${products}`,
        maxCharacters: 1600,
      },
    },
    },
    apiKey,
  );
}

export function toTrace(
  step: string,
  endpoint: ExaEndpoint,
  capability: string,
  response: ExaContentsResponse | ExaSearchResponse,
  durationMs: number,
  resultCount: number,
): ExaTrace {
  return {
    step,
    endpoint,
    capability,
    requestId: response.requestId,
    durationMs,
    costDollars: response.costDollars?.total,
    resultCount,
  };
}
