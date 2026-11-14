# 🔒 AI CAGE

**Use Monster AI. Leak Zero Data.**

[![License: Business Source](https://img.shields.io/badge/License-BSL_1.1-orange.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-202%2F202-brightgreen)](#)
[![Zero Network Calls](https://img.shields.io/badge/network_calls-zero-brightgreen)](#)
[![Offline First](https://img.shields.io/badge/offline-first-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-1.6-orange)](https://tauri.app/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io/)
[![Version](https://img.shields.io/badge/version-0.6.0-green)](#)

---

## What Is AI CAGE?

AI CAGE is the first enterprise-grade **AI Antivirus** — it protects companies against data leakage when employees use public AI services (ChatGPT, Claude, Gemini, Copilot) without a private AI deployment.

**The problem:** Your employees are already using AI. You cannot stop them. But every prompt they send is a potential data breach — names, emails, IBANs, API keys, source code, contracts. And AI providers admit they train on your data, store it in embeddings that cannot be deleted, and in some cases share anonymised prompts with data brokers.

**The solution:** AI CAGE intercepts every prompt, removes the PII **locally** before it reaches the AI, and restores the response locally. The AI does useful work. Your data never leaves the cage.

```
BEFORE AI CAGE:
"Invoice for Ahmed Ben Ali, IBAN TN5910006035183598, card 4111 1111 1111 1111"
    → Sent verbatim to OpenAI servers  ❌  (GDPR violation)

AFTER AI CAGE:
"Invoice for [CAGED_NAME_K3P2_1], IBAN [CAGED_IBAN_K3P2_2], card [CAGED_CARD_K3P2_3]"
    → Sent to OpenAI  ✅  (zero PII)
AI responds with tokens → Restored locally → User sees original data  ✅

Session 2 — same user, same IBAN:
"Invoice for [CAGED_NAME_A7X9_1], IBAN [CAGED_IBAN_A7X9_2]..."
    → Tokens rotate every session (Ephemeral Tokens™)
    → AI cannot link session 1 and session 2  ✅
```

---

## What Makes AI CAGE Different

| Capability | Microsoft Copilot | NordVPN Teams | **AI CAGE** |
|-----------|:-----------------:|:-------------:|:-----------:|
| Hides name, email, ID | ✅ | ✅ | ✅ |
| 100% offline, zero server | ❌ | ❌ | **✅** |
| Detects inference / identity clues | ❌ | ❌ | **✅ Inference Cage™** |
| Rotates tokens every session | ❌ | ❌ | **✅ Ephemeral Tokens™** |
| Shadow AI monitoring (47 endpoints) | ❌ | partial | **✅** |
| Plain-language report (no jargon) | ❌ | ❌ | **✅** |
| Open source, fully auditable | ❌ | ❌ | **✅** |

---

## The Core Promise

| Claim | Proof |
|-------|-------|
| **Zero data leaves the cage** | All PII detection runs inside browser/desktop — grep for `fetch` in `packages/` and get zero results |
| **100% local, offline-first** | Detection is regex-based, ships inside the bundle — works on a plane |
| **202 tests, security contract** | Pre-commit hook blocks any commit that adds network calls to core packages |
| **Auditable in under an hour** | < 800 lines of TypeScript in the caging logic |
| **Open source** | Business Source License 1.1 — read it, fork it, audit it |

---

## Repo Structure

```
ai-cage/
├── apps/
│   ├── extension/          Chrome/Edge/Firefox Extension MV3 (TypeScript + Vite)
│   │   └── src/
│   │       ├── background.ts   Service worker — dedup, shadow AI cooldown, stats
│   │       ├── content.ts      Intercepts prompts, runs cageText(), shows Inference Risk
│   │       ├── injected.ts     Network-level interceptor (fetch/XHR patching)
│   │       └── popup.ts        Popup UI — Overview, Shadow AI, Agent, Account
│   ├── desktop/            Desktop App (Tauri 1.6 — Rust + TypeScript)
│   └── landing/            Landing page + install guide + success page (Vite static)
├── packages/
│   ├── core/               cageText() / uncageText() / generatePlainReport()
│   │   └── src/
│   │       ├── cage.ts         SESSION_SALT, cageText(), detectQuasiIdentifiers()
│   │       ├── auditLog.ts     logEvent(), generatePlainReport(), sanitiseDetail()
│   │       ├── license.ts      checkLicense(), activateLicense()
│   │       └── agentCage.ts    cageToolCall(), scanForInjection()
│   └── presidio-lite/      Offline PII + injection detectors (regex, zero ML)
│       └── src/
│           ├── detectors.ts    16 PII types, ordered by specificity
│           ├── injectionDetectors.ts  15 injection patterns
│           └── scan.ts         deduplicateMatches() — longest/highest score wins
├── docs/
│   ├── ARCHITECTURE.md     Mermaid diagrams + design decisions
│   ├── THREAT_MODEL.md     7 threat surfaces (Cages)
│   ├── PRIVACY_GUARANTEE.md  Legal-grade privacy commitment
│   ├── PHASE5_8_FINAL_REPORT.md  v0.6.0 release state
│   └── RELEASE_PROCESS.md  How to run the release pipeline
├── scripts/
│   └── release.ps1         Full 11-step release pipeline (Windows PowerShell)
├── LICENSE
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Rust + Cargo ≥ 1.70 (for desktop app only)

### Install & Build

```bash
git clone https://github.com/smartsniper31/ai-cage.git
cd ai-cage
pnpm install
pnpm build
```

### Run Tests (202/202)

```bash
pnpm test
```

### Load Chrome Extension (dev)

```bash
pnpm --filter @ai-cage/extension build
# Chrome → chrome://extensions → Developer Mode ON → Load Unpacked → apps/extension/dist/
```

### Full Release Pipeline

```powershell
# Windows — builds everything, runs tests, pushes to GitHub, updates Vercel
powershell -ExecutionPolicy Bypass -File scripts/release.ps1
```

---

## The 9 Cages

AI CAGE is architected around 9 threat surfaces. v0.6.0 implements **5 of them**.

| # | Threat Surface | v0.6.0 Status |
|---|----------------|--------------|
| 1 | **Chat Leak** — PII in AI chat prompts | ✅ **Live** |
| 2 | **Shadow AI** — 47 unmonitored AI endpoints detected | ✅ **Live** |
| 3 | **Agent Rogue** — Prompt injection + tool policy engine | ✅ **Live** |
| 4 | Code Leak — Source code + secrets in AI IDEs | 🔜 v0.7.0 |
| 5 | Voice/Video — Meeting transcripts | 🔜 v0.7.0 |
| 6 | Credential Hijack — API keys + passwords | ⚡ Partial (covered by Cage 1) |
| 7 | **Compliance** — Immutable audit log + CSV + Plain Report | ✅ **Live** |
| 8 | **Inference Cage™** — Quasi-identifier combination detection | ✅ **Live** |
| 9 | **Ephemeral Tokens™** — Session-linked token rotation | ✅ **Live** |

---

## Detected PII Types — 16 Types

| Type | Examples | Confidence |
|------|---------|-----------|
| `PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----` | 1.00 |
| `EMAIL_ADDRESS` | alice@company.com | 0.95 |
| `MF_TN` | 1234567A/P/N/000 (Tunisian tax ID) | 0.92 |
| `CREDIT_CARD` | 4111 1111 1111 1111 | 0.90 |
| `IBAN` | TN5910006035... | 0.90 |
| `API_KEY` | AKIA..., ghp_..., sk-test-..., sk-ant-..., AIza... | 0.88 |
| `GENERIC_SECRET` | `password=...`, `mot de passe : ...` | 0.82 |
| `IP_ADDRESS` | 192.168.1.1 | 0.85 |
| `PASSPORT_TN` | A1234567 (Tunisian passport) | 0.78 |
| `RIB_TN` | `10 020 035 112233445566 77` (Tunisian RIB) | 0.80 |
| `PHONE_NUMBER` | +216 98 777 888 | 0.75 |
| `POSTAL_ADDRESS` | 12 Rue Habib Bourguiba, Tunis | 0.72 |
| `CARTE_SEJOUR` | Residence permit number | 0.72 |
| `PASSPORT` | Generic passport (1-2 letters + 6-9 digits) | 0.70 |
| `CIN_TN` | 12345678 (Tunisian national ID) | 0.65 |
| `PERSON_NAME` | "Nom du client : Ahmed Ben Ali" | 0.58 |

---

## Inference Cage™ — Beyond Direct PII

A single prompt can expose your identity **without any direct PII** through quasi-identifier combinations:

```
"Mon patron a 34 ans, agence de 8 employés à Bizerte,
contrat de 12 500 DT signé le 3 novembre."
→ No name, no email, no ID.
→ But: age + company size + city + amount + date = 1 identifiable person.
```

AI CAGE detects 8 quasi-identifier categories and warns (Free) or auto-cages (Pro) when ≥3 appear together:

```
⚠️ Inference Risk: 5 clues combined can identify you even without your name.
   (age, team size, city, amount, specific date)
```

---

## Ephemeral Tokens™ — Linkage Attack Prevention

Every competitor uses fixed tokens: `[EMAIL_1]` in every session. After 10 prompts, the AI links all sessions to the same identity.

AI CAGE generates a new 4-character salt every session:

```
Session 1 → [CAGED_EMAIL_K3P2_1]  ← unique
Session 2 → [CAGED_EMAIL_A7X9_1]  ← different
Session 3 → [CAGED_EMAIL_Q8M1_1]  ← unlinked
```

The AI cannot correlate your prompts across sessions. Zero extra configuration needed.

---

## Plain-Language Report

Every user gets a protection report in plain English — no jargon, no CSV, ready to share with their manager or compliance officer:

```
AI CAGE — Protection Report
Period: 1 November to 13 November
Hello Karim,

You almost shared 22 sensitive pieces of data with AI tools.
AI CAGE protected all of them before they were sent.

  - 3 email addresses
  - 2 Tunisian national IDs
  - 2 bank accounts (IBAN)
  - 2 API keys
  ...

Pro gives you the full event-by-event breakdown with exact timestamps.
```

---

## Core API

```typescript
import { cageText, uncageText, detectQuasiIdentifiers, generatePlainReport } from '@ai-cage/core';

// Cage PII before sending to AI — tokens rotate every session automatically
const { cagedText, entities, inferenceRisk } = cageText(
  'Invoice for ahmed@company.tn, card 4111 1111 1111 1111'
);
// cagedText → 'Invoice for [CAGED_EMAIL_K3P2_1], card [CAGED_CARD_K3P2_2]'
// inferenceRisk → { score: 0, risky: false, clues: [] }

// Check for inference risk (no direct PII but combination can identify)
const risk = detectQuasiIdentifiers(
  'My client, 34 years old, 8-person agency in Bizerte, contract 12,500 DT'
);
// risk → { score: 4, risky: true, message: 'Inference Risk: 4 clues combined...' }

// Restore AI response locally
const restored = uncageText(aiResponse, entities);

// Generate plain-language report from audit log
const report = await generatePlainReport(storage, { isPro: true, customerName: 'Karim Ben Salah' });
```

---

## Audit Log

```typescript
import { logEvent, exportAuditLogCSV } from '@ai-cage/core';

// Every cage event logged locally — zero PII values, only counts + types
await logEvent({
  type: 'PII_CAGED',
  site: 'chat.openai.com',
  counts: { EMAIL_ADDRESS: 1, CREDIT_CARD: 1 },
  totalCount: 2,
}, adapter);

// Export for GDPR auditor — safe CSV
const csv = await exportAuditLogCSV(adapter);
// id,timestamp,type,site,totalCount,EMAIL_ADDRESS,CREDIT_CARD
// 1,"2026-11-13T21:01:14Z",PII_CAGED,"chatgpt.com",2,1,1
```

The log **never** stores prompt text, AI responses, or original PII values.
Legally defensible under GDPR Article 5(1)(f).

---

## Privacy Guarantee

No data is sent to any server, including ours. Verify yourself:

```bash
# Should return zero matches in core PII/cage logic
grep -r "fetch\|XMLHttpRequest\|WebSocket" packages/
```

The pre-commit hook (`./husky/pre-commit`) runs this grep automatically on every commit and blocks the push if any network call is detected in core packages.

Full guarantee: [docs/PRIVACY_GUARANTEE.md](docs/PRIVACY_GUARANTEE.md)

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for Mermaid diagrams.

```
[User] → [AI CAGE] → cageText() + SESSION_SALT → [Monster AI]
                   ← uncageText() ←
         detectQuasiIdentifiers() → Inference Risk warning
         generatePlainReport()   → Plain English report
```

**PII never crosses the network boundary. Tokens rotate every session.**

---

## Contributing

```bash
# Fork → install → change → test → build → PR
pnpm install
pnpm test        # must be 202/202
pnpm build       # must be zero errors
```

Commit format: `feat(core): add X` / `fix(extension): handle Y` / `docs: update Z`

---

## Roadmap

| Version | Milestone |
|---------|-----------|
| **v0.6.0** (now) | 5 Cages live, Inference Cage™, Ephemeral Tokens™, Plain Report, 16 PII types |
| **v0.7.0** | Cage 4 (VS Code), Phase 2 delay/padding (noise), Chrome Web Store submission |
| **v0.8.0** | Mobile app (React Native), i18n FR/AR, ed25519 license signing |
| **v1.0.0** | Enterprise: SSO, SIEM connector, centralised policy dashboard |

---

## License

[Business Source License 1.1](LICENSE) — free to use and audit. Commercial use requires a license: [aicage.support@gmail.com](mailto:aicage.support@gmail.com)

---

*Built with zero budget. Maximum paranoia. Because your data deserves better than a Terms of Service.*
