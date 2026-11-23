// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — PII cage layer for React Native
// Licensed under Business Source License 1.1

/**
 * @file mobileCage.ts
 * React Native wrapper around @ai-cage/core.
 *
 * This is the single entry point for all PII operations in the mobile app.
 * It wires @ai-cage/core to AsyncStorage (for audit log) and expo-secure-store
 * (for license key — hardware-backed on supported devices).
 *
 * SECURITY CONTRACT:
 *   - cageText() calls the core engine — zero network, zero disk write of PII.
 *   - Entities (original PII values) are NEVER written to AsyncStorage.
 *   - License key is stored in SecureStore (encrypted, hardware-backed).
 *   - Audit log entries contain only placeholders, types, and counts — never raw PII.
 *
 * USAGE:
 *   import { mobileCage, mobileUncage, mobileCheckLicense } from '../lib/mobileCage';
 *
 *   const result = await mobileCage('Send invoice to alice@acme.io');
 *   // result.cagedText → 'Send invoice to [CAGED_EMAIL_A7X9_1]'
 *   // result.entities  → [{ placeholder, originalValue, type, score }]  ← keep in memory only
 */

import {
  cageText,
  uncageText,
  summariseCaged,
  detectQuasiIdentifiers,
  logEvent,
  getAuditSummary,
  checkLicense,
  activateLicense,
  deactivateLicense,
  matchAiEndpoint,
  type CageResult,
  type CagedEntity,
  type LicenseInfo,
  type StorageAdapter,
} from '@ai-cage/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ── Shared constants ────────────────────────────────────────────────────────

/**
 * Total number of AI endpoints intercepted by the VPN proxy.
 * Mirrors AiEndpointMatcher.kt exactHosts + suffixPatterns coverage.
 * Single source of truth for the UI — never hardcode this in screens.
 */
export const AI_ENDPOINT_COUNT = 53;

// ── Storage adapters ──────────────────────────────────────────────────────────

/**
 * AsyncStorage adapter for the audit log.
 * Keys are prefixed with 'ai-cage:' to avoid collisions.
 */
const asyncStorageAdapter: StorageAdapter = {
  getItem: async (key: string) => {
    return AsyncStorage.getItem(`ai-cage:${key}`);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(`ai-cage:${key}`, value);
  },
};

/**
 * SecureStore adapter for the license key.
 * Uses expo-secure-store which maps to Android Keystore (hardware-backed).
 * Falls back to AsyncStorage on devices without secure hardware.
 */
const secureStoreAdapter: StorageAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // SecureStore unavailable (emulator, old device) — fall back to AsyncStorage
      return AsyncStorage.getItem(`ai-cage:secure:${key}`);
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(`ai-cage:secure:${key}`, value);
    }
  },
};

// ── Core PII operations ───────────────────────────────────────────────────────

/**
 * Cages PII in [text] and logs the event to the audit log.
 *
 * @param text Raw text that may contain PII.
 * @param endpoint Optional AI endpoint URL being called (for audit context).
 * @returns Full CageResult — entities are in-memory only, never persisted.
 */
export async function mobileCage(
  text: string,
  endpoint?: string,
): Promise<CageResult> {
  const result = cageText(text);

  // Log to audit (only placeholder summaries — no original values)
  if (result.totalCaged > 0) {
    await logEvent(
      {
        type:       'PII_CAGED',
        site:       endpoint ?? 'unknown',
        counts:     Object.fromEntries(
          result.entities.map(e => [e.type, 1]),
        ),
        totalCount: result.totalCaged,
      },
      asyncStorageAdapter,
    );
  }

  return result;
}

/**
 * Restores PII placeholders in an AI response using the entity map from mobileCage().
 *
 * @param cagedResponse The AI's response containing placeholders.
 * @param entities      The entities array from the matching mobileCage() call.
 * @returns The response with original values restored.
 */
export function mobileUncage(
  cagedResponse: string,
  entities: readonly CagedEntity[],
): string {
  return uncageText(cagedResponse, entities);
}

/**
 * Runs inference risk analysis on [text] without modifying it.
 * Useful for showing risk warnings in the UI before the user sends a prompt.
 */
export function mobileAnalyzeRisk(text: string) {
  return detectQuasiIdentifiers(text);
}

/**
 * Returns the first matching AI endpoint for a URL, or null if none match.
 * Wraps matchAiEndpoint() which returns an array — we take the first match.
 */
export function mobileMatchEndpoint(url: string) {
  const matches = matchAiEndpoint(url);
  return matches.length > 0 ? matches[0] ?? null : null;
}

// ── License operations ────────────────────────────────────────────────────────

/**
 * Returns the current license status and feature flags.
 */
export async function mobileCheckLicense(): Promise<LicenseInfo> {
  const summary = await getAuditSummary(asyncStorageAdapter);
  return checkLicense(secureStoreAdapter, summary.totalCaged);
}

/**
 * Activates a Pro license key entered by the user.
 * @returns true if the key was valid and stored, false if invalid.
 */
export async function mobileActivateLicense(key: string): Promise<boolean> {
  return activateLicense(key, secureStoreAdapter);
}

/**
 * Deactivates the current license, reverting to the free tier.
 */
export async function mobileDeactivateLicense(): Promise<void> {
  return deactivateLicense(secureStoreAdapter);
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Returns the audit summary for the current month (cage count, etc.)
 */
export async function mobileGetAuditSummary() {
  return getAuditSummary(asyncStorageAdapter);
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export { asyncStorageAdapter, secureStoreAdapter };
export type { CageResult, CagedEntity, LicenseInfo };
