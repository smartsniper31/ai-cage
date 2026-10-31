/**
 * @file scan.test.ts
 * Unit tests for presidio-lite scanText().
 *
 * These tests are the ground truth for PII detection coverage.
 * Each test documents WHAT is being detected and WHY.
 */

import { describe, it, expect } from 'vitest';
import { scanText } from '../src/scan.js';

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------
describe('Email detection', () => {
  it('detects a plain email address', () => {
    const matches = scanText('Contact me at alice@example.com please.');
    expect(matches.some((m) => m.type === 'EMAIL_ADDRESS' && m.value === 'alice@example.com')).toBe(true);
  });

  it('detects email with subdomain and plus-addressing', () => {
    const matches = scanText('Send to user.name+tag@mail.company.co.uk');
    expect(matches.some((m) => m.type === 'EMAIL_ADDRESS')).toBe(true);
  });

  it('does NOT flag a bare domain without @', () => {
    const matches = scanText('Visit example.com for more info.');
    expect(matches.some((m) => m.type === 'EMAIL_ADDRESS')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CREDIT CARD
// ---------------------------------------------------------------------------
describe('Credit card detection', () => {
  it('detects a Visa number with spaces', () => {
    const matches = scanText('Card: 4111 1111 1111 1111');
    expect(matches.some((m) => m.type === 'CREDIT_CARD')).toBe(true);
  });

  it('detects a Mastercard number with dashes', () => {
    const matches = scanText('MC: 5500-0000-0000-0004');
    expect(matches.some((m) => m.type === 'CREDIT_CARD')).toBe(true);
  });

  it('detects an Amex number', () => {
    const matches = scanText('Amex: 3714 496353 98431');
    expect(matches.some((m) => m.type === 'CREDIT_CARD')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IBAN
// ---------------------------------------------------------------------------
describe('IBAN detection', () => {
  it('detects a Tunisian IBAN', () => {
    const matches = scanText('IBAN: TN5910006035183598478831');
    expect(matches.some((m) => m.type === 'IBAN')).toBe(true);
  });

  it('detects a French IBAN with spaces', () => {
    const matches = scanText('FR76 3000 6000 0112 3456 7890 189');
    expect(matches.some((m) => m.type === 'IBAN')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PRIVATE KEY
// ---------------------------------------------------------------------------
describe('Private key detection', () => {
  it('detects RSA private key header', () => {
    const matches = scanText('-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAA...');
    expect(matches.some((m) => m.type === 'PRIVATE_KEY' && m.score === 1.0)).toBe(true);
  });

  it('detects generic PRIVATE KEY header', () => {
    const matches = scanText('-----BEGIN PRIVATE KEY-----');
    expect(matches.some((m) => m.type === 'PRIVATE_KEY')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// API KEY
// ---------------------------------------------------------------------------
describe('API key detection', () => {
  it('detects an AWS access key', () => {
    const matches = scanText('export AWS_KEY=AKIAIOSFODNN7EXAMPLE');
    expect(matches.some((m) => m.type === 'API_KEY')).toBe(true);
  });

  it('detects a GitHub PAT', () => {
    const matches = scanText('TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(matches.some((m) => m.type === 'API_KEY')).toBe(true);
  });

  it('detects a Stripe live key', () => {
    const matches = scanText('STRIPE=sk_live_abcdefghijklmnopqrstuvwx');
    expect(matches.some((m) => m.type === 'API_KEY')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IP ADDRESS
// ---------------------------------------------------------------------------
describe('IP address detection', () => {
  it('detects IPv4', () => {
    const matches = scanText('Server at 192.168.1.100');
    expect(matches.some((m) => m.type === 'IP_ADDRESS' && m.value === '192.168.1.100')).toBe(true);
  });

  it('does NOT flag a version string as IP', () => {
    const matches = scanText('Version 1.2.3 released');
    // A 3-octet string shouldn't match the 4-octet IPv4 pattern
    expect(matches.some((m) => m.type === 'IP_ADDRESS' && m.value === '1.2.3')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TUNISIAN CIN
// ---------------------------------------------------------------------------
describe('Tunisian CIN detection', () => {
  it('detects CIN with explicit label', () => {
    const matches = scanText('CIN: 12345678', { minScore: 0.6 });
    expect(matches.some((m) => m.type === 'CIN_TN')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OVERLAP DEDUPLICATION
// ---------------------------------------------------------------------------
describe('Overlap deduplication', () => {
  it('keeps higher-confidence match when two matches overlap', () => {
    // An email contains an @ which could theoretically trigger other patterns.
    // The deduplication should give us clean results.
    const matches = scanText('alice@example.com');
    const emails = matches.filter((m) => m.type === 'EMAIL_ADDRESS');
    expect(emails.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// MULTIPLE ENTITIES IN ONE TEXT
// ---------------------------------------------------------------------------
describe('Multiple PII in one text', () => {
  it('detects email + credit card + IP in a single string', () => {
    const text = 'User alice@corp.io paid 4111 1111 1111 1111 from 10.0.0.5';
    const matches = scanText(text);
    const types = new Set(matches.map((m) => m.type));
    expect(types.has('EMAIL_ADDRESS')).toBe(true);
    expect(types.has('CREDIT_CARD')).toBe(true);
    expect(types.has('IP_ADDRESS')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EMPTY / SAFE INPUT
// ---------------------------------------------------------------------------
describe('Safe inputs', () => {
  it('returns empty array for plain text with no PII', () => {
    const matches = scanText('The weather today is sunny and warm.', { minScore: 0.8 });
    expect(matches).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(scanText('')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// minScore FILTER
// ---------------------------------------------------------------------------
describe('minScore option', () => {
  it('excludes low-confidence matches when minScore is 0.9', () => {
    // Phone numbers score 0.75 — they should be excluded at minScore=0.9
    const text = '+216 12 345 678';
    const matches = scanText(text, { minScore: 0.9 });
    expect(matches.some((m) => m.type === 'PHONE_NUMBER')).toBe(false);
  });

  it('includes low-confidence matches when minScore is 0.5', () => {
    const text = '+216 12 345 678';
    const matches = scanText(text, { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PHONE_NUMBER')).toBe(true);
  });
});

// ===========================================================================
// PHASE 2 — New detector tests
// ===========================================================================

// ---------------------------------------------------------------------------
// TUNISIAN MATRICULE FISCAL (MF_TN)
// ---------------------------------------------------------------------------
describe('Tunisian Matricule Fiscal detection', () => {
  it('detects standard MF format with slashes', () => {
    const matches = scanText('MF: 1234567A/P/A/000');
    expect(matches.some((m) => m.type === 'MF_TN')).toBe(true);
  });

  it('detects MF with explicit label', () => {
    const matches = scanText('Matricule Fiscal: 9876543B/N/M/001');
    expect(matches.some((m) => m.type === 'MF_TN')).toBe(true);
  });

  it('detects MF in a sentence context', () => {
    const matches = scanText('Notre matricule fiscal est 1111111C/P/N/000 merci.');
    expect(matches.some((m) => m.type === 'MF_TN')).toBe(true);
  });

  it('does NOT flag a random 7-digit number as MF', () => {
    const matches = scanText('Reference number: 1234567');
    // No letter+slash pattern — should not match MF_TN with score >= 0.9
    const mfMatches = matches.filter((m) => m.type === 'MF_TN' && m.score >= 0.9);
    expect(mfMatches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TUNISIAN PASSPORT (PASSPORT_TN)
// ---------------------------------------------------------------------------
describe('Tunisian Passport detection', () => {
  it('detects passport with explicit label', () => {
    const matches = scanText('Passeport N°: A1234567');
    expect(matches.some((m) => m.type === 'PASSPORT_TN')).toBe(true);
  });

  it('detects passport number in a French sentence', () => {
    const matches = scanText('Mon numéro de passport est B7654321.');
    expect(matches.some((m) => m.type === 'PASSPORT_TN')).toBe(true);
  });

  it('detects standalone Tunisian passport format', () => {
    const matches = scanText('A9876543');
    expect(matches.some((m) => m.type === 'PASSPORT_TN')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CARTE DE SÉJOUR (CARTE_SEJOUR)
// ---------------------------------------------------------------------------
describe('Carte de Séjour detection', () => {
  it('detects with "titre de séjour" label', () => {
    const matches = scanText('Titre de séjour: 75 123456 01', { minScore: 0.6 });
    expect(matches.some((m) => m.type === 'CARTE_SEJOUR')).toBe(true);
  });

  it('detects with "carte de sejour" label (no accent)', () => {
    const matches = scanText('carte de sejour: 13 654321 02', { minScore: 0.6 });
    expect(matches.some((m) => m.type === 'CARTE_SEJOUR')).toBe(true);
  });

  it('detects with "récépissé" label', () => {
    const matches = scanText('Récépissé: 69 112233 05', { minScore: 0.6 });
    expect(matches.some((m) => m.type === 'CARTE_SEJOUR')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ARABIC / TUNISIAN PERSON NAMES
// ---------------------------------------------------------------------------
describe('Arabic/Tunisian name detection', () => {
  it('detects "Mohamed Ben Ali" pattern', () => {
    const matches = scanText('Contact Mohamed Ben Ali for more info.', { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PERSON_NAME')).toBe(true);
  });

  it('detects "Ahmed El Amri" pattern', () => {
    const matches = scanText('Dossier de Ahmed El Amri reçu.', { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PERSON_NAME')).toBe(true);
  });

  it('detects "Fatma Bel Hadj" (female Tunisian name)', () => {
    const matches = scanText('Client: Fatma Bel Hadj', { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PERSON_NAME')).toBe(true);
  });

  it('detects name with explicit "Nom:" label', () => {
    const matches = scanText('Nom: Marie Dupont', { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PERSON_NAME')).toBe(true);
  });

  it('detects "Full Name: Jean-Pierre Martin"', () => {
    const matches = scanText('Full Name: Jean Pierre Martin', { minScore: 0.5 });
    expect(matches.some((m) => m.type === 'PERSON_NAME')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MIXED TUNISIAN ENTERPRISE CONTEXT
// ---------------------------------------------------------------------------
describe('Tunisian enterprise PII in realistic context', () => {
  it('detects email + MF + CIN in one invoice block', () => {
    const text = [
      'Société: ACME SARL',
      'Email: contact@acme.tn',
      'Matricule Fiscal: 1234567A/P/A/000',
      'Responsable CIN: 12345678',
    ].join('\n');

    const matches = scanText(text, { minScore: 0.6 });
    const types = new Set(matches.map((m) => m.type));

    expect(types.has('EMAIL_ADDRESS')).toBe(true);
    expect(types.has('MF_TN')).toBe(true);
    expect(types.has('CIN_TN')).toBe(true);
  });

  it('detects IBAN + phone in a payment instruction', () => {
    const text = 'Virement vers TN5910006035183598478831, contact +216 71 000 000';
    const matches = scanText(text);
    expect(matches.some((m) => m.type === 'IBAN')).toBe(true);
    expect(matches.some((m) => m.type === 'PHONE_NUMBER')).toBe(true);
  });
});
