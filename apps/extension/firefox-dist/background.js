(function() {
  "use strict";
  function summariseCaged(entities) {
    return entities.map(({ placeholder, type, score }) => ({
      placeholder,
      type,
      score
    }));
  }
  const OPENAI = {
    id: "openai",
    name: "OpenAI (ChatGPT / GPT-4)",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.openai\.com\/v\d+\/(chat\/completions|completions|assistants|threads)/,
      /api\.openai\.com/,
      /chat\.openai\.com\/backend-api/,
      /chatgpt\.com\/backend-api/
    ]
  };
  const ANTHROPIC = {
    id: "anthropic",
    name: "Anthropic Claude",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.anthropic\.com\/v\d+\/messages/,
      /api\.anthropic\.com/,
      /claude\.ai\/api/
    ]
  };
  const GOOGLE_GEMINI = {
    id: "google-gemini",
    name: "Google Gemini / PaLM",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /generativelanguage\.googleapis\.com/,
      /gemini\.google\.com\/app\/api/,
      /us-central1-aiplatform\.googleapis\.com/,
      /aiplatform\.googleapis\.com\/v\d+\/projects/
    ]
  };
  const MICROSOFT_COPILOT = {
    id: "ms-copilot",
    name: "Microsoft Copilot / Azure OpenAI",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /copilot\.microsoft\.com\/api/,
      /sydney\.bing\.com\/sydney\/ChatHub/,
      /openai\.azure\.com\/openai\/deployments/,
      /\.openai\.azure\.com/
    ]
  };
  const COHERE = {
    id: "cohere",
    name: "Cohere",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.cohere\.ai\/v\d+\/(generate|chat|summarize)/,
      /api\.cohere\.ai/
    ]
  };
  const MISTRAL = {
    id: "mistral",
    name: "Mistral AI",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.mistral\.ai\/v\d+\/(chat\/completions|completions)/,
      /api\.mistral\.ai/
    ]
  };
  const GROQ = {
    id: "groq",
    name: "Groq",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.groq\.com\/openai\/v\d+/,
      /api\.groq\.com/
    ]
  };
  const PERPLEXITY = {
    id: "perplexity",
    name: "Perplexity AI",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.perplexity\.ai\/chat\/completions/,
      /www\.perplexity\.ai\/socket\.io/,
      /perplexity\.ai\/api/
    ]
  };
  const TOGETHER_AI = {
    id: "together-ai",
    name: "Together AI",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.together\.xyz\/v\d+\/completions/,
      /api\.together\.ai/
    ]
  };
  const REPLICATE = {
    id: "replicate",
    name: "Replicate",
    category: "llm-api",
    riskLevel: "critical",
    patterns: [
      /api\.replicate\.com\/v\d+\/predictions/
    ]
  };
  const GITHUB_COPILOT = {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "dev-tool",
    riskLevel: "critical",
    patterns: [
      /copilot-proxy\.githubusercontent\.com/,
      /api\.githubcopilot\.com/,
      /githubcopilot\.com/
    ]
  };
  const CURSOR = {
    id: "cursor",
    name: "Cursor AI",
    category: "dev-tool",
    riskLevel: "critical",
    patterns: [
      /api2\.cursor\.sh/,
      /\.cursor\.sh\/api/,
      /cursor\.sh\/api/
    ]
  };
  const CODEIUM = {
    id: "codeium",
    name: "Codeium",
    category: "dev-tool",
    riskLevel: "high",
    patterns: [
      /server\.codeium\.com/,
      /web-backend\.codeium\.com/
    ]
  };
  const TABNINE = {
    id: "tabnine",
    name: "Tabnine",
    category: "dev-tool",
    riskLevel: "high",
    patterns: [
      /api\.tabnine\.com/,
      /\.tabnine\.com\/api/
    ]
  };
  const NOTION_AI = {
    id: "notion-ai",
    name: "Notion AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /notion\.so\/api\/v3\/runInferenceModel/,
      /notion\.so\/api\/v3\/getCompletion/,
      /api\.notion\.com.*ai/i
    ]
  };
  const SLACK_AI = {
    id: "slack-ai",
    name: "Slack AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /slack\.com\/api\/assistant\./,
      /slack\.com\/api\/ai\./,
      /slack\.com\/api\/canvases\.ai/
    ]
  };
  const HUBSPOT_AI = {
    id: "hubspot-ai",
    name: "HubSpot AI (Content Assistant)",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api\.hubapi\.com\/ai/i,
      /app\.hubspot\.com\/api.*copilot/i
    ]
  };
  const SALESFORCE_EINSTEIN = {
    id: "salesforce-einstein",
    name: "Salesforce Einstein AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /\.salesforce\.com\/services\/data.*einstein/i,
      /einstein\.salesforce\.com/,
      /api\.salesforce\.com\/einstein/i
    ]
  };
  const ZENDESK_AI = {
    id: "zendesk-ai",
    name: "Zendesk AI (Intelligent Triage)",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /\.zendesk\.com\/api\/v2\/macros\/suggest/,
      /\.zendesk\.com\/api.*ai/i,
      /zendesk\.com\/api\/v2\/tickets.*intelligent/i
    ]
  };
  const INTERCOM_AI = {
    id: "intercom-ai",
    name: "Intercom Fin AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api-iam\.intercom\.io.*fin/i,
      /api\.intercom\.io\/ai/i,
      /api\.intercom\.io\/conversations.*ai/i
    ]
  };
  const GRAMMARLY = {
    id: "grammarly",
    name: "Grammarly",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /capi\.grammarly\.com/,
      /extension-api\.grammarly\.com/,
      /\.grammarly\.com\/api/
    ]
  };
  const JASPER_AI = {
    id: "jasper-ai",
    name: "Jasper AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api\.jasper\.ai/,
      /app\.jasper\.ai\/api/
    ]
  };
  const COPY_AI = {
    id: "copy-ai",
    name: "Copy.ai",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /api\.copy\.ai/,
      /app\.copy\.ai\/api/
    ]
  };
  const WRITESONIC = {
    id: "writesonic",
    name: "Writesonic",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /api\.writesonic\.com/
    ]
  };
  const ZAPIER_AI = {
    id: "zapier-ai",
    name: "Zapier AI (Copilot)",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api\.zapier\.com.*ai/i,
      /zapier\.com\/api.*copilot/i
    ]
  };
  const MAKE_AI = {
    id: "make-ai",
    name: "Make (Integromat) AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api\.make\.com.*ai/i,
      /eu1\.make\.com.*ai/i
    ]
  };
  const MONDAY_AI = {
    id: "monday-ai",
    name: "Monday.com AI",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /api\.monday\.com.*ai/i,
      /auth\.monday\.com.*ai/i
    ]
  };
  const CLICKUP_AI = {
    id: "clickup-ai",
    name: "ClickUp AI",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /api\.clickup\.com.*ai/i,
      /app\.clickup\.com\/api.*ai/i
    ]
  };
  const JIRA_AI = {
    id: "jira-ai",
    name: "Jira / Atlassian Intelligence",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /api\.atlassian\.com.*intelligence/i,
      /\.atlassian\.net\/gateway\/api\/assist/i
    ]
  };
  const CONFLUENCE_AI = {
    id: "confluence-ai",
    name: "Confluence AI",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /\.atlassian\.net\/wiki\/api.*ai/i,
      /api\.atlassian\.com.*confluence.*ai/i
    ]
  };
  const GOOGLE_WORKSPACE_AI = {
    id: "google-workspace-ai",
    name: "Google Workspace AI (Duet)",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /docs\.googleapis\.com.*ai/i,
      /workspaceevents\.googleapis\.com/,
      /cloudaicompanion\.googleapis\.com/
    ]
  };
  const MICROSOFT_365_AI = {
    id: "ms365-copilot",
    name: "Microsoft 365 Copilot",
    category: "saas-embedded",
    riskLevel: "critical",
    patterns: [
      /substrate\.office\.com.*copilot/i,
      /api\.office\.com.*copilot/i,
      /graph\.microsoft\.com.*copilot/i
    ]
  };
  const ADOBE_FIREFLY = {
    id: "adobe-firefly",
    name: "Adobe Firefly / Sensei",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /firefly-api\.adobe\.io/,
      /sensei\.adobe\.io/,
      /stock\.adobe\.io.*ai/i
    ]
  };
  const CANVA_AI = {
    id: "canva-ai",
    name: "Canva Magic AI",
    category: "saas-embedded",
    riskLevel: "medium",
    patterns: [
      /api\.canva\.com.*ai/i,
      /canva\.com\/api.*magic/i
    ]
  };
  const LANGCHAIN_SMITH = {
    id: "langsmith",
    name: "LangSmith (LangChain)",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /api\.smith\.langchain\.com/,
      /eu\.api\.smith\.langchain\.com/
    ]
  };
  const HELICONE = {
    id: "helicone",
    name: "Helicone AI Proxy",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /oai\.hconeai\.com/,
      /api\.helicone\.ai/
    ]
  };
  const PORTKEY_AI = {
    id: "portkey",
    name: "Portkey AI Gateway",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /api\.portkey\.ai/,
      /portkey\.ai\/api/
    ]
  };
  const OPENROUTER = {
    id: "openrouter",
    name: "OpenRouter",
    category: "infra",
    riskLevel: "critical",
    patterns: [
      /openrouter\.ai\/api/,
      /api\.openrouter\.ai/
    ]
  };
  const HUGGINGFACE = {
    id: "huggingface",
    name: "Hugging Face Inference API",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /api-inference\.huggingface\.co/,
      /huggingface\.co\/api\/inference/i
    ]
  };
  const AWS_BEDROCK = {
    id: "aws-bedrock",
    name: "AWS Bedrock",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /bedrock(-runtime)?\.[\w-]+\.amazonaws\.com/,
      /bedrock\.amazonaws\.com/
    ]
  };
  const AZURE_AI_STUDIO = {
    id: "azure-ai-studio",
    name: "Azure AI Studio",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /\.inference\.ml\.azure\.com/,
      /\.api\.cognitive\.microsoft\.com/,
      /language\.cognitive\.azure\.com/
    ]
  };
  const VERTEX_AI = {
    id: "vertex-ai",
    name: "Google Vertex AI",
    category: "infra",
    riskLevel: "high",
    patterns: [
      /us-central1-aiplatform\.googleapis\.com/,
      /[\w-]+-aiplatform\.googleapis\.com/,
      /vertexai\.googleapis\.com/
    ]
  };
  const OTTER_AI = {
    id: "otter-ai",
    name: "Otter.ai",
    category: "saas-embedded",
    riskLevel: "critical",
    patterns: [
      /otter\.ai\/api\//i,
      /api\.otter\.ai/i,
      /otter\.ai\/v\d+\//i
    ]
  };
  const FIREFLIES_AI = {
    id: "fireflies-ai",
    name: "Fireflies.ai",
    category: "saas-embedded",
    riskLevel: "critical",
    patterns: [
      /fireflies\.ai\/api\//i,
      /api\.fireflies\.ai/i
    ]
  };
  const READ_AI = {
    id: "read-ai",
    name: "Read.ai",
    category: "saas-embedded",
    riskLevel: "critical",
    patterns: [
      /read\.ai\/api\//i,
      /api\.read\.ai/i
    ]
  };
  const TLDV_IO = {
    id: "tldv",
    name: "tl;dv",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /tldv\.io\/api\//i,
      /api\.tldv\.io/i
    ]
  };
  const FATHOM_VIDEO = {
    id: "fathom",
    name: "Fathom",
    category: "saas-embedded",
    riskLevel: "high",
    patterns: [
      /fathom\.video\/api\//i,
      /api\.fathom\.video/i
    ]
  };
  const ALL_AI_ENDPOINTS = [
    // Critical — Direct LLM APIs
    OPENAI,
    ANTHROPIC,
    GOOGLE_GEMINI,
    MICROSOFT_COPILOT,
    COHERE,
    MISTRAL,
    GROQ,
    PERPLEXITY,
    TOGETHER_AI,
    REPLICATE,
    // Developer tools
    GITHUB_COPILOT,
    CURSOR,
    CODEIUM,
    TABNINE,
    // SaaS embedded AI
    NOTION_AI,
    SLACK_AI,
    HUBSPOT_AI,
    SALESFORCE_EINSTEIN,
    ZENDESK_AI,
    INTERCOM_AI,
    GRAMMARLY,
    JASPER_AI,
    COPY_AI,
    WRITESONIC,
    ZAPIER_AI,
    MAKE_AI,
    MONDAY_AI,
    CLICKUP_AI,
    JIRA_AI,
    CONFLUENCE_AI,
    GOOGLE_WORKSPACE_AI,
    MICROSOFT_365_AI,
    ADOBE_FIREFLY,
    CANVA_AI,
    // Infrastructure
    LANGCHAIN_SMITH,
    HELICONE,
    PORTKEY_AI,
    OPENROUTER,
    HUGGINGFACE,
    AWS_BEDROCK,
    AZURE_AI_STUDIO,
    VERTEX_AI,
    // AI Meeting / Transcription (Cage 5)
    OTTER_AI,
    FIREFLIES_AI,
    READ_AI,
    TLDV_IO,
    FATHOM_VIDEO
  ];
  function matchAiEndpoint(url) {
    return ALL_AI_ENDPOINTS.filter(
      (endpoint) => endpoint.patterns.some((pattern) => pattern.test(url))
    );
  }
  const LOG_KEY = "ai-cage:audit-log";
  const COUNTER_KEY = "ai-cage:audit-id-counter";
  async function logEvent(event, storage) {
    const [rawLog, rawCounter] = await Promise.all([
      storage.getItem(LOG_KEY),
      storage.getItem(COUNTER_KEY)
    ]);
    const log = rawLog ? JSON.parse(rawLog) : { entries: [], version: 1 };
    const id = rawCounter ? parseInt(rawCounter, 10) + 1 : 1;
    const entry = {
      id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...event
    };
    log.entries.push(entry);
    await Promise.all([
      storage.setItem(LOG_KEY, JSON.stringify(log)),
      storage.setItem(COUNTER_KEY, String(id))
    ]);
    return entry;
  }
  async function getAuditLog(storage) {
    const raw = await storage.getItem(LOG_KEY);
    if (!raw) return [];
    const log = JSON.parse(raw);
    return log.entries ?? [];
  }
  async function getAuditSummary(storage, fromDate, toDate) {
    const entries = await getAuditLog(storage);
    const from = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1);
    const to = /* @__PURE__ */ new Date();
    const inRange = entries.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= from && t <= to;
    });
    let totalCaged = 0;
    let totalShadowAi = 0;
    const siteMap = /* @__PURE__ */ new Map();
    const byType = {};
    for (const e of inRange) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.type === "PII_CAGED") {
        totalCaged += e.totalCount;
      }
      if (e.type === "SHADOW_AI_DETECTED") {
        totalShadowAi += e.totalCount;
      }
      siteMap.set(e.site, (siteMap.get(e.site) ?? 0) + e.totalCount);
    }
    const topSites = [...siteMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([site, count]) => ({ site, count }));
    return { totalCaged, totalShadowAi, topSites, byType };
  }
  async function exportAuditLogCSV(storage) {
    const entries = await getAuditLog(storage);
    if (entries.length === 0) return "";
    const allCountKeys = /* @__PURE__ */ new Set();
    for (const e of entries) {
      for (const k of Object.keys(e.counts)) {
        allCountKeys.add(k);
      }
    }
    const countCols = [...allCountKeys].sort();
    const header = [
      "id",
      "timestamp",
      "type",
      "site",
      "totalCount",
      "detail",
      ...countCols
    ].join(",");
    const rows = entries.map((e) => {
      const base = [
        e.id,
        `"${e.timestamp}"`,
        e.type,
        `"${e.site}"`,
        e.totalCount,
        `"${(e.detail ?? "").replace(/"/g, '""')}"`
      ];
      const counts = countCols.map((k) => e.counts[k] ?? 0);
      return [...base, ...counts].join(",");
    });
    return [header, ...rows].join("\n");
  }
  const ENTITY_LABELS = {
    // Email
    EMAIL_ADDRESS: "email address",
    EMAIL: "email address",
    // Phone
    PHONE_NUMBER: "phone number",
    PHONE: "phone number",
    PHONE_TN: "phone number",
    // Person / name
    PERSON: "personal name",
    PERSON_NAME: "personal name",
    // Financial
    CREDIT_CARD: "credit card number",
    CREDIT_CARD_NUMBER: "credit card number",
    IBAN_CODE: "bank account / IBAN",
    IBAN: "bank account / IBAN",
    US_BANK_NUMBER: "bank account number",
    // Identity documents
    NRP: "national ID number",
    CIN_TN: "national ID (Tunisia)",
    PASSPORT: "passport number",
    PASSPORT_NUMBER: "passport number",
    DRIVER_LICENSE: "driver's licence",
    US_DRIVER_LICENSE: "driver's licence",
    // Address / location
    LOCATION: "postal address",
    ADDRESS: "postal address",
    POSTAL_ADDRESS: "postal address",
    ZIP_CODE: "postal code",
    // Digital identifiers
    IP_ADDRESS: "IP address",
    URL: "web address (URL)",
    // Credentials
    PASSWORD: "password / secret key",
    API_KEY: "API key / secret",
    // Medical
    MEDICAL_LICENSE: "medical licence number",
    US_ITIN: "tax ID number",
    US_SSN: "social security number",
    AU_TFN: "tax file number",
    AU_ACN: "company number",
    // Organisation
    ORGANIZATION: "organisation name",
    ORG: "organisation name",
    // Date
    DATE_TIME: "date / time",
    AGE: "age"
  };
  const SITE_FRIENDLY = {
    "chat.openai.com": "ChatGPT",
    "chatgpt.com": "ChatGPT",
    "api.openai.com": "OpenAI API",
    "gemini.google.com": "Google Gemini",
    "bard.google.com": "Google Gemini",
    "claude.ai": "Anthropic Claude",
    "api.anthropic.com": "Anthropic Claude",
    "copilot.microsoft.com": "Microsoft Copilot",
    "bing.com": "Microsoft Copilot",
    "mistral.ai": "Mistral AI",
    "api.mistral.ai": "Mistral AI",
    "meta.ai": "Meta AI",
    "ai.meta.com": "Meta AI",
    "huggingface.co": "Hugging Face",
    "api.cohere.ai": "Cohere",
    "generativelanguage.googleapis.com": "Google Gemini API",
    "qwen.aliyun.com": "Qwen (Alibaba)",
    "dashscope.aliyuncs.com": "Qwen API",
    "perplexity.ai": "Perplexity AI",
    "you.com": "You.com AI",
    "poe.com": "Poe AI",
    "character.ai": "Character.AI",
    "grok.x.ai": "Grok (xAI)",
    "api.x.ai": "Grok API",
    "background": "browser background"
  };
  function friendlySite(site) {
    if (SITE_FRIENDLY[site]) return SITE_FRIENDLY[site];
    const clean = site.replace(/^www\./, "");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  function friendlyDate(iso) {
    try {
      const d = new Date(iso);
      const day = d.getDate();
      const month = d.toLocaleString("en-GB", { month: "long" });
      const year = d.getFullYear();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${year} at ${h}:${m}`;
    } catch {
      return iso;
    }
  }
  function shortDate(iso) {
    try {
      const d = new Date(iso);
      return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "long" })}`;
    } catch {
      return iso;
    }
  }
  function pl(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }
  async function generatePlainReport(storage, options = {}, fromDate, toDate) {
    const entries = await getAuditLog(storage);
    const from = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1);
    const to = /* @__PURE__ */ new Date();
    const { customerName = "there", isPro = false } = options;
    const inRange = entries.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= from && t <= to;
    });
    const cageEvents = inRange.filter((e) => e.type === "PII_CAGED");
    const shadowEvents = inRange.filter((e) => e.type === "SHADOW_AI_DETECTED");
    const entityCounts = /* @__PURE__ */ new Map();
    for (const e of cageEvents) {
      for (const [k, v] of Object.entries(e.counts)) {
        entityCounts.set(k, (entityCounts.get(k) ?? 0) + (v ?? 0));
      }
    }
    const totalProtected = cageEvents.reduce((s, e) => s + e.totalCount, 0);
    const totalShadowAi = shadowEvents.reduce((s, e) => s + e.totalCount, 0);
    const siteSet = /* @__PURE__ */ new Set();
    for (const e of cageEvents) siteSet.add(e.site);
    for (const e of shadowEvents) siteSet.add(e.site);
    const uniqueSites = siteSet.size;
    const fromLabel = shortDate(from.toISOString());
    const toLabel = shortDate(to.toISOString());
    const daysCount = Math.max(1, Math.round((to.getTime() - from.getTime()) / 864e5));
    const sortedEntities = [...entityCounts.entries()].sort((a, b) => b[1] - a[1]);
    const entityLines = sortedEntities.filter(([, v]) => v > 0).map(([k, v]) => {
      const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, " ");
      return `  - ${pl(v, label)}`;
    }).join("\n");
    const siteCounts = /* @__PURE__ */ new Map();
    for (const e of cageEvents) {
      siteCounts.set(e.site, (siteCounts.get(e.site) ?? 0) + e.totalCount);
    }
    const siteList = [...siteCounts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => friendlySite(s));
    const siteLabel = siteList.length === 0 ? "no AI tools yet" : siteList.length === 1 ? siteList[0] : siteList.slice(0, -1).join(", ") + " and " + siteList.at(-1);
    const peakEvent = cageEvents.reduce(
      (best, e) => !best || e.totalCount > best.totalCount ? e : best,
      null
    );
    const shadowSiteSet = new Set(shadowEvents.map((e) => friendlySite(e.site)));
    const shadowLabel = [...shadowSiteSet].join(", ");
    const lines = [];
    lines.push("=".repeat(60));
    lines.push("AI CAGE — Protection Report");
    lines.push(`Period: ${fromLabel} to ${toLabel}`);
    if (isPro) {
      lines.push("Plan: Pro — Full Report");
    } else {
      lines.push("Plan: Free — Summary Report");
      lines.push("Upgrade to Pro for the full event-by-event breakdown.");
    }
    lines.push("=".repeat(60));
    lines.push("");
    lines.push(`Hello ${customerName},`);
    lines.push("");
    lines.push(
      `Here is your AI CAGE protection report covering the last ${pl(daysCount, "day")}.`
    );
    lines.push("");
    lines.push("--- SUMMARY ---");
    lines.push("");
    if (totalProtected === 0 && totalShadowAi === 0) {
      lines.push("No activity recorded during this period.");
      lines.push("");
      lines.push(
        "AI CAGE is active and monitoring. As soon as you paste sensitive"
      );
      lines.push("data into an AI tool, it will be protected automatically.");
    } else {
      if (totalProtected > 0) {
        lines.push(
          `You almost shared ${pl(totalProtected, "sensitive piece of data")} with AI tools.`
        );
        lines.push(`AI CAGE protected all of them before they were sent.`);
        lines.push(`None of your real data ever left your device.`);
      }
      if (totalShadowAi > 0) {
        lines.push("");
        lines.push(
          `In addition, AI CAGE detected ${pl(totalShadowAi, "hidden AI call")} that happened in your browser without you typing anything.`
        );
        if (shadowLabel) {
          lines.push(`These came from: ${shadowLabel}.`);
        }
      }
    }
    lines.push("");
    if (siteList.length > 0) {
      lines.push("--- AI TOOLS USED ---");
      lines.push("");
      if (siteList.length === 1) {
        lines.push(`During this period you used 1 AI tool: ${siteList[0]}.`);
      } else {
        lines.push(
          `During this period you used ${pl(siteList.length, "different AI tool")}: ${siteLabel}.`
        );
      }
      lines.push("");
    }
    if (entityLines) {
      lines.push("--- WHAT WAS PROTECTED ---");
      lines.push("");
      lines.push(
        "Here is the breakdown of sensitive data that AI CAGE intercepted:"
      );
      lines.push("");
      lines.push(entityLines);
      lines.push("");
      lines.push(
        "Each of these items was replaced by a code before reaching the AI."
      );
      lines.push(
        "The AI saw codes like [EMAIL_1] or [PERSON_1] — never your real data."
      );
      lines.push("");
    }
    if (peakEvent) {
      lines.push("--- MOST IMPORTANT MOMENT ---");
      lines.push("");
      if (isPro) {
        const when = friendlyDate(peakEvent.timestamp);
        const where = friendlySite(peakEvent.site);
        lines.push(
          `On ${when}, you pasted ${pl(peakEvent.totalCount, "sensitive item")} into ${where} in a single action.`
        );
        lines.push(
          `AI CAGE replaced all of them with protection codes instantly.`
        );
        lines.push(`${where} never received any of your real data.`);
        const peakEntityLines = Object.entries(peakEvent.counts).filter(([, v]) => (v ?? 0) > 0).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0)).map(([k, v]) => {
          const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, " ");
          return `  - ${pl(v ?? 0, label)}`;
        }).join("\n");
        if (peakEntityLines) {
          lines.push("");
          lines.push("In that single event:");
          lines.push(peakEntityLines);
        }
      } else {
        const where = friendlySite(peakEvent.site);
        lines.push(
          `Your most critical moment involved ${pl(peakEvent.totalCount, "sensitive item")} sent to ${where}.`
        );
        lines.push("");
        lines.push(
          "[Full event breakdown available with AI CAGE Pro]"
        );
        lines.push(
          "Pro gives you the exact date, time, and type of each protected item."
        );
      }
      lines.push("");
    }
    if (isPro && cageEvents.length > 0) {
      lines.push("--- FULL EVENT LOG ---");
      lines.push("");
      lines.push(
        "Below is every protection event during this period, in chronological order."
      );
      lines.push("");
      for (const e of cageEvents) {
        const when = friendlyDate(e.timestamp);
        const where = friendlySite(e.site);
        lines.push(`> ${when} — ${where}`);
        lines.push(`  ${pl(e.totalCount, "item")} protected.`);
        const detail = Object.entries(e.counts).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => {
          const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, " ");
          return `${v} ${label}`;
        }).join(", ");
        if (detail) lines.push(`  Types: ${detail}.`);
        lines.push("");
      }
    }
    if (shadowEvents.length > 0) {
      lines.push("--- HIDDEN AI ACTIVITY ---");
      lines.push("");
      if (isPro) {
        lines.push(
          `AI CAGE detected ${pl(shadowEvents.length, "hidden AI request")} that your browser sent without your direct input.`
        );
        lines.push(
          "These are calls made by website scripts, browser extensions, or"
        );
        lines.push("background services connecting to AI APIs silently.");
        lines.push("");
        const shadowSiteMap = /* @__PURE__ */ new Map();
        for (const e of shadowEvents) {
          shadowSiteMap.set(
            friendlySite(e.site),
            (shadowSiteMap.get(friendlySite(e.site)) ?? 0) + 1
          );
        }
        for (const [site, count] of [...shadowSiteMap.entries()].sort((a, b) => b[1] - a[1])) {
          lines.push(`  - ${site}: ${pl(count, "hidden call")}`);
        }
      } else {
        lines.push(
          `AI CAGE detected ${pl(shadowEvents.length, "hidden AI request")} in your browser.`
        );
        lines.push("[Full hidden AI report available with AI CAGE Pro]");
      }
      lines.push("");
    }
    lines.push("--- CONCLUSION ---");
    lines.push("");
    if (totalProtected === 0 && totalShadowAi === 0) {
      lines.push("Nothing to report. AI CAGE is watching and ready.");
    } else if (totalProtected > 0) {
      lines.push("No data leak. Your sensitive data never left your device.");
      lines.push(
        `AI CAGE protected ${pl(totalProtected, "item")} during this period.`
      );
      lines.push("Every real value was replaced before reaching any AI server.");
    } else {
      lines.push("No PII was sent to AI tools this period.");
      if (totalShadowAi > 0) {
        lines.push(
          `However, ${pl(totalShadowAi, "hidden AI call")} was detected.`
        );
        lines.push("Consider reviewing the AI tools installed in your browser.");
      }
    }
    lines.push("");
    lines.push("Your AI protection assistant,");
    lines.push("AI CAGE");
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("Generated locally on your device — zero data sent to any server.");
    lines.push(`Report generated: ${friendlyDate((/* @__PURE__ */ new Date()).toISOString())}`);
    if (!isPro) {
      lines.push("");
      lines.push(
        "Want the full report with event-by-event details? Upgrade to Pro."
      );
      lines.push("https://ai-cage-gamma.vercel.app/#pricing");
    }
    lines.push("=".repeat(60));
    return {
      text: lines.join("\n"),
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      totalProtected,
      totalShadowAi,
      uniqueSites
    };
  }
  const EMBEDDED_KEY = "ai-cage-verification-v1-7f3a9b2e8c1d4a6f";
  const FREE_FEATURES = {
    maxPiiTypes: 15,
    maxMonthlyCages: 100,
    customPolicy: false,
    auditExport: false,
    shadowAi: true,
    // Shadow AI detection is free — it's a safety feature
    agentCage: false,
    mcpMonitor: false,
    sso: false,
    siem: false,
    centralisedPolicy: false
  };
  const PRO_FEATURES = {
    maxPiiTypes: -1,
    // unlimited
    maxMonthlyCages: -1,
    customPolicy: true,
    auditExport: true,
    shadowAi: true,
    agentCage: true,
    mcpMonitor: true,
    sso: false,
    siem: false,
    centralisedPolicy: false
  };
  const ENTERPRISE_FEATURES = {
    maxPiiTypes: -1,
    maxMonthlyCages: -1,
    customPolicy: true,
    auditExport: true,
    shadowAi: true,
    agentCage: true,
    mcpMonitor: true,
    sso: true,
    siem: true,
    centralisedPolicy: true
  };
  function getTierFeatures(tier) {
    switch (tier) {
      case "FREE":
        return { ...FREE_FEATURES };
      case "PRO":
        return { ...PRO_FEATURES };
      case "ENTERPRISE":
        return { ...ENTERPRISE_FEATURES };
    }
  }
  function base64UrlDecode(str) {
    let s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return atobSafe(s);
  }
  function atobSafe(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = /* @__PURE__ */ new Map();
    for (let i = 0; i < chars.length; i++) {
      lookup.set(chars[i] ?? "", i);
    }
    let result = "";
    let buffer = 0;
    let bits = 0;
    for (const ch of str) {
      if (ch === "=") break;
      const val = lookup.get(ch);
      if (val === void 0) continue;
      buffer = buffer << 6 | val;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        result += String.fromCharCode(buffer >> bits & 255);
      }
    }
    return result;
  }
  function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function computeSignature(payloadB64) {
    return djb2Hash(payloadB64 + EMBEDDED_KEY);
  }
  function parseLicenseKey(key) {
    if (!key || !key.includes(".")) return null;
    const parts = key.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64Raw, sig] = parts;
    if (!payloadB64Raw || !sig) return null;
    const payloadB64 = payloadB64Raw;
    const expectedSig = computeSignature(payloadB64);
    if (sig !== expectedSig) return null;
    try {
      const json = base64UrlDecode(payloadB64);
      const payload = JSON.parse(json);
      if (!payload.tier || !payload.expiresAt || !payload.issuedAt) return null;
      return payload;
    } catch {
      return null;
    }
  }
  const LICENSE_KEY = "ai-cage:license-key";
  async function checkLicense(storage, monthlyCageCount) {
    const rawKey = await storage.getItem(LICENSE_KEY);
    if (!rawKey) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "NONE",
        tier: "FREE",
        payload: null,
        features: features2,
        message: "Free tier active — 100 cages/month limit",
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const payload = parseLicenseKey(rawKey);
    if (!payload) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "TAMPERED",
        tier: "FREE",
        payload: null,
        features: features2,
        message: "⚠️ License key is invalid or tampered — using free tier",
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const now = /* @__PURE__ */ new Date();
    const expires = new Date(payload.expiresAt);
    if (now > expires) {
      const features2 = getTierFeatures("FREE");
      return {
        status: "EXPIRED",
        tier: "FREE",
        payload,
        features: features2,
        message: `License expired on ${payload.expiresAt.slice(0, 10)} — using free tier`,
        monthlyCageCount,
        limitReached: monthlyCageCount >= features2.maxMonthlyCages
      };
    }
    const features = getTierFeatures(payload.tier);
    const limitReached = features.maxMonthlyCages > 0 && monthlyCageCount >= features.maxMonthlyCages;
    return {
      status: "VALID",
      tier: payload.tier,
      payload,
      features,
      message: `${payload.tier} license valid until ${payload.expiresAt.slice(0, 10)} — ${payload.customer}`,
      monthlyCageCount,
      limitReached
    };
  }
  const chromeStorageAdapter = {
    async getItem(key) {
      const result = await chrome.storage.local.get(key);
      const val = result[key];
      return typeof val === "string" ? val : null;
    },
    async setItem(key, value) {
      await chrome.storage.local.set({ [key]: value });
    }
  };
  let sessionCageCount = 0;
  let sessionShadowCount = 0;
  const tabCageCounts = /* @__PURE__ */ new Map();
  async function handleCageReport(msg, tabId) {
    const count = msg.entities.length;
    sessionCageCount += count;
    tabCageCounts.set(tabId, (tabCageCounts.get(tabId) ?? 0) + count);
    await updateBadge(tabId, tabCageCounts.get(tabId) ?? 0);
    const counts = {};
    for (const e of msg.entities) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    await logEvent(
      {
        type: "PII_CAGED",
        site: msg.site,
        counts,
        totalCount: count
      },
      chromeStorageAdapter
    );
    const summary = summariseCaged(msg.entities);
    console.warn(`[AI CAGE] 🔒 Caged ${count} item(s) on ${msg.site}:`, summary);
  }
  function registerShadowAiObserver() {
    if (!chrome.webRequest) {
      console.warn("[AI CAGE] webRequest API not available — Shadow AI detection disabled.");
      return;
    }
    try {
      chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
          var _a, _b, _c, _d;
          const url = details.url;
          const matches = matchAiEndpoint(url);
          if (matches.length === 0) return;
          sessionShadowCount += 1;
          const counts = {};
          for (const m of matches) counts[m.id] = (counts[m.id] ?? 0) + 1;
          const hostnameMatch = /^https?:\/\/([^/:?#]+)/i.exec(url);
          const hostname = (hostnameMatch == null ? void 0 : hostnameMatch[1]) ?? url;
          const initiator = details.initiator ?? "unknown";
          void logEvent(
            {
              type: "SHADOW_AI_DETECTED",
              site: hostname,
              counts,
              totalCount: matches.length,
              detail: `Initiator: ${initiator} | Risk: ${((_a = matches[0]) == null ? void 0 : _a.riskLevel) ?? "unknown"} | Product: ${((_b = matches[0]) == null ? void 0 : _b.name) ?? url}`
            },
            chromeStorageAdapter
          );
          console.warn(`[AI CAGE] ⚠️ Shadow AI: ${((_c = matches[0]) == null ? void 0 : _c.name) ?? url} (${((_d = matches[0]) == null ? void 0 : _d.riskLevel) ?? "unknown"})`);
          void updateGlobalBadge();
        },
        { urls: ["<all_urls>"] }
      );
      console.warn("[AI CAGE] Shadow AI observer registered (MV3 onBeforeRequest).");
    } catch (err) {
      console.warn("[AI CAGE] Shadow AI registration failed:", err);
    }
  }
  async function updateBadge(tabId, count) {
    const text = count > 0 ? String(count) : "";
    try {
      await chrome.action.setBadgeText({ tabId, text });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#16a34a" });
    } catch {
    }
  }
  async function updateGlobalBadge() {
    const total = sessionCageCount + sessionShadowCount;
    const text = total > 0 ? String(total) : "";
    try {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({
        color: sessionShadowCount > 0 ? "#dc2626" : "#16a34a"
      });
    } catch {
    }
  }
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      var _a;
      const msg = message;
      if (msg.type === "AGENT_EVENT") {
        const agentMsg = msg;
        void logEvent(
          {
            type: "AGENT_TOOL_CALL",
            site: agentMsg.site,
            counts: { blocked: agentMsg.blocked ? 1 : 0 },
            totalCount: 1,
            detail: agentMsg.detail
          },
          chromeStorageAdapter
        );
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === "CAGE_REPORT") {
        const tabId = ((_a = sender.tab) == null ? void 0 : _a.id) ?? msg.tabId;
        void handleCageReport(msg, tabId).then(() => {
          sendResponse({ ok: true, sessionTotal: sessionCageCount });
        });
        return true;
      }
      if (msg.type === "GET_STATS") {
        const tabId = msg.tabId ?? 0;
        void getAuditSummary(chromeStorageAdapter).then((summary) => {
          sendResponse({
            sessionCageCount,
            sessionShadowCount,
            tabCount: tabCageCounts.get(tabId) ?? 0,
            monthlyPiiCaged: summary.totalCaged,
            monthlyShadowAi: summary.totalShadowAi,
            topSites: summary.topSites
          });
        });
        return true;
      }
      if (msg.type === "GET_SHADOW_LOG") {
        void getAuditLog(chromeStorageAdapter).then((entries) => {
          const shadowEntries = entries.filter((e) => e.type === "SHADOW_AI_DETECTED").slice(-100);
          sendResponse({ entries: shadowEntries });
        });
        return true;
      }
      if (msg.type === "GET_AUDIT_LOG") {
        void getAuditLog(chromeStorageAdapter).then((entries) => {
          sendResponse({ entries: entries.slice(-200) });
        });
        return true;
      }
      if (msg.type === "EXPORT_AUDIT_CSV") {
        void exportAuditLogCSV(chromeStorageAdapter).then((csv) => {
          sendResponse({ csv });
        });
        return true;
      }
      if (msg.type === "GET_PLAIN_REPORT") {
        void checkLicense(chromeStorageAdapter, 0).then(async (licInfo) => {
          var _a2;
          const isPro = licInfo.tier === "PRO" || licInfo.tier === "ENTERPRISE";
          const customerName = ((_a2 = licInfo.payload) == null ? void 0 : _a2.customer) ?? "there";
          const result = await generatePlainReport(
            chromeStorageAdapter,
            { isPro, customerName }
          );
          sendResponse({ report: result.text, isPro });
        });
        return true;
      }
    }
  );
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabCageCounts.delete(tabId);
  });
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
      void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
    }
  });
  registerShadowAiObserver();
  void logEvent(
    {
      type: "EXTENSION_STARTED",
      site: "background",
      counts: {},
      totalCount: 0
    },
    chromeStorageAdapter
  );
  console.warn("[AI CAGE] Background service worker v0.6.0 — Cage 1+2+3 active.");
})();
