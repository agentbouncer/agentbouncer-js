// src/signer.ts

import {
    signatureHeaders,
  } from "web-bot-auth";
  
  import {
    signerFromJWK,
  } from "web-bot-auth/crypto";
  
  import {
    AgentBouncerError,
  } from "./errors.js";
  
  import {
    createContentDigest,
  } from "./digest.js";
  
  export type AgentBouncerSignerOptions = {
    privateJwk: Record<string, unknown>;
    keyId?: string;
    signatureAgent: string;
    tag?: string;
    expiresInMs?: number;
  };
  
  export type SignAgentRequestOptions = {
    url: string;
    method?: string;
    headers?: HeadersInit;
    body?: string | Uint8Array | null;
    accessToken?: string | null;
  };
  
  export type SignAgentJsonRequestOptions = Omit<
    SignAgentRequestOptions,
    "body"
  > & {
    json: unknown;
  };
  function toRequestBody(
    body: string | Uint8Array | null
  ): BodyInit | null {
    if (
      body === null ||
      typeof body === "string"
    ) {
      return body;
    }
    const copy = new Uint8Array(
      body.byteLength
    );
  
    copy.set(body);
  
    return copy.buffer;
  }


  function normalizeSignatureAgent(
    value: string
  ) {
    const trimmed = value.trim();
  
    if (
      trimmed.startsWith('"') &&
      trimmed.endsWith('"')
    ) {
      return trimmed;
    }
  
    return JSON.stringify(
      trimmed.replace(/\/+$/, "")
    );
  }
  
  function normalizeBearerToken(
    value: string
  ) {
    const trimmed = value.trim();
  
    const match = trimmed.match(
      /^Bearer\s+(.+)$/i
    );
  
    return match?.[1]?.trim() || trimmed;
  }
  
  export class AgentBouncerSigner {
    private readonly privateJwk:
      Record<string, unknown>;
  
    private readonly keyId: string;
    private readonly signatureAgent: string;
    private readonly expiresInMs: number;
  
    constructor(
      options: AgentBouncerSignerOptions
    ) {
      const keyId =
        options.keyId ??
        (
          typeof options.privateJwk.kid ===
          "string"
            ? options.privateJwk.kid
            : null
        );
  
      if (!keyId) {
        throw new AgentBouncerError(
          "A signing key ID is required.",
          {
            code: "missing_signing_key_id",
          }
        );
      }
  
      if (
        !options.signatureAgent?.trim()
      ) {
        throw new AgentBouncerError(
          "Signature-Agent is required.",
          {
            code: "missing_signature_agent",
          }
        );
      }
  
      this.privateJwk = options.privateJwk;
      this.keyId = keyId;
      this.signatureAgent =
        normalizeSignatureAgent(
          options.signatureAgent
        );
  
      this.expiresInMs =
        options.expiresInMs ?? 60_000;
  
      if (
        this.expiresInMs <= 0 ||
        this.expiresInMs > 300_000
      ) {
        throw new AgentBouncerError(
          "expiresInMs must be between 1 and 300000.",
          {
            code: "invalid_signature_window",
          }
        );
      }
    }
  
    async sign(
        options: SignAgentRequestOptions
      ): Promise<Request> {
        const method = (
          options.method ?? "GET"
        ).toUpperCase();
      
        const body =
          options.body ?? null;
      
        if (
          body !== null &&
          (
            method === "GET" ||
            method === "HEAD"
          )
        ) {
          throw new AgentBouncerError(
            `${method} requests cannot contain a body.`,
            {
              code: "body_not_allowed",
            }
          );
        }
        const requestBody =
          toRequestBody(body);
      
        const headers = new Headers(
          options.headers
        );
      
        headers.set(
          "Signature-Agent",
          this.signatureAgent
        );
      
        const components: string[] = [
          "@method",
          "@authority",
          "@path",
        ];
      
        if (body !== null) {
          const contentDigest =
            createContentDigest(body);
      
          headers.set(
            "Content-Digest",
            contentDigest
          );
      
          components.push(
            "content-digest"
          );
        }
      
        components.push(
          "signature-agent"
        );
      
        const unsignedRequest =
          new Request(options.url, {
            method,
            headers,
            body: requestBody,
          });
      
        const now = new Date();
      
        const signer = await signerFromJWK({
          ...this.privateJwk,
          kid: this.keyId,
        } as any);
      
        const signed =
          await signatureHeaders(
            unsignedRequest,
            signer,
            {
              keyid: this.keyId,
              created: now,
              expires: new Date(
                now.getTime() +
                  this.expiresInMs
              ),
              components:
                components as any,
            } as any
          );
      
        headers.set(
          "Signature",
          signed["Signature"]
        );
      
        headers.set(
          "Signature-Input",
          signed["Signature-Input"]
        );
      
        if (options.accessToken) {
          headers.set(
            "Authorization",
            `Bearer ${normalizeBearerToken(
              options.accessToken
            )}`
          );
        }
      
        return new Request(
          options.url,
          {
            method,
            headers,
            body: requestBody,
          }
        );
      }
  
    async signJson(
      options:
        SignAgentJsonRequestOptions
    ): Promise<Request> {
      const headers = new Headers(
        options.headers
      );
  
      if (
        !headers.has("content-type")
      ) {
        headers.set(
          "content-type",
          "application/json"
        );
      }
  
      return this.sign({
        ...options,
        headers,
        body: JSON.stringify(
          options.json
        ),
      });
    }
  }
  
  export function createAgentBouncerSigner(
    options:
      AgentBouncerSignerOptions
  ) {
    return new AgentBouncerSigner(
      options
    );
  }