# AI CAGE — Privacy Policy (Chrome Web Store)

**Last updated:** 2026-10-31
**Extension:** AI CAGE — Enterprise AI Data Protection
**Version:** 0.4.5

## Data Collection

**AI CAGE does not collect, store, or transmit any user data to any server.**

This is not a privacy policy that describes what we collect. This is a statement that we collect nothing. Zero. Nothing leaves your device.

## What AI CAGE Does

AI CAGE intercepts text you type into AI chat interfaces (ChatGPT, Claude, Gemini, Copilot), detects personally identifiable information (PII) using local regex patterns, and replaces it with safe placeholder tokens before the text is sent to the AI provider's servers.

All PII detection and replacement happens locally in your browser. No data is sent to AI CAGE servers because AI CAGE has no servers.

## Permissions Explained

| Permission | Why | Data sent? |
|-----------|-----|-----------|
| `activeTab` | Read the current page DOM to find the prompt input field | No — local only |
| `scripting` | Inject the content script that does PII detection | No — local code |
| `tabs` | Get tab ID for the badge counter | No — only the integer ID |
| `storage` | Store cage counts and audit log locally | No — chrome.storage.local only |
| `webRequest` | Monitor outbound requests for Shadow AI detection | No — observes only, never sends |
| Host permissions | Required to inject content script on AI chat sites | No — script runs locally |

## Data Storage

All data is stored locally in `chrome.storage.local`:
- Cage count (integer) — how many PII items were caged
- Audit log entries — type, count, site, timestamp. **No PII values stored.**

Data never leaves the device. `chrome.storage.sync` is intentionally NOT used.

## Third-Party Services

AI CAGE does not use any third-party services. No analytics. No telemetry. No crash reporting. No CDN. No remote configuration.

## Open Source

The entire codebase is published at https://github.com/smartsniper31/ai-cage under the MIT license. Any security engineer can verify these claims by reading the source code.

## Contact

For privacy questions: open a GitHub issue tagged `privacy`.
