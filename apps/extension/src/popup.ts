/**
 * @file popup.ts
 * AI CAGE Extension Popup — Phase 2.
 *
 * Two tabs:
 *   1. Overview — PII caged stats + session / monthly counters
 *   2. Shadow AI — list of AI endpoints detected calling from this browser
 */

interface StatsResponse {
  sessionCageCount:  number;
  sessionShadowCount: number;
  tabCount:          number;
  monthlyPiiCaged:   number;
  monthlyShadowAi:   number;
  topSites: Array<{ site: string; count: number }>;
}

interface ShadowLogResponse {
  entries: Array<{
    id: number;
    timestamp: string;
    site: string;
    counts: Record<string, number>;
    totalCount: number;
    detail?: string;
  }>;
}

interface ExportCSVResponse {
  csv: string;
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function activateTab(tabId: 'overview' | 'shadow' | 'agent'): void {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    (pane as HTMLElement).style.display = 'none';
  });

  const btn  = document.getElementById(`tab-${tabId}`);
  const pane = document.getElementById(`pane-${tabId}`);
  if (btn)  btn.classList.add('active');
  if (pane) (pane as HTMLElement).style.display = 'block';
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

async function renderOverview(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id ?? 0;

  const resp = await chrome.runtime.sendMessage<{ type: string; tabId: number }, StatsResponse>(
    { type: 'GET_STATS', tabId },
  );

  setText('session-count',  resp?.sessionCageCount  ?? 0);
  setText('tab-count',      resp?.tabCount          ?? 0);
  setText('monthly-caged',  resp?.monthlyPiiCaged   ?? 0);
  setText('monthly-shadow', resp?.monthlyShadowAi   ?? 0);

  const status = document.getElementById('status-text');
  if (status) {
    if ((resp?.sessionShadowCount ?? 0) > 0) {
      status.textContent = '⚠️ Shadow AI detected';
      status.style.background = '#fef2f2';
      status.style.color = '#991b1b';
      status.style.borderColor = '#fecaca';
    } else if ((resp?.sessionCageCount ?? 0) > 0) {
      status.textContent = '🔒 Protecting your data';
    } else {
      status.textContent = '✅ Monitoring — no PII detected yet';
    }
  }

  // Top sites
  const sitesEl = document.getElementById('top-sites');
  if (sitesEl && resp?.topSites?.length) {
    sitesEl.innerHTML = resp.topSites
      .slice(0, 5)
      .map((s) => `<li><span class="site-name">${escHtml(s.site)}</span><span class="site-count">${s.count}</span></li>`)
      .join('');
  }
}

// ---------------------------------------------------------------------------
// Shadow AI tab
// ---------------------------------------------------------------------------

async function renderShadowAi(): Promise<void> {
  const resp = await chrome.runtime.sendMessage<{ type: string }, ShadowLogResponse>(
    { type: 'GET_SHADOW_LOG' },
  );

  const listEl = document.getElementById('shadow-list');
  if (!listEl) return;

  const entries = resp?.entries ?? [];
  if (entries.length === 0) {
    listEl.innerHTML = '<li class="empty">No shadow AI calls detected yet.<br>Keep browsing — AI is everywhere.</li>';
    return;
  }

  // Aggregate by site
  const bysite = new Map<string, { count: number; lastSeen: string; detail: string }>();
  for (const e of entries) {
    const existing = bysite.get(e.site);
    if (existing) {
      existing.count += e.totalCount;
      if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
    } else {
      bysite.set(e.site, {
        count:    e.totalCount,
        lastSeen: e.timestamp,
        detail:   e.detail ?? '',
      });
    }
  }

  listEl.innerHTML = [...bysite.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([site, info]) => `
      <li class="shadow-item">
        <div class="shadow-site">${escHtml(site)}</div>
        <div class="shadow-meta">${info.count} call(s) · ${formatDate(info.lastSeen)}</div>
        <div class="shadow-detail">${escHtml(info.detail)}</div>
      </li>`)
    .join('');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function exportCSV(): Promise<void> {
  const resp = await chrome.runtime.sendMessage<{ type: string }, ExportCSVResponse>(
    { type: 'EXPORT_AUDIT_CSV' },
  );

  if (!resp?.csv) {
    alert('Audit log is empty.');
    return;
  }

  const blob = new Blob([resp.csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ai-cage-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setText(id: string, value: number | string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Tab buttons
  document.getElementById('tab-overview')?.addEventListener('click', () => {
    activateTab('overview');
    void renderOverview();
  });
  document.getElementById('tab-shadow')?.addEventListener('click', () => {
    activateTab('shadow');
    void renderShadowAi();
  });
  document.getElementById('tab-agent')?.addEventListener('click', () => {
    activateTab('agent');
    void renderAgentTab();
  });

  // Export button
  document.getElementById('export-btn')?.addEventListener('click', () => {
    void exportCSV();
  });

  // Default tab
  activateTab('overview');
  void renderOverview();
});

// ---------------------------------------------------------------------------
// Agent tab
// ---------------------------------------------------------------------------

async function renderAgentTab(): Promise<void> {
  // Load agent-specific events from audit log
  const resp = await chrome.runtime.sendMessage<{ type: string }, { entries: Array<{ type: string; site: string; totalCount: number; detail?: string; timestamp: string; counts: Record<string, number> }> }>(
    { type: 'GET_AUDIT_LOG' },
  );

  const entries = resp?.entries ?? [];

  // Agent tool call events
  const agentEvents = entries
    .filter((e) => e.type === 'AGENT_TOOL_CALL' || e.type === 'POLICY_VIOLATION')
    .slice(-20)
    .reverse();

  // Count blocked injections and exfil attempts from detail strings
  const blockedInjections = agentEvents.filter((e) =>
    (e.detail ?? '').includes('BLOCKED_INJECTION') ||
    (e.detail ?? '').includes('injections=') && !(e.detail ?? '').includes('injections=0'),
  ).length;

  const exfilAttempts = agentEvents.filter((e) =>
    (e.detail ?? '').includes('BLOCKED_DOMAIN') ||
    (e.detail ?? '').includes('exfil'),
  ).length;

  setText('agent-blocked', blockedInjections);
  setText('agent-exfil', exfilAttempts);

  const listEl = document.getElementById('agent-events');
  if (!listEl) return;

  if (agentEvents.length === 0) {
    listEl.innerHTML = '<li style="font-size:11px;color:#64748b;padding:8px 0">No agent events recorded yet.</li>';
    return;
  }

  listEl.innerHTML = agentEvents.map((e) => {
    const isBlocked = (e.detail ?? '').includes('BLOCKED');
    const color = isBlocked ? '#dc2626' : '#16a34a';
    const icon  = isBlocked ? '🚫' : '✅';
    return `
      <li style="padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:11px">
        <span style="color:${color};font-weight:700">${icon} ${escHtml(e.type)}</span>
        <span style="color:#64748b;float:right">${formatDate(e.timestamp)}</span>
        <div style="color:#64748b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(e.detail ?? '')}</div>
      </li>`;
  }).join('');
}
