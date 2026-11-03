/**
 * @file injected.ts
 * AI CAGE — Page-Context Network Gate v0.4.5
 *
 * ARCHITECTURE FIX:
 *
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
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(text)) !== null) {
        const v = m[1] ?? m[0];
        matches.push({ type: p.type, label: p.label, value: v, start: m.index, end: m.index + v.length });
        if (m[0].length === 0) p.re.lastIndex++;
      }
      p.re.lastIndex = 0;
    }
    if (matches.length === 0) return { found: false, items: [] };

    // Deduplicate overlaps (keep first found)
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

  const AI_PATTERNS = [
    /api\.openai\.com/, /chatgpt\.com\/backend-api/, /chat\.openai\.com\/backend-api/,
    /api\.anthropic\.com/, /claude\.ai\/api/,
    /generativelanguage\.googleapis\.com/, /gemini\.google\.com/,
    /api\.mistral\.ai/, /api\.groq\.com/, /api\.perplexity\.ai/,
    /api\.cohere\.ai/, /openrouter\.ai/, /poe\.com\/api/,
    /you\.com\/api/, /chat\.deepseek\.com/,
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

    if (d?.type === 'AI_CAGE_PROCEED' && d.gateId && pendingGates.has(d.gateId)) {
      const resolve = pendingGates.get(d.gateId)!;
      pendingGates.delete(d.gateId);

      // content.ts sends back the items it decided to cage
      if (d.mode === 'cage' && d.items && d.items.length > 0) {
        resolve('__CAGE__'); // signal to cage
      } else {
        resolve('__PASS__'); // signal to pass
      }
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
      if (isAI(_url) && typeof body === 'string' && body.length > 2) {
        processRequestBody(body).then(processed => _send(processed));
        return;
      }
      _send(body);
    };
    return xhr;
  }
  PatchedXHR.prototype = _XHR.prototype;
  (window as { XMLHttpRequest: unknown }).XMLHttpRequest = PatchedXHR;

  console.warn('[AI CAGE] 🔒 Gate interceptor active — waiting for user decisions on this tab');

})(window);
