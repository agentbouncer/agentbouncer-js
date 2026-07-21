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
    type?:
      | "PROJECT_KEY"
      | "PROVIDER"
      | "UNKNOWN"
      | string;

    provider?: string | null;
    providerSlug?: string | null;

    projectKey?: {
      id: string;
      name?: string | null;
      scopes?: string[];
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
    securityPosture?: number | null;
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
    level:
      | "low"
      | "medium"
      | "high"
      | "critical"
      | string;
  };
  oauth?: AgentBouncerOAuthResult;
  hint?: AgentBouncerOAuthHint;
  policy?: {
    mode?: string;
    minTier?: string;
    minTrustScore?: number;
    requireKnownProvider?: boolean;
    requireTrusted?: boolean;
    wouldBlockReason?: string | null;
    matchedRule?:
      AgentBouncerMatchedRule | null;
    defaultEffectApplied?: boolean;
  };
  missingSignedComponents?: string[];
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
  validateContentDigest?: boolean;
};

export type VerifyRequestOptions = {
  request: Request;
  targetUrl?: string;
  action?: string | null;
  tool?: string | null;
  expectedTag?: string | null;
  headers?: HeadersInit;
  userToken?: string | null;
  forwardAuthorization?: boolean;
  validateContentDigest?: boolean;
};

export type VerifyPayloadOptions = {
  url: string;
  method?: string;
  headers?: HeadersInit;
  bodyDigest?: string | null;
  signature?: string | null;
  signatureInput?: string | null;
  signatureAgent?: string | null;
  expectedTag?: string | null;
  action?: string | null;
  tool?: string | null;
  userAgent?: string | null;
  userToken?: string | null;
};

export type AgentBouncerOAuthStatus =
  | "none"
  | "valid"
  | "invalid"
  | "unknown_issuer"
  | "malformed"
  | string;

export type AgentBouncerOAuthResult = {
  status: AgentBouncerOAuthStatus;
  authenticated: boolean;
  sub: string | null;
  issuer: string | null;
  scopes: string[];
  error: string | null;
};

export type AgentBouncerOAuthHint = {
  type: "oauth_required";
  requiredScopes: string[];
  registeredIssuers: string[];
};