// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Navigation type definitions
// Licensed under Business Source License 1.1

/**
 * @file types.ts
 * React Navigation stack parameter list.
 * All screens are listed here — TypeScript enforces correct params at every navigation call.
 */

export type RootStackParamList = {
  /** First-launch double-consent gate */
  Consent: undefined;
  /** CA certificate installation guide */
  CertInstall: undefined;
  /** Main dashboard — VPN toggle + stats */
  Home: undefined;
  /** Pro license activation */
  License: undefined;
  /** Audit log viewer */
  Audit: undefined;
};
