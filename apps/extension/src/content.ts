// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection v0.6.0
// Licensed under Business Source License 1.1
// Commercial use: contact@ai-cage.io

/**
 * @file content.ts — AI CAGE Ghost Mode v0.6.0
 *
 * P0-4 FIX: Mini-popup bubble removed from page DOM.
 *   → Only 1 UI now: the extension popup (chrome.action).
 *   → No more double-popup confusion for Karim.
 *
 * P0-7 FIX: Toast notification added after every cage.
 *   → "🔒 1 email protected" appears 2.5s, then auto-dismisses.
 *
 * P0-8 FIX: bottom:74px clip on Windows fixed.
 *   → Toast uses bottom:80px + max-height:calc(100vh - 160px).
 *
 * P0-1 FIX: Version read from chrome.runtime.getManifest() — no hardcode.
 *
 * Architecture:
 *   - Shadow DOM (closed) — toast + decision panel invisible to page JS
 *   - No bubble/mini-panel injected into page — Ghost Mode
 *   - Badge on extension icon updated via chrome.action.setBadgeText
 *   - Network decision panel (Cage All / Send Unprotected) still active
 */

import { cageText, detectQuasiIdentifiers } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ─── Constants ────────────────────────────────────────────────────────────────
const SHADOW_HOST_ID = 'ai-cage-host-v6';
const CAGED_ATTR     = 'data-ai-cage-done';
const FONT           = 'system-ui,-apple-system,sans-serif';

// ─── Session state ─────────────────────────────────────────────────────────────
let sessionTotal    = 0;
let pendingEntities: CagedEntity[] = [];

// ─── Shadow DOM host (toast + decision panel only — NO bubble, NO mini-popup) ──
let shadowRoot: ShadowRoot | null = null;

function getShadowRoot(): ShadowRoot | null {
  if (shadowRoot) return shadowRoot;
  if (!document.body) return null;

  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  host.style.cssText = 'display:contents;position:static;all:unset;';
  shadowRoot = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    /* ── Animations ── */
    @keyframes cage-in  { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes cage-out { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(8px) scale(.97)} }
    @keyframes cage-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(21,128,61,.4)} 50%{box-shadow:0 0 0 6px rgba(21,128,61,0)} }

    /* ── Status indicator (FIX 2) — tiny non-interactive pill ── */
    /* Replaces the old bubble. Shows AI CAGE is active without double popup. */
    #cage-status {
      position:fixed;
      bottom:20px;
      right:20px;
      z-index:2147483647;
      display:flex;
      align-items:center;
      gap:6px;
      background:rgba(21,128,61,0.92);
      color:#fff;
      border-radius:999px;
      padding:5px 10px 5px 8px;
      font-family:${FONT};
      font-size:11px;
      font-weight:700;
      box-shadow:0 2px 10px rgba(0,0,0,.25);
      pointer-events:none;   /* non-interactive — no click, no cursor change */
      user-select:none;
      transition:opacity .3s, transform .3s;
      letter-spacing:.01em;
    }
    #cage-status.idle    { background:rgba(21,128,61,0.82); }
    #cage-status.caged   { background:rgba(21,128,61,0.97); animation:cage-pulse .6s ease; }
    #cage-status.warning { background:rgba(217,119,6,0.92); }
    #cage-status.hidden  { opacity:0; transform:translateY(4px); pointer-events:none; }
    #cage-status .dot {
      width:7px; height:7px; border-radius:50%;
      background:#fff; flex-shrink:0;
    }
    #cage-status.idle    .dot { background:rgba(255,255,255,.6); }
    #cage-status.caged   .dot { background:#fff; }
    #cage-status.warning .dot { background:#fff; }

    /* ── Toast (P0-7) ── */
    #cage-toast {
      position:fixed;
      bottom:54px;
      right:20px;
      z-index:2147483647;
      background:#15803d;
      color:#fff;
      border-radius:10px;
      padding:10px 16px;
      font-size:13px;
      font-weight:700;
      font-family:${FONT};
      box-shadow:0 4px 16px rgba(0,0,0,.28);
      animation:cage-in .18s ease;
      pointer-events:none;
      max-width:280px;
      line-height:1.4;
    }
    #cage-toast.warning {
      background:#d97706;
    }
    #cage-toast.fading {
      animation:cage-out .25s ease forwards;
    }

    /* ── Decision panel (shown when network PII detected) ── */
    #cage-panel {
      position:fixed;
      bottom:56px;
      right:20px;
      z-index:2147483647;
      width:320px;
      max-height:calc(100vh - 120px);
      overflow-y:auto;
      background:#fff;
      color:#0f172a;
      border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.28);
      font-family:${FONT};
      font-size:13px;
      animation:cage-in .2s ease;
    }

    /* ── Panel internals ── */
    .ch  { background:#15803d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;border-radius:14px 14px 0 0 }
    .ch.amber { background:#d97706 }
    .cl  { max-height:200px;overflow-y:auto;padding:6px 0 }
    .cr  { padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px }
    .ca  { padding:10px 14px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:8px }
    .cw  { padding:8px 14px;background:#fef2f2;border-top:1px solid #fecaca;font-size:11px;color:#991b1b }
    .bg  { background:#15803d;color:#fff;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;width:100% }
    .gg  { background:#e2e8f0;color:#374151;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;width:100% }
    .bs  { background:#15803d;color:#fff;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer }
    .gs  { background:#e2e8f0;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer }
  `;
  shadowRoot.appendChild(style);
  return shadowRoot;
}

// ─── PAGE SCRIPT INJECTION ─────────────────────────────────────────────────────
function injectPageScript(): void {
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    s.async = false;
    s.onload = function () { (this as HTMLScriptElement).remove(); };
    (document.head || document.documentElement).prepend(s);
  } catch (e) { console.warn('[AI CAGE] inject failed:', e); }
}

function shareEntitiesWithPage(entities: CagedEntity[]): void {
  window.postMessage({
    type: 'AI_CAGE_ENTITIES',
    entities: entities.map(e => ({ placeholder: e.placeholder, originalValue: e.originalValue })),
  }, '*');
}

// ─── TOAST (P0-7) ─────────────────────────────────────────────────────────────
/**
 * Show a non-intrusive toast in the Shadow DOM.
 * Auto-dismisses after `durationMs` ms.
 * Uses bottom:80px to clear Windows taskbar (P0-8).
 */
function showToast(message: string, type: 'success' | 'warning' = 'success', durationMs = 2500): void {
  const root = getShadowRoot();
  if (!root) return;

  // Remove any existing toast first
  root.getElementById('cage-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'cage-toast';
  if (type === 'warning') toast.classList.add('warning');
  toast.textContent = message;
  root.appendChild(toast);

  // Auto-dismiss with fade-out
  setTimeout(() => {
    const el = root.getElementById('cage-toast');
    if (!el) return;
    el.classList.add('fading');
    setTimeout(() => el.remove(), 260);
  }, durationMs);
}

// ─── STATUS INDICATOR (FIX 2) ─────────────────────────────────────────────────
/**
 * A tiny non-interactive pill in the bottom-right corner.
 * Shows the client that AI CAGE is active — without being a popup.
 * pointer-events:none → no cursor change, no click, no double-popup.
 *
 * States:
 *   idle    → "🔒 AI CAGE active"      (always visible on AI sites)
 *   caged   → "🔒 X protected"         (pulses briefly after a cage)
 *   warning → "⚠️ Check before sending" (orange, 5s)
 *   hidden  → opacity 0 (non-AI pages)
 */
let statusHideTimer: ReturnType<typeof setTimeout> | null = null;

function createStatusIndicator(): void {
  const root = getShadowRoot();
  if (!root || root.getElementById('cage-status')) return;
  const el = document.createElement('div');
  el.id = 'cage-status';
  el.className = 'idle';
  el.innerHTML = '<div class="dot"></div><span id="cage-status-text">🔒 AI CAGE active</span>';
  root.appendChild(el);
}

function updateStatus(state: 'idle' | 'caged' | 'warning', text?: string): void {
  const root = getShadowRoot();
  if (!root) return;

  // Create indicator if not yet present
  if (!root.getElementById('cage-status')) createStatusIndicator();

  const el = root.getElementById('cage-status') as HTMLElement | null;
  const textEl = root.getElementById('cage-status-text') as HTMLElement | null;
  if (!el || !textEl) return;

  // Clear any pending hide timer
  if (statusHideTimer) { clearTimeout(statusHideTimer); statusHideTimer = null; }

  el.className = state;
  el.classList.remove('hidden');

  if (text) {
    textEl.textContent = text;
  } else {
    if (state === 'idle')    textEl.textContent = '🔒 AI CAGE active';
    if (state === 'caged')   textEl.textContent = `🔒 ${sessionTotal} protected`;
    if (state === 'warning') textEl.textContent = '⚠️ Check before sending';
  }

  // After caged/warning → revert to idle after 3s
  if (state === 'caged' || state === 'warning') {
    statusHideTimer = setTimeout(() => {
      updateStatus('idle');
    }, 3000);
  }
}

// ─── BADGE (icône extension) ──────────────────────────────────────────────────
function updateBadge(): void {
  try {
    void chrome.action.setBadgeText({ text: sessionTotal > 0 ? String(sessionTotal) : '' });
    void chrome.action.setBadgeBackgroundColor({ color: '#15803d' });
  } catch { /* ignore — may not be in extension context */ }
}
/**
 * Shown when injected.ts detects PII in the outgoing network request.
 * User decides: Cage All or Send Unprotected.
 */
function showNetworkPanel(
  gateId: string,
  items: Array<{ type: string; label: string; value: string; preview: string }>,
): void {
  const root = getShadowRoot();
  if (!root) { sendGateDecision(gateId, 'pass', []); return; }
  root.getElementById('cage-panel')?.remove();

  const itemsHtml = items.map((item, idx) => `
    <div class="cr" id="cr-${idx}">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:700;color:#0369a1;text-transform:uppercase">${item.type.replace(/_/g, ' ')}</div>
        <div style="font-size:12px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.preview}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="bs" data-idx="${idx}" data-act="cage">🔒 Cage</button>
        <button class="gs" data-idx="${idx}" data-act="pass">Skip</button>
      </div>
    </div>`).join('');

  const panel = document.createElement('div');
  panel.id = 'cage-panel';
  panel.innerHTML = `
    <div class="ch amber">
      <span style="font-size:16px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">Sensitive data detected!</div>
        <div style="font-size:11px;opacity:.9">${items.length} item${items.length > 1 ? 's' : ''} — choose an action</div>
      </div>
      <button id="cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:2px 6px">×</button>
    </div>
    <div class="cl">${itemsHtml}</div>
    <div class="ca">
      <button class="bg" id="cage-all">🔒 Cage All &amp; Send</button>
      <button class="gg" id="pass-all">⚡ Send Without Protection</button>
    </div>
    <div class="cw">⚠️ "Send Without Protection" sends your real data to the AI.</div>`;
  root.appendChild(panel);

  let sent = false;
  function decide(mode: 'cage' | 'pass', cageItems: typeof items): void {
    if (sent) return;
    sent = true;
    root.getElementById('cage-panel')?.remove();
    sendGateDecision(gateId, mode, cageItems);

    if (mode === 'cage') {
      sessionTotal += cageItems.length;
      updateBadge();
      updateStatus('caged');  // FIX 2: reflect cage in status pill
      const types = [...new Set(cageItems.map(i => i.type.replace(/_/g, ' ').toLowerCase()))].slice(0, 2).join(', ');
      showToast(`🔒 ${cageItems.length} item${cageItems.length > 1 ? 's' : ''} protected (${types})`);
      try {
        void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] });
      } catch { /* ignore */ }
    }
  }

  root.getElementById('cage-close')?.addEventListener('click', () => {
    panel.remove();
    sendGateDecision(gateId, 'pass', []);
  });
  root.getElementById('cage-all')?.addEventListener('click', () => decide('cage', items));
  root.getElementById('pass-all')?.addEventListener('click', () => decide('pass', []));

  root.querySelectorAll<HTMLElement>('button[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.currentTarget as HTMLElement;
      const idx = parseInt(t.dataset['idx'] ?? '0', 10);
      const act = t.dataset['act'] as 'cage' | 'pass';
      const row = root.getElementById(`cr-${idx}`);
      if (row) {
        row.style.background = act === 'cage' ? '#f0fdf4' : '#fef2f2';
        row.querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).disabled = true; });
      }
      if (items.length === 1) decide(act, act === 'cage' ? [items[0]!] : []);
    });
  });
}

function sendGateDecision(
  gateId: string,
  mode: 'cage' | 'pass',
  items: Array<{ value: string; label: string }>,
): void {
  window.postMessage({ type: 'AI_CAGE_PROCEED', gateId, mode, items }, '*');
}

// ─── PROMPT SELECTORS ──────────────────────────────────────────────────────────
// Rule: NEVER remove selectors. Only ADD. If a selector doesn't match, it costs
// nothing. If it's missing, the cage fails silently.
const PROMPT_SELECTORS = [
  // ── ChatGPT / OpenAI ──────────────────────────────────────────────────
  '#prompt-textarea',
  'div#prompt-textarea[contenteditable]',
  'div[contenteditable="true"][data-id]',
  'div.ProseMirror[contenteditable="true"]',

  // ── Claude (Anthropic) ────────────────────────────────────────────────
  'div[contenteditable="true"][aria-multiline="true"]',
  'div.ProseMirror',

  // ── Gemini / Google AI Studio ─────────────────────────────────────────
  'rich-textarea .ql-editor',
  'div.ql-editor[contenteditable="true"]',
  'ms-text-chunk[contenteditable]',
  'div[contenteditable="true"].input-area',

  // ── Meta AI (meta.ai) ─────────────────────────────────────────────────
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label]',
  'div[contenteditable="true"][aria-placeholder]',
  'div[aria-label*="Message"][contenteditable]',
  'div[aria-label*="message"][contenteditable]',
  'div[aria-label*="prompt"][contenteditable]',
  'div[aria-label*="Prompt"][contenteditable]',
  'div[placeholder][contenteditable]',
  'div[data-placeholder][contenteditable]',

  // ── Bing Copilot / Microsoft ──────────────────────────────────────────
  'textarea#searchbox',
  'cib-text-input textarea',
  'div.user-message-input[contenteditable]',
  'textarea[name="userMessage"]',

  // ── DeepSeek ──────────────────────────────────────────────────────────
  'textarea#chat-input',

  // ── Perplexity ────────────────────────────────────────────────────────
  'textarea[placeholder*="Ask"]',
  'textarea[placeholder*="ask"]',
  'textarea[placeholder*="Search"]',

  // ── Mistral / Le Chat ─────────────────────────────────────────────────
  'textarea[data-testid*="chat"]',
  'textarea[data-testid*="message"]',
  'div[data-testid*="message"][contenteditable]',

  // ── Grok (X.com) ──────────────────────────────────────────────────────
  'div[data-testid="tweetTextarea_0"][contenteditable]',
  'div[aria-label*="Grok"][contenteditable]',

  // ── Generic fallbacks — ordered from most specific to most general ────
  'textarea[rows]',
  'textarea',
  'div[contenteditable="true"]',
];

const SEND_SELECTORS = [
  // ── Generic test IDs ──────────────────────────────────────────────────
  'button[data-testid*="send"]',
  'button[data-testid*="submit"]',
  'button[data-testid*="Send"]',

  // ── ARIA labels ───────────────────────────────────────────────────────
  'button[aria-label*="Send"]',
  'button[aria-label*="send"]',
  'button[aria-label*="Submit"]',
  'button[aria-label*="Envoyer"]',
  'button[aria-label*="envoyer"]',

  // ── Form submit ───────────────────────────────────────────────────────
  'button[type="submit"]',

  // ── Meta AI ───────────────────────────────────────────────────────────
  'div[aria-label*="Send"][role="button"]',
  'div[aria-label*="send"][role="button"]',
  'button[aria-label*="Post"]',

  // ── Bing Copilot ──────────────────────────────────────────────────────
  'button#search-button',
  'cib-icon-button[aria-label*="Submit"]',

  // ── Grok ──────────────────────────────────────────────────────────────
  'div[data-testid="tweetButtonInline"]',

  // ── Generic icon buttons that are send actions ────────────────────────
  'button[class*="send"]',
  'button[class*="Send"]',
  'button[class*="submit"]',
  'button[class*="Submit"]',
];

function findPrompt(): HTMLElement | null {
  for (const sel of PROMPT_SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 50 && r.height > 20) return el;
      }
    } catch { /* skip */ }
  }
  return null;
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return (el.innerText ?? el.textContent ?? '').trim();
}

function writeText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text); else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);
    if (readText(el) !== text) {
      el.innerText = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    }
  }
}

// ─── FREE LIMIT MODAL ─────────────────────────────────────────────────────────
/**
 * Shows a hard-block modal when the Free tier 100-cage limit is reached.
 * The user CANNOT send their data unprotected — they must either:
 *   A) Upgrade to Pro (opens Stripe)
 *   B) Cancel (they can manually remove PII before sending)
 *
 * SECURITY: We never let PII pass through after the limit.
 * Sending unprotected data is not an option in this modal.
 */
function showLimitModal(monthly: number): void {
  const root = getShadowRoot();
  if (!root) return;

  root.getElementById('cage-limit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'cage-limit-modal';
  modal.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,.55)', 'padding:16px',
  ].join(';');

  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:16px;padding:24px;
      max-width:380px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.3);
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px;margin-bottom:8px">🔒</div>
        <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:4px">
          Free limit reached
        </div>
        <div style="font-size:13px;color:#64748b;line-height:1.5">
          You have used <strong style="color:#dc2626">100 / 100</strong> free cages this month.<br>
          Your data was <strong>not sent</strong> — it is still protected.
        </div>
      </div>

      <div style="
        background:#f0fdf4;border:1.5px solid #16a34a;border-radius:10px;
        padding:12px 14px;margin-bottom:16px;
      ">
        <div style="font-size:11px;font-weight:800;color:#15803d;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">
          ✅ Upgrade to Pro — Unlimited cages
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;color:#166534">
          <div>🔒 Unlimited cages / month</div>
          <div>🧠 Inference Cage™ auto</div>
          <div>🔄 Ephemeral Tokens™</div>
          <div>📋 Full audit report</div>
          <div>🤖 Agent Cage</div>
          <div>📄 CSV export</div>
        </div>
        <div style="margin-top:8px;font-size:13px;font-weight:800;color:#15803d">
          €5 / user / month · Cancel anytime
        </div>
      </div>

      <button id="cage-limit-upgrade" style="
        width:100%;padding:13px;background:#15803d;color:#fff;
        border:none;border-radius:10px;font-size:14px;font-weight:800;
        cursor:pointer;margin-bottom:8px;
      ">🚀 Upgrade to Pro →</button>

      <button id="cage-limit-cancel" style="
        width:100%;padding:11px;background:#f1f5f9;color:#374151;
        border:none;border-radius:10px;font-size:13px;font-weight:600;
        cursor:pointer;
      ">Cancel — I will remove sensitive data first</button>

      <div style="margin-top:10px;font-size:10px;color:#94a3b8;text-align:center;line-height:1.5">
        Your data was NOT sent. AI CAGE blocked the request.<br>
        Remove any sensitive information before sending manually.
      </div>
    </div>`;

  root.appendChild(modal);

  modal.querySelector('#cage-limit-upgrade')?.addEventListener('click', () => {
    modal.remove();
    try {
      void chrome.runtime.sendMessage({ type: 'OPEN_UPGRADE' });
    } catch {
      window.open('https://ai-cage-gamma.vercel.app/#pricing', '_blank');
    }
  });

  modal.querySelector('#cage-limit-cancel')?.addEventListener('click', () => {
    modal.remove();
    showToast('⚠️ Request cancelled — remove sensitive data before sending', 'warning', 4000);
  });
}

// ─── CAGE LOGIC ────────────────────────────────────────────────────────────────
async function handlePrompt(el: HTMLElement): Promise<void> {
  const raw = readText(el);
  if (!raw || raw.length < 3) return;

  // ── P0 BUSINESS FIX: Hard-enforce Free tier 100-cage limit ────────────────
  // Before scanning for PII, check whether the monthly limit is reached.
  // If yes: block the prompt entirely and show the upgrade modal.
  // The prompt is NOT modified — user can still send it after removing PII manually.
  // SECURITY: we never let PII pass in clear text after the limit.
  try {
    const limitResp = await chrome.runtime.sendMessage<
      { type: string },
      { limitReached: boolean; isPro: boolean; monthly: number }
    >({ type: 'CHECK_LIMIT' });

    if (limitResp?.limitReached) {
      showLimitModal(limitResp.monthly);
      // Prevent the keydown/click event from submitting the form
      return;
    }
  } catch {
    // If background is unreachable, fail safe — allow caging (better than blocking)
  }

  const { cagedText, entities, totalCaged, inferenceRisk } = cageText(raw);
  if (totalCaged === 0 && !inferenceRisk.risky) return;

  if (totalCaged > 0) {
    pendingEntities = [...pendingEntities, ...entities];
    writeText(el, cagedText);
    shareEntitiesWithPage(entities);
    sessionTotal += totalCaged;
    updateBadge();
    updateStatus('caged');

    const typeLabels = [...new Set(entities.map(e => e.type.replace(/_/g, ' ').toLowerCase()))].slice(0, 2);
    const more       = entities.length > 2 ? ` +${entities.length - 2}` : '';
    showToast(`🔒 ${totalCaged} protected (${typeLabels.join(', ')}${more})`);
  }

  // Show inference risk warning even if no direct PII was found
  if (inferenceRisk.risky) {
    showToast(`⚠️ ${inferenceRisk.message}`, 'warning', 5000);
  }

  try {
    void chrome.runtime.sendMessage({
      type: 'CAGE_REPORT',
      tabId: 0,
      site: window.location.hostname,
      entities,
      inferenceRisk,
    });
  } catch { /* ignore */ }
}

// ─── EVENT LISTENERS ───────────────────────────────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey) return;
  const target = e.target as HTMLElement;
  const isPrompt = PROMPT_SELECTORS.some(sel => {
    try { return target.matches(sel) || !!target.closest(sel); } catch { return false; }
  });
  if (isPrompt) void handlePrompt(target);
}, true);

function hookButtons(): void {
  SEND_SELECTORS.forEach(sel => {
    document.querySelectorAll<HTMLElement>(sel).forEach(btn => {
      if (btn.getAttribute(CAGED_ATTR) === '1') return;
      btn.setAttribute(CAGED_ATTR, '1');
      btn.addEventListener('click', () => { const p = findPrompt(); if (p) void handlePrompt(p); }, true);
    });
  });
}

document.addEventListener('submit', (e: Event) => {
  const form = e.target as HTMLFormElement;
  try {
    const input = form.querySelector<HTMLElement>(PROMPT_SELECTORS.join(','));
    if (input) void handlePrompt(input);
  } catch { /* ignore */ }
}, true);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const d = event.data as {
    type?:    string;
    count?:   number;
    gateId?:  string;
    items?:   Array<{ type: string; label: string; value: string; preview: string }>;
    detail?:  string;
  };

  // Network-level PII detected by injected.ts → show decision panel
  if (d?.type === 'AI_CAGE_PII_DETECTED' && d.gateId && d.items) {
    showNetworkPanel(d.gateId, d.items);
    return;
  }

  // Network cage completed (counted in injected.ts side)
  if (d?.type === 'AI_CAGE_NETWORK_CAGED' && d.count) {
    sessionTotal += d.count;
    updateBadge();
    updateStatus('caged');  // FIX 2
    try {
      void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] });
    } catch { /* ignore */ }
  }

  // Response tokens restored locally
  if (d?.type === 'AI_CAGE_NETWORK_RESTORED') {
    updateStatus('idle', '✅ Data restored locally');
    showToast('✅ Data restored — the AI never saw your real information');
  }

  if (d?.type === 'AI_CAGE_INJECTION_DETECTED') {
    try {
      void chrome.runtime.sendMessage({
        type:    'AGENT_EVENT',
        site:    window.location.hostname,
        detail:  d.detail ?? 'Injection detected',
        blocked: true,
      });
    } catch { /* ignore */ }
    updateStatus('warning', '🚫 Injection blocked');
    showToast('🚫 Prompt injection attack blocked', 'warning');
  }

  if (d?.type === 'AI_CAGE_FILE_UPLOAD_WARNING') {
    updateStatus('warning', '⚠️ File detected — check before sending');
    showToast('📄 File upload detected — verify it contains no sensitive data before sending', 'warning', 5000);
  }
});

// ─── DOM OBSERVER (throttled) ──────────────────────────────────────────────────
let hookDebounce: ReturnType<typeof setTimeout> | null = null;

const domObserver = new MutationObserver(() => {
  // Throttle hookButtons — max 1x per 500ms to avoid CPU spikes on streaming
  if (!hookDebounce) {
    hookDebounce = setTimeout(() => {
      hookButtons();
      hookDebounce = null;
    }, 500);
  }
});

// ─── BOOT ──────────────────────────────────────────────────────────────────────
function boot(): void {
  injectPageScript();
  const tryInit = () => {
    if (!document.body) return false;
    domObserver.observe(document.body, { childList: true, subtree: true });
    // FIX 2: create status indicator as soon as body exists
    createStatusIndicator();
    updateStatus('idle');
    return true;
  };
  if (!tryInit()) {
    const w = new MutationObserver(() => { if (tryInit()) w.disconnect(); });
    w.observe(document.documentElement, { childList: true });
  }
  hookButtons();

  const v = (() => { try { return chrome.runtime.getManifest().version; } catch { return '0.6.0'; } })();
  console.warn(`[AI CAGE] 🔒 v${v} active on ${window.location.hostname}`);
}

boot();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hookButtons();
    createStatusIndicator();
    updateStatus('idle');
  });
}
