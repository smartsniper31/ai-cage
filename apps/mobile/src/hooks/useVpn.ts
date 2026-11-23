// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — useVpn React hook
// Licensed under Business Source License 1.1

/**
 * @file useVpn.ts
 * React hook that manages VPN state, consent flow, and cert installation.
 *
 * USAGE:
 *   const { vpnActive, consentState, requestConsent, startVpn, stopVpn } = useVpn();
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { CageVpn, CageVpnEvents } from '../native/CageVpn';

export type ConsentState =
  | 'unknown'      // not yet checked
  | 'pending'      // waiting for user to approve app-level consent screen
  | 'granted'      // user approved app screen + Android system dialog
  | 'declined'     // user declined either screen
  | 'revoked';     // user revoked via Android system settings

export interface UseVpnReturn {
  /** Whether the VPN tunnel is currently active. */
  vpnActive: boolean;
  /** Current state of the user's consent through the double-consent flow. */
  consentState: ConsentState;
  /** Whether any async VPN operation is in progress. */
  loading: boolean;
  /** Last error message, if any. */
  error: string | null;
  /**
   * Step 1 of the consent flow — called when the user taps "Enable Protection"
   * on the app-level consent screen. Triggers the Android system VPN dialog.
   * @returns true if both consents were granted.
   */
  requestConsent: () => Promise<boolean>;
  /** Starts the VPN tunnel. Requires consentState === 'granted'. */
  startVpn: () => Promise<void>;
  /** Stops the VPN tunnel. */
  stopVpn: () => Promise<void>;
  /** Opens the Android cert installer for the local CA cert. */
  installCaCert: () => Promise<void>;
}

export function useVpn(): UseVpnReturn {
  const [vpnActive, setVpnActive]       = useState(false);
  const [consentState, setConsentState] = useState<ConsentState>('unknown');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Sync initial state on mount ───────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    CageVpn.getVpnStatus()
      .then((active) => {
        setVpnActive(active);
        if (active) setConsentState('granted');
      })
      .catch((err) => setError(String(err)));
  }, []);

  // ── Listen for VPN status broadcasts from AiCageVpnService ───────────────

  useEffect(() => {
    const sub = CageVpnEvents.addListener(
      'VpnStatusChanged',
      ({ active }: { active: boolean }) => {
        setVpnActive(active);
        if (!active && consentState === 'granted') {
          // Could have been revoked from system settings
          setConsentState('revoked');
        }
      },
    );
    return () => sub.remove();
  }, [consentState]);

  // ── requestConsent ────────────────────────────────────────────────────────

  const requestConsent = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    setLoading(true);
    setError(null);
    try {
      // Shows Android system "AI CAGE wants to set up a VPN" dialog
      const granted = await CageVpn.prepareVpn();
      setConsentState(granted ? 'granted' : 'declined');
      return granted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setConsentState('declined');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── startVpn ─────────────────────────────────────────────────────────────

  const startVpn = useCallback(async (): Promise<void> => {
    if (consentState !== 'granted') {
      setError('User consent required before starting VPN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await CageVpn.startVpn();
      setVpnActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [consentState]);

  // ── stopVpn ───────────────────────────────────────────────────────────────

  const stopVpn = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await CageVpn.stopVpn();
      setVpnActive(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── installCaCert ─────────────────────────────────────────────────────────

  const installCaCert = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await CageVpn.installCaCert();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      Alert.alert(
        'Certificate Installation',
        'Could not open the certificate installer. Please install the AI CAGE CA certificate manually via Settings → Security → Install certificate.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    vpnActive,
    consentState,
    loading,
    error,
    requestConsent,
    startVpn,
    stopVpn,
    installCaCert,
  };
}
