/**
 * @file injected.ts
 * AI CAGE — Page-Context Network Interceptor v0.4.5
 *
 * ROOT FIX: PII detection happens DIRECTLY in this script at the network level.
 * NO dependency on postMessage timing. NO DOM manipulation.
 *
 * ARCHITECTURE:
 *   1. This script runs in the PAGE's JavaScript context (access to fetch/XHR)
 *   2. It contains its own self-contained PII detector (regex-based, no imports)
 *   3. It intercepts fetch() and XMLHttpRequest BEFORE the request is sent
 *   4. It cages PII in the request body directly
 *   5. It watches for [CAGED_X] tokens in the response and restores them
 *
 * WHY THIS WORKS:
 *   - Runs in page context = can wrap window.fetch before React uses it
 *   - Self-contained PII detection = no timing dependency on postMessage
 *   - Intercepts the actual HTTP body = React state doesn't matter
 *
 * SECURITY:
 *   - Zero external calls
 *   - Entity map lives only in closure memory
 *   - Communicates results to content script via postMessage (display only)
 */

(function (window) {
  'use strict';

  // Guard against double-injection
  if ((window as { __AI_CAGE_ACTIVE__?: boolean }).__AI_CAGE_ACTIVE__) return;
  (window as { __AI_CAGE_ACTIVE__?: boolean }).__AI_CAGE_ACTIVE__ = true;

  // ── Self-contained PII patterns (no external imports) ───────────────────
  // These must match the core package patterns exactly.

  interface PiiEntity {
    type: string;
    value: string;
    placeholder: string;
  }

  const PII_PATTERNS: Array<{ type: string; pattern: RegExp; label: string; score: number }> = [
    // Critical — high confidence
    { type: 'PRIVATE_KEY',    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,           label: 'PRIVKEY', score: 1.0 },
    { type: 'API_KEY',        pattern: /\bAKIA[0-9A-Z]{16}\b/g,                                              label: 'APIKEY',  score: 0.99 },
    { type: 'API_KEY',        pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}/g,          label: 'APIKEY',  score: 0.99 },
    { type: 'API_KEY',        pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g,                     label: 'APIKEY',  score: 0.99 },
    { type: 'EMAIL_ADDRESS',  pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,           label: 'EMAIL',   score: 0.95 },
    { type: 'CREDIT_CARD',    pattern: /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, label: 'CARD', score: 0.92 },
    { type: 'IBAN',           pattern: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,7}[A-Z0-9]{0,4}\b/g,  label: 'IBAN',    score: 0.90 },
    { type: 'GENERIC_SECRET', pattern: /\b(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi,        label: 'SECRET',  score: 0.85 },
    { type: 'GENERIC_SECRET', pattern: /\b(?:api[_-]?key|secret[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{20,}/gi, label: 'SECRET', score: 0.85 },
    { type: 'IP_ADDRESS',     pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, label: 'IP', score: 0.85 },
    { type: 'PHONE_NUMBER',   pattern: /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g,   label: 'PHONE',   score: 0.75 },
    // Tunisian specific
    { type: 'CIN_TN',         pattern: /\b(?:CIN|N°\s?CIN)\s*[:\-]?\s*(\d{8})\b/gi,                        label: 'CIN',     score: 0.85 },
    { type: 'MF_TN',          pattern: /\b\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/g,                             label: 'MF',      score: 0.92 },
  ];

  /**
   * Detects PII in text and returns array of entities with placeholders.
   * Handles overlapping matches by processing highest-confidence first.
   */
  function detectAndCage(text: string): { caged: string; entities: PiiEntity[] } {
    if (!text || text.length < 3) return { caged: text, entities: [] };

    interface RawMatch {
      type: string;
      label: string;
      value: string;
      start: number;
      end: number;
      score: number;
    }

    const raw: RawMatch[] = [];

    for (const det of PII_PATTERNS) {
      det.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = det.pattern.exec(text)) !== null) {
        const val = m[1] ?? m[0];
        const start = m.index + m[0].indexOf(val);
        raw.push({ type: det.type, label: det.label, value: val, start, end: start + val.length, score: det.score });
        if (m[0].length === 0) det.pattern.lastIndex++;
      }
      det.pattern.lastIndex = 0;
    }

    if (raw.length === 0) return { caged: text, entities: [] };

    // Sort by score desc then start asc, deduplicate overlaps
    const sorted = [...raw].sort((a, b) => b.score - a.score || a.start - b.start);
    const kept: RawMatch[] = [];
    for (const candidate of sorted) {
      if (!kept.some(k => candidate.start < k.end && candidate.end > k.start)) {
        kept.push(candidate);
      }
    }
    kept.sort((a, b) => a.start - b.start);

    const entities: PiiEntity[] = [];
    let counter = 1;
    let result = text;
    // Process in reverse so indices stay valid
    for (const match of [...kept].reverse()) {
      const placeholder = `[CAGED_${match.label}_${counter}]`;
      counter++;
      entities.unshift({ type: match.type, value: match.value, placeholder });
      result = result.slice(0, match.start) + placeholder + result.slice(match.end);
    }

    return { caged: result, entities };
  }

  /**
   * Restores original values from [CAGED_X] tokens.
   */
  function uncageText(text: string, entities: PiiEntity[]): string {
    let result = text;
    for (const e of entities) {
      const escaped = e.placeholder.replace(/[[\]_]/g, '\\$&');
      result = result.replace(new RegExp(escaped.replace(/\\/g, '\\\\'), 'g'), e.value);
    }
    return result;
  }

  // ── AI endpoint detection ────────────────────────────────────────────────

  const AI_PATTERNS = [
    /api\.openai\.com/,
    /chatgpt\.com\/backend-api/,
    /chat\.openai\.com\/backend-api/,
    /api\.anthropic\.com/,
    /claude\.ai\/api/,
    /generativelanguage\.googleapis\.com/,
    /gemini\.google\.com/,
    /api\.mistral\.ai/,
    /api\.groq\.com/,
    /api\.perplexity\.ai/,
    /api\.cohere\.ai/,
    /openrouter\.ai/,
    /poe\.com\/api/,
    /you\.com\/api/,
    /chat\.deepseek\.com/,
  ];

  function isAIEndpoint(url: string): boolean {
    return AI_PATTERNS.some(p => p.test(url));
  }

  // ── Entity store per tab/session ─────────────────────────────────────────
  const entityStore: PiiEntity[] = [];

  function notify(caged: number): void {
    window.postMessage({ type: 'AI_CAGE_NETWORK_CAGED', count: caged }, '*');
  }

  function notifyRestored(): void {
    window.postMessage({ type: 'AI_CAGE_NETWORK_RESTORED' }, '*');
  }

  // ── Process request body ─────────────────────────────────────────────────

  function processBody(bodyStr: string): { body: string; count: number } {
    try {
      // Try JSON parse — most AI APIs use JSON
      const parsed = JSON.parse(bodyStr) as Record<string, unknown>;
      let changed = false;
      let totalCaged = 0;

      // Deep scan all string values in the JSON for PII
      function scanObj(obj: unknown): unknown {
        if (typeof obj === 'string') {
          const { caged, entities } = detectAndCage(obj);
          if (entities.length > 0) {
            entities.forEach(e => entityStore.push(e));
            totalCaged += entities.length;
            changed = true;
            return caged;
          }
          return obj;
        }
        if (Array.isArray(obj)) return obj.map(scanObj);
        if (obj && typeof obj === 'object') {
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            result[k] = scanObj(v);
          }
          return result;
        }
        return obj;
      }

      const scanned = scanObj(parsed);
      if (!changed) return { body: bodyStr, count: 0 };

      if (totalCaged > 0) notify(totalCaged);
      return { body: JSON.stringify(scanned), count: totalCaged };

    } catch {
      // Not JSON — scan as plain text
      const { caged, entities } = detectAndCage(bodyStr);
      if (entities.length > 0) {
        entities.forEach(e => entityStore.push(e));
        notify(entities.length);
        return { body: caged, count: entities.length };
      }
      return { body: bodyStr, count: 0 };
    }
  }

  // ── Process response body ────────────────────────────────────────────────

  function processResponse(text: string): string {
    if (entityStore.length === 0) return text;
    if (!text.includes('[CAGED_')) return text;
    const restored = uncageText(text, entityStore);
    if (restored !== text) notifyRestored();
    return restored;
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

    if (!isAIEndpoint(url)) {
      return _fetch(input, init);
    }

    // Process outgoing body
    let newInit = init ? { ...init } : {};
    if (init?.body && typeof init.body === 'string' && init.body.length > 2) {
      const { body } = processBody(init.body);
      newInit = { ...newInit, body };
    }

    const response = await _fetch(input, newInit);

    // Process response
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      // Streaming SSE — pipe through transformer
      if (!response.body) return response;
      const reader = response.body.getReader();
      const dec = new TextDecoder();
      const enc = new TextEncoder();

      const stream = new ReadableStream({
        async pull(ctrl) {
          const { done, value } = await reader.read();
          if (done) { ctrl.close(); return; }
          const chunk = dec.decode(value, { stream: true });
          ctrl.enqueue(enc.encode(processResponse(chunk)));
        },
      });

      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Non-streaming
    const text = await response.text();
    return new Response(processResponse(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  // ── Wrap XMLHttpRequest ──────────────────────────────────────────────────

  const _XHR = window.XMLHttpRequest;

  function PatchedXHR(this: XMLHttpRequest) {
    const xhr = new _XHR();
    let _url = '';

    const _open = xhr.open.bind(xhr);
    (xhr as { open: typeof xhr.open }).open = function (
      method: string, url: string | URL, async = true,
      user?: string | null, password?: string | null,
    ) {
      _url = String(url);
      return _open(method, url, async, user, password);
    };

    const _send = xhr.send.bind(xhr);
    (xhr as { send: typeof xhr.send }).send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (isAIEndpoint(_url) && typeof body === 'string' && body.length > 2) {
        const { body: processed } = processBody(body);
        return _send(processed);
      }
      return _send(body);
    };

    return xhr;
  }

  PatchedXHR.prototype = _XHR.prototype;
  (window as { XMLHttpRequest: unknown }).XMLHttpRequest = PatchedXHR;

  console.warn('[AI CAGE] 🔒 Network interceptor active — fetch/XHR patched with inline PII detection');

})(window);
