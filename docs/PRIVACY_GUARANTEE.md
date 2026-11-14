# AI CAGE — Privacy Guarantee

**Version:** v0.6.0
**Effective date:** 2026-11-14
**Applies to:** Chrome Extension, Firefox Extension, Edge Extension, Windows Desktop App

---

## The Guarantee

> **No data is sent to any server, including ours.**
> **All PII detection and caging happens locally on your device.**
> **Tokens rotate every session — the AI cannot build a profile of you over time.**
> **The code is open-source and auditable by any security engineer in under an hour.**

This is not a privacy policy. It is an architectural guarantee backed by open-source code and enforced by an automated pre-commit security contract.

---

## What "Local" Means

Every function that touches your text runs **inside your browser process** (extension) or **inside the Tauri desktop process** on your machine.

There is no:
- AI CAGE server receiving your prompts
- Database storing your PII
- Analytics pipeline tracking your usage
- Telemetry reporting back to any third party
- CDN delivering the detection logic at runtime

The detection patterns are shipped **inside the extension bundle** at install time. They work with no internet connection.

---

## What Happens to Your Text — Step by Step

```
Step 1: You type a prompt
        Your text exists only in your browser's DOM.

Step 2: AI CAGE scans it locally
        scanText() runs in the content script.
        detectQuasiIdentifiers() checks for inference risk clues.
        No network, no cross-origin communication.

Step 3: Session salt is generated
        SESSION_SALT is a 4-char random code generated once per browser session.
        It exists only in memory — never written to storage, never transmitted.
        Closing the tab destroys it permanently.

Step 4: PII is replaced with salted tokens
        cageText() replaces PII with tokens like [CAGED_EMAIL_K3P2_1].
        The mapping (token → original value) lives ONLY in a JavaScript
        closure variable — it is never serialised or stored anywhere.
        The salt changes every session — [EMAIL_K3P2_1] today,
        [EMAIL_A7X9_1] tomorrow.

Step 5: Caged text is submitted
        The AI provider (OpenAI, Anthropic, Google) receives ONLY the caged
        version. They never see original values. The session salt makes their
        tokens meaningless across sessions — no behavioral profiling possible.

Step 6: AI responds with tokens
        The response contains [CAGED_K3P2_...] placeholders.

Step 7: Tokens are restored locally
        uncageText() substitutes tokens back with the originals,
        locally, before displaying the response to you.

Step 8: Session ends
        When you close the tab, the token↔value mapping is garbage-collected.
        The session salt is lost forever.
        Nothing was ever stored — nothing to delete.

Step 9: Audit log (optional)
        If you export a report or CSV, only counts and entity types are stored
        locally: "2 email addresses, 1 IBAN" — never the actual values.
        The detail field is sanitised automatically to strip any leaked tokens.
```

---

## Verification — How to Prove This Yourself

You do not need to trust us. These are four independent ways to verify the guarantee.

### 1. Read the source code

```
packages/core/src/cage.ts        — cageText(), SESSION_SALT, detectQuasiIdentifiers()
packages/core/src/auditLog.ts    — logEvent(), sanitiseDetail(), generatePlainReport()
packages/presidio-lite/src/      — All 16 PII detection patterns
```
Fewer than 800 lines of TypeScript. A security engineer can read all of it in under an hour.

### 2. Search for network calls

```bash
# Grep the entire source tree for network primitives
grep -r "fetch\|XMLHttpRequest\|WebSocket\|navigator.sendBeacon" packages/
# Expected: zero matches in PII/cage/audit logic
```

### 3. Inspect the built extension

```bash
grep -r "fetch\|XMLHttpRequest" apps/extension/dist/
# Expected: zero matches (only the update-checker fetch in popup.ts, clearly commented)
```

### 4. Use browser DevTools

1. Load the extension (Developer Mode → Load Unpacked → `apps/extension/dist/`)
2. Open DevTools → Network tab → filter: `Fetch/XHR`
3. Visit `chat.openai.com` and type a prompt containing your email
4. Observe: AI CAGE makes **zero outbound requests**
5. Observe: the request to OpenAI's API does NOT contain your email
6. Observe: the token in the request changes compared to your previous session (Ephemeral Tokens™)

### 5. Run the automated security contract

```bash
pnpm test
# The test suite includes:
# - "cage module does not reference fetch or XMLHttpRequest"
# - "license module does not reference fetch or XMLHttpRequest"
# Both must pass — the pre-commit hook blocks any commit that breaks them
```

---

## What We Collect

| Data | Collected? | Stored? | Transmitted? |
|------|-----------|---------|-------------|
| Your prompt text | ❌ | ❌ | ❌ |
| PII values (names, emails, IBANs...) | ❌ | ❌ | ❌ |
| Session salt | In memory only | ❌ | ❌ |
| AI responses | ❌ | ❌ | ❌ |
| PII counts (audit log) | Locally only | Local only | ❌ |
| Entity types (audit log) | Locally only | Local only | ❌ |
| Browser tabs/URLs | Not read | ❌ | ❌ |
| Your identity | ❌ (Free) / license email (Pro) | Local only | ❌ |
| Crash reports | ❌ | ❌ | ❌ |
| Usage analytics | ❌ | ❌ | ❌ |

---

## Permissions Explained

| Permission | Why | Privacy risk |
|-----------|-----|-------------|
| `activeTab` | Read DOM to find the prompt textarea | Only on user action — not passive |
| `scripting` | Inject content script | Script is local code, not a remote server |
| `tabs` | Get current tab ID for badge counter | Tab ID integer only — no URL, no content |
| `webRequest` | Detect Shadow AI outbound calls | Reads URL only — not request body |
| `storage` | Store audit log and license key locally | Local only — never transmitted |

---

## The Ephemeral Tokens™ Guarantee

Standard PII caging tools use fixed tokens: `[EMAIL_1]` in every session. After 10 sessions, the AI can correlate all sessions to the same person — without ever seeing direct PII. This is a **linkage attack**.

AI CAGE generates a fresh session salt every time you open a tab:

```
Session 1 → [CAGED_EMAIL_K3P2_1]  — AI sees this
Session 2 → [CAGED_EMAIL_A7X9_1]  — AI sees something different
Session 3 → [CAGED_EMAIL_Q8M1_1]  — AI cannot link to sessions 1 or 2
```

The salt is 4 characters, randomly drawn from a 32-character alphabet (no 0/O/I/1 ambiguity). It is generated once per module load (= once per session in both the MV3 service worker and the Tauri WebView). It is never written to `chrome.storage`, `localStorage`, `sessionStorage`, `IndexedDB`, or any other persistent medium.

---

## GDPR Alignment

| GDPR Principle | How AI CAGE implements it |
|----------------|--------------------------|
| Data minimisation (Art. 5(1)(c)) | Zero PII stored. Only counts + entity types in audit log. |
| Purpose limitation (Art. 5(1)(b)) | Audit log used exclusively for user-controlled export — no secondary use. |
| Right to erasure (Art. 17) | "Clear Log" button permanently removes all audit entries. No server backup to delete. |
| Data breach notification (Art. 33) | No breach possible — no PII stored, no server holding user data. |
| Records of processing (Art. 30) | Audit CSV export provides the required record of AI processing activities. |

---

## Responsible Disclosure

If you find a privacy violation in this codebase, open a GitHub issue tagged `security`.
Response within 48h, patch within 7 days.

This guarantee is only as good as the code behind it. Help us keep it honest.

**Contact:** [aicage.support@gmail.com](mailto:aicage.support@gmail.com)
**Code:** [github.com/smartsniper31/ai-cage](https://github.com/smartsniper31/ai-cage)
