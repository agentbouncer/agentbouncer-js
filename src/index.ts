export {
  AgentBouncer,
  createAgentBouncer,
} from "./client.js";

export {
  AgentBouncerSigner,
  createAgentBouncerSigner,
} from "./signer.js";

export {
  createContentDigest,
  verifyContentDigest,
  verifyRequestContentDigest,
} from "./digest.js";

export {
  isOAuthRequired,
  isOAuthScopeDenied,
  getRequiredOAuthScopes,
} from "./oauth.js";

export {
  AgentBouncerError,
  AgentBouncerDeniedError,
} from "./errors.js";

export type {
  AgentBouncerCheckStatus,
  AgentBouncerClientOptions,
  AgentBouncerMatchedRule,
  AgentBouncerOAuthHint,
  AgentBouncerOAuthResult,
  AgentBouncerOAuthStatus,
  AgentBouncerVerificationChecks,
  AgentBouncerVerificationResult,
  VerifyPayloadOptions,
  VerifyRequestOptions,
} from "./types.js";

export type {
  AgentBouncerSignerOptions,
  SignAgentJsonRequestOptions,
  SignAgentRequestOptions,
} from "./signer.js";