// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — TypeScript bridge to CageVpnModule (Kotlin NativeModule)
// Licensed under Business Source License 1.1

/**
 * @file CageVpn.ts
 * Typed TypeScript wrapper around the Android NativeModule "CageVpn".
 *
 * This is the ONLY file in the codebase that imports NativeModules.
 * All other TypeScript code imports from this file — never from NativeModules directly.
 *
 * USAGE:
 *   import { CageVpn } from '../native/CageVpn';
 *
 *   const granted = await CageVpn.prepareVpn();   // shows Android system dialog
 *   if (granted) await CageVpn.startVpn();
 *
 * EVENTS:
 *   import { CageVpnEvents } from '../native/CageVpn';
 *   CageVpnEvents.addListener('VpnStatusChanged', ({ active }) => { ... });
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ── Type contract mirroring CageVpnModule.kt ─────────────────────────────────

export interface ICageVpnModule {
  /**
   * Requests Android VPN permission via VpnService.prepare().
   * Shows the system dialog on first call; resolves instantly if already granted.
   * @returns true if permission granted, false if user declined.
   */
  prepareVpn(): Promise<boolean>;

  /**
   * Starts the AI CAGE VPN service.
   * Requires prepareVpn() to have returned true first.
   * Throws 'CONSENT_REQUIRED' if called without prior consent.
   */
  startVpn(): Promise<void>;

  /**
   * Stops the AI CAGE VPN service and closes the TUN interface.
   */
  stopVpn(): Promise<void>;

  /**
   * Returns the current VPN active state.
   */
  getVpnStatus(): Promise<boolean>;

  /**
   * Cages PII in a text string using the on-device engine.
   * Primarily for testing — normal caging happens transparently in the proxy.
   */
  cageText(text: string): Promise<string>;

  /**
   * Writes the local CA certificate to Downloads and opens the Android cert installer.
   * @returns `true` if the KeyChain intent launched; a `string` file path if no
   *          Activity was available (JS must open Settings manually).
   */
  installCaCert(): Promise<boolean | string>;
}

// ── Event types ──────────────────────────────────────────────────────────────

export interface VpnStatusChangedEvent {
  active: boolean;
}

export interface CageEventPayload {
  caged: number;
  timestamp: number;
}

// ── Module access ────────────────────────────────────────────────────────────

const { CageVpn: _CageVpn } = NativeModules;

if (!_CageVpn && Platform.OS === 'android') {
  console.error(
    '[AI CAGE] CageVpn NativeModule not found. ' +
    'Run `expo prebuild` and rebuild the native Android project. ' +
    'The module is registered in CageVpnPackage.kt.',
  );
}

/**
 * Typed access to the CageVpn NativeModule.
 * All methods are no-ops on non-Android platforms (graceful degradation).
 */
export const CageVpn: ICageVpnModule = _CageVpn ?? {
  prepareVpn:   () => Promise.resolve(false),
  startVpn:     () => Promise.resolve(),
  stopVpn:      () => Promise.resolve(),
  getVpnStatus: () => Promise.resolve(false),
  cageText:     (text: string) => Promise.resolve(text),
  installCaCert: () => Promise.resolve(false),
};

/**
 * Event emitter for VPN status and cage activity events.
 *
 * @example
 * ```ts
 * const sub = CageVpnEvents.addListener('VpnStatusChanged', ({ active }) => {
 *   setVpnActive(active);
 * });
 * return () => sub.remove();
 * ```
 */
export const CageVpnEvents = _CageVpn
  ? new NativeEventEmitter(_CageVpn)
  : { addListener: () => ({ remove: () => {} }) } as unknown as NativeEventEmitter;
