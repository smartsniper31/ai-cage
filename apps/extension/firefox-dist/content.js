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
  const BANNER_ID = "ai-cage-banner";
  const CAGED_ATTR = "data-ai-cage-processed";
  const PROMPT_SELECTORS = [
    // ChatGPT (2024+) — contenteditable div
    "#prompt-textarea",
    "div#prompt-textarea",
    // ChatGPT generic contenteditable
    'div[contenteditable="true"][data-id]',
    // Claude
    'div[contenteditable="true"].ProseMirror',
    // Gemini
    "rich-textarea .ql-editor",
    'div.ql-editor[contenteditable="true"]',
    // Mistral / Le Chat
    'textarea[placeholder*="Envoyer" i]',
    'textarea[placeholder*="Message" i]',
    // Perplexity
    'textarea[placeholder*="Ask" i]',
    // Poe / Phind / generic
    'textarea[data-testid*="chat" i]',
    'textarea[data-testid*="input" i]',
    // DeepSeek
    "textarea#chat-input",
    // Meta AI
    'div[aria-label*="message" i][contenteditable="true"]',
    // Grok (X/Twitter)
    'div[data-testid="tweetTextarea_0"]',
    // Copilot / Edge
    "cib-text-input textarea",
    'textarea[id*="userInput"]',
    // HuggingFace
    'textarea[placeholder*="Type" i]',
    // Generic fallbacks (last resort)
    'div[contenteditable="true"][aria-label]',
    'div[contenteditable="true"][aria-multiline]',
    'textarea[placeholder*="chat" i]',
    'div[contenteditable="true"]',
    "textarea"
  ];
  const SEND_BUTTON_SELECTORS = [
    // ChatGPT 2025
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    // Claude
    'button[aria-label="Send Message"]',
    'button[data-testid="send-button"]',
    // Gemini
    'button[aria-label="Send message"]',
    "button.send-button",
    // Mistral
    'button[type="submit"]',
    // Perplexity
    'button[aria-label*="submit" i]',
    // Copilot / Edge
    'button[aria-label*="send" i]',
    'button[aria-label*="envoyer" i]',
    "cib-typing-indicator + div button",
    // Poe
    'button[class*="SendButton"]',
    // Meta AI
    'div[aria-label="Send"][role="button"]',
    // Grok
    'button[data-testid="tweetButton"]',
    // Generic
    'button[type="submit"]',
    "form button:last-of-type"
  ];
  let sessionEntities = [];
  let sessionCageTotal = 0;
  function injectBanner() {
    if (!document.body) return false;
    if (document.getElementById(BANNER_ID)) return true;
    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:2147483647",
      "background:#15803d",
      "color:#ffffff",
      "font-family:system-ui,sans-serif",
      "font-size:13px",
      "font-weight:600",
      "padding:6px 16px",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "box-shadow:0 2px 8px rgba(0,0,0,.25)",
      "user-select:none"
    ].join(";");
    banner.innerHTML = `
    <span aria-hidden="true">🔒</span>
    <span>AI CAGE Active</span>
    <span id="ai-cage-counter" style="margin-left:auto;opacity:.85;font-weight:400">
      Ready to cage PII
    </span>
  `;
    try {
      document.body.prepend(banner);
      return true;
    } catch {
      return false;
    }
  }
  function updateBannerCounter(total) {
    const counter = document.getElementById("ai-cage-counter");
    if (counter) {
      counter.textContent = total === 0 ? "Ready to cage PII" : total === 1 ? "1 item caged" : `${total} items caged`;
      counter.style.color = total > 0 ? "#86efac" : "";
    }
  }
  function findPromptElement() {
    for (const selector of PROMPT_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return el;
      } catch {
      }
    }
    return null;
  }
  function isVisible(el) {
    try {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch {
      return false;
    }
  }
  function readText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    return el.innerText ?? el.textContent ?? "";
  }
  function writeText(el, text) {
    var _a, _b;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const nativeInputValueSetter = ((_a = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )) == null ? void 0 : _a.set) ?? ((_b = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )) == null ? void 0 : _b.set);
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.setSelectionRange(start, end);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection == null ? void 0 : selection.removeAllRanges();
      selection == null ? void 0 : selection.addRange(range);
      document.execCommand("insertText", false, text);
      if (el.innerText !== text) {
        el.innerText = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }
  function interceptPrompt(el) {
    const raw = readText(el).trim();
    if (!raw) return false;
    const { cagedText, entities, totalCaged } = cageText(raw);
    if (totalCaged === 0) return false;
    writeText(el, cagedText);
    sessionEntities = [...sessionEntities, ...entities];
    sessionCageTotal += totalCaged;
    updateBannerCounter(sessionCageTotal);
    try {
      void chrome.runtime.sendMessage({
        type: "CAGE_REPORT",
        tabId: 0,
        site: window.location.hostname,
        entities
      });
    } catch {
    }
    console.warn(`[AI CAGE] 🔒 Caged ${totalCaged} PII item(s) before send.`);
    return true;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const target = e.target;
    const isPrompt = PROMPT_SELECTORS.some((sel) => {
      try {
        return target.matches(sel) || target.closest(sel) !== null;
      } catch {
        return false;
      }
    });
    if (!isPrompt) return;
    interceptPrompt(target);
  }, true);
  function attachSendButtonListeners() {
    for (const sel of SEND_BUTTON_SELECTORS) {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.getAttribute(CAGED_ATTR)) return;
        btn.setAttribute(CAGED_ATTR, "true");
        btn.addEventListener("click", () => {
          const prompt = findPromptElement();
          if (prompt) interceptPrompt(prompt);
        }, true);
      });
    }
  }
  const observer = new MutationObserver(() => {
    attachSendButtonListeners();
    if (!document.getElementById(BANNER_ID)) injectBanner();
  });
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const textarea = form.querySelector(PROMPT_SELECTORS.join(","));
    if (textarea) interceptPrompt(textarea);
  }, true);
  function boot() {
    console.warn("[AI CAGE] Content script v0.4.5 booting on", window.location.hostname);
    if (!injectBanner()) {
      const bodyWatcher = new MutationObserver(() => {
        if (document.body && injectBanner()) {
          bodyWatcher.disconnect();
        }
      });
      bodyWatcher.observe(document.documentElement, { childList: true });
    }
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    attachSendButtonListeners();
    console.warn("[AI CAGE] 🔒 Active — intercepting prompts on", window.location.hostname);
  }
  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      attachSendButtonListeners();
      if (!document.getElementById(BANNER_ID)) injectBanner();
    });
  }
})();
