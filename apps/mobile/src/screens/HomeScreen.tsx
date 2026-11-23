// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Home / Dashboard Screen
// Licensed under Business Source License 1.1

/**
 * @file HomeScreen.tsx
 * Main dashboard. Shows VPN status, cage statistics, and quick actions.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │  🔐  AI CAGE           ⚙️   │
 *   ├──────────────────────────────┤
 *   │  [BIG VPN TOGGLE]            │
 *   │  "Protected" / "Off"         │
 *   ├──────────────────────────────┤
 *   │  Stats: caged / endpoints    │
 *   ├──────────────────────────────┤
 *   │  [License banner if Free]    │
 *   ├──────────────────────────────┤
 *   │  Intercepted services list   │
 *   └──────────────────────────────┘
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useVpn } from '../hooks/useVpn';
import { mobileCheckLicense, mobileGetAuditSummary, AI_ENDPOINT_COUNT } from '../lib/mobileCage';
import type { LicenseInfo } from '../lib/mobileCage';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface AuditStats {
  monthlyCageCount: number;
  totalCageCount: number;
}

export function HomeScreen({ navigation }: Props) {
  const {
    vpnActive,
    consentState,
    loading: vpnLoading,
    error: vpnError,
    requestConsent,
    startVpn,
    stopVpn,
  } = useVpn();

  const [licenseInfo, setLicenseInfo]   = useState<LicenseInfo | null>(null);
  const [stats, setStats]               = useState<AuditStats>({ monthlyCageCount: 0, totalCageCount: 0 });
  const [refreshing, setRefreshing]     = useState(false);
  const [toggling, setToggling]         = useState(false);

  // ── Load stats + license on mount ────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [license, audit] = await Promise.all([
        mobileCheckLicense(),
        mobileGetAuditSummary(),
      ]);
      setLicenseInfo(license);
      setStats({
        monthlyCageCount: audit.totalCaged,
        totalCageCount:   audit.totalCaged ?? 0,
      });
    } catch (err) {
      console.warn('[HomeScreen] loadData error:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── VPN toggle ────────────────────────────────────────────────────────────

  const handleToggle = async (value: boolean) => {
    setToggling(true);
    try {
      if (value) {
        // Need consent before starting
        if (consentState !== 'granted') {
          const granted = await requestConsent();
          if (!granted) return;
        }
        await startVpn();
      } else {
        await stopVpn();
      }
    } finally {
      setToggling(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────

  const isProtected  = vpnActive;
  const statusLabel  = isProtected ? 'Protected' : 'Off';
  const statusColor  = isProtected ? C.success : C.textMuted;
  const isFreeTier   = !licenseInfo || licenseInfo.tier === 'FREE';
  const limitReached = licenseInfo?.limitReached ?? false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.brandText}>🔐 AI CAGE</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('License')}
            accessibilityRole="button"
            accessibilityLabel="License settings"
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Big VPN toggle card */}
        <View style={[styles.vpnCard, isProtected && styles.vpnCardActive]}>
          <View style={styles.vpnCardInner}>
            <Text style={styles.vpnStatusIcon}>{isProtected ? '🛡️' : '⚠️'}</Text>
            <Text style={[styles.vpnStatusLabel, { color: statusColor }]}>
              {statusLabel}
            </Text>
            <Text style={styles.vpnStatusDesc}>
              {isProtected
                ? 'Your AI prompts are being protected'
                : 'Enable protection to cage your PII'}
            </Text>
          </View>

          <View style={styles.toggleRow}>
            {toggling || vpnLoading ? (
              <ActivityIndicator color={C.accent} size="large" />
            ) : (
              <Switch
                value={vpnActive}
                onValueChange={handleToggle}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor={vpnActive ? '#fff' : C.textMuted}
                ios_backgroundColor={C.border}
                accessibilityRole="switch"
                accessibilityLabel="Toggle VPN protection"
              />
            )}
          </View>

          {vpnError ? (
            <Text style={styles.vpnError}>⚠️ {vpnError}</Text>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.monthlyCageCount}</Text>
            <Text style={styles.statLabel}>Caged this month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCageCount}</Text>
            <Text style={styles.statLabel}>All time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{AI_ENDPOINT_COUNT}</Text>
            <Text style={styles.statLabel}>AI endpoints</Text>
          </View>
        </View>

        {/* Free tier banner */}
        {isFreeTier && (
          <TouchableOpacity
            style={[styles.licenseBanner, limitReached && styles.licenseBannerWarning]}
            onPress={() => navigation.navigate('License')}
            accessibilityRole="button"
          >
            <View style={styles.licenseBannerContent}>
              <Text style={styles.licenseBannerTitle}>
                {limitReached ? '⚠️ Monthly limit reached' : '✨ Free tier active'}
              </Text>
              <Text style={styles.licenseBannerDesc}>
                {limitReached
                  ? `${stats.monthlyCageCount}/100 cages used. Upgrade to Pro for unlimited protection.`
                  : `${stats.monthlyCageCount}/100 cages used this month. Upgrade for unlimited.`}
              </Text>
            </View>
            <Text style={styles.licenseBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Protected services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protected AI Services</Text>
          {SERVICES.map((group) => (
            <View key={group.category} style={styles.serviceGroup}>
              <Text style={styles.serviceGroupLabel}>{group.category}</Text>
              {group.items.map((item) => (
                <View key={item} style={styles.serviceRow}>
                  <View style={[styles.serviceDot, isProtected && styles.serviceDotActive]} />
                  <Text style={styles.serviceText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Cert install reminder if needed */}
        <TouchableOpacity
          style={styles.certReminder}
          onPress={() => navigation.navigate('CertInstall')}
          accessibilityRole="button"
        >
          <Text style={styles.certReminderText}>
            🔑 Certificate not installed? Tap to set up HTTPS protection
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const SERVICES = [
  {
    category: 'Direct LLM APIs',
    items: ['OpenAI / ChatGPT', 'Anthropic Claude', 'Google Gemini', 'Grok (xAI)', 'DeepSeek', 'Mistral · Groq · Perplexity'],
  },
  {
    category: 'Developer Tools',
    items: ['GitHub Copilot', 'Cursor AI', 'Codeium · Tabnine'],
  },
  {
    category: 'SaaS Embedded AI',
    items: ['Grammarly', 'Notion AI', 'Slack AI', 'Microsoft 365 Copilot'],
  },
  {
    category: 'Meeting & Transcription',
    items: ['Otter.ai', 'Fireflies.ai', 'Read.ai', 'tl;dv · Fathom'],
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0a0a0f',
  surface:     '#13131a',
  surfaceHigh: '#1a1a2e',
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
  container:          { flex: 1, backgroundColor: C.bg },
  scroll:             { padding: 20, paddingBottom: 48 },
  topBar:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brandText:          { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: 1 },
  settingsIcon:       { fontSize: 24 },
  vpnCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  vpnCardActive:      { borderColor: C.accent, backgroundColor: '#13112a' },
  vpnCardInner:       { alignItems: 'center', marginBottom: 20 },
  vpnStatusIcon:      { fontSize: 56, marginBottom: 12 },
  vpnStatusLabel:     { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  vpnStatusDesc:      { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  toggleRow:          { width: '100%', alignItems: 'center' },
  vpnError:           { color: C.error, fontSize: 13, marginTop: 10, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  statCard:           { flex: 1, alignItems: 'center' },
  statValue:          { fontSize: 24, fontWeight: '800', color: C.accentLight, marginBottom: 4 },
  statLabel:          { fontSize: 11, color: C.textMuted, textAlign: 'center' },
  statDivider:        { width: 1, backgroundColor: C.border, marginHorizontal: 8 },
  licenseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceHigh,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.accent,
  },
  licenseBannerWarning: { borderColor: C.warning },
  licenseBannerContent: { flex: 1 },
  licenseBannerTitle:   { fontSize: 14, fontWeight: '700', color: C.accentLight, marginBottom: 4 },
  licenseBannerDesc:    { fontSize: 13, color: C.textMuted, lineHeight: 18 },
  licenseBannerArrow:   { fontSize: 18, color: C.accent, marginLeft: 8 },
  section: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle:         { fontSize: 13, fontWeight: '700', color: C.accentLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  serviceGroup:         { marginBottom: 14 },
  serviceGroupLabel:    { fontSize: 12, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  serviceRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  serviceDot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border, marginRight: 10 },
  serviceDotActive:     { backgroundColor: C.success },
  serviceText:          { fontSize: 14, color: C.text },
  certReminder: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  certReminderText:     { fontSize: 13, color: C.textMuted, textAlign: 'center' },
});
