// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Unit tests for mobileCage.ts
// Licensed under Business Source License 1.1

/**
 * @file mobileCage.test.ts
 *
 * Tests the React Native wrapper around @ai-cage/core.
 * Uses in-memory storage adapters — zero real AsyncStorage or SecureStore calls.
 *
 * WHAT WE TEST:
 *   1. mobileCage()        — PII replacement + audit log (no PII stored)
 *   2. mobileUncage()      — round-trip restoration
 *   3. mobileAnalyzeRisk() — quasi-identifier detection
 *   4. mobileMatchEndpoint()— AI endpoint recognition
 *   5. License flow         — activate / check / deactivate
 *   6. Security contract    — entities never written to storage
 *
 * NOTE ON jest.mock():
 *   jest.mock() is hoisted by Babel/Jest before imports, so it must
 *   use the global `jest` object (not the imported one from @jest/globals).
 *   The describe/it/expect/beforeEach imports come from @jest/globals for
 *   TypeScript type safety. Both coexist correctly in this setup.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ── In-memory stores (populated by mocks below) ───────────────────────────────
const asyncStore: Record<string, string> = {};
const secureStore: Record<string, string> = {};

// ── Mocks — must use global jest (hoisted before imports) ─────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn((k: string) => Promise.resolve(asyncStore[k] ?? null)),
  setItem:    jest.fn((k: string, v: string) => { asyncStore[k] = v; return Promise.resolve(); }),
  removeItem: jest.fn((k: string) => { delete asyncStore[k]; return Promise.resolve(); }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn((k: string) => Promise.resolve(secureStore[k] ?? null)),
  setItemAsync:    jest.fn((k: string, v: string) => { secureStore[k] = v; return Promise.resolve(); }),
  deleteItemAsync: jest.fn((k: string) => { delete secureStore[k]; return Promise.resolve(); }),
}));

import {
  mobileCage,
  mobileUncage,
  mobileAnalyzeRisk,
  mobileMatchEndpoint,
  mobileCheckLicense,
  mobileActivateLicense,
  mobileDeactivateLicense,
  mobileGetAuditSummary,
} from '../lib/mobileCage';

// ── Helper ────────────────────────────────────────────────────────────────────

function clearStorage(): void {
  Object.keys(asyncStore).forEach(k => delete asyncStore[k]);
  Object.keys(secureStore).forEach(k => delete secureStore[k]);
}

// ── 1. mobileCage — PII replacement ──────────────────────────────────────────

describe('mobileCage — PII replacement', () => {
  beforeEach(clearStorage);

  it('cages an email address', async () => {
    const result = await mobileCage('Send invoice to alice@acme.io');
    expect(result.cagedText).not.toContain('alice@acme.io');
    expect(result.cagedText).toContain('[CAGED_EMAIL_');
    expect(result.totalCaged).toBe(1);
    expect(result.entities[0]?.type).toBe('EMAIL_ADDRESS');
    expect(result.entities[0]?.originalValue).toBe('alice@acme.io');
  });

  it('cages an IBAN — Tunisian 18-char format', async () => {
    const result = await mobileCage('IBAN: TN5910006035183598');
    expect(result.cagedText).not.toContain('TN5910006035183598');
    expect(result.cagedText).toContain('[CAGED_IBAN_');
    expect(result.totalCaged).toBe(1);
  });

  it('cages multiple PII types in one prompt', async () => {
    const result = await mobileCage(
      'My email is test@company.com and my IBAN is TN5910006035183598',
    );
    expect(result.cagedText).not.toContain('test@company.com');
    expect(result.cagedText).not.toContain('TN5910006035183598');
    expect(result.totalCaged).toBeGreaterThanOrEqual(2);
  });

  it('returns empty entities when no PII found', async () => {
    const result = await mobileCage('What is the weather today?');
    expect(result.totalCaged).toBe(0);
    expect(result.entities).toHaveLength(0);
    expect(result.cagedText).toBe('What is the weather today?');
  });

  it('writes to audit log after caging', async () => {
    await mobileCage('Contact bob@example.com now');
    const summary = await mobileGetAuditSummary();
    // getAuditSummary returns totalCaged (not monthlyCageCount)
    expect(summary.totalCaged).toBeGreaterThanOrEqual(1);
  });

  it('SECURITY: entities never stored in AsyncStorage', async () => {
    await mobileCage('My email is secret@private.io');
    const allValues = Object.values(asyncStore);
    allValues.forEach(v => {
      expect(v).not.toContain('secret@private.io');
    });
    Object.keys(asyncStore).forEach(k => {
      expect(k).not.toContain('secret@private.io');
    });
  });
});

// ── 2. mobileUncage — round-trip restoration ──────────────────────────────────

describe('mobileUncage — round-trip restoration', () => {
  it('restores a caged email after AI response', async () => {
    const { cagedText, entities } = await mobileCage(
      'Send confirmation to alice@example.com',
    );
    const placeholder = cagedText.match(/\[CAGED_EMAIL_[^\]]+\]/)?.[0] ?? '';
    const aiResponse  = `Confirmation sent to ${placeholder}`;
    const restored    = mobileUncage(aiResponse, entities);
    expect(restored).toContain('alice@example.com');
  });

  it('leaves non-caged text unchanged', () => {
    const result = mobileUncage('No placeholders here', []);
    expect(result).toBe('No placeholders here');
  });

  it('round-trip: cage then uncage returns original', async () => {
    const original = 'Invoice to test@company.com, IBAN TN5910006035183598';
    const { cagedText, entities } = await mobileCage(original);
    const restored = mobileUncage(cagedText, entities);
    expect(restored).toBe(original);
  });
});

// ── 3. mobileAnalyzeRisk — inference risk detection ──────────────────────────

describe('mobileAnalyzeRisk — inference risk detection', () => {
  it('detects no risk in a simple query', () => {
    const risk = mobileAnalyzeRisk('What is React Native?');
    expect(risk.risky).toBe(false);
    expect(risk.score).toBe(0);
  });

  it('detects inference risk when 3+ quasi-identifiers are combined', () => {
    const risk = mobileAnalyzeRisk(
      'My client, 34 years old, runs an agency of 8 people in Bizerte, contract worth 12500 DT',
    );
    expect(risk.score).toBeGreaterThanOrEqual(3);
    expect(risk.risky).toBe(true);
    expect(risk.clues.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 4. mobileMatchEndpoint — AI endpoint recognition ─────────────────────────

describe('mobileMatchEndpoint — AI endpoint recognition', () => {
  it('recognises ChatGPT API endpoint', () => {
    const match = mobileMatchEndpoint('https://api.openai.com/v1/chat/completions');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('openai');
    expect(match?.riskLevel).toBe('critical');
  });

  it('recognises Grok on grok.com (newly added endpoint)', () => {
    const match = mobileMatchEndpoint('https://grok.com/api/chat');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('xai-grok');
  });

  it('recognises Meta AI endpoint', () => {
    const match = mobileMatchEndpoint('https://www.meta.ai/api/graphql');
    expect(match).not.toBeNull();
  });

  it('returns null for a non-AI endpoint', () => {
    const match = mobileMatchEndpoint('https://www.google.com/search');
    expect(match).toBeNull();
  });

  it('returns null for an empty URL', () => {
    const match = mobileMatchEndpoint('');
    expect(match).toBeNull();
  });
});

// ── 5. License flow — memory adapter ─────────────────────────────────────────

describe('License flow — memory adapter', () => {
  beforeEach(clearStorage);

  it('returns FREE tier when no key stored', async () => {
    const info = await mobileCheckLicense();
    expect(info.tier).toBe('FREE');
    expect(info.limitReached).toBe(false);
  });

  it('rejects an invalid key', async () => {
    const ok = await mobileActivateLicense('invalid-key-xyz');
    expect(ok).toBe(false);
    const info = await mobileCheckLicense();
    expect(info.tier).toBe('FREE');
  });

  it('deactivate on empty storage does not throw', async () => {
    await expect(mobileDeactivateLicense()).resolves.not.toThrow();
  });
});

// ── 6. Security contract ──────────────────────────────────────────────────────

describe('Security contract — mobileCage', () => {
  beforeEach(clearStorage);

  it('caged entities contain correct type', async () => {
    const r = await mobileCage('alice@example.com');
    expect(r.entities[0]?.type).toBe('EMAIL_ADDRESS');
    expect(mobileUncage(r.cagedText, r.entities)).toContain('alice@example.com');
  });

  it('round-trip works across two independent cage calls', async () => {
    const r1 = await mobileCage('alice@example.com');
    const r2 = await mobileCage('alice@example.com');
    expect(r1.entities[0]?.type).toBe('EMAIL_ADDRESS');
    expect(r2.entities[0]?.type).toBe('EMAIL_ADDRESS');
    expect(mobileUncage(r1.cagedText, r1.entities)).toContain('alice@example.com');
    expect(mobileUncage(r2.cagedText, r2.entities)).toContain('alice@example.com');
  });
});
