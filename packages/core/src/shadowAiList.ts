// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// https://github.com/smartsniper31/ai-cage
// Licensed under Business Source License 1.1 — see LICENSE for details.
// Commercial use requires a license: contact@ai-cage.io

/**
 * @file shadowAiList.ts
 * Catalogue of known AI endpoints and SaaS products that embed AI.
 *
 * SECURITY: This file contains ONLY patterns for outbound URL detection.
 * No network calls are ever made from this module.
 *
 * Categories:
 *   A — Direct AI LLM APIs
 *   B — Developer AI tools
 *   C — SaaS with embedded AI features
 *   D — AI infrastructure / orchestration
 */

/**
 * A single AI endpoint entry.
 */
export interface AiEndpoint {
  /** Short identifier (slug). */
  id: string;
  /** Human-readable product/company name. */
  name: string;
  /**
   * Category of the AI service:
   * - 'llm-api'    : Direct LLM API (highest risk — raw prompt exposure)
   * - 'saas-embedded' : SaaS product with an embedded AI feature
   * - 'dev-tool'   : Developer-facing AI coding tool
   * - 'infra'      : AI infrastructure, orchestration, or proxy
   */
  category: 'llm-api' | 'saas-embedded' | 'dev-tool' | 'infra';
  /**
   * Regex patterns (no `g` flag — used with .test() not exec loop).
   * Each pattern matches the full URL or hostname portion.
   */
  patterns: RegExp[];
  /** Risk level: how sensitive is data sent to this endpoint? */
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// A — Direct LLM APIs (CRITICAL — prompt is sent verbatim)
// ---------------------------------------------------------------------------

const OPENAI: AiEndpoint = {
  id: 'openai',
  name: 'OpenAI (ChatGPT / GPT-4)',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.openai\.com\/v\d+\/(chat\/completions|completions|assistants|threads)/,
    /api\.openai\.com/,
    /chat\.openai\.com\/backend-api/,
    /chatgpt\.com\/backend-api/,
  ],
};

const ANTHROPIC: AiEndpoint = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.anthropic\.com\/v\d+\/messages/,
    /api\.anthropic\.com/,
    /claude\.ai\/api/,
  ],
};

const GOOGLE_GEMINI: AiEndpoint = {
  id: 'google-gemini',
  name: 'Google Gemini / PaLM',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /generativelanguage\.googleapis\.com/,
    /gemini\.google\.com\/app\/api/,
    /us-central1-aiplatform\.googleapis\.com/,
    /aiplatform\.googleapis\.com\/v\d+\/projects/,
  ],
};

const MICROSOFT_COPILOT: AiEndpoint = {
  id: 'ms-copilot',
  name: 'Microsoft Copilot / Azure OpenAI',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /copilot\.microsoft\.com\/api/,
    /sydney\.bing\.com\/sydney\/ChatHub/,
    /openai\.azure\.com\/openai\/deployments/,
    /\.openai\.azure\.com/,
  ],
};

const COHERE: AiEndpoint = {
  id: 'cohere',
  name: 'Cohere',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.cohere\.ai\/v\d+\/(generate|chat|summarize)/,
    /api\.cohere\.ai/,
  ],
};

const MISTRAL: AiEndpoint = {
  id: 'mistral',
  name: 'Mistral AI',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.mistral\.ai\/v\d+\/(chat\/completions|completions)/,
    /api\.mistral\.ai/,
  ],
};

const GROQ: AiEndpoint = {
  id: 'groq',
  name: 'Groq',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.groq\.com\/openai\/v\d+/,
    /api\.groq\.com/,
  ],
};

const PERPLEXITY: AiEndpoint = {
  id: 'perplexity',
  name: 'Perplexity AI',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.perplexity\.ai\/chat\/completions/,
    /www\.perplexity\.ai\/socket\.io/,
    /perplexity\.ai\/api/,
  ],
};

const TOGETHER_AI: AiEndpoint = {
  id: 'together-ai',
  name: 'Together AI',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.together\.xyz\/v\d+\/completions/,
    /api\.together\.ai/,
  ],
};

const REPLICATE: AiEndpoint = {
  id: 'replicate',
  name: 'Replicate',
  category: 'llm-api',
  riskLevel: 'critical',
  patterns: [
    /api\.replicate\.com\/v\d+\/predictions/,
  ],
};

// ---------------------------------------------------------------------------
// B — Developer AI tools
// ---------------------------------------------------------------------------

const GITHUB_COPILOT: AiEndpoint = {
  id: 'github-copilot',
  name: 'GitHub Copilot',
  category: 'dev-tool',
  riskLevel: 'critical',
  patterns: [
    /copilot-proxy\.githubusercontent\.com/,
    /api\.githubcopilot\.com/,
    /githubcopilot\.com/,
  ],
};

const CURSOR: AiEndpoint = {
  id: 'cursor',
  name: 'Cursor AI',
  category: 'dev-tool',
  riskLevel: 'critical',
  patterns: [
    /api2\.cursor\.sh/,
    /\.cursor\.sh\/api/,
    /cursor\.sh\/api/,
  ],
};

const CODEIUM: AiEndpoint = {
  id: 'codeium',
  name: 'Codeium',
  category: 'dev-tool',
  riskLevel: 'high',
  patterns: [
    /server\.codeium\.com/,
    /web-backend\.codeium\.com/,
  ],
};

const TABNINE: AiEndpoint = {
  id: 'tabnine',
  name: 'Tabnine',
  category: 'dev-tool',
  riskLevel: 'high',
  patterns: [
    /api\.tabnine\.com/,
    /\.tabnine\.com\/api/,
  ],
};

// ---------------------------------------------------------------------------
// C — SaaS with embedded AI features (HIGH — may send docs/data silently)
// ---------------------------------------------------------------------------

const NOTION_AI: AiEndpoint = {
  id: 'notion-ai',
  name: 'Notion AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /notion\.so\/api\/v3\/runInferenceModel/,
    /notion\.so\/api\/v3\/getCompletion/,
    /api\.notion\.com.*ai/i,
  ],
};

const SLACK_AI: AiEndpoint = {
  id: 'slack-ai',
  name: 'Slack AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /slack\.com\/api\/assistant\./,
    /slack\.com\/api\/ai\./,
    /slack\.com\/api\/canvases\.ai/,
  ],
};

const HUBSPOT_AI: AiEndpoint = {
  id: 'hubspot-ai',
  name: 'HubSpot AI (Content Assistant)',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api\.hubapi\.com\/ai/i,
    /app\.hubspot\.com\/api.*copilot/i,
  ],
};

const SALESFORCE_EINSTEIN: AiEndpoint = {
  id: 'salesforce-einstein',
  name: 'Salesforce Einstein AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /\.salesforce\.com\/services\/data.*einstein/i,
    /einstein\.salesforce\.com/,
    /api\.salesforce\.com\/einstein/i,
  ],
};

const ZENDESK_AI: AiEndpoint = {
  id: 'zendesk-ai',
  name: 'Zendesk AI (Intelligent Triage)',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /\.zendesk\.com\/api\/v2\/macros\/suggest/,
    /\.zendesk\.com\/api.*ai/i,
    /zendesk\.com\/api\/v2\/tickets.*intelligent/i,
  ],
};

const INTERCOM_AI: AiEndpoint = {
  id: 'intercom-ai',
  name: 'Intercom Fin AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api-iam\.intercom\.io.*fin/i,
    /api\.intercom\.io\/ai/i,
    /api\.intercom\.io\/conversations.*ai/i,
  ],
};

const GRAMMARLY: AiEndpoint = {
  id: 'grammarly',
  name: 'Grammarly',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /capi\.grammarly\.com/,
    /extension-api\.grammarly\.com/,
    /\.grammarly\.com\/api/,
  ],
};

const JASPER_AI: AiEndpoint = {
  id: 'jasper-ai',
  name: 'Jasper AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api\.jasper\.ai/,
    /app\.jasper\.ai\/api/,
  ],
};

const COPY_AI: AiEndpoint = {
  id: 'copy-ai',
  name: 'Copy.ai',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /api\.copy\.ai/,
    /app\.copy\.ai\/api/,
  ],
};

const WRITESONIC: AiEndpoint = {
  id: 'writesonic',
  name: 'Writesonic',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /api\.writesonic\.com/,
  ],
};

const ZAPIER_AI: AiEndpoint = {
  id: 'zapier-ai',
  name: 'Zapier AI (Copilot)',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api\.zapier\.com.*ai/i,
    /zapier\.com\/api.*copilot/i,
  ],
};

const MAKE_AI: AiEndpoint = {
  id: 'make-ai',
  name: 'Make (Integromat) AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api\.make\.com.*ai/i,
    /eu1\.make\.com.*ai/i,
  ],
};

const MONDAY_AI: AiEndpoint = {
  id: 'monday-ai',
  name: 'Monday.com AI',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /api\.monday\.com.*ai/i,
    /auth\.monday\.com.*ai/i,
  ],
};

const CLICKUP_AI: AiEndpoint = {
  id: 'clickup-ai',
  name: 'ClickUp AI',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /api\.clickup\.com.*ai/i,
    /app\.clickup\.com\/api.*ai/i,
  ],
};

const JIRA_AI: AiEndpoint = {
  id: 'jira-ai',
  name: 'Jira / Atlassian Intelligence',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /api\.atlassian\.com.*intelligence/i,
    /\.atlassian\.net\/gateway\/api\/assist/i,
  ],
};

const CONFLUENCE_AI: AiEndpoint = {
  id: 'confluence-ai',
  name: 'Confluence AI',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /\.atlassian\.net\/wiki\/api.*ai/i,
    /api\.atlassian\.com.*confluence.*ai/i,
  ],
};

const GOOGLE_WORKSPACE_AI: AiEndpoint = {
  id: 'google-workspace-ai',
  name: 'Google Workspace AI (Duet)',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /docs\.googleapis\.com.*ai/i,
    /workspaceevents\.googleapis\.com/,
    /cloudaicompanion\.googleapis\.com/,
  ],
};

const MICROSOFT_365_AI: AiEndpoint = {
  id: 'ms365-copilot',
  name: 'Microsoft 365 Copilot',
  category: 'saas-embedded',
  riskLevel: 'critical',
  patterns: [
    /substrate\.office\.com.*copilot/i,
    /api\.office\.com.*copilot/i,
    /graph\.microsoft\.com.*copilot/i,
  ],
};

const ADOBE_FIREFLY: AiEndpoint = {
  id: 'adobe-firefly',
  name: 'Adobe Firefly / Sensei',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /firefly-api\.adobe\.io/,
    /sensei\.adobe\.io/,
    /stock\.adobe\.io.*ai/i,
  ],
};

const CANVA_AI: AiEndpoint = {
  id: 'canva-ai',
  name: 'Canva Magic AI',
  category: 'saas-embedded',
  riskLevel: 'medium',
  patterns: [
    /api\.canva\.com.*ai/i,
    /canva\.com\/api.*magic/i,
  ],
};

// ---------------------------------------------------------------------------
// D — AI Infrastructure / Proxies / Orchestration
// ---------------------------------------------------------------------------

const LANGCHAIN_SMITH: AiEndpoint = {
  id: 'langsmith',
  name: 'LangSmith (LangChain)',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /api\.smith\.langchain\.com/,
    /eu\.api\.smith\.langchain\.com/,
  ],
};

const HELICONE: AiEndpoint = {
  id: 'helicone',
  name: 'Helicone AI Proxy',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /oai\.hconeai\.com/,
    /api\.helicone\.ai/,
  ],
};

const PORTKEY_AI: AiEndpoint = {
  id: 'portkey',
  name: 'Portkey AI Gateway',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /api\.portkey\.ai/,
    /portkey\.ai\/api/,
  ],
};

const OPENROUTER: AiEndpoint = {
  id: 'openrouter',
  name: 'OpenRouter',
  category: 'infra',
  riskLevel: 'critical',
  patterns: [
    /openrouter\.ai\/api/,
    /api\.openrouter\.ai/,
  ],
};

const HUGGINGFACE: AiEndpoint = {
  id: 'huggingface',
  name: 'Hugging Face Inference API',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /api-inference\.huggingface\.co/,
    /huggingface\.co\/api\/inference/i,
  ],
};

const AWS_BEDROCK: AiEndpoint = {
  id: 'aws-bedrock',
  name: 'AWS Bedrock',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /bedrock(-runtime)?\.[\w-]+\.amazonaws\.com/,
    /bedrock\.amazonaws\.com/,
  ],
};

const AZURE_AI_STUDIO: AiEndpoint = {
  id: 'azure-ai-studio',
  name: 'Azure AI Studio',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /\.inference\.ml\.azure\.com/,
    /\.api\.cognitive\.microsoft\.com/,
    /language\.cognitive\.azure\.com/,
  ],
};

const VERTEX_AI: AiEndpoint = {
  id: 'vertex-ai',
  name: 'Google Vertex AI',
  category: 'infra',
  riskLevel: 'high',
  patterns: [
    /us-central1-aiplatform\.googleapis\.com/,
    /[\w-]+-aiplatform\.googleapis\.com/,
    /vertexai\.googleapis\.com/,
  ],
};

// ---------------------------------------------------------------------------
// E — AI Meeting / Transcription Services (Phase 4 — Cage 5)
// ---------------------------------------------------------------------------

const OTTER_AI: AiEndpoint = {
  id: 'otter-ai',
  name: 'Otter.ai',
  category: 'saas-embedded',
  riskLevel: 'critical',
  patterns: [
    /otter\.ai\/api\//i,
    /api\.otter\.ai/i,
    /otter\.ai\/v\d+\//i,
  ],
};

const FIREFLIES_AI: AiEndpoint = {
  id: 'fireflies-ai',
  name: 'Fireflies.ai',
  category: 'saas-embedded',
  riskLevel: 'critical',
  patterns: [
    /fireflies\.ai\/api\//i,
    /api\.fireflies\.ai/i,
  ],
};

const READ_AI: AiEndpoint = {
  id: 'read-ai',
  name: 'Read.ai',
  category: 'saas-embedded',
  riskLevel: 'critical',
  patterns: [
    /read\.ai\/api\//i,
    /api\.read\.ai/i,
  ],
};

const TLDV_IO: AiEndpoint = {
  id: 'tldv',
  name: 'tl;dv',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /tldv\.io\/api\//i,
    /api\.tldv\.io/i,
  ],
};

const FATHOM_VIDEO: AiEndpoint = {
  id: 'fathom',
  name: 'Fathom',
  category: 'saas-embedded',
  riskLevel: 'high',
  patterns: [
    /fathom\.video\/api\//i,
    /api\.fathom\.video/i,
  ],
};

// ---------------------------------------------------------------------------
// Master list — exported
// ---------------------------------------------------------------------------

/**
 * All known AI endpoints, ordered roughly by risk level.
 * Consumers should iterate this list to build `declarativeNetRequest` rules
 * or to test against observed network requests.
 */
export const ALL_AI_ENDPOINTS: readonly AiEndpoint[] = [
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
  FATHOM_VIDEO,
];

/**
 * Returns all endpoints matching a given URL string.
 *
 * @param url - The full URL to test (e.g. from a network request).
 * @returns All matching {@link AiEndpoint} entries.
 *
 * @example
 * ```ts
 * const matches = matchAiEndpoint('https://api.openai.com/v1/chat/completions');
 * // [{ id: 'openai', name: 'OpenAI (ChatGPT / GPT-4)', riskLevel: 'critical', ... }]
 * ```
 */
export function matchAiEndpoint(url: string): AiEndpoint[] {
  return ALL_AI_ENDPOINTS.filter((endpoint) =>
    endpoint.patterns.some((pattern) => pattern.test(url)),
  );
}

/**
 * Returns only endpoints in a given category.
 */
export function getEndpointsByCategory(
  category: AiEndpoint['category'],
): AiEndpoint[] {
  return ALL_AI_ENDPOINTS.filter((e) => e.category === category);
}

/**
 * Returns only endpoints at or above a given risk level.
 * Order: critical > high > medium > low
 */
export function getEndpointsByRisk(
  minRisk: AiEndpoint['riskLevel'],
): AiEndpoint[] {
  const order: AiEndpoint['riskLevel'][] = ['critical', 'high', 'medium', 'low'];
  const minIndex = order.indexOf(minRisk);
  return ALL_AI_ENDPOINTS.filter(
    (e) => order.indexOf(e.riskLevel) <= minIndex,
  );
}
