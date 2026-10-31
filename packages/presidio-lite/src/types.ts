/**
 * @file types.ts
 * Shared types for presidio-lite PII detection.
 * All detection is performed locally — no network calls, no external dependencies.
 */

/**
 * The category of a detected PII entity.
 * Extend this union as new detectors are added.
 */
export type EntityType =
  | 'PERSON_NAME'
  | 'EMAIL_ADDRESS'
  | 'PHONE_NUMBER'
  | 'IBAN'
  | 'RIB_TN'          // Tunisian bank account (RIB)
  | 'CIN_TN'          // Tunisian national ID (CIN)
  | 'MF_TN'           // Tunisian Matricule Fiscal
  | 'PASSPORT_TN'     // Tunisian passport number
  | 'CARTE_SEJOUR'    // French/Tunisian residence permit
  | 'CREDIT_CARD'
  | 'API_KEY'
  | 'PRIVATE_KEY'
  | 'IP_ADDRESS'
  | 'URL'
  | 'DATE'
  | 'PASSPORT'
  | 'GENERIC_SECRET'
  | 'MEETING_TRANSCRIPT_MARKER'  // Cage 5: transcript headers, speaker labels, timestamps
  | 'MEETING_PARTICIPANT';       // Cage 5: "John said:", "Speaker 1:", participant lines

/**
 * A single PII match found in a text.
 */
export interface PiiMatch {
  /** Category of the detected entity. */
  type: EntityType;
  /** The raw matched string from the input text. */
  value: string;
  /** Zero-based start index in the original text. */
  start: number;
  /** Zero-based end index (exclusive) in the original text. */
  end: number;
  /** Confidence score between 0 and 1. */
  score: number;
}

/**
 * A single PII detector definition.
 */
export interface Detector {
  /** Human-readable name. */
  name: string;
  /** The entity type this detector identifies. */
  type: EntityType;
  /**
   * One or more regex patterns. Each must have the `g` flag.
   * Multiple patterns let us cover regional variations without
   * building a heavy NLP model.
   */
  patterns: RegExp[];
  /** Default confidence score assigned to all matches from this detector. */
  defaultScore: number;
}
