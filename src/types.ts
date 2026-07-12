export type AgentBouncerCheckStatus =
  | "valid"
  | "invalid"
  | "missing"
  | "unknown"
  | "clean"
  | "detected"
  | "known"
  | "matched"
  | "blocked"
  | "monitor"
  | "expired"
  | "not_yet_valid"
  | "window_too_long"
  | string;

export type AgentBouncerVerificationChecks = {
  signature?: AgentBouncerCheckStatus;
  timestamp?: AgentBouncerCheckStatus;
  replay?: AgentBouncerCheckStatus;
  provider?: AgentBouncerCheckStatus;
  projectKey?: AgentBouncerCheckStatus;
  policy?: AgentBouncerCheckStatus;
  [key: string]: AgentBouncerCheckStatus | undefined;
};

export type AgentBouncerMatchedRule = {
  id: string;
  name: string;
  effect: "ALLOW" | "DENY";
};

export type AgentBouncerVerificationResult = {
  verified: boolean;
  allowed: boolean;
  reason: string | null;
  detail?: string | null;

  checks?: AgentBouncerVerificationChecks;

  agent?: {
    type?: "PROJECT_KEY" | "PROVIDER" | "UNKNOWN" | string;
    provider?: string | null;
    providerSlug?: string | null;
    projectKey?: {
      id: string;
      name?: string | null;
      scopes?: unknown;
    } | null;
    signatureAgent?: string | null;
    keyid?: string | null;
  } | null;

  provider?: {
    id: string;
    slug: string;
    name: string;
    kind?: string | null;
    tier?: string | null;
    status?: string | null;
    trusted?: boolean;
    trustScore?: number | null;
    abuseScore?: number | null;
    identityConfidence?: number | null;
    securityPosture?: string | null;
  } | null;

  request?: {
    method?: string;
    path?: string | null;
    tag?: string | null;
    expectedTag?: string | null;
    action?: string | null;
    tool?: string | null;
  };

  risk?: {
    score: number;
    level: "low" | "medium" | "high" | "critical" | string;
  };

  policy?: {
    mode?: string;
    minTier?: string;
    minTrustScore?: number;
    requireKnownProvider?: boolean;
    requireTrusted?: boolean;
    wouldBlockReason?: string | null;
    matchedRule?: AgentBouncerMatchedRule | null;
    defaultEffectApplied?: boolean;
  };

  tag?: string | null;
  expectedTag?: string | null;
  trusted?: boolean;
  confidence?: number;

  [key: string]: unknown;
};

export type AgentBouncerClientOptions = {
  apiKey: string;
  verifyUrl?: string;
  publicOrigin?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
};

export type VerifyRequestOptions = {
  request: Request;
  targetUrl?: string;
  action?: string | null;
  tool?: string | null;
  expectedTag?: string | null;
  headers?: HeadersInit;
};

export type VerifyPayloadOptions = {
  url: string;
  method?: string;
  headers?: HeadersInit;

  signature?: string | null;
  signatureInput?: string | null;
  signatureAgent?: string | null;

  expectedTag?: string | null;
  action?: string | null;
  tool?: string | null;
  userAgent?: string | null;
};