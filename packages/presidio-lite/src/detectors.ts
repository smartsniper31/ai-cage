// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// https://github.com/smartsniper31/ai-cage
// Licensed under Business Source License 1.1 — see LICENSE for details.
// Commercial use requires a license: contact@ai-cage.io

/**
 * @file detectors.ts
 * All PII regex detectors for presidio-lite.
 *
 * Design rules (non-negotiable):
 *   1. Every pattern must use the `g` (global) flag.
 *   2. No network calls. No imports from node:net, node:dns, etc.
 *   3. Patterns must have a comment explaining what they match.
 *   4. When a pattern is intentionally broad (lower precision), set defaultScore < 0.8.
 */

import type { Detector } from './types.js';

// ---------------------------------------------------------------------------
// Existing detectors (unchanged)
// ---------------------------------------------------------------------------

/**
 * Email addresses — RFC 5321 simplified.
 * e.g. user.name+tag@example.co.uk
 */
const emailDetector: Detector = {
  name: 'Email Address',
  type: 'EMAIL_ADDRESS',
  patterns: [
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  ],
  defaultScore: 0.95,
};

/**
 * International phone numbers.
 * Covers +216 XX XXX XXX (Tunisia), +33 X XX XX XX XX (France),
 * +1 (NNN) NNN-NNNN (US/CA), and generic international formats.
 */
const phoneDetector: Detector = {
  name: 'Phone Number',
  type: 'PHONE_NUMBER',
  patterns: [
    /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g,
    /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g,
  ],
  defaultScore: 0.75,
};

/**
 * IBAN — ISO 13616.
 * e.g. TN5910006035183598478831 (Tunisia), FR76 3000 6000 0112 3456 7890 189 (France)
 */
const ibanDetector: Detector = {
  name: 'IBAN',
  type: 'IBAN',
  patterns: [
    /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,7}[A-Z0-9]{0,4}\b/g,
  ],
  defaultScore: 0.90,
};

/**
 * Tunisian RIB — 20 digits, optionally spaced as 2/3/13/2.
 */
const ribTnDetector: Detector = {
  name: 'Tunisian RIB',
  type: 'RIB_TN',
  patterns: [
    /\b\d{20}\b/g,
    /\b\d{2}[\s]\d{3}[\s]\d{13}[\s]\d{2}\b/g,
  ],
  defaultScore: 0.80,
};

/**
 * Tunisian CIN — 8 digits, optionally preceded by "CIN" label.
 */
const cinTnDetector: Detector = {
  name: 'Tunisian CIN',
  type: 'CIN_TN',
  patterns: [
    /\b(?:CIN|N°\s?CIN|Carte\s+Identit[ée])\s*[:\-]?\s*(\d{8})\b/gi,
    /\b\d{8}\b/g,
  ],
  defaultScore: 0.65,
};

/**
 * Credit / debit card numbers.
 * Visa (4xxx), Mastercard (5xxx/2xxx), Amex (3xxx), Discover (6xxx).
 */
const creditCardDetector: Detector = {
  name: 'Credit Card',
  type: 'CREDIT_CARD',
  patterns: [
    /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2}|6(?:011|5\d{2}))[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    /\b3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5}\b/g,
  ],
  defaultScore: 0.90,
};

/**
 * API keys — AWS, GitHub PAT, Stripe, OpenAI, Anthropic, Google, Slack,
 * Bearer tokens, generic key= patterns.
 *
 * P0-2 FIX: Added sk-test-/sk-proj- (OpenAI), sk-ant- (Anthropic),
 * gsk_ (Groq), xoxb-/xoxp- (Slack), AIza (Google API).
 */
const apiKeyDetector: Detector = {
  name: 'API Key / Secret',
  type: 'API_KEY',
  patterns: [
    // AWS Access Key ID
    /\bAKIA[0-9A-Z]{16}\b/g,
    // GitHub Personal Access Tokens (classic + fine-grained)
    /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,255}\b/g,
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
    // Google API Key (AIza)
    /\bAIza[A-Za-z0-9\-_]{35}\b/g,
    // Generic key=/secret= patterns
    /\b(?:api[_\-]?key|secret[_\-]?key|access[_\-]?token)\s*[=:]\s*["']?[A-Za-z0-9\-_.+/]{20,}["']?/gi,
    // Bearer tokens
    /Bearer\s+[A-Za-z0-9\-_.+/=]{20,}/g,
  ],
  defaultScore: 0.88,
};

/**
 * PEM private key headers.
 */
const privateKeyDetector: Detector = {
  name: 'Private Key',
  type: 'PRIVATE_KEY',
  patterns: [
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  ],
  defaultScore: 1.0,
};

/**
 * IPv4 and IPv6 addresses.
 */
const ipDetector: Detector = {
  name: 'IP Address',
  type: 'IP_ADDRESS',
  patterns: [
    /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b/g,
  ],
  defaultScore: 0.85,
};

/**
 * Generic secrets — password/token in config patterns.
 *
 * P0-2 FIX: Added French password patterns:
 * "mot de passe", "mdp", "motdepasse" + "mon mot de passe est X"
 */
const genericSecretDetector: Detector = {
  name: 'Generic Secret',
  type: 'GENERIC_SECRET',
  patterns: [
    // English: password= / pwd= / passwd=
    /\b(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{6,}["']?/gi,
    // French: mot de passe = / mdp = / motdepasse =
    /\b(?:mot\s+de\s+passe|motdepasse|mdp)\s*[=:\-]\s*["']?[^\s"',;]{6,}["']?/gi,
    // French natural language: "mon mot de passe est Azerty123"
    /\b(?:mon\s+)?(?:mot\s+de\s+passe|mdp)\s+(?:est|is|:)\s+["']?([^\s"',;]{6,})["']?/gi,
    // Generic token / secret / credential key-value
    /\b(?:token|secret|credential)\s*[=:]\s*["']?[A-Za-z0-9\-_.+/]{16,}["']?/gi,
  ],
  defaultScore: 0.82,
};

/**
 * International passport — generic letter(s) + digits format.
 */
const passportDetector: Detector = {
  name: 'Passport Number',
  type: 'PASSPORT',
  patterns: [
    /\b[A-Z]{1,2}\d{6,9}\b/g,
    /\b\d{2}[A-Z]{2}\d{5}\b/g,
  ],
  defaultScore: 0.70,
};

// ---------------------------------------------------------------------------
// NEW — Phase 2 detectors
// ---------------------------------------------------------------------------

/**
 * Tunisian Matricule Fiscal (MF).
 * Official format: 7 digits + slash + letter + slash + letter + slash + 3 digits.
 * e.g. 1234567/A/P/000 or 1234567/A/N/000
 * Ref: Direction Générale des Impôts (DGI) Tunisia.
 */
const mfTnDetector: Detector = {
  name: 'Tunisian Matricule Fiscal',
  type: 'MF_TN',
  patterns: [
    // Standard format with slashes
    /\b\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/g,
    // With label
    /\b(?:MF|Matricule\s+Fiscal)\s*[:\-]?\s*\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}\b/gi,
    // Compact without label (lower confidence)
    /\b\d{7}[A-Z]{3}\d{3}\b/g,
  ],
  defaultScore: 0.92,
};

/**
 * Tunisian passport number.
 * Format: letter + 7 digits (e.g. A1234567, B7654321).
 * Distinguished from generic PASSPORT by explicit Tunisian context pattern
 * and higher specificity (exactly 1 letter + 7 digits).
 */
const passportTnDetector: Detector = {
  name: 'Tunisian Passport',
  type: 'PASSPORT_TN',
  patterns: [
    // Preceded by passport label
    /\b(?:Passeport|Passport\s+N°?|N°?\s*Passeport)\s*[:\-]?\s*([A-Z]\d{7})\b/gi,
    // Standalone (exact: 1 uppercase + 7 digits)
    /\b[A-Z]\d{7}\b/g,
  ],
  defaultScore: 0.78,
};

/**
 * Titre de séjour / Carte de séjour (French/Tunisian residence permit).
 *
 * French format: 2-letter département code + 6 digits + 2-letter suffix.
 * e.g. 75 123456 01 or 75123456A01
 * Often referred to by labels: "titre de séjour", "carte de séjour", "récépissé".
 */
const carteSejourDetector: Detector = {
  name: 'Carte de Séjour / Titre de Séjour',
  type: 'CARTE_SEJOUR',
  patterns: [
    // Preceded by label
    /\b(?:titre\s+de\s+s[eé]jour|carte\s+de\s+s[eé]jour|r[eé]c[eé]piss[eé])\s*[:\-]?\s*([A-Z0-9\s\-]{6,20})\b/gi,
    // French format: dept (2 digits) + 6 digits + optional 2-digit suffix
    /\b\d{2}[\s\-]?\d{6}[\s\-]?\d{2}\b/g,
  ],
  defaultScore: 0.72,
};

/**
 * Person names — Phase 2 improvements.
 *
 * Strategy:
 *   1. High-confidence: name preceded by an explicit label ("Nom:", "Name:").
 *   2. Arabic name patterns: common Tunisian/Arab first names + "Ben/Bel/El/Al" + family names.
 *   3. French/European: title-cased word pairs not in a common stop-word list.
 *
 * P0-4 FIX: Added "Nom du client : X Y Z" and similar label patterns.
 * Also tightened pattern 3 to require lowercase continuation (excludes
 * single-word titles like "Passeport", "Adresse", "Téléphone").
 */
const personNameDetector: Detector = {
  name: 'Person Name',
  type: 'PERSON_NAME',
  patterns: [
    // ── High-confidence: explicit label ──────────────────────────────────
    // "Nom: Ahmed Ben Ali" / "Name: Marie Dupont" / "Nom du client : Karim Ben Salah"
    /\b(?:Nom\s+(?:du\s+client|et\s+Pr[eé]nom|Complet|de\s+l[''](?:employ[eé]|agent|utilisateur))|Full\s+Name|Name|Pr[eé]nom\s+(?:et\s+Nom)?|Nom)\s*[:\-]\s*([A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+(?:\s+[A-ZÀ-Ÿ\u0600-\u06FF][a-zA-Zà-ÿ\u0600-\u06FF]+){1,3})/gi,

    // ── Arabic-origin Tunisian names ──────────────────────────────────────
    /\b(?:Mohamed?|Mohamad|Muhamed?|Ahmad?|Ahmed?|Ali|Omar|Youssef|Yousef|Khaled|Khalid|Sami|Samir|Rami|Tarek|Tariq|Imed|Wissem|Wassim|Karim|Slim|Hamza|Walid|Fethi|Nabil|Hedi|Lotfi|Mounir|Hatem|Aymen|Bilel|Amine|Hichem|Sofien|Ramzi|Bassem|Maher|Faouzi|Adel|Zied|Chokri|Anis|Riyadh|Mondher|Riadh|Fatma|Ines|Sonia|Emna|Rim|Nour|Olfa|Mariem|Amira|Hela|Wafa|Asma|Manel|Rania|Sirine|Imen|Najet|Lobna|Sabrina|Salma|Yosra)\s+(?:Ben|Bel|El|Al|Ould|Bent|Bint|Bou|Hadj)\s+[A-ZÀ-Ÿa-zà-ÿ]{2,20}/g,

    // ── French / European name pairs ──────────────────────────────────────
    // Requires lower-case characters in both words to exclude single-word
    // labels like "Passeport", "Adresse", "Téléphone" that are followed by ":"
    // The negative lookahead prevents matching words directly before ":"
    /\b(?!(?:The|A|An|In|On|At|By|For|From|With|This|That|These|Those|It|Is|Are|Was|Were|Has|Have|Had|Be|Been|Being|Do|Does|Did|Will|Would|Could|Should|May|Might|Must|Shall|Can|Need|Dare|Used|Ought|Nom|Email|Tel|Fax|Date|Adresse|Passeport|Passport|Telephone|IBAN|RIB|CIN|MF)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}\s+(?!(?:API|URL|HTTP|SQL|JSON|XML|CSS|HTML|PDF|CSV|AI|ML|UI|UX|ID|DB)\s)[A-ZÀ-Ÿ][a-zà-ÿ]{2,20}(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]{2,20})?(?!\s*:)\b/g,
  ],
  defaultScore: 0.58,
};

/**
 * Postal address detector — street addresses in French, English, Arabic-Latin.
 *
 * Covers patterns like:
 *   - "12 Rue Habib Bourguiba, Monastir 5000"
 *   - "Avenue de la Liberté, Tunis"
 *   - "12 Main Street, London SW1A 1AA"
 *   - preceded by labels: "Adresse:", "Address:", "Domicile:"
 *
 * Design note: score 0.72 — addresses are inherently ambiguous.
 * We require a street-type keyword OR a postal code to avoid false positives.
 */
const postalAddressDetector: Detector = {
  name: 'Postal Address',
  type: 'POSTAL_ADDRESS',
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
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/g,
  ],
  defaultScore: 0.72,
};

// ---------------------------------------------------------------------------
// Phase 4 — Cage 5: Voice/Video transcript detectors
// ---------------------------------------------------------------------------

/**
 * Meeting transcript markers — headers, timestamps, and format indicators
 * that signal this text is a meeting transcript (Cage 5: Voice/Video).
 * Detecting these triggers the cageTranscript() pipeline which redacts
 * all participant names before the transcript is uploaded to an AI summariser.
 */
const transcriptMarkerDetector: Detector = {
  name: 'Meeting Transcript Marker',
  type: 'MEETING_TRANSCRIPT_MARKER',
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
    /\b(?:Generated\s+by|Transcribed\s+by|Powered\s+by)\s+(?:Otter|Fireflies|Read\.ai|tl;dv|Fathom|Rev|Sonix|Descript)/gi,
  ],
  defaultScore: 0.82,
};

/**
 * Meeting participant lines — identifies lines where a named person
 * is speaking in a transcript. Used by cageTranscript() to know which
 * lines to redact.
 *
 * P0-1 FIX: Require minimum 2 capitalised words to avoid matching
 * single-word labels like "Period:", "From:", "Summary:", "Date:".
 * Single-word labels are structural markers, not participant names.
 */
const meetingParticipantDetector: Detector = {
  name: 'Meeting Participant',
  type: 'MEETING_PARTICIPANT',
  patterns: [
    // Requires EXACTLY 2-3 title-case words before the colon (First Last: speech)
    // Excludes single-word labels like "Period:", "Date:", "From:", "AI:"
    /\b([A-ZÀ-Ÿ][a-zà-ÿ]{1,20}\s+[A-ZÀ-Ÿ][a-zà-ÿ]{1,20}(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]{1,20})?)\s*:\s+(?=[A-ZÀ-Ÿa-zà-ÿ])/g,
    // "John said:", "John asked:", "John replied:" — single word OK only with speech verb
    /\b([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\s+(?:said|asked|replied|noted|added|stated):\s/gi,
  ],
  defaultScore: 0.68,
};

// ---------------------------------------------------------------------------
// Ordered detector list
// ---------------------------------------------------------------------------

/**
 * All active detectors, ordered highest-confidence first.
 * The deduplication in scan.ts will prefer the first match in case of overlap.
 *
 * P0-3 FIX: ibanDetector and ribTnDetector placed BEFORE phoneDetector.
 * RIB TN (20 digits) and IBAN both contain digit sequences that phoneDetector
 * would partially match. Higher score alone is insufficient when the phone
 * pattern matches a SUB-SEQUENCE — ordering ensures longest/most-specific
 * match runs first and the overlap deduplication discards the phone match.
 */
export const ALL_DETECTORS: readonly Detector[] = [
  privateKeyDetector,       // 1.00 — PEM keys, unambiguous
  mfTnDetector,             // 0.92 — Tunisian tax ID, very specific format
  emailDetector,            // 0.95 — RFC email
  creditCardDetector,       // 0.90 — Luhn-format card numbers
  ibanDetector,             // 0.90 — ISO 13616, MUST be before phone
  ribTnDetector,            // 0.80 — 20-digit TN RIB, MUST be before phone
  apiKeyDetector,           // 0.88 — API keys (sk-, ghp_, etc.)
  genericSecretDetector,    // 0.82 — passwords, tokens
  transcriptMarkerDetector, // 0.82 — Cage 5 transcript markers
  ipDetector,               // 0.85 — IPv4/IPv6
  passportTnDetector,       // 0.78 — TN passport (1 letter + 7 digits)
  phoneDetector,            // 0.75 — AFTER RIB/IBAN to avoid sub-match
  postalAddressDetector,    // 0.72 — street addresses
  carteSejourDetector,      // 0.72 — residence permit
  meetingParticipantDetector, // 0.68 — Cage 5 participants
  passportDetector,         // 0.70 — generic passport
  cinTnDetector,            // 0.65 — TN CIN 8 digits
  personNameDetector,       // 0.58 — names (broadest, last)
];
