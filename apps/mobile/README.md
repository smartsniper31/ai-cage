# AI CAGE Mobile — Android

> VPN-based PII protection for Android. Same engine as the browser extension, applied at the network layer.

## Architecture

```
apps/mobile/
├── App.tsx                     Entry point + navigation
├── src/
│   ├── screens/
│   │   ├── ConsentScreen.tsx   Gate 1 (app) + Gate 2 (Android system dialog)
│   │   ├── CertInstallScreen.tsx  CA certificate installation guide
│   │   ├── HomeScreen.tsx      Dashboard: VPN toggle, stats, intercepted services
│   │   └── LicenseScreen.tsx   Pro license activation
│   ├── hooks/
│   │   └── useVpn.ts           State machine: unknown→granted/declined/revoked
│   ├── native/
│   │   └── CageVpn.ts          TypeScript bridge to Kotlin NativeModule
│   ├── lib/
│   │   └── mobileCage.ts       @ai-cage/core wired to AsyncStorage + SecureStore
│   └── __tests__/              Unit tests (Jest + jest-expo)
└── android/app/src/main/kotlin/io/aicage/mobile/vpn/
    ├── AiCageVpnService.kt     VpnService — TUN interface + foreground service
    ├── LocalMitmProxy.kt       Local HTTPS proxy (MITM with local CA)
    ├── AiEndpointMatcher.kt    53 known AI endpoint hostnames
    ├── LocalCertManager.kt     CA generation + KeyStore (BouncyCastle)
    ├── CageBridge.kt           Kotlin → JS engine bridge
    ├── CageVpnModule.kt        NativeModule: prepareVpn/start/stop/consent
    ├── CageNativeModule.kt     Synchronous JS evaluation via CountDownLatch
    └── CageVpnPackage.kt       ReactPackage registration
```

## How it works

1. User launches app → `ConsentScreen` explains what the VPN does
2. User taps "Enable Protection" → Android system VPN permission dialog
3. User installs the local CA certificate (`CertInstallScreen`)
4. `AiCageVpnService` creates a TUN interface and routes all traffic through it
5. `LocalMitmProxy` intercepts HTTPS requests to known AI endpoints
6. `CageBridge` calls `@ai-cage/core` to replace PII with safe tokens
7. The caged request is forwarded to the AI provider
8. The response is passed back to the app — tokens remain (no uncage at network level)

## Prerequisites

- Node.js 20+
- pnpm 9+
- Android Studio (for the emulator or physical device)
- Java 17+
- EAS CLI (for cloud builds): `npm install -g eas-cli`

## Development

```powershell
# From repo root — install all dependencies
pnpm install

# Start Metro bundler
cd apps/mobile
npx expo start

# Run on Android emulator or device
npx expo run:android
```

## Tests

```powershell
# From apps/mobile — run mobile unit tests only
npx jest --testPathPattern=src

# From repo root — run ALL 202 tests (extension + core + mobile)
pnpm test
```

## Release pipeline

```powershell
# From repo root — full pipeline (type-check, lint, 202 tests, prebuild, commit, push)
powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1

# With APK build (requires EAS account)
powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1 -BuildNative
```

## Security contracts

| Contract | Implementation |
|---|---|
| Zero network calls in PII engine | `@ai-cage/core` has no fetch/XHR — verified by 202 tests |
| License key hardware-backed | `expo-secure-store` → Android Keystore |
| Audit log never stores PII values | Only placeholders, types, counts in AsyncStorage |
| CA private key never leaves device | Stored in Android KeyStore, never exported |
| VPN is local only | TUN interface binds to `127.0.0.1` — no external proxy |

## License key

Same system as the browser extension. After a Stripe payment:

1. Open `tools/generate-key.html` (local only — never on GitHub)
2. Enter customer email, plan, duration
3. Click Generate → copy the key
4. Send to customer via email template

Customer activates in `LicenseScreen` → `mobileActivateLicense()` → `@ai-cage/core` validates signature v2.

## Known limitations v0.6.0

- Android only (iOS requires Safari extension — planned for v0.7.0)
- `CageNativeModule.evaluateJavaScript()` uses deprecated `catalystInstance` API — migration to JSI planned before Google Play submission
- CA certificate must be manually installed by user (Android security requirement — cannot be automated)
- EAS Build requires an Expo account for cloud compilation
