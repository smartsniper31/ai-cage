// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Root App component & navigation shell
// Licensed under Business Source License 1.1

/**
 * @file App.tsx
 * Entry point for the React Native app.
 *
 * BOOT SEQUENCE:
 *   1. registerCageBridgeGlobal() — registers global.__aiCageCageText so the
 *      Kotlin CageNativeModule can call cageText() synchronously from the proxy
 *      thread. Must run before any other import side-effects.
 *   2. NavigationContainer — hosts the full screen stack.
 *   3. First-launch detection — routes to ConsentScreen or HomeScreen.
 *
 * NAVIGATION STACK:
 *   Consent → CertInstall → Home ↔ License
 *                                ↔ Audit
 */

// ── MUST be first — registers global.__aiCageCageText before anything else ──
import { registerCageBridgeGlobal } from './src/native/cageBridgeGlobal';
registerCageBridgeGlobal();

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

import type { RootStackParamList } from './src/navigation/types';
import { ConsentScreen }     from './src/screens/ConsentScreen';
import { CertInstallScreen } from './src/screens/CertInstallScreen';
import { HomeScreen }        from './src/screens/HomeScreen';
import { LicenseScreen }     from './src/screens/LicenseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Key set after user completes onboarding (consent + cert install)
const ONBOARDING_DONE_KEY = 'ai-cage:onboarding-done-v1';

export default function App() {
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList | null>(null);

  // ── Determine first-launch vs returning user ──────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((val) => {
        setInitialRoute(val === 'true' ? 'Home' : 'Consent');
      })
      .catch(() => {
        // AsyncStorage unavailable — start fresh
        setInitialRoute('Consent');
      });
  }, []);

  // Show nothing while determining route (avoids flash)
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#7c5cfc" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0a0a0f" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary:    '#7c5cfc',
            background: '#0a0a0f',
            card:       '#13131a',
            text:       '#e2e8f0',
            border:     '#1e1e2e',
            notification: '#7c5cfc',
          },
        }}
      >
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#0a0a0f' },
          }}
        >
          {/* Gate 1 + 2: consent + Android VPN dialog */}
          <Stack.Screen name="Consent" component={ConsentScreen} />

          {/* CA certificate installation guide */}
          <Stack.Screen name="CertInstall" component={CertInstallScreen} />

          {/* Main dashboard */}
          <Stack.Screen name="Home" component={HomeScreen} />

          {/* Pro license activation */}
          <Stack.Screen name="License" component={LicenseScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
