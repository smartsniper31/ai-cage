# AI CAGE — Chrome Web Store Screenshot Specifications

All screenshots must be 1280x800 pixels, PNG format.

## Screenshot 1: Popup Overview
**File:** `screenshot-01-overview.png`
**Content:**
- Extension popup open, showing the Overview tab
- Stats grid: "42 caged this month", "7 Shadow AI calls", "5 this session", "3 this tab"
- Status pill: "🔒 Protecting your data"
- Top sites list visible
- Browser: Chrome on chat.openai.com
- Green header visible: "🔒 AI CAGE Active"

## Screenshot 2: Shadow AI Detection (47 endpoints)
**File:** `screenshot-02-shadow-ai.png`
**Content:**
- Popup Shadow AI tab active
- List showing detected shadow AI calls:
  - "grammarly.com — 3 calls — CRITICAL"
  - "notion.so — 1 call — HIGH"
  - "api.openai.com — 2 calls — CRITICAL"
- Red badge numbers visible
- Caption overlay: "47 AI endpoints tracked"

## Screenshot 3: Agent Cage — Injection Blocked
**File:** `screenshot-03-agent-cage.png`
**Content:**
- Desktop app Agent Cage panel
- Live feed showing:
  - 🔴 BLOCKED — shell — "INJECTION DETECTED: TOOL_ABUSE_FILESYSTEM"
  - 🟡 APPROVAL — send_email — "Waiting for human approval..."
  - 🟢 ALLOWED — read_file — "Permitted by policy"
- Counters: "5 Blocked, 2 Pending, 12 Allowed"
- Policy display visible on right

## Screenshot 4: Audit Log CSV Export
**File:** `screenshot-04-audit-log.png`
**Content:**
- Desktop app Audit Log panel
- Summary cards: "42 PII caged this month", "7 Shadow AI calls", "3 Agent tool calls"
- Audit table with rows: PII_CAGED, SHADOW_AI_DETECTED, AGENT_TOOL_CALL
- "📄 Export CSV for Auditor" button highlighted

## Screenshot 5: Banner on ChatGPT
**File:** `screenshot-05-banner-chatgpt.png`
**Content:**
- Full browser screenshot of chat.openai.com
- Green banner at top: "🔒 AI CAGE Active — 3 items caged"
- ChatGPT interface visible below banner
- Prompt box shows caged text: "[CAGED_EMAIL_1]" instead of actual email
- Badge on extension icon shows "3" in green

## Promo Tile (440x280)
**File:** `promo-tile-440x280.png`
**Content:**
- Dark green background (#15803d)
- Large "🔒" icon centered top
- "AI CAGE" in bold white text
- "Use Monster AI. Leak Zero Data." in lighter text
- Bottom: "100% Local · Open Source · Made in Tunisia 🇹🇳"

## Marquee Tile (1400x560)
**File:** `marquee-1400x560.png`
**Content:**
- Split design: left dark green, right white
- Left side: "🔒 AI CAGE" logo + tagline + "6 Cages · 47 AI endpoints · 202 tests"
- Right side: Before/After demo showing:
  - Before (red bg): "Send to alice@company.tn, card 4111..."
  - After (green bg): "Send to [CAGED_EMAIL_1], card [CAGED_CARD_2]"
- Bottom strip: "Free · Pro €5/mo · Enterprise €15/mo · Compliance €199/mo"
