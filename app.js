// ============================================================
// Accelerate Offshoring — Blog Creation Tool
// app.js
// ============================================================

// ============================================================
// Constants
// ============================================================
const CLAUDE_MODEL      = 'claude-sonnet-4-6';
const CLAUDE_ENDPOINT   = 'https://api.anthropic.com/v1/messages';
const NOTION_ENDPOINT   = 'https://api.notion.com/v1/pages';
const NOTION_API_VER    = '2022-06-28';

// Output Log page ID from the Accelerate Offshoring Notion workspace
const NOTION_OUTPUT_LOG_ID = '33e743b0-d5d4-813a-a17a-fb7dee5df3eb';

// ============================================================
// System Prompt
// Built from: Claude Interaction Guide (Page 2) + Reference Data (Page 3)
// ============================================================
const SYSTEM_PROMPT = `You are the content engine behind the Accelerate Offshoring Blog Creation Tool.

Your role: Take source material and selector inputs from the user and produce a fully formatted, publish-ready blog post for Accelerate Offshoring's candidate-facing website (Resources section). This website targets Filipino professionals — NOT Australian business owners or clients.

---

## About Accelerate Offshoring

Accelerate Offshoring is a premium Australian-owned offshore staffing agency with offices in Brisbane (Australia) and Clark, Pampanga (Philippines). They connect Australian businesses with skilled Filipino professionals across marketing, tech, creative, admin, and business support roles.

Brand Tagline: "Your Career, Supported Locally. Your Work, Valued Globally."

Core message: Accelerate is not a typical BPO. It is a long-term career partner that offers stability, fairness, above-market pay, and genuine investment in its people. Filipino values matter here.

What makes Accelerate different:
- Stable, long-term employment (not project-based)
- Paid on time, every time
- Professional Clark, Pampanga office environment (not a call centre floor)
- People-first leadership
- Clear structure, onboarding, and career development
- Community — Filipino values like "ate and kuya" are embedded in the culture

---

## The Audience You Are Writing For

Write for Filipino professionals:
- Active job seekers looking for stable, professional employment
- Career changers leaving BPO or call centre roles
- Experienced professionals who want to upgrade their employer
- General candidates exploring offshore careers

Do NOT write for Australian clients or business owners.

---

## Voice & Tone Rules

- Warm and human first. Write as if you genuinely care about the reader's career and future — because Accelerate does.
- Filipino cultural sensitivity always. References to family, stability, community, and long-term thinking resonate strongly. The site already uses phrases like "ate and kuya" — lean into that spirit.
- Never condescending. These are skilled professionals. Write with respect and peer-level warmth.
- Empowering, not pitching. Educate and inform. Never hard-sell. Trust is built through usefulness.
- Conversational but professional. Avoid stiff corporate language. Avoid slang. Write like a smart, kind colleague.
- Always honour the Tone selector chosen by the user — it overrides the default approach.

---

## Verified Stats & Trust Signals (Use naturally where relevant — never fabricate or alter these)

- 94% staff retention rate
- 7% annual staff turnover
- Wages 20–30% above standard market rates
- 15+ years of offshoring experience
- Staff based in Clark, Pampanga (professional office environment, not a call centre)
- University-educated, English-speaking professionals
- Benefits include: LinkedIn Learning, Gold Type 200k health plan (Medical & Dental), paid leave, team building
- Accelerate is Australian-owned and fully operates its own Philippines office

---

## Tone Reference Phrases (from the live Accelerate candidate website — use as style guidance)

- "A stable, long-term career in Clark where you can grow, feel supported, and build a future you are proud of."
- "We are not a typical BPO. We are a long-term career partner."
- "People stay with Accelerate because they feel cared for, respected, and confident about their future."
- "Filipino values matter here. You will hear words like ate and kuya."
- "Even during difficult times, people choose to come into the office because they feel safe, supported, and connected."

---

## Source Material Handling

Users will paste in news articles, industry reports, document summaries, URLs descriptions, or their own notes and ideas. Use this material as inspiration and reference. The blog should be original writing that draws on the source — summarising key ideas, connecting them to the candidate's world, and framing them through Accelerate's voice. Always reference what the source material was about within the article naturally. Do not copy-paste source content directly.

---

## Output Format (STRICT — follow exactly, every field required, no exceptions)

**Blog Title:** [Compelling, SEO-friendly title that naturally incorporates the focus keyword]

**Date Created:** [Today's date in DD Month YYYY format]

**Meta Description:** [150–160 character SEO summary — count characters carefully and stay within this range]

**Focus Keyword:** [The exact keyword provided by the user]

**Selectors Used:**
- Category: [value]
- Tone: [value]
- Target Reader: [value]
- Length: [value]
- CTA: [value]

**Suggested Blog Image:** [1–2 sentence description of the ideal image style and subject matter — e.g. "A warm, professional photo of a Filipino team collaborating in a modern office. Natural light, relaxed and focused atmosphere."]

## [H2 — First Section Heading]

[Full blog body — formatted with H2 subheadings and short paragraphs. Include a closing CTA section matching the CTA selector. Honour the length selector strictly — do not exceed the word count range.]

---

## Absolute Rules

- Do NOT write content aimed at Australian clients or business owners
- Do NOT mention competitor offshore providers by name
- Do NOT make up statistics — only use the verified stats listed above
- Do NOT use a corporate or stiff tone — this audience responds to warmth
- Do NOT skip any output format field — every single field must be present
- Do NOT exceed the selected length tier's word count range
- The CTA at the close must exactly match the CTA selector (Submit Your CV / Explore Current Job Openings / No CTA)`;

// ============================================================
// State
// ============================================================
let lastRawOutput  = '';
let lastParsed     = null;
let settingsOpen   = false;

// ============================================================
// Initialise
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadApiKeys();
  bindEvents();
});

function bindEvents() {
  // Settings
  document.getElementById('toggleSettings').addEventListener('click', () => toggleSettings());
  document.getElementById('saveSettings').addEventListener('click', saveApiKeys);

  // Settings link inside reminder
  document.getElementById('openSettingsLink').addEventListener('click', () => {
    toggleSettings(true);
    document.getElementById('claudeKey').focus();
  });

  // Generate
  document.getElementById('generateBtn').addEventListener('click', handleGenerate);

  // Copy buttons
  document.getElementById('copyFullBtn').addEventListener('click', () => copyOutput('full'));
  document.getElementById('copyBodyBtn').addEventListener('click', () => copyOutput('body'));
}

// ============================================================
// Settings / API Key Management
// ============================================================
function toggleSettings(forceOpen) {
  settingsOpen = (forceOpen === true) ? true : !settingsOpen;

  const panel = document.getElementById('settingsPanel');
  const btn   = document.getElementById('toggleSettings');

  panel.hidden = !settingsOpen;
  btn.setAttribute('aria-expanded', String(settingsOpen));
  btn.textContent = settingsOpen ? '✕ Close Settings' : '⚙ Settings';
}

function loadApiKeys() {
  document.getElementById('claudeKey').value = localStorage.getItem('ao_claude_key') || '';
  document.getElementById('notionKey').value  = localStorage.getItem('ao_notion_key') || '';
}

function saveApiKeys() {
  const claudeKey = document.getElementById('claudeKey').value.trim();
  const notionKey  = document.getElementById('notionKey').value.trim();

  localStorage.setItem('ao_claude_key', claudeKey);
  localStorage.setItem('ao_notion_key', notionKey);

  const status = document.getElementById('saveStatus');
  status.textContent = '✓ Keys saved';
  setTimeout(() => { status.textContent = ''; }, 3000);
}

function getStoredKeys() {
  return {
    claude: localStorage.getItem('ao_claude_key') || '',
    notion: localStorage.getItem('ao_notion_key') || ''
  };
}

// ============================================================
// Main Generate Handler
// ============================================================
async function handleGenerate() {
  const keys = getStoredKeys();

  if (!keys.claude) {
    document.getElementById('apiKeyReminder').hidden = false;
    return;
  }
  document.getElementById('apiKeyReminder').hidden = true;

  const inputs = gatherInputs();
  if (!inputs) return;

  setGenerating(true);
  clearOutput();

  try {
    // 1. Call Claude
    const rawOutput = await callClaudeAPI(keys.claude, inputs);
    lastRawOutput = rawOutput;
    lastParsed    = parseBlogOutput(rawOutput);

    // 2. Render preview
    renderBlogPreview(lastParsed, rawOutput);

    // 3. Write to Notion
    if (keys.notion) {
      await writeToNotion(keys.notion, lastParsed, rawOutput);
    } else {
      setNotionStatus('warning',
        'No Notion API key saved — blog not written to Notion. ' +
        'Add your key in Settings to enable automatic saving.'
      );
    }

  } catch (err) {
    console.error('Generation error:', err);
    setNotionStatus('error', `Error: ${sanitiseText(err.message || 'Something went wrong. Check your Claude API key and try again.')}`);
    // Still show the output section if we have partial output
    if (lastRawOutput) {
      document.getElementById('outputSection').hidden = false;
    }
  } finally {
    setGenerating(false);
  }
}

// ============================================================
// Input Gathering & Validation
// ============================================================
function gatherInputs() {
  const fields = {
    category:       document.getElementById('category').value,
    tone:           document.getElementById('tone').value,
    targetReader:   document.getElementById('targetReader').value,
    length:         document.getElementById('length').value,
    cta:            document.getElementById('cta').value,
    seoKeyword:     document.getElementById('seoKeyword').value.trim(),
    sourceMaterial: document.getElementById('sourceMaterial').value.trim()
  };

  const labels = {
    category:       'Article Category',
    tone:           'Tone',
    targetReader:   'Target Reader',
    length:         'Article Length',
    cta:            'CTA at Close',
    seoKeyword:     'SEO Focus Keyword',
    sourceMaterial: 'Source Material'
  };

  const missing = Object.entries(fields)
    .filter(([, v]) => !v)
    .map(([k]) => labels[k]);

  if (missing.length) {
    alert(`Please complete the following before generating:\n\n• ${missing.join('\n• ')}`);
    return null;
  }

  return fields;
}

// ============================================================
// UI State
// ============================================================
function setGenerating(active) {
  const btn      = document.getElementById('generateBtn');
  const btnText  = btn.querySelector('.btn-text');
  const btnIcon  = btn.querySelector('.btn-icon');
  const loading  = btn.querySelector('.btn-loading');

  btn.disabled      = active;
  btnText.hidden    = active;
  btnIcon.hidden    = active;
  loading.hidden    = !active;
}

function clearOutput() {
  document.getElementById('notionStatus').innerHTML = '';
  document.getElementById('blogPreview').innerHTML  = '';
  document.getElementById('outputSection').hidden   = true;
}

// ============================================================
// Claude API Call
// ============================================================
async function callClaudeAPI(apiKey, inputs) {
  const response = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':                           'application/json',
      'x-api-key':                              apiKey,
      'anthropic-version':                      '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserMessage(inputs) }
      ]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg     = errData?.error?.message || `Claude API responded with status ${response.status}.`;
    throw new Error(msg);
  }

  const data = await response.json();

  if (!data.content || !data.content[0]) {
    throw new Error('Claude returned an empty response. Please try again.');
  }

  return data.content[0].text;
}

function buildUserMessage(inputs) {
  return `Please generate a blog post for the Accelerate Offshoring candidate-facing website.

**Writing Parameters:**
- Category: ${inputs.category}
- Tone: ${inputs.tone}
- Target Reader: ${inputs.targetReader}
- Length: ${inputs.length}
- CTA at Close: ${inputs.cta}
- SEO Focus Keyword: ${inputs.seoKeyword}

**Source Material:**
${inputs.sourceMaterial}

Follow the output format exactly as specified in your instructions. Every field is required. Do not omit any section.`;
}

// ============================================================
// Blog Output Parser
// ============================================================
function parseBlogOutput(text) {
  // Helper: extract first capture from a regex, trimmed
  const get = (regex) => {
    const m = text.match(regex);
    return m ? m[1].trim() : '';
  };

  const title           = get(/\*\*Blog Title:\*\*\s*(.+)/);
  const dateCreated     = get(/\*\*Date Created:\*\*\s*(.+)/);
  const metaDescription = get(/\*\*Meta Description:\*\*\s*(.+)/);
  const focusKeyword    = get(/\*\*Focus Keyword:\*\*\s*(.+)/);

  // Suggested image: may be multi-line — capture until blank line or ##
  const imageMatch     = text.match(/\*\*Suggested Blog Image:\*\*\s*([\s\S]+?)(?=\n\s*\n|\n##|$)/);
  const suggestedImage = imageMatch ? imageMatch[1].trim() : '';

  // Selectors block
  const selectorsMatch = text.match(/\*\*Selectors Used:\*\*\s*([\s\S]+?)(?=\n\s*\n\*\*|\n\s*\n##|$)/);
  const selectors = selectorsMatch
    ? selectorsMatch[1]
        .split('\n')
        .filter(l => /^\s*-/.test(l))
        .map(l => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
    : [];

  // Blog body: everything from the first ## heading
  const bodyMatch = text.match(/\n(## [\s\S]+)$/);
  const body      = bodyMatch ? bodyMatch[1].trim() : '';

  return { title, dateCreated, metaDescription, focusKeyword, suggestedImage, selectors, body };
}

// ============================================================
// Blog Preview Renderer
// ============================================================
function renderBlogPreview(parsed, rawText) {
  const section  = document.getElementById('outputSection');
  const preview  = document.getElementById('blogPreview');

  preview.innerHTML = buildPreviewHTML(parsed);

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildPreviewHTML(parsed) {
  const { title, dateCreated, metaDescription, focusKeyword, suggestedImage, selectors, body } = parsed;

  const titleHTML = title
    ? `<div class="blog-title-display">${esc(title)}</div>`
    : '';

  const selectorPills = selectors
    .map(s => `<li>${esc(s)}</li>`)
    .join('');

  const metaHTML = `
    <div class="blog-meta">
      <div class="meta-item">
        <span class="meta-label">Date Created</span>
        <span class="meta-value">${esc(dateCreated) || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Focus Keyword</span>
        <span class="meta-value">${esc(focusKeyword) || '—'}</span>
      </div>
      <div class="meta-item full-width">
        <span class="meta-label">Meta Description</span>
        <span class="meta-value">${esc(metaDescription) || '—'}</span>
      </div>
      ${selectorPills ? `
      <div class="meta-item full-width">
        <span class="meta-label">Selectors Used</span>
        <ul class="meta-selectors">${selectorPills}</ul>
      </div>` : ''}
    </div>`;

  const imageHTML = suggestedImage
    ? `<div class="image-suggestion">
         <strong>Suggested Image</strong>
         ${esc(suggestedImage)}
       </div>`
    : '';

  const bodyHTML = body
    ? `<div class="blog-body">${markdownToHTML(body)}</div>`
    : '';

  return titleHTML + metaHTML + imageHTML + bodyHTML;
}

// ============================================================
// Markdown → HTML  (for preview rendering)
// ============================================================
function markdownToHTML(markdown) {
  if (!markdown) return '';

  const lines  = markdown.split('\n');
  const out    = [];
  let inList   = false;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      closelist(out, inList); inList = false;
      out.push(`<h2>${inlineHTML(line.slice(3))}</h2>`);

    } else if (line.startsWith('### ')) {
      closelist(out, inList); inList = false;
      out.push(`<h3>${inlineHTML(line.slice(4))}</h3>`);

    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineHTML(line.replace(/^[-*]\s/, ''))}</li>`);

    } else if (line.trim() === '---') {
      closelist(out, inList); inList = false;
      out.push('<hr>');

    } else if (line.trim() === '') {
      closelist(out, inList); inList = false;

    } else {
      closelist(out, inList); inList = false;
      out.push(`<p>${inlineHTML(line)}</p>`);
    }
  }

  closelist(out, inList);
  return out.join('\n');
}

function closelist(out, inList) {
  if (inList) out.push('</ul>');
}

/** Parse inline markdown (bold, italic, code) — text is HTML-escaped first */
function inlineHTML(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>');
}

/** HTML-escape a string */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/** Sanitise text for insertion into HTML without escaping (used for error messages) */
function sanitiseText(str) {
  return esc(str);
}

// ============================================================
// Notion API — Write Blog as Child Page
// ============================================================
async function writeToNotion(apiKey, parsed, rawText) {
  setNotionStatus('loading', 'Saving to Notion Output Log…');

  const pageTitle = parsed.title || `Blog Post — ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  const blocks    = markdownToNotionBlocks(rawText);

  // Notion API: max 100 children blocks per request
  const firstBatch = blocks.slice(0, 100);

  let response;
  try {
    response = await fetch(NOTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${apiKey}`,
        'Notion-Version':  NOTION_API_VER
      },
      body: JSON.stringify({
        parent: {
          type:    'page_id',
          page_id: NOTION_OUTPUT_LOG_ID
        },
        properties: {
          title: {
            title: [{ type: 'text', text: { content: pageTitle } }]
          }
        },
        children: firstBatch
      })
    });
  } catch (networkErr) {
    // Likely a CORS error — Notion API cannot be called directly from most browsers
    setNotionStatus('error',
      'Could not reach the Notion API — this is usually a CORS restriction when calling from a browser. ' +
      'Your blog has been generated above. Use the <strong>Copy</strong> buttons to paste it into Notion manually, ' +
      'or set up a lightweight server-side proxy (e.g. Cloudflare Worker) to enable automatic saving.'
    );
    return;
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg     = errData?.message || errData?.code || `Notion API error (${response.status})`;
    setNotionStatus('error', `Notion: ${sanitiseText(msg)}`);
    return;
  }

  const data    = await response.json();
  const pageUrl = data.url || `https://notion.so`;

  setNotionStatus('success',
    `✓ Saved to Notion — <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">Open in Notion</a>`
  );
}

// ============================================================
// Markdown → Notion Blocks
// ============================================================
function markdownToNotionBlocks(markdown) {
  const lines  = markdown.split('\n');
  const blocks = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith('## ')) {
      blocks.push({
        type:      'heading_2',
        heading_2: { rich_text: [notionText(line.slice(3).trim())] }
      });

    } else if (line.startsWith('### ')) {
      blocks.push({
        type:      'heading_3',
        heading_3: { rich_text: [notionText(line.slice(4).trim())] }
      });

    } else if (/^[-*]\s/.test(line)) {
      blocks.push({
        type:                'bulleted_list_item',
        bulleted_list_item:  { rich_text: notionInline(line.replace(/^[-*]\s/, '').trim()) }
      });

    } else if (line.trim() === '---') {
      blocks.push({ type: 'divider', divider: {} });

    } else {
      blocks.push({
        type:      'paragraph',
        paragraph: { rich_text: notionInline(line) }
      });
    }
  }

  return blocks;
}

/** Single plain text Notion rich_text object */
function notionText(str) {
  return { type: 'text', text: { content: str } };
}

/** Parse inline bold (**text**) for Notion rich_text array */
function notionInline(text) {
  const parts  = [];
  const regex  = /\*\*(.+?)\*\*/g;
  let lastIdx  = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', text: { content: text.slice(lastIdx, match.index) } });
    }
    parts.push({
      type:        'text',
      text:        { content: match[1] },
      annotations: { bold: true }
    });
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push({ type: 'text', text: { content: text.slice(lastIdx) } });
  }

  return parts.length ? parts : [notionText(text)];
}

// ============================================================
// Notion Status Display
// ============================================================
function setNotionStatus(type, htmlContent) {
  const el = document.getElementById('notionStatus');
  el.innerHTML = `<span class="status-badge ${type}">${htmlContent}</span>`;
}

// ============================================================
// Copy to Clipboard
// ============================================================
function copyOutput(mode) {
  if (!lastRawOutput) return;

  let text;
  if (mode === 'body' && lastParsed?.body) {
    text = lastParsed.body;
  } else {
    text = lastRawOutput;
  }

  const btnId = mode === 'body' ? 'copyBodyBtn' : 'copyFullBtn';
  const btn   = document.getElementById(btnId);

  const writeClipboard = (t) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t);
    }
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  };

  writeClipboard(text)
    .then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2200);
    })
    .catch(() => {
      btn.textContent = 'Could not copy';
      setTimeout(() => { btn.textContent = mode === 'body' ? 'Copy Blog Body' : 'Copy Full Output'; }, 2200);
    });
}
