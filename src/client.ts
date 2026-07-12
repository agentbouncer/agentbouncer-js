import {
    AgentBouncerDeniedError,
    AgentBouncerError,
  } from "./errors.js";
  
  import {
    collectVerificationHeaders,
  } from "./headers.js";
  
  import type {
    AgentBouncerClientOptions,
    AgentBouncerVerificationResult,
    VerifyPayloadOptions,
    VerifyRequestOptions,
  } from "./types.js";
  
  const DEFAULT_VERIFY_URL =
    "https://agentbouncer.io/api/v1/verify";
  
  const DEFAULT_TIMEOUT_MS = 5_000;
  
  function normalizeOrigin(origin: string) {
    return origin.replace(/\/+$/, "");
  }
  
  function resolveTargetUrl(params: {
    request: Request;
    targetUrl?: string;
    publicOrigin?: string;
  }) {
    if (params.targetUrl) {
      return params.targetUrl;
    }
  
    if (!params.publicOrigin) {
      return params.request.url;
    }
  
    const incomingUrl = new URL(params.request.url);
    const publicOrigin = normalizeOrigin(params.publicOrigin);
  
    return `${publicOrigin}${incomingUrl.pathname}${incomingUrl.search}`;
  }
  
  function headersToObject(headers?: HeadersInit) {
    if (!headers) {
      return {};
    }
  
    return Object.fromEntries(new Headers(headers).entries());
  }
  
  export class AgentBouncer {
    private readonly apiKey: string;
    private readonly verifyUrl: string;
    private readonly publicOrigin?: string;
    private readonly timeoutMs: number;
    private readonly fetchImplementation: typeof globalThis.fetch;
  
    constructor(options: AgentBouncerClientOptions) {
      if (!options.apiKey?.trim()) {
        throw new AgentBouncerError(
          "AgentBouncer API key is required.",
          {
            code: "missing_api_key",
          }
        );
      }
  
      this.apiKey = options.apiKey.trim();
      this.verifyUrl =
        options.verifyUrl?.trim() || DEFAULT_VERIFY_URL;
      this.publicOrigin = options.publicOrigin;
      this.timeoutMs =
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      this.fetchImplementation =
        options.fetch ?? globalThis.fetch;
  
      if (!this.fetchImplementation) {
        throw new AgentBouncerError(
          "A fetch implementation is required.",
          {
            code: "missing_fetch",
          }
        );
      }
    }
    async verify(
      options: VerifyRequestOptions
    ): Promise<AgentBouncerVerificationResult> {
      const { request } = options;
  
      const targetUrl = resolveTargetUrl({
        request,
        targetUrl: options.targetUrl,
        publicOrigin: this.publicOrigin,
      });
  
      const headers = collectVerificationHeaders(
        request.headers,
        options.headers
      );
  
      return this.verifyPayload({
        url: targetUrl,
        method: request.method,
        headers,
        expectedTag: options.expectedTag ?? null,
        action: options.action ?? null,
        tool: options.tool ?? null,
        userAgent: request.headers.get("user-agent"),
      });
    }
  
    async verifyPayload(
      options: VerifyPayloadOptions
    ): Promise<AgentBouncerVerificationResult> {
      const headers = headersToObject(options.headers);
  
      const payload = {
        url: options.url,
        method: options.method ?? "GET",
        headers,
  
        signature:
          options.signature ??
          new Headers(options.headers).get("signature"),
  
        signatureInput:
          options.signatureInput ??
          new Headers(options.headers).get("signature-input"),
  
        signatureAgent:
          options.signatureAgent ??
          new Headers(options.headers).get("signature-agent"),
  
        expectedTag: options.expectedTag ?? null,
        action: options.action ?? null,
        tool: options.tool ?? null,
  
        userAgent:
          options.userAgent ??
          new Headers(options.headers).get("user-agent"),
      };
  
      const controller = new AbortController();
  
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);
  
      try {
        const response = await this.fetchImplementation(
          this.verifyUrl,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "accept": "application/json",
              "authorization": `Bearer ${this.apiKey}`,
              "user-agent": "@agentbouncer/sdk",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: "no-store",
          }
        );
  
        const result = await response
          .json()
          .catch(() => null) as AgentBouncerVerificationResult | null;
  
        if (!response.ok) {
          throw new AgentBouncerError(
            result?.detail ||
              result?.reason ||
              `AgentBouncer API returned HTTP ${response.status}.`,
            {
              code:
                result?.reason ||
                "agentbouncer_api_error",
              status: response.status,
            }
          );
        }
  
        if (
          !result ||
          typeof result.verified !== "boolean" ||
          typeof result.allowed !== "boolean"
        ) {
          throw new AgentBouncerError(
            "AgentBouncer returned an invalid response.",
            {
              code: "invalid_api_response",
              status: response.status,
            }
          );
        }
  
        return result;
      } catch (error) {
        if (error instanceof AgentBouncerError) {
          throw error;
        }
  
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          throw new AgentBouncerError(
            `AgentBouncer verification timed out after ${this.timeoutMs}ms.`,
            {
              code: "verification_timeout",
              cause: error,
            }
          );
        }
  
        throw new AgentBouncerError(
          "Unable to contact AgentBouncer.",
          {
            code: "network_error",
            cause: error,
          }
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    async require(
      options: VerifyRequestOptions
    ): Promise<AgentBouncerVerificationResult> {
      const verification = await this.verify(options);
    
      if (!verification.allowed) {
        throw new AgentBouncerDeniedError(verification);
      }
    
      return verification;
    }
  }
  
  export function createAgentBouncer(
    options: AgentBouncerClientOptions
  ) {
    return new AgentBouncer(options);
  }