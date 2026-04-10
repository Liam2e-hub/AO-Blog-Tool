// ============================================================
// Accelerate Offshoring — Blog Creation Tool
// Cloudflare Worker: API Proxy
//
// Routes:
//   POST /claude  — proxies to Anthropic Claude API
//   POST /notion  — proxies to Notion API (creates child page in Output Log)
//   OPTIONS /*    — CORS preflight
//
// Environment variables (set in wrangler.toml [vars]):
//   NOTION_OUTPUT_LOG_ID  — Notion page ID of the Output Log
//
// Secrets (set via Wrangler CLI — never commit these values):
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler secret put NOTION_API_KEY
//
// Deployment:
//   1. cd worker
//   2. npm install -g wrangler
//   3. wrangler login
//   4. wrangler secret put ANTHROPIC_API_KEY   (paste your Anthropic key: sk-ant-...)
//   5. wrangler secret put NOTION_API_KEY      (paste your Notion token: secret_...)
//   6. wrangler deploy
//   7. Paste the deployed Worker URL into the tool's Settings panel
// ============================================================

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Only accept POST ────────────────────────────────────
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed. Send a POST request.', 405);
    }

    // ── Route ───────────────────────────────────────────────
    if (pathname === '/claude') return handleClaude(request, env);
    if (pathname === '/notion') return handleNotion(request, env);

    return errorResponse(
      `Unknown route "${pathname}". Valid routes: POST /claude, POST /notion.`,
      404
    );
  }
};

// ============================================================
// /claude — Proxy to Anthropic Claude API
// ============================================================
async function handleClaude(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse(
      'ANTHROPIC_API_KEY is not set on this Worker. Run: wrangler secret put ANTHROPIC_API_KEY',
      500
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  if (!payload.model || !payload.messages) {
    return errorResponse('Missing required fields: model, messages.', 400);
  }

  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return errorResponse(`Could not reach the Claude API: ${err.message}`, 502);
  }

  const data = await claudeRes.json();

  return new Response(JSON.stringify(data), {
    status: claudeRes.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

// ============================================================
// /notion — Proxy to Notion API (create child page in Output Log)
// ============================================================
async function handleNotion(request, env) {
  if (!env.NOTION_API_KEY) {
    return errorResponse(
      'NOTION_API_KEY is not set on this Worker. Run: wrangler secret put NOTION_API_KEY',
      500
    );
  }
  if (!env.NOTION_OUTPUT_LOG_ID) {
    return errorResponse(
      'NOTION_OUTPUT_LOG_ID is not set. Add it to [vars] in wrangler.toml and redeploy.',
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  if (!body.title || !body.blocks) {
    return errorResponse('Missing required fields: title, blocks.', 400);
  }

  // Construct the full Notion page payload server-side —
  // the browser never needs to know the Output Log page ID.
  const notionPayload = {
    parent: {
      type:    'page_id',
      page_id: env.NOTION_OUTPUT_LOG_ID
    },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: String(body.title) } }]
      }
    },
    children: body.blocks.slice(0, 100) // Notion limit: 100 blocks per request
  };

  let notionRes;
  try {
    notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionPayload)
    });
  } catch (err) {
    return errorResponse(`Could not reach the Notion API: ${err.message}`, 502);
  }

  const data = await notionRes.json();

  return new Response(JSON.stringify(data), {
    status: notionRes.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

// ============================================================
// Helpers
// ============================================================
function corsHeaders() {
  return {
    // Allows requests from any origin (GitHub Pages, localhost, etc.)
    // To lock down to your GitHub Pages domain only, replace * with e.g.:
    //   'https://your-username.github.io'
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400'
  };
}

function errorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    }
  );
}
