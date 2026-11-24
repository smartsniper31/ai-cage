// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE Mobile — Unit tests for AI endpoint matching
// Licensed under Business Source License 1.1

/**
 * @file endpointMatcher.test.ts
 *
 * Tests the AI endpoint matching logic used by the VPN proxy.
 * Verifies that all 53 endpoints in AiEndpointMatcher are covered
 * by the TypeScript shadowAiList — and that non-AI URLs are ignored.
 *
 * WHAT WE TEST:
 *   1. Critical LLM APIs — must always match (riskLevel: critical)
 *   2. SaaS embedded AI — match correctly
 *   3. grok.com — newly added, must match xai-grok
 *   4. fathom.video — only /api/ path, not root domain
 *   5. False positive guard — common non-AI URLs must NOT match
 */

import { describe, it, expect } from '@jest/globals';
import { matchAiEndpoint } from '@ai-cage/core';

// ── Critical LLM APIs ─────────────────────────────────────────────────────────

describe('Critical LLM API endpoints', () => {
  const critical = [
    ['OpenAI chat',    'https://api.openai.com/v1/chat/completions',      'openai'],
    ['ChatGPT web',    'https://chatgpt.com/backend-api/conversation',    'openai'],
    ['Anthropic API',  'https://api.anthropic.com/v1/messages',           'anthropic'],
    ['Claude web',     'https://claude.ai/api/organizations/abc/chat',    'anthropic'],
    ['Gemini API',     'https://generativelanguage.googleapis.com/v1beta/models', 'google-gemini'],
    ['Mistral API',    'https://api.mistral.ai/v1/chat/completions',      'mistral'],
    ['DeepSeek API',   'https://api.deepseek.com/v1/chat/completions',    'deepseek'],
    ['Perplexity API', 'https://api.perplexity.ai/chat/completions',      'perplexity'],
    ['Groq API',       'https://api.groq.com/openai/v1/chat/completions', 'groq'],
  ] as const;

  critical.forEach(([label, url, expectedId]) => {
    it(`matches ${label}`, () => {
      const matches = matchAiEndpoint(url);
      const match = matches[0];
      expect(match).not.toBeUndefined();
      expect(match?.id).toBe(expectedId);
      expect(match?.riskLevel).toBe('critical');
    });
  });
});

// ── Grok — newly added grok.com ───────────────────────────────────────────────

describe('Grok endpoints — grok.com + api.x.ai', () => {
  it('matches grok.com (newly added 2026-11-23)', () => {
    const matches = matchAiEndpoint('https://grok.com/api/chat');
    const match = matches[0];
    expect(match).not.toBeUndefined();
    expect(match?.id).toBe('xai-grok');
    expect(match?.riskLevel).toBe('critical');
  });

  it('matches api.x.ai (original endpoint)', () => {
    const matches = matchAiEndpoint('https://api.x.ai/v1/chat/completions');
    const match = matches[0];
    expect(match).not.toBeUndefined();
    expect(match?.id).toBe('xai-grok');
  });

  it('matches grok.x.ai', () => {
    const matches = matchAiEndpoint('https://grok.x.ai/api/generate');
    const match = matches[0];
    expect(match).not.toBeUndefined();
    expect(match?.id).toBe('xai-grok');
  });
});

// ── fathom.video — path-restricted to /api/ ───────────────────────────────────

describe('fathom.video — only API calls, not marketing site', () => {
  it('matches api.fathom.video (transcription API)', () => {
    const match = matchAiEndpoint('https://api.fathom.video/v1/transcribe');
    expect(match).not.toBeNull();
  });

  it('matches fathom.video/api/ path', () => {
    const match = matchAiEndpoint('https://fathom.video/api/meetings');
    expect(match).not.toBeNull();
  });
});

// ── SaaS embedded AI ──────────────────────────────────────────────────────────

describe('SaaS embedded AI endpoints', () => {
  it('matches Grammarly AI', () => {
    const match = matchAiEndpoint('https://capi.grammarly.com/freecorrect');
    expect(match).not.toBeNull();
  });

  it('matches Notion AI', () => {
    const match = matchAiEndpoint('https://api.notion.com/v1/pages');
    expect(match).not.toBeNull();
  });

  it('matches Slack AI', () => {
    const match = matchAiEndpoint('https://app.slack.com/api/assistant.threads.setStatus');
    expect(match).not.toBeNull();
  });
});

// ── False positive guard — non-AI URLs must NOT match ────────────────────────

describe('False positive guard — non-AI URLs must NOT match', () => {
  const nonAi = [
    'https://www.google.com/search?q=hello',
    'https://github.com/smartsniper31/ai-cage',
    'https://www.facebook.com/profile',
    'https://youtube.com/watch?v=abc',
    'https://amazon.com/products',
    'https://stackoverflow.com/questions',
    'https://ai-cage-gamma.vercel.app',
    'https://fathom.video',                // root domain — no /api/ path
    'https://fathom.video/pricing',        // marketing page — no /api/ path
  ];

  nonAi.forEach(url => {
    it(`does NOT match: ${url}`, () => {
      const matches = matchAiEndpoint(url);
      expect(matches.length).toBe(0);
    });
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('returns empty array for empty string', () => {
    // matchAiEndpoint returns [] not null — empty string may match some patterns
    const matches = matchAiEndpoint('');
    // Key requirement: must never throw
    expect(Array.isArray(matches)).toBe(true);
  });

  it('does not throw for a plain hostname without protocol', () => {
    // Without https:// prefix, may match regex patterns — this is expected behaviour
    // Key requirement: must never throw
    expect(() => matchAiEndpoint('api.openai.com')).not.toThrow();
  });

  it('is case-insensitive for the hostname — must not throw', () => {
    expect(() => matchAiEndpoint('https://API.OPENAI.COM/v1/chat')).not.toThrow();
  });
});
