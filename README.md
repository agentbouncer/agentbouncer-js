# AgentBouncer JavaScript SDK

[![npm version](https://img.shields.io/npm/v/@agentbouncer/sdk.svg)](https://www.npmjs.com/package/@agentbouncer/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@agentbouncer/sdk.svg)](https://www.npmjs.com/package/@agentbouncer/sdk)
[![license](https://img.shields.io/npm/l/@agentbouncer/sdk.svg)](./LICENSE)

Official server-side SDK for verifying signed AI agent and MCP requests through AgentBouncer.

## Installation

```bash
npm install @agentbouncer/sdk
```

## Environment variables

```env
AGENTBOUNCER_API_KEY=ab_live_...
PUBLIC_MCP_ORIGIN=https://example.com
```

Never expose `AGENTBOUNCER_API_KEY` in browser code or public environment variables.

## Next.js example

```ts
import {
  createAgentBouncer,
} from "@agentbouncer/sdk";

import {
  NextRequest,
  NextResponse,
} from "next/server";

const agentBouncer = createAgentBouncer({
  apiKey: process.env.AGENTBOUNCER_API_KEY!,
  publicOrigin: process.env.PUBLIC_MCP_ORIGIN,
});

export async function POST(req: NextRequest) {
  const verification = await agentBouncer.verify({
    request: req,
    expectedTag: "web-bot-auth",
    action: "read.weather",
    tool: "weather",
  });

  if (!verification.verified) {
    return NextResponse.json(
      {
        error: "invalid_agent_signature",
        verification,
      },
      {
        status: 401,
      }
    );
  }

  if (!verification.allowed) {
    return NextResponse.json(
      {
        error: "agent_policy_denied",
        verification,
      },
      {
        status: 403,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    agent: verification.agent,
  });
}
```

## Generic Fetch API example

The SDK accepts any standard server-side `Request`:

```ts
const verification = await agentBouncer.verify({
  request,
  action: "tools.execute",
  tool: "search",
});
```

## Security

- Use this SDK only on the server.
- Never expose the AgentBouncer API key to browser code.
- The target URL must exactly match the URL signed by the agent.
- Do not verify the same signed request more than once.
- Deny protected operations when verification cannot be completed.