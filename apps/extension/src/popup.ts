/**
 * @file popup.ts
 * AI CAGE Extension Popup v0.6.0
 *
 * Tabs:
 *   1. Overview  — PII caged stats + free-tier progress bar + upgrade flow
 *   2. Shadow AI — AI endpoints detected calling from this browser
 *   3. Agent     — Injection events (Pro feature lock shown for Free users)
 *
 * Upgrade flow:
 *   - Progress bar shows free tier usage (0 → 100 cages/month)
 *   - At  80 cages → amber warning + inline upgrade banner appears
 *   - At 100 cages → full watermark + all upgrade CTAs open pricing page
 *   - Agent tab → locked notice for Free users with upgrade CTA
 */

const UPGRADE_URL    = 'https://ai-cage-gamma.vercel.app/#pricing';
const RELEASES_URL   = 'https://github.com/smartsniper31/ai-cage/releases';
const VERSION_URL    = 'https://ai-cage-gamma.vercel.app/version.json';
const FREE_LIMIT     = 100;
const WARN_AT        = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsResponse {
  sessionCageCount:   number;
  sessionShadowCount: number;
  tabCount:           number;
  monthlyPiiCaged:    number;
  monthlyShadowAi:    number;
  topSites: Array<{ site: string; count: number }>;
}

interface ShadowLogResponse {
  entries: Array<{
    id:         number;
    timestamp:  string;
    site:       string;
    counts:     Record<string, number>;
    totalCount: number;
    detail?:    string;
  }>;
}

interface ExportCSVResponse { csv: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  } catch { return iso; }
}

function openUpgrade(): void {
  void chrome.tabs.create({ url: UPGRADE_URL });
}

// ─── Tab switching ─────────────────────────────────────────────────────────────

function activateTab(tabId: 'overview' | 'shadow' | 'agent'): void {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => {
    (pane as HTMLElement).style.display = 'none';
  });
  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  const pane = document.getElementById(`pane-${tabId}`);
  if (pane) pane.style.display = 'block';
}

// ─── Free-tier progress bar ────────────────────────────────────────────────────

function renderProgress(monthly: number): void {
  const pct   = Math.min(100, Math.round((monthly / FREE_LIMIT) * 100));
  const left  = Math.max(0, FREE_LIMIT - monthly);

  // Count label
  const countEl = document.getElementById('free-progress-count');
  if (countEl) {
    countEl.textContent = `${monthly} / ${FREE_LIMIT}`;
    countEl.className   = 'free-progress-count';
    if (monthly >= FREE_LIMIT) countEl.classList.add('danger');
    else if (monthly >= WARN_AT) countEl.classList.add('warning');
  }

  // Bar fill
  const barEl = document.getElementById('progress-bar-fill');
  if (barEl) {
    (barEl as HTMLElement).style.width = `${pct}%`;
    barEl.className = 'progress-bar-fill';
    if (monthly >= FREE_LIMIT) barEl.classList.add('danger');
    else if (monthly >= WARN_AT) barEl.classList.add('warning');
  }

  // Upgrade banner — show when approaching limit
  const bannerEl = document.getElementById('upgrade-banner');
  if (bannerEl) {
    if (monthly >= WARN_AT && monthly < FREE_LIMIT) {
      bannerEl.classList.add('show');
      const subEl = bannerEl.querySelector('.upgrade-banner-sub');
      if (subEl) {
        subEl.innerHTML = `You have <strong>${left} cage${left === 1 ? '' : 's'} left</strong> this month on the Free plan.<br>
          Upgrade to Pro for <strong>unlimited protection</strong> — €5/user/month.`;
      }
    } else {
      bannerEl.classList.remove('show');
    }
  }

  // Full watermark when limit reached
  const wm = document.getElementById('watermark');
  if (wm) (wm as HTMLElement).style.display = monthly >= FREE_LIMIT ? 'block' : 'none';
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

async function renderOverview(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id ?? 0;

  const resp = await chrome.runtime.sendMessage<
    { type: string; tabId: number },
    StatsResponse
  >({ type: 'GET_STATS', tabId });

  const monthly = resp?.monthlyPiiCaged   ?? 0;
  const session = resp?.sessionCageCount  ?? 0;
  const shadow  = resp?.sessionShadowCount ?? 0;
  const tabCnt  = resp?.tabCount          ?? 0;

  // Stats
  setText('monthly-caged',  monthly);
  setText('monthly-shadow', resp?.monthlyShadowAi ?? 0);
  setText('session-count',  session);
  setText('tab-count',      tabCnt);

  // Progress bar + upgrade flow
  renderProgress(monthly);

  // Status pill
  const statusEl = document.getElementById('status-text');
  if (statusEl) {
    // Reset styles
    statusEl.style.background   = '';
    statusEl.style.color        = '';
    statusEl.style.borderColor  = '';

    if (monthly >= FREE_LIMIT) {
      // Limit hit — urgent upgrade
      statusEl.textContent  = '🔶 Monthly limit reached — upgrade for unlimited cages';
      statusEl.style.background  = '#fef3c7';
      statusEl.style.color       = '#92400e';
      statusEl.style.borderColor = '#fde68a';
    } else if (shadow > 0) {
      // Shadow AI detected — red alert
      statusEl.textContent  = `⚠️ Shadow AI detected — ${shadow} suspicious call${shadow > 1 ? 's' : ''}`;
      statusEl.style.background  = '#fef2f2';
      statusEl.style.color       = '#991b1b';
      statusEl.style.borderColor = '#fecaca';
    } else if (monthly >= WARN_AT) {
      // Warning zone
      statusEl.textContent  = `⚡ ${FREE_LIMIT - monthly} free cage${FREE_LIMIT - monthly === 1 ? '' : 's'} left this month — upgrade soon`;
      statusEl.style.background  = '#fffbeb';
      statusEl.style.color       = '#92400e';
      statusEl.style.borderColor = '#fde68a';
    } else if (session > 0) {
      // Active this session
      statusEl.textContent  = `🔒 Active — ${session} item${session > 1 ? 's' : ''} protected this session`;
    } else if (monthly > 0) {
      // Previously used this month
      statusEl.textContent  = `✅ Active — ${monthly} item${monthly > 1 ? 's' : ''} protected this month`;
    } else {
      // Brand new / nothing yet
      statusEl.textContent = '🛡️ Monitoring — type a prompt on an AI site to test';
    }
  }

  // Top sites
  const sitesEl = document.getElementById('top-sites');
  if (sitesEl) {
    if (resp?.topSites?.length) {
      sitesEl.innerHTML = resp.topSites
        .slice(0, 5)
        .map(s => `
          <li>
            <span class="site-name">${escHtml(s.site)}</span>
            <span class="site-count">${s.count}</span>
          </li>`)
        .join('');
    } else {
      sitesEl.innerHTML = `
        <li class="empty">
          No activity yet.<br>
          <strong style="color:#15803d">
            Go to ChatGPT and type your email — watch it get protected.
          </strong>
        </li>`;
    }
  }
}

// ─── Shadow AI tab ─────────────────────────────────────────────────────────────

async function renderShadowAi(): Promise<void> {
  const resp = await chrome.runtime.sendMessage<{ type: string }, ShadowLogResponse>(
    { type: 'GET_SHADOW_LOG' },
  );

  const listEl = document.getElementById('shadow-list');
  if (!listEl) return;

  const entries = resp?.entries ?? [];
  if (entries.length === 0) {
    listEl.innerHTML = `
      <li class="empty">
        No hidden AI calls detected yet.<br>
        Keep browsing — we're watching for you.
      </li>`;
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

  // Render — each item toggles detail on click
  listEl.innerHTML = [...bysite.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([site, info]) => `
      <li class="shadow-item"
          onclick="var d=this.querySelector('.shadow-detail');d.classList.toggle('expanded');"
          title="Click to expand">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="shadow-site">${escHtml(site)}</div>
          <div style="font-size:10px;color:#64748b">
            ${info.count} call${info.count > 1 ? 's' : ''} · ${formatDate(info.lastSeen)} ▾
          </div>
        </div>
        <div class="shadow-detail">${escHtml(info.detail)}</div>
      </li>`)
    .join('');
}

// ─── Agent tab ─────────────────────────────────────────────────────────────────

async function renderAgentTab(): Promise<void> {
  const resp = await chrome.runtime.sendMessage<
    { type: string },
    { entries: Array<{
        type: string; site: string; totalCount: number;
        detail?: string; timestamp: string; counts: Record<string, number>
    }> }
  >({ type: 'GET_AUDIT_LOG' });

  const entries     = resp?.entries ?? [];
  const agentEvents = entries
    .filter(e => e.type === 'AGENT_TOOL_CALL' || e.type === 'POLICY_VIOLATION')
    .slice(-20)
    .reverse();

  const blockedInjections = agentEvents.filter(e =>
    (e.detail ?? '').includes('BLOCKED_INJECTION') ||
    ((e.detail ?? '').includes('injections=') && !(e.detail ?? '').includes('injections=0')),
  ).length;

  const exfilAttempts = agentEvents.filter(e =>
    (e.detail ?? '').includes('BLOCKED_DOMAIN') ||
    (e.detail ?? '').includes('exfil'),
  ).length;

  setText('agent-blocked', blockedInjections);
  setText('agent-exfil',   exfilAttempts);

  // Show locked notice if no events AND Free tier (heuristic: no agent events ever)
  const lockedEl = document.getElementById('agent-locked-notice');
  if (lockedEl) {
    lockedEl.style.display = agentEvents.length === 0 ? 'block' : 'none';
  }

  const listEl = document.getElementById('agent-events');
  if (!listEl) return;

  if (agentEvents.length === 0) {
    listEl.innerHTML = `
      <li style="font-size:11px;color:#64748b;padding:8px 0;line-height:1.6">
        No agent events recorded yet.<br>
        Agent Cage monitors AI tool calls in real-time.
      </li>`;
    return;
  }

  listEl.innerHTML = agentEvents.map(e => {
    const isBlocked = (e.detail ?? '').includes('BLOCKED');
    const color     = isBlocked ? '#dc2626' : '#16a34a';
    const icon      = isBlocked ? '🚫' : '✅';
    return `
      <li style="padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:11px">
        <span style="color:${color};font-weight:700">${icon} ${escHtml(e.type)}</span>
        <span style="color:#64748b;float:right">${formatDate(e.timestamp)}</span>
        <div style="color:#64748b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escHtml(e.detail ?? '')}
        </div>
      </li>`;
  }).join('');
}

// ─── Export CSV ────────────────────────────────────────────────────────────────

async function exportCSV(): Promise<void> {
  const resp = await chrome.runtime.sendMessage<{ type: string }, ExportCSVResponse>(
    { type: 'EXPORT_AUDIT_CSV' },
  );

  if (!resp?.csv) {
    alert('Audit log is empty — protect some data first, then export.');
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

// ─── Update checker ───────────────────────────────────────────────────────────
/**
 * Fetches version.json from Vercel (static file, no user data sent).
 * Compares with installed version from manifest.
 * If newer version available → shows blue "🆕 Update available" badge in header.
 *
 * Privacy note: this fetch sends ZERO user data — it only reads a public
 * static file. It runs only in the popup context, never in content.ts or core.
 * The request is indistinguishable from a normal page visit.
 */
async function checkForUpdates(installedVersion: string): Promise<void> {
  try {
    const res  = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json() as { version?: string; releaseUrl?: string };
    const latest = data.version ?? '';
    if (!latest || latest === installedVersion) return;

    // Compare semver simply: split by '.' and compare numerically
    const toNum = (v: string) => v.split('.').map(Number);
    const [iMaj, iMin, iPat] = toNum(installedVersion);
    const [lMaj, lMin, lPat] = toNum(latest);
    const isNewer =
      lMaj > iMaj ||
      (lMaj === iMaj && lMin > iMin) ||
      (lMaj === iMaj && lMin === iMin && lPat > iPat);
    if (!isNewer) return;

    // Show update badge
    const badge = document.getElementById('update-badge');
    if (badge) {
      badge.textContent = `🆕 v${latest} available`;
      badge.classList.add('show');
      badge.addEventListener('click', () => {
        void chrome.tabs.create({ url: data.releaseUrl ?? RELEASES_URL });
      });
    }

    // Also show a notice below the status pill
    const notice = document.createElement('div');
    notice.id = 'update-notice';
    notice.style.cssText = [
      'margin:8px 12px 0',
      'background:#eff6ff',
      'border:1px solid #bfdbfe',
      'border-radius:8px',
      'padding:8px 12px',
      'font-size:11px',
      'color:#1e40af',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:8px',
    ].join(';');
    notice.innerHTML = `
      <span>🆕 <strong>v${latest}</strong> is available — you have v${installedVersion}</span>
      <button id="update-now-btn"
              style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;
                     padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;
                     white-space:nowrap">
        Update now →
      </button>`;
    const statusPill = document.getElementById('status-text');
    statusPill?.insertAdjacentElement('afterend', notice);
    document.getElementById('update-now-btn')
      ?.addEventListener('click', () => {
        void chrome.tabs.create({ url: data.releaseUrl ?? RELEASES_URL });
      });

  } catch {
    // Network unavailable or Vercel down — fail silently, never block popup
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Version + update check ───────────────────────────────────────────────
  let installedVersion = '0.6.0';
  try {
    const manifest = chrome.runtime.getManifest();
    installedVersion = manifest.version;
    const vEl = document.getElementById('popup-version') as HTMLAnchorElement | null;
    if (vEl) vEl.textContent = `v${installedVersion}`;
  } catch { /* ignore in tests */ }

  // Check for updates silently — fails gracefully if offline
  void checkForUpdates(installedVersion);

  // ── Upgrade link wiring — every CTA in the popup opens the pricing page ──

  // Watermark upgrade link
  const upgradeLink = document.getElementById('upgrade-link') as HTMLAnchorElement | null;
  if (upgradeLink) {
    upgradeLink.href    = UPGRADE_URL;
    upgradeLink.target  = '_blank';
    upgradeLink.rel     = 'noopener noreferrer';
    upgradeLink.addEventListener('click', e => { e.preventDefault(); openUpgrade(); });
  }

  // Inline banner upgrade button (80-cage warning)
  document.getElementById('upgrade-banner-btn')
    ?.addEventListener('click', openUpgrade);

  // Agent tab upgrade button (locked notice)
  document.getElementById('agent-upgrade-btn')
    ?.addEventListener('click', openUpgrade);

  // ── Tab buttons ──
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

  // ── Export CSV ──
  document.getElementById('export-btn')
    ?.addEventListener('click', () => void exportCSV());

  // ── Default tab ──
  activateTab('overview');
  void renderOverview();
});
