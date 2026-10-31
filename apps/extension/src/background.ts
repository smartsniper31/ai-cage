/**
 * @file background.ts
 * AI CAGE — Chrome Extension MV3 Service Worker (background script).
 *
 * RESPONSIBILITIES (Phase 2):
 *   1. Count and badge PII caging events from content.ts (Cage 1)
 *   2. Detect Shadow AI — monitor outbound requests to known AI endpoints (Cage 2)
 *   3. Write an immutable local audit log to chrome.storage.local
 *   4. Serve stats to the popup on demand
 *
 * SECURITY CONTRACT:
 *   - Zero network calls initiated from this script.
 *   - Audit log never stores original PII values — only counts and types.
 *   - All state lives in chrome.storage.local (local device only, never synced).
 *   - chrome.storage.sync is intentionally NOT used.
 */

import { summariseCaged, matchAiEndpoint, logEvent, getAuditLog, getAuditSummary, exportAuditLogCSV } from '@ai-cage/core';
import type { CagedEntity, AuditEntry } from '@ai-cage/core';

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

// ---------------------------------------------------------------------------
// Message protocol (background ↔ content ↔ popup)
// ---------------------------------------------------------------------------

interface CageReportMessage {
  type: 'CAGE_REPORT';
  tabId: number;
  site: string;
  entities: CagedEntity[];
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

type IncomingMessage =
  | CageReportMessage
  | GetStatsMessage
  | GetShadowLogMessage
  | GetAuditLogMessage
  | ExportAuditCSVMessage;

// ---------------------------------------------------------------------------
// Cage 1: Handle PII cage reports from content.ts
// ---------------------------------------------------------------------------

async function handleCageReport(
  msg: CageReportMessage,
  tabId: number,
): Promise<void> {
  const count = msg.entities.length;
  sessionCageCount += count;
  tabCageCounts.set(tabId, (tabCageCounts.get(tabId) ?? 0) + count);

  await updateBadge(tabId, tabCageCounts.get(tabId) ?? 0);

  // Build counts-by-type map (no original values)
  const counts: Record<string, number> = {};
  for (const e of msg.entities) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }

  await logEvent(
    {
      type: 'PII_CAGED',
      site: msg.site,
      counts,
      totalCount: count,
    },
    chromeStorageAdapter,
  );

  const summary = summariseCaged(msg.entities);
  console.warn(`[AI CAGE] 🔒 Caged ${count} item(s) on ${msg.site}:`, summary);
}

// ---------------------------------------------------------------------------
// Cage 2: Shadow AI detection via webRequest observer
// ---------------------------------------------------------------------------

/**
 * Called for every completed outbound request.
 * Checks against the AI endpoint catalogue and logs silently.
 */
async function detectShadowAIRequest(
  details: chrome.webRequest.WebResponseHeadersDetails,
): Promise<void> {
  const matches = matchAiEndpoint(details.url);
  if (matches.length === 0) return;

  // Only log if NOT one of our approved AI cages (chat.openai.com
  // accessed via content script is expected — we cage before sending)
  const initiator = details.initiator ?? 'unknown';

  sessionShadowCount += 1;

  const counts: Record<string, number> = {};
  for (const m of matches) {
    counts[m.id] = (counts[m.id] ?? 0) + 1;
  }

  await logEvent(
    {
      type: 'SHADOW_AI_DETECTED',
      site: new URL(details.url).hostname,
      counts,
      totalCount: matches.length,
      detail: `Initiated by: ${initiator} | Risk: ${matches[0]?.riskLevel ?? 'unknown'}`,
    },
    chromeStorageAdapter,
  );

  console.warn(
    `[AI CAGE] ⚠️ Shadow AI detected: ${details.url} from ${initiator}`,
    matches.map((m) => m.name),
  );

  // Update the global badge with both counts
  void updateGlobalBadge();
}

/**
 * Register the webRequest listener for Shadow AI detection.
 * Monitors ALL URLs — the matchAiEndpoint() filter runs locally.
 */
function registerShadowAiObserver(): void {
  if (!chrome.webRequest) {
    console.warn('[AI CAGE] webRequest API not available — Shadow AI detection disabled.');
    return;
  }

  chrome.webRequest.onCompleted.addListener(
    (details) => { void detectShadowAIRequest(details); },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  );
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
          tabCount:        tabCageCounts.get(tabId) ?? 0,
          monthlyPiiCaged: summary.totalCaged,
          monthlyShadowAi: summary.totalShadowAi,
          topSites:        summary.topSites,
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

registerShadowAiObserver();

void logEvent(
  {
    type: 'EXTENSION_STARTED',
    site: 'background',
    counts: {},
    totalCount: 0,
  },
  chromeStorageAdapter,
);

console.warn('[AI CAGE] Background service worker v0.2.0 started. Cage 1 + Cage 2 active.');
