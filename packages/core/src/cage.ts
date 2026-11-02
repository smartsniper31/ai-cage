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
import type { CageResult, CagedEntity, CageOptions } from './types.js';

// Re-export so consumers can import everything from @ai-cage/core.
export type { CageResult, CagedEntity, CageOptions };

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
  MEETING_PARTICIPANT: 'PARTICIPANT',
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
  const { minScore = 0.6, labelledPlaceholders = true } = options;

  // 1. Detect all PII — purely local, offline.
  const matches = scanText(text, { minScore });

  if (matches.length === 0) {
    return { cagedText: text, entities: [], totalCaged: 0 };
  }

  // 2. Build entities and replacement map.
  const entities: CagedEntity[] = [];
  let counter = 1;

  // Work through matches in reverse order so string indices stay valid
  // as we splice replacements in.
  const sortedDesc = [...matches].sort((a, b) => b.start - a.start);

  let result = text;

  for (const match of sortedDesc) {
    const label = labelledPlaceholders ? `_${TYPE_LABEL[match.type]}` : '';
    const placeholder = `[CAGED${label}_${counter}]`;
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
