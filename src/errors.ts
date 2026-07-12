import type {
    AgentBouncerVerificationResult,
  } from "./types.js";
  
  export class AgentBouncerError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly cause?: unknown;
  
    constructor(
      message: string,
      options: {
        code: string;
        status?: number;
        cause?: unknown;
      }
    ) {
      super(message);
  
      this.name = "AgentBouncerError";
      this.code = options.code;
      this.status = options.status;
      this.cause = options.cause;
    }
  }
  
  export class AgentBouncerDeniedError extends AgentBouncerError {
    readonly verification: AgentBouncerVerificationResult;
  
    constructor(verification: AgentBouncerVerificationResult) {
      super(
        verification.detail ||
          verification.reason ||
          "AgentBouncer rejected the request.",
        {
          code: verification.reason || "access_denied",
        }
      );
  
      this.name = "AgentBouncerDeniedError";
      this.verification = verification;
    }
  }