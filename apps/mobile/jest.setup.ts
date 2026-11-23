// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Jest global setup
// Licensed under Business Source License 1.1

/**
 * @file jest.setup.ts
 * Global mocks applied before every test suite in apps/mobile.
 *
 * Mocks React Native internals that are unavailable in Node/Jest:
 *   - NativeModules
 *   - NativeEventEmitter
 *   - Platform
 *   - Linking
 *   - Alert
 */

import { jest } from '@jest/globals';

// ── React Native core mocks ───────────────────────────────────────────────────

jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native') as object;
  return {
    ...rn,
    Platform: { OS: 'android', Version: 33, select: (obj: Record<string, unknown>) => obj['android'] },
    Alert:    { alert: jest.fn() },
    Linking:  {
      openSettings: jest.fn(() => Promise.resolve()),
      openURL:      jest.fn(() => Promise.resolve()),
      canOpenURL:   jest.fn(() => Promise.resolve(true)),
    },
    NativeModules: {
      CageVpn: {
        prepareVpn:    jest.fn(() => Promise.resolve(false)),
        startVpn:      jest.fn(() => Promise.resolve()),
        stopVpn:       jest.fn(() => Promise.resolve()),
        getVpnStatus:  jest.fn(() => Promise.resolve(false)),
        cageText:      jest.fn((t: string) => Promise.resolve(t)),
        installCaCert: jest.fn(() => Promise.resolve(true)),
      },
    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeAllListeners: jest.fn(),
    })),
  };
});

// ── Expo module mocks ─────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(() => Promise.resolve(null)),
  setItemAsync:    jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn(() => Promise.resolve(null)),
  setItem:    jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear:      jest.fn(() => Promise.resolve()),
  getAllKeys:  jest.fn(() => Promise.resolve([])),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '0.6.0', name: 'AI CAGE' },
  },
}));

// ── Silence expected warnings in test output ──────────────────────────────────

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  // Suppress known RN test environment warnings
  if (
    msg.includes('Animated:') ||
    msg.includes('ReactDOM.render') ||
    msg.includes('act(')
  ) return;
  originalConsoleWarn(...args);
};
