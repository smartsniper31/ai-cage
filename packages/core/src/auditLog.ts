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
/**
 * Strips any caging tokens like [CAGED_TRANSCRIPT_1] or [EMAIL_1] from a
 * detail string so that system-generated log messages are always readable.
 * These tokens appear when a detail string accidentally passes through the
 * cage engine. We remove them here as the last line of defence.
 */
function sanitiseDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  // Remove [CAGED_TRANSCRIPT_N], [EMAIL_N], [PERSON_N], [PHONE_N], etc.
  return detail.replace(/\[[A-Z_]+_\d+\]/g, '[PROTECTED]');
}

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

  // C1: sanitise detail — strip any [CAGED_TRANSCRIPT_N] tokens that may
  // have leaked into system-generated strings, keeping the log readable.
  const sanitised = sanitiseDetail(event.detail);

  const entry: AuditEntry = {
    id,
    timestamp: new Date().toISOString(),
    ...event,
    // Only set detail when it has a value (exactOptionalPropertyTypes compat)
    ...(sanitised !== undefined ? { detail: sanitised } : {}),
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

// ---------------------------------------------------------------------------
// Plain-language report generator
// ---------------------------------------------------------------------------

/**
 * Maps technical entity type keys to plain English labels.
 * Covers all entity types emitted by presidio-lite.
 */
const ENTITY_LABELS: Record<string, string> = {
  // Email
  EMAIL_ADDRESS:        'email address',
  EMAIL:                'email address',
  // Phone
  PHONE_NUMBER:         'phone number',
  PHONE:                'phone number',
  PHONE_TN:             'phone number',
  // Person / name
  PERSON:               'personal name',
  PERSON_NAME:          'personal name',
  // Financial
  CREDIT_CARD:          'credit card number',
  CREDIT_CARD_NUMBER:   'credit card number',
  IBAN_CODE:            'bank account / IBAN',
  IBAN:                 'bank account / IBAN',
  US_BANK_NUMBER:       'bank account number',
  // Identity documents
  NRP:                  'national ID number',
  CIN_TN:               'national ID (Tunisia)',
  PASSPORT:             'passport number',
  PASSPORT_NUMBER:      'passport number',
  DRIVER_LICENSE:       'driver\'s licence',
  US_DRIVER_LICENSE:    'driver\'s licence',
  // Address / location
  LOCATION:             'postal address',
  ADDRESS:              'postal address',
  POSTAL_ADDRESS:       'postal address',
  ZIP_CODE:             'postal code',
  // Digital identifiers
  IP_ADDRESS:           'IP address',
  URL:                  'web address (URL)',
  // Credentials
  PASSWORD:             'password / secret key',
  API_KEY:              'API key / secret',
  // Medical
  MEDICAL_LICENSE:      'medical licence number',
  US_ITIN:              'tax ID number',
  US_SSN:               'social security number',
  AU_TFN:               'tax file number',
  AU_ACN:               'company number',
  // Organisation
  ORGANIZATION:         'organisation name',
  ORG:                  'organisation name',
  // Date
  DATE_TIME:            'date / time',
  AGE:                  'age',
};

/**
 * Maps site hostnames to friendly product names for the report.
 */
const SITE_FRIENDLY: Record<string, string> = {
  'chat.openai.com':          'ChatGPT',
  'chatgpt.com':               'ChatGPT',
  'api.openai.com':            'OpenAI API',
  'gemini.google.com':         'Google Gemini',
  'bard.google.com':           'Google Gemini',
  'claude.ai':                 'Anthropic Claude',
  'api.anthropic.com':         'Anthropic Claude',
  'copilot.microsoft.com':     'Microsoft Copilot',
  'bing.com':                  'Microsoft Copilot',
  'mistral.ai':                'Mistral AI',
  'api.mistral.ai':            'Mistral AI',
  'meta.ai':                   'Meta AI',
  'ai.meta.com':               'Meta AI',
  'huggingface.co':            'Hugging Face',
  'api.cohere.ai':             'Cohere',
  'generativelanguage.googleapis.com': 'Google Gemini API',
  'qwen.aliyun.com':           'Qwen (Alibaba)',
  'dashscope.aliyuncs.com':    'Qwen API',
  'perplexity.ai':             'Perplexity AI',
  'you.com':                   'You.com AI',
  'poe.com':                   'Poe AI',
  'character.ai':              'Character.AI',
  'grok.x.ai':                 'Grok (xAI)',
  'api.x.ai':                  'Grok API',
  'background':                'browser background',
};

/** Returns friendly site name or capitalises the hostname. */
function friendlySite(site: string): string {
  if (SITE_FRIENDLY[site]) return SITE_FRIENDLY[site];
  // Strip www. and capitalise first letter
  const clean = site.replace(/^www\./, '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Returns "12 November 2026 at 12:40" from an ISO string. */
function friendlyDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day   = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year  = d.getFullYear();
    const h     = String(d.getHours()).padStart(2, '0');
    const m     = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} at ${h}:${m}`;
  } catch { return iso; }
}

/** Returns "3 November" from an ISO string (short version). */
function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })}`;
  } catch { return iso; }
}

/** Pluralise correctly — handles irregular English plurals used in the report */
function pl(n: number, word: string): string {
  if (n === 1) return `${n} ${word}`;
  // Handle common irregular/special cases in our report vocabulary
  const irregulars: Record<string, string> = {
    'piece of data':  'pieces of data',
    'hidden AI call': 'hidden AI calls',
    'hidden call':    'hidden calls',
    'hidden request': 'hidden requests',
    'different AI tool': 'different AI tools',
    'sensitive item': 'sensitive items',
    'sensitive piece of data': 'sensitive pieces of data',
  };
  if (irregulars[word]) return `${n} ${irregulars[word]}`;
  // Standard English pluralisation
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') ||
      word.endsWith('ch') || word.endsWith('sh')) {
    return `${n} ${word}es`;
  }
  return `${n} ${word}s`;
}

export interface PlainReportOptions {
  /** Customer / user name to greet. Defaults to 'there'. */
  customerName?: string;
  /** Whether the user has a Pro licence (affects what's included). */
  isPro?: boolean;
}

export interface PlainReportResult {
  /** The full plain-text report. */
  text: string;
  /** Period covered (ISO date strings). */
  fromDate: string;
  toDate: string;
  /** Summary numbers for the caller. */
  totalProtected: number;
  totalShadowAi:  number;
  uniqueSites:    number;
}

/**
 * Generates a plain-language protection report from the audit log.
 *
 * FREE tier  → concise 1-page summary (no event-by-event breakdown).
 * PRO tier   → full report with per-event narrative + peak moment analysis.
 *
 * SECURITY: reads only counts and types — zero PII values ever stored.
 * 100% offline — no network calls.
 *
 * @param storage  - Storage adapter (chrome.storage / localStorage).
 * @param options  - Display options (customer name, pro flag).
 * @param fromDate - Report start. Defaults to start of current month.
 * @param toDate   - Report end. Defaults to now.
 */
export async function generatePlainReport(
  storage: StorageAdapter,
  options: PlainReportOptions = {},
  fromDate?: Date,
  toDate?: Date,
): Promise<PlainReportResult> {
  const entries = await getAuditLog(storage);

  const from = fromDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to   = toDate   ?? new Date();

  // P0-5c FIX: Extract first name only from customerName for natural greeting.
  // "Karim Ben Salah" → "Karim". "AI CAGE Pro Customer" → "there" (fallback).
  // Raw customerName from license payload: "firstname lastname" or "Company Name".
  const rawName = options.customerName ?? '';
  const { customerName, isPro = false } = options;

  // Extract first word as first name, unless it looks like a system default
  const systemDefaults = ['ai cage pro customer', 'ai cage customer', 'demo customer', 'there', ''];
  const firstName = (rawName && !systemDefaults.includes(rawName.toLowerCase()))
    ? rawName.split(/\s+/)[0]
    : 'there';

  // ── Filter to range ───────────────────────────────────────────────────────
  const inRange = entries.filter((e) => {
    const t = new Date(e.timestamp);
    return t >= from && t <= to;
  });

  // P0-5b FIX: Exclude MEETING_TRANSCRIPT_MARKER events from cage totals.
  // meta.ai and other sites trigger transcript detection on their own UI text,
  // producing false-positive counts (e.g. "127 meeting markers" from meta.ai).
  // Transcript markers are only meaningful in Cage 5 (cageTranscript flow),
  // not in the general PII cage count reported to the user.
  const cageEvents = inRange.filter(e =>
    e.type === 'PII_CAGED' &&
    // Exclude events where ALL counts are MEETING_TRANSCRIPT_MARKER
    Object.keys(e.counts).some(k =>
      k !== 'MEETING_TRANSCRIPT_MARKER' && k !== 'MEETING_PARTICIPANT',
    ),
  );
  const shadowEvents = inRange.filter(e => e.type === 'SHADOW_AI_DETECTED');

  // P0-5e FIX: Dedup cage events at report level.
  // If the same (site, totalCount, same-day) appears more than once,
  // keep only the first occurrence. This catches cases where the
  // background dedup cache was reset (SW restart) between two rapid cages.
  const seenEventKeys = new Set<string>();
  const dedupedCageEvents = cageEvents.filter(e => {
    const day = e.timestamp.slice(0, 10); // YYYY-MM-DD
    const typeKey = Object.keys(e.counts).sort().join(',');
    const key = `${e.site}:${e.totalCount}:${day}:${typeKey}`;
    if (seenEventKeys.has(key)) return false;
    seenEventKeys.add(key);
    return true;
  });

  // ── Aggregate entity types ────────────────────────────────────────────────
  // Use dedupedCageEvents for all totals and breakdowns
  const entityCounts = new Map<string, number>();
  for (const e of dedupedCageEvents) {
    for (const [k, v] of Object.entries(e.counts)) {
      // P0-5b: skip transcript/participant counts in PII totals
      if (k === 'MEETING_TRANSCRIPT_MARKER' || k === 'MEETING_PARTICIPANT') continue;
      entityCounts.set(k, (entityCounts.get(k) ?? 0) + (v ?? 0));
    }
  }

  const totalProtected = dedupedCageEvents.reduce((s, e) => {
    // Only count non-transcript entity types
    const nonTranscriptCount = Object.entries(e.counts)
      .filter(([k]) => k !== 'MEETING_TRANSCRIPT_MARKER' && k !== 'MEETING_PARTICIPANT')
      .reduce((acc, [, v]) => acc + (v ?? 0), 0);
    return s + nonTranscriptCount;
  }, 0);
  const totalShadowAi  = shadowEvents.reduce((s, e) => s + e.totalCount, 0);

  // ── Unique sites ──────────────────────────────────────────────────────────
  const siteSet = new Set<string>();
  for (const e of dedupedCageEvents) siteSet.add(e.site);
  for (const e of shadowEvents)      siteSet.add(e.site);
  const uniqueSites = siteSet.size;

  // ── Date range label ──────────────────────────────────────────────────────
  const fromLabel = shortDate(from.toISOString());
  const toLabel   = shortDate(to.toISOString());
  const daysCount = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));

  // ── Entity breakdown (sorted by count desc, human labels) ─────────────────
  const sortedEntities = [...entityCounts.entries()]
    .sort((a, b) => b[1] - a[1]);

  const entityLines = sortedEntities
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, ' ');
      return `  - ${pl(v, label)}`;
    })
    .join('\n');

  // ── AI sites used (friendly names) ────────────────────────────────────────
  const siteCounts = new Map<string, number>();
  for (const e of dedupedCageEvents) {
    siteCounts.set(e.site, (siteCounts.get(e.site) ?? 0) + e.totalCount);
  }
  const siteList = [...siteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => friendlySite(s));

  const siteLabel = siteList.length === 0
    ? 'no AI tools yet'
    : siteList.length === 1
      ? siteList[0]
      : siteList.slice(0, -1).join(', ') + ' and ' + siteList.at(-1);

  // ── Peak event (largest single cage event) ────────────────────────────────
  const peakEvent = dedupedCageEvents.reduce<AuditEntry | null>(
    (best, e) => (!best || e.totalCount > best.totalCount) ? e : best,
    null,
  );

  // ── Shadow AI sites ───────────────────────────────────────────────────────
  const shadowSiteSet = new Set(shadowEvents.map(e => friendlySite(e.site)));
  const shadowLabel = [...shadowSiteSet].join(', ');

  // ── Build the report text ─────────────────────────────────────────────────

  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('AI CAGE — Protection Report');
  lines.push(`Period: ${fromLabel} to ${toLabel}`);
  if (isPro) {
    lines.push('Plan: Pro — Full Report');
  } else {
    lines.push('Plan: Free — Summary Report');
    lines.push('Upgrade to Pro for the full event-by-event breakdown.');
  }
  lines.push('='.repeat(60));
  lines.push('');

  // P0-5c FIX: Use firstName (extracted above) — never "AI CAGE Pro Customer"
  lines.push(`Hello ${firstName},`);
  lines.push('');
  lines.push(
    `Here is your AI CAGE protection report covering the last ${pl(daysCount, 'day')}.`,
  );
  lines.push('');

  // ── Summary section ───────────────────────────────────────────────────────
  lines.push('--- SUMMARY ---');
  lines.push('');

  if (totalProtected === 0 && totalShadowAi === 0) {
    lines.push('No activity recorded during this period.');
    lines.push('');
    lines.push(
      'AI CAGE is active and monitoring. As soon as you paste sensitive',
    );
    lines.push('data into an AI tool, it will be protected automatically.');
  } else {
    if (totalProtected > 0) {
      lines.push(
        `You almost shared ${pl(totalProtected, 'sensitive piece of data')} with AI tools.`,
      );
      lines.push(`AI CAGE protected all of them before they were sent.`);
      lines.push(`None of your real data ever left your device.`);
    }
    if (totalShadowAi > 0) {
      lines.push('');
      lines.push(
        `In addition, AI CAGE detected ${pl(totalShadowAi, 'hidden AI call')} ` +
        `that happened in your browser without you typing anything.`,
      );
      if (shadowLabel) {
        lines.push(`These came from: ${shadowLabel}.`);
      }
    }
  }

  lines.push('');

  // ── AI tools used ─────────────────────────────────────────────────────────
  if (siteList.length > 0) {
    lines.push('--- AI TOOLS USED ---');
    lines.push('');
    if (siteList.length === 1) {
      lines.push(`During this period you used 1 AI tool: ${siteList[0]}.`);
    } else {
      lines.push(
        `During this period you used ${pl(siteList.length, 'different AI tool')}: ${siteLabel}.`,
      );
    }
    lines.push('');
  }

  // ── Sensitive data breakdown ───────────────────────────────────────────────
  if (entityLines) {
    lines.push('--- WHAT WAS PROTECTED ---');
    lines.push('');
    lines.push(
      'Here is the breakdown of sensitive data that AI CAGE intercepted:',
    );
    lines.push('');
    lines.push(entityLines);
    lines.push('');
    lines.push(
      'Each of these items was replaced by a code before reaching the AI.',
    );
    lines.push(
      'The AI saw codes like [EMAIL_1] or [PERSON_1] — never your real data.',
    );
    lines.push('');
  }

  // ── Peak event (Pro only: full narrative; Free: teaser) ──────────────────
  if (peakEvent) {
    lines.push('--- MOST IMPORTANT MOMENT ---');
    lines.push('');

    if (isPro) {
      // Full narrative
      const when = friendlyDate(peakEvent.timestamp);
      const where = friendlySite(peakEvent.site);
      lines.push(
        `On ${when}, you pasted ${pl(peakEvent.totalCount, 'sensitive item')} ` +
        `into ${where} in a single action.`,
      );
      lines.push(
        `AI CAGE replaced all of them with protection codes instantly.`,
      );
      lines.push(`${where} never received any of your real data.`);

      // Entity breakdown for this event
      const peakEntityLines = Object.entries(peakEvent.counts)
        .filter(([, v]) => (v ?? 0) > 0)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .map(([k, v]) => {
          const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, ' ');
          return `  - ${pl(v ?? 0, label)}`;
        })
        .join('\n');

      if (peakEntityLines) {
        lines.push('');
        lines.push('In that single event:');
        lines.push(peakEntityLines);
      }
    } else {
      // Free tier — teaser only
      const where = friendlySite(peakEvent.site);
      lines.push(
        `Your most critical moment involved ${pl(peakEvent.totalCount, 'sensitive item')} ` +
        `sent to ${where}.`,
      );
      lines.push('');
      lines.push(
        '[Full event breakdown available with AI CAGE Pro]',
      );
      lines.push(
        'Pro gives you the exact date, time, and type of each protected item.',
      );
    }
    lines.push('');
  }

  // ── Pro: event-by-event log ───────────────────────────────────────────────
  if (isPro && dedupedCageEvents.length > 0) {
    lines.push('--- FULL EVENT LOG ---');
    lines.push('');
    lines.push(
      'Below is every protection event during this period, in chronological order.',
    );
    lines.push('');

    for (const e of dedupedCageEvents) {
      const when  = friendlyDate(e.timestamp);
      const where = friendlySite(e.site);
      lines.push(`> ${when} — ${where}`);
      lines.push(`  ${pl(e.totalCount, 'item')} protected.`);

      const detail = Object.entries(e.counts)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => {
          const label = ENTITY_LABELS[k] ?? k.toLowerCase().replace(/_/g, ' ');
          return `${v} ${label}`;
        })
        .join(', ');
      if (detail) lines.push(`  Types: ${detail}.`);
      lines.push('');
    }
  }

  // ── Shadow AI section (Pro only full details) ─────────────────────────────
  if (shadowEvents.length > 0) {
    lines.push('--- HIDDEN AI ACTIVITY ---');
    lines.push('');

    if (isPro) {
      lines.push(
        `AI CAGE detected ${pl(shadowEvents.length, 'hidden AI request')} ` +
        `that your browser sent without your direct input.`,
      );
      lines.push(
        'These are calls made by website scripts, browser extensions, or',
      );
      lines.push('background services connecting to AI APIs silently.');
      lines.push('');

      const shadowSiteMap = new Map<string, number>();
      for (const e of shadowEvents) {
        shadowSiteMap.set(
          friendlySite(e.site),
          (shadowSiteMap.get(friendlySite(e.site)) ?? 0) + 1,
        );
      }
      for (const [site, count] of [...shadowSiteMap.entries()].sort((a, b) => b[1] - a[1])) {
        lines.push(`  - ${site}: ${pl(count, 'hidden call')}`);
      }
    } else {
      lines.push(
        `AI CAGE detected ${pl(shadowEvents.length, 'hidden AI request')} in your browser.`,
      );
      lines.push('[Full hidden AI report available with AI CAGE Pro]');
    }
    lines.push('');
  }

  // ── Conclusion ────────────────────────────────────────────────────────────
  lines.push('--- CONCLUSION ---');
  lines.push('');

  if (totalProtected === 0 && totalShadowAi === 0) {
    lines.push('Nothing to report. AI CAGE is watching and ready.');
  } else if (totalProtected > 0) {
    lines.push('No data leak. Your sensitive data never left your device.');
    lines.push(
      `AI CAGE protected ${pl(totalProtected, 'item')} during this period.`,
    );
    lines.push('Every real value was replaced before reaching any AI server.');
  } else {
    lines.push('No PII was sent to AI tools this period.');
    if (totalShadowAi > 0) {
      lines.push(
        `However, ${pl(totalShadowAi, 'hidden AI call')} was detected.`,
      );
      lines.push('Consider reviewing the AI tools installed in your browser.');
    }
  }

  lines.push('');
  lines.push('Your AI protection assistant,');
  lines.push('AI CAGE');
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('Generated locally on your device — zero data sent to any server.');
  lines.push(`Report generated: ${friendlyDate(new Date().toISOString())}`);
  if (!isPro) {
    lines.push('');
    lines.push(
      'Want the full report with event-by-event details? Upgrade to Pro.',
    );
    lines.push('https://ai-cage-gamma.vercel.app/#pricing');
  }
  lines.push('='.repeat(60));

  return {
    text:           lines.join('\n'),
    fromDate:       from.toISOString(),
    toDate:         to.toISOString(),
    totalProtected,
    totalShadowAi,
    uniqueSites,
  };
}
