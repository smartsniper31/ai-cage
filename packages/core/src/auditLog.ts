// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// https://github.com/smartsniper31/ai-cage
// Licensed under Business Source License 1.1 — see LICENSE for details.
// Commercial use requires a license: contact@ai-cage.io

/**
 * @file auditLog.ts
 * Immutable local audit log for AI CAGE.
 *
 * SECURITY CONTRACT:
 *   - NEVER stores original PII values — only counts and entity types.
 *   - NEVER calls fetch(), XMLHttpRequest, or any network primitive.
 *   - Storage is provided by the caller (localStorage adapter for desktop,
 *     chrome.storage.local adapter for extension). This module is pure logic.
 *   - The log is append-only. Individual entries cannot be mutated.
 *     `clearAuditLog()` wipes the entire log and records the wipe event itself
 *     in a separate clear-history log so auditors know it happened.
 *
 * GDPR note:
 *   Because no personal data (PII values) are stored in the log, this log
 *   does not constitute a "personal data filing system" under GDPR Art. 4(6).
 *   It records only: event type, entity category counts, site hostname, timestamp.
 */

import type { EntityType } from '@ai-cage/presidio-lite';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The category of event recorded in the audit log. */
export type AuditEventType =
  | 'PII_CAGED'          // PII was detected and caged before sending to AI
  | 'SHADOW_AI_DETECTED' // An outbound request to an AI endpoint was observed
  | 'UNCAGE_PERFORMED'   // A caged response was restored locally
  | 'AUDIT_LOG_CLEARED'  // The audit log was manually cleared
  | 'EXTENSION_STARTED'  // Extension loaded / session started
  | 'CODE_SCAN'          // A code file was scanned (VS Code extension)
  | 'POLICY_VIOLATION';  // A configured policy rule was triggered

/**
 * A single audit log entry.
 * All fields are safe for auditors — zero PII values.
 */
export interface AuditEntry {
  /** Monotonically increasing ID within this session. */
  id: number;
  /** ISO 8601 timestamp of the event. */
  timestamp: string;
  /** Type of event. */
  type: AuditEventType;
  /** Hostname of the site where the event occurred (e.g. "chat.openai.com"). */
  site: string;
  /**
   * For PII_CAGED events: counts per entity type.
   * e.g. { EMAIL_ADDRESS: 2, CREDIT_CARD: 1 }
   * For SHADOW_AI_DETECTED: { [endpointId]: 1 }
   */
  counts: Partial<Record<EntityType | string, number>>;
  /** Total number of items in this event. */
  totalCount: number;
  /** Optional human-readable detail (no PII). */
  detail?: string;
}

/** The shape of what gets serialised to storage. */
interface SerializedLog {
  entries: AuditEntry[];
  version: 1;
}

// ---------------------------------------------------------------------------
// Storage adapter interface
// ---------------------------------------------------------------------------

/**
 * Pluggable storage backend.
 * - Desktop: wrap localStorage
 * - Extension: wrap chrome.storage.local
 * - Tests: in-memory Map
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Built-in adapters
// ---------------------------------------------------------------------------

/**
 * localStorage adapter — for use in the Tauri desktop WebView.
 * Note: declared as `unknown` at module level because this file must also
 * compile in Node (for tests). The adapter is only called at runtime inside
 * a browser/WebView context where localStorage is available.
 */
export const localStorageAdapter: StorageAdapter = {
  async getItem(key): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).localStorage?.getItem(key) as string | null ?? null;
  },
  async setItem(key, value): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage?.setItem(key, value);
  },
};

/**
 * In-memory adapter — for unit tests and SSR environments.
 */
export function createMemoryAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async setItem(key, value): Promise<void> {
      store.set(key, value);
    },
  };
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const LOG_KEY       = 'ai-cage:audit-log';
const CLEAR_KEY     = 'ai-cage:audit-clear-history';
const COUNTER_KEY   = 'ai-cage:audit-id-counter';

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Appends a new event to the audit log.
 *
 * @param event - The event to record. Must NOT contain PII values.
 * @param storage - Storage adapter to use.
 *
 * @example
 * ```ts
 * await logEvent({
 *   type: 'PII_CAGED',
 *   site: 'chat.openai.com',
 *   counts: { EMAIL_ADDRESS: 1, CREDIT_CARD: 1 },
 *   totalCount: 2,
 * }, adapter);
 * ```
 */
export async function logEvent(
  event: Omit<AuditEntry, 'id' | 'timestamp'>,
  storage: StorageAdapter,
): Promise<AuditEntry> {
  const [rawLog, rawCounter] = await Promise.all([
    storage.getItem(LOG_KEY),
    storage.getItem(COUNTER_KEY),
  ]);

  const log: SerializedLog = rawLog
    ? (JSON.parse(rawLog) as SerializedLog)
    : { entries: [], version: 1 };

  const id = rawCounter ? parseInt(rawCounter, 10) + 1 : 1;

  const entry: AuditEntry = {
    id,
    timestamp: new Date().toISOString(),
    ...event,
  };

  log.entries.push(entry);

  await Promise.all([
    storage.setItem(LOG_KEY, JSON.stringify(log)),
    storage.setItem(COUNTER_KEY, String(id)),
  ]);

  return entry;
}

/**
 * Returns all audit log entries, oldest first.
 *
 * @param storage - Storage adapter to use.
 */
export async function getAuditLog(
  storage: StorageAdapter,
): Promise<AuditEntry[]> {
  const raw = await storage.getItem(LOG_KEY);
  if (!raw) return [];
  const log = JSON.parse(raw) as SerializedLog;
  return log.entries ?? [];
}

/**
 * Returns a summary of audit events for a given time range.
 *
 * @param storage  - Storage adapter.
 * @param fromDate - Start of range (inclusive). Defaults to start of current month.
 * @param toDate   - End of range (inclusive). Defaults to now.
 */
export async function getAuditSummary(
  storage: StorageAdapter,
  fromDate?: Date,
  toDate?: Date,
): Promise<{
  totalCaged: number;
  totalShadowAi: number;
  topSites: Array<{ site: string; count: number }>;
  byType: Partial<Record<AuditEventType, number>>;
}> {
  const entries = await getAuditLog(storage);

  const from = fromDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to   = toDate   ?? new Date();

  const inRange = entries.filter((e) => {
    const t = new Date(e.timestamp);
    return t >= from && t <= to;
  });

  let totalCaged   = 0;
  let totalShadowAi = 0;
  const siteMap = new Map<string, number>();
  const byType: Partial<Record<AuditEventType, number>> = {};

  for (const e of inRange) {
    // Accumulate by type
    byType[e.type] = (byType[e.type] ?? 0) + 1;

    if (e.type === 'PII_CAGED') {
      totalCaged += e.totalCount;
    }
    if (e.type === 'SHADOW_AI_DETECTED') {
      totalShadowAi += e.totalCount;
    }

    // Accumulate by site
    siteMap.set(e.site, (siteMap.get(e.site) ?? 0) + e.totalCount);
  }

  const topSites = [...siteMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([site, count]) => ({ site, count }));

  return { totalCaged, totalShadowAi, topSites, byType };
}

/**
 * Exports the full audit log as a CSV string, safe for auditors.
 *
 * Columns: id, timestamp, type, site, totalCount, detail, [per-type counts...]
 *
 * @param storage - Storage adapter.
 * @returns A CSV string. Empty string if log is empty.
 *
 * @example
 * ```ts
 * const csv = await exportAuditLogCSV(adapter);
 * // Download as 'ai-cage-audit-YYYY-MM-DD.csv'
 * ```
 */
export async function exportAuditLogCSV(
  storage: StorageAdapter,
): Promise<string> {
  const entries = await getAuditLog(storage);
  if (entries.length === 0) return '';

  // Collect all entity type columns present in any entry
  const allCountKeys = new Set<string>();
  for (const e of entries) {
    for (const k of Object.keys(e.counts)) {
      allCountKeys.add(k);
    }
  }
  const countCols = [...allCountKeys].sort();

  const header = [
    'id',
    'timestamp',
    'type',
    'site',
    'totalCount',
    'detail',
    ...countCols,
  ].join(',');

  const rows = entries.map((e) => {
    const base = [
      e.id,
      `"${e.timestamp}"`,
      e.type,
      `"${e.site}"`,
      e.totalCount,
      `"${(e.detail ?? '').replace(/"/g, '""')}"`,
    ];
    const counts = countCols.map((k) => e.counts[k] ?? 0);
    return [...base, ...counts].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Clears the entire audit log and records the clear event in a
 * separate tamper-evidence log.
 *
 * Requires explicit confirmation to prevent accidental data loss.
 *
 * @param storage       - Storage adapter.
 * @param confirmedBy   - Who confirmed the clear (e.g. 'admin-user'). Required.
 * @param reason        - Optional reason for the audit trail.
 */
export async function clearAuditLog(
  storage: StorageAdapter,
  confirmedBy: string,
  reason?: string,
): Promise<void> {
  if (!confirmedBy.trim()) {
    throw new Error('clearAuditLog: confirmedBy is required. Pass the identity of who authorised this action.');
  }

  // Record the clear event in the separate clear-history log first
  const rawHistory = await storage.getItem(CLEAR_KEY);
  const history: Array<{
    clearedAt: string;
    confirmedBy: string;
    reason?: string;
    entriesCleared: number;
  }> = rawHistory ? (JSON.parse(rawHistory) as typeof history) : [];

  const entries = await getAuditLog(storage);

  history.push({
    clearedAt:      new Date().toISOString(),
    confirmedBy,
    ...(reason !== undefined ? { reason } : {}),
    entriesCleared: entries.length,
  });

  await storage.setItem(CLEAR_KEY, JSON.stringify(history));

  // Now wipe the main log
  const empty: SerializedLog = { entries: [], version: 1 };
  await storage.setItem(LOG_KEY, JSON.stringify(empty));
  await storage.setItem(COUNTER_KEY, '0');
}

/**
 * Returns the tamper-evidence clear history — a record of every time
 * the audit log was cleared, by whom, and why.
 */
export async function getClearHistory(
  storage: StorageAdapter,
): Promise<Array<{ clearedAt: string; confirmedBy: string; reason?: string; entriesCleared: number }>> {
  const raw = await storage.getItem(CLEAR_KEY);
  return raw ? (JSON.parse(raw) as ReturnType<typeof getClearHistory> extends Promise<infer T> ? T : never) : [];
}
