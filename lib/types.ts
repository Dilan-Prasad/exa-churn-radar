export type RiskBand = "high" | "medium" | "low" | "clear";

export type CompanyProfile = {
  companyName: string;
  domain: string;
  oneLiner: string;
  businessModel: string;
  customerJob: string;
  productSurface: string[];
  switchingTriggers: string[];
  competitorCategories: string[];
};

export type Citation = {
  title: string;
  url: string;
};

export type Customer = {
  name: string;
  relationship: string;
  confidence: "high" | "medium" | "low";
  citations: Citation[];
};

export type AccountSignal = {
  customerName: string;
  riskScore: number;
  riskBand: RiskBand;
  signalType: string;
  headline: string;
  evidence: string;
  whySpecific: string;
  recommendedPlay: string;
  freshness: string;
  citations: Citation[];
};

export type ExaTrace = {
  step: string;
  endpoint: "/contents" | "/search";
  capability: string;
  requestId?: string;
  durationMs: number;
  costDollars?: number;
  resultCount: number;
};

export type AnalysisResult = {
  profile: CompanyProfile;
  customers: Customer[];
  signals: AccountSignal[];
  trace: ExaTrace[];
  analyzedAt: string;
  totalDurationMs: number;
  totalCostDollars?: number;
  caveats: string[];
};

export type ExaGrounding = {
  field: string;
  citations: Citation[];
  confidence?: "high" | "medium" | "low";
};

export type ExaSearchResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  highlights?: string[];
  favicon?: string;
};

export type ExaSearchResponse = {
  requestId?: string;
  results?: ExaSearchResult[];
  output?: {
    content?: unknown;
    grounding?: ExaGrounding[];
  };
  costDollars?: {
    total?: number;
  };
};

export type ExaContentsResponse = {
  requestId?: string;
  results?: Array<{
    title?: string;
    url?: string;
    summary?: string;
    subpages?: Array<{
      title?: string;
      url?: string;
      summary?: string;
    }>;
  }>;
  statuses?: Array<{
    id: string;
    status: "success" | "error";
    error?: {
      tag?: string;
      httpStatusCode?: number;
    };
  }>;
  costDollars?: {
    total?: number;
  };
};
