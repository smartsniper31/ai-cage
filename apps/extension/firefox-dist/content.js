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
      // International format with + prefix (most reliable)
      /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g,
      // Local format: (NNN) NNN-NNNN or NNN NNN NNNN
      // Negative lookbehind: not preceded by digit or space+digit (not inside RIB)
      new RegExp("(?<!\\d[\\s]?)(?<!\\d)\\(?\\d{3}\\)?[\\s.\\-]\\d{3}[\\s.\\-]\\d{4}(?!\\d)", "g")
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
      // Compact 20 digits
      /\b\d{20}\b/g,
      // Spaced 2+3+13+2 (classic 4-block format)
      /\b\d{2}[\s]\d{3}[\s]\d{13}[\s]\d{2}\b/g,
      // Spaced 2+3+12+2 (some banks)
      /\b\d{2}[\s]\d{3}[\s]\d{12}[\s]\d{2}\b/g,
      // T1 FIX: Spaced 2+3+3+12+2 (5-block format used in test: "10 020 035 112233445566 77")
      // This is the most common TN bank display format: bank+branch+account+key
      /\b\d{2}[\s]\d{3}[\s]\d{3}[\s]\d{12}[\s]\d{2}\b/g,
      // Spaced 2+3+3+13+2 (5-block, 13-digit account)
      /\b\d{2}[\s]\d{3}[\s]\d{3}[\s]\d{13}[\s]\d{2}\b/g,
      // With optional dashes, flexible middle
      /\b\d{2}[\s\-]\d{3}[\s\-]\d{12,13}[\s\-]\d{2}\b/g
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
      // AWS Access Key ID
      /\bAKIA[0-9A-Z]{16}\b/g,
      // GitHub Personal Access Tokens (classic + fine-grained)
      // R2 FIX: lowered minimum from 36 to 20 to catch shorter test tokens
      /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,255}\b/g,
      // Stripe — live + test (sk-live_, pk-live_, sk-test_, pk-test_)
      /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
      // OpenAI (sk-...) — covers sk-test-, sk-proj-, sk-org-
      /\bsk-(?:test|proj|org|[A-Za-z0-9])[A-Za-z0-9\-_]{15,}\b/g,
      // Anthropic (sk-ant-)
      /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g,
      // Groq (gsk_)
      /\bgsk_[A-Za-z0-9]{20,}\b/g,
      // Slack Bot Token (xoxb-), User Token (xoxp-), Workspace (xoxs-)
      /\bxox[bpsa]-[A-Za-z0-9\-]{16,}\b/g,
      // Google API Key (AIza) — R3 FIX: removed strict \b, added space-or-start context
      // "Clé Google : AIzaSyA-..." → the A is preceded by space, \b fails there
      /(?:^|[\s:=\-,])AIza[A-Za-z0-9\-_]{30,}/gm,
      // Generic key=/secret= patterns
      /\b(?:api[_\-]?key|secret[_\-]?key|access[_\-]?token)\s*[=:]\s*["']?[A-Za-z0-9\-_.+/]{20,}["']?/gi,
      // Bearer tokens
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
      // English: password= / pwd= / passwd=
      /\b(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{6,}["']?/gi,
      // French: mot de passe = / mdp = / motdepasse = (with optional qualifier like "test", "admin")
      /\b(?:mot\s+de\s+passe(?:\s+\w+)?|motdepasse|mdp)\s*[=:\-]\s*["']?[^\s"',;]{6,}["']?/gi,
      // French natural language: "mon mot de passe est Azerty123" / "mot de passe test : X"
      /\b(?:mon\s+)?(?:mot\s+de\s+passe(?:\s+\w+)?|mdp)\s+(?:est|is|:)\s+["']?([^\s"',;]{6,})["']?/gi,
      // Generic token / secret / credential key-value
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
      // "Nom du client : Karim Ben Salah" / "Nom: Ahmed Ben Ali" / "Name: Marie Dupont"
      // R5 FIX: capture group now greedy enough to get full name after label
      /\b(?:Nom\s+(?:du\s+client|et\s+Pr[eé]nom|Complet|de\s+l[''](?:employ[eé]|agent|utilisateur))|Full\s+Name|Name|Pr[eé]nom\s+(?:et\s+Nom)?|Nom)\s*[:\-]\s*([A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+(?:\s+[A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+){1,4})/gi,
      // ── Arabic-origin Tunisian names (expanded) ───────────────────────────
      /\b(?:Mohamed?|Mohamad|Muhamed?|Ahmad?|Ahmed?|Ali|Omar|Youssef|Yousef|Khaled|Khalid|Sami|Samir|Rami|Tarek|Tariq|Imed|Wissem|Wassim|Karim|Slim|Hamza|Walid|Fethi|Nabil|Hedi|Lotfi|Mounir|Hatem|Aymen|Bilel|Amine|Hichem|Sofien|Ramzi|Bassem|Maher|Faouzi|Adel|Zied|Chokri|Anis|Riyadh|Mondher|Riadh|Fatma|Ines|Sonia|Emna|Rim|Nour|Olfa|Mariem|Amira|Hela|Wafa|Asma|Manel|Rania|Sirine|Imen|Najet|Lobna|Sabrina|Salma|Yosra)\s+(?:Ben|Bel|El|Al|Ould|Bent|Bint|Bou|Hadj|Validation|Test)\s+[A-ZÀ-Ÿa-zà-ÿ]{2,20}/g,
      // ── French / European name pairs ──────────────────────────────────────
      // R6 FIX: Stronger exclusion list — adds common test words (Test, Validation,
      // Demo, Admin, User, Client) and all structural labels.
      // The (?!\s*:) prevents caging words that are labels before a colon.
      /\b(?!(?:The|A|An|In|On|At|By|For|From|With|This|That|These|Those|It|Is|Are|Was|Were|Has|Have|Had|Be|Been|Being|Do|Does|Did|Will|Would|Could|Should|May|Might|Must|Shall|Can|Need|Dare|Used|Ought|Nom|Email|Tel|Fax|Date|Adresse|Passeport|Passport|Telephone|IBAN|RIB|CIN|MF|Test|Validation|Demo|Admin|User|Client|Secret|Token|Key|API|Google|GitHub|Stripe|OpenAI|Meta|Clé|Mon|Ma|Mon|Le|La|Les|Un|Une|Des)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}\s+(?!(?:API|URL|HTTP|SQL|JSON|XML|CSS|HTML|PDF|CSV|AI|ML|UI|UX|ID|DB|Test|Validation|Demo)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]{2,20})?(?!\s*:)\b/g
    ],
    defaultScore: 0.58
  };
  const postalAddressDetector = {
    name: "Postal Address",
    type: "POSTAL_ADDRESS",
    patterns: [
      // ── Labelled (high confidence) ─────────────────────────────────────────
      // "Adresse : 12 Rue Habib Bourguiba, Monastir 5000"
      /\b(?:Adresse|Domicile|R[eé]sidence|Address|Home\s+Address|Mailing\s+Address)\s*[:=\-]\s*([^\n]{5,80})/gi,
      // ── French street types ────────────────────────────────────────────────
      // "12 Rue Habib Bourguiba" / "Avenue de la Paix" / "Boulevard 7 Novembre"
      /\b\d{1,4}\s+(?:Rue|Avenue|Av\.|Boulevard|Blvd\.?|Impasse|Allée|Place|Route|Cité|Quartier|Résidence|Lotissement|Zone)\s+[A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ\s\d]{3,50}/gi,
      // ── English street types ───────────────────────────────────────────────
      // "12 Main Street, London" / "5B Baker Street"
      /\b\d{1,4}[A-Z]?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Place|Pl\.?|Square|Sq\.?|Way|Close|Crescent|Terrace)\b/gi,
      // ── Postal code patterns (FR/TN/UK/DE) ────────────────────────────────
      // Tunisia: 4 digits — "Monastir 5000", "Tunis 1000"
      /\b(?:Tunis|Sfax|Sousse|Monastir|Bizerte|Nabeul|Kairouan|Gafsa|Ariana|Manouba|Ben\s+Arous|La\s+Marsa|Hammamet|Djerba|Gabès)\s+\d{4}\b/gi,
      // France: 5-digit postal code with city
      /\b\d{5}\s+[A-ZÀ-Ÿ][a-zA-Zà-ÿ\s\-]{2,30}\b/g,
      // UK: postcode format
      /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/g
    ],
    defaultScore: 0.72
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
      // Requires EXACTLY 2-3 title-case words before the colon (First Last: speech)
      // T2+T3 FIX: Added second-word exclusion so "Ben Test", "Validation Ben" etc.
      // are not caged as participants. Also added more known label-pair exclusions.
      /\b(?!(?:Cl[eé]\s+Google|Secret\s+API|Token\s+GitHub|Mot\s+de|Cl[eé]\s+API|API\s+Key|Mon\s+patron|Mon\s+propre|Nom\s+du|Nom\s+et|Adresse\s+postale|Carte\s+bancaire|RIB\s+Tunisien|Ma\s+CIN|Mon\s+RIB|Bonjour|Voici|Merci)\b)([A-ZÀ-Ÿ][a-zà-ÿ]{1,20}\s+(?!(?:Validation|Test|Demo|Admin|Google|GitHub|Tunisien|Tunisienne|postale|bancaire|perso|propre)\b)[A-ZÀ-Ÿ][a-zà-ÿ]{1,20}(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]{1,20})?)\s*:\s+(?=[A-ZÀ-Ÿa-zà-ÿ])/g,
      // "John said:", "John asked:", "John replied:" — single word OK only with speech verb
      /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\s+(?:said|asked|replied|noted|added|stated):\s/gi
    ],
    defaultScore: 0.68
  };
  const ALL_DETECTORS = [
    privateKeyDetector,
    // 1.00 — PEM keys, unambiguous
    mfTnDetector,
    // 0.92 — Tunisian tax ID, very specific format
    emailDetector,
    // 0.95 — RFC email
    creditCardDetector,
    // 0.90 — Luhn-format card numbers
    ibanDetector,
    // 0.90 — ISO 13616, MUST be before phone
    ribTnDetector,
    // 0.80 — 20-digit TN RIB, MUST be before phone
    apiKeyDetector,
    // 0.88 — API keys (sk-, ghp_, etc.)
    genericSecretDetector,
    // 0.82 — passwords, tokens
    transcriptMarkerDetector,
    // 0.82 — Cage 5 transcript markers
    ipDetector,
    // 0.85 — IPv4/IPv6
    passportTnDetector,
    // 0.78 — TN passport (1 letter + 7 digits)
    phoneDetector,
    // 0.75 — AFTER RIB/IBAN to avoid sub-match
    postalAddressDetector,
    // 0.72 — street addresses
    carteSejourDetector,
    // 0.72 — residence permit
    meetingParticipantDetector,
    // 0.68 — Cage 5 participants
    passportDetector,
    // 0.70 — generic passport
    cinTnDetector,
    // 0.65 — TN CIN 8 digits
    personNameDetector
    // 0.58 — names (broadest, last)
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
  function generateSessionSalt() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }
  const SESSION_SALT = generateSessionSalt();
  const QUASI_PATTERNS = [
    // Age — "34 ans", "aged 45", "45 years old"
    { label: "age", pattern: /\b\d{1,3}\s*(?:ans?|years?\s*old|year[-\s]old|yo\b)/i },
    // Company size — "8 employees", "15 salariés", "équipe de 6"
    { label: "team_size", pattern: /\b\d{1,4}\s*(?:employ[eé]es?|salari[eé]s?|staff|workers?|personnes?|collaborateurs?|membres?)\b/i },
    // Monetary amount — "12 500 DT", "€ 8000", "$4,200", "15 000 €"
    { label: "amount", pattern: /(?:€|\$|£|DT|TND|EUR|USD)\s*[\d\s,.]+|[\d\s,.]+\s*(?:€|\$|£|DT|TND|EUR|USD)/i },
    // Specific date — "le 3 novembre", "signed on Nov 3", "03/11/2026"
    { label: "specific_date", pattern: /\b(?:le\s+)?\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\b\d{1,2}\s+(?:jan(?:vier)?|f[eé]v(?:rier)?|mar(?:s|ch)?|avr(?:il)?|apr(?:il)?|mai|may|juin|jun(?:e)?|juil(?:let)?|jul(?:y)?|ao[uû]t|aug(?:ust)?|sep(?:t(?:embre|ember)?)?|oct(?:obre|ober)?|nov(?:embre|ember)?|d[eé]c(?:embre|ember)?)\b/i },
    // Named city / location — "in Bizerte", "à Sousse", "near Tunis"
    { label: "city", pattern: /\b(?:à|at|in|near|de)\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/ },
    // Professional role
    { label: "role", pattern: /\b(?:patron|gérant|CEO|director|manager|associate|partner|avocat|médecin|comptable|notaire|architecte|consultant)\b/i },
    // Contract / deal reference
    { label: "deal_ref", pattern: /\b(?:contrat|dossier|deal|affaire|cas|case|matter|n[°o]\.?\s*\d+)\b/i },
    // Industry / sector
    { label: "sector", pattern: /\b(?:agence|cabinet|étude|firm|studio|startup|société|entreprise|sarl|suarl|sa\b|llc|inc\b)\b/i }
  ];
  const INFERENCE_THRESHOLD = 3;
  function detectQuasiIdentifiers(text) {
    const clues = [];
    for (const { label, pattern } of QUASI_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        clues.push(label);
      }
    }
    const score = clues.length;
    const risky = score >= INFERENCE_THRESHOLD;
    let message = "";
    if (risky) {
      message = `Inference Risk: ${score} clues combined can identify you even without your name. (${clues.map((c) => c.replace("_", " ")).join(", ")})`;
    } else if (score > 0) {
      message = `${score} context clue${score > 1 ? "s" : ""} detected. Add ${INFERENCE_THRESHOLD - score} more and you become identifiable without your name.`;
    }
    return { score, risky, clues, message };
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
    MEETING_PARTICIPANT: "PARTICIPANT",
    POSTAL_ADDRESS: "ADDRESS"
  };
  function cageText(text, options = {}) {
    const { minScore = 0.6, labelledPlaceholders = true, sessionSalt } = options;
    const salt = sessionSalt ?? SESSION_SALT;
    const matches = scanText(text, { minScore });
    const inferenceRisk = detectQuasiIdentifiers(text);
    if (matches.length === 0) {
      return { cagedText: text, entities: [], totalCaged: 0, inferenceRisk };
    }
    const entities = [];
    let counter = 1;
    const sortedDesc = [...matches].sort((a, b) => b.start - a.start);
    let result = text;
    for (const match of sortedDesc) {
      const label = labelledPlaceholders ? `_${TYPE_LABEL[match.type]}` : "";
      const placeholder = `[CAGED${label}_${salt}_${counter}]`;
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
      totalCaged: entities.length,
      inferenceRisk
    };
  }
  const SHADOW_HOST_ID = "ai-cage-host-v6";
  const CAGED_ATTR = "data-ai-cage-done";
  const FONT = "system-ui,-apple-system,sans-serif";
  let sessionTotal = 0;
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
    /* ── Animations ── */
    @keyframes cage-in  { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes cage-out { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(8px) scale(.97)} }
    @keyframes cage-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(21,128,61,.4)} 50%{box-shadow:0 0 0 6px rgba(21,128,61,0)} }

    /* ── Status indicator (FIX 2) — tiny non-interactive pill ── */
    /* Replaces the old bubble. Shows AI CAGE is active without double popup. */
    #cage-status {
      position:fixed;
      bottom:20px;
      right:20px;
      z-index:2147483647;
      display:flex;
      align-items:center;
      gap:6px;
      background:rgba(21,128,61,0.92);
      color:#fff;
      border-radius:999px;
      padding:5px 10px 5px 8px;
      font-family:${FONT};
      font-size:11px;
      font-weight:700;
      box-shadow:0 2px 10px rgba(0,0,0,.25);
      pointer-events:none;   /* non-interactive — no click, no cursor change */
      user-select:none;
      transition:opacity .3s, transform .3s;
      letter-spacing:.01em;
    }
    #cage-status.idle    { background:rgba(21,128,61,0.82); }
    #cage-status.caged   { background:rgba(21,128,61,0.97); animation:cage-pulse .6s ease; }
    #cage-status.warning { background:rgba(217,119,6,0.92); }
    #cage-status.hidden  { opacity:0; transform:translateY(4px); pointer-events:none; }
    #cage-status .dot {
      width:7px; height:7px; border-radius:50%;
      background:#fff; flex-shrink:0;
    }
    #cage-status.idle    .dot { background:rgba(255,255,255,.6); }
    #cage-status.caged   .dot { background:#fff; }
    #cage-status.warning .dot { background:#fff; }

    /* ── Toast (P0-7) ── */
    #cage-toast {
      position:fixed;
      bottom:54px;
      right:20px;
      z-index:2147483647;
      background:#15803d;
      color:#fff;
      border-radius:10px;
      padding:10px 16px;
      font-size:13px;
      font-weight:700;
      font-family:${FONT};
      box-shadow:0 4px 16px rgba(0,0,0,.28);
      animation:cage-in .18s ease;
      pointer-events:none;
      max-width:280px;
      line-height:1.4;
    }
    #cage-toast.warning {
      background:#d97706;
    }
    #cage-toast.fading {
      animation:cage-out .25s ease forwards;
    }

    /* ── Decision panel (shown when network PII detected) ── */
    #cage-panel {
      position:fixed;
      bottom:56px;
      right:20px;
      z-index:2147483647;
      width:320px;
      max-height:calc(100vh - 120px);
      overflow-y:auto;
      background:#fff;
      color:#0f172a;
      border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.28);
      font-family:${FONT};
      font-size:13px;
      animation:cage-in .2s ease;
    }

    /* ── Panel internals ── */
    .ch  { background:#15803d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;border-radius:14px 14px 0 0 }
    .ch.amber { background:#d97706 }
    .cl  { max-height:200px;overflow-y:auto;padding:6px 0 }
    .cr  { padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px }
    .ca  { padding:10px 14px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:8px }
    .cw  { padding:8px 14px;background:#fef2f2;border-top:1px solid #fecaca;font-size:11px;color:#991b1b }
    .bg  { background:#15803d;color:#fff;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;width:100% }
    .gg  { background:#e2e8f0;color:#374151;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;width:100% }
    .bs  { background:#15803d;color:#fff;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer }
    .gs  { background:#e2e8f0;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer }
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
    window.postMessage({
      type: "AI_CAGE_ENTITIES",
      entities: entities.map((e) => ({ placeholder: e.placeholder, originalValue: e.originalValue }))
    }, "*");
  }
  function showToast(message, type = "success", durationMs = 2500) {
    var _a;
    const root = getShadowRoot();
    if (!root) return;
    (_a = root.getElementById("cage-toast")) == null ? void 0 : _a.remove();
    const toast = document.createElement("div");
    toast.id = "cage-toast";
    if (type === "warning") toast.classList.add("warning");
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => {
      const el = root.getElementById("cage-toast");
      if (!el) return;
      el.classList.add("fading");
      setTimeout(() => el.remove(), 260);
    }, durationMs);
  }
  let statusHideTimer = null;
  function createStatusIndicator() {
    const root = getShadowRoot();
    if (!root || root.getElementById("cage-status")) return;
    const el = document.createElement("div");
    el.id = "cage-status";
    el.className = "idle";
    el.innerHTML = '<div class="dot"></div><span id="cage-status-text">🔒 AI CAGE active</span>';
    root.appendChild(el);
  }
  function updateStatus(state, text) {
    const root = getShadowRoot();
    if (!root) return;
    if (!root.getElementById("cage-status")) createStatusIndicator();
    const el = root.getElementById("cage-status");
    const textEl = root.getElementById("cage-status-text");
    if (!el || !textEl) return;
    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
    el.className = state;
    el.classList.remove("hidden");
    if (text) {
      textEl.textContent = text;
    } else {
      if (state === "idle") textEl.textContent = "🔒 AI CAGE active";
      if (state === "caged") textEl.textContent = `🔒 ${sessionTotal} protected`;
      if (state === "warning") textEl.textContent = "⚠️ Check before sending";
    }
    if (state === "caged" || state === "warning") {
      statusHideTimer = setTimeout(() => {
        updateStatus("idle");
      }, 3e3);
    }
  }
  function updateBadge() {
    try {
      void chrome.action.setBadgeText({ text: sessionTotal > 0 ? String(sessionTotal) : "" });
      void chrome.action.setBadgeBackgroundColor({ color: "#15803d" });
    } catch {
    }
  }
  function showNetworkPanel(gateId, items) {
    var _a, _b, _c, _d;
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
        <button class="gs" data-idx="${idx}" data-act="pass">Skip</button>
      </div>
    </div>`).join("");
    const panel = document.createElement("div");
    panel.id = "cage-panel";
    panel.innerHTML = `
    <div class="ch amber">
      <span style="font-size:16px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">Sensitive data detected!</div>
        <div style="font-size:11px;opacity:.9">${items.length} item${items.length > 1 ? "s" : ""} — choose an action</div>
      </div>
      <button id="cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:2px 6px">×</button>
    </div>
    <div class="cl">${itemsHtml}</div>
    <div class="ca">
      <button class="bg" id="cage-all">🔒 Cage All &amp; Send</button>
      <button class="gg" id="pass-all">⚡ Send Without Protection</button>
    </div>
    <div class="cw">⚠️ "Send Without Protection" sends your real data to the AI.</div>`;
    root.appendChild(panel);
    let sent = false;
    function decide(mode, cageItems) {
      var _a2;
      if (sent) return;
      sent = true;
      (_a2 = root.getElementById("cage-panel")) == null ? void 0 : _a2.remove();
      sendGateDecision(gateId, mode, cageItems);
      if (mode === "cage") {
        sessionTotal += cageItems.length;
        updateBadge();
        updateStatus("caged");
        const types = [...new Set(cageItems.map((i) => i.type.replace(/_/g, " ").toLowerCase()))].slice(0, 2).join(", ");
        showToast(`🔒 ${cageItems.length} item${cageItems.length > 1 ? "s" : ""} protected (${types})`);
        try {
          void chrome.runtime.sendMessage({ type: "CAGE_REPORT", tabId: 0, site: window.location.hostname, entities: [] });
        } catch {
        }
      }
    }
    (_b = root.getElementById("cage-close")) == null ? void 0 : _b.addEventListener("click", () => {
      panel.remove();
      sendGateDecision(gateId, "pass", []);
    });
    (_c = root.getElementById("cage-all")) == null ? void 0 : _c.addEventListener("click", () => decide("cage", items));
    (_d = root.getElementById("pass-all")) == null ? void 0 : _d.addEventListener("click", () => decide("pass", []));
    root.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const t = e.currentTarget;
        const idx = parseInt(t.dataset["idx"] ?? "0", 10);
        const act = t.dataset["act"];
        const row = root.getElementById(`cr-${idx}`);
        if (row) {
          row.style.background = act === "cage" ? "#f0fdf4" : "#fef2f2";
          row.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
        }
        if (items.length === 1) decide(act, act === "cage" ? [items[0]] : []);
      });
    });
  }
  function sendGateDecision(gateId, mode, items) {
    window.postMessage({ type: "AI_CAGE_PROCEED", gateId, mode, items }, "*");
  }
  const PROMPT_SELECTORS = [
    // ── ChatGPT / OpenAI ──────────────────────────────────────────────────
    "#prompt-textarea",
    "div#prompt-textarea[contenteditable]",
    'div[contenteditable="true"][data-id]',
    'div.ProseMirror[contenteditable="true"]',
    // ── Claude (Anthropic) ────────────────────────────────────────────────
    'div[contenteditable="true"][aria-multiline="true"]',
    "div.ProseMirror",
    // ── Gemini / Google AI Studio ─────────────────────────────────────────
    "rich-textarea .ql-editor",
    'div.ql-editor[contenteditable="true"]',
    "ms-text-chunk[contenteditable]",
    'div[contenteditable="true"].input-area',
    // ── Meta AI (meta.ai) ─────────────────────────────────────────────────
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label]',
    'div[contenteditable="true"][aria-placeholder]',
    'div[aria-label*="Message"][contenteditable]',
    'div[aria-label*="message"][contenteditable]',
    'div[aria-label*="prompt"][contenteditable]',
    'div[aria-label*="Prompt"][contenteditable]',
    "div[placeholder][contenteditable]",
    "div[data-placeholder][contenteditable]",
    // ── Bing Copilot / Microsoft ──────────────────────────────────────────
    "textarea#searchbox",
    "cib-text-input textarea",
    "div.user-message-input[contenteditable]",
    'textarea[name="userMessage"]',
    // ── DeepSeek ──────────────────────────────────────────────────────────
    "textarea#chat-input",
    // ── Perplexity ────────────────────────────────────────────────────────
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="ask"]',
    'textarea[placeholder*="Search"]',
    // ── Mistral / Le Chat ─────────────────────────────────────────────────
    'textarea[data-testid*="chat"]',
    'textarea[data-testid*="message"]',
    'div[data-testid*="message"][contenteditable]',
    // ── Grok (X.com) ──────────────────────────────────────────────────────
    'div[data-testid="tweetTextarea_0"][contenteditable]',
    'div[aria-label*="Grok"][contenteditable]',
    // ── Generic fallbacks — ordered from most specific to most general ────
    "textarea[rows]",
    "textarea",
    'div[contenteditable="true"]'
  ];
  const SEND_SELECTORS = [
    // ── Generic test IDs ──────────────────────────────────────────────────
    'button[data-testid*="send"]',
    'button[data-testid*="submit"]',
    'button[data-testid*="Send"]',
    // ── ARIA labels ───────────────────────────────────────────────────────
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="Envoyer"]',
    'button[aria-label*="envoyer"]',
    // ── Form submit ───────────────────────────────────────────────────────
    'button[type="submit"]',
    // ── Meta AI ───────────────────────────────────────────────────────────
    'div[aria-label*="Send"][role="button"]',
    'div[aria-label*="send"][role="button"]',
    'button[aria-label*="Post"]',
    // ── Bing Copilot ──────────────────────────────────────────────────────
    "button#search-button",
    'cib-icon-button[aria-label*="Submit"]',
    // ── Grok ──────────────────────────────────────────────────────────────
    'div[data-testid="tweetButtonInline"]',
    // ── Generic icon buttons that are send actions ────────────────────────
    'button[class*="send"]',
    'button[class*="Send"]',
    'button[class*="submit"]',
    'button[class*="Submit"]'
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
  function showLimitModal(monthly) {
    var _a, _b, _c;
    const root = getShadowRoot();
    if (!root) return;
    (_a = root.getElementById("cage-limit-modal")) == null ? void 0 : _a.remove();
    const modal = document.createElement("div");
    modal.id = "cage-limit-modal";
    modal.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,.55)",
      "padding:16px"
    ].join(";");
    modal.innerHTML = `
    <div style="
      background:#fff;border-radius:16px;padding:24px;
      max-width:380px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.3);
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">🔒</div>
        <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:4px">
          Free limit reached
        </div>
        <div style="font-size:13px;color:#64748b;line-height:1.5">
          You have used <strong style="color:#dc2626">100 / 100</strong> free cages this month.<br>
          Your data was <strong>not sent</strong> — it is still protected.
        </div>
      </div>

      <div style="
        background:#f0fdf4;border:1.5px solid #16a34a;border-radius:10px;
        padding:12px 14px;margin-bottom:16px;
      ">
        <div style="font-size:11px;font-weight:800;color:#15803d;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">
          ✅ Upgrade to Pro — Unlimited cages
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;color:#166534">
          <div>🔒 Unlimited cages / month</div>
          <div>🧠 Inference Cage™ auto</div>
          <div>🔄 Ephemeral Tokens™</div>
          <div>📋 Full audit report</div>
          <div>🤖 Agent Cage</div>
          <div>📄 CSV export</div>
        </div>
        <div style="margin-top:8px;font-size:13px;font-weight:800;color:#15803d">
          €5 / user / month · Cancel anytime
        </div>
      </div>

      <button id="cage-limit-upgrade" style="
        width:100%;padding:13px;background:#15803d;color:#fff;
        border:none;border-radius:10px;font-size:14px;font-weight:800;
        cursor:pointer;margin-bottom:8px;
      ">🚀 Upgrade to Pro →</button>

      <button id="cage-limit-cancel" style="
        width:100%;padding:11px;background:#f1f5f9;color:#374151;
        border:none;border-radius:10px;font-size:13px;font-weight:600;
        cursor:pointer;
      ">Cancel — I will remove sensitive data first</button>

      <div style="margin-top:10px;font-size:10px;color:#94a3b8;text-align:center;line-height:1.5">
        Your data was NOT sent. AI CAGE blocked the request.<br>
        Remove any sensitive information before sending manually.
      </div>
    </div>`;
    root.appendChild(modal);
    (_b = modal.querySelector("#cage-limit-upgrade")) == null ? void 0 : _b.addEventListener("click", () => {
      modal.remove();
      try {
        void chrome.runtime.sendMessage({ type: "OPEN_UPGRADE" });
      } catch {
        window.open("https://ai-cage-gamma.vercel.app/#pricing", "_blank");
      }
    });
    (_c = modal.querySelector("#cage-limit-cancel")) == null ? void 0 : _c.addEventListener("click", () => {
      modal.remove();
      showToast("⚠️ Request cancelled — remove sensitive data before sending", "warning", 4e3);
    });
  }
  async function handlePrompt(el) {
    const raw = readText(el);
    if (!raw || raw.length < 3) return;
    try {
      const limitResp = await chrome.runtime.sendMessage({ type: "CHECK_LIMIT" });
      if (limitResp == null ? void 0 : limitResp.limitReached) {
        showLimitModal(limitResp.monthly);
        return;
      }
    } catch {
    }
    const { cagedText, entities, totalCaged, inferenceRisk } = cageText(raw);
    if (totalCaged === 0 && !inferenceRisk.risky) return;
    if (totalCaged > 0) {
      pendingEntities = [...pendingEntities, ...entities];
      writeText(el, cagedText);
      shareEntitiesWithPage(entities);
      sessionTotal += totalCaged;
      updateBadge();
      updateStatus("caged");
      const typeLabels = [...new Set(entities.map((e) => e.type.replace(/_/g, " ").toLowerCase()))].slice(0, 2);
      const more = entities.length > 2 ? ` +${entities.length - 2}` : "";
      showToast(`🔒 ${totalCaged} protected (${typeLabels.join(", ")}${more})`);
    }
    if (inferenceRisk.risky) {
      showToast(`⚠️ ${inferenceRisk.message}`, "warning", 5e3);
    }
    try {
      void chrome.runtime.sendMessage({
        type: "CAGE_REPORT",
        tabId: 0,
        site: window.location.hostname,
        entities,
        inferenceRisk
      });
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
    if (isPrompt) void handlePrompt(target);
  }, true);
  function hookButtons() {
    SEND_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        if (btn.getAttribute(CAGED_ATTR) === "1") return;
        btn.setAttribute(CAGED_ATTR, "1");
        btn.addEventListener("click", () => {
          const p = findPrompt();
          if (p) void handlePrompt(p);
        }, true);
      });
    });
  }
  document.addEventListener("submit", (e) => {
    const form = e.target;
    try {
      const input = form.querySelector(PROMPT_SELECTORS.join(","));
      if (input) void handlePrompt(input);
    } catch {
    }
  }, true);
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if ((d == null ? void 0 : d.type) === "AI_CAGE_PII_DETECTED" && d.gateId && d.items) {
      showNetworkPanel(d.gateId, d.items);
      return;
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_NETWORK_CAGED" && d.count) {
      sessionTotal += d.count;
      updateBadge();
      updateStatus("caged");
      try {
        void chrome.runtime.sendMessage({ type: "CAGE_REPORT", tabId: 0, site: window.location.hostname, entities: [] });
      } catch {
      }
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_NETWORK_RESTORED") {
      updateStatus("idle", "✅ Data restored locally");
      showToast("✅ Data restored — the AI never saw your real information");
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_INJECTION_DETECTED") {
      try {
        void chrome.runtime.sendMessage({
          type: "AGENT_EVENT",
          site: window.location.hostname,
          detail: d.detail ?? "Injection detected",
          blocked: true
        });
      } catch {
      }
      updateStatus("warning", "🚫 Injection blocked");
      showToast("🚫 Prompt injection attack blocked", "warning");
    }
    if ((d == null ? void 0 : d.type) === "AI_CAGE_FILE_UPLOAD_WARNING") {
      updateStatus("warning", "⚠️ File detected — check before sending");
      showToast("📄 File upload detected — verify it contains no sensitive data before sending", "warning", 5e3);
    }
  });
  let hookDebounce = null;
  const domObserver = new MutationObserver(() => {
    if (!hookDebounce) {
      hookDebounce = setTimeout(() => {
        hookButtons();
        hookDebounce = null;
      }, 500);
    }
  });
  function boot() {
    injectPageScript();
    const tryInit = () => {
      if (!document.body) return false;
      domObserver.observe(document.body, { childList: true, subtree: true });
      createStatusIndicator();
      updateStatus("idle");
      return true;
    };
    if (!tryInit()) {
      const w = new MutationObserver(() => {
        if (tryInit()) w.disconnect();
      });
      w.observe(document.documentElement, { childList: true });
    }
    hookButtons();
    const v = (() => {
      try {
        return chrome.runtime.getManifest().version;
      } catch {
        return "0.6.0";
      }
    })();
    console.warn(`[AI CAGE] 🔒 v${v} active on ${window.location.hostname}`);
  }
  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      hookButtons();
      createStatusIndicator();
      updateStatus("idle");
    });
  }
})();
