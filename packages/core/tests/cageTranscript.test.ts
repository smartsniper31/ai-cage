/**
 * @file cageTranscript.test.ts
 * Unit tests for Cage 5 — Voice/Video transcript caging.
 */

import { describe, it, expect } from 'vitest';
import { cageTranscript, uncageTranscript } from '../src/cageTranscript.js';

// ---------------------------------------------------------------------------
// cageTranscript — basic functionality
// ---------------------------------------------------------------------------

describe('cageTranscript — basic redaction', () => {
  it('redacts participant names from a simple transcript', () => {
    const text = 'Ahmed Ben Ali: We need to review the Q3 numbers.\nMarie Dupont: I agree, let me pull the report.';
    const result = cageTranscript(text);

    expect(result.totalRedacted).toBeGreaterThanOrEqual(2);
    expect(result.cagedTranscript).not.toContain('Ahmed');
    expect(result.cagedTranscript).not.toContain('Marie');
    expect(result.cagedTranscript).toContain('[PARTICIPANT_');
  });

  it('preserves the conversational structure', () => {
    const text = 'John Smith: Hello team.\nJane Doe: Hi John.';
    const result = cageTranscript(text);

    // The colon and text after should remain
    expect(result.cagedTranscript).toContain(': Hello team.');
    expect(result.cagedTranscript).toContain(': Hi');
  });

  it('handles empty string', () => {
    const result = cageTranscript('');
    expect(result.cagedTranscript).toBe('');
    expect(result.totalRedacted).toBe(0);
    expect(result.isTranscript).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cageTranscript — isTranscript detection
// ---------------------------------------------------------------------------

describe('cageTranscript — transcript marker detection', () => {
  it('detects timestamp markers and sets isTranscript=true', () => {
    const text = '[00:15:32] Ahmed Ben Ali: Let me start the meeting.\n[00:16:01] Marie Dupont: Sounds good.';
    const result = cageTranscript(text);
    expect(result.isTranscript).toBe(true);
  });

  it('detects "Transcript of" header', () => {
    const text = 'Transcript of meeting on 2026-10-31\nAhmed: Hello.';
    const result = cageTranscript(text);
    expect(result.isTranscript).toBe(true);
  });

  it('isTranscript is false for plain prose', () => {
    const text = 'The weather is nice today. We should go outside.';
    const result = cageTranscript(text);
    expect(result.isTranscript).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cageTranscript — participant deduplication
// ---------------------------------------------------------------------------

describe('cageTranscript — name deduplication', () => {
  it('assigns the same placeholder to the same name', () => {
    const text = 'John Smith: Hi.\nJohn Smith: Actually, one more thing.';
    const result = cageTranscript(text);

    const johnEntries = result.participants.filter((p) => p.originalName === 'John Smith');
    expect(johnEntries).toHaveLength(1);
  });

  it('assigns different placeholders to different names', () => {
    const text = 'Alice Martin: Hello.\nBob Wilson: Hi Alice.';
    const result = cageTranscript(text);

    const placeholders = result.participants.map((p) => p.placeholder);
    expect(new Set(placeholders).size).toBe(placeholders.length);
  });
});

// ---------------------------------------------------------------------------
// cageTranscript — longer names first (prevents partial replacement)
// ---------------------------------------------------------------------------

describe('cageTranscript — longer names replaced first', () => {
  it('replaces "Ahmed Ben Ali" before "Ahmed" alone', () => {
    const text = 'Ahmed Ben Ali: We reviewed the proposal. Ahmed will follow up.';
    const result = cageTranscript(text);

    // "Ahmed Ben Ali" should be a single participant, not two separate
    const hasFull = result.participants.some((p) => p.originalName === 'Ahmed Ben Ali');
    expect(hasFull).toBe(true);

    // The caged text should not contain the full name
    expect(result.cagedTranscript).not.toContain('Ahmed Ben Ali');
  });
});

// ---------------------------------------------------------------------------
// uncageTranscript — round trip
// ---------------------------------------------------------------------------

describe('uncageTranscript — round-trip restoration', () => {
  it('restores original names', () => {
    const original = 'Ahmed Ben Ali: We need to review the Q3 numbers.\nMarie Dupont: I agree.';
    const { cagedTranscript, participants } = cageTranscript(original);
    const restored = uncageTranscript(cagedTranscript, participants);

    expect(restored).toContain('Ahmed Ben Ali');
    expect(restored).toContain('Marie Dupont');
  });

  it('is idempotent', () => {
    const original = 'John Smith: Hello team.';
    const { cagedTranscript, participants } = cageTranscript(original);
    const first = uncageTranscript(cagedTranscript, participants);
    const second = uncageTranscript(first, participants);
    expect(second).toBe(first);
  });

  it('returns empty for empty participants', () => {
    expect(uncageTranscript('No names here.', [])).toBe('No names here.');
  });
});

// ---------------------------------------------------------------------------
// Shadow AI — AI meeting endpoints (Cage 5)
// ---------------------------------------------------------------------------

describe('Shadow AI — meeting/transcription endpoints', () => {
  it('matches Otter.ai endpoint', async () => {
    const { matchAiEndpoint } = await import('../src/shadowAiList.js');
    const matches = matchAiEndpoint('https://otter.ai/api/v1/transcripts');
    expect(matches.some((m) => m.id === 'otter-ai')).toBe(true);
  });

  it('matches Fireflies.ai endpoint', async () => {
    const { matchAiEndpoint } = await import('../src/shadowAiList.js');
    const matches = matchAiEndpoint('https://api.fireflies.ai/graphql');
    expect(matches.some((m) => m.id === 'fireflies-ai')).toBe(true);
  });

  it('matches Read.ai endpoint', async () => {
    const { matchAiEndpoint } = await import('../src/shadowAiList.js');
    const matches = matchAiEndpoint('https://api.read.ai/v1/meetings');
    expect(matches.some((m) => m.id === 'read-ai')).toBe(true);
  });

  it('matches tl;dv endpoint', async () => {
    const { matchAiEndpoint } = await import('../src/shadowAiList.js');
    const matches = matchAiEndpoint('https://tldv.io/api/v1/recordings');
    expect(matches.some((m) => m.id === 'tldv')).toBe(true);
  });

  it('matches Fathom.video endpoint', async () => {
    const { matchAiEndpoint } = await import('../src/shadowAiList.js');
    const matches = matchAiEndpoint('https://fathom.video/api/v1/transcripts');
    expect(matches.some((m) => m.id === 'fathom')).toBe(true);
  });
});
