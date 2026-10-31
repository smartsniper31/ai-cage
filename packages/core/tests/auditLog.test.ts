/**
 * @file auditLog.test.ts
 * Unit tests for the immutable audit log.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  logEvent,
  getAuditLog,
  getAuditSummary,
  exportAuditLogCSV,
  clearAuditLog,
  getClearHistory,
  createMemoryAdapter,
} from '../src/auditLog.js';

// Each test gets a fresh in-memory store
function freshAdapter() {
  return createMemoryAdapter();
}

describe('logEvent', () => {
  it('creates an entry with correct fields', async () => {
    const store = freshAdapter();
    const entry = await logEvent(
      { type: 'PII_CAGED', site: 'chat.openai.com', counts: { EMAIL_ADDRESS: 2 }, totalCount: 2 },
      store,
    );
    expect(entry.id).toBe(1);
    expect(entry.type).toBe('PII_CAGED');
    expect(entry.site).toBe('chat.openai.com');
    expect(entry.totalCount).toBe(2);
    expect(entry.counts['EMAIL_ADDRESS']).toBe(2);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('increments id monotonically', async () => {
    const store = freshAdapter();
    const a = await logEvent({ type: 'PII_CAGED', site: 'x.com', counts: {}, totalCount: 1 }, store);
    const b = await logEvent({ type: 'SHADOW_AI_DETECTED', site: 'y.com', counts: {}, totalCount: 1 }, store);
    expect(b.id).toBe(a.id + 1);
  });

  it('persists entries across calls', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'a.com', counts: {}, totalCount: 1 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'b.com', counts: {}, totalCount: 3 }, store);
    const log = await getAuditLog(store);
    expect(log).toHaveLength(2);
  });
});

describe('getAuditLog', () => {
  it('returns empty array when log is empty', async () => {
    const log = await getAuditLog(freshAdapter());
    expect(log).toHaveLength(0);
  });

  it('returns entries in insertion order', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'EXTENSION_STARTED', site: 'bg', counts: {}, totalCount: 0 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'claude.ai', counts: {}, totalCount: 5 }, store);
    const log = await getAuditLog(store);
    expect(log[0]?.type).toBe('EXTENSION_STARTED');
    expect(log[1]?.type).toBe('PII_CAGED');
  });
});

describe('getAuditSummary', () => {
  it('counts totalCaged correctly', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'a.com', counts: {}, totalCount: 3 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'b.com', counts: {}, totalCount: 7 }, store);
    const summary = await getAuditSummary(store);
    expect(summary.totalCaged).toBe(10);
  });

  it('counts totalShadowAi correctly', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'SHADOW_AI_DETECTED', site: 'slack.com', counts: {}, totalCount: 4 }, store);
    await logEvent({ type: 'SHADOW_AI_DETECTED', site: 'notion.so', counts: {}, totalCount: 2 }, store);
    const summary = await getAuditSummary(store);
    expect(summary.totalShadowAi).toBe(6);
  });

  it('returns topSites sorted by count descending', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'a.com', counts: {}, totalCount: 1 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'b.com', counts: {}, totalCount: 10 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'a.com', counts: {}, totalCount: 5 }, store);
    const summary = await getAuditSummary(store);
    expect(summary.topSites[0]?.site).toBe('b.com');
    expect(summary.topSites[1]?.site).toBe('a.com');
  });
});

describe('exportAuditLogCSV', () => {
  it('returns empty string when log is empty', async () => {
    const csv = await exportAuditLogCSV(freshAdapter());
    expect(csv).toBe('');
  });

  it('returns valid CSV with header row', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'openai.com', counts: { EMAIL_ADDRESS: 1 }, totalCount: 1 }, store);
    const csv = await exportAuditLogCSV(store);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('type');
    expect(lines[0]).toContain('site');
    expect(lines[0]).toContain('totalCount');
  });

  it('never contains original PII values', async () => {
    const store = freshAdapter();
    await logEvent({
      type: 'PII_CAGED',
      site: 'claude.ai',
      counts: { EMAIL_ADDRESS: 1 },
      totalCount: 1,
      detail: 'session cage',
    }, store);
    const csv = await exportAuditLogCSV(store);
    // Should contain type label, not any made-up email
    expect(csv).toContain('PII_CAGED');
    expect(csv).not.toContain('@example.com');
  });

  it('produces correct row count (header + entries)', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'a.com', counts: {}, totalCount: 1 }, store);
    await logEvent({ type: 'PII_CAGED', site: 'b.com', counts: {}, totalCount: 2 }, store);
    const csv = await exportAuditLogCSV(store);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });
});

describe('clearAuditLog', () => {
  it('clears all entries', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'x.com', counts: {}, totalCount: 1 }, store);
    await clearAuditLog(store, 'admin');
    const log = await getAuditLog(store);
    expect(log).toHaveLength(0);
  });

  it('throws without confirmedBy', async () => {
    const store = freshAdapter();
    await expect(clearAuditLog(store, '')).rejects.toThrow('confirmedBy is required');
  });

  it('records clear event in tamper-evidence history', async () => {
    const store = freshAdapter();
    await logEvent({ type: 'PII_CAGED', site: 'x.com', counts: {}, totalCount: 5 }, store);
    await clearAuditLog(store, 'admin-user', 'GDPR erasure request');
    const history = await getClearHistory(store);
    expect(history).toHaveLength(1);
    expect(history[0]?.confirmedBy).toBe('admin-user');
    expect(history[0]?.reason).toBe('GDPR erasure request');
    expect(history[0]?.entriesCleared).toBe(1);
  });

  it('accumulates multiple clear events in history', async () => {
    const store = freshAdapter();
    await clearAuditLog(store, 'admin', 'first clear');
    await clearAuditLog(store, 'admin', 'second clear');
    const history = await getClearHistory(store);
    expect(history).toHaveLength(2);
  });
});
