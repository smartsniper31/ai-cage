// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Jest configuration
// Licensed under Business Source License 1.1

/**
 * Jest config for apps/mobile.
 *
 * Uses ts-jest for TypeScript compilation — no Babel, no Expo preset.
 * Our tests are pure TypeScript logic (cage PII, endpoint matching,
 * native module contract) — zero React Native rendering, zero DOM.
 *
 * WHY NOT jest-expo / babel-preset-expo:
 *   jest-expo v52+ pulls @react-native/jest-preset which ships ESM-only
 *   setup files incompatible with Jest 30 CommonJS mode on Node 18/20.
 *   ts-jest compiles TypeScript directly to CommonJS — no Babel chain needed.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Transform TypeScript with ts-jest (no Babel, no Expo)
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Override tsconfig for Jest — module CommonJS for Node compat
        module:            'CommonJS',
        moduleResolution:  'node',
        target:            'ES2022',
        esModuleInterop:   true,
        allowSyntheticDefaultImports: true,
        strict:            true,
        skipLibCheck:      true,
        // Path aliases resolved by moduleNameMapper below
        paths: {},
      },
    }],
  },

  // Only run tests in the mobile src
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],

  // Map workspace packages to their source TypeScript
  moduleNameMapper: {
    '^@ai-cage/core$':          '<rootDir>/../../packages/core/src/index.ts',
    '^@ai-cage/presidio-lite$': '<rootDir>/../../packages/presidio-lite/src/index.ts',
    // Remap .js imports inside workspace packages to .ts (ts-jest + moduleResolution:node)
    '^(\\.{1,2}/.*)\\.js$':     '$1',
    // Map native/Expo modules to lightweight mocks
    '^react-native$':           '<rootDir>/src/__mocks__/react-native.ts',
    '^expo-secure-store$':      '<rootDir>/src/__mocks__/expo-secure-store.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/async-storage.ts',
  },

  // Do not transform node_modules except workspace packages
  transformIgnorePatterns: [
    'node_modules/(?!(@ai-cage)/)',
  ],

  // Setup file (CommonJS globals only — no ESM imports)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  clearMocks:   true,
  restoreMocks: true,
  testTimeout:  10000,
};
