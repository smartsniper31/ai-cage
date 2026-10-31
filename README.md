# 🔒 AI CAGE

**Use Monster AI. Leak Zero Data.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Zero Dependencies](https://img.shields.io/badge/network_calls-zero-brightgreen)](#)
[![Offline First](https://img.shields.io/badge/offline-first-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-1.6-orange)](https://tauri.app/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io/)

---

## What Is AI CAGE?

AI CAGE is the first enterprise-grade **AI Antivirus** — it protects companies against data leakage when employees use public AI services (ChatGPT, Claude, Gemini, Copilot) without a private AI deployment.

**The problem:** Your employees are already using Monster AI. You cannot stop them. But every prompt they send is a potential data breach — names, emails, IBANs, API keys, source code, contracts.

**The solution:** AI CAGE intercepts every prompt, removes the PII locally before it reaches the AI, and restores it in the response. The AI does useful work. Your data stays home.

```
BEFORE AI CAGE:
"Summarise invoice for Ahmed Ben Ali, IBAN TN5910006035183598478831"
    → Sent verbatim to OpenAI servers  ❌

AFTER AI CAGE:
"Summarise invoice for [CAGED_NAME_1], IBAN [CAGED_IBAN_2]"
    → Sent to OpenAI  ✅  (no PII)
AI responds: "Invoice for [CAGED_NAME_1] totals..."
Restored locally: "Invoice for Ahmed Ben Ali totals..."  ✅
```

---

## The Core Promise

| Claim | How |
|-------|-----|
| **Zero data leaves the cage** | All PII detection runs inside the browser/desktop process |
| **100% local, offline-first** | Detection is regex-based — works with no internet connection |
| **Auditable** | < 600 lines of TypeScript in the core logic. Read it in an hour. |
| **Zero cost** | No servers. No subscriptions. No cloud. |
| **Open source** | MIT license. Fork it. Audit it. Deploy it. |

---

## Repo Structure

```
ai-cage/
├── apps/
│   ├── extension/          Chrome Extension MV3 (TypeScript + Vite)
│   └── desktop/            Desktop App (Tauri 1.6 — Rust + TypeScript)
├── packages/
│   ├── core/               cageText() / uncageText() — zero external deps
│   └── presidio-lite/      Offline PII patterns (regex, no ML model)
├── docs/
│   ├── ARCHITECTURE.md     Mermaid diagrams + design decisions
│   ├── THREAT_MODEL.md     7 threat surfaces (Cages)
│   └── PRIVACY_GUARANTEE.md  The legal-grade privacy commitment
├── FOUNDATION_REPORT.md
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
# Clone
git clone https://github.com/your-org/ai-cage.git
cd ai-cage

# Install all workspace dependencies
pnpm install

# Build all packages
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Load Chrome Extension

1. Run `pnpm build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right)
4. Click **Load Unpacked**
5. Select `apps/extension/dist/`
6. Visit `chat.openai.com` — look for the green **🔒 AI CAGE Active** banner

---

## The 7 Cages

AI CAGE is architected around 7 threat surfaces. V1 implements **Cage 1**.

| # | Threat | Status |
|---|--------|--------|
| 1 | **Chat Leak** — PII in AI chat prompts | ✅ **V1** |
| 2 | **Shadow AI** — Unapproved AI tools | ✅ **V2** |
| 3 | Agent Rogue — AI agents with tool-use | 🔜 V3 |
| 4 | **Code Leak** — Source code + secrets in AI IDEs | ✅ **V2** |
| 5 | Voice/Video — Meeting transcripts | 🔜 V3 |
| 6 | Credential Hijack — API keys in AI context | 🔜 V3 |
| 7 | Compliance — GDPR/HIPAA audit trail | ✅ **V2 (Audit Log)** |

Full threat model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)

---

## Detected PII Types (V1)

| Type | Examples | Confidence |
|------|---------|-----------|
| `EMAIL_ADDRESS` | alice@company.com | 0.95 |
| `CREDIT_CARD` | 4111 1111 1111 1111 | 0.90 |
| `IBAN` | TN5910006035... | 0.90 |
| `PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----` | 1.00 |
| `API_KEY` | AKIA..., ghp_..., sk_live_... | 0.88 |
| `GENERIC_SECRET` | password=..., token=... | 0.82 |
| `IP_ADDRESS` | 192.168.1.1 | 0.85 |
| `RIB_TN` | 20-digit Tunisian RIB | 0.80 |
| `PHONE_NUMBER` | +216 12 345 678 | 0.75 |
| `PASSPORT` | A1234567 | 0.70 |
| `CIN_TN` | 12345678 (Tunisian CIN) | 0.65 |
| `PERSON_NAME` | Title-cased name pairs | 0.55 |

---

## Audit Log — Prove Zero Leakage to Your Auditor

```typescript
import { logEvent, exportAuditLogCSV, createMemoryAdapter } from '@ai-cage/core';

// Every cage event is logged locally — no PII values, only counts
await logEvent({
  type: 'PII_CAGED',
  site: 'chat.openai.com',
  counts: { EMAIL_ADDRESS: 1, CREDIT_CARD: 1 },
  totalCount: 2,
}, adapter);

// Export for auditor — safe CSV, zero PII
const csv = await exportAuditLogCSV(adapter);
// id,timestamp,type,site,totalCount,detail,EMAIL_ADDRESS,CREDIT_CARD
// 1,"2026-10-31T09:47:12Z",PII_CAGED,"chat.openai.com",2,,1,1
```

The log **never** stores prompt text, AI responses, or original PII values.
It is legally defensible under GDPR Article 5(1)(f).

---

## Shadow AI Detection

```typescript
import { matchAiEndpoint } from '@ai-cage/core';

// 42 known AI endpoints across 4 categories
const matches = matchAiEndpoint('https://capi.grammarly.com/text-suggestions');
// [{ id: 'grammarly', name: 'Grammarly', category: 'saas-embedded', riskLevel: 'high' }]
```

The Chrome Extension monitors ALL outbound requests and flags calls to:
- Direct LLM APIs (OpenAI, Anthropic, Gemini, Copilot...)
- Developer tools (GitHub Copilot, Cursor, Codeium...)
- SaaS with embedded AI (Notion, Slack, HubSpot, Salesforce, Grammarly...)
- AI Infrastructure (AWS Bedrock, Azure AI, Vertex AI...)

---

## Core API

```typescript
import { cageText, uncageText } from '@ai-cage/core';

// Before sending to AI
const { cagedText, entities } = cageText(
  'Invoice for ahmed@company.tn, card 4111 1111 1111 1111'
);
// cagedText → 'Invoice for [CAGED_EMAIL_1], card [CAGED_CARD_2]'

// After receiving AI response
const restored = uncageText(
  'Great, I processed [CAGED_EMAIL_1] with card [CAGED_CARD_2].',
  entities
);
// restored → 'Great, I processed ahmed@company.tn with card 4111 1111 1111 1111.'
```

---

## Privacy Guarantee

No data is sent to any server, including ours. All PII detection happens locally. The code is open-source auditable.

Full guarantee: [docs/PRIVACY_GUARANTEE.md](docs/PRIVACY_GUARANTEE.md)

```bash
# Verify yourself — should return zero matches
grep -r "fetch\|XMLHttpRequest\|WebSocket" packages/ apps/extension/src/
```

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full Mermaid diagrams.

```
[User] → [AI CAGE Extension/Desktop] → cageText() → [Monster AI]
                                      ← uncageText() ←
```

**PII never crosses the network boundary.**

---

## Contributing

1. Fork the repo
2. `pnpm install`
3. Make your changes
4. `pnpm test` — all tests must pass
5. `pnpm build` — must build with zero errors
6. Open a PR with a description following [Conventional Commits](https://www.conventionalcommits.org/)

### Commit Format

```
feat(core): add SSN detection pattern
fix(extension): handle contenteditable prompts on Claude
docs(threat-model): expand Cage 4 (Code Leak) details
test(presidio-lite): add IBAN edge cases
```

---

## Roadmap

- **V1** (done): Chat Leak protection, Chrome Extension + Desktop shell
- **V2** (done): Shadow AI detection (42 endpoints), Immutable Audit Log, Code Leak VS Code Extension, Arabic/TN PII detectors, CI + Security hardening
- **V3**: Voice/Video transcript scanning, Compliance reports (GDPR Art.30), Firefox extension, Agent Rogue detection
- **V4**: Enterprise admin dashboard, policy engine, SSO integration

---

## License

[MIT](LICENSE) — free to use, audit, fork, and deploy.

---

*Built with zero budget. Maximum paranoia. Because your data deserves better than a Terms of Service.*
