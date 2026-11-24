// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — License Screen
// Licensed under Business Source License 1.1

/**
 * @file LicenseScreen.tsx
 * Pro license activation and tier comparison screen.
 *
 * Uses the same license engine as desktop + extension (packages/core/src/license.ts).
 * Key is stored in expo-secure-store (hardware-backed Android Keystore).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  mobileCheckLicense,
  mobileActivateLicense,
  mobileDeactivateLicense,
  type LicenseInfo,
} from '../lib/mobileCage';

type Props = NativeStackScreenProps<RootStackParamList, 'License'>;

const TIERS = [
  {
    id: 'FREE',
    label: 'Free',
    price: '€0',
    color: '#94a3b8',
    features: [
      '15 PII types detected',
      '100 cages / month',
      'Shadow AI detection',
      'Basic VPN protection',
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    price: '€5 / user / mo',
    color: '#7c5cfc',
    features: [
      'All 18+ PII types',
      'Unlimited cages',
      'Audit log export',
      'Custom policy rules',
      'Agent cage engine',
      'MCP monitor',
    ],
  },
];

export function LicenseScreen({ navigation }: Props) {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [keyInput, setKeyInput]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [activating, setActivating]   = useState(false);
  const [message, setMessage]         = useState<{ text: string; ok: boolean } | null>(null);

  const loadLicense = useCallback(async () => {
    setLoading(true);
    try {
      const info = await mobileCheckLicense();
      setLicenseInfo(info);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLicense(); }, [loadLicense]);

  // ── Activate ──────────────────────────────────────────────────────────────

  const handleActivate = async () => {
    const key = keyInput.trim();
    if (!key) {
      setMessage({ text: 'Enter your license key first.', ok: false });
      return;
    }
    Keyboard.dismiss();
    setActivating(true);
    setMessage(null);
    try {
      const ok = await mobileActivateLicense(key);
      if (ok) {
        setMessage({ text: '✅ License activated successfully!', ok: true });
        setKeyInput('');
        await loadLicense();
      } else {
        setMessage({ text: '❌ Invalid or expired license key.', ok: false });
      }
    } catch (err) {
      setMessage({ text: `Error: ${String(err)}`, ok: false });
    } finally {
      setActivating(false);
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate License',
      'This will remove your Pro license and revert to the free tier. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await mobileDeactivateLicense();
            await loadLicense();
            setLoading(false);
          },
        },
      ],
    );
  };

  const activeTier = licenseInfo?.tier ?? 'FREE';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>License</Text>
        </View>

        {/* Current status */}
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current plan</Text>
            <Text style={[styles.statusTier, { color: activeTier === 'PRO' ? C.accent : C.textMuted }]}>
              {activeTier}
            </Text>
            {licenseInfo?.payload && (
              <>
                <Text style={styles.statusDetail}>
                  Customer: {licenseInfo.payload.customer}
                </Text>
                <Text style={styles.statusDetail}>
                  Expires: {licenseInfo.payload.expiresAt.slice(0, 10)}
                </Text>
                <Text style={styles.statusDetail}>
                  Seats: {licenseInfo.payload.seats}
                </Text>
              </>
            )}
            {licenseInfo?.message ? (
              <Text style={styles.statusMessage}>{licenseInfo.message}</Text>
            ) : null}
            {activeTier !== 'FREE' && (
              <TouchableOpacity onPress={handleDeactivate} style={styles.deactivateBtn}>
                <Text style={styles.deactivateBtnText}>Deactivate License</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tier comparison */}
        <Text style={styles.sectionTitle}>Plans</Text>
        <View style={styles.tierRow}>
          {TIERS.map((tier) => (
            <View
              key={tier.id}
              style={[
                styles.tierCard,
                activeTier === tier.id && { borderColor: tier.color },
              ]}
            >
              {activeTier === tier.id && (
                <View style={[styles.activeBadge, { backgroundColor: tier.color }]}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
              <Text style={styles.tierPrice}>{tier.price}</Text>
              {tier.features.map((f) => (
                <Text key={f} style={styles.tierFeature}>✓ {f}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* Key activation */}
        <Text style={styles.sectionTitle}>Activate Pro License</Text>
        <View style={styles.activateCard}>
          <Text style={styles.activateDesc}>
            Enter the license key from your purchase confirmation email.
            Keys are tied to your organisation — contact support for multi-seat licenses.
          </Text>
          <TextInput
            style={styles.keyInput}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="XXXXXXXXXXXX.XXXXXXXX"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleActivate}
            accessibilityLabel="License key input"
          />
          {message ? (
            <Text style={[styles.activateMessage, { color: message.ok ? C.success : C.error }]}>
              {message.text}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.activateBtn, activating && styles.activateBtnDisabled]}
            onPress={handleActivate}
            disabled={activating}
            accessibilityRole="button"
            accessibilityLabel="Activate license key"
          >
            {activating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.activateBtnText}>Activate</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Purchase link */}
        <View style={styles.purchaseBox}>
          <Text style={styles.purchaseText}>
            Don't have a license yet?
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://ai-cage.lemonsqueezy.com/checkout/buy/c19b48b0-477b-44b4-887c-7ebbfd457992')}
            accessibilityRole="link"
            accessibilityLabel="Buy AI CAGE Pro"
          >
            <Text style={[styles.purchaseLink, { textDecorationLine: 'underline' }]}>
              🔒 Get Pro — €5 / month →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0a0a0f',
  surface:     '#13131a',
  border:      '#1e1e2e',
  accent:      '#7c5cfc',
  accentLight: '#a78bfa',
  text:        '#e2e8f0',
  textMuted:   '#94a3b8',
  success:     '#10b981',
  error:       '#ef4444',
};

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  scroll:             { padding: 20, paddingBottom: 60 },
  header:             { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 16 },
  backButton:         { paddingVertical: 4, paddingRight: 8 },
  backText:           { color: C.accentLight, fontSize: 16 },
  title:              { fontSize: 22, fontWeight: '800', color: C.text },
  statusCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusLabel:        { fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  statusTier:         { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  statusDetail:       { fontSize: 13, color: C.textMuted, marginBottom: 3 },
  statusMessage:      { fontSize: 13, color: C.accentLight, marginTop: 8, lineHeight: 18 },
  deactivateBtn:      { marginTop: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.error, borderRadius: 10 },
  deactivateBtnText:  { color: C.error, fontSize: 14, fontWeight: '600' },
  sectionTitle:       { fontSize: 13, fontWeight: '700', color: C.accentLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  tierRow:            { flexDirection: 'row', gap: 12, marginBottom: 28 },
  tierCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    position: 'relative',
  },
  activeBadge: {
    position: 'absolute',
    top: -1,
    right: 10,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText:    { color: '#fff', fontSize: 10, fontWeight: '700' },
  tierLabel:          { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  tierPrice:          { fontSize: 13, color: C.textMuted, marginBottom: 12 },
  tierFeature:        { fontSize: 12, color: C.text, marginBottom: 4, lineHeight: 18 },
  activateCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  activateDesc:       { fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 14 },
  keyInput: {
    backgroundColor: '#0d0d16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  activateMessage:    { fontSize: 13, marginBottom: 10 },
  activateBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activateBtnDisabled: { opacity: 0.6 },
  activateBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  purchaseBox: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  purchaseText:        { color: C.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  purchaseLink:        { color: C.accentLight, fontWeight: '600' },
});
