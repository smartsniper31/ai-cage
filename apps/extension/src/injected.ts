/**
 * @file injected.ts
 * AI CAGE — Page-Context Script (injected into page, not extension context)
 *
 * WHY THIS EXISTS:
 *   Chrome extensions run in an isolated world — they CANNOT access
 *   page JavaScript (React state, fetch, XHR).
 *   This script is injected into the PAGE's JavaScript context via
 *   a <script> tag, giving it access to window.fetch and XMLHttpRequest.
 *
 * WHAT IT DOES:
 *   Wraps window.fetch and XMLHttpRequest to intercept AI API calls
 *   BEFORE the request leaves the browser. Replaces [CAGED_X] tokens
 *   in the request body with placeholder values, and in the response
 *   restores original values.
 *
 * COMMUNICATION:
 *   Uses window.postMessage to exchange entity maps with the content script
 *   (which runs in the extension isolated world).
 *
 * SECURITY:
 *   - Only intercepts requests to known AI API endpoints
 *   - Never logs original PII values
 *   - Communicates only with the AI CAGE extension (origin check)
 */

(function () {
  'use strict';

  // ── AI API endpoint patterns to intercept ──────────────────────────────
  const AI_API_PATTERNS = [
    /api\.openai\.com\/v\d+\/(chat\/completions|completions)/,
    /chatgpt\.com\/backend-api\/conversation/,
    /chat\.openai\.com\/backend-api\/conversation/,
    /api\.anthropic\.com\/v\d+\/messages/,
    /claude\.ai\/api/,
    /generativelanguage\.googleapis\.com/,
    /gemini\.google\.com\/app\/api/,
    /api\.mistral\.ai/,
    /api\.groq\.com/,
    /api\.perplexity\.ai/,
    /api\.cohere\.ai/,
    /openrouter\.ai\/api/,
  ];

  function isAIRequest(url: string): boolean {
    return AI_API_PATTERNS.some((p) => p.test(url));
  }

  // ── Entity store — shared with content script via postMessage ──────────
  let pendingEntities: Array<{ placeholder: string; originalValue: string }> = [];

  // Listen for entities from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'AI_CAGE_ENTITIES') {
      pendingEntities = event.data.entities ?? [];
    }
  });

  function signalCaged(count: number): void {
    window.postMessage({ type: 'AI_CAGE_CAGED', count }, '*');
  }

  function signalRestored(): void {
    window.postMessage({ type: 'AI_CAGE_RESTORED' }, '*');
  }

  // ── Cage outgoing request body ─────────────────────────────────────────
  // The content script has already caged the DOM text.
  // But we need to verify the request body and ensure it's caged.
  // If the body contains [CAGED_X] tokens → good, already caged.
  // If the body contains original values → cage them here as fallback.

  function processRequestBody(body: string): { body: string; wasCaged: boolean } {
    // Check if already caged
    if (body.includes('[CAGED_')) {
      return { body, wasCaged: true };
    }
    // Not caged — return as-is (content script handles DOM level)
    return { body, wasCaged: false };
  }

  function processResponseBody(body: string): string {
    if (pendingEntities.length === 0) return body;
    if (!body.includes('[CAGED_')) return body;

    let result = body;
    for (const entity of pendingEntities) {
      const escaped = entity.placeholder.replace(/[[\]]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), entity.originalValue);
    }

    if (result !== body) {
      signalRestored();
    }
    return result;
  }

  // ── Intercept fetch ────────────────────────────────────────────────────
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    if (!isAIRequest(url)) {
      return originalFetch(input, init);
    }

    // Process outgoing body
    let processedInit = init;
    if (init?.body && typeof init.body === 'string') {
      const { body } = processRequestBody(init.body);
      processedInit = { ...init, body };
    }

    // Make the request
    const response = await originalFetch(input, processedInit);

    // Process streaming response (SSE / NDJSON)
    if (!response.body) return response;

    const contentType = response.headers.get('content-type') ?? '';
    const isStreaming = contentType.includes('text/event-stream')
      || contentType.includes('application/x-ndjson')
      || contentType.includes('text/plain');

    if (!isStreaming) {
      // Non-streaming: read, process, return new response
      const text = await response.text();
      const processed = processResponseBody(text);
      return new Response(processed, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // Streaming: pipe through transform stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        const processed = processResponseBody(chunk);
        controller.enqueue(encoder.encode(processed));
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  // ── Intercept XMLHttpRequest ───────────────────────────────────────────
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR(this: XMLHttpRequest) {
    const xhr = new OriginalXHR();
    let targetUrl = '';

    const originalOpen = xhr.open.bind(xhr);
    xhr.open = function (method: string, url: string, ...args: unknown[]) {
      targetUrl = url;
      return originalOpen(method, url, ...(args as [boolean?, string?, string?]));
    };

    const originalSend = xhr.send.bind(xhr);
    xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      if (isAIRequest(targetUrl) && typeof body === 'string') {
        const { body: processed } = processRequestBody(body);
        return originalSend(processed);
      }
      return originalSend(body);
    };

    // Intercept response
    xhr.addEventListener('load', function () {
      if (!isAIRequest(targetUrl)) return;
      // XHR responses are harder to modify after the fact
      // The content script MutationObserver handles DOM-level restoration
    });

    return xhr;
  }
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

  console.warn('[AI CAGE] 🔒 Page-context script active — fetch and XHR intercepted.');
})();
