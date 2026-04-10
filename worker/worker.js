// ============================================================
// Accelerate Offshoring — Blog Creation Tool
// Cloudflare Worker: Notion API Proxy
//
// Purpose:
//   Acts as a server-side proxy between the GitHub Pages frontend
//   and the Notion API. This avoids CORS restrictions that prevent
//   direct browser-to-Notion calls, and keeps the Notion API key
//   securely stored as a Worker secret — never sent to the browser.
//
// Deployment:
//   1. cd worker
//   2. wrangler secret put NOTION_API_KEY   (paste your Notion integration token)
//   3. wrangler deploy
//   4. Copy the deployed Worker URL into the tool's Settings panel
//
// Worker secret required:
//   NOTION_API_KEY — your Notion internal integration token (secret_...)
// ============================================================

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ── Only accept POST ────────────────────────────────────
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed. Send a POST request.', 405);
    }

    // ── Verify the Worker secret is configured ──────────────
    if (!env.NOTION_API_KEY) {
      return errorResponse(
        'NOTION_API_KEY is not set on this Worker. ' +
        'Run: wrangler secret put NOTION_API_KEY',
        500
      );
    }

    // ── Parse the incoming request body ────────────────────
    let payload;
    try {
      payload = await request.json();
    } catch {
      return errorResponse('Invalid JSON body.', 400);
    }

    // ── Basic validation ────────────────────────────────────
    if (!payload.parent || !payload.properties) {
      return errorResponse('Missing required Notion page fields: parent, properties.', 400);
    }

    // ── Forward to Notion API ───────────────────────────────
    let notionRes;
    try {
      notionRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Authorization':  `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return errorResponse(`Failed to reach the Notion API: ${err.message}`, 502);
    }

    // ── Return Notion's response to the browser ─────────────
    const data = await notionRes.json();

    return new Response(JSON.stringify(data), {
      status: notionRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  }
};

// ── Helpers ─────────────────────────────────────────────────

function corsHeaders() {
  return {
    // Allow requests from any origin (GitHub Pages, localhost, etc.)
    // To restrict to your GitHub Pages domain only, replace * with e.g.:
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
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}
