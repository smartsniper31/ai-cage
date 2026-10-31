/**
 * @file scan.ts
 * Core scanning function for presidio-lite.
 *
 * SECURITY NOTE: This module NEVER calls fetch(), XMLHttpRequest, or any
 * network API. All detection is pure regex over the input string.
 * This is enforced by the zero-external-deps rule and verified in CI.
 */

import type { PiiMatch, Detector } from './types.js';
import { ALL_DETECTORS } from './detectors.js';

/**
 * Options for controlling scan behaviour.
 */
export interface ScanOptions {
  /**
   * Minimum confidence score (0–1) for a match to be included.
   * @default 0.5
   */
  minScore?: number;
  /**
   * If true, overlapping matches are deduplicated: the higher-score
   * match wins when two matches overlap in the source text.
   * @default true
   */
  deduplicateOverlaps?: boolean;
  /**
   * Subset of detectors to run. If omitted, ALL_DETECTORS is used.
   */
  detectors?: readonly Detector[];
}

/**
 * Scans a text string and returns all detected PII matches.
 *
 * @param text - The raw input string to scan.
 * @param options - Optional tuning parameters.
 * @returns Array of {@link PiiMatch} objects, sorted by start position.
 *
 * @example
 * ```ts
 * const matches = scanText('Contact alice@example.com or +216 12 345 678');
 * // [{ type: 'EMAIL_ADDRESS', value: 'alice@example.com', ... },
 * //  { type: 'PHONE_NUMBER',  value: '+216 12 345 678',  ... }]
 * ```
 */
export function scanText(text: string, options: ScanOptions = {}): PiiMatch[] {
  const {
    minScore = 0.5,
    deduplicateOverlaps = true,
    detectors = ALL_DETECTORS,
  } = options;

  const raw: PiiMatch[] = [];

  for (const detector of detectors) {
    for (const pattern of detector.patterns) {
      // Always reset lastIndex — patterns have the `g` flag.
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[1] ?? match[0]; // prefer capture group 1 when present
        const start = match.index + (match[0].indexOf(value));
        const end = start + value.length;

        if (detector.defaultScore >= minScore) {
          raw.push({
            type: detector.type,
            value,
            start,
            end,
            score: detector.defaultScore,
          });
        }

        // Guard against zero-length matches causing infinite loops
        if (match[0].length === 0) {
          pattern.lastIndex++;
        }
      }
      // Reset after use so the pattern is reusable
      pattern.lastIndex = 0;
    }
  }

  if (!deduplicateOverlaps) {
    return raw.sort((a, b) => a.start - b.start);
  }

  return deduplicateMatches(raw);
}

/**
 * Removes overlapping matches, keeping the higher-score (or first-seen) one.
 * Operates in O(n log n) time.
 *
 * @param matches - Unsorted array of raw matches.
 * @returns Deduplicated array sorted by start position.
 */
function deduplicateMatches(matches: PiiMatch[]): PiiMatch[] {
  // Sort: highest score first, then by start position
  const sorted = [...matches].sort((a, b) =>
    b.score - a.score || a.start - b.start,
  );

  const result: PiiMatch[] = [];

  for (const candidate of sorted) {
    const overlaps = result.some(
      (kept) => candidate.start < kept.end && candidate.end > kept.start,
    );
    if (!overlaps) {
      result.push(candidate);
    }
  }

  return result.sort((a, b) => a.start - b.start);
}
