import type { EntityType } from '@ai-cage/presidio-lite';

/**
 * Inference risk analysis result.
 * Returned by detectQuasiIdentifiers() and included in every CageResult.
 */
export interface InferenceRisk {
  /** Number of distinct quasi-identifiers detected. */
  score: number;
  /** true when score >= 3 (identity inference threshold) */
  risky: boolean;
  /** Labels of the detected quasi-identifiers, e.g. ["age","city","amount"] */
  clues: string[];
  /** Ready-to-display message for the UI. */
  message: string;
}

/**
 * A single caged entity — one piece of PII that was replaced in the text.
 *
 * Stored in memory only. Never serialised to disk or sent over any network.
 */
export interface CagedEntity {
  placeholder: string;
  originalValue: string;
  type: EntityType;
  score: number;
}

/**
 * The result returned by {@link cageText}.
 */
export interface CageResult {
  cagedText: string;
  entities: CagedEntity[];
  totalCaged: number;
  /**
   * Inference risk analysis — present even when totalCaged === 0.
   * Tells the UI whether the prompt contains quasi-identifiers that
   * could identify the user without any direct PII.
   */
  inferenceRisk: InferenceRisk;
}

/**
 * Options for {@link cageText}.
 */
export interface CageOptions {
  /**
   * Minimum confidence threshold (0–1) for a PII match to be caged.
   * @default 0.6
   */
  minScore?: number;

  /**
   * If true, the type label is included in the placeholder.
   * e.g. `[CAGED_EMAIL_A7X9_1]` instead of `[CAGED_A7X9_1]`.
   * @default true
   */
  labelledPlaceholders?: boolean;

  /**
   * Session salt for ephemeral token rotation (Linkage Attack prevention).
   * If omitted, the module-level SESSION_SALT is used automatically.
   * Override only in tests to get deterministic output.
   */
  sessionSalt?: string;
}
