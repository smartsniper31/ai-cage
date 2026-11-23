// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — CA Certificate Installation Guide Screen
// Licensed under Business Source License 1.1

/**
 * @file CertInstallScreen.tsx
 *
 * Guides the user through installing the local CA certificate.
 * Without this step, Android rejects HTTPS connections to AI endpoints
 * (SSL handshake fails) because our self-signed CA is not in the system trust store.
 *
 * FLOW:
 *   1. User taps "Install Certificate"
 *   2. CageVpnModule writes ai-cage-ca.crt to getExternalFilesDir(DOWNLOADS)
 *   3a. If Activity available → KeyChain.createInstallIntent() opens system installer
 *       → setInstalled(true)
 *   3b. If no Activity (backgrounded) OR intent fails
 *       → promise resolves with file path string
 *       → Linking.openSettings() + showManualGuide = true
 *       → ManualInstallGuide walks user through Settings path
 *
 * MANUAL PATH (Settings):
 *   Settings → Security → Encryption & credentials
 *     → Install a certificate → CA Certificate
 *     → find ai-cage-ca.crt in Downloads
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { CageVpn } from '../native/CageVpn';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'CertInstall'>;

// ── Auto-install steps (shown when KeyChain intent fires) ────────────────────

const AUTO_STEPS = [
  {
    num: '1',
    title: 'Tap "Install Certificate" below',
    desc: 'Android opens the certificate installer.',
  },
  {
    num: '2',
    title: 'Name it "AI CAGE Local CA"',
    desc: 'Use this exact name so you can identify it later.',
  },
  {
    num: '3',
    title: 'Set usage to "VPN and apps"',
    desc: 'This is required for HTTPS interception to work.',
  },
  {
    num: '4',
    title: 'Tap "OK" and return here',
    desc: 'Once installed, tap "Done" to continue.',
  },
];

// ── Manual install steps (shown when fallback triggers) ──────────────────────

const MANUAL_STEPS = [
  {
    num: '1',
    title: 'Open Android Settings',
    desc: 'The Settings app will open automatically.',
  },
  {
    num: '2',
    title: 'Go to Security',
    desc: 'Settings → Security (or "Biometrics and security" on Samsung).',
  },
  {
    num: '3',
    title: 'Encryption & credentials',
    desc: 'Scroll down to find "Encryption & credentials".',
  },
  {
    num: '4',
    title: 'Install a certificate → CA Certificate',
    desc: 'Tap "Install a certificate", then select "CA Certificate".',
  },
  {
    num: '5',
    title: 'Find ai-cage-ca.crt in Downloads',
    desc: 'Navigate to Downloads → Android → data → io.aicage.mobile → files → Downloads → ai-cage-ca.crt',
  },
  {
    num: '6',
    title: 'Confirm and return here',
    desc: 'Tap "Install anyway" if prompted, then return and tap "Done".',
  },
];

// ── ManualInstallGuide component ─────────────────────────────────────────────

function ManualInstallGuide({ certPath }: { certPath: string | null }) {
  return (
    <View style={styles.manualBox}>
      <Text style={styles.manualTitle}>📋 Manual Installation Required</Text>
      <Text style={styles.manualDesc}>
        The automatic installer could not open. Follow these steps to install
        the certificate manually:
      </Text>

      {MANUAL_STEPS.map((step) => (
        <View key={step.num} style={styles.stepRow}>
          <View style={[styles.stepNum, styles.stepNumManual]}>
            <Text style={styles.stepNumText}>{step.num}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>
          </View>
        </View>
      ))}

      {certPath ? (
        <View style={styles.certPathBox}>
          <Text style={styles.certPathLabel}>Certificate file location:</Text>
          <Text style={styles.certPathValue} selectable>{certPath}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function CertInstallScreen({ navigation }: Props) {
  const [loading,          setLoading]          = useState(false);
  const [installed,        setInstalled]        = useState(false);
  const [showManualGuide,  setShowManualGuide]  = useState(false);
  const [manualCertPath,   setManualCertPath]   = useState<string | null>(null);
  const [error,            setError]            = useState<string | null>(null);

  // ── handleInstall ─────────────────────────────────────────────────────────

  /**
   * Calls CageVpnModule.installCaCert() directly (not via useVpn) because
   * the screen needs the typed return value: boolean (intent fired) or
   * string (file path — fallback to manual guide).
   *
   * Promise<boolean | string>:
   *   true     → KeyChain intent started → setInstalled(true)
   *   string   → no Activity / intent failed → Linking.openSettings() + manualGuide
   *
   * catch (any rejection):
   *   CERT_INSTALL_ERROR → Linking.openSettings() + manualGuide
   */
  const handleInstall = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CageVpn.installCaCert();

      if (typeof result === 'string') {
        // Kotlin returned the file path — Activity was unavailable or intent failed.
        // Open Settings so the user can install manually.
        setManualCertPath(result);
        setShowManualGuide(true);
        await Linking.openSettings();
      } else {
        // result === true — KeyChain intent launched successfully.
        setInstalled(true);
      }
    } catch (e) {
      // Any rejection (CERT_INSTALL_ERROR, permission denied, etc.)
      // — fall back to the manual guide.
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setShowManualGuide(true);
      await Linking.openSettings();
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    // Persist the onboarding flag so App.tsx routes returning users to Home
    // instead of ConsentScreen. Key must match ONBOARDING_DONE_KEY in App.tsx.
    try {
      await AsyncStorage.setItem('ai-cage:onboarding-done-v1', 'true');
    } catch (e) {
      console.warn('[CertInstallScreen] AsyncStorage write failed:', e);
    }
    navigation.replace('Home');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.icon}>🔑</Text>
          <Text style={styles.title}>Install Security Certificate</Text>
          <Text style={styles.subtitle}>
            One-time setup. This certificate stays on your device and is never
            transmitted anywhere.
          </Text>
        </View>

        {/* Why section */}
        <View style={styles.whyBox}>
          <Text style={styles.whyTitle}>Why is this needed?</Text>
          <Text style={styles.whyText}>
            AI APIs use HTTPS. To read and sanitise the request body before it
            reaches the AI, the VPN proxy needs to decrypt the traffic locally.
            This requires a trusted certificate installed on your device.
            {'\n\n'}
            The certificate is generated fresh on your phone, stored in
            app-scoped Downloads, and never leaves your device.
          </Text>
        </View>

        {/* Auto-install steps (shown before install is attempted) */}
        {!showManualGuide && (
          <View style={styles.stepsContainer}>
            {AUTO_STEPS.map((step) => (
              <View key={step.num} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.num}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Manual guide (shown when fallback triggers) */}
        {showManualGuide && (
          <ManualInstallGuide certPath={manualCertPath} />
        )}

        {/* Error display */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Install button — hidden once intent fired or manual guide shown */}
        {!installed && !showManualGuide && (
          <TouchableOpacity
            style={[styles.installButton, loading && styles.buttonDisabled]}
            onPress={handleInstall}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Install AI CAGE certificate"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.installButtonText}>Install Certificate</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Success banner */}
        {installed && (
          <View style={styles.installedBanner}>
            <Text style={styles.installedText}>
              ✅ Certificate installer opened. After approving in Settings,
              tap Done.
            </Text>
          </View>
        )}

        {/* Retry button in manual mode */}
        {showManualGuide && !installed && (
          <TouchableOpacity
            style={[styles.installButton, loading && styles.buttonDisabled]}
            onPress={handleInstall}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Retry certificate installation"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.installButtonText}>↻ Retry Auto-Install</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Done / Skip */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Continue to home screen"
        >
          <Text style={styles.doneButtonText}>
            {installed || showManualGuide
              ? 'Done — Go to Dashboard'
              : 'Skip for now'}
          </Text>
        </TouchableOpacity>

        {!installed && !showManualGuide && (
          <Text style={styles.skipNote}>
            You can install the certificate later from Dashboard → Settings.
            Without it, HTTPS traffic to AI APIs will not be intercepted.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0a0a0f',
  surface:     '#13131a',
  surfaceWarn: '#1a1500',
  border:      '#1e1e2e',
  borderWarn:  '#a16207',
  accent:      '#7c5cfc',
  accentLight: '#a78bfa',
  text:        '#e2e8f0',
  textMuted:   '#94a3b8',
  success:     '#10b981',
  warning:     '#f59e0b',
  error:       '#ef4444',
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  scroll:     { padding: 24, paddingBottom: 48 },
  header:     { alignItems: 'center', marginBottom: 28 },
  icon:       { fontSize: 52, marginBottom: 12 },
  title: {
    fontSize: 24, fontWeight: '800', color: C.text,
    marginBottom: 10, textAlign: 'center',
  },
  subtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  whyBox: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  whyTitle: {
    fontSize: 14, fontWeight: '700', color: C.accentLight,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
  },
  whyText:    { fontSize: 14, color: C.textMuted, lineHeight: 21 },
  stepsContainer: { marginBottom: 24 },
  stepRow:    { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  stepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, marginTop: 2,
  },
  stepNumManual: { backgroundColor: C.warning },
  stepNumText:   { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepContent:   { flex: 1 },
  stepTitle:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  stepDesc:      { fontSize: 13, color: C.textMuted, lineHeight: 19 },
  // Manual guide
  manualBox: {
    backgroundColor: C.surfaceWarn,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderWarn,
  },
  manualTitle: {
    fontSize: 15, fontWeight: '800', color: C.warning,
    marginBottom: 8,
  },
  manualDesc: {
    fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 16,
  },
  certPathBox: {
    backgroundColor: '#0d0d16',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  certPathLabel: { fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  certPathValue: { fontSize: 11, color: C.accentLight, fontFamily: 'monospace', lineHeight: 16 },
  // Error
  errorBox: {
    backgroundColor: '#2d1515',
    borderRadius: 10, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: C.error,
  },
  errorText:      { color: C.error, fontSize: 13 },
  // Success
  installedBanner: {
    backgroundColor: '#0d2d1f',
    borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.success,
  },
  installedText:  { color: C.success, fontSize: 14, lineHeight: 20 },
  // Buttons
  installButton: {
    backgroundColor: C.accent,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 14,
  },
  buttonDisabled: { opacity: 0.6 },
  installButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneButton: {
    borderWidth: 1, borderColor: C.accent,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 14,
  },
  doneButtonText: { color: C.accentLight, fontSize: 16, fontWeight: '600' },
  skipNote: { fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
});
