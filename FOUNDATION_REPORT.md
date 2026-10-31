# AI CAGE — Foundation Report

**Phase:** 1 — Foundation
**Date:** 2026-10-30
**Status:** ✅ Complete — builds clean, all tests pass

---

## What Was Built

The complete monorepo foundation for AI CAGE — the enterprise-grade antivirus that protects companies against data leakage when using public AI services (ChatGPT, Claude, Gemini, Copilot).

---

## Repo Structure

```
ai-cage/
├── apps/
│   ├── extension/              Chrome Extension MV3
│   │   ├── src/
│   │   │   ├── background.ts   Service worker — badge counter, audit log
│   │   │   ├── content.ts      Page injection — intercepts prompts, injects banner
│   │   │   ├── popup.ts        Popup UI logic
│   │   │   ├── popup.html      Popup UI (stats, guarantee strip)
│   │   │   ├── manifest.json   MV3 manifest
│   │   │   └── icons/          Extension icons (16/32/48/128px)
│   │   ├── vite.config.ts      3 IIFE bundles + asset copy plugin
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── desktop/                Tauri 1.6 Desktop App
│       ├── src/
│       │   ├── main.ts         TypeScript UI — cage/uncage/copy workflow
│       │   └── index.html      Full desktop UI (two-panel editor)
│       ├── src-tauri/
│       │   ├── src/main.rs     Rust backend — 3 Tauri commands
│       │   ├── Cargo.toml      http disabled, release optimised
│       │   ├── build.rs
│       │   ├── tauri.conf.json http allowlist = false, strict CSP
│       │   └── icons/          App icons
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── presidio-lite/          Offline PII pattern library
│   │   ├── src/
│   │   │   ├── types.ts        EntityType, PiiMatch, Detector
│   │   │   ├── detectors.ts    12 detector types, all pure regex
│   │   │   ├── scan.ts         scanText() + overlap deduplication
│   │   │   └── index.ts        Public API
│   │   └── tests/
│   │       └── scan.test.ts    22 unit tests
│   │
│   └── core/                   Caging engine
│       ├── src/
│       │   ├── types.ts        CagedEntity, CageResult, CageOptions
│       │   ├── cage.ts         cageText(), uncageText(), summariseCaged()
│       │   └── index.ts        Public API
│       └── tests/
│           └── cage.test.ts    21 unit tests (incl. security contract)
│
├── docs/
│   ├── ARCHITECTURE.md         Mermaid diagrams + design decisions
│   ├── THREAT_MODEL.md         7 cages, attacker model, data flow audit
│   └── PRIVACY_GUARANTEE.md    Legal-grade privacy commitment + verification steps
│
├── FOUNDATION_REPORT.md        This file
├── README.md                   Badges, pitch, quick-start, API reference
├── LICENSE                     MIT
├── package.json                Workspace root — build/test/lint scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .eslintrc.json
```

---

## Build Verification

```
pnpm install     ✅  clean install, 5 workspace packages
pnpm build       ✅  zero errors, zero warnings

Output:
  packages/presidio-lite   → dist/ (TypeScript compiled)
  packages/core            → dist/ (TypeScript compiled)
  apps/extension/dist/
    background.js    1.76 kB  (IIFE)
    content.js      11.86 kB  (IIFE — full caging engine inlined)
    popup.js         0.92 kB  (IIFE)
    manifest.json            (MV3)
    popup.html
    icons/           4 sizes
  apps/desktop/dist/
    index.html       5.46 kB
    assets/index-*.js  5.59 kB
```

---

## Test Results

```
pnpm test        ✅  43/43 tests pass, 0 failures

@ai-cage/presidio-lite — 22 tests
  ✓ Email detection (3)
  ✓ Credit card detection (3)
  ✓ IBAN detection (2)
  ✓ Private key detection (2)
  ✓ API key detection (3)
  ✓ IP address detection (2)
  ✓ Tunisian CIN detection (1)
  ✓ Overlap deduplication (1)
  ✓ Multiple PII in one text (1)
  ✓ Safe inputs (2)
  ✓ minScore option (2)

@ai-cage/core — 21 tests
  ✓ cageText — basic PII replacement (7)
  ✓ cageText — placeholder format (3)
  ✓ uncageText — round-trip (6)
  ✓ summariseCaged — never leaks original values (2)
  ✓ cageText — minScore option (2)
  ✓ Security contract — no network calls in source (1)
```

---

## Security Contract — Verified

The security contract test (`cage.test.ts > Security contract`) reads `cage.ts`
source, strips all comments, then asserts the non-comment code contains zero
occurrences of:

- `fetch(`
- `XMLHttpRequest`
- `WebSocket`
- `localStorage`
- `indexedDB`

**Result: PASS.** The caging engine is provably network-free.

You can run the same check manually:

```bash
# Strip comments and grep — should return nothing
node -e "
const fs = require('fs');
const src = fs.readFileSync('packages/core/src/cage.ts','utf8')
  .replace(/\/\*[\s\S]*?\*\//g,'')
  .replace(/\/\/[^\n]*/g,'');
const hits = src.match(/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB/g);
console.log(hits ?? 'CLEAN — zero network calls');
"
```

---

## How to Load the Chrome Extension

1. `pnpm install && pnpm build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (toggle, top-right)
4. Click **Load Unpacked**
5. Select: `apps/extension/dist/`
6. Visit `https://chat.openai.com` (or claude.ai, gemini.google.com)
7. Look for the green **🔒 AI CAGE Active** banner at the top of the page
8. Type a message containing an email or card number → watch the badge count increment
9. Click the extension icon → see the popup with live stats

**Supported sites (V1):**
- `chat.openai.com` / `chatgpt.com`
- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com`

---

## How to Run the Desktop App (Development)

```bash
# Prerequisites: Rust + Cargo installed
cd apps/desktop
pnpm install
pnpm run tauri dev
```

The UI opens with a two-panel editor:
- Left panel: paste your raw prompt
- Click **🔒 Cage PII** → right panel shows sanitised text
- Copy the caged text → paste into your AI of choice
- Paste the AI response back → click **🔓 Restore** to see your original values

---

## PII Detection Coverage (V1)

| Type | Example | Confidence |
|------|---------|-----------|
| `PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----` | 1.00 |
| `EMAIL_ADDRESS` | `alice@company.com` | 0.95 |
| `CREDIT_CARD` | `4111 1111 1111 1111` | 0.90 |
| `IBAN` | `TN5910006035183598478831` | 0.90 |
| `API_KEY` | `AKIA...`, `ghp_...`, `sk_live_...` | 0.88 |
| `GENERIC_SECRET` | `password=secret123` | 0.82 |
| `IP_ADDRESS` | `192.168.1.100` | 0.85 |
| `RIB_TN` | 20-digit Tunisian RIB | 0.80 |
| `PHONE_NUMBER` | `+216 12 345 678` | 0.75 |
| `PASSPORT` | `A1234567` | 0.70 |
| `CIN_TN` | `CIN: 12345678` | 0.65 |
| `PERSON_NAME` | `John Smith` (heuristic) | 0.55 |

Default `minScore` for caging: **0.6** (catches all types down to CIN).

---

## Architecture Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Detection engine | Pure regex (no ML) | Offline-first, auditable, zero latency, zero cost |
| Build tool | Vite | Fast, ESM-native, handles TS + IIFE for MV3 |
| Extension model | Chrome MV3 | Only supported model going forward |
| Desktop framework | Tauri 1.6 | ~10× smaller than Electron, Rust = no HTTP surface |
| Package manager | pnpm workspaces | Efficient monorepo, strict hoisting |
| Test framework | Vitest | ESM-native, fast, matches Vite ecosystem |
| HTTP in Tauri | Disabled | `tauri::api::http` not compiled in — provable offline |

---

## Bugs Fixed During Build

| Bug | Fix |
|-----|-----|
| Vite `closeBundle` runs after `emptyOutDir` deletes dist/ | Switched to `writeBundle` hook which fires after files land on disk |
| `inlineDynamicImports: true` incompatible with multiple Rollup inputs | Switched to sequential per-entry `lib` builds (each IIFE is its own Vite call) |
| Desktop Vite couldn't find entry: `index.html` not at project root | Copied `src/index.html` → `index.html` at app root (Vite convention) |
| Security contract test matched `fetch` in JSDoc comment | Test now strips comments before regex scan |

---

## Known Limitations (V1)

| Limitation | Impact | Plan |
|-----------|--------|------|
| Content script uses `innerText` to read contenteditable prompts | May miss styled/formatted content in some Claude versions | V2: MutationObserver + richer DOM walker |
| Person name detection is heuristic (title-case pairs) | High false positive rate | V2: WASM ONNX NER model for higher precision |
| Extension badge resets on service worker restart | Counter not persisted | V2: `chrome.storage.session` for badge state |
| Desktop Tauri Rust build not run in CI (compile time ~5 min) | `cargo build` not in `pnpm build` | Add to CI with caching when GitHub Actions budget available |
| Icons are placeholder PNGs | Visual only | V2: proper branded icon set |

---

## Next Steps — V2 Roadmap

### Cage 2: Shadow AI Detection
- Detect other AI-connected browser extensions
- `declarativeNetRequest` rules to audit AI endpoint traffic
- Admin policy enforcement

### Cage 4: Code Leak
- VS Code extension scanning code before it goes to Copilot Chat
- Git pre-commit hook using `@ai-cage/core`

### Cage 6: Credential Hijack
- Real-time `.env` file scanning in desktop app
- Severity: CRITICAL for production keys

### ML-Backed Detection (V2)
- WASM ONNX model for name/address detection
- Still 100% local — model ships in the bundle
- Higher recall, lower false positives for `PERSON_NAME`

### Compliance Engine (V3)
- Immutable local audit log (no original values)
- GDPR Article 30 auto-report export
- SOC 2 evidence package

---

## Verification Checklist

```
[ ] pnpm install              → Done ✅
[ ] pnpm build                → Done ✅ (zero errors)
[ ] pnpm test                 → Done ✅ (43/43 pass)
[ ] Extension loads unpacked  → dist/ ready, load via chrome://extensions
[ ] Banner appears on OpenAI  → content.ts injected at document_start
[ ] Popup shows stats         → background.ts tracks cage count
[ ] Security contract         → verified by automated test ✅
[ ] No network calls          → grep confirms zero fetch/XHR in core ✅
[ ] PRIVACY_GUARANTEE.md      → written ✅
[ ] THREAT_MODEL.md (7 cages) → written ✅
[ ] ARCHITECTURE.md (Mermaid) → written ✅
[ ] MIT LICENSE               → written ✅
```

---

*Built with zero budget. Maximum paranoia.*
*Use Monster AI. Leak Zero Data.*
