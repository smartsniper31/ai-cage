/**
 * @file cageTranscript.ts
 * AI CAGE Cage 5 — Voice/Video transcript caging.
 *
 * Meeting transcripts often contain participant names, company names,
 * and other PII. When these transcripts are uploaded to AI summarisation
 * services (Otter.ai, Fireflies.ai, Read.ai), the PII goes with them.
 *
 * cageTranscript() redacts all participant names from a transcript before
 * it's uploaded to any AI service. The names are replaced with
 * [PARTICIPANT_1], [PARTICIPANT_2], etc. — preserving conversational
 * structure while removing identity.
 *
 * SECURITY CONTRACT:
 *   - Zero network calls. All detection is local regex.
 *   - Original names are stored ONLY in the returned mapping (in-memory).
 *   - Never written to disk, localStorage, or any persistent store.
 */

import { scanText } from '@ai-cage/presidio-lite';
import type { EntityType } from '@ai-cage/presidio-lite';

/**
 * The result of caging a meeting transcript.
 */
export interface TranscriptCageResult {
  /** The transcript with all participant names replaced by [PARTICIPANT_N]. */
  cagedTranscript: string;
  /** Mapping from placeholder to original name. */
  participants: Array<{ placeholder: string; originalName: string }>;
  /** Total number of names redacted. */
  totalRedacted: number;
  /** True if any transcript markers were detected (confirms it IS a transcript). */
  isTranscript: boolean;
}

/**
 * Replaces participant names in a meeting transcript with safe placeholders.
 *
 * Strategy:
 *   1. Scan for MEETING_PARTICIPANT matches (name followed by ":" or "said:")
 *   2. Build a unique-name → placeholder mapping
 *   3. Replace all occurrences of each name with [PARTICIPANT_N]
 *   4. Also scan for PERSON_NAME entities as a fallback
 *
 * @param text - Raw meeting transcript text.
 * @returns {@link TranscriptCageResult} with caged transcript + name mapping.
 *
 * @example
 * ```ts
 * const result = cageTranscript(
 *   'Ahmed Ben Ali: We need to review the Q3 numbers.\n' +
 *   'Marie Dupont: I agree, let me pull the report.'
 * );
 * // cagedTranscript: '[PARTICIPANT_1]: We need to review...\n[PARTICIPANT_2]: I agree...'
 * // participants: [{ placeholder: '[PARTICIPANT_1]', originalName: 'Ahmed Ben Ali' }, ...]
 * ```
 */
export function cageTranscript(text: string): TranscriptCageResult {
  if (!text || !text.trim()) {
    return { cagedTranscript: '', participants: [], totalRedacted: 0, isTranscript: false };
  }

  // Step 1: Detect if this looks like a transcript
  const markerMatches = scanText(text, {
    minScore: 0.7,
  }).filter((m) => m.type === 'MEETING_TRANSCRIPT_MARKER' as EntityType);

  const isTranscript = markerMatches.length > 0;

  // Step 2: Extract participant names
  // Pattern: "Name Name:" or "Name Name said:" at line start
  const namePattern = /^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\s*(?::|said:|asked:|replied:|noted:)/gim;

  const names: string[] = [];
  let match: RegExpExecArray | null;
  namePattern.lastIndex = 0;
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1]?.trim() ?? '';
    if (name.length >= 3 && !names.includes(name)) {
      names.push(name);
    }
  }

  // Also scan for general PERSON_NAME matches as fallback
  const personMatches = scanText(text, { minScore: 0.5 })
    .filter((m) => m.type === 'PERSON_NAME');

  for (const pm of personMatches) {
    const name = pm.value.trim();
    if (name.length >= 5 && !names.includes(name)) {
      // Only add if it looks like a full name (at least 2 words or 1 word > 4 chars)
      if (name.includes(' ') || name.length > 4) {
        names.push(name);
      }
    }
  }

  // Step 3: Build placeholder mapping
  const participants: Array<{ placeholder: string; originalName: string }> = [];
  let counter = 1;

  // Sort names by length descending so longer names are replaced first
  // (prevents partial replacement of "Ahmed Ben Ali" when "Ahmed" is also found)
  const sortedNames = [...names].sort((a, b) => b.length - a.length);

  let cagedTranscript = text;

  for (const name of sortedNames) {
    const placeholder = `[PARTICIPANT_${counter}]`;
    counter++;

    participants.push({ placeholder, originalName: name });

    // Replace all occurrences (case-sensitive to avoid replacing common words)
    const namePattern = new RegExp(
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g',
    );
    cagedTranscript = cagedTranscript.replace(namePattern, placeholder);
  }

  return {
    cagedTranscript,
    participants,
    totalRedacted: participants.length,
    isTranscript,
  };
}

/**
 * Restores participant names in a summarised transcript returned by an AI service.
 *
 * @param cagedResponse - AI response containing [PARTICIPANT_N] placeholders.
 * @param participants - The participants array from the matching cageTranscript() call.
 * @returns The response with original names restored.
 */
export function uncageTranscript(
  cagedResponse: string,
  participants: ReadonlyArray<{ placeholder: string; originalName: string }>,
): string {
  let result = cagedResponse;
  for (const p of participants) {
    const escaped = p.placeholder.replace(/[[\]]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), p.originalName);
  }
  return result;
}
