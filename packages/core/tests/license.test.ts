/**
 * @file license.test.ts
 * Unit tests for the licensing engine — Phase 4.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLicense,
  parseLicenseKey,
  generateLicenseKey,
  generateDemoLicense,
  activateLicense,
  deactivateLicense,
  getTierFeatures,
} from '../src/license.js';
import { createMemoryAdapter } from '../src/auditLog.js';
import type { LicensePayload } from '../src/license.js';

function freshStore() { return createMemoryAdapter(); }

const validPayload: LicensePayload = {
  tier: 'PRO',
  deviceId: 'device-001',
  issuedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2099-12-31T00:00:00Z',
  features: ['agentCage', 'auditExport'],
  customer: 'ACME SARL',
  seats: 10,
};

// ---------------------------------------------------------------------------
// Tier features
// ---------------------------------------------------------------------------

describe('getTierFeatures', () => {
  it('free tier has 100 cage/month limit', () => {
    const f = getTierFeatures('FREE');
    expect(f.maxMonthlyCages).toBe(100);
    expect(f.maxPiiTypes).toBe(15);
    expect(f.customPolicy).toBe(false);
    expect(f.agentCage).toBe(false);
  });

  it('pro tier has unlimited cages', () => {
    const f = getTierFeatures('PRO');
    expect(f.maxMonthlyCages).toBe(-1);
    expect(f.customPolicy).toBe(true);
    expect(f.agentCage).toBe(true);
  });

  it('enterprise tier has SSO + SIEM', () => {
    const f = getTierFeatures('ENTERPRISE');
    expect(f.sso).toBe(true);
    expect(f.siem).toBe(true);
    expect(f.centralisedPolicy).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// License key generation + parsing
// ---------------------------------------------------------------------------

describe('generateLicenseKey + parseLicenseKey', () => {
  it('generates a key and parses it back correctly', () => {
    const key = generateLicenseKey(validPayload);
    expect(key).toContain('.');
    const parsed = parseLicenseKey(key);
    expect(parsed).not.toBeNull();
    expect(parsed?.tier).toBe('PRO');
    expect(parsed?.customer).toBe('ACME SARL');
    expect(parsed?.seats).toBe(10);
  });

  it('returns null for a tampered key', () => {
    const key = generateLicenseKey(validPayload);
    // Tamper: change a character in the signature part
    const parts = key.split('.');
    const tampered = `${parts[0]}.${parts[1].slice(0, -1)}X`;
    expect(parseLicenseKey(tampered)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseLicenseKey('')).toBeNull();
    expect(parseLicenseKey('no-dot-here')).toBeNull();
    expect(parseLicenseKey('a.b.c')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkLicense — free tier (no key stored)
// ---------------------------------------------------------------------------

describe('checkLicense — no key (free tier)', () => {
  it('returns FREE status with no key stored', async () => {
    const store = freshStore();
    const info = await checkLicense(store, 0);
    expect(info.status).toBe('NONE');
    expect(info.tier).toBe('FREE');
    expect(info.payload).toBeNull();
    expect(info.message).toContain('Free tier');
  });

  it('limitReached is true when monthly count >= 100', async () => {
    const store = freshStore();
    const info = await checkLicense(store, 100);
    expect(info.limitReached).toBe(true);
  });

  it('limitReached is false when monthly count < 100', async () => {
    const store = freshStore();
    const info = await checkLicense(store, 50);
    expect(info.limitReached).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkLicense — valid PRO key
// ---------------------------------------------------------------------------

describe('checkLicense — valid PRO key', () => {
  it('returns VALID status with PRO tier', async () => {
    const store = freshStore();
    const key = generateLicenseKey(validPayload);
    await activateLicense(key, store);
    const info = await checkLicense(store, 42);
    expect(info.status).toBe('VALID');
    expect(info.tier).toBe('PRO');
    expect(info.payload?.customer).toBe('ACME SARL');
    expect(info.features.agentCage).toBe(true);
    expect(info.limitReached).toBe(false); // unlimited
  });
});

// ---------------------------------------------------------------------------
// checkLicense — tampered key
// ---------------------------------------------------------------------------

describe('checkLicense — tampered key', () => {
  it('returns TAMPERED status and falls back to FREE', async () => {
    const store = freshStore();
    const key = generateLicenseKey(validPayload);
    const parts = key.split('.');
    const tampered = `${parts[0]}.${parts[1].slice(0, -1)}X`;
    await activateLicense(tampered, store);
    // activateLicense returns false for invalid keys, but let's force store it
    await store.setItem('ai-cage:license-key', tampered);
    const info = await checkLicense(store, 10);
    expect(info.status).toBe('TAMPERED');
    expect(info.tier).toBe('FREE');
    expect(info.message).toContain('tampered');
  });
});

// ---------------------------------------------------------------------------
// checkLicense — expired key
// ---------------------------------------------------------------------------

describe('checkLicense — expired key', () => {
  it('returns EXPIRED status and falls back to FREE', async () => {
    const store = freshStore();
    const expiredPayload: LicensePayload = {
      ...validPayload,
      expiresAt: '2020-01-01T00:00:00Z', // already expired
    };
    const key = generateLicenseKey(expiredPayload);
    await store.setItem('ai-cage:license-key', key);
    const info = await checkLicense(store, 10);
    expect(info.status).toBe('EXPIRED');
    expect(info.tier).toBe('FREE');
    expect(info.message).toContain('expired');
  });
});

// ---------------------------------------------------------------------------
// activateLicense
// ---------------------------------------------------------------------------

describe('activateLicense', () => {
  it('returns true for a valid key', async () => {
    const store = freshStore();
    const key = generateLicenseKey(validPayload);
    const ok = await activateLicense(key, store);
    expect(ok).toBe(true);
  });

  it('returns false for an expired key', async () => {
    const store = freshStore();
    const expiredPayload: LicensePayload = {
      ...validPayload,
      expiresAt: '2020-01-01T00:00:00Z',
    };
    const key = generateLicenseKey(expiredPayload);
    const ok = await activateLicense(key, store);
    expect(ok).toBe(false);
  });

  it('returns false for a tampered key', async () => {
    const store = freshStore();
    const key = generateLicenseKey(validPayload);
    const parts = key.split('.');
    const tampered = `${parts[0]}.invalid_sig`;
    const ok = await activateLicense(tampered, store);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deactivateLicense
// ---------------------------------------------------------------------------

describe('deactivateLicense', () => {
  it('clears the stored key', async () => {
    const store = freshStore();
    const key = generateLicenseKey(validPayload);
    await activateLicense(key, store);
    await deactivateLicense(store);
    const info = await checkLicense(store, 0);
    expect(info.status).toBe('NONE');
    expect(info.tier).toBe('FREE');
  });
});

// ---------------------------------------------------------------------------
// generateDemoLicense
// ---------------------------------------------------------------------------

describe('generateDemoLicense', () => {
  it('generates a valid PRO demo key', () => {
    const key = generateDemoLicense('PRO');
    const parsed = parseLicenseKey(key);
    expect(parsed?.tier).toBe('PRO');
    // Expires in ~30 days
    const now = new Date();
    const exp = new Date(parsed?.expiresAt ?? '2000-01-01');
    expect(exp > now).toBe(true);
  });

  it('generates a valid ENTERPRISE demo key', () => {
    const key = generateDemoLicense('ENTERPRISE');
    const parsed = parseLicenseKey(key);
    expect(parsed?.tier).toBe('ENTERPRISE');
    expect(parsed?.features).toContain('sso');
  });
});

// ---------------------------------------------------------------------------
// Security contract — no network calls
// ---------------------------------------------------------------------------

describe('Security contract', () => {
  it('license module does not reference fetch or XMLHttpRequest', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const src = readFileSync(resolve(__dirname, '../src/license.ts'), 'utf8');
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/XMLHttpRequest/);
    expect(codeOnly).not.toMatch(/WebSocket/);
  });
});
