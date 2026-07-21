// src/digest.ts

import {
    createHash,
    timingSafeEqual,
  } from "node:crypto";
  
  export type DigestBody =
    | string
    | Uint8Array
    | ArrayBuffer;
  
  export function bodyToBytes(
    body: DigestBody
  ): Uint8Array {
    if (typeof body === "string") {
      return new TextEncoder().encode(body);
    }
  
    if (body instanceof Uint8Array) {
      return body;
    }
  
    return new Uint8Array(body);
  }
  
  export function createContentDigest(
    body: DigestBody
  ): string {
    const digest = createHash("sha256")
      .update(bodyToBytes(body))
      .digest("base64");
  
    return `sha-256=:${digest}:`;
  }
  
  function extractSha256Digest(
    value: string
  ): Buffer | null {
    const match = value.match(
      /(?:^|,\s*)sha-256=:([^:]+):(?:\s*,|$)/i
    );
  
    if (!match?.[1]) {
      return null;
    }
  
    try {
      return Buffer.from(match[1], "base64");
    } catch {
      return null;
    }
  }
  
  export function verifyContentDigest(
    body: DigestBody,
    headerValue: string
  ): boolean {
    const expected =
      extractSha256Digest(headerValue);
  
    if (!expected) {
      return false;
    }
  
    const actual = createHash("sha256")
      .update(bodyToBytes(body))
      .digest();
  
    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }
  
  export async function verifyRequestContentDigest(
    request: Request
  ): Promise<{
    present: boolean;
    valid: boolean | null;
    contentDigest: string | null;
  }> {
    const contentDigest =
      request.headers.get("content-digest");
  
    if (!contentDigest) {
      return {
        present: false,
        valid: null,
        contentDigest: null,
      };
    }
  
    const method =
      request.method.toUpperCase();
  
    if (
      method === "GET" ||
      method === "HEAD"
    ) {
      return {
        present: true,
        valid: true,
        contentDigest,
      };
    }
  
    const body = new Uint8Array(
      await request.clone().arrayBuffer()
    );
  
    return {
      present: true,
      valid: verifyContentDigest(
        body,
        contentDigest
      ),
      contentDigest,
    };
  }