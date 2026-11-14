# AI CAGE — v0.6.0 Final Release Report

**Version:** v0.6.0
**Date updated:** 2026-11-14
**Status:** ✅ PRODUCTION READY — Client-ready, all P0 bugs resolved, all fixes tested

---

## 1. Build Sizes (latest)

| File | Size | Notes |
|------|------|-------|
| `apps/extension/dist/background.js` | ~41 kB | Includes generatePlainReport, dedup, cooldown |
| `apps/extension/dist/content.js` | ~36 kB | Includes inferenceRisk, Ephemeral Tokens |
| `apps/extension/dist/popup.js` | ~27 kB | Report button, InferenceRisk banner, PRO gating |
| `apps/extension/dist/injected.js` | 12.87 kB | Network interceptor |
| `apps/desktop/dist/index.html` | 25.65 kB | |
| `apps/desktop/dist/assets/index.js` | **59.41 kB** | All fixes T1-T3 included |
| `apps/landing/dist/index.html` | ~60 kB | AI Secrets section, Inference Cage, competitive table |
| `dist/ai-cage-extension-v0.6.0-chrome.zip` | **46 KB** | All P0+R+S+T fixes |
| `dist/ai-cage-extension-v0.6.0-firefox.zip` | **46 KB** | All P0+R+S+T fixes |
| `ai-cage-desktop-windows-setup.exe` | 1.06 MB | Tauri — T1-T3 fixes included |
| `ai-cage-desktop-windows.msi` | 1.54 MB | Tauri — T1-T3 fixes included |

---

## 2. Test Results

```
PRESIDIO-LITE : 74/74  ✅
CORE          : 128/128 ✅
TOTAL         : 202/202 ✅
Security contract: no network calls in core packages ✅
Pre-commit hook: blocks any network call addition ✅
```

---

## 3. Git

| Item | Value |
|------|-------|
| Latest commit | `c0dab41` |
| Branch | `master` |
| Tag | `v0.6.0` |
| Remote | `origin/master` up to date |

---

## 4. GitHub Release v0.6.0 — 6 Assets

| Asset | Size | Last rebuilt |
|-------|------|-------------|
| `ai-cage-desktop-windows-setup.exe` | 1.06 MB | 14/11/2026 (T1-T3) |
| `ai-cage-desktop-windows.msi` | 1.54 MB | 14/11/2026 (T1-T3) |
| `ai-cage-extension-v0.6.0-chrome.zip` | 46 KB | 14/11/2026 |
| `ai-cage-extension-v0.6.0-firefox.zip` | 46 KB | 14/11/2026 |
| `checksums-v0.6.0.txt` | SHA256 | 14/11/2026 |
| `test-results-v0.6.0.txt` | 202/202 | 14/11/2026 |

---

## 5. Vercel

| Item | Value |
|------|-------|
| URL | https://ai-cage-gamma.vercel.app/ |
| Auto-deploy | ✅ on every git push origin master |
| Root directory | `apps/landing` |
| Pages live | index.html, install.html, success.html, version.json |

---

## 6. Features — Free vs Pro

### Extension (Chrome / Edge / Firefox)

| Feature | Free | Pro |
|---------|------|-----|
| PII cage — 16 types | ✅ 100/month | ✅ Unlimited |
| SESSION_SALT Ephemeral Tokens™ | ✅ | ✅ |
| Inference Risk warning | ✅ | ✅ auto-cage |
| Shadow AI detection (47 endpoints, 5min cooldown) | ✅ | ✅ |
| Status pill + toast notifications | ✅ | ✅ |
| Update checker | ✅ | ✅ |
| Plain-language report (summary) | ✅ | ✅ Full |
| Agent Cage + injection detection | ❌ | ✅ |
| Audit CSV export | ❌ | ✅ |
| Account tab + license activation | ✅ | ✅ |

### Desktop App (Windows)

| Feature | Free | Pro |
|---------|------|-----|
| Cage PII (manual) — 16 types | ✅ | ✅ |
| SESSION_SALT Ephemeral Tokens™ | ✅ | ✅ |
| Inference Risk warning | ✅ | ✅ |
| Restore AI response | ✅ | ✅ |
| Audit Log (read) | ✅ | ✅ |
| Shadow AI catalogue (47 endpoints) | ✅ | ✅ |
| Plain-language report (summary) | ✅ | ✅ Full |
| Account tab + license activation | ✅ | ✅ |
| Agent Cage simulation | ❌ | ✅ |
| Export CSV | ❌ | ✅ |

---

## 7. PII Detectors — 16 Types (ordered by score)

| Type | Score | Coverage |
|------|-------|----------|
| PRIVATE_KEY | 1.00 | PEM keys |
| EMAIL_ADDRESS | 0.95 | RFC 5321 |
| MF_TN | 0.92 | Tunisian Matricule Fiscal |
| CREDIT_CARD | 0.90 | Visa/MC/Amex (Luhn) |
| IBAN | 0.90 | ISO 13616, before PHONE in detector order |
| API_KEY | 0.88 | AKIA, ghp_ (min 20), sk-test/ant/proj, gsk_, xoxb-, AIza (no-boundary fix) |
| GENERIC_SECRET | 0.82 | password=, mot de passe [qualifier] :, mdp |
| IP_ADDRESS | 0.85 | IPv4/IPv6 |
| RIB_TN | 0.80 | 2+3+3+12+2 (5-block fix T1), 2+3+12+2, 2+3+13+2 |
| PASSPORT_TN | 0.78 | 1 letter + 7 digits |
| PHONE_NUMBER | 0.75 | +intl, local (no-RIB-overlap fix S1) |
| POSTAL_ADDRESS | 0.72 | FR/EN/TN streets + Tunisian cities |
| CARTE_SEJOUR | 0.72 | FR/TN residence permit |
| PASSPORT | 0.70 | Generic 1-2 letters + 6-9 digits |
| CIN_TN | 0.65 | 8-digit Tunisian national ID |
| PERSON_NAME | 0.58 | "Nom du client : X" label pattern + Arabic names + European pairs |

---

## 8. All Fixes Applied

### Original QA Fixes (pre-v0.6.0)
| Fix | Status |
|-----|--------|
| P1 — Address detector | ✅ |
| P2 — Restore empty message | ✅ |
| P3 — Shadow AI disclaimer | ✅ |
| P4 — Branded icon | ✅ |
| Free tier bar hidden in PRO | ✅ |

### P0 Fixes (post-first-test)
| Fix | File | Detail |
|-----|------|--------|
| P0-1 — Report self-caging | `detectors.ts` | MEETING_PARTICIPANT requires 2+ words before colon |
| P0-2 — sk-test/ant/AIza/ghp_ not caged | `detectors.ts` | Added all modern API key patterns + French password |
| P0-3 — RIB broken as PHONE+SEJOUR | `detectors.ts` | RIB/IBAN ordered before PHONE in ALL_DETECTORS |
| P0-4 — Label "Passeport" caged | `detectors.ts` | personName pattern3 negative lookahead before `:` |
| P0-5 — Dedup 24+24, transcript false+, greeting, plurals | `background.ts`, `auditLog.ts` | 5s+fingerprint dedup, dedupedCageEvents, firstName, pl() |

### C Fixes (stability)
| Fix | File | Detail |
|-----|------|--------|
| C1 — sanitiseDetail | `auditLog.ts` | Strips CAGED tokens from detail field |
| C2 — dedup double-count | `background.ts` | 5s window + entity type fingerprint |
| C3 — Shadow AI spam | `background.ts` | 5-minute cooldown per hostname |
| C4 — SW restart spam | `background.ts` | EXTENSION_STARTED only on onInstalled |

### R Fixes (post-test-1)
| Fix | Detail |
|-----|--------|
| R1 — RIB 12-digit block | Added pattern for 2+3+12+2 format |
| R2 — ghp_ min length | Reduced from 36 to 20 chars |
| R3 — AIzaSyA no boundary | Pattern works after space/colon |
| R4 — mot de passe [qualifier] | Accepts words between "passe" and colon |
| R5 — Nom du client label | Captures up to 5 words after label |
| R6 — Test/Validation exclusion | PARTICIPANT and personName exclusion lists |
| R7 — ENTITY_LABELS plurals | Fixed labels: "Tunisian passport" not "passport tn" |

### S Fixes (post-test-2)
| Fix | Detail |
|-----|--------|
| S1 — Phone no-RIB overlap | Phone pattern 2 uses negative lookbehind `(?<!\d)` |
| S2 — Clé Google as PARTICIPANT | meetingParticipant excludes known label pairs |
| S3 — Nom du client space-before-colon | `\s*[:\-]\s*` confirmed working |

### T Fixes (post-test-3)
| Fix | Detail |
|-----|--------|
| T1 — RIB 5-block | Pattern `\d{2}[\s]\d{3}[\s]\d{3}[\s]\d{12}[\s]\d{2}` |
| T2+T3 — Ben Test as PARTICIPANT | PARTICIPANT excludes `Test`, `Validation`, `Demo` as 2nd word |

### New Features (v0.6.0)
| Feature | Files |
|---------|-------|
| Plain-language report Free/Pro | `auditLog.ts`, `background.ts`, `popup.ts`, `main.ts` |
| SESSION_SALT Ephemeral Tokens™ | `cage.ts` |
| Inference Cage™ (detectQuasiIdentifiers) | `cage.ts`, `content.ts`, `popup.ts`, `main.ts` |
| Landing: AI Secrets section | `landing/index.html` |
| Landing: competitive table | `landing/index.html` |
| install.html: 16 PII + InferenceRisk FAQ | `landing/install.html` |
| success.html: Pro features banner | `landing/success.html` |

---

## 9. Mobile Strategy

| Platform | Status |
|----------|--------|
| Desktop browser (Chrome/Edge/Firefox) | ✅ LIVE |
| Desktop app (Windows) | ✅ LIVE |
| Mobile browser | ⚠️ "Mobile coming soon" banner on landing |
| Mobile app (iOS/Android) | 🔜 v0.7.0 |

---

## 10. Payment & Activation Flow

| Step | Status |
|------|--------|
| Stripe Payment Link (test mode) | ✅ Active |
| success.html — Pro features banner + activation steps | ✅ Updated |
| `tools/generate-key.html` — Manual key generator | ✅ Working |
| Email via `aicage.support@gmail.com` | ✅ Working |
| Zapier auto-license | ⚠️ Configured, email field fix needed |
| Stripe Production mode | 🔜 Before first real client |

---

## 11. v0.7.0 Roadmap

| Priority | Feature | Effort |
|----------|---------|--------|
| P1 | Chrome Web Store submission | 1 day |
| P1 | Stripe Live mode | 30 min |
| P1 | Zapier: fix customer_email field | 30 min |
| P2 | Phase 2: delay/noise/UA rotation (Behavioral Noise) | 2 days |
| P2 | Cage 4: VS Code extension (Code Leak) | 1 week |
| P2 | Mobile app (React Native) | 4 weeks |
| P2 | Plain Report PDF export (Pro) | 1 day |
| P3 | i18n FR/AR for extension popup | 4h |
| P3 | ed25519 license signing (replace djb2) | v0.8.0 |
