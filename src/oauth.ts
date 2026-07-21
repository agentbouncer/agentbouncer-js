// src/oauth.ts

import type {
    AgentBouncerVerificationResult,
  } from "./types.js";
  
  export function isOAuthRequired(
    verification:
      AgentBouncerVerificationResult
  ) {
    if (
      verification.hint?.type ===
      "oauth_required"
    ) {
      return true;
    }
  
    return (
      verification.reason ===
        "oauth_token_required" ||
      verification.reason ===
        "oauth_token_none" ||
      verification.reason ===
        "oauth_token_invalid" ||
      verification.reason ===
        "oauth_token_malformed" ||
      verification.reason ===
        "oauth_token_unknown_issuer"
    );
  }
  
  export function isOAuthScopeDenied(
    verification:
      AgentBouncerVerificationResult
  ) {
    return (
      typeof verification.reason ===
        "string" &&
      verification.reason.startsWith(
        "oauth_missing_"
      )
    );
  }
  
  export function getRequiredOAuthScopes(
    verification:
      AgentBouncerVerificationResult
  ): string[] {
    return (
      verification.hint
        ?.requiredScopes ?? []
    );
  }