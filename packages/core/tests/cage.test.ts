/**
 * @file cage.test.ts
 * Unit tests for @ai-cage/core — cageText(), uncageText(), summariseCaged()
 *
 * Every test documents WHAT it verifies and WHY it matters for the
 * zero-leak security guarantee.
 */

import { describe, it, expect } from 'vitest';
import { cageText, uncageText, summariseCaged } from '../src/cage.js';

// ---------------------------------------------------------------------------
// cageText — basic coverage
// ---------------------------------------------------------------------------
describe('cageText — basic PII replacement', () => {
  it('replaces an email address with a labelled placeholder', () => {
    const { cagedText, entities } = cageText('Contact alice@example.com today');
    expect(cagedText).not.toContain('alice@example.com');
    expect(cagedText).toContain('[CAGED_EMAIL_');
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe('EMAIL_ADDRESS');
    expect(entities[0]?.originalValue).toBe('alice@example.com');
  });

  it('replaces a credit card number', () => {
    const { cagedText, entities } = cageText('Pay with 4111 1111 1111 1111 now');
    expect(cagedText).not.toContain('4111');
    expect(cagedText).toContain('[CAGED_CARD_');
    expect(entities[0]?.type).toBe('CREDIT_CARD');
  });

  it('replaces a private key header (score 1.0)', () => {
    const { cagedText, entities } = cageText(
      'Here is my key:\n-----BEGIN RSA PRIVATE KEY-----\nMIIE...'
    );
    expect(cagedText).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(entities.some((e) => e.type === 'PRIVATE_KEY')).toBe(true);
  });

  it('replaces an AWS API key', () => {
    const { cagedText } = cageText('export KEY=AKIAIOSFODNN7EXAMPLE');
    expect(cagedText).not.toContain('AKIA');
    expect(cagedText).toContain('[CAGED_APIKEY_');
  });

  it('handles multiple PII types in one string', () => {
    const text = 'Send to bob@company.io, card 4111 1111 1111 1111, IP 10.0.0.1';
    const { cagedText, entities, totalCaged } = cageText(text);

    expect(cagedText).not.toContain('bob@company.io');
    expect(cagedText).not.toContain('4111');
    expect(cagedText).not.toContain('10.0.0.1');
    expect(totalCaged).toBeGreaterThanOrEqual(3);
    expect(entities.length).toBe(totalCaged);
  });

  it('returns unchanged text when no PII is detected', () => {
    const text = 'The project deadline is end of quarter.';
    const { cagedText, entities, totalCaged } = cageText(text, { minScore: 0.9 });
    expect(cagedText).toBe(text);
    expect(entities).toHaveLength(0);
    expect(totalCaged).toBe(0);
  });

  it('returns empty string unchanged', () => {
    const { cagedText, entities } = cageText('');
    expect(cagedText).toBe('');
    expect(entities).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// cageText — placeholder format
// ---------------------------------------------------------------------------
describe('cageText — placeholder format', () => {
  it('generates labelled placeholders by default', () => {
    const { cagedText } = cageText('alice@example.com');
    // Format: [CAGED_EMAIL_<SALT>_<N>] — salt is 4 alphanumeric chars
    expect(cagedText).toMatch(/\[CAGED_EMAIL_[A-Z0-9]{4}_\d+\]/);
  });

  it('generates unlabelled placeholders when labelledPlaceholders=false', () => {
    const { cagedText } = cageText('alice@example.com', {
      labelledPlaceholders: false,
    });
    // Format: [CAGED_<SALT>_<N>]
    expect(cagedText).toMatch(/\[CAGED_[A-Z0-9]{4}_\d+\]/);
    expect(cagedText).not.toMatch(/EMAIL/);
  });

  it('increments placeholder counter for multiple matches', () => {
    const { entities } = cageText('a@x.com and b@y.com');
    const placeholders = entities.map((e) => e.placeholder);
    // All placeholders must be unique
    expect(new Set(placeholders).size).toBe(placeholders.length);
  });
});

// ---------------------------------------------------------------------------
// uncageText — round-trip restoration
// ---------------------------------------------------------------------------
describe('uncageText — round-trip', () => {
  it('restores a single entity', () => {
    const original = 'Contact alice@example.com please';
    const { cagedText, entities } = cageText(original);
    const restored = uncageText(cagedText, entities);
    expect(restored).toBe(original);
  });

  it('restores multiple entities', () => {
    const original = 'bob@corp.io paid 4111 1111 1111 1111';
    const { cagedText, entities } = cageText(original);
    const restored = uncageText(cagedText, entities);
    expect(restored).toContain('bob@corp.io');
    expect(restored).toContain('4111 1111 1111 1111');
  });

  it('restores when the AI response adds text around placeholders', () => {
    const { entities } = cageText('alice@example.com');
    // Use the actual generated placeholder (includes session salt)
    const placeholder = entities[0]?.placeholder ?? '';
    const aiResponse = `I have processed ${placeholder} and it looks valid.`;
    const restored = uncageText(aiResponse, entities);
    expect(restored).toContain('alice@example.com');
  });

  it('is idempotent — calling uncageText twice does not break anything', () => {
    const { cagedText, entities } = cageText('alice@example.com');
    const first = uncageText(cagedText, entities);
    const second = uncageText(first, entities);
    expect(second).toBe(first);
  });

  it('returns the response unchanged when entities is empty', () => {
    const response = 'No PII here, all good.';
    expect(uncageText(response, [])).toBe(response);
  });

  it('restores a Tunisian IBAN', () => {
    const original = 'IBAN: TN5910006035183598478831';
    const { cagedText, entities } = cageText(original);
    const restored = uncageText(cagedText, entities);
    expect(restored).toContain('TN59');
  });
});

// ---------------------------------------------------------------------------
// summariseCaged — audit log safety
// ---------------------------------------------------------------------------
describe('summariseCaged — never leaks original values', () => {
  it('returns type and score but NOT originalValue', () => {
    const { entities } = cageText('alice@example.com');
    const summary = summariseCaged(entities);
    expect(summary[0]).toHaveProperty('placeholder');
    expect(summary[0]).toHaveProperty('type');
    expect(summary[0]).toHaveProperty('score');
    // Crucially — no originalValue in the summary
    expect(summary[0]).not.toHaveProperty('originalValue');
  });

  it('returns empty array when no entities', () => {
    expect(summariseCaged([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// minScore option
// ---------------------------------------------------------------------------
describe('cageText — minScore option', () => {
  it('cages nothing at minScore=1.0 except private keys', () => {
    const text = 'Call me at +216 12 345 678 or email alice@example.com';
    // At score=1.0 only PRIVATE_KEY (score 1.0) would match; neither of these are
    const { entities } = cageText(text, { minScore: 1.0 });
    expect(entities.every((e) => e.type === 'PRIVATE_KEY')).toBe(true);
  });

  it('cages more aggressively at minScore=0.5', () => {
    const text = 'CIN: 12345678 and tel +216 12 345 678';
    const { entities: high } = cageText(text, { minScore: 0.9 });
    const { entities: low } = cageText(text, { minScore: 0.5 });
    expect(low.length).toBeGreaterThanOrEqual(high.length);
  });
});

// ---------------------------------------------------------------------------
// Security contract — no network calls (static analysis via import check)
// ---------------------------------------------------------------------------
describe('Security contract', () => {
  it('cage module does not reference fetch or XMLHttpRequest', async () => {
    // Dynamically read the source to ensure no network primitives exist.
    // This test is intentionally a string-search — it acts as a lint rule.
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const src = readFileSync(resolve(__dirname, '../src/cage.ts'), 'utf8');

    // Strip single-line (//) and multi-line (/* */) comments before checking.
    // This prevents legitimate security-contract documentation from triggering
    // the check (e.g. "NEVER calls fetch()").
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/\/\/[^\n]*/g, '');         // line comments

    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/XMLHttpRequest/);
    expect(codeOnly).not.toMatch(/WebSocket/);
    expect(codeOnly).not.toMatch(/localStorage/);
    expect(codeOnly).not.toMatch(/indexedDB/);
  });
});
