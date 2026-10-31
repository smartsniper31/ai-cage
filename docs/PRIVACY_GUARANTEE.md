# AI CAGE — Privacy Guarantee

**Version:** 0.1.0
**Effective date:** 2026-10-30

---

## The Guarantee

> **No data is sent to any server, including ours.**
> **All PII detection happens locally on your device.**
> **The code is open-source and auditable by any security engineer.**

This is not a privacy policy. It is an architectural guarantee backed by open-source code.

---

## What "Local" Means

Every function in this codebase that touches your text runs **inside your browser process** (Chrome extension) or **inside the Tauri desktop process** on your machine.

There is no:
- AI CAGE server receiving your prompts
- Database storing your PII
- Analytics pipeline tracking your usage
- Telemetry reporting back to any third party
- CDN delivering the detection logic at runtime

The detection patterns are shipped **inside the extension bundle** — they work with no internet connection.

---

## Cryptographic Verification (V2 Roadmap)

In a future version, we will publish signed build attestations so you can verify that the extension you installed from the Chrome Web Store is built from the exact commit hash published on GitHub. No binary substitution possible.

---

## What Happens to Your Text

```
Step 1: You type a prompt
        Your text exists only in your browser's DOM.

Step 2: AI CAGE scans it
        scanText() runs in the content script — same origin as the page,
        no cross-origin communication, no network.

Step 3: PII is replaced
        cageText() replaces PII with [CAGED_X] tokens.
        The mapping (token ↔ original value) lives ONLY in the content
        script's JavaScript closure — a local variable.

Step 4: Caged text is submitted
        The sanitised prompt is written back into the chat input.
        The AI provider (OpenAI, Anthropic, Google) receives ONLY the
        caged version. They never see the original values.

Step 5: AI responds
        The response contains [CAGED_X] tokens where your PII was.

Step 6: Tokens are restored
        uncageText() substitutes the tokens back with the originals,
        locally, before displaying the response to you.

Step 7: Session ends
        When you close the tab, the token↔value mapping is garbage-collected
        by the JavaScript runtime. There is nothing to delete — it was
        never stored.
```

---

## How to Verify This Yourself

You do not need to trust us. You can verify these claims independently.

### 1. Read the source code

The entire codebase is at `packages/presidio-lite/src/` and `packages/core/src/`.
There are fewer than 600 lines of TypeScript in the detection and caging logic.
A security engineer can read all of it in under an hour.

### 2. Search for network calls

```bash
# Grep the entire source tree for network primitives
grep -r "fetch\|XMLHttpRequest\|WebSocket\|navigator.sendBeacon" packages/ apps/extension/src/
# Expected result: zero matches in PII-handling code
```

### 3. Inspect the built extension

```bash
# After pnpm build, inspect the compiled JS
grep -r "fetch\|XMLHttpRequest" apps/extension/dist/
# Expected result: zero matches
```

### 4. Use browser DevTools

1. Load the extension via `chrome://extensions` → Load Unpacked
2. Open DevTools → Network tab
3. Visit chat.openai.com and type a message with your email address
4. Observe: the extension makes **zero outbound requests**
5. Observe: the request to OpenAI's API does NOT contain your email

### 5. Run the unit tests

```bash
pnpm test
```

The test suite includes a dedicated security contract test that asserts
the source files do not contain `fetch`, `XMLHttpRequest`, `WebSocket`,
`localStorage`, or `indexedDB`.

---

## What We Collect

| Data Type | Collected? | Stored? | Transmitted? |
|-----------|-----------|---------|-------------|
| Your prompt text | ❌ | ❌ | ❌ |
| PII values (names, emails, etc.) | ❌ | ❌ | ❌ |
| AI responses | ❌ | ❌ | ❌ |
| Badge count (integer) | In memory only | ❌ | ❌ |
| Browser tabs/URLs | Not read | ❌ | ❌ |
| Your identity | ❌ | ❌ | ❌ |
| Crash reports | ❌ | ❌ | ❌ |
| Usage analytics | ❌ | ❌ | ❌ |

---

## Permissions Explained

The Chrome extension requests these permissions:

| Permission | Why | Can it leak data? |
|-----------|-----|-------------------|
| `activeTab` | Read the current page's DOM to find the prompt textarea | Only on user action, not passively |
| `scripting` | Inject the content script | Script runs locally, no network |
| `tabs` | Get the current tab ID for the badge counter | Only the tab ID integer — no URL, no content |
| `storage` | *(reserved for V2 settings)* — Not used in V1 | N/A |
| Host permissions (`chat.openai.com`, etc.) | Required for content script injection | Content script is local code, not a remote server |

---

## Contact

If you find a privacy violation in this codebase, please open a GitHub issue tagged `security`.
We will respond within 48 hours and publish a fix within 7 days.

This guarantee is only as good as the code behind it. Help us keep it honest.
