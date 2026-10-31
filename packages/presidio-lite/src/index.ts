/**
 * @file index.ts
 * Public API surface for @ai-cage/presidio-lite.
 *
 * Exports only what downstream packages need.
 * Internal implementation details stay unexported.
 */

// PII detection
export type { EntityType, PiiMatch, Detector } from './types.js';
export type { ScanOptions } from './scan.js';
export { scanText } from './scan.js';
export { ALL_DETECTORS } from './detectors.js';

// Injection detection (Phase 3 — Cage 3: Agent Rogue)
export type { InjectionType, InjectionMatch, InjectionScanOptions } from './injectionDetectors.js';
export { scanForInjection, getHighestSeverity, isCriticalInjection } from './injectionDetectors.js';
