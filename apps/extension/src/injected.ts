/**
 * @file injected.ts
 * AI CAGE — Page-Context Network Gate v0.6.0
 *
 * v0.6.0 changes:
 *   P0-9: Detect FormData/Blob/ArrayBuffer uploads → send AI_CAGE_FILE_UPLOAD_WARNING
 *         to content.ts which shows a 5s orange toast to Karim.
 *         Binary bodies are passed through unchanged (we can't scan them reliably),
 *         but the user now knows to check before sending.
 *
 * Architecture (unchanged):
 *   OLD (broken): injected.js cages independently → ignores user "Pass" decision
 *   NEW (correct): injected.js HOLDS the request until content.ts sends a decision
 *
 *   Flow:
 *     1. User types prompt → hits Enter
 *     2. Page calls fetch('/api/chat')
 *     3. injected.js intercepts → detects PII → PAUSES the request
 *     4. Sends "AI_CAGE_PII_DETECTED" to content.ts with detected items
 *     5. content.ts shows the control panel → user decides
 *     6. User clicks "Cage All" → content.ts sends "AI_CAGE_PROCEED" { mode: 'cage' }
 *        OR user clicks "Pass All" → content.ts sends "AI_CAGE_PROCEED" { mode: 'pass' }
 *     7. injected.js resumes the request with the appropriate body
 *
 *   NEW TAB FIX:
 *     - injected.js initialises its entity store fresh on every page load
 *     - Per-tab state is isolated in the IIFE closure
 *     - No shared state between tabs
 */

(function (window) {
  'use strict';

  if ((window as { __AI_CAGE_ACTIVE__?: boolean }).__AI_CAGE_ACTIVE__) return;
  (window as { __AI_CAGE_ACTIVE__?: boolean }).__AI_CAGE_ACTIVE__ = true;

  // ── Self-contained PII patterns ─────────────────────────────────────────

  interface PiiMatch { type: string; value: string; start: number; end: number; label: string; }

  const PATTERNS: Array<{ type: string; label: string; re: RegExp }> = [
    { type: 'PRIVATE_KEY',    label: 'PRIVKEY', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
    { type: 'API_KEY',        label: 'APIKEY',  re: /\bAKIA[0-9A-Z]{16}\b/g },
    { type: 'API_KEY',        label: 'APIKEY',  re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}/g },
    { type: 'API_KEY',        label: 'APIKEY',  re: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g },
    { type: 'EMAIL_ADDRESS',  label: 'EMAIL',   re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
    { type: 'CREDIT_CARD',    label: 'CARD',    re: /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g },
    { type: 'IBAN',           label: 'IBAN',    re: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,7}[A-Z0-9]{0,4}\b/g },
    { type: 'GENERIC_SECRET', label: 'SECRET',  re: /\b(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi },
    { type: 'IP_ADDRESS',     label: 'IP',      re: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g },
    { type: 'PHONE_NUMBER',   label: 'PHONE',   re: /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g },
    { type: 'CIN_TN',         label: 'CIN',     re: /\b(?:CIN|N°\s?CIN)\s*[:\-]?\s*(\d{8})\b/gi },
    { type: 'MF_TN',          label: 'MF',      re: /\b\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/g },
  ];

  interface DetectResult { found: boolean; items: Array<{ type: string; label: string; value: string; preview: string }> }

  function detectPII(text: string): DetectResult {
    const matches: PiiMatch[] = [];
    for (const p of PATTERNS) {
      // CRITICAL: always reset lastIndex before use — prevents accumulation bug
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(text)) !== null) {
        const v = m[1] ?? m[0];
        if (v.length === 0) { p.re.lastIndex++; continue; } // guard zero-length
        matches.push({ type: p.type, label: p.label, value: v, start: m.index, end: m.index + v.length });
      }
      p.re.lastIndex = 0; // reset after use too
    }
    if (matches.length === 0) return { found: false, items: [] };

    const kept: PiiMatch[] = [];
    const sorted = [...matches].sort((a, b) => a.start - b.start);
    for (const c of sorted) {
      if (!kept.some(k => c.start < k.end && c.end > k.start)) kept.push(c);
    }

    return {
      found: true,
      items: kept.map(k => ({
        type: k.type, label: k.label, value: k.value,
        preview: k.value.length > 10 ? k.value.slice(0, 4) + '***' + k.value.slice(-3) : '***',
      })),
    };
  }

  function cageBody(text: string, items: Array<{ value: string; label: string }>): string {
    let result = text;
    let counter = 1;
    for (const item of [...items].sort((a, b) => b.value.length - a.value.length)) {
      const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const placeholder = `[CAGED_${item.label}_${counter}]`;
      result = result.replace(new RegExp(escaped, 'g'), placeholder);
      counter++;
    }
    return result;
  }

  function restoreBody(text: string, items: Array<{ value: string; label: string }>): string {
    let result = text;
    let counter = 1;
    for (const item of [...items].sort((a, b) => b.value.length - a.value.length)) {
      const placeholder = `[CAGED_${item.label}_${counter}]`;
      const escaped = placeholder.replace(/[[\]_]/g, '\\$&');
      result = result.replace(new RegExp(escaped.replace(/\\/g, '\\\\'), 'g'), item.value);
      counter++;
    }
    return result;
  }

  // ── AI endpoint detection ────────────────────────────────────────────────
  // IMPORTANT: This list must cover ALL AI chat platforms, not just the obvious ones.
  // When isAI(url) returns false, the request bypasses the cage entirely.
  // Rule: if in doubt, ADD the pattern — false positives just add a tiny check.

  const AI_PATTERNS = [
    // ── OpenAI / ChatGPT ──────────────────────────────────────────────────
    /api\.openai\.com/,
    /chatgpt\.com\/backend-api/,
    /chat\.openai\.com\/backend-api/,

    // ── Anthropic / Claude ────────────────────────────────────────────────
    /api\.anthropic\.com/,
    /claude\.ai\/api/,
    /claude\.ai\/chat/,

    // ── Google ────────────────────────────────────────────────────────────
    /generativelanguage\.googleapis\.com/,
    /gemini\.google\.com/,
    /bard\.google\.com/,
    /aistudio\.google\.com/,

    // ── Meta AI ───────────────────────────────────────────────────────────
    /meta\.ai/,
    /www\.meta\.ai/,
    /ai\.meta\.com/,
    /graph\.facebook\.com\/.*\/ai/,   // Meta AI via Facebook Graph
    /\/api\/chat.*meta/,

    // ── Microsoft Copilot / Bing ──────────────────────────────────────────
    /copilot\.microsoft\.com/,
    /bing\.com\/chat/,
    /sydney\.bing\.com/,
    /\/api\/copilot/,
    /api\.bing\.com/,

    // ── DeepSeek ──────────────────────────────────────────────────────────
    /chat\.deepseek\.com/,
    /api\.deepseek\.com/,

    // ── Mistral ───────────────────────────────────────────────────────────
    /api\.mistral\.ai/,
    /chat\.mistral\.ai/,
    /mistral\.ai\/api/,

    // ── Groq ──────────────────────────────────────────────────────────────
    /api\.groq\.com/,

    // ── Perplexity ────────────────────────────────────────────────────────
    /api\.perplexity\.ai/,
    /perplexity\.ai\/api/,
    /www\.perplexity\.ai\/api/,

    // ── Grok / xAI ───────────────────────────────────────────────────────
    /grok\.x\.ai/,
    /api\.x\.ai/,
    /grok\.com/,

    // ── Cohere ────────────────────────────────────────────────────────────
    /api\.cohere\.ai/,
    /api\.cohere\.com/,

    // ── OpenRouter (proxy for all models) ────────────────────────────────
    /openrouter\.ai/,

    // ── Poe (Quora) ───────────────────────────────────────────────────────
    /poe\.com\/api/,
    /poe\.com\/chat/,

    // ── You.com ───────────────────────────────────────────────────────────
    /you\.com\/api/,
    /you\.com\/search/,

    // ── Llama / Meta open models ──────────────────────────────────────────
    /llama\d*\.ai/,
    /api\.llama\.com/,

    // ── Hugging Face ──────────────────────────────────────────────────────
    /huggingface\.co\/api/,
    /api-inference\.huggingface\.co/,

    // ── Together AI ───────────────────────────────────────────────────────
    /api\.together\.ai/,
    /api\.together\.xyz/,

    // ── Replicate ─────────────────────────────────────────────────────────
    /api\.replicate\.com/,

    // ── Character.AI ─────────────────────────────────────────────────────
    /character\.ai\/api/,
    /neo\.character\.ai/,
    /chat\.character\.ai/,

    // ── Pi (Inflection) ───────────────────────────────────────────────────
    /pi\.ai\/api/,
    /inflection\.ai/,

    // ── Generic patterns — catch-all for unknown AI endpoints ─────────────
    // These match common API path conventions used by AI chat apps
    /\/api\/chat$/,
    /\/api\/chat\//,
    /\/api\/completions/,
    /\/api\/generate/,
    /\/chat\/completions/,
    /\/v1\/messages/,
    /\/v1\/chat/,
    /\/llm\//,
  ];

  function isAI(url: string): boolean { return AI_PATTERNS.some(p => p.test(url)); }

  // ── Decision gate ────────────────────────────────────────────────────────

  /**
   * Pending request waiting for user decision.
   * resolve(body) → proceed with this body
   * reject() → abort the request
   */
  type GateResolve = (body: string) => void;
  const pendingGates = new Map<string, GateResolve>();
  let gateCounter = 0;

  function waitForDecision(
    detectedItems: Array<{ type: string; label: string; value: string; preview: string }>,
    originalBody: string,
  ): Promise<string> {
    return new Promise<string>((resolve) => {
      const gateId = `gate_${++gateCounter}`;

      // Notify content.ts: PII detected, waiting for decision
      window.postMessage({
        type: 'AI_CAGE_PII_DETECTED',
        gateId,
        items: detectedItems,
        count: detectedItems.length,
      }, '*');

      pendingGates.set(gateId, resolve);

      // Safety timeout: if no decision in 30s → pass uncaged
      setTimeout(() => {
        if (pendingGates.has(gateId)) {
          pendingGates.delete(gateId);
          resolve(originalBody); // timeout → pass
        }
      }, 30000);
    });
  }

  // Listen for decisions from content.ts
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data as { type?: string; gateId?: string; mode?: 'cage' | 'pass'; items?: Array<{ value: string; label: string }> };

    if (d?.type !== 'AI_CAGE_PROCEED') return;
    if (!d.gateId) return;

    // Find gate — check exact match
    const resolve = pendingGates.get(d.gateId);
    if (!resolve) return; // gate already resolved or unknown

    pendingGates.delete(d.gateId); // remove FIRST to prevent double-fire

    if (d.mode === 'cage') {
      resolve('__CAGE__');
    } else {
      // mode === 'pass' OR anything else → always release the request as-is
      resolve('__PASS__');
    }
  });

  // ── Process JSON body ────────────────────────────────────────────────────

  function scanJSON(obj: unknown, items: Array<{ type: string; label: string; value: string; preview: string }>): unknown {
    if (typeof obj === 'string') {
      const r = detectPII(obj);
      r.items.forEach(i => { if (!items.some(x => x.value === i.value)) items.push(i); });
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(v => scanJSON(v, items));
    if (obj && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = scanJSON(v, items);
      return out;
    }
    return obj;
  }

  function applyPageCage(obj: unknown, items: Array<{ type: string; label: string; value: string; preview: string }>): unknown {
    if (typeof obj === 'string') return cageBody(obj, items);
    if (Array.isArray(obj)) return obj.map(v => applyPageCage(v, items));
    if (obj && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = applyPageCage(v, items);
      return out;
    }
    return obj;
  }

  async function processRequestBody(bodyStr: string): Promise<string> {
    const detectedItems: Array<{ type: string; label: string; value: string; preview: string }> = [];

    try {
      const parsed = JSON.parse(bodyStr);
      scanJSON(parsed, detectedItems);
    } catch {
      const r = detectPII(bodyStr);
      detectedItems.push(...r.items);
    }

    if (detectedItems.length === 0) return bodyStr;

    // Wait for user decision
    const decision = await waitForDecision(detectedItems, bodyStr);

    if (decision === '__PASS__') return bodyStr;
    if (decision === '__CAGE__') {
      try {
        const parsed = JSON.parse(bodyStr);
        return JSON.stringify(applyPageCage(parsed, detectedItems));
      } catch {
        return cageBody(bodyStr, detectedItems);
      }
    }
    return bodyStr;
  }

  // ── Per-tab entity store (isolated in closure) ───────────────────────────
  // FIX: Each tab has its own store — no cross-tab leakage
  const tabEntityStore: Array<{ value: string; label: string }> = [];

  // Listen for entity sharing from content.ts (for response restoration)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data as { type?: string; entities?: Array<{ placeholder: string; originalValue: string }> };
    if (d?.type === 'AI_CAGE_ENTITIES' && d.entities) {
      // Map to label-based store for restoring
      d.entities.forEach(e => {
        const match = /\[CAGED_(\w+)_\d+\]/.exec(e.placeholder);
        if (match) tabEntityStore.push({ value: e.originalValue, label: match[1] });
      });
    }
  });

  function processResponseText(text: string): string {
    if (!text.includes('[CAGED_') || tabEntityStore.length === 0) return text;
    let result = text;
    tabEntityStore.forEach((e, idx) => {
      const placeholder = `[CAGED_${e.label}_${idx + 1}]`;
      const escaped = placeholder.replace(/[[\]_]/g, '\\$&');
      result = result.replace(new RegExp(escaped.replace(/\\/g, '\\\\'), 'g'), e.value);
    });
    if (result !== text) window.postMessage({ type: 'AI_CAGE_NETWORK_RESTORED' }, '*');
    return result;
  }

  // ── Wrap fetch ───────────────────────────────────────────────────────────

  const _fetch = window.fetch.bind(window);

  (window as { fetch: typeof window.fetch }).fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    if (!isAI(url)) return _fetch(input, init);

    let body = init?.body;

    // P0-9: Detect file/FormData uploads — warn content.ts, don't silently pass
    if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
      window.postMessage({ type: 'AI_CAGE_FILE_UPLOAD_WARNING', url }, '*');
      // Do NOT cage — we can't scan binary/FormData reliably; warn and pass through
      return _fetch(input, init);
    }

    if (typeof body === 'string' && body.length > 2) {
      body = await processRequestBody(body);
    }

    const newInit = body !== init?.body ? { ...init, body } : init;
    const response = await _fetch(input, newInit);

    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('text/event-stream')) {
      if (!response.body) return response;
      const reader = response.body.getReader();
      const dec = new TextDecoder(), enc = new TextEncoder();
      const stream = new ReadableStream({
        async pull(ctrl) {
          const { done, value } = await reader.read();
          if (done) { ctrl.close(); return; }
          ctrl.enqueue(enc.encode(processResponseText(dec.decode(value, { stream: true }))));
        },
      });
      return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
    }

    const text = await response.text();
    return new Response(processResponseText(text), { status: response.status, statusText: response.statusText, headers: response.headers });
  };

  // ── Wrap XHR ─────────────────────────────────────────────────────────────

  const _XHR = window.XMLHttpRequest;
  function PatchedXHR(this: XMLHttpRequest) {
    const xhr = new _XHR();
    let _url = '';
    const _open = xhr.open.bind(xhr);
    (xhr as { open: typeof xhr.open }).open = function (m: string, u: string | URL, a = true, us?: string | null, pw?: string | null) {
      _url = String(u); return _open(m, u, a, us, pw);
    };
    const _send = xhr.send.bind(xhr);
    (xhr as { send: typeof xhr.send }).send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (isAI(_url)) {
        // P0-9: Detect FormData/Blob uploads via XHR — warn, don't silently pass
        if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
          window.postMessage({ type: 'AI_CAGE_FILE_UPLOAD_WARNING', url: _url }, '*');
          _send(body);
          return;
        }
        if (typeof body === 'string' && body.length > 2) {
          processRequestBody(body).then(processed => _send(processed));
          return;
        }
      }
      _send(body);
    };
    return xhr;
  }
  PatchedXHR.prototype = _XHR.prototype;
  (window as { XMLHttpRequest: unknown }).XMLHttpRequest = PatchedXHR;

  console.warn('[AI CAGE] 🔒 Gate interceptor active — waiting for user decisions on this tab');

})(window);
