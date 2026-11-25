"use strict";
// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Expo Config Plugin: inject VPN permissions + service declaration
// Licensed under Business Source License 1.1
Object.defineProperty(exports, "__esModule", { value: true });
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
const config_plugins_1 = require("expo/config-plugins");
const withVpnPermissions = (config) => {
    return (0, config_plugins_1.withAndroidManifest)(config, (mod) => {
        var _a;
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
            const alreadyDeclared = manifest.manifest['uses-permission'].some((p) => p.$['android:name'] === perm);
            if (!alreadyDeclared) {
                manifest.manifest['uses-permission'].push({
                    $: { 'android:name': perm },
                });
            }
        }
        // ── VpnService declaration ────────────────────────────────────────────
        const application = (_a = manifest.manifest.application) === null || _a === void 0 ? void 0 : _a[0];
        if (!application)
            return mod;
        if (!application.service) {
            application.service = [];
        }
        const vpnServiceName = 'io.aicage.mobile.vpn.AiCageVpnService';
        const serviceList = application.service;
        const alreadyDeclared = serviceList.some((s) => s.$['android:name'] === vpnServiceName);
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
            });
        }
        return mod;
    });
};
exports.default = withVpnPermissions;
