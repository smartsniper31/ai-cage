// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// https://github.com/smartsniper31/ai-cage
// Licensed under Business Source License 1.1 — see LICENSE for details.
// Commercial use requires a license: contact@ai-cage.io

/**
 * @file cage.ts
 * The two core functions of AI CAGE:
 *
 *   cageText()   — replace PII with safe placeholders before sending to AI
 *   uncageText() — restore original values from the AI response
 *
 * SECURITY CONTRACT (auditors: read this first):
 *   - This module NEVER calls fetch(), XMLHttpRequest, WebSocket, or any
 *     network primitive. Grep for "fetch" and "XMLHttpRequest" to confirm.
 *   - No PII value is written to localStorage, IndexedDB, or any
 *     persistent browser storage. Entities live only in the call-site
 *     variable returned by cageText().
 *   - The replacement is deterministic: same input → same output, which
 *     makes the output auditable and unit-testable.
 */

import { scanText } from '@ai-cage/presidio-lite';
import type { EntityType } from '@ai-cage/presidio-lite';
import type { CageResult, CagedEntity, CageOptions, InferenceRisk } from './types.js';

// Re-export so consumers can import everything from @ai-cage/core.
export type { CageResult, CagedEntity, CageOptions, InferenceRisk };

// ---------------------------------------------------------------------------
// Session salt — ephemeral token rotation (Linkage Attack prevention)
// Rotates every session so [CAGED_EMAIL_A7X9_1] in session 1 becomes
// [CAGED_EMAIL_K3P2_1] in session 2. The AI cannot correlate prompts
// across sessions. Generated once per module load, never persisted.
// ---------------------------------------------------------------------------
function generateSessionSalt(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 ambiguity
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Salt generated once per session. Never stored, never transmitted. */
export const SESSION_SALT: string = generateSessionSalt();

// ---------------------------------------------------------------------------
// Quasi-identifier patterns — Inference Risk detection
// ---------------------------------------------------------------------------
const QUASI_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  // Age — "34 ans", "aged 45", "45 years old"
  { label: 'age',          pattern: /\b\d{1,3}\s*(?:ans?|years?\s*old|year[-\s]old|yo\b)/i },
  // Company size — "8 employees", "15 salariés", "équipe de 6"
  { label: 'team_size',    pattern: /\b\d{1,4}\s*(?:employ[eé]es?|salari[eé]s?|staff|workers?|personnes?|collaborateurs?|membres?)\b/i },
  // Monetary amount — "12 500 DT", "€ 8000", "$4,200", "15 000 €"
  { label: 'amount',       pattern: /(?:€|\$|£|DT|TND|EUR|USD)\s*[\d\s,.]+|[\d\s,.]+\s*(?:€|\$|£|DT|TND|EUR|USD)/i },
  // Specific date — "le 3 novembre", "signed on Nov 3", "03/11/2026"
  { label: 'specific_date', pattern: /\b(?:le\s+)?\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\b\d{1,2}\s+(?:jan(?:vier)?|f[eé]v(?:rier)?|mar(?:s|ch)?|avr(?:il)?|apr(?:il)?|mai|may|juin|jun(?:e)?|juil(?:let)?|jul(?:y)?|ao[uû]t|aug(?:ust)?|sep(?:t(?:embre|ember)?)?|oct(?:obre|ober)?|nov(?:embre|ember)?|d[eé]c(?:embre|ember)?)\b/i },
  // Named city / location — "in Bizerte", "à Sousse", "near Tunis"
  { label: 'city',         pattern: /\b(?:à|at|in|near|de)\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/ },
  // Professional role
  { label: 'role',         pattern: /\b(?:patron|gérant|CEO|director|manager|associate|partner|avocat|médecin|comptable|notaire|architecte|consultant)\b/i },
  // Contract / deal reference
  { label: 'deal_ref',     pattern: /\b(?:contrat|dossier|deal|affaire|cas|case|matter|n[°o]\.?\s*\d+)\b/i },
  // Industry / sector
  { label: 'sector',       pattern: /\b(?:agence|cabinet|étude|firm|studio|startup|société|entreprise|sarl|suarl|sa\b|llc|inc\b)\b/i },
];

/** Minimum number of quasi-identifiers to trigger an Inference Risk warning. */
const INFERENCE_THRESHOLD = 3;

/**
 * Counts distinct quasi-identifiers in a text.
 * Returns an InferenceRisk descriptor.
 * Does NOT modify the text — read-only analysis.
 */
export function detectQuasiIdentifiers(text: string): InferenceRisk {
  const clues: string[] = [];

  for (const { label, pattern } of QUASI_PATTERNS) {
    // Reset stateful regex
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      clues.push(label);
    }
  }

  const score = clues.length;
  const risky = score >= INFERENCE_THRESHOLD;

  let message = '';
  if (risky) {
    message =
      `Inference Risk: ${score} clues combined can identify you even without your name. ` +
      `(${clues.map(c => c.replace('_', ' ')).join(', ')})`;
  } else if (score > 0) {
    message =
      `${score} context clue${score > 1 ? 's' : ''} detected. ` +
      `Add ${INFERENCE_THRESHOLD - score} more and you become identifiable without your name.`;
  }

  return { score, risky, clues, message };
}

/**
 * Maps EntityType values to short, human-readable label strings used
 * in the placeholder tokens.
 */
const TYPE_LABEL: Record<EntityType, string> = {
  PERSON_NAME:    'NAME',
  EMAIL_ADDRESS:  'EMAIL',
  PHONE_NUMBER:   'PHONE',
  IBAN:           'IBAN',
  RIB_TN:         'RIB',
  CIN_TN:         'CIN',
  MF_TN:          'MF',
  PASSPORT_TN:    'PASSPORT',
  CARTE_SEJOUR:   'SEJOUR',
  CREDIT_CARD:    'CARD',
  API_KEY:        'APIKEY',
  PRIVATE_KEY:    'PRIVKEY',
  IP_ADDRESS:     'IP',
  URL:            'URL',
  DATE:           'DATE',
  PASSPORT:       'PASSPORT',
  GENERIC_SECRET: 'SECRET',
  MEETING_TRANSCRIPT_MARKER: 'TRANSCRIPT',
  MEETING_PARTICIPANT:       'PARTICIPANT',
  POSTAL_ADDRESS:            'ADDRESS',
};

/**
 * Replaces all detected PII in `text` with safe placeholder tokens.
 *
 * The returned {@link CageResult.entities} array is the "key" needed to
 * reverse the caging via {@link uncageText}. Guard it accordingly — it
 * contains the original sensitive values.
 *
 * @param text - Raw user text that may contain PII.
 * @param options - Optional tuning parameters.
 * @returns A {@link CageResult} with the sanitised text and entity map.
 *
 * @example
 * ```ts
 * const { cagedText, entities } = cageText(
 *   'Send invoice to alice@acme.io, card 4111 1111 1111 1111'
 * );
 * // cagedText => 'Send invoice to [CAGED_EMAIL_1], card [CAGED_CARD_2]'
 * // entities  => [{ placeholder: '[CAGED_EMAIL_1]', originalValue: 'alice@acme.io', ... }, ...]
 * ```
 */
export function cageText(text: string, options: CageOptions = {}): CageResult {
  const { minScore = 0.6, labelledPlaceholders = true, sessionSalt } = options;

  // Use provided salt or fall back to the module-level session salt.
  // This ensures tokens rotate every session automatically.
  const salt = sessionSalt ?? SESSION_SALT;

  // 1. Detect all PII — purely local, offline.
  const matches = scanText(text, { minScore });

  // 2. Run inference risk analysis (read-only, before any replacement)
  const inferenceRisk = detectQuasiIdentifiers(text);

  if (matches.length === 0) {
    return { cagedText: text, entities: [], totalCaged: 0, inferenceRisk };
  }

  // 3. Build entities and replacement map.
  const entities: CagedEntity[] = [];
  let counter = 1;

  // Work through matches in reverse order so string indices stay valid
  // as we splice replacements in.
  const sortedDesc = [...matches].sort((a, b) => b.start - a.start);

  let result = text;

  for (const match of sortedDesc) {
    const label = labelledPlaceholders ? `_${TYPE_LABEL[match.type]}` : '';
    // SESSION_SALT rotates every session → prevents cross-session linkage attacks.
    // e.g. [CAGED_EMAIL_A7X9_1] in session 1, [CAGED_EMAIL_K3P2_1] in session 2.
    const placeholder = `[CAGED${label}_${salt}_${counter}]`;
    counter++;

    entities.unshift({
      placeholder,
      originalValue: match.value,
      type: match.type,
      score: match.score,
    });

    result = result.slice(0, match.start) + placeholder + result.slice(match.end);
  }

  return {
    cagedText: result,
    entities,
    totalCaged: entities.length,
    inferenceRisk,
  };
}

/**
 * Restores original PII values in an AI-generated response by replacing
 * placeholders with their original values.
 *
 * Call this on the AI's response *before* displaying it to the user.
 * The entities array must be the exact one returned by the matching
 * {@link cageText} call.
 *
 * @param cagedResponse - The AI's response that may contain placeholder tokens.
 * @param entities - The entities array from the corresponding {@link cageText} call.
 * @returns The response with all placeholders restored to original values.
 *
 * @example
 * ```ts
 * const { cagedText, entities } = cageText('email alice@acme.io');
 * const aiResponse = await sendToAI(cagedText); // '[CAGED_EMAIL_1] is valid'
 * const restored = uncageText(aiResponse, entities);
 * // => 'alice@acme.io is valid'
 * ```
 */
export function uncageText(
  cagedResponse: string,
  entities: readonly CagedEntity[],
): string {
  let result = cagedResponse;

  for (const entity of entities) {
    // Escape the placeholder for use in a RegExp (brackets are special chars).
    const escaped = entity.placeholder.replace(/[[\]]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    result = result.replace(pattern, entity.originalValue);
  }

  return result;
}

/**
 * Returns a redacted summary of caged entities suitable for display in
 * audit logs or UI banners. NEVER includes the original values.
 *
 * @param entities - The entities from a {@link cageText} call.
 * @returns An array of audit-safe summaries.
 *
 * @example
 * ```ts
 * summariseCaged(entities);
 * // => [{ placeholder: '[CAGED_EMAIL_1]', type: 'EMAIL_ADDRESS', score: 0.95 }]
 * ```
 */
export function summariseCaged(
  entities: readonly CagedEntity[],
): Array<{ placeholder: string; type: EntityType; score: number }> {
  return entities.map(({ placeholder, type, score }) => ({
    placeholder,
    type,
    score,
  }));
}
