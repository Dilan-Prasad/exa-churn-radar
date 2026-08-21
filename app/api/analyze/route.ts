import { NextResponse } from "next/server";

import {
  discoverCustomers,
  extractCompanyProfile,
  scanChurnSignals,
  toTrace,
} from "@/lib/exa";
import {
  normalizeCompanyUrl,
  parseCustomerListInput,
  parseExaApiKey,
  parseStructuredSummary,
  RadarError,
  toCompanyProfile,
  toCustomers,
  toProvidedCustomers,
  toSignals,
} from "@/lib/radar";
import type { AnalysisResult, Customer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function findStructuredSummary(
  response: Awaited<ReturnType<typeof extractCompanyProfile>>["data"],
): unknown {
  for (const result of response.results ?? []) {
    const parsed = parseStructuredSummary(result.summary);
    if (parsed) return parsed;
    for (const subpage of result.subpages ?? []) {
      const parsedSubpage = parseStructuredSummary(subpage.summary);
      if (parsedSubpage) return parsedSubpage;
    }
  }
  return undefined;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json().catch(() => null)) as {
      url?: unknown;
      customers?: unknown;
      apiKey?: unknown;
    } | null;

    if (typeof body?.url !== "string" || body.url.length > 2_048) {
      throw new RadarError(
        "Send a valid company website in the url field.",
        400,
        "INVALID_URL",
      );
    }

    const url = normalizeCompanyUrl(body.url);
    const apiKey = parseExaApiKey(body.apiKey);
    const providedCustomerNames = parseCustomerListInput(body.customers);
    const portfolioSource =
      providedCustomerNames.length > 0 ? "provided" : "discovered";

    const companyResponse = await extractCompanyProfile(url, apiKey);
    const failedStatus = companyResponse.data.statuses?.find(
      (status) => status.status === "error",
    );
    if (!(companyResponse.data.results?.length)) {
      const reason = failedStatus?.error?.tag
        ? ` (${failedStatus.error.tag})`
        : "";
      throw new RadarError(
        `Exa could not read that website${reason}. Try the canonical homepage URL.`,
        422,
        "SITE_NOT_READABLE",
      );
    }

    const profile = toCompanyProfile(
      findStructuredSummary(companyResponse.data),
      url,
    );

    let customerResponse:
      | Awaited<ReturnType<typeof discoverCustomers>>
      | undefined;
    let customers: Customer[];
    if (portfolioSource === "provided") {
      customers = toProvidedCustomers(providedCustomerNames);
    } else {
      customerResponse = await discoverCustomers(profile, apiKey);
      customers = toCustomers(
        customerResponse.data.output?.content,
        customerResponse.data.output?.grounding,
      );
      if (customers.length < 5) {
        throw new RadarError(
          `Only ${customers.length} defensible public customer relationships were found. Try a company with a larger public customer footprint or provide a known customer list.`,
          422,
          "INSUFFICIENT_CUSTOMERS",
        );
      }
    }

    const signalResponse = await scanChurnSignals(profile, customers, apiKey);
    const signals = toSignals(
      signalResponse.data.output?.content,
      signalResponse.data.output?.grounding,
      customers,
    );

    const trace = [
      toTrace(
        "Understand the vendor",
        "/contents",
        "Live crawl + structured summary across product subpages",
        companyResponse.data,
        companyResponse.durationMs,
        companyResponse.data.results?.length ?? 0,
      ),
    ];
    if (customerResponse) {
      trace.push(
        toTrace(
          "Prove customer relationships",
          "/search",
          "Deep semantic search + grounded structured output",
          customerResponse.data,
          customerResponse.durationMs,
          customers.length,
        ),
      );
    }
    trace.push(
      toTrace(
        "Find account-specific risk",
        "/search",
        "Deep reasoning across indirect churn archetypes",
        signalResponse.data,
        signalResponse.durationMs,
        signals.length,
      ),
    );

    const caveats = [
      "Public-web signals are hypotheses for account review, not proof that a customer intends to churn.",
      "Validate findings against product usage, support history, CRM activity, and direct customer conversations.",
    ];
    if (portfolioSource === "provided") {
      caveats.push(
        "Customer relationships were supplied by the operator and were not independently verified against the public web.",
      );
    } else if (customers.length < 10) {
      caveats.push(
        `Exa found only ${customers.length} relationships with sufficient public evidence; Churn Radar does not fabricate accounts to fill a quota.`,
      );
    }
    if (signals.some((signal) => signal.citations.length === 0)) {
      caveats.push(
        "At least one assessment lacks field-level grounding and should not be actioned without manual verification.",
      );
    }

    const costs = trace
      .map((item) => item.costDollars)
      .filter((cost): cost is number => typeof cost === "number");
    const result: AnalysisResult = {
      profile,
      customers,
      signals,
      portfolioSource,
      trace,
      analyzedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startedAt,
      totalCostDollars:
        costs.length > 0
          ? costs.reduce((total, cost) => total + cost, 0)
          : undefined,
      caveats,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const radarError =
      error instanceof RadarError
        ? error
        : new RadarError(
            "The analysis could not be completed. Try again.",
            500,
            "ANALYSIS_FAILED",
          );

    if (!(error instanceof RadarError)) {
      console.error("Unexpected Churn Radar error", error);
    }

    return NextResponse.json(
      {
        error: radarError.message,
        code: radarError.code,
      },
      {
        status: radarError.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
