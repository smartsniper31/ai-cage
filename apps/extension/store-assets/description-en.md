# AI CAGE — Chrome Web Store Description (English)

## Short Description (132 chars max)

🔒 Cage The Monster AI. Cages PII before it reaches ChatGPT, Claude, Gemini. Detects Shadow AI. 100% local, zero data leaves your device.

## Detailed Description

**AI CAGE — Enterprise AI Data Protection**

Use Monster AI. Leak Zero Data.

Your employees use ChatGPT, Claude, Gemini, Copilot every day. Every prompt they send is a potential data breach — names, emails, IBANs, API keys, source code, contracts.

**AI CAGE is the first antivirus for AI.** It intercepts every prompt, removes all sensitive data locally before it reaches the AI provider, and restores it in the response. The AI does useful work. Your data stays home.

### What AI CAGE Does

**🔒 Cage 1 — Chat Leak Protection**
Replaces PII in your prompts with safe tokens like [CAGED_EMAIL_1] before the request is sent to ChatGPT, Claude, or Gemini. The AI never sees your real data. You see the full response restored locally.

**👁️ Cage 2 — Shadow AI Detection**
Monitors 47 AI endpoints. Discover which SaaS tools (Notion, Slack, Grammarly, HubSpot, Salesforce) are calling AI APIs behind your back. 88% of AI traffic is invisible to most companies.

**🤖 Cage 3 — Agent Rogue Protection**
Detects 15 types of prompt injection attacks. Blocks AI agents from executing dangerous commands (rm -rf, curl exfiltration, credential harvesting). Human-in-the-loop approval for every dangerous tool call.

**📋 Cage 7 — Compliance Audit Log**
Immutable local audit log. Export a CSV for your GDPR auditor showing exactly what was caged, when, and where. Zero PII values stored — only counts and types. Tamper-evidence history.

### Detected PII Types (15)

Email addresses, credit cards, IBAN, Tunisian RIB, Tunisian CIN, Tunisian Matricule Fiscal, Tunisian passport, carte de séjour, API keys, private keys, IP addresses, phone numbers, generic secrets, person names (Arabic/French/English), meeting transcript participants.

### Privacy Guarantee

No data is sent to any server, including ours. All PII detection happens locally on your device. The code is open-source (MIT) and auditable by any security engineer.

Verify yourself:
- Grep for `fetch/XMLHttpRequest` in the source — zero matches in core
- 202 automated tests including a security contract test
- CSP: `connect-src 'none'` — the extension cannot make network requests

### Pricing

- **Free**: 15 PII types, 100 cages/month, Shadow AI detection
- **Pro (€5/user/month)**: Unlimited, Agent Cage, MCP monitoring, custom policy, audit CSV export
- **Enterprise (€15/user/month)**: SSO, SIEM connector, centralised policy

### Technical

- Chrome Extension MV3, TypeScript, Vite
- 100% offline — works with no internet connection
- Zero external dependencies in core engine
- 202 unit tests (Vitest)
- GitHub Actions CI on every commit
- Husky pre-commit hook with security grep

**Made in Tunisia 🇹🇳 · 100% Offline · Open Source · MIT License**

---

*Use Monster AI. Leak Zero Data. Prove it to your auditor.*
