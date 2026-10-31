# AI CAGE — Demo Video Script

Two versions: **30 seconds** (social media, ad) and **2 minutes** (full demo, investor pitch).

---

## Version 1: 30 Seconds (Social Media / Ad)

**Target:** LinkedIn, Twitter/X, YouTube Shorts
**Format:** 1280x720, 30fps, voiceover or text overlays
**Tone:** Fast, punchy, "holy shit this is real"

### Script

| Time | Visual | Text Overlay / Voiceover |
|------|--------|--------------------------|
| 0-3s | Screen recording: Chrome open on chat.openai.com. Green banner "🔒 AI CAGE Active" visible at top. | **"This is ChatGPT."** |
| 3-8s | Type into ChatGPT prompt box: `"Summarise this invoice for Ahmed Ben Ali, CIN 12345678, IBAN TN5910006035183598478831"` | **"An employee pastes customer data..."** |
| 8-12s | Press Enter. Text visibly changes BEFORE sending — `Ahmed Ben Ali` → `[CAGED_NAME_1]`, `12345678` → `[CAGED_CIN_2]`, `TN5910006035183598478831` → `[CAGED_IBAN_3]`. Badge updates: "3 items caged". | **"AI CAGE removes all PII — locally, before it leaves."** |
| 12-18s | ChatGPT responds: `"I've processed the invoice for [CAGED_NAME_1]..."` | **"ChatGPT never sees the real data."** |
| 18-24s | Response is displayed to user — tokens automatically restored: `Ahmed Ben Ali`, `12345678`, IBAN visible again. | **"You see the full result. The AI never saw it."** |
| 24-30s | Logo screen: 🔒 AI CAGE — "Use Monster AI. Leak Zero Data." + "Install free at ai-cage.io" | **"AI CAGE. Use Monster AI. Leak Zero Data."** |

### Production Notes
- No voiceover needed — use bold text overlays on dark background
- Record at 1920x1080, export at 1280x720
- Green accent colour: #16a34a for highlights
- Speed up the typing and ChatGPT response slightly (1.5x) to fit 30s

---

## Version 2: 2 Minutes (Full Demo / Investor Pitch)

**Target:** Website landing page, investor deck, sales calls
**Format:** 1920x1080, 30fps, voiceover required
**Tone:** Professional, confident, "this is enterprise-grade"

### Script

#### Part 1: The Problem (0:00 - 0:20)

| Time | Visual | Voiceover |
|------|--------|-----------|
| 0:00-0:05 | Dark background. Text: "Your employees use AI every day." | "Your employees use ChatGPT, Claude, and Gemini every single day." |
| 0:05-0:10 | Animation: email being typed into ChatGPT. Red glow around the email. | "And every prompt they send might contain customer data, API keys, IBANs, contracts." |
| 0:10-0:15 | Text: "You can't stop them." | "You can't stop them from using AI." |
| 0:15-0:20 | Text: "But you can cage the data." + 🔒 logo appears | "But you can cage the data." |

#### Part 2: Chat Leak Protection — Cage 1 (0:20 - 0:45)

| Time | Visual | Voiceover |
|------|--------|-----------|
| 0:20-0:25 | Chrome browser on chat.openai.com. AI CAGE banner appears: "🔒 AI CAGE Active" | "AI CAGE installs as a Chrome extension in 30 seconds." |
| 0:25-0:35 | Type: `"Send invoice to ahmed@company.tn, IBAN TN5910006035183598478831, CIN 12345678"`. Press Enter. Text transforms — PII replaced with [CAGED_EMAIL_1], [CAGED_IBAN_2], [CAGED_CIN_3]. Badge: "3 items caged". | "Type your prompt as usual. AI CAGE detects 15 types of PII — emails, IBANs, CINs, credit cards, API keys — and replaces them with safe tokens before the request leaves your browser." |
| 0:35-0:45 | ChatGPT responds with tokens. Display shows restored values. Popup shows stats. | "ChatGPT processes the structure, not your data. The response is restored locally. Your auditor can verify: zero PII crossed the network." |

#### Part 3: Shadow AI Detection — Cage 2 (0:45 - 1:05)

| Time | Visual | Voiceover |
|------|--------|-----------|
| 0:45-0:50 | Switch to popup → Shadow AI tab. Red badge visible. | "But what about the AI you didn't approve?" |
| 0:50-1:00 | Shadow AI tab shows list: Grammarly (3 calls), Notion AI (1 call), Slack AI (2 calls). Each marked CRITICAL or HIGH. | "AI CAGE monitors 47 AI endpoints. It detects when Notion, Slack, Grammarly, HubSpot — any SaaS — calls AI APIs behind your back. 88% of AI traffic is invisible to most companies." |
| 1:00-1:05 | Click "Export CSV" → file downloads. | "Export the full audit log as CSV for your compliance team." |

#### Part 4: Agent Rogue Protection — Cage 3 (1:05 - 1:35)

| Time | Visual | Voiceover |
|------|--------|-----------|
| 1:05-1:10 | Desktop app → Agent Cage panel. Live feed visible. | "Now, the most dangerous cage: Agent Rogue." |
| 1:10-1:20 | Click "Simulate Injection Attack". Feed shows: 🔴 BLOCKED — "INJECTION DETECTED: TOOL_ABUSE_FILESYSTEM, TOOL_ABUSE_NETWORK". | "When an AI agent is prompt-injected — told to run rm -rf or curl your .env to an attacker — AI CAGE detects 15 types of injection attacks and blocks them instantly." |
| 1:20-1:30 | Click "Simulate Tool Call" → send_email. Approval modal appears: "Agent wants to send email. Approve?" | "For dangerous actions like sending emails or deleting files, AI CAGE requires human approval. No agent acts alone." |
| 1:30-1:35 | Click "Approve Once". Feed shows: 🟢 ALLOWED. | "You approve once, always, or block. Every decision is logged." |

#### Part 5: Pricing & CTA (1:35 - 2:00)

| Time | Visual | Voiceover |
|------|--------|-----------|
| 1:35-1:45 | Pricing cards appear: Free 0€ / Pro 5€ / Enterprise 15€ / Compliance 199€. | "AI CAGE is free for individuals. Pro is 5 euros per user per month. Enterprise with SSO and SIEM is 15. A compliance module for GDPR auditors is 199 flat." |
| 1:45-1:52 | Privacy guarantee section: "No data sent to any server, including ours." | "Zero data leaves your device. No servers. No telemetry. Open source, MIT license. 202 automated tests." |
| 1:52-2:00 | Logo: 🔒 AI CAGE. "Use Monster AI. Leak Zero Data." + install links. | "AI CAGE. Use Monster AI. Leak Zero Data. Install free at ai-cage.io." |

### Production Notes

- **Voiceover:** calm, confident, slight Tunisian accent is fine (shows authenticity)
- **Music:** none or very subtle ambient (avoid distracting from the demo)
- **Screen recording:** use OBS Studio, 1920x1080, 30fps
- **Text overlays:** white text on semi-transparent dark background, lower third
- **Pacing:** 2 minutes is tight — rehearse the clicks. Cut dead air aggressively.
- **Export:** H.264, 10 Mbps, 1920x1080, for web. Also export 1280x720 for mobile.

---

## Equipment Checklist

- [ ] Chrome with AI CAGE extension loaded (apps/extension/dist/)
- [ ] Desktop app running (pnpm --filter @ai-cage/desktop run tauri dev)
- [ ] OBS Studio configured for 1920x1080 screen capture
- [ ] ChatGPT account logged in (chat.openai.com)
- [ ] Test data ready: `ahmed@company.tn`, `TN5910006035183598478831`, `12345678`
- [ ] Microphone for voiceover (version 2 only)

## Demo Data (copy-paste ready)

```
Summarise this invoice for Ahmed Ben Ali, CIN 12345678, IBAN TN5910006035183598478831, amount 5000 EUR, email ahmed@company.tn
```

This single line triggers 4 PII detections: PERSON_NAME, CIN_TN, IBAN, EMAIL_ADDRESS.
