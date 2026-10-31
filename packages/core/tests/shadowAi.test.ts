/**
 * @file shadowAi.test.ts
 * Unit tests for shadowAiList — AI endpoint detection catalogue.
 */

import { describe, it, expect } from 'vitest';
import {
  matchAiEndpoint,
  getEndpointsByCategory,
  getEndpointsByRisk,
  ALL_AI_ENDPOINTS,
} from '../src/shadowAiList.js';

describe('matchAiEndpoint', () => {
  it('matches OpenAI chat completions URL', () => {
    const matches = matchAiEndpoint('https://api.openai.com/v1/chat/completions');
    expect(matches.some((m) => m.id === 'openai')).toBe(true);
  });

  it('matches Anthropic Claude API', () => {
    const matches = matchAiEndpoint('https://api.anthropic.com/v1/messages');
    expect(matches.some((m) => m.id === 'anthropic')).toBe(true);
  });

  it('matches Google Gemini API', () => {
    const matches = matchAiEndpoint('https://generativelanguage.googleapis.com/v1/models/gemini-pro');
    expect(matches.some((m) => m.id === 'google-gemini')).toBe(true);
  });

  it('matches GitHub Copilot proxy', () => {
    const matches = matchAiEndpoint('https://copilot-proxy.githubusercontent.com/v1/engines');
    expect(matches.some((m) => m.id === 'github-copilot')).toBe(true);
  });

  it('matches Notion AI endpoint', () => {
    const matches = matchAiEndpoint('https://www.notion.so/api/v3/runInferenceModel');
    expect(matches.some((m) => m.id === 'notion-ai')).toBe(true);
  });

  it('matches Grammarly API', () => {
    const matches = matchAiEndpoint('https://capi.grammarly.com/text-suggestions');
    expect(matches.some((m) => m.id === 'grammarly')).toBe(true);
  });

  it('matches AWS Bedrock endpoint', () => {
    const matches = matchAiEndpoint('https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-v2/invoke');
    expect(matches.some((m) => m.id === 'aws-bedrock')).toBe(true);
  });

  it('returns empty array for non-AI URL', () => {
    const matches = matchAiEndpoint('https://www.google.com/search?q=hello');
    expect(matches).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(matchAiEndpoint('')).toHaveLength(0);
  });
});

describe('getEndpointsByCategory', () => {
  it('returns only llm-api endpoints', () => {
    const eps = getEndpointsByCategory('llm-api');
    expect(eps.length).toBeGreaterThan(0);
    expect(eps.every((e) => e.category === 'llm-api')).toBe(true);
  });

  it('returns only saas-embedded endpoints', () => {
    const eps = getEndpointsByCategory('saas-embedded');
    expect(eps.length).toBeGreaterThan(5);
    expect(eps.every((e) => e.category === 'saas-embedded')).toBe(true);
  });
});

describe('getEndpointsByRisk', () => {
  it('returns only critical endpoints', () => {
    const eps = getEndpointsByRisk('critical');
    expect(eps.every((e) => e.riskLevel === 'critical')).toBe(true);
    expect(eps.length).toBeGreaterThan(0);
  });

  it('includes high and critical when minRisk is high', () => {
    const eps = getEndpointsByRisk('high');
    expect(eps.some((e) => e.riskLevel === 'critical')).toBe(true);
    expect(eps.some((e) => e.riskLevel === 'high')).toBe(true);
    expect(eps.every((e) => e.riskLevel !== 'low')).toBe(true);
  });
});

describe('ALL_AI_ENDPOINTS catalogue', () => {
  it('has at least 40 endpoints', () => {
    expect(ALL_AI_ENDPOINTS.length).toBeGreaterThanOrEqual(40);
  });

  it('every endpoint has required fields', () => {
    for (const ep of ALL_AI_ENDPOINTS) {
      expect(ep.id).toBeTruthy();
      expect(ep.name).toBeTruthy();
      expect(ep.patterns.length).toBeGreaterThan(0);
      expect(['llm-api','saas-embedded','dev-tool','infra']).toContain(ep.category);
      expect(['critical','high','medium','low']).toContain(ep.riskLevel);
    }
  });

  it('has no duplicate ids', () => {
    const ids = ALL_AI_ENDPOINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
