/**
 * @file license.ts
 * AI CAGE Licensing Engine — Phase 4: Monetization.
 *
 * Three tiers:
 *   FREE       — 15 PII types, 1 device, 100 cages/month, basic policy
 *   PRO        — €5/user/mo, unlimited cages, custom policy, audit export
 *   ENTERPRISE — €15/user/mo, SSO, SIEM connector, centralised policy
 *
 * OFFLINE VALIDATION:
 *   License key format:  base64url(payload) . base64url(signature)
 *   payload = JSON { tier, deviceId, issuedAt, expiresAt, features[] }
 *   signature = offline hash(payload + EMBEDDED_PUBLIC_KEY)
 *
 * SECURITY CONTRACT:
 *   - NEVER calls fetch() or any network API for validation.
 *   - The embedded key is a community-known verification constant.
 *   - Tamper detection: if signature doesn't match, license is INVALID.
 *   - License key stored locally only (localStorage / chrome.storage).
 *   - No telemetry, no phone-home, no license server.
 *
 * NOTE on cryptographic strength:
 *   V1 uses a checksum-based signature (djb2 hash). This prevents casual
 *   tampering but is NOT cryptographically secure against a determined
 *   attacker with source access. V2 will upgrade to ed25519 when
 *   WebCrypto/SubtleCrypto is available in the extension context.
 *   The open-source model means the value is in the service, not the key.
 */

import type { StorageAdapter } from './auditLog.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicenseTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export type LicenseStatus = 'VALID' | 'EXPIRED' | 'INVALID' | 'TAMPERED' | 'NONE';

/** Feature flags enabled per tier. */
export interface LicenseFeatures {
  /** Maximum PII entity types the engine will detect. -1 = unlimited. */
  maxPiiTypes: number;
  /** Maximum cages per month. -1 = unlimited. */
  maxMonthlyCages: number;
  /** Whether custom policy editing is allowed. */
  customPolicy: boolean;
  /** Whether audit log CSV export is allowed. */
  auditExport: boolean;
  /** Whether Shadow AI detection is active. */
  shadowAi: boolean;
  /** Whether Agent Cage (injection detection + tool policy) is active. */
  agentCage: boolean;
  /** Whether MCP monitoring is active. */
  mcpMonitor: boolean;
  /** Whether SSO integration is available. */
  sso: boolean;
  /** Whether SIEM connector (Splunk/ELK) is available. */
  siem: boolean;
  /** Whether centralised policy management is available. */
  centralisedPolicy: boolean;
}

/** The decoded license payload. */
export interface LicensePayload {
  tier: LicenseTier;
  deviceId: string;
  issuedAt: string;   // ISO 8601
  expiresAt: string;  // ISO 8601
  features: string[];
  customer: string;   // company name or "Personal"
  seats: number;      // number of licensed seats
}

/** Full license info returned by checkLicense(). */
export interface LicenseInfo {
  status: LicenseStatus;
  tier: LicenseTier;
  payload: LicensePayload | null;
  features: LicenseFeatures;
  /** Human-readable message for UI display. */
  message: string;
  /** Monthly cage count (read from audit log summary). */
  monthlyCageCount: number;
  /** True if free tier monthly limit exceeded. */
  limitReached: boolean;
}

// ---------------------------------------------------------------------------
// Embedded verification key (community-known, not secret)
// ---------------------------------------------------------------------------

/**
 * Embedded verification constant. In V2 this will be replaced with an
 * ed25519 public key. For V1, this is a simple string used in the
 * checksum computation. Changing this invalidates all existing licenses.
 */
const EMBEDDED_KEY = 'ai-cage-verification-v1-7f3a9b2e8c1d4a6f';

// ---------------------------------------------------------------------------
// Tier feature maps
// ---------------------------------------------------------------------------

const FREE_FEATURES: LicenseFeatures = {
  maxPiiTypes:       15,
  maxMonthlyCages:   100,
  customPolicy:      false,
  auditExport:       false,
  shadowAi:          true,   // Shadow AI detection is free — it's a safety feature
  agentCage:         false,
  mcpMonitor:        false,
  sso:               false,
  siem:              false,
  centralisedPolicy: false,
};

const PRO_FEATURES: LicenseFeatures = {
  maxPiiTypes:       -1,   // unlimited
  maxMonthlyCages:   -1,
  customPolicy:      true,
  auditExport:       true,
  shadowAi:          true,
  agentCage:         true,
  mcpMonitor:        true,
  sso:               false,
  siem:              false,
  centralisedPolicy: false,
};

const ENTERPRISE_FEATURES: LicenseFeatures = {
  maxPiiTypes:       -1,
  maxMonthlyCages:   -1,
  customPolicy:      true,
  auditExport:       true,
  shadowAi:          true,
  agentCage:         true,
  mcpMonitor:        true,
  sso:               true,
  siem:              true,
  centralisedPolicy: true,
};

/**
 * Returns the feature set for a given tier.
 */
export function getTierFeatures(tier: LicenseTier): LicenseFeatures {
  switch (tier) {
    case 'FREE':       return { ...FREE_FEATURES };
    case 'PRO':        return { ...PRO_FEATURES };
    case 'ENTERPRISE': return { ...ENTERPRISE_FEATURES };
  }
}

// ---------------------------------------------------------------------------
// Base64URL helpers (no DOM/atob needed — pure implementation)
// ---------------------------------------------------------------------------

function base64UrlEncode(str: string): string {
  const b64 = btoaSafe(str);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atobSafe(s);
}

/** btoa polyfill — works without DOM lib. */
function btoaSafe(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i) & 0xff;
    const b = i + 1 < str.length ? str.charCodeAt(i + 1) & 0xff : 0;
    const c = i + 2 < str.length ? str.charCodeAt(i + 2) & 0xff : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i + 1 < str.length ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i + 2 < str.length ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

/** atob polyfill — works without DOM lib. */
function atobSafe(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) {
    lookup.set(chars[i] ?? '', i);
  }
  let result = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of str) {
    if (ch === '=') break;
    const val = lookup.get(ch);
    if (val === undefined) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Checksum-based signature (V1 — prevents casual tampering)
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic checksum hash of a string.
 * Uses djb2 algorithm — fast, no dependencies, no DOM needed.
 * NOT cryptographically secure. V2 will use ed25519.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  // Convert to unsigned and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Computes the signature for a given payload string.
 * signature = djb2Hash(payload + EMBEDDED_KEY)
 */
function computeSignature(payloadB64: string): string {
  return djb2Hash(payloadB64 + EMBEDDED_KEY);
}

// ---------------------------------------------------------------------------
// License key generation + parsing
// ---------------------------------------------------------------------------

/**
 * Generates a license key string from a payload.
 * Format: base64url(payload) . base64url(signature)
 *
 * @param payload - The license payload to encode.
 * @returns The license key string.
 *
 * @example
 * ```ts
 * const key = generateLicenseKey({
 *   tier: 'PRO', deviceId: 'abc', issuedAt: '2026-11-01T00:00:00Z',
 *   expiresAt: '2027-11-01T00:00:00Z', features: ['agentCage', 'auditExport'],
 *   customer: 'ACME SARL', seats: 10
 * });
 * ```
 */
export function generateLicenseKey(payload: LicensePayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64  = base64UrlEncode(payloadJson);
  const sig          = computeSignature(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Validates and decodes a license key string.
 * Returns the payload if valid, or null if tampered/malformed.
 *
 * @param key - The license key string.
 * @returns The decoded payload, or null if invalid.
 */
export function parseLicenseKey(key: string): LicensePayload | null {
  if (!key || !key.includes('.')) return null;

  const parts = key.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64Raw, sig] = parts;
  if (!payloadB64Raw || !sig) return null;
  const payloadB64: string = payloadB64Raw;

  const expectedSig = computeSignature(payloadB64);

  // Tamper check: signature must match
  if (sig !== expectedSig) return null;

  try {
    const json = base64UrlDecode(payloadB64);
    const payload = JSON.parse(json) as LicensePayload;
    // Validate required fields
    if (!payload.tier || !payload.expiresAt || !payload.issuedAt) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core: checkLicense()
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'ai-cage:license-key';

/**
 * Checks the current license status against stored key + monthly usage.
 *
 * What it does:
 *   1. Reads license key from storage (or returns FREE tier if none).
 *   2. Validates signature (tamper detection).
 *   3. Checks expiry date.
 *   4. Reads monthly cage count from audit summary.
 *   5. Returns full LicenseInfo with feature flags.
 *
 * @param storage - Storage adapter (localStorage / chrome.storage / memory).
 * @param monthlyCageCount - Pre-computed monthly count (caller provides from audit summary).
 * @returns {@link LicenseInfo}
 *
 * @example
 * ```ts
 * const info = await checkLicense(localStorageAdapter, 42);
 * if (info.limitReached) {
 *   showWatermark("AI CAGE Free — limit reached, upgrade to Pro");
 * }
 * ```
 */
export async function checkLicense(
  storage: StorageAdapter,
  monthlyCageCount: number,
): Promise<LicenseInfo> {
  const rawKey = await storage.getItem(LICENSE_KEY);

  // No license key → FREE tier
  if (!rawKey) {
    const features = getTierFeatures('FREE');
    return {
      status: 'NONE',
      tier: 'FREE',
      payload: null,
      features,
      message: 'Free tier active — 100 cages/month limit',
      monthlyCageCount,
      limitReached: monthlyCageCount >= features.maxMonthlyCages,
    };
  }

  // Parse + validate
  const payload = parseLicenseKey(rawKey);

  if (!payload) {
    // Tampered or malformed key → fall back to FREE
    const features = getTierFeatures('FREE');
    return {
      status: 'TAMPERED',
      tier: 'FREE',
      payload: null,
      features,
      message: '⚠️ License key is invalid or tampered — using free tier',
      monthlyCageCount,
      limitReached: monthlyCageCount >= features.maxMonthlyCages,
    };
  }

  // Check expiry
  const now = new Date();
  const expires = new Date(payload.expiresAt);
  if (now > expires) {
    const features = getTierFeatures('FREE');
    return {
      status: 'EXPIRED',
      tier: 'FREE',
      payload,
      features,
      message: `License expired on ${payload.expiresAt.slice(0, 10)} — using free tier`,
      monthlyCageCount,
      limitReached: monthlyCageCount >= features.maxMonthlyCages,
    };
  }

  // Valid license
  const features = getTierFeatures(payload.tier);
  const limitReached = features.maxMonthlyCages > 0
    && monthlyCageCount >= features.maxMonthlyCages;

  return {
    status: 'VALID',
    tier: payload.tier,
    payload,
    features,
    message: `${payload.tier} license valid until ${payload.expiresAt.slice(0, 10)} — ${payload.customer}`,
    monthlyCageCount,
    limitReached,
  };
}

/**
 * Stores a license key in local storage.
 * Called when the user enters a license key in the UI.
 *
 * @param key     - The license key string (from purchase email or activation).
 * @param storage - Storage adapter.
 * @returns true if the key was valid and stored, false if invalid.
 */
export async function activateLicense(
  key: string,
  storage: StorageAdapter,
): Promise<boolean> {
  const payload = parseLicenseKey(key);
  if (!payload) return false;

  // Check not already expired
  if (new Date(payload.expiresAt) < new Date()) return false;

  await storage.setItem(LICENSE_KEY, key);
  return true;
}

/**
 * Removes the stored license key, reverting to free tier.
 */
export async function deactivateLicense(storage: StorageAdapter): Promise<void> {
  await storage.setItem(LICENSE_KEY, '');
}

/**
 * Generates a demo PRO license key for testing (expires in 30 days).
 * NEVER use this in production — it's for integration tests only.
 */
export function generateDemoLicense(tier: LicenseTier = 'PRO'): string {
  const now = new Date();
  const exp = new Date(now);
  exp.setDate(exp.getDate() + 30);
  return generateLicenseKey({
    tier,
    deviceId: 'demo-device',
    issuedAt: now.toISOString(),
    expiresAt: exp.toISOString(),
    features: tier === 'ENTERPRISE'
      ? ['agentCage', 'auditExport', 'sso', 'siem', 'centralisedPolicy']
      : ['agentCage', 'auditExport'],
    customer: 'Demo Customer',
    seats: 1,
  });
}
