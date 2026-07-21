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

  import { verifyRequestContentDigest } from "./digest.js";  
  
  const DEFAULT_VERIFY_URL =
    "https://agentbouncer.io/api/v1/verify";
  
  const DEFAULT_TIMEOUT_MS = 5_000;
  
  function normalizeOrigin(origin: string) {
    return origin.replace(/\/+$/, "");
  }

  function extractBearerToken(
    value: string | null | undefined
  ) {
    if (!value) {
      return null;
    }
  
    const trimmed = value.trim();
  
    const match = trimmed.match(
      /^Bearer\s+(.+)$/i
    );
  
    return match?.[1]?.trim() || trimmed;
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
    private readonly validateContentDigest: boolean;
  
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
      this.validateContentDigest =
        options.validateContentDigest !== false;        
  
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
    
      const headers =
        collectVerificationHeaders(
          request.headers,
          options.headers
        );
    
      const shouldValidateDigest =
        options.validateContentDigest ??
        this.validateContentDigest;
    
      const digestCheck =
        shouldValidateDigest
          ? await verifyRequestContentDigest(
              request
            )
          : {
              present: Boolean(
                request.headers.get(
                  "content-digest"
                )
              ),
              valid: null,
              contentDigest:
                request.headers.get(
                  "content-digest"
                ),
            };
    
      if (
        digestCheck.present &&
        digestCheck.valid === false
      ) {
        return {
          verified: false,
          allowed: false,
          reason:
            "content_digest_mismatch",
          detail:
            "Content-Digest does not match the actual request body.",
          checks: {
            signature: "unknown",
            timestamp: "unknown",
            replay: "unknown",
            provider: "unknown",
            policy: "blocked",
            contentDigest: "invalid",
          },
          request: {
            method: request.method,
            path: new URL(
              targetUrl
            ).pathname,
            action:
              options.action ?? null,
            tool: options.tool ?? null,
            expectedTag:
              options.expectedTag ?? null,
          },
        };
      }
    
      const userToken =
        options.userToken ??
        (
          options.forwardAuthorization ===
          false
            ? null
            : extractBearerToken(
                request.headers.get(
                  "authorization"
                )
              )
        );
    
      return this.verifyPayload({
        url: targetUrl,
        method: request.method,
        headers,
    
        bodyDigest:
          digestCheck.contentDigest,
    
        expectedTag:
          options.expectedTag ?? null,
    
        action:
          options.action ?? null,
    
        tool:
          options.tool ?? null,
    
        userAgent:
          request.headers.get(
            "user-agent"
          ),
    
        userToken,
      });
    }

    async verifyPayload(
      options: VerifyPayloadOptions
    ): Promise<AgentBouncerVerificationResult> {
      const headers = headersToObject(options.headers);
      const optionHeaders = new Headers(options.headers);
      const payload = {
        url: options.url,
        method: options.method ?? "GET",
        headers,
      
        bodyDigest:
          options.bodyDigest ??
          optionHeaders.get(
            "content-digest"
          ),
      
        signature:
          options.signature ??
          optionHeaders.get(
            "signature"
          ),
      
        signatureInput:
          options.signatureInput ??
          optionHeaders.get(
            "signature-input"
          ),
      
        signatureAgent:
          options.signatureAgent ??
          optionHeaders.get(
            "signature-agent"
          ),
      
        expectedTag:
          options.expectedTag ?? null,
      
        action:
          options.action ?? null,
      
        tool:
          options.tool ?? null,
      
        userAgent:
          options.userAgent ??
          optionHeaders.get(
            "user-agent"
          ),
      };
  
      const controller = new AbortController();
  
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);
      const requestHeaders:
      Record<string, string> = {
        "content-type":
          "application/json",
    
        accept:
          "application/json",
    
        authorization:
          `Bearer ${this.apiKey}`,
    
        "user-agent":
          "@agentbouncer/sdk/0.2.0",
      };
    
    const normalizedUserToken =
      extractBearerToken(
        options.userToken
      );
    
    if (normalizedUserToken) {
      requestHeaders[
        "x-agent-user-token"
      ] =
        `Bearer ${normalizedUserToken}`;
    }
      try {
        const response =
        await this.fetchImplementation(
          this.verifyUrl,
          {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify(
              payload
            ),
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