(function() {
  "use strict";
  const emailDetector = {
    name: "Email Address",
    type: "EMAIL_ADDRESS",
    patterns: [
      /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
    ],
    defaultScore: 0.95
  };
  const phoneDetector = {
    name: "Phone Number",
    type: "PHONE_NUMBER",
    patterns: [
      /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g,
      /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g
    ],
    defaultScore: 0.75
  };
  const ibanDetector = {
    name: "IBAN",
    type: "IBAN",
    patterns: [
      /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,7}[A-Z0-9]{0,4}\b/g
    ],
    defaultScore: 0.9
  };
  const ribTnDetector = {
    name: "Tunisian RIB",
    type: "RIB_TN",
    patterns: [
      /\b\d{20}\b/g,
      /\b\d{2}[\s]\d{3}[\s]\d{13}[\s]\d{2}\b/g
    ],
    defaultScore: 0.8
  };
  const cinTnDetector = {
    name: "Tunisian CIN",
    type: "CIN_TN",
    patterns: [
      /\b(?:CIN|N°\s?CIN|Carte\s+Identit[ée])\s*[:\-]?\s*(\d{8})\b/gi,
      /\b\d{8}\b/g
    ],
    defaultScore: 0.65
  };
  const creditCardDetector = {
    name: "Credit Card",
    type: "CREDIT_CARD",
    patterns: [
      /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2}|6(?:011|5\d{2}))[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
      /\b3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5}\b/g
    ],
    defaultScore: 0.9
  };
  const apiKeyDetector = {
    name: "API Key / Secret",
    type: "API_KEY",
    patterns: [
      /\bAKIA[0-9A-Z]{16}\b/g,
      /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,255}\b/g,
      /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
      /\b(?:api[_\-]?key|secret[_\-]?key|access[_\-]?token)\s*[=:]\s*["']?[A-Za-z0-9\-_.+/]{20,}["']?/gi,
      /Bearer\s+[A-Za-z0-9\-_.+/=]{20,}/g
    ],
    defaultScore: 0.88
  };
  const privateKeyDetector = {
    name: "Private Key",
    type: "PRIVATE_KEY",
    patterns: [
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g
    ],
    defaultScore: 1
  };
  const ipDetector = {
    name: "IP Address",
    type: "IP_ADDRESS",
    patterns: [
      /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
      /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
      /\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b/g
    ],
    defaultScore: 0.85
  };
  const genericSecretDetector = {
    name: "Generic Secret",
    type: "GENERIC_SECRET",
    patterns: [
      /\b(?:password|passwd|pwd|mot[_\-]?de[_\-]?passe)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi,
      /\b(?:token|secret|credential)\s*[=:]\s*["']?[A-Za-z0-9\-_.+/]{16,}["']?/gi
    ],
    defaultScore: 0.82
  };
  const passportDetector = {
    name: "Passport Number",
    type: "PASSPORT",
    patterns: [
      /\b[A-Z]{1,2}\d{6,9}\b/g,
      /\b\d{2}[A-Z]{2}\d{5}\b/g
    ],
    defaultScore: 0.7
  };
  const mfTnDetector = {
    name: "Tunisian Matricule Fiscal",
    type: "MF_TN",
    patterns: [
      // Standard format with slashes
      /\b\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/g,
      // With label
      /\b(?:MF|Matricule\s+Fiscal)\s*[:\-]?\s*\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/gi,
      // Compact without label (lower confidence)
      /\b\d{7}[A-Z]{3}\d{3}\b/g
    ],
    defaultScore: 0.92
  };
  const passportTnDetector = {
    name: "Tunisian Passport",
    type: "PASSPORT_TN",
    patterns: [
      // Preceded by passport label
      /\b(?:Passeport|Passport\s+N°?|N°?\s*Passeport)\s*[:\-]?\s*([A-Z]\d{7})\b/gi,
      // Standalone (exact: 1 uppercase + 7 digits)
      /\b[A-Z]\d{7}\b/g
    ],
    defaultScore: 0.78
  };
  const carteSejourDetector = {
    name: "Carte de Séjour / Titre de Séjour",
    type: "CARTE_SEJOUR",
    patterns: [
      // Preceded by label
      /\b(?:titre\s+de\s+s[eé]jour|carte\s+de\s+s[eé]jour|r[eé]c[eé]piss[eé])\s*[:\-]?\s*([A-Z0-9\s\-]{6,20})\b/gi,
      // French format: dept (2 digits) + 6 digits + optional 2-digit suffix
      /\b\d{2}[\s\-]?\d{6}[\s\-]?\d{2}\b/g
    ],
    defaultScore: 0.72
  };
  const personNameDetector = {
    name: "Person Name",
    type: "PERSON_NAME",
    patterns: [
      // ── High-confidence: explicit label ──────────────────────────────────
      // "Nom: Ahmed Ben Ali" / "Name: Marie Dupont"
      /\b(?:Nom\s+(?:et\s+Pr[eé]nom|Complet)|Full\s+Name|Name|Pr[eé]nom\s+(?:et\s+Nom)?)\s*[:\-]\s*([A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+(?:\s+[A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+){1,3})/gi,
      // ── Arabic-origin Tunisian names ──────────────────────────────────────
      // Matches: Mohamed Ben Ali, Ahmed El Amri, Fatma Bel Hadj, etc.
      // First-name list covers top 50 Tunisian first names (male + female).
      /\b(?:Mohamed?|Mohamad|Muhamed?|Ahmad?|Ahmed?|Ali|Omar|Youssef|Yousef|Khaled|Khalid|Sami|Samir|Rami|Tarek|Tariq|Imed|Wissem|Wassim|Karim|Slim|Hamza|Walid|Fethi|Nabil|Hedi|Lotfi|Mounir|Hatem|Aymen|Bilel|Amine|Hichem|Sofien|Ramzi|Bassem|Maher|Faouzi|Adel|Zied|Chokri|Anis|Riyadh|Mondher|Riadh|Fatma|Ines|Sonia|Emna|Rim|Nour|Olfa|Mariem|Amira|Hela|Wafa|Asma|Manel|Rania|Sirine|Imen|Najet|Lobna|Sabrina|Salma|Yosra)\s+(?:Ben|Bel|El|Al|Ould|Bent|Bint|Bou|Bou\s*|Hadj)\s+[A-ZÀ-Ÿa-zà-ÿ]{2,20}/g,
      // ── French / European name pairs ──────────────────────────────────────
      // Two or three title-cased words; requires lower-case continuation
      // to exclude acronyms (e.g. "HTTP Request" won't match because "Request"
      // is a common English word — but we keep score low for this pattern).
      /\b(?!(?:The|A|An|In|On|At|By|For|From|With|This|That|These|Those|It|Is|Are|Was|Were|Has|Have|Had|Be|Been|Being|Do|Does|Did|Will|Would|Could|Should|May|Might|Must|Shall|Can|Need|Dare|Used|Ought)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}\s+(?!(?:API|URL|HTTP|SQL|JSON|XML|CSS|HTML|PDF|CSV|AI|ML|UI|UX|ID|DB)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]{2,20})?\b/g
    ],
    defaultScore: 0.58
  };
  const transcriptMarkerDetector = {
    name: "Meeting Transcript Marker",
    type: "MEETING_TRANSCRIPT_MARKER",
    patterns: [
      // Timestamp line markers: [00:15:32] or (00:15:32) or 00:15:32
      /\b\d{1,2}:\d{2}(?::\d{2})?\b\s*[-–—:]\s*/g,
      // Speaker labels: "John:", "Speaker 1:", "Participant 3:"
      /\b[A-ZÀ-Ÿ][a-zà-ÿ]+:\s/g,
      /\bSpeaker\s+\d+:\s/gi,
      /\bParticipant\s+\d+:\s/gi,
      // Transcript metadata headers
      /\b(?:Transcript|Meeting\s+(?:Notes?|Summary|Record)|Minutes)\s*(?:of|from|for|—|-)?\s/gi,
      /\bAttendees?\s*[:=]\s/gi,
      /\bDate\s*[:=]\s/gi,
      // AI transcription service watermarks
      /\b(?:Generated\s+by|Transcribed\s+by|Powered\s+by)\s+(?:Otter|Fireflies|Read\.ai|tl;dv|Fathom|Rev|Sonix|Descript)/gi
    ],
    defaultScore: 0.82
  };
  const meetingParticipantDetector = {
    name: "Meeting Participant",
    type: "MEETING_PARTICIPANT",
    patterns: [
      // "John Smith: Hello everyone" — name followed by colon and speech
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\s*:\s+(?=[A-ZÀ-Ÿa-zà-ÿ])/g,
      // "John said:", "John asked:", "John replied:"
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\s+(?:said|asked|replied|noted|added|stated):\s/gi
    ],
    defaultScore: 0.68
  };
  const ALL_DETECTORS = [
    privateKeyDetector,
    // 1.00
    mfTnDetector,
    // 0.92
    emailDetector,
    // 0.95
    creditCardDetector,
    // 0.90
    ibanDetector,
    // 0.90
    apiKeyDetector,
    // 0.88
    genericSecretDetector,
    // 0.82
    transcriptMarkerDetector,
    // 0.82 — Cage 5
    ipDetector,
    // 0.85
    ribTnDetector,
    // 0.80
    passportTnDetector,
    // 0.78
    phoneDetector,
    // 0.75
    meetingParticipantDetector,
    // 0.68 — Cage 5
    carteSejourDetector,
    // 0.72
    passportDetector,
    // 0.70
    cinTnDetector,
    // 0.65
    personNameDetector
    // 0.58
  ];
  function scanText(text, options = {}) {
    const {
      minScore = 0.5,
      deduplicateOverlaps = true,
      detectors = ALL_DETECTORS
    } = options;
    const raw = [];
    for (const detector of detectors) {
      for (const pattern of detector.patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const value = match[1] ?? match[0];
          const start = match.index + match[0].indexOf(value);
          const end = start + value.length;
          if (detector.defaultScore >= minScore) {
            raw.push({
              type: detector.type,
              value,
              start,
              end,
              score: detector.defaultScore
            });
          }
          if (match[0].length === 0) {
            pattern.lastIndex++;
          }
        }
        pattern.lastIndex = 0;
      }
    }
    if (!deduplicateOverlaps) {
      return raw.sort((a, b) => a.start - b.start);
    }
    return deduplicateMatches(raw);
  }
  function deduplicateMatches(matches) {
    const sorted = [...matches].sort(
      (a, b) => b.score - a.score || a.start - b.start
    );
    const result = [];
    for (const candidate of sorted) {
      const overlaps = result.some(
        (kept) => candidate.start < kept.end && candidate.end > kept.start
      );
      if (!overlaps) {
        result.push(candidate);
      }
    }
    return result.sort((a, b) => a.start - b.start);
  }
  const TYPE_LABEL = {
    PERSON_NAME: "NAME",
    EMAIL_ADDRESS: "EMAIL",
    PHONE_NUMBER: "PHONE",
    IBAN: "IBAN",
    RIB_TN: "RIB",
    CIN_TN: "CIN",
    MF_TN: "MF",
    PASSPORT_TN: "PASSPORT",
    CARTE_SEJOUR: "SEJOUR",
    CREDIT_CARD: "CARD",
    API_KEY: "APIKEY",
    PRIVATE_KEY: "PRIVKEY",
    IP_ADDRESS: "IP",
    URL: "URL",
    DATE: "DATE",
    PASSPORT: "PASSPORT",
    GENERIC_SECRET: "SECRET",
    MEETING_TRANSCRIPT_MARKER: "TRANSCRIPT",
    MEETING_PARTICIPANT: "PARTICIPANT"
  };
  function cageText(text, options = {}) {
    const { minScore = 0.6, labelledPlaceholders = true } = options;
    const matches = scanText(text, { minScore });
    if (matches.length === 0) {
      return { cagedText: text, entities: [], totalCaged: 0 };
    }
    const entities = [];
    let counter = 1;
    const sortedDesc = [...matches].sort((a, b) => b.start - a.start);
    let result = text;
    for (const match of sortedDesc) {
      const label = labelledPlaceholders ? `_${TYPE_LABEL[match.type]}` : "";
      const placeholder = `[CAGED${label}_${counter}]`;
      counter++;
      entities.unshift({
        placeholder,
        originalValue: match.value,
        type: match.type,
        score: match.score
      });
      result = result.slice(0, match.start) + placeholder + result.slice(match.end);
    }
    return {
      cagedText: result,
      entities,
      totalCaged: entities.length
    };
  }
  function uncageText(cagedResponse, entities) {
    let result = cagedResponse;
    for (const entity of entities) {
      const escaped = entity.placeholder.replace(/[[\]]/g, "\\$&");
      const pattern = new RegExp(escaped, "g");
      result = result.replace(pattern, entity.originalValue);
    }
    return result;
  }
  const BANNER_ID = "ai-cage-banner-v2";
  const CAGED_ATTR = "data-ai-cage-done";
  const PROMPT_SELECTORS = [
    // ── ChatGPT / OpenAI (2023–2025+) ──────────────────────────────────────
    "#prompt-textarea",
    "div#prompt-textarea[contenteditable]",
    // ── Claude (Anthropic) ──────────────────────────────────────────────────
    'div.ProseMirror[contenteditable="true"]',
    // ── Gemini (Google) ─────────────────────────────────────────────────────
    "rich-textarea .ql-editor",
    'div.ql-editor[contenteditable="true"]',
    // ── Copilot / Bing Chat / Edge ───────────────────────────────────────────
    "textarea#searchbox",
    "cib-text-input textarea",
    'div[class*="copilot"][contenteditable="true"]',
    // ── Mistral / Le Chat ────────────────────────────────────────────────────
    'textarea[placeholder*="Envoyer un message"]',
    // ── Perplexity ──────────────────────────────────────────────────────────
    'textarea[placeholder*="Ask anything"]',
    'textarea[placeholder*="Search the internet"]',
    // ── DeepSeek ────────────────────────────────────────────────────────────
    "textarea#chat-input",
    // ── Poe ─────────────────────────────────────────────────────────────────
    'textarea[class*="GrowingTextArea"]',
    // ── Meta AI ─────────────────────────────────────────────────────────────
    'div[aria-label*="Message"][contenteditable="true"]',
    // ── Grok (X/Twitter) ────────────────────────────────────────────────────
    'div[data-testid="tweetTextarea_0"][contenteditable]',
    // ── HuggingFace Chat ────────────────────────────────────────────────────
    'textarea[placeholder*="Ask anything"]',
    // ── Cohere / Coral ──────────────────────────────────────────────────────
    'textarea[placeholder*="Send a message"]',
    // ── You.com / Phind / Pi.ai ─────────────────────────────────────────────
    'textarea[placeholder*="Type a message"]',
    'textarea[placeholder*="Reply to"]',
    // ── UNIVERSAL FALLBACKS (work on any AI not yet listed) ─────────────────
    // Large contenteditable divs with aria attributes typical of chat
    'div[contenteditable="true"][aria-multiline="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label]',
    // Standard textarea (works on 90% of AI chat interfaces)
    "textarea[rows]",
    "textarea",
    // Last resort contenteditable
    'div[contenteditable="true"]'
  ];
  const SEND_SELECTORS = [
    // Data attribute patterns
    'button[data-testid*="send"]',
    'button[data-testid*="submit"]',
    // Aria label patterns
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="Envoyer"]',
    'button[aria-label*="Soumettre"]',
    // SVG arrow buttons near inputs
    'button[type="submit"]',
    // Class-based (common patterns)
    'button[class*="send"]',
    'button[class*="submit"]',
    'button[class*="Send"]'
  ];
  const sessionEntityMap = [];
  let sessionCageTotal = 0;
  function injectBanner() {
    if (!document.body) return false;
    if (document.getElementById(BANNER_ID)) return true;
    const b = document.createElement("div");
    b.id = BANNER_ID;
    b.setAttribute("role", "status");
    b.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:2147483647",
      "background:#15803d",
      "color:#fff",
      "font-family:system-ui,sans-serif",
      "font-size:13px",
      "font-weight:600",
      "padding:6px 16px",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "box-shadow:0 2px 8px rgba(0,0,0,.25)",
      "user-select:none",
      "transition:background .3s"
    ].join(";");
    b.innerHTML = `
    <span style="font-size:16px">🔒</span>
    <span>AI CAGE Active</span>
    <span id="ai-cage-ctr" style="margin-left:auto;font-weight:400;font-size:12px;opacity:.85">
      Monitoring…
    </span>
  `;
    try {
      document.body.prepend(b);
      return true;
    } catch {
      return false;
    }
  }
  function updateBanner(caged, uncaged = false) {
    const ctr = document.getElementById("ai-cage-ctr");
    const banner = document.getElementById(BANNER_ID);
    if (!ctr || !banner) return;
    if (caged === 0) {
      ctr.textContent = "Monitoring…";
      banner.style.background = "#15803d";
    } else if (uncaged) {
      ctr.textContent = `${caged} item${caged > 1 ? "s" : ""} caged ✓ Restored`;
      banner.style.background = "#0369a1";
    } else {
      ctr.textContent = `${caged} item${caged > 1 ? "s" : ""} caged — waiting for AI…`;
      banner.style.background = "#b45309";
    }
  }
  function findPromptElement() {
    for (const sel of PROMPT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && isUsableInput(el)) return el;
      } catch {
      }
    }
    return null;
  }
  function isUsableInput(el) {
    try {
      const r = el.getBoundingClientRect();
      return r.width > 50 && r.height > 20;
    } catch {
      return false;
    }
  }
  function readText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    return (el.innerText ?? el.textContent ?? "").trim();
  }
  function writeText(el, text) {
    var _a;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = (_a = Object.getOwnPropertyDescriptor(proto, "value")) == null ? void 0 : _a.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      if (readText(el) !== text) {
        el.innerText = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
        try {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel == null ? void 0 : sel.removeAllRanges();
          sel == null ? void 0 : sel.addRange(range);
        } catch {
        }
      }
    }
  }
  function cagePrompt(el) {
    const raw = readText(el);
    if (!raw || raw.length < 3) return false;
    const { cagedText, entities, totalCaged } = cageText(raw);
    if (totalCaged === 0) return false;
    writeText(el, cagedText);
    sessionEntityMap.push(entities);
    if (sessionEntityMap.length > 10) sessionEntityMap.shift();
    sessionCageTotal += totalCaged;
    updateBanner(sessionCageTotal, false);
    try {
      void chrome.runtime.sendMessage({
        type: "CAGE_REPORT",
        tabId: 0,
        site: window.location.hostname,
        entities
      });
    } catch {
    }
    console.warn(`[AI CAGE] 🔒 Caged ${totalCaged} PII item(s) on ${window.location.hostname}`);
    return true;
  }
  function tryUncageNode(node) {
    if (sessionEntityMap.length === 0) return false;
    const allEntities = sessionEntityMap.flat();
    if (allEntities.length === 0) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const original = node.textContent ?? "";
      if (!original.includes("[CAGED_")) return false;
      const restored = uncageText(original, allEntities);
      if (restored !== original) {
        node.textContent = restored;
        updateBanner(sessionCageTotal, true);
        return true;
      }
    } else if (node instanceof Element) {
      const html = node.innerHTML;
      if (!html.includes("[CAGED_")) return false;
      const restored = uncageText(html, allEntities);
      if (restored !== html) {
        node.innerHTML = restored;
        updateBanner(sessionCageTotal, true);
        return true;
      }
    }
    return false;
  }
  function uncageSubtree(root) {
    var _a;
    if (sessionEntityMap.length === 0) return;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node2) => {
          var _a2;
          if (node2 instanceof Element) {
            const tag = (_a2 = node2.tagName) == null ? void 0 : _a2.toLowerCase();
            if (tag === "script" || tag === "style" || tag === "noscript") {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let node;
    while ((node = walker.nextNode()) !== null) {
      if (node.nodeType === Node.TEXT_NODE && ((_a = node.textContent) == null ? void 0 : _a.includes("[CAGED_"))) {
        tryUncageNode(node);
      }
    }
  }
  const responseObserver = new MutationObserver((mutations) => {
    var _a;
    if (sessionEntityMap.length === 0) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        var _a2, _b;
        if (node.nodeType === Node.TEXT_NODE) {
          if ((_a2 = node.textContent) == null ? void 0 : _a2.includes("[CAGED_")) {
            tryUncageNode(node);
          }
        } else if (node instanceof Element) {
          if ((_b = node.innerHTML) == null ? void 0 : _b.includes("[CAGED_")) {
            uncageSubtree(node);
          }
        }
      });
      if (mutation.type === "characterData") {
        const t = mutation.target;
        if ((_a = t.textContent) == null ? void 0 : _a.includes("[CAGED_")) {
          tryUncageNode(t);
        }
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    const isInput = PROMPT_SELECTORS.some((sel) => {
      try {
        return target.matches(sel) || !!target.closest(sel);
      } catch {
        return false;
      }
    });
    if (!isInput) return;
    cagePrompt(target);
  }, true);
  function hookSendButtons() {
    for (const sel of SEND_SELECTORS) {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.getAttribute(CAGED_ATTR) === "1") return;
        btn.setAttribute(CAGED_ATTR, "1");
        btn.addEventListener("click", () => {
          const prompt = findPromptElement();
          if (prompt) cagePrompt(prompt);
        }, true);
      });
    }
  }
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const sel = PROMPT_SELECTORS.join(",");
    try {
      const input = form.querySelector(sel);
      if (input) cagePrompt(input);
    } catch {
    }
  }, true);
  let lastInputValue = "";
  document.addEventListener("input", (e) => {
    const target = e.target;
    const isInput = PROMPT_SELECTORS.some((sel) => {
      try {
        return target.matches(sel) || !!target.closest(sel);
      } catch {
        return false;
      }
    });
    if (!isInput) return;
    const val = readText(target);
    if (lastInputValue.length > 5 && val.length === 0) ;
    lastInputValue = val;
  }, true);
  const domObserver = new MutationObserver(() => {
    hookSendButtons();
    if (!document.getElementById(BANNER_ID)) injectBanner();
  });
  function boot() {
    console.warn(`[AI CAGE] 🔒 Universal content script v0.4.5 active on ${window.location.hostname}`);
    if (!injectBanner()) {
      const w = new MutationObserver(() => {
        if (document.body && injectBanner()) w.disconnect();
      });
      w.observe(document.documentElement, { childList: true });
    }
    if (document.body) {
      domObserver.observe(document.body, { childList: true, subtree: true });
      responseObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    hookSendButtons();
  }
  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      hookSendButtons();
      if (!document.getElementById(BANNER_ID)) injectBanner();
      if (!responseObserver) return;
      responseObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });
  }
})();
