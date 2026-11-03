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
  const SHADOW_HOST_ID = "ai-cage-host-v5";
  const CAGED_ATTR = "data-ai-cage-done";
  const FONT = "system-ui,-apple-system,sans-serif";
  let sessionTotal = 0;
  let bubbleState = "idle";
  let pendingEntities = [];
  let shadowRoot = null;
  function getShadowRoot() {
    if (shadowRoot) return shadowRoot;
    if (!document.body) return null;
    const host = document.createElement("div");
    host.id = SHADOW_HOST_ID;
    host.style.cssText = "display:contents;position:static;all:unset;";
    shadowRoot = host.attachShadow({ mode: "closed" });
    document.body.appendChild(host);
    const style = document.createElement("style");
    style.textContent = `
    @keyframes cage-in { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    #cage-bubble {
      position:fixed;bottom:20px;right:20px;z-index:2147483647;
      width:44px;height:44px;border-radius:50%;
      background:#15803d;color:#fff;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;font-size:18px;font-weight:800;
      box-shadow:0 2px 12px rgba(0,0,0,.35);
      user-select:none;transition:all .25s;
      border:2px solid rgba(255,255,255,.25);
      font-family:${FONT};
    }
    #cage-bubble.amber{background:#d97706}
    #cage-bubble.blue{background:#0369a1}
    #cage-badge{
      position:absolute;top:-4px;right:-4px;
      background:#dc2626;color:#fff;border-radius:999px;
      font-size:10px;font-weight:800;min-width:16px;height:16px;
      display:none;align-items:center;justify-content:center;padding:0 3px;
    }
    #cage-panel{
      position:fixed;bottom:74px;right:20px;z-index:2147483647;
      width:310px;max-height:440px;
      background:#fff;color:#0f172a;border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.28);
      font-family:${FONT};font-size:13px;overflow:hidden;
      animation:cage-in .2s ease;
    }
    .ch{background:#15803d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .ch.amber{background:#d97706}
    .cs{padding:10px 14px;background:#f0fdf4;border-bottom:1px solid #e2e8f0;display:flex;gap:16px}
    .cl{max-height:200px;overflow-y:auto;padding:6px 0}
    .cr{padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px}
    .ca{padding:10px 14px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .cw{padding:8px 14px;background:#fef2f2;border-top:1px solid #fecaca;font-size:11px;color:#991b1b}
    .cf{padding:8px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
    .bg{background:#15803d;color:#fff;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
    .gg{background:#e2e8f0;color:#374151;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
    .bs{background:#15803d;color:#fff;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer}
    .gs{background:#e2e8f0;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer}
  `;
    shadowRoot.appendChild(style);
    return shadowRoot;
  }
  function injectPageScript() {
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("injected.js");
      s.async = false;
      s.onload = function() {
        this.remove();
      };
      (document.head || document.documentElement).prepend(s);
    } catch (e) {
      console.warn("[AI CAGE] inject failed:", e);
    }
  }
  function shareEntitiesWithPage(entities) {
    window.postMessage({ type: "AI_CAGE_ENTITIES", entities: entities.map((e) => ({ placeholder: e.placeholder, originalValue: e.originalValue })) }, "*");
  }
  function createBubble() {
    const root = getShadowRoot();
    if (!root || root.getElementById("cage-bubble")) return;
    const b = document.createElement("div");
    b.id = "cage-bubble";
    b.setAttribute("role", "button");
    b.setAttribute("aria-label", "AI CAGE");
    b.innerHTML = "🔒";
    b.addEventListener("click", togglePanel);
    const badge = document.createElement("span");
    badge.id = "cage-badge";
    b.appendChild(badge);
    root.appendChild(b);
  }
  function updateBubble() {
    const root = getShadowRoot();
    if (!root) return;
    const b = root.getElementById("cage-bubble");
    const badge = root.getElementById("cage-badge");
    if (!b) return;
    b.className = bubbleState === "detected" ? "amber" : bubbleState === "caged" ? "blue" : "";
    const icon = b.childNodes[0];
    if (icon) icon.textContent = bubbleState === "detected" ? "⚠️" : bubbleState === "restored" ? "✅" : "🔒";
    if (badge) b.appendChild(badge);
    if (sessionTotal > 0 && badge) {
      badge.style.display = "flex";
      badge.textContent = String(sessionTotal);
    }
    b.style.transform = "scale(1.15)";
    setTimeout(() => {
      b.style.transform = "scale(1)";
    }, 250);
    try {
      void chrome.action.setBadgeText({ text: sessionTotal > 0 ? String(sessionTotal) : "" });
    } catch {
    }
  }
  function togglePanel() {
    const root = getShadowRoot();
    if (!root) return;
    const existing = root.getElementById("cage-panel");
    if (existing) {
      existing.remove();
      return;
    }
    showStatusPanel();
  }
  function showStatusPanel() {
    var _a, _b;
    const root = getShadowRoot();
    if (!root) return;
    (_a = root.getElementById("cage-panel")) == null ? void 0 : _a.remove();
    const panel = document.createElement("div");
    panel.id = "cage-panel";
    panel.innerHTML = `
    <div class="ch">
      <span style="font-size:16px">🔒</span>
      <div style="flex:1"><div style="font-weight:700;font-size:13px">AI CAGE</div><div style="font-size:11px;opacity:.8">${window.location.hostname}</div></div>
      <button id="cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:2px">×</button>
    </div>
    <div class="cs">
      <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#15803d">${sessionTotal}</div><div style="font-size:10px;color:#64748b">Total caged</div></div>
      <div style="margin-left:auto;align-self:center;font-size:11px;color:#166534;font-weight:600">✅ Zero data sent</div>
    </div>
    <div style="padding:14px;font-size:12px;color:#64748b;text-align:center">
      ${sessionTotal > 0 ? `✅ ${sessionTotal} item(s) caged this session` : "🔍 Monitoring... Type a prompt with sensitive data."}
    </div>
    <div class="cf"><span>🇹🇳 Made in Tunisia</span><span>v0.5.0</span></div>`;
    root.appendChild(panel);
    (_b = root.getElementById("cage-close")) == null ? void 0 : _b.addEventListener("click", () => panel.remove());
    setTimeout(() => {
      document.addEventListener("click", (e) => {
        var _a2;
        const host = document.getElementById(SHADOW_HOST_ID);
        if (host && !host.contains(e.target)) (_a2 = root.getElementById("cage-panel")) == null ? void 0 : _a2.remove();
      }, { once: true });
    }, 150);
  }
  function showNetworkPanel(gateId, items) {
    var _a, _b, _c;
    const root = getShadowRoot();
    if (!root) {
      sendGateDecision(gateId, "pass", []);
      return;
    }
    (_a = root.getElementById("cage-panel")) == null ? void 0 : _a.remove();
    const itemsHtml = items.map((item, idx) => `
    <div class="cr" id="cr-${idx}">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:700;color:#0369a1;text-transform:uppercase">${item.type.replace(/_/g, " ")}</div>
        <div style="font-size:12px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.preview}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="bs" data-idx="${idx}" data-act="cage">🔒 Cage</button>
        <button class="gs" data-idx="${idx}" data-act="pass">Pass</button>
      </div>
    </div>`).join("");
    const panel = document.createElement("div");
    panel.id = "cage-panel";
    panel.innerHTML = `
    <div class="ch amber">
      <span style="font-size:16px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">Sensitive data detected!</div>
        <div style="font-size:11px;opacity:.9">${items.length} item${items.length > 1 ? "s" : ""} — choose action</div>
      </div>
    </div>
    <div class="cl">${itemsHtml}</div>
    <div class="ca">
      <button class="bg" id="cage-all">🔒 Cage All & Send</button>
      <button class="gg" id="pass-all">⚡ Send Unprotected</button>
    </div>
    <div class="cw">⚠️ "Send Unprotected" sends your real data to the AI.</div>`;
    root.appendChild(panel);
    bubbleState = "detected";
    updateBubble();
    let sent = false;
    function decide(mode, cageItems) {
      var _a2;
      if (sent) return;
      sent = true;
      (_a2 = root.getElementById("cage-panel")) == null ? void 0 : _a2.remove();
      sendGateDecision(gateId, mode, cageItems);
      if (mode === "cage") {
        sessionTotal += cageItems.length;
        bubbleState = "caged";
      } else {
        bubbleState = "idle";
      }
      updateBubble();
      if (mode === "cage") {
        try {
          void chrome.runtime.sendMessage({ type: "CAGE_REPORT", tabId: 0, site: window.location.hostname, entities: [] });
        } catch {
        }
      }
    }
    (_b = root.getElementById("cage-all")) == null ? void 0 : _b.addEventListener("click", () => decide("cage", items));
    (_c = root.getElementById("pass-all")) == null ? void 0 : _c.addEventListener("click", () => decide("pass", []));
    root.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const t = e.currentTarget;
        const idx = parseInt(t.dataset["idx"] ?? "0", 10);
        const act = t.dataset["act"];
        const row = root.getElementById(`cr-${idx}`);
        if (row) {
          row.style.background = act === "cage" ? "#f0fdf4" : "#fef2f2";
          row.querySelectorAll("button").forEach((b) => b.disabled = true);
        }
        if (items.length === 1) decide(act, act === "cage" ? [items[0]] : []);
      });
    });
  }
  function sendGateDecision(gateId, mode, items) {
    window.postMessage({ type: "AI_CAGE_PROCEED", gateId, mode, items }, "*");
  }
  function handleNetworkPII(gateId, items) {
    showNetworkPanel(gateId, items);
  }
  const PROMPT_SELECTORS = [
    "#prompt-textarea",
    "div#prompt-textarea[contenteditable]",
    'div[contenteditable="true"][data-id]',
    'div.ProseMirror[contenteditable="true"]',
    "rich-textarea .ql-editor",
    'div.ql-editor[contenteditable="true"]',
    "textarea#chat-input",
    'div[contenteditable="true"][aria-multiline="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label]',
    "textarea[rows]",
    "textarea",
    'div[contenteditable="true"]'
  ];
  const SEND_SELECTORS = [
    'button[data-testid*="send"]',
    'button[data-testid*="submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="Envoyer"]',
    'button[type="submit"]'
  ];
  function findPrompt() {
    for (const sel of PROMPT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 50 && r.height > 20) return el;
        }
      } catch {
      }
    }
    return null;
  }
  function readText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
    return (el.innerText ?? el.textContent ?? "").trim();
  }
  function writeText(el, text) {
    var _a;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = (_a = Object.getOwnPropertyDescriptor(proto, "value")) == null ? void 0 : _a.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.focus();
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      if (readText(el) !== text) {
        el.innerText = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      }
    }
  }
  function handlePrompt(el) {
    const raw = readText(el);
    if (!raw || raw.length < 3) return;
    const { cagedText, entities, totalCaged } = cageText(raw);
    if (totalCaged === 0) return;
    pendingEntities = [...pendingEntities, ...entities];
    bubbleState = "detected";
    updateBubble();
    writeText(el, cagedText);
    shareEntitiesWithPage(entities);
    sessionTotal += totalCaged;
    try {
      void chrome.runtime.sendMessage({ type: "CAGE_REPORT", tabId: 0, site: window.location.hostname, entities });
    } catch {
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey) return;
    const target = e.target;
    const isPrompt = PROMPT_SELECTORS.some((sel) => {
      try {
        return target.matches(sel) || !!target.closest(sel);
      } catch {
        return false;
      }
    });
    if (isPrompt) handlePrompt(target);
  }, true);
  function hookButtons() {
    SEND_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.getAttribute(CAGED_ATTR) === "1") return;
        btn.setAttribute(CAGED_ATTR, "1");
        btn.addEventListener("click", () => {
          const p = findPrompt();
          if (p) handlePrompt(p);
        }, true);
      });
    });
  }
  document.addEventListener("submit", (e) => {
    const form = e.target;
    try {
      const input = form.querySelector(PROMPT_SELECTORS.join(","));
      if (input) handlePrompt(input);
    } catch {
    }
  }, true);
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if ((d == null ? void 0 : d.type) === "AI_CAGE_PII_DETECTED" && d.gateId && d.items) {
      handleNetworkPII(d.gateId, d.items);
      return;
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_NETWORK_CAGED" && d.count) {
      sessionTotal += d.count;
      bubbleState = "caged";
      updateBubble();
      try {
        void chrome.runtime.sendMessage({ type: "CAGE_REPORT", tabId: 0, site: window.location.hostname, entities: [] });
      } catch {
      }
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_NETWORK_RESTORED") {
      bubbleState = "restored";
      updateBubble();
      setTimeout(() => {
        bubbleState = "idle";
        updateBubble();
      }, 3e3);
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_INJECTION_DETECTED") {
      try {
        void chrome.runtime.sendMessage({ type: "AGENT_EVENT", site: window.location.hostname, detail: d.detail ?? "Injection detected", blocked: true });
      } catch {
      }
      bubbleState = "detected";
      updateBubble();
    }
  });
  const domObserver = new MutationObserver(() => {
    hookButtons();
    const root = getShadowRoot();
    if (root && !root.getElementById("cage-bubble")) createBubble();
  });
  function boot() {
    injectPageScript();
    const tryInit = () => {
      if (!document.body) return false;
      createBubble();
      domObserver.observe(document.body, { childList: true, subtree: true });
      return true;
    };
    if (!tryInit()) {
      const w = new MutationObserver(() => {
        if (tryInit()) w.disconnect();
      });
      w.observe(document.documentElement, { childList: true });
    }
    hookButtons();
    console.warn(`[AI CAGE] 🔒 Ghost Mode v0.5.0 on ${window.location.hostname}`);
  }
  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      hookButtons();
      createBubble();
    });
  }
})();
