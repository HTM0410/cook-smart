/**
 * Cloudflare Worker proxy: CookSmart API
 * Forwards all requests from https://<worker>.workers.dev
 * to http://cooksmart-prod-v2-alb-881116705.ap-southeast-1.elb.amazonaws.com
 *
 * Features:
 *  - Full HTTP method passthrough (GET, POST, PUT, DELETE, PATCH, OPTIONS)
 *  - Preserves all headers + body
 *  - CORS preflight short-circuit (lets origin through)
 *  - Strips/replaces problematic hop-by-hop headers
 */

const ALLOWED_ORIGINS = [
  "https://cookssmart.netlify.app",
  "https://cooksmart.netlify.app",
  // Wildcard fallback for any *.netlify.app site the user may have deployed to
  // and dev origins
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

const TARGET_BASE = "http://cooksmart-prod-v2-alb-881116705.ap-southeast-1.elb.amazonaws.com";

// Headers that should not be forwarded upstream (hop-by-hop, restricted)
const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "cf-connecting-ip",
  "cf-worker",
  "cf-ray",
  "cf-request-id",
  "cf-ipcountry",
  "cf-placement",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-real-ip",
  "connection",
  "upgrade",
  "keep-alive",
  "transfer-encoding",
]);

const SKIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
  "alt-svc",
  "cf-ray",
  "cf-cache-status",
]);

function corsHeaders(origin) {
  // Allow any *.netlify.app and localhost dev origins; restrict other origins to whitelist
  let allow;
  if (!origin) {
    allow = ALLOWED_ORIGINS[0];
  } else if (
    /^https:\/\/[^/]+\.netlify\.app$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin)
  ) {
    allow = origin; // dynamic echo for these
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    allow = origin;
  } else {
    allow = ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function buildTargetUrl(request) {
  // Forward path + query string verbatim
  const incoming = new URL(request.url);
  return new URL(incoming.pathname + incoming.search, TARGET_BASE);
}

function buildUpstreamHeaders(request) {
  const h = new Headers();
  for (const [k, v] of request.headers.entries()) {
    const lk = k.toLowerCase();
    if (!SKIP_REQUEST_HEADERS.has(lk)) {
      h.set(k, v);
    }
  }
  // Force identity content-encoding to avoid double-decode issues
  h.set("Accept-Encoding", "identity");
  return h;
}

function buildResponseHeaders(upstreamHeaders, origin) {
  const h = new Headers();
  for (const [k, v] of upstreamHeaders.entries()) {
    if (!SKIP_RESPONSE_HEADERS.has(k.toLowerCase())) {
      h.set(k, v);
    }
  }
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) {
    h.set(k, v);
  }
  h.set("Cache-Control", "no-store");
  return h;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || ALLOWED_ORIGINS[0];
    console.log(`[cooksmart-proxy] ${request.method} ${new URL(request.url).pathname}`);

    // CORS preflight short-circuit
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // WebSocket upgrade handling — socket.io uses /socket.io/... path
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const targetUrl = buildTargetUrl(request);
      targetUrl.protocol = "http:"; // backend ws server is plain http+ws
      // Build new headers, stripping things Worker will mangle
      const wsHeaders = new Headers();
      for (const [k, v] of request.headers.entries()) {
        const lk = k.toLowerCase();
        if (
          !["host", "cf-ray", "cf-connecting-ip", "x-forwarded-for"].includes(
            lk
          )
        ) {
          wsHeaders.set(k, v);
        }
      }
      wsHeaders.set("Host", new URL(TARGET_BASE).host);

      try {
        const upstream = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: wsHeaders,
        });
        // Pass through WebSocket response
        if (upstream.webSocket) {
          const pair = new WebSocketPair();
          const client = pair[0];
          const server = pair[1];
          server.accept();
          upstream.webSocket.addEventListener("message", (e) =>
            server.send(e.data)
          );
          upstream.webSocket.addEventListener("close", (e) =>
            server.close(e.code, e.reason)
          );
          client.addEventListener("message", (e) =>
            upstream.webSocket.send(e.data)
          );
          client.addEventListener("close", (e) => {
            try {
              upstream.webSocket.close(e.code, e.reason);
            } catch (_) {}
          });
          return new Response(null, { status: 101, webSocket: client });
        }
        return upstream;
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "WS upstream unreachable",
            detail: String(err && err.message ? err.message : err),
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            },
          }
        );
      }
    }

    const targetUrl = buildTargetUrl(request);
    targetUrl.protocol = "https:";
    const upstreamHeaders = buildUpstreamHeaders(request);
    upstreamHeaders.set("X-Forwarded-Proto", "https");
    upstreamHeaders.set("X-Forwarded-Host", new URL(TARGET_BASE).host);

    const init = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "manual",
    };

    // Only forward body for methods that allow it
    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
      init.duplex = "half";
    }

    console.log(`[cooksmart-proxy] -> upstream ${targetUrl.toString()}`);
    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), init);
      console.log(`[cooksmart-proxy] <- upstream status=${upstream.status}`);
    } catch (err) {
      console.log(`[cooksmart-proxy] !! upstream error: ${err && err.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Upstream unreachable",
          detail: String(err && err.message ? err.message : err),
          target: targetUrl.toString(),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        }
      );
    }

    const responseHeaders = buildResponseHeaders(upstream.headers, origin);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
