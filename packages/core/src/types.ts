/**
 * @file types.ts
 * Public types for @ai-cage/core.
 *
 * These types cross the boundary between the core library and its consumers
 * (extension, desktop app, future CLI). Keep them stable.
 */

import type { EntityType } from '@ai-cage/presidio-lite';

/**
 * A single caged entity — one piece of PII that was replaced in the text.
 *
 * Stored in memory only. Never serialised to disk or sent over any network.
 */
export interface CagedEntity {
  /**
   * The placeholder token injected into the caged text.
   * e.g. `[CAGED_EMAIL_1]`, `[CAGED_3]`
   */
  placeholder: string;

  /** The original raw value that was replaced. */
  originalValue: string;

  /** The PII category of the replaced value. */
  type: EntityType;

  /**
   * Detection confidence score (0–1).
   * Consumers can use this to decide whether to surface a warning.
   */
  score: number;
}

/**
 * The result returned by {@link cageText}.
 */
export interface CageResult {
  /**
   * The input text with all detected PII replaced by placeholders.
   * Safe to pass to an external AI provider.
   */
  cagedText: string;

  /**
   * The list of entities that were replaced, in order of appearance.
   * Pass this to {@link uncageText} to restore the original values.
   */
  entities: CagedEntity[];

  /**
   * Total number of PII items detected and caged.
   * Convenience alias for `entities.length`.
   */
  totalCaged: number;
}

/**
 * Options for {@link cageText}.
 */
export interface CageOptions {
  /**
   * Minimum confidence threshold (0–1) for a PII match to be caged.
   * Lower = more aggressive (more false positives).
   * Higher = more conservative (more false negatives).
   * @default 0.6
   */
  minScore?: number;

  /**
   * If true, the type label is included in the placeholder.
   * e.g. `[CAGED_EMAIL_1]` instead of `[CAGED_1]`.
   * @default true
   */
  labelledPlaceholders?: boolean;
}
