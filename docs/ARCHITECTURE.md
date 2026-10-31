# AI CAGE — Architecture

> **Core Principle:** PII never leaves the user's machine. Caging happens before the network. Uncaging happens after.

---

## High-Level Data Flow

```mermaid
flowchart LR
    subgraph USER["👤 User Device (100% Local)"]
        direction TB
        U[User types prompt] --> CAGE

        subgraph CAGE["🔒 AI CAGE Layer"]
            direction TB
            SCAN["presidio-lite\nscanText()"]
            CORE["@ai-cage/core\ncageText()"]
            SCAN --> CORE
        end

        CORE -->|"Caged text\n[CAGED_EMAIL_1]…"| SEND
        SEND["HTTP Request\n(sanitised only)"]

        RESP["AI Response\n(with placeholders)"] --> UNCAGE
        subgraph UNCAGE["🔓 Restore Layer"]
            UNDO["@ai-cage/core\nuncageText()"]
        end
        UNCAGE -->|"Restored text\nalice@example.com…"| DISPLAY["User sees\nfull response"]
    end

    subgraph MONSTER["☁️ Monster AI (External)"]
        GPT["ChatGPT / Claude\nGemini / Copilot"]
    end

    SEND -->|"❌ PII never crosses this line"| GPT
    GPT --> RESP

    style CAGE fill:#15803d,color:#fff,stroke:#15803d
    style UNCAGE fill:#0369a1,color:#fff,stroke:#0369a1
    style MONSTER fill:#991b1b,color:#fff,stroke:#991b1b
    style USER fill:#f0fdf4,stroke:#16a34a
```

---

## Component Map

```mermaid
graph TD
    subgraph MONO["ai-cage monorepo"]
        subgraph PKGS["packages/"]
            PL["@ai-cage/presidio-lite\n─────────────────\nRegex PII detectors\nTypes: EMAIL, IBAN, CIN_TN\nRIB_TN, CARD, APIKEY…\nZero dependencies"]
            CORE["@ai-cage/core\n─────────────────\ncageText()\nuncageText()\nsummariseCaged()\nDepends on presidio-lite"]
        end
        subgraph APPS["apps/"]
            EXT["@ai-cage/extension\n─────────────────\nChrome MV3\nbackground.ts\ncontent.ts\npopup.ts"]
            DESK["@ai-cage/desktop\n─────────────────\nTauri 1.6\nRust backend\nTypeScript UI"]
        end
    end

    PL --> CORE
    CORE --> EXT
    CORE --> DESK
```

---

## Package Responsibilities

| Package | Language | Role | Network? |
|---------|----------|------|----------|
| `@ai-cage/presidio-lite` | TypeScript | Regex PII pattern library | ❌ Never |
| `@ai-cage/core` | TypeScript | `cageText` / `uncageText` API | ❌ Never |
| `@ai-cage/extension` | TS + Chrome APIs | MV3 content/background scripts | ❌ Never¹ |
| `@ai-cage/desktop` | Rust + TypeScript | Tauri native desktop app | ❌ Never² |

> ¹ The extension intercepts network traffic but does NOT initiate any itself.
> ² `tauri::api::http` is explicitly disabled in `Cargo.toml` and `tauri.conf.json`.

---

## Extension Runtime Architecture (MV3)

```mermaid
sequenceDiagram
    actor User
    participant Page as AI Chat Page
    participant CS as content.ts<br/>(Content Script)
    participant BG as background.ts<br/>(Service Worker)
    participant AI as Monster AI API

    User->>Page: Types prompt with PII
    Page->>CS: keydown Enter / button click
    CS->>CS: cageText() — local, offline
    Note over CS: PII replaced with [CAGED_X]
    CS->>BG: chrome.runtime.sendMessage<br/>CAGE_REPORT (summary only)
    BG->>BG: updateBadge(count)
    CS->>Page: Write caged text back to input
    Page->>AI: HTTP POST (caged text only ✅)
    AI->>Page: Response with [CAGED_X] tokens
    CS->>CS: uncageText() — local restore
    CS->>User: Full response with original values
```

---

## Cage Architecture — 7 Threat Surfaces

AI CAGE is designed around 7 threat surfaces ("cages"). V1 implements **Cage 1**.

| # | Cage Name | V1 Status | Description |
|---|-----------|-----------|-------------|
| 1 | **Chat Leak** | ✅ Implemented | PII in prompts sent to AI chat interfaces |
| 2 | Shadow AI | 🔜 Planned | Employees using unapproved AI tools |
| 3 | Agent Rogue | 🔜 Planned | AI agents with tool-use accessing internal systems |
| 4 | Code Leak | 🔜 Planned | Source code + secrets pasted into AI code assistants |
| 5 | Voice/Video | 🔜 Planned | Transcripts and meeting summaries sent to AI |
| 6 | Credential Hijack | 🔜 Planned | API keys / passwords in AI context windows |
| 7 | Compliance | 🔜 Planned | GDPR/HIPAA/SOC2 audit trail generation |

---

## Design Decisions

### Why regex and not an ML model?

- **Offline-first**: No model download, no inference server, zero latency on first use.
- **Auditable**: Every detection rule is a readable regex in `detectors.ts`. Security engineers can review without an ML background.
- **Deterministic**: Same input → same output. Reproducible in court/audit.
- **Zero cost**: No GPU, no cloud, no subscription.

ML-based NER (e.g. a WASM ONNX model) is planned for V2 for higher recall on unstructured names and addresses.

### Why Tauri and not Electron?

- ~10× smaller binary (no bundled Chromium).
- Rust backend = memory-safe, no Node.js attack surface.
- `tauri::api::http` is explicitly disabled — the Rust process literally cannot make HTTP calls.

### Why MV3 and not MV2?

- MV3 is the only supported extension model going forward in Chrome.
- Service workers (not persistent background pages) reduce memory footprint.
- `declarativeNetRequest` (future) is more privacy-preserving than `webRequest`.
