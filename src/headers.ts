const SENSITIVE_HEADERS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-api-key",
    "x-auth-token",
  ]);
  
  export function collectVerificationHeaders(
    source: Headers,
    additionalHeaders?: HeadersInit
  ) {
    const result = new Headers();
  
    for (const [name, value] of source.entries()) {
      const lowerName = name.toLowerCase();
  
      if (SENSITIVE_HEADERS.has(lowerName)) {
        continue;
      }
  
      result.set(name, value);
    }
  
    if (additionalHeaders) {
      const additional = new Headers(additionalHeaders);
  
      for (const [name, value] of additional.entries()) {
        const lowerName = name.toLowerCase();
  
        if (SENSITIVE_HEADERS.has(lowerName)) {
          continue;
        }
  
        result.set(name, value);
      }
    }
  
    return Object.fromEntries(result.entries());
  }