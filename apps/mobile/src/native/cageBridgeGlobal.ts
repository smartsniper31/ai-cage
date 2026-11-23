// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Global JS bridge registration for synchronous Kotlin access
// Licensed under Business Source License 1.1

/**
 * @file cageBridgeGlobal.ts
 *
 * Registers `global.__aiCageCageText` so the Kotlin CageNativeModule can call
 * the PII engine synchronously from the JS thread via evaluateJavaScript().
 *
 * MUST be imported once at app startup — before the VPN service starts.
 * Import location: App.tsx (top of file, before any other import).
 *
 * SECURITY CONTRACT:
 *   - This function runs in the Hermes JS engine, 100% on-device.
 *   - It calls cageText() from @ai-cage/core — no network, no storage.
 *   - It returns ONLY the cagedText string — never the entities array.
 *     The entities (which contain original PII values) are never passed
 *     to the Kotlin layer.
 *   - If cageText() throws, the original text is returned as a safe fallback.
 */

import { cageText } from '@ai-cage/core';

// Extend the Hermes / React Native global object so TypeScript
// recognises the properties we register at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

/**
 * Registers the global cage function used by CageNativeModule.kt.
 * Call once at app startup.
 */
export function registerCageBridgeGlobal(): void {
  if (g.__aiCageCageText) {
    return;
  }

  g.__aiCageCageText = (text: string): string => {
    try {
      const { cagedText } = cageText(text);
      return cagedText;
    } catch (err) {
      console.warn('[AI CAGE] cageText() threw in global bridge:', err);
      return text;
    }
  };

  g.__aiCageReady = true;
  console.log('[AI CAGE] Global cage bridge registered — Hermes engine ready');
}
