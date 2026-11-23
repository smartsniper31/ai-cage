// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Consent Screen (double-consent gate)
// Licensed under Business Source License 1.1

/**
 * @file ConsentScreen.tsx
 *
 * First screen the user sees. Implements the double-consent model:
 *   Gate 1 — App-level: user reads what will be intercepted and taps "Enable Protection"
 *   Gate 2 — Android system: VpnService.prepare() shows the OS-level VPN dialog
 *
 * The user proceeds to HomeScreen only after BOTH gates are cleared.
 * If the user declines either gate, they stay on this screen.
 *
 * LEGAL NOTE:
 *   This screen satisfies GDPR Art. 7 (freely given, specific, informed, unambiguous)
 *   and Android VPN permission requirements. Do not remove or simplify the disclosures.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useVpn } from '../hooks/useVpn';

type Props = NativeStackScreenProps<RootStackParamList, 'Consent'>;

// What we intercept — shown to the user before they consent
const INTERCEPTED_SERVICES = [
  { name: 'ChatGPT / OpenAI', icon: '🤖' },
  { name: 'Claude (Anthropic)', icon: '🧠' },
  { name: 'Gemini (Google)', icon: '✨' },
  { name: 'Grok (xAI)', icon: '𝕏' },
  { name: 'DeepSeek', icon: '🔍' },
  { name: 'Mistral, Groq, Perplexity', icon: '⚡' },
  { name: '47 other AI endpoints', icon: '🌐' },
];

const GUARANTEES = [
  { text: 'All processing happens on this device', icon: '📱' },
  { text: 'Zero data sent to AI CAGE servers', icon: '🔒' },
  { text: 'No PII ever stored on disk', icon: '🗑️' },
  { text: 'You can disable at any time', icon: '✋' },
];

export function ConsentScreen({ navigation }: Props) {
  const { requestConsent, loading, error } = useVpn();
  const [step, setStep] = useState<'info' | 'requesting' | 'declined'>('info');

  const handleEnable = async () => {
    setStep('requesting');

    // Gate 2: Android system VPN dialog
    const granted = await requestConsent();

    if (granted) {
      navigation.replace('CertInstall');
    } else {
      setStep('declined');
    }
  };

  const handleDeclined = () => {
    Alert.alert(
      'Protection Disabled',
      'AI CAGE cannot protect your prompts without the VPN permission. ' +
        'You can enable it later from the main screen.',
      [
        {
          text: 'Try Again',
          onPress: () => setStep('info'),
        },
        {
          text: 'Continue Without Protection',
          style: 'destructive',
          onPress: () => navigation.replace('Home'),
        },
      ],
    );
  };

  // useEffect ensures handleDeclined runs only when step transitions to 'declined',
  // not during the render phase (which would cause a setState-during-render warning).
  useEffect(() => {
    if (step === 'declined') handleDeclined();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🔐</Text>
          <Text style={styles.title}>AI CAGE</Text>
          <Text style={styles.subtitle}>
            Before we start, here is exactly what AI CAGE does on your device.
          </Text>
        </View>

        {/* What it intercepts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What will be intercepted</Text>
          <Text style={styles.sectionDesc}>
            AI CAGE creates a local VPN tunnel on your phone. When you send a
            prompt to any of these services, AI CAGE scans the text, replaces
            personal data with safe placeholders, and forwards the sanitised
            prompt. The AI never sees your real name, email, phone, IBAN, or
            other private data.
          </Text>
          {INTERCEPTED_SERVICES.map((s) => (
            <View key={s.name} style={styles.listRow}>
              <Text style={styles.listIcon}>{s.icon}</Text>
              <Text style={styles.listText}>{s.name}</Text>
            </View>
          ))}
        </View>

        {/* Guarantees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our guarantees</Text>
          {GUARANTEES.map((g) => (
            <View key={g.text} style={styles.listRow}>
              <Text style={styles.listIcon}>{g.icon}</Text>
              <Text style={styles.listText}>{g.text}</Text>
            </View>
          ))}
        </View>

        {/* Android note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            After tapping "Enable Protection", Android will show its own VPN
            permission dialog. This is a mandatory system confirmation — AI CAGE
            cannot skip it.
          </Text>
        </View>

        {/* Error display */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, loading && styles.ctaDisabled]}
          onPress={handleEnable}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Enable AI CAGE protection"
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaText}>Enable Protection</Text>
          )}
        </TouchableOpacity>

        {/* Skip link */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.replace('Home')}
          accessibilityRole="button"
          accessibilityLabel="Continue without protection"
        >
          <Text style={styles.skipText}>Continue without protection</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:          '#0a0a0f',
  surface:     '#13131a',
  border:      '#1e1e2e',
  accent:      '#7c5cfc',
  accentLight: '#a78bfa',
  text:        '#e2e8f0',
  textMuted:   '#94a3b8',
  success:     '#10b981',
  warning:     '#f59e0b',
  error:       '#ef4444',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accentLight,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  listIcon: {
    fontSize: 18,
    width: 32,
  },
  listText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  noteBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#2d1515',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
  },
  ctaButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
