// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Jest configuration
// Licensed under Business Source License 1.1

/**
 * Jest config for apps/mobile.
 *
 * Uses jest-expo preset which handles:
 *   - Metro bundler transforms for React Native
 *   - Platform mocks (NativeModules, Platform.OS, etc.)
 *   - Expo module resolution
 *
 * Tests run in Node (jsdom not needed — no DOM, only RN).
 * Native modules (CageVpn, AiCageVpnService) are mocked in each test file.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Only run tests in the mobile src — never leak into packages/core tests
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],

  // Transform workspace packages (not pre-compiled in this context)
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'react-native|' +
      '@react-native|' +
      'expo|' +
      '@expo|' +
      'expo-modules-core|' +
      'expo-secure-store|' +
      '@react-native-async-storage|' +
      '@react-navigation|' +
      '@ai-cage' +   // workspace packages — must be transformed
    ')/)',
  ],

  // Module name mapper for workspace path aliases
  moduleNameMapper: {
    '^@ai-cage/core$':           '<rootDir>/../../packages/core/src/index.ts',
    '^@ai-cage/presidio-lite$':  '<rootDir>/../../packages/presidio-lite/src/index.ts',
  },

  // Setup file — global mocks applied before every test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Coverage — only report on mobile src files
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],

  // Clear mocks between tests
  clearMocks:   true,
  resetMocks:   false,
  restoreMocks: true,

  // Timeout generous for async VPN operations in tests
  testTimeout: 10000,
};
