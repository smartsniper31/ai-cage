# AI CAGE — Phase 2 Report

**Phase:** 2 — Enterprise Ready
**Date:** 2026-10-31
**Status:** ✅ Complete — builds clean, 92/92 tests pass, all 6 deliverables shipped

---

## Executive Summary

Phase 2 transforms AI CAGE from a foundation prototype into an enterprise-ready tool.
A PME can now show an auditor:

> "Here is what we would have leaked: **0 records**.
> Here is what we blocked: **[X items, logged in audit CSV]**.
> Here is the full Shadow AI traffic we detected: **[Y calls to 42 known AI endpoints]**."

---

## What Was Built

### 1. Cage 2 — Shadow AI Detection

**File:** `packages/core/src/shadowAiList.ts`

- **42 AI endpoints** catalogued across 4 categories:
  - `llm-api` — OpenAI, Anthropic, Google Gemini, Microsoft Copilot, Cohere, Mistral, Groq, Perplexity, Together AI, Replicate
  - `dev-tool` — GitHub Copilot, Cursor, Codeium, Tabnine
  - `saas-embedded` — Notion AI, Slack AI, HubSpot AI, Salesforce Einstein, Zendesk AI, Intercom Fin, Grammarly, Jasper, Copy.ai, Writesonic, Zapier AI, Make, Monday, ClickUp, Jira/Atlassian, Confluence, Google Workspace Duet, Microsoft 365 Copilot, Adobe Firefly, Canva AI
  - `infra` — LangSmith, Helicone, Portkey, OpenRouter, HuggingFace, AWS Bedrock, Azure AI Studio, Vertex AI

- Functions: `matchAiEndpoint(url)`, `getEndpointsByCategory()`, `getEndpointsByRisk()`

**File:** `apps/extension/src/background.ts` (rewritten)

- `chrome.webRequest.onCompleted` listener monitors ALL outbound requests
- Matches against `ALL_AI_ENDPOINTS` catalogue locally — zero external calls
- Writes `SHADOW_AI_DETECTED` events to `chrome.storage.local` audit log
- Badge turns **red** when shadow AI detected, **green** when only PII caged

---

### 2. Immutable Audit Log

**File:** `packages/core/src/auditLog.ts`

| Function | Purpose |
|----------|---------|
| `logEvent(event, storage)` | Append-only log write. Never stores PII values. |
| `getAuditLog(storage)` | Read all entries, oldest first. |
| `getAuditSummary(storage, from?, to?)` | Monthly totals + top sites. |
| `exportAuditLogCSV(storage)` | CSV safe to hand to auditor. |
| `clearAuditLog(storage, confirmedBy, reason?)` | Requires `confirmedBy` string. |
| `getClearHistory(storage)` | Tamper-evidence: every clear is recorded forever. |

**Pluggable `StorageAdapter` interface:**
- `localStorageAdapter` — for Tauri desktop WebView
- `createMemoryAdapter()` — for unit tests
- `chromeStorageAdapter` (inline in background.ts) — for Chrome extension

**What the log stores:**
```json
{
  "id": 42,
  "timestamp": "2026-10-31T09:47:12.345Z",
  "type": "PII_CAGED",
  "site": "chat.openai.com",
  "counts": { "EMAIL_ADDRESS": 2, "CREDIT_CARD": 1 },
  "totalCount": 3
}
```
**What it never stores:** original PII values, prompt text, AI responses, user identity.

---

### 3. Cage 4 — VS Code Extension (Code Leak)

**File:** `apps/vscode-extension/src/extension.ts`

**Commands:**
| Command | Action |
|---------|--------|
| `AI CAGE: Scan Current File` | Scans open file, shows inline diagnostics |
| `AI CAGE: Cage Selected Text` | Replaces PII with tokens in-editor |
| `AI CAGE: Show Audit Log` | Opens webview with full audit table + CSV download |
| `AI CAGE: Clear Diagnostics` | Clears squiggly lines |

**Auto-scan on save:** configurable via `aiCage.enableOnSave` (default: `true`)

**Severity mapping:**
- `PRIVATE_KEY`, `API_KEY`, `GENERIC_SECRET` → **Error** (red squiggly)
- `CREDIT_CARD`, `IBAN`, `RIB_TN`, `MF_TN`, `PASSPORT_TN` → **Warning** (yellow)
- Everything else → **Information** (blue)

**Settings:**
```json
"aiCage.enableOnSave": true,
"aiCage.minScore": 0.7,
"aiCage.criticalOnly": false,
"aiCage.fileGlob": "**/*.{ts,js,py,env,json,yaml,yml,tf,sh,rb,go,java,cs,php,rs}"
```

**Build:** `esbuild` bundles to 39.7 kB. `--external:vscode` keeps VS Code API unbundled. `vsce package` ready (no publish yet).

---

### 4. PII Detection Improvements

**New entity types in `packages/presidio-lite/src/types.ts`:**
- `MF_TN` — Tunisian Matricule Fiscal (`1234567A/P/A/000`)
- `PASSPORT_TN` — Tunisian passport (`A1234567`)
- `CARTE_SEJOUR` — French/Tunisian residence permit

**Improved `PERSON_NAME` detector:**
- Added curated list of **50 Tunisian/Arabic first names** (male + female)
- Added **Ben/Bel/El/Al/Ould/Bent/Bint/Bou/Hadj** family prefix patterns
- Reduced false positives: excludes ALL-CAPS words, common English stop words, 2-letter words
- Three-tier pattern: labelled > Arabic-prefix > French title-case

**All 15 entity types now in `cage.ts` TYPE_LABEL map** — each gets a labelled placeholder like `[CAGED_MF_1]`, `[CAGED_PASSPORT_2]`.

---

### 5. Security Hardening

**`SECURITY.md`** — Documents 5 independent verification methods:
1. Source grep
2. Automated security contract test
3. DevTools network monitor
4. Build from source
5. Inspect the compiled bundle

**`apps/desktop/src-tauri/tauri.conf.json`** — CSP strengthened:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'none';           ← blocks ALL outbound connections
object-src 'none';
base-uri 'self';
form-action 'none';           ← NEW: blocks form submissions to any domain
frame-ancestors 'none';       ← NEW: blocks embedding in iframes
```

**`apps/extension/src/manifest.json`** — CSP:
```
script-src 'self'; object-src 'none'; connect-src 'none'
```

---

### 6. GitHub Actions CI

**`.github/workflows/ci.yml`** — 3 jobs on every push/PR:

| Job | Steps | Cost |
|-----|-------|------|
| `build-and-test` | install → build packages → test (92 tests) → security grep → verify dist | Free (Ubuntu, ~3 min) |
| `audit` | pnpm audit --audit-level=high | Free |
| `vscode-extension` | build presidio-lite → core → vscode-extension → verify dist | Free |

**Husky pre-commit hook** (`.husky/pre-commit`):
- Runs `pnpm test` — blocks commit on any test failure
- Runs Node.js inline script that strips TS comments then greps for `fetch/XHR/WebSocket` — blocks commit if found

---

### 7. Packaging

**`apps/extension/zip.sh`** — Chrome Web Store packaging:
1. Builds all dependencies
2. Verifies all required files exist
3. Security scans the compiled JS bundle
4. Creates `ai-cage-extension-v{version}.zip`

---

## Build Verification

```
pnpm install                ✅  clean (176 packages resolved)
pnpm build                  ✅  zero errors, zero warnings

Output sizes:
  presidio-lite/dist/       TypeScript declarations + JS
  core/dist/                TypeScript declarations + JS
  extension/dist/
    background.js    19.07 kB  (Shadow AI + audit + badge)
    content.js       13.92 kB  (PII cage + banner + intercept)
    popup.js          4.92 kB  (2-tab UI: Overview + Shadow AI)
    manifest.json             (MV3 v0.2.0)
    popup.html
    icons/
  desktop/dist/
    index.html        10.21 kB  (3-panel: Cage + Audit + Shadow)
    assets/index-*.js 20.11 kB
  vscode-extension/dist/
    extension.js      39.7  kB  (esbuild bundle, --external:vscode)
```

---

## Test Results

```
pnpm test     ✅  92/92 pass, 0 failures, 0 skips

@ai-cage/presidio-lite — 39 tests  (+17 since Phase 1)
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
  ✓ Tunisian Matricule Fiscal detection (4)  ← NEW
  ✓ Tunisian Passport detection (3)          ← NEW
  ✓ Carte de Séjour detection (3)            ← NEW
  ✓ Arabic/Tunisian name detection (5)       ← NEW
  ✓ Tunisian enterprise PII context (2)      ← NEW

@ai-cage/core — 53 tests  (+32 since Phase 1)
  ✓ cageText — basic PII replacement (7)
  ✓ cageText — placeholder format (3)
  ✓ uncageText — round-trip (6)
  ✓ summariseCaged — audit safety (2)
  ✓ cageText — minScore option (2)
  ✓ Security contract — no network calls (1)
  ✓ auditLog — logEvent (3)                  ← NEW
  ✓ auditLog — getAuditLog (2)               ← NEW
  ✓ auditLog — getAuditSummary (3)           ← NEW
  ✓ auditLog — exportAuditLogCSV (4)         ← NEW
  ✓ auditLog — clearAuditLog (4)             ← NEW
  ✓ shadowAi — matchAiEndpoint (9)           ← NEW
  ✓ shadowAi — getEndpointsByCategory (2)    ← NEW
  ✓ shadowAi — getEndpointsByRisk (2)        ← NEW
  ✓ shadowAi — catalogue integrity (3)       ← NEW
```

---

## How to Test Shadow AI Detection

### In the Chrome Extension:

1. `pnpm build` → Load `apps/extension/dist/` unpacked in Chrome
2. Visit any page that uses a SaaS tool with embedded AI (e.g. Notion, Slack, Grammarly)
3. The extension badge turns **red** when a shadow AI request is detected
4. Click the extension icon → **Shadow AI tab** → see which tool called which AI endpoint
5. Click **Export CSV** → hand the file to your auditor

### Simulating a shadow AI call (manual test):
Open Chrome DevTools → Network → filter by `grammarly.com` or `notion.so` → use those tools — the badge will increment.

### In the Desktop App:

1. `pnpm --filter @ai-cage/desktop build`
2. Open `apps/desktop/dist/index.html` in a browser or run `pnpm run tauri dev`
3. Navigate to **Shadow AI** panel → see full catalogue of 42 endpoints with risk levels
4. Navigate to **Audit Log** panel → see all events
5. Click **Export CSV for Auditor** → save the file

---

## How the Audit Log Proves "Zero Leakage"

```
Auditor question:  "What personal data was sent to external AI services?"

AI CAGE answer:    Export audit CSV.

The CSV contains:
  - Timestamps of every PII detection event
  - TYPES caged (EMAIL_ADDRESS, CREDIT_CARD, etc.)
  - COUNTS (e.g. "3 items caged")
  - SITE (e.g. "chat.openai.com")

The CSV does NOT contain:
  - Any actual email addresses
  - Any card numbers
  - Any names
  - Any prompt text

The AI provider received only:  [CAGED_EMAIL_1], [CAGED_CARD_2]
The original values stayed:     On the user's device
```

This is legally defensible under GDPR Article 5(1)(f) — integrity and confidentiality.

---

## Architecture Summary — Phase 2

```
[User Device — 100% Local]
│
├── Chrome Extension (MV3)
│   ├── content.ts      → Cage 1: intercepts prompts on AI chat sites
│   │                     cageText() before network, uncageText() after
│   └── background.ts   → Cage 2: monitors ALL outbound requests
│                         matches against 42-endpoint catalogue
│                         writes audit log to chrome.storage.local
│
├── Desktop App (Tauri)
│   ├── TypeScript UI   → 3 panels: Cage / Audit Log / Shadow AI
│   └── Rust backend    → http disabled, strict CSP
│
├── VS Code Extension   → Cage 4: scans code files on save
│                         inline diagnostics + cageSelection command
│
└── Core Packages
    ├── @ai-cage/presidio-lite  → 15 PII types, offline regex
    ├── @ai-cage/core           → cageText, uncageText, auditLog, shadowAiList
    └── Zero network calls — verified by automated test on every commit
```

---

## Files Created / Modified in Phase 2

| File | Status | Description |
|------|--------|-------------|
| `packages/core/src/shadowAiList.ts` | NEW | 42 AI endpoint patterns |
| `packages/core/src/auditLog.ts` | NEW | Immutable audit log engine |
| `packages/core/src/index.ts` | MODIFIED | Exports new modules |
| `packages/core/src/cage.ts` | MODIFIED | TYPE_LABEL for 3 new entity types |
| `packages/core/tests/shadowAi.test.ts` | NEW | 16 tests |
| `packages/core/tests/auditLog.test.ts` | NEW | 16 tests |
| `packages/presidio-lite/src/types.ts` | MODIFIED | +3 entity types |
| `packages/presidio-lite/src/detectors.ts` | MODIFIED | +3 detectors, improved PERSON_NAME |
| `packages/presidio-lite/tests/scan.test.ts` | MODIFIED | +17 tests |
| `apps/extension/src/background.ts` | REWRITTEN | Shadow AI + audit log |
| `apps/extension/src/popup.ts` | REWRITTEN | 2-tab UI with Shadow AI |
| `apps/extension/src/popup.html` | REWRITTEN | Stats grid + shadow list |
| `apps/extension/src/manifest.json` | MODIFIED | v0.2.0, webRequest permission |
| `apps/extension/zip.sh` | NEW | Chrome Web Store packaging |
| `apps/desktop/src/main.ts` | REWRITTEN | 3-panel UI with audit log |
| `apps/desktop/index.html` | REWRITTEN | Nav + 3 panels |
| `apps/desktop/src-tauri/tauri.conf.json` | MODIFIED | v0.2.0, hardened CSP |
| `apps/vscode-extension/package.json` | NEW | VS Code extension |
| `apps/vscode-extension/tsconfig.json` | NEW | |
| `apps/vscode-extension/src/extension.ts` | NEW | Full Cage 4 implementation |
| `.github/workflows/ci.yml` | NEW | 3-job GitHub Actions CI |
| `.husky/pre-commit` | NEW | test + security grep |
| `SECURITY.md` | NEW | 5 verification methods |

---

## Bugs Fixed During Phase 2

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `localStorage` not available in Node | `auditLog.ts` compiled for node (tests) but referenced browser global | Replaced with `globalThis as any` + pluggable adapter |
| `exactOptionalPropertyTypes` TS error on `reason?: string` | TypeScript strict mode rejects `reason: undefined` in spread | Used conditional spread `...(reason !== undefined ? { reason } : {})` |
| VS Code extension: `scanText` not in `@ai-cage/core` | `scanText` lives in `@ai-cage/presidio-lite`, not re-exported by core | Added `@ai-cage/presidio-lite` as dependency, fixed import |

---

## Next Steps — Cage 3 (Agent Rogue)

**The most dangerous cage — agentic AI can exfiltrate data silently.**

### Architecture Plan for Cage 3:

1. **Outbound URL interceptor** (extension): any `fetch()` call from an AI agent's tool-use that targets an unexpected domain gets flagged and optionally blocked.

2. **Prompt injection detector** in `@ai-cage/presidio-lite`: scan AI *responses* (not just prompts) for embedded instructions like `"ignore previous"`, `"send an email to"`, `"curl http"`.

3. **Agent action approval UI** (desktop): before any agent-initiated file/network action, show a confirmation dialog. Human-in-the-loop by default.

4. **MCP (Model Context Protocol) monitoring**: intercept MCP tool calls from VS Code / Claude Desktop and log every tool invocation with its parameters to the audit log.

```typescript
// Proposed Cage 3 API (packages/core/src/agentCage.ts)
scanForPromptInjection(text: string): InjectionMatch[]
cageAgentOutput(output: string, allowedDomains: string[]): CageResult
```

**Estimated effort:** 2 weeks for V1 detection, 1 week for UI.

---

*Phase 2 complete. AI CAGE is now enterprise-ready.*
*Use Monster AI. Leak Zero Data. Prove it to your auditor.*
