(function() {
  "use strict";
  (function(window2) {
    if (window2.__AI_CAGE_ACTIVE__) return;
    window2.__AI_CAGE_ACTIVE__ = true;
    const PATTERNS = [
      { type: "PRIVATE_KEY", label: "PRIVKEY", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
      { type: "API_KEY", label: "APIKEY", re: /\bAKIA[0-9A-Z]{16}\b/g },
      { type: "API_KEY", label: "APIKEY", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}/g },
      { type: "API_KEY", label: "APIKEY", re: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g },
      { type: "EMAIL_ADDRESS", label: "EMAIL", re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
      { type: "CREDIT_CARD", label: "CARD", re: /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g },
      { type: "IBAN", label: "IBAN", re: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,7}[A-Z0-9]{0,4}\b/g },
      { type: "GENERIC_SECRET", label: "SECRET", re: /\b(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi },
      { type: "IP_ADDRESS", label: "IP", re: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g },
      { type: "PHONE_NUMBER", label: "PHONE", re: /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g },
      { type: "CIN_TN", label: "CIN", re: /\b(?:CIN|N°\s?CIN)\s*[:\-]?\s*(\d{8})\b/gi },
      { type: "MF_TN", label: "MF", re: /\b\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/g }
    ];
    function detectPII(text) {
      const matches = [];
      for (const p of PATTERNS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(text)) !== null) {
          const v = m[1] ?? m[0];
          if (v.length === 0) {
            p.re.lastIndex++;
            continue;
          }
          matches.push({ type: p.type, label: p.label, value: v, start: m.index, end: m.index + v.length });
        }
        p.re.lastIndex = 0;
      }
      if (matches.length === 0) return { found: false, items: [] };
      const kept = [];
      const sorted = [...matches].sort((a, b) => a.start - b.start);
      for (const c of sorted) {
        if (!kept.some((k) => c.start < k.end && c.end > k.start)) kept.push(c);
      }
      return {
        found: true,
        items: kept.map((k) => ({
          type: k.type,
          label: k.label,
          value: k.value,
          preview: k.value.length > 10 ? k.value.slice(0, 4) + "***" + k.value.slice(-3) : "***"
        }))
      };
    }
    function cageBody(text, items) {
      let result = text;
      let counter = 1;
      for (const item of [...items].sort((a, b) => b.value.length - a.value.length)) {
        const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const placeholder = `[CAGED_${item.label}_${counter}]`;
        result = result.replace(new RegExp(escaped, "g"), placeholder);
        counter++;
      }
      return result;
    }
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
      /chat\.deepseek\.com/
    ];
    function isAI(url) {
      return AI_PATTERNS.some((p) => p.test(url));
    }
    const pendingGates = /* @__PURE__ */ new Map();
    let gateCounter = 0;
    function waitForDecision(detectedItems, originalBody) {
      return new Promise((resolve) => {
        const gateId = `gate_${++gateCounter}`;
        window2.postMessage({
          type: "AI_CAGE_PII_DETECTED",
          gateId,
          items: detectedItems,
          count: detectedItems.length
        }, "*");
        pendingGates.set(gateId, resolve);
        setTimeout(() => {
          if (pendingGates.has(gateId)) {
            pendingGates.delete(gateId);
            resolve(originalBody);
          }
        }, 3e4);
      });
    }
    window2.addEventListener("message", (event) => {
      if (event.source !== window2) return;
      const d = event.data;
      if ((d == null ? void 0 : d.type) !== "AI_CAGE_PROCEED") return;
      if (!d.gateId) return;
      const resolve = pendingGates.get(d.gateId);
      if (!resolve) return;
      pendingGates.delete(d.gateId);
      if (d.mode === "cage") {
        resolve("__CAGE__");
      } else {
        resolve("__PASS__");
      }
    });
    function scanJSON(obj, items) {
      if (typeof obj === "string") {
        const r = detectPII(obj);
        r.items.forEach((i) => {
          if (!items.some((x) => x.value === i.value)) items.push(i);
        });
        return obj;
      }
      if (Array.isArray(obj)) return obj.map((v) => scanJSON(v, items));
      if (obj && typeof obj === "object") {
        const out = {};
        for (const [k, v] of Object.entries(obj)) out[k] = scanJSON(v, items);
        return out;
      }
      return obj;
    }
    function applyPageCage(obj, items) {
      if (typeof obj === "string") return cageBody(obj, items);
      if (Array.isArray(obj)) return obj.map((v) => applyPageCage(v, items));
      if (obj && typeof obj === "object") {
        const out = {};
        for (const [k, v] of Object.entries(obj)) out[k] = applyPageCage(v, items);
        return out;
      }
      return obj;
    }
    async function processRequestBody(bodyStr) {
      const detectedItems = [];
      try {
        const parsed = JSON.parse(bodyStr);
        scanJSON(parsed, detectedItems);
      } catch {
        const r = detectPII(bodyStr);
        detectedItems.push(...r.items);
      }
      if (detectedItems.length === 0) return bodyStr;
      const decision = await waitForDecision(detectedItems, bodyStr);
      if (decision === "__PASS__") return bodyStr;
      if (decision === "__CAGE__") {
        try {
          const parsed = JSON.parse(bodyStr);
          return JSON.stringify(applyPageCage(parsed, detectedItems));
        } catch {
          return cageBody(bodyStr, detectedItems);
        }
      }
      return bodyStr;
    }
    const tabEntityStore = [];
    window2.addEventListener("message", (event) => {
      if (event.source !== window2) return;
      const d = event.data;
      if ((d == null ? void 0 : d.type) === "AI_CAGE_ENTITIES" && d.entities) {
        d.entities.forEach((e) => {
          const match = /\[CAGED_(\w+)_\d+\]/.exec(e.placeholder);
          if (match) tabEntityStore.push({ value: e.originalValue, label: match[1] });
        });
      }
    });
    function processResponseText(text) {
      if (!text.includes("[CAGED_") || tabEntityStore.length === 0) return text;
      let result = text;
      tabEntityStore.forEach((e, idx) => {
        const placeholder = `[CAGED_${e.label}_${idx + 1}]`;
        const escaped = placeholder.replace(/[[\]_]/g, "\\$&");
        result = result.replace(new RegExp(escaped.replace(/\\/g, "\\\\"), "g"), e.value);
      });
      if (result !== text) window2.postMessage({ type: "AI_CAGE_NETWORK_RESTORED" }, "*");
      return result;
    }
    const _fetch = window2.fetch.bind(window2);
    window2.fetch = async function(input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!isAI(url)) return _fetch(input, init);
      let body = init == null ? void 0 : init.body;
      if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
        window2.postMessage({ type: "AI_CAGE_FILE_UPLOAD_WARNING", url }, "*");
        return _fetch(input, init);
      }
      if (typeof body === "string" && body.length > 2) {
        body = await processRequestBody(body);
      }
      const newInit = body !== (init == null ? void 0 : init.body) ? { ...init, body } : init;
      const response = await _fetch(input, newInit);
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("text/event-stream")) {
        if (!response.body) return response;
        const reader = response.body.getReader();
        const dec = new TextDecoder(), enc = new TextEncoder();
        const stream = new ReadableStream({
          async pull(ctrl) {
            const { done, value } = await reader.read();
            if (done) {
              ctrl.close();
              return;
            }
            ctrl.enqueue(enc.encode(processResponseText(dec.decode(value, { stream: true }))));
          }
        });
        return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      const text = await response.text();
      return new Response(processResponseText(text), { status: response.status, statusText: response.statusText, headers: response.headers });
    };
    const _XHR = window2.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new _XHR();
      let _url = "";
      const _open = xhr.open.bind(xhr);
      xhr.open = function(m, u, a = true, us, pw) {
        _url = String(u);
        return _open(m, u, a, us, pw);
      };
      const _send = xhr.send.bind(xhr);
      xhr.send = function(body) {
        if (isAI(_url)) {
          if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
            window2.postMessage({ type: "AI_CAGE_FILE_UPLOAD_WARNING", url: _url }, "*");
            _send(body);
            return;
          }
          if (typeof body === "string" && body.length > 2) {
            processRequestBody(body).then((processed) => _send(processed));
            return;
          }
        }
        _send(body);
      };
      return xhr;
    }
    PatchedXHR.prototype = _XHR.prototype;
    window2.XMLHttpRequest = PatchedXHR;
    console.warn("[AI CAGE] 🔒 Gate interceptor active — waiting for user decisions on this tab");
  })(window);
})();
