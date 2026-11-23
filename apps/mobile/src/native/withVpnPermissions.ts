// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Expo Config Plugin: inject VPN permissions + service declaration
// Licensed under Business Source License 1.1

/**
 * @file withVpnPermissions.ts
 * Expo config plugin that modifies AndroidManifest.xml during `expo prebuild`
 * to declare the VPN service, foreground service permission, and boot receiver.
 *
 * This runs at build time (not runtime). It is listed in app.json under "plugins".
 *
 * WHAT IT INJECTS:
 *   <uses-permission android:name="android.permission.BIND_VPN_SERVICE" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
 *   <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
 *
 *   <service
 *     android:name="io.aicage.mobile.vpn.AiCageVpnService"
 *     android:permission="android.permission.BIND_VPN_SERVICE"
 *     android:exported="false"
 *     android:foregroundServiceType="specialUse">
 *     <intent-filter>
 *       <action android:name="android.net.VpnService" />
 *     </intent-filter>
 *     <property
 *       android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
 *       android:value="Network traffic filtering for PII protection" />
 *   </service>
 */

import {
  withAndroidManifest,
  AndroidConfig,
  ConfigPlugin,
} from 'expo/config-plugins';

type ManifestApplication = AndroidConfig.Manifest.ManifestApplication;

const withVpnPermissions: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;

    // ── Permissions ───────────────────────────────────────────────────────
    const permissions = [
      'android.permission.BIND_VPN_SERVICE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.INTERNET',
    ];

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    for (const perm of permissions) {
      const alreadyDeclared = manifest.manifest['uses-permission'].some(
        (p: { $: { 'android:name': string } }) => p.$['android:name'] === perm,
      );
      if (!alreadyDeclared) {
        manifest.manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // ── VpnService declaration ────────────────────────────────────────────
    const application = manifest.manifest.application?.[0] as ManifestApplication | undefined;
    if (!application) return mod;

    if (!application.service) {
      application.service = [];
    }

    const vpnServiceName = 'io.aicage.mobile.vpn.AiCageVpnService';
    const serviceList = application.service as Array<{ $: { 'android:name': string } }>;
    const alreadyDeclared = serviceList.some(
      (s) => s.$['android:name'] === vpnServiceName,
    );

    if (!alreadyDeclared) {
      serviceList.push({
        $: {
          'android:name': vpnServiceName,
          'android:permission': 'android.permission.BIND_VPN_SERVICE',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.net.VpnService' } }],
          },
        ],
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'Network traffic filtering for on-device PII protection',
            },
          },
        ],
      } as unknown as typeof serviceList[0]);
    }

    return mod;
  });
};

export default withVpnPermissions;
