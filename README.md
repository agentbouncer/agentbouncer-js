# AgentBouncer JavaScript SDK

[![npm version](https://img.shields.io/npm/v/@agentbouncer/sdk.svg)](https://www.npmjs.com/package/@agentbouncer/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@agentbouncer/sdk.svg)](https://www.npmjs.com/package/@agentbouncer/sdk)
[![license](https://img.shields.io/npm/l/@agentbouncer/sdk.svg)](./LICENSE)

Official JavaScript SDK for signing and verifying AI agent and MCP requests through AgentBouncer.

The SDK supports both sides of an agent-to-MCP request:

- **Agent/client side:** creates `Content-Digest`, signs the required HTTP Message Signature components, and optionally attaches a user OAuth access token.
- **MCP/server side:** validates `Content-Digest` against the actual request body, forwards the signed request metadata to AgentBouncer, and returns the verification and policy result.

> AgentBouncer verification remains server-side. The SDK does not embed provider discovery, replay storage, OAuth issuer verification, or the AgentBouncer policy engine. `createAgentBouncer()` calls the AgentBouncer Verify API internally.

## Requirements

- Node.js 18 or later
- A server-side runtime
- An AgentBouncer project API key for request verification
- A private JWK and registered key ID for request signing

The package uses Node.js cryptography APIs and must not be imported into browser/client components.

## Installation

```bash
npm install @agentbouncer/sdk
```

## Quick start

### Sign an outgoing MCP request

```ts
import {
  createAgentBouncerSigner,
} from "@agentbouncer/sdk";

const signer = createAgentBouncerSigner({
  privateJwk: JSON.parse(
    process.env.AGENT_PRIVATE_JWK!
  ),
  keyId: process.env.AGENT_KEY_ID,
  signatureAgent:
    "https://agent.example.com",
  expiresInMs: 60_000,
});

const request = await signer.signJson({
  url:
    "https://mcp.example.com/api/mcp/weather",
  method: "POST",
  json: {
    city: "Berlin",
  },
  accessToken:
    userOAuthAccessToken,
});

const response = await fetch(request);
```

For a request with a body, the signer automatically:

1. serializes the JSON payload;
2. creates a SHA-256 `Content-Digest`;
3. adds `Signature-Agent`;
4. signs:
   - `@method`
   - `@authority`
   - `@path`
   - `content-digest`
   - `signature-agent`
5. adds the OAuth `Authorization` header after creating the HTTP Message Signature.

The OAuth access token is intentionally not included in the signed components.

### Verify an incoming MCP request

```ts
import {
  createAgentBouncer,
} from "@agentbouncer/sdk";

const agentBouncer =
  createAgentBouncer({
    apiKey:
      process.env
        .AGENTBOUNCER_API_KEY!,
    publicOrigin:
      "https://mcp.example.com",
  });

export async function POST(
  request: Request
) {
  const verification =
    await agentBouncer.verify({
      request,
      expectedTag:
        "web-bot-auth",
      action:
        "read.weather",
      tool:
        "weather",
    });

  if (!verification.allowed) {
    return Response.json(
      {
        error:
          verification.verified
            ? "access_denied"
            : "invalid_agent_signature",
        verification,
      },
      {
        status:
          verification.verified
            ? 403
            : 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const body =
    await request.json();

  return Response.json(
    {
      ok: true,
      city: body.city,
      agent:
        verification.agent,
      user:
        verification.oauth,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}
```

Call `verify()` before consuming the request body. The SDK uses `request.clone()` when validating `Content-Digest`, so the original body remains available to the application.

## Environment variables

### MCP verification server

```env
AGENTBOUNCER_API_KEY=ab_live_...
AGENTBOUNCER_VERIFY_URL=https://agentbouncer.io/api/v1/verify
PUBLIC_MCP_ORIGIN=https://mcp.example.com
```

`AGENTBOUNCER_VERIFY_URL` is optional when the SDK default points to the correct AgentBouncer endpoint. It can be provided for self-hosted, staging, or development environments.

### Agent signing server

```env
AGENT_PRIVATE_JWK={"kty":"..."}
AGENT_KEY_ID=...
AGENT_SIGNATURE_AGENT=https://agent.example.com
```

Never expose any of the following values to browser code:

- `AGENTBOUNCER_API_KEY`
- private JWKs
- private signing keys
- user OAuth access tokens

## Next.js MCP example

```ts
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AgentBouncerError,
  createAgentBouncer,
  isOAuthRequired,
  isOAuthScopeDenied,
} from "@agentbouncer/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicOrigin =
  process.env.PUBLIC_MCP_ORIGIN ||
  "https://mcp.example.com";

const resourceMetadataUrl =
  `${publicOrigin}/.well-known/oauth-protected-resource/api/mcp`;

const agentBouncer =
  createAgentBouncer({
    apiKey:
      process.env
        .AGENTBOUNCER_API_KEY!,
    verifyUrl:
      process.env
        .AGENTBOUNCER_VERIFY_URL,
    publicOrigin,
    timeoutMs: 5_000,
    validateContentDigest: true,
  });

export async function POST(
  request: NextRequest
) {
  let verification;

  try {
    verification =
      await agentBouncer.verify({
        request,
        expectedTag:
          "web-bot-auth",
        action:
          "read.weather",
        tool:
          "weather",
        forwardAuthorization: true,
      });
  } catch (error) {
    const sdkError =
      error instanceof
      AgentBouncerError
        ? {
            code: error.code,
            status:
              error.status ?? null,
          }
        : null;

    return NextResponse.json(
      {
        error:
          "agentbouncer_unavailable",
        sdkError:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : sdkError,
      },
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  if (!verification.allowed) {
    if (
      isOAuthRequired(
        verification
      )
    ) {
      return NextResponse.json(
        {
          error:
            "oauth_required",
          verification,
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store",
            "WWW-Authenticate":
              `Bearer resource_metadata="${resourceMetadataUrl}", scope="mcp:weather:read"`,
          },
        }
      );
    }

    if (
      isOAuthScopeDenied(
        verification
      )
    ) {
      return NextResponse.json(
        {
          error:
            "insufficient_scope",
          verification,
        },
        {
          status: 403,
          headers: {
            "Cache-Control":
              "no-store",
            "WWW-Authenticate":
              `Bearer error="insufficient_scope", scope="mcp:weather:read", resource_metadata="${resourceMetadataUrl}"`,
          },
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "mcp_access_denied",
        verification,
      },
      {
        status:
          verification.verified
            ? 403
            : 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const body = await request
    .json()
    .catch(() => ({}));

  return NextResponse.json(
    {
      ok: true,
      city:
        typeof body.city ===
        "string"
          ? body.city
          : "Berlin",
      agent:
        verification.agent,
      user:
        verification.oauth,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}
```

## Signing API

### `createAgentBouncerSigner(options)`

Creates a reusable request signer.

```ts
const signer =
  createAgentBouncerSigner({
    privateJwk,
    keyId,
    signatureAgent:
      "https://agent.example.com",
    expiresInMs: 60_000,
  });
```

Options:

| Option | Type | Required | Description |
|---|---:|:---:|---|
| `privateJwk` | `Record<string, unknown>` | Yes | Private JWK used to sign requests. |
| `keyId` | `string` | No | Registered signing key ID. If omitted, `privateJwk.kid` is used. |
| `signatureAgent` | `string` | Yes | Agent identity placed in `Signature-Agent`. |
| `expiresInMs` | `number` | No | Signature lifetime. Defaults to 60 seconds and cannot exceed 5 minutes. |

### `signJson(options)`

Serializes a JSON body and returns a signed `Request`.

```ts
const request =
  await signer.signJson({
    url:
      "https://mcp.example.com/api/mcp/weather",
    method: "POST",
    headers: {
      "user-agent":
        "Example Agent/1.0",
    },
    json: {
      city: "Berlin",
    },
    accessToken:
      userAccessToken,
  });
```

### `sign(options)`

Signs a request containing a string, `Uint8Array`, or no body.

```ts
const request =
  await signer.sign({
    url:
      "https://mcp.example.com/api/mcp/action",
    method: "POST",
    headers: {
      "content-type":
        "application/octet-stream",
    },
    body: payloadBytes,
  });
```

`GET` and `HEAD` requests cannot contain a body.

## Verification API

### `createAgentBouncer(options)`

```ts
const agentBouncer =
  createAgentBouncer({
    apiKey:
      process.env
        .AGENTBOUNCER_API_KEY!,
    verifyUrl:
      process.env
        .AGENTBOUNCER_VERIFY_URL,
    publicOrigin:
      "https://mcp.example.com",
    timeoutMs: 5_000,
    validateContentDigest: true,
  });
```

Options:

| Option | Type | Required | Description |
|---|---:|:---:|---|
| `apiKey` | `string` | Yes | AgentBouncer project API key. |
| `verifyUrl` | `string` | No | AgentBouncer Verify API endpoint. |
| `publicOrigin` | `string` | No | Public MCP origin used to reconstruct externally signed URLs. |
| `timeoutMs` | `number` | No | Verification API timeout. |
| `fetch` | `typeof fetch` | No | Custom server-side fetch implementation. |
| `validateContentDigest` | `boolean` | No | Validates `Content-Digest` against the actual request body. Defaults to `true`. |

### `verify(options)`

```ts
const verification =
  await agentBouncer.verify({
    request,
    expectedTag:
      "web-bot-auth",
    action:
      "tools.execute",
    tool:
      "search",
  });
```

By default, `verify()`:

1. resolves the public target URL;
2. validates the request body against `Content-Digest`;
3. extracts the bearer token from `Authorization`;
4. forwards the user token separately from the AgentBouncer project API key;
5. sends the signed request metadata to the AgentBouncer Verify API;
6. returns the signature, OAuth, replay, provider, and policy result.

Use `forwardAuthorization: false` if the incoming `Authorization` header must not be forwarded as a user OAuth token:

```ts
const verification =
  await agentBouncer.verify({
    request,
    forwardAuthorization: false,
  });
```

A token can also be provided explicitly:

```ts
const verification =
  await agentBouncer.verify({
    request,
    userToken:
      userOAuthAccessToken,
  });
```

## OAuth helpers

### `isOAuthRequired()`

Returns `true` when the request was denied because user authorization is required or the supplied OAuth token cannot be accepted.

```ts
if (
  isOAuthRequired(
    verification
  )
) {
  // Return 401 and start the OAuth flow.
}
```

### `isOAuthScopeDenied()`

Returns `true` when the OAuth token is valid but does not contain the required scopes.

```ts
if (
  isOAuthScopeDenied(
    verification
  )
) {
  // Return 403 insufficient_scope.
}
```

### `getRequiredOAuthScopes()`

Returns scopes supplied by an `oauth_required` hint:

```ts
const requiredScopes =
  getRequiredOAuthScopes(
    verification
  );
```

OAuth authorization redirects, PKCE, callback handling, cookies, and token storage remain application responsibilities.

## Content-Digest helpers

### Create a digest

```ts
import {
  createContentDigest,
} from "@agentbouncer/sdk";

const contentDigest =
  createContentDigest(
    JSON.stringify({
      city: "Berlin",
    })
  );
```

### Verify a body

```ts
import {
  verifyContentDigest,
} from "@agentbouncer/sdk";

const valid =
  verifyContentDigest(
    body,
    contentDigest
  );
```

### Verify a Request

```ts
import {
  verifyRequestContentDigest,
} from "@agentbouncer/sdk";

const result =
  await verifyRequestContentDigest(
    request
  );
```

A signed `Content-Digest` protects the request body only when the server compares it with the actual body bytes. `AgentBouncer.verify()` performs this comparison locally before calling the remote Verify API.

If the body does not match, verification returns:

```json
{
  "verified": false,
  "allowed": false,
  "reason": "content_digest_mismatch"
}
```

The remote verification endpoint is not called in this case, so the signature is not consumed by replay protection.

## Verification result

A typical successful result looks like:

```json
{
  "verified": true,
  "allowed": true,
  "reason": null,
  "agent": {
    "type": "PROJECT_KEY",
    "signatureAgent": "https://agent.example.com",
    "keyid": "agent-key-1"
  },
  "oauth": {
    "status": "valid",
    "authenticated": true,
    "sub": "user-123",
    "issuer": "https://auth.example.com",
    "scopes": [
      "mcp:weather:read"
    ],
    "error": null
  },
  "risk": {
    "score": 10,
    "level": "low"
  }
}
```

Always use `allowed` as the final authorization decision.

- `verified: false` means agent authentication failed or could not be completed.
- `verified: true, allowed: false` means the agent was authenticated but denied by OAuth or project policy.
- `verified: true, allowed: true` means the protected operation may proceed.

## Replay protection

A signed request must be sent only once.

Correct:

```ts
const request =
  await signer.signJson({
    url,
    method: "POST",
    json: payload,
  });

await fetch(request);
```

Incorrect:

```ts
const request =
  await signer.signJson({
    url,
    method: "POST",
    json: payload,
  });

await fetch(request);

// Do not reuse the same signature.
await fetch(request.clone());
```

If OAuth is required, create a new signed request after the OAuth flow completes. Do not retry the original signed request with a newly attached access token.

## Target URL reconstruction

HTTP Message Signatures cover URL-derived components such as `@authority` and `@path`. The URL verified by AgentBouncer must therefore match the public URL signed by the agent.

When an MCP server runs behind a reverse proxy, configure `publicOrigin`:

```ts
const agentBouncer =
  createAgentBouncer({
    apiKey,
    publicOrigin:
      "https://mcp.example.com",
  });
```

You may override the target URL for a specific request:

```ts
const verification =
  await agentBouncer.verify({
    request,
    targetUrl:
      "https://mcp.example.com/api/mcp/weather",
  });
```

Do not construct `targetUrl` from untrusted client headers unless your proxy configuration validates those headers.

## Error handling

Operational SDK failures throw `AgentBouncerError`:

```ts
import {
  AgentBouncerError,
} from "@agentbouncer/sdk";

try {
  const verification =
    await agentBouncer.verify({
      request,
    });
} catch (error) {
  if (
    error instanceof
    AgentBouncerError
  ) {
    console.error({
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }

  return Response.json(
    {
      error:
        "agentbouncer_unavailable",
    },
    {
      status: 503,
    }
  );
}
```

A normal verification or policy denial is returned as an `AgentBouncerVerificationResult`; it is not thrown as an exception by `verify()`.

## Security recommendations

- Use this SDK only in server-side Node.js runtimes.
- Never expose the AgentBouncer API key or private JWK to browser code.
- Always check `verification.allowed` before executing a protected operation.
- Verify requests before parsing or processing their business payload.
- Keep `validateContentDigest` enabled for requests with bodies.
- Ensure the target URL exactly matches the URL signed by the agent.
- Do not reuse signed requests.
- Generate a new signature after OAuth authorization completes.
- Use short signature expiration windows.
- Return `Cache-Control: no-store` for verification and OAuth-related responses.
- Treat AgentBouncer API failures as deny-by-default for protected operations.
- Do not log OAuth access tokens, private JWKs, or complete authorization headers.
- Keep OAuth tokens in secure server-side storage or `HttpOnly` cookies.
- Use HTTPS in production.

## Migrating from 0.1.x

Version `0.2.0` adds signing, OAuth forwarding, and local body-digest validation.

Existing verification code remains compatible:

```ts
const verification =
  await agentBouncer.verify({
    request,
  });
```

Review the following behavioral additions:

1. `Content-Digest` is validated locally by default when present.
2. The incoming bearer token is forwarded as the user OAuth token by default.
3. Use `forwardAuthorization: false` to disable automatic OAuth forwarding.
4. Use `validateContentDigest: false` only for exceptional compatibility cases.
5. New clients should sign `@method`, `@authority`, `@path`, `content-digest`, and `signature-agent`.
6. Signed requests must not be reused after an OAuth challenge or any other verification attempt.

## License

MIT