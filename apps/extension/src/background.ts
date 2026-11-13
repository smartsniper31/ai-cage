// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// Licensed under Business Source License 1.1 — see LICENSE
// Commercial use: contact@ai-cage.io

/**
 * @file background.ts
 * AI CAGE — MV3 Service Worker v0.6.0
 *
 * v0.6.0 changes:
 *   - P0-6: onInstalled → opens welcome.html on first install
 *   - webRequest 'responseHeaders' removed (not available in MV3 Chrome)
 *   - Use onBeforeRequest (works in MV3) for Shadow AI detection
 *   - Graceful fallback if webRequest unavailable
 *   - Version unified to 0.6.0
 */

import { summariseCaged, matchAiEndpoint, logEvent, getAuditLog, getAuditSummary, exportAuditLogCSV, generatePlainReport, checkLicense } from '@ai-cage/core';
import type { CagedEntity, AuditEntry, InferenceRisk } from '@ai-cage/core';

// ---------------------------------------------------------------------------
// Chrome storage adapter — wraps chrome.storage.local as a StorageAdapter
// ---------------------------------------------------------------------------

const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    const val = result[key];
    return typeof val === 'string' ? val : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
};

// ---------------------------------------------------------------------------
// Session-only in-memory state (badge counters, reset on SW restart)
// ---------------------------------------------------------------------------

let sessionCageCount   = 0;
let sessionShadowCount = 0;
const tabCageCounts    = new Map<number, number>();

// Last inference risk detected — updated on every CAGE_REPORT, returned in GET_STATS
// so the popup Overview can display it without an extra round-trip.
let lastInferenceRisk: InferenceRisk | null = null;

// ---------------------------------------------------------------------------
// C2 — Deduplication cache: prevents double-counting the same cage event
// that arrives twice (once from content.ts DOM intercept, once from
// injected.ts network intercept).
//
// P0-5 FIX: Extended window to 5s (was 2s) — real-world tests showed
// content.ts and injected.ts can be 3-4s apart on slow pages.
// Key now includes a sorted entity-type hash so two genuinely different
// events with the same count on the same site are not incorrectly deduped.
// ---------------------------------------------------------------------------
const cageDedupeCache = new Map<string, number>();
const CAGE_DEDUPE_WINDOW_MS = 5000; // 5 seconds

function isDuplicateCageEvent(
  site: string,
  totalCount: number,
  entities: CagedEntity[],
): boolean {
  // Build a stable type fingerprint: sorted comma-separated entity types
  const typeFingerprint = entities
    .map(e => e.type)
    .sort()
    .join(',');
  const key = `${site}:${totalCount}:${typeFingerprint}`;
  const now = Date.now();
  const last = cageDedupeCache.get(key);
  if (last !== undefined && now - last < CAGE_DEDUPE_WINDOW_MS) {
    return true; // duplicate — skip
  }
  cageDedupeCache.set(key, now);
  // Evict entries older than the window to avoid memory growth
  for (const [k, t] of cageDedupeCache) {
    if (now - t > CAGE_DEDUPE_WINDOW_MS * 10) cageDedupeCache.delete(k);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Message protocol (background ↔ content ↔ popup)
// ---------------------------------------------------------------------------

interface CageReportMessage {
  type: 'CAGE_REPORT';
  tabId: number;
  site: string;
  entities: CagedEntity[];
  inferenceRisk?: InferenceRisk;
}

interface GetStatsMessage {
  type: 'GET_STATS';
  tabId?: number;
}

interface GetShadowLogMessage {
  type: 'GET_SHADOW_LOG';
}

interface GetAuditLogMessage {
  type: 'GET_AUDIT_LOG';
}

interface ExportAuditCSVMessage {
  type: 'EXPORT_AUDIT_CSV';
}

interface GetPlainReportMessage {
  type: 'GET_PLAIN_REPORT';
}

type IncomingMessage =
  | CageReportMessage
  | GetStatsMessage
  | GetShadowLogMessage
  | GetAuditLogMessage
  | ExportAuditCSVMessage
  | GetPlainReportMessage;

// ---------------------------------------------------------------------------
// Cage 1: Handle PII cage reports from content.ts
// ---------------------------------------------------------------------------

async function handleCageReport(
  msg: CageReportMessage,
  tabId: number,
): Promise<void> {
  const count = msg.entities.length;

  // Store inference risk from this report (may be risky even if count === 0)
  if (msg.inferenceRisk) {
    lastInferenceRisk = msg.inferenceRisk;
  }

  // C2 — Skip if this is a duplicate event (same site + count + types within 5s)
  if (count > 0 && isDuplicateCageEvent(msg.site, count, msg.entities)) {
    console.warn(`[AI CAGE] ⏭ Skipping duplicate cage event: ${count} items on ${msg.site}`);
    sessionCageCount += count;
    tabCageCounts.set(tabId, (tabCageCounts.get(tabId) ?? 0) + count);
    await updateBadge(tabId, tabCageCounts.get(tabId) ?? 0);
    return;
  }

  sessionCageCount += count;
  tabCageCounts.set(tabId, (tabCageCounts.get(tabId) ?? 0) + count);
  await updateBadge(tabId, tabCageCounts.get(tabId) ?? 0);

  const counts: Record<string, number> = {};
  for (const e of msg.entities) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }

  await logEvent(
    { type: 'PII_CAGED', site: msg.site, counts, totalCount: count },
    chromeStorageAdapter,
  );

  const summary = summariseCaged(msg.entities);
  console.warn(`[AI CAGE] 🔒 Caged ${count} item(s) on ${msg.site}:`, summary);
}

// ---------------------------------------------------------------------------
// Cage 2: Shadow AI detection — now inline in registerShadowAiObserver
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// C3 — Shadow AI cooldown: same hostname logged at most once per 5 minutes.
// ChatGPT and other AI sites make dozens of background polling requests per
// session. Without this guard, the audit log fills with hundreds of identical
// SHADOW_AI_DETECTED entries that confuse users and bloat the CSV.
// ---------------------------------------------------------------------------
const shadowCooldownCache = new Map<string, number>();
const SHADOW_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isShadowCoolingDown(hostname: string): boolean {
  const now  = Date.now();
  const last = shadowCooldownCache.get(hostname);
  if (last !== undefined && now - last < SHADOW_COOLDOWN_MS) {
    return true; // already logged recently — skip
  }
  shadowCooldownCache.set(hostname, now);
  return false;
}

/**
 * Register the webRequest listener for Shadow AI detection.
 * MV3 FIX: Use onBeforeRequest (works in MV3).
 * onCompleted with 'responseHeaders' is NOT available in MV3 Chrome.
 */
function registerShadowAiObserver(): void {
  if (!chrome.webRequest) {
    console.warn('[AI CAGE] webRequest API not available — Shadow AI detection disabled.');
    return;
  }

  try {
    chrome.webRequest.onBeforeRequest.addListener(
      (details: chrome.webRequest.WebRequestBodyDetails) => {
        const url = details.url;
        const matches = matchAiEndpoint(url);
        if (matches.length === 0) return;

        sessionShadowCount += 1;

        const counts: Record<string, number> = {};
        for (const m of matches) counts[m.id] = (counts[m.id] ?? 0) + 1;

        const hostnameMatch = /^https?:\/\/([^/:?#]+)/i.exec(url);
        const hostname = hostnameMatch?.[1] ?? url;

        // C3 — Skip if this hostname was already logged within the last 5 min
        if (isShadowCoolingDown(hostname)) {
          return;
        }

        const initiator = details.initiator ?? 'unknown';

        void logEvent(
          {
            type: 'SHADOW_AI_DETECTED',
            site: hostname,
            counts,
            totalCount: matches.length,
            detail: `Initiator: ${initiator} | Risk: ${matches[0]?.riskLevel ?? 'unknown'} | Product: ${matches[0]?.name ?? url}`,
          },
          chromeStorageAdapter,
        );

        console.warn(`[AI CAGE] ⚠️ Shadow AI: ${matches[0]?.name ?? url} (${matches[0]?.riskLevel ?? 'unknown'})`);
        void updateGlobalBadge();
      },
      { urls: ['<all_urls>'] },
    );
    console.warn('[AI CAGE] Shadow AI observer registered (MV3 onBeforeRequest).');
  } catch (err) {
    console.warn('[AI CAGE] Shadow AI registration failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

async function updateBadge(tabId: number, count: number): Promise<void> {
  const text = count > 0 ? String(count) : '';
  try {
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#16a34a' });
  } catch {
    // Tab may have been closed
  }
}

async function updateGlobalBadge(): Promise<void> {
  const total = sessionCageCount + sessionShadowCount;
  const text  = total > 0 ? String(total) : '';
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({
      color: sessionShadowCount > 0 ? '#dc2626' : '#16a34a',
    });
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse) => {
    const msg = message as IncomingMessage;

    if (msg.type === 'AGENT_EVENT') {
      const agentMsg = msg as { type: string; site: string; detail: string; blocked: boolean };
      void logEvent(
        {
          type: 'AGENT_TOOL_CALL' as never,
          site: agentMsg.site,
          counts: { blocked: agentMsg.blocked ? 1 : 0 },
          totalCount: 1,
          detail: agentMsg.detail,
        },
        chromeStorageAdapter,
      );
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'CAGE_REPORT') {
      const tabId = sender.tab?.id ?? msg.tabId;
      void handleCageReport(msg, tabId).then(() => {
        sendResponse({ ok: true, sessionTotal: sessionCageCount });
      });
      return true;
    }

    if (msg.type === 'GET_STATS') {
      const tabId = msg.tabId ?? 0;
      void getAuditSummary(chromeStorageAdapter).then((summary) => {
        sendResponse({
          sessionCageCount,
          sessionShadowCount,
          tabCount:          tabCageCounts.get(tabId) ?? 0,
          monthlyPiiCaged:   summary.totalCaged,
          monthlyShadowAi:   summary.totalShadowAi,
          topSites:          summary.topSites,
          inferenceRisk:     lastInferenceRisk,
        });
      });
      return true;
    }

    if (msg.type === 'GET_SHADOW_LOG') {
      void getAuditLog(chromeStorageAdapter).then((entries) => {
        const shadowEntries = entries
          .filter((e: AuditEntry) => e.type === 'SHADOW_AI_DETECTED')
          .slice(-100); // last 100
        sendResponse({ entries: shadowEntries });
      });
      return true;
    }

    if (msg.type === 'GET_AUDIT_LOG') {
      void getAuditLog(chromeStorageAdapter).then((entries: AuditEntry[]) => {
        sendResponse({ entries: entries.slice(-200) }); // last 200
      });
      return true;
    }

    if (msg.type === 'EXPORT_AUDIT_CSV') {
      void exportAuditLogCSV(chromeStorageAdapter).then((csv: string) => {
        sendResponse({ csv });
      });
      return true;
    }

    if (msg.type === 'GET_PLAIN_REPORT') {
      // Check license to know if full Pro report is unlocked
      void checkLicense(chromeStorageAdapter, 0).then(async (licInfo) => {
        const isPro = licInfo.tier === 'PRO' || licInfo.tier === 'ENTERPRISE';
        const customerName = licInfo.payload?.customer ?? 'there';
        const result = await generatePlainReport(
          chromeStorageAdapter,
          { isPro, customerName },
        );
        sendResponse({ report: result.text, isPro });
      });
      return true;
    }
  },
);

// ---------------------------------------------------------------------------
// Tab lifecycle
// ---------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCageCounts.delete(tabId);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// P0-6: Open welcome page on first install
// C4: Only log EXTENSION_STARTED on genuine install — not on every SW restart.
// MV3 service workers restart every ~30s of inactivity. Logging on every
// restart produced 20+ identical entries per session and cluttered the CSV.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    // Log only on real first install
    void logEvent(
      {
        type: 'EXTENSION_STARTED',
        site: 'background',
        counts: {},
        totalCount: 0,
        detail: 'First install',
      },
      chromeStorageAdapter,
    );
  }
});

registerShadowAiObserver();

console.warn('[AI CAGE] Background service worker v0.6.0 — Cage 1+2+3 active.');
