// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — AI Endpoint Matcher
// Licensed under Business Source License 1.1

package io.aicage.mobile.vpn

/**
 * AiEndpointMatcher — Kotlin mirror of packages/core/src/shadowAiList.ts
 *
 * This list MUST stay in sync with the TypeScript source.
 * When adding an endpoint to shadowAiList.ts, add it here too.
 *
 * SECURITY: This class performs hostname matching only.
 * No network calls are ever made from this class.
 */
class AiEndpointMatcher {

    /**
     * Full list of AI endpoint hostnames to intercept.
     * Stored as exact hostname strings for fast lookup.
     * Subdomain matching is handled by [isAiEndpoint].
     */
    private val exactHosts: Set<String> = setOf(
        // ── OpenAI ──────────────────────────────────────────────
        "api.openai.com",
        "chat.openai.com",
        "chatgpt.com",
        // ── Anthropic ───────────────────────────────────────────
        "api.anthropic.com",
        "claude.ai",
        // ── Google ──────────────────────────────────────────────
        "generativelanguage.googleapis.com",
        "gemini.google.com",
        "us-central1-aiplatform.googleapis.com",
        "aiplatform.googleapis.com",
        "cloudaicompanion.googleapis.com",
        "vertexai.googleapis.com",
        // ── Microsoft ───────────────────────────────────────────
        "copilot.microsoft.com",
        "sydney.bing.com",
        // ── Mistral ─────────────────────────────────────────────
        "api.mistral.ai",
        // ── Groq ────────────────────────────────────────────────
        "api.groq.com",
        // ── Perplexity ──────────────────────────────────────────
        "api.perplexity.ai",
        "www.perplexity.ai",
        // ── DeepSeek ────────────────────────────────────────────
        "api.deepseek.com",
        "chat.deepseek.com",
        // ── xAI / Grok ──────────────────────────────────────────
        "api.x.ai",
        "grok.x.ai",
        "grok.com",
        // ── Meta AI ─────────────────────────────────────────────
        "www.meta.ai",
        "meta.ai",
        "llama-api.meta.com",
        "api.llama-api.com",
        // ── Cohere ──────────────────────────────────────────────
        "api.cohere.ai",
        // ── Together AI ─────────────────────────────────────────
        "api.together.xyz",
        "api.together.ai",
        // ── Replicate ───────────────────────────────────────────
        "api.replicate.com",
        // ── Dev tools ───────────────────────────────────────────
        "copilot-proxy.githubusercontent.com",
        "api.githubcopilot.com",
        "api2.cursor.sh",
        "server.codeium.com",
        "api.tabnine.com",
        // ── Infrastructure ──────────────────────────────────────
        "api.smith.langchain.com",
        "eu.api.smith.langchain.com",
        "oai.hconeai.com",
        "api.helicone.ai",
        "api.portkey.ai",
        "openrouter.ai",
        "api.openrouter.ai",
        "api-inference.huggingface.co",
        // ── SaaS embedded AI ────────────────────────────────────
        "capi.grammarly.com",
        "extension-api.grammarly.com",
        "api.jasper.ai",
        "api.writesonic.com",
        // ── Meeting / Transcription ──────────────────────────────
        "otter.ai",
        "api.otter.ai",
        "fireflies.ai",
        "api.fireflies.ai",
        "read.ai",
        "api.read.ai",
        "tldv.io",
        "api.tldv.io",
        // "fathom.video" intentionally absent — the bare domain serves
        // the marketing site. Only API traffic is intercepted:
        //   • api.fathom.video  (exact match below — always intercepted)
        //   • fathom.video/api/ (path-aware check in isAiEndpoint)
        "api.fathom.video",
    )

    /**
     * Suffix patterns for endpoints that use dynamic subdomains.
     * e.g. "eu1.openai.azure.com" matches ".openai.azure.com"
     */
    private val suffixPatterns: List<String> = listOf(
        ".openai.azure.com",
        "-aiplatform.googleapis.com",
        ".inference.ml.azure.com",
        ".api.cognitive.microsoft.com",
        ".salesforce.com",
        ".zendesk.com",
        ".atlassian.net",
        ".atlassian.com",
        "bedrock.amazonaws.com",
        "bedrock-runtime.",
    )

    /**
     * Returns true if the given [hostname] + [path] combination is a known
     * AI endpoint that should be intercepted.
     *
     * Checks (in order):
     *   1. Exact hostname match in [exactHosts]
     *   2. Suffix hostname match against [suffixPatterns]
     *   3. Path-aware rules for domains that mix marketing and API traffic:
     *        • fathom.video/api/* — intercepted (AI transcription API)
     *        • fathom.video/*    — NOT intercepted (marketing site)
     *
     * @param hostname The request hostname, e.g. "fathom.video".
     * @param path     The request path, e.g. "/api/v1/meetings". Defaults to ""
     *                 so existing callers that only pass hostname still compile.
     */
    fun isAiEndpoint(hostname: String, path: String = ""): Boolean {
        val h = hostname.lowercase().trimEnd('.')

        // Check 1 — Exact hostname match
        if (h in exactHosts) return true

        // Check 2 — Suffix match (dynamic subdomains, e.g. eu1.openai.azure.com)
        for (suffix in suffixPatterns) {
            if (h.endsWith(suffix) || h.contains(suffix)) return true
        }

        // Check 3 — Path-aware rules for mixed-purpose domains
        //
        // fathom.video: the bare domain serves the marketing website.
        // Only requests to /api/ paths are AI transcription calls.
        //   api.fathom.video → already matched by exactHosts above
        //   fathom.video/api/... → intercepted here
        //   fathom.video/ (marketing) → NOT intercepted
        if (h == "fathom.video" && path.startsWith("/api/")) return true

        return false
    }
}
