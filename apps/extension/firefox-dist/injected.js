(function() {
  "use strict";
  (function() {
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
      /openrouter\.ai\/api/
    ];
    function isAIRequest(url) {
      return AI_API_PATTERNS.some((p) => p.test(url));
    }
    let pendingEntities = [];
    window.addEventListener("message", (event) => {
      var _a;
      if (event.source !== window) return;
      if (((_a = event.data) == null ? void 0 : _a.type) === "AI_CAGE_ENTITIES") {
        pendingEntities = event.data.entities ?? [];
      }
    });
    function signalRestored() {
      window.postMessage({ type: "AI_CAGE_RESTORED" }, "*");
    }
    function processRequestBody(body) {
      if (body.includes("[CAGED_")) {
        return { body, wasCaged: true };
      }
      return { body, wasCaged: false };
    }
    function processResponseBody(body) {
      if (pendingEntities.length === 0) return body;
      if (!body.includes("[CAGED_")) return body;
      let result = body;
      for (const entity of pendingEntities) {
        const escaped = entity.placeholder.replace(/[[\]]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), entity.originalValue);
      }
      if (result !== body) {
        signalRestored();
      }
      return result;
    }
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!isAIRequest(url)) {
        return originalFetch(input, init);
      }
      let processedInit = init;
      if ((init == null ? void 0 : init.body) && typeof init.body === "string") {
        const { body } = processRequestBody(init.body);
        processedInit = { ...init, body };
      }
      const response = await originalFetch(input, processedInit);
      if (!response.body) return response;
      const contentType = response.headers.get("content-type") ?? "";
      const isStreaming = contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson") || contentType.includes("text/plain");
      if (!isStreaming) {
        const text = await response.text();
        const processed = processResponseBody(text);
        return new Response(processed, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
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
        }
      });
      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    };
    const OriginalXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OriginalXHR();
      let targetUrl = "";
      const originalOpen = xhr.open.bind(xhr);
      xhr.open = function(method, url, ...args) {
        targetUrl = url;
        return originalOpen(method, url, ...args);
      };
      const originalSend = xhr.send.bind(xhr);
      xhr.send = function(body) {
        if (isAIRequest(targetUrl) && typeof body === "string") {
          const { body: processed } = processRequestBody(body);
          return originalSend(processed);
        }
        return originalSend(body);
      };
      xhr.addEventListener("load", function() {
        if (!isAIRequest(targetUrl)) return;
      });
      return xhr;
    }
    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
    console.warn("[AI CAGE] 🔒 Page-context script active — fetch and XHR intercepted.");
  })();
})();
