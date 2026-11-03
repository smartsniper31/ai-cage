// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// Licensed under Business Source License 1.1 — see LICENSE
// Commercial use: contact@ai-cage.io

/**
 * @file content.ts — AI CAGE Universal Content Script v0.4.5
 *
 * UX v2: Floating bubble (not intrusive banner) + User control panel
 *   - Discreet green/amber/blue bubble bottom-right corner
 *   - Click bubble → mini control panel showing detected items
 *   - User chooses which items to cage or send in clear
 *   - Human-in-the-loop for every sensitive item
 */

import { cageText } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ─── Constants ────────────────────────────────────────────────────────────────
const BUBBLE_ID   = 'ai-cage-bubble-v2';
const PANEL_ID    = 'ai-cage-panel-v2';
const CAGED_ATTR  = 'data-ai-cage-done';
const FONT        = 'system-ui,-apple-system,sans-serif';

// ─── Session state ─────────────────────────────────────────────────────────────
let sessionTotal   = 0;
let bubbleState: 'idle' | 'detected' | 'caged' | 'restored' = 'idle';
let pendingEntities: CagedEntity[] = [];
let pendingElement: HTMLElement | null = null;

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

// ─── BUBBLE ────────────────────────────────────────────────────────────────────

function createBubble(): void {
  if (document.getElementById(BUBBLE_ID)) return;
  const b = document.createElement('div');
  b.id = BUBBLE_ID;
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', 'AI CAGE — Click to manage protected data');
  b.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
    'width:44px', 'height:44px', 'border-radius:50%',
    'background:#15803d', 'color:#fff',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer',
    'box-shadow:0 2px 12px rgba(0,0,0,.35)',
    `font-family:${FONT}`, 'font-size:18px', 'font-weight:800',
    'user-select:none', 'transition:all .25s',
    'border:2px solid rgba(255,255,255,.3)',
  ].join(';');
  b.innerHTML = '🔒';
  b.title = 'AI CAGE Active — Click for details';
  b.addEventListener('click', togglePanel);

  // Tooltip counter badge
  const badge = document.createElement('span');
  badge.id = 'ai-cage-badge';
  badge.style.cssText = [
    'position:absolute', 'top:-4px', 'right:-4px',
    'background:#dc2626', 'color:#fff',
    'border-radius:999px', 'font-size:10px', 'font-weight:800',
    'min-width:16px', 'height:16px',
    'display:none', 'align-items:center', 'justify-content:center',
    'padding:0 3px', 'line-height:1',
  ].join(';');
  b.appendChild(badge);

  document.body.appendChild(b);
}

function updateBubble(): void {
  const b = document.getElementById(BUBBLE_ID);
  const badge = document.getElementById('ai-cage-badge');
  if (!b) return;

  const colors: Record<typeof bubbleState, string> = {
    idle:     '#15803d',
    detected: '#d97706',
    caged:    '#0369a1',
    restored: '#15803d',
  };

  const icons: Record<typeof bubbleState, string> = {
    idle:     '🔒',
    detected: '⚠️',
    caged:    '🔒',
    restored: '✅',
  };

  b.style.background = colors[bubbleState];
  b.innerHTML = icons[bubbleState];
  if (badge) b.appendChild(badge);

  if (sessionTotal > 0 && badge) {
    badge.style.display = 'flex';
    badge.textContent = String(sessionTotal);
  }

  // Pulse animation on state change
  b.style.transform = 'scale(1.15)';
  setTimeout(() => { if (b) b.style.transform = 'scale(1)'; }, 250);
}

// ─── CONTROL PANEL ─────────────────────────────────────────────────────────────

function togglePanel(): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); return; }
  showPanel();
}

function showPanel(): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed', 'bottom:74px', 'right:20px', 'z-index:2147483647',
    'width:300px', 'max-height:400px',
    'background:#fff', 'color:#0f172a',
    'border-radius:14px',
    'box-shadow:0 8px 32px rgba(0,0,0,.25)',
    `font-family:${FONT}`, 'font-size:13px',
    'overflow:hidden',
    'animation:ai-cage-slide-in .2s ease',
  ].join(';');

  // Inject animation keyframes once
  if (!document.getElementById('ai-cage-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-cage-styles';
    style.textContent = `
      @keyframes ai-cage-slide-in {
        from { opacity:0; transform:translateY(12px) scale(.95); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
    `;
    document.head?.appendChild(style);
  }

  // ── Header ──
  const header = document.createElement('div');
  header.style.cssText = 'background:#15803d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;';
  header.innerHTML = `
    <span style="font-size:16px">🔒</span>
    <div style="flex:1">
      <div style="font-weight:700;font-size:13px">AI CAGE</div>
      <div style="font-size:11px;opacity:.8">${window.location.hostname}</div>
    </div>
    <button id="ai-cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:2px;">×</button>
  `;
  panel.appendChild(header);

  // ── Stats row ──
  const stats = document.createElement('div');
  stats.style.cssText = 'padding:10px 14px;background:#f0fdf4;border-bottom:1px solid #e2e8f0;display:flex;gap:16px;';
  stats.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:20px;font-weight:800;color:#15803d">${sessionTotal}</div>
      <div style="font-size:10px;color:#64748b">Total caged</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:20px;font-weight:800;color:#0369a1">${pendingEntities.length}</div>
      <div style="font-size:10px;color:#64748b">Pending review</div>
    </div>
    <div style="margin-left:auto;align-self:center">
      <div style="font-size:11px;color:#166534;font-weight:600">✅ Zero data sent</div>
    </div>
  `;
  panel.appendChild(stats);

  // ── Entity list ──
  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'max-height:200px;overflow-y:auto;padding:8px 0;';

  if (pendingEntities.length === 0 && sessionTotal === 0) {
    listWrap.innerHTML = `
      <div style="padding:20px;text-align:center;color:#64748b;font-size:12px">
        <div style="font-size:24px;margin-bottom:6px">🔍</div>
        Monitoring your prompts...<br>
        No sensitive data detected yet.
      </div>`;
  } else if (pendingEntities.length > 0) {
    listWrap.innerHTML = `<div style="padding:6px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Detected Items — Choose action:</div>`;

    pendingEntities.forEach((entity, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px;';

      const typeColors: Record<string, string> = {
        EMAIL_ADDRESS: '#0369a1', CREDIT_CARD: '#dc2626',
        IBAN: '#7c3aed', API_KEY: '#dc2626',
        PRIVATE_KEY: '#dc2626', PHONE_NUMBER: '#d97706',
        IP_ADDRESS: '#64748b', CIN_TN: '#0369a1',
        MF_TN: '#0369a1', GENERIC_SECRET: '#dc2626',
      };
      const color = typeColors[entity.type] ?? '#64748b';
      const shortType = entity.type.replace('_', ' ').toLowerCase();

      // Show partially redacted value
      const val = entity.originalValue;
      const preview = val.length > 12
        ? val.slice(0, 4) + '***' + val.slice(-3)
        : val.slice(0, 2) + '***';

      row.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase">${shortType}</div>
          <div style="font-size:12px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${preview}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-idx="${idx}" data-action="cage"
            style="background:#15803d;color:#fff;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">
            🔒 Cage
          </button>
          <button data-idx="${idx}" data-action="pass"
            style="background:#e2e8f0;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">
            Pass
          </button>
        </div>
      `;
      listWrap.appendChild(row);
    });
  } else {
    listWrap.innerHTML = `
      <div style="padding:16px 14px">
        <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px">Session history</div>
        <div style="font-size:12px;color:#16a34a">✅ ${sessionTotal} item(s) successfully caged this session</div>
      </div>`;
  }
  panel.appendChild(listWrap);

  // ── Action buttons ──
  if (pendingEntities.length > 0) {
    const actions = document.createElement('div');
    actions.style.cssText = 'padding:10px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;';
    actions.innerHTML = `
      <button id="ai-cage-cage-all" style="flex:1;background:#15803d;color:#fff;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
        🔒 Cage All
      </button>
      <button id="ai-cage-pass-all" style="flex:1;background:#e2e8f0;color:#374151;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
        Send All (no protection)
      </button>
    `;
    panel.appendChild(actions);
  }

  // ── Footer ──
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;';
  footer.innerHTML = `
    <span style="font-size:10px;color:#94a3b8">🇹🇳 Made in Tunisia · Zero data sent</span>
    <span style="font-size:10px;color:#94a3b8">v0.4.5</span>
  `;
  panel.appendChild(footer);

  document.body.appendChild(panel);

  // ── Event handlers ──
  document.getElementById('ai-cage-close')?.addEventListener('click', () => panel.remove());

  document.getElementById('ai-cage-cage-all')?.addEventListener('click', () => {
    applyEntityDecisions(pendingEntities.map((_, i) => ({ idx: i, action: 'cage' as const })));
    panel.remove();
  });

  document.getElementById('ai-cage-pass-all')?.addEventListener('click', () => {
    pendingEntities = [];
    panel.remove();
    bubbleState = 'idle';
    updateBubble();
  });

  listWrap.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const idx = parseInt(target.dataset['idx'] ?? '0', 10);
      const action = target.dataset['action'] as 'cage' | 'pass';
      applyEntityDecisions([{ idx, action }]);
      panel.remove();
      // Reopen if more items pending
      if (pendingEntities.length > 0) setTimeout(showPanel, 100);
    });
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      const p = document.getElementById(PANEL_ID);
      const bub = document.getElementById(BUBBLE_ID);
      if (p && !p.contains(e.target as Node) && !bub?.contains(e.target as Node)) {
        p.remove();
      }
    }, { once: true });
  }, 100);
}

function applyEntityDecisions(decisions: Array<{ idx: number; action: 'cage' | 'pass' }>): void {
  const caged  = decisions.filter(d => d.action === 'cage').map(d => pendingEntities[d.idx]).filter(Boolean);
  const passed = decisions.filter(d => d.action === 'pass').map(d => pendingEntities[d.idx]).filter(Boolean);

  // Remove processed entities
  const processedIdxs = new Set(decisions.map(d => d.idx));
  pendingEntities = pendingEntities.filter((_, i) => !processedIdxs.has(i));

  if (caged.length > 0) {
    sessionTotal += caged.length;
    shareEntitiesWithPage(caged);
    bubbleState = 'caged';
    updateBubble();
    try {
      void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: caged });
    } catch { /* ignore */ }
  }

  if (passed.length > 0) {
    console.warn(`[AI CAGE] User chose to pass ${passed.length} item(s) uncaged.`);
  }

  if (pendingEntities.length === 0 && caged.length > 0) {
    bubbleState = 'caged';
    updateBubble();
  }
}

// ─── PROMPT SELECTORS ──────────────────────────────────────────────────────────
const PROMPT_SELECTORS = [
  '#prompt-textarea', 'div#prompt-textarea[contenteditable]',
  'div[contenteditable="true"][data-id]',
  'div.ProseMirror[contenteditable="true"]',
  'rich-textarea .ql-editor', 'div.ql-editor[contenteditable="true"]',
  'textarea#chat-input',
  'div[contenteditable="true"][aria-multiline="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label]',
  'textarea[rows]', 'textarea',
  'div[contenteditable="true"]',
];

const SEND_SELECTORS = [
  'button[data-testid*="send"]', 'button[data-testid*="submit"]',
  'button[aria-label*="Send"]', 'button[aria-label*="send"]',
  'button[aria-label*="Submit"]', 'button[aria-label*="Envoyer"]',
  'button[type="submit"]',
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
      ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
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

// ─── CAGE LOGIC ────────────────────────────────────────────────────────────────

/**
 * Detects PII in prompt. If found:
 *  - Shows bubble in "detected" state
 *  - Opens control panel for user decision
 *  - User decides per item: cage or pass
 */
function handlePrompt(el: HTMLElement): void {
  const raw = readText(el);
  if (!raw || raw.length < 3) return;

  const { cagedText, entities, totalCaged } = cageText(raw);
  if (totalCaged === 0) return;

  // Store pending entities for user review
  pendingEntities = [...pendingEntities, ...entities];

  // Update bubble to "detected" state
  bubbleState = 'detected';
  updateBubble();

  // Show control panel automatically
  showPanel();

  // Also write caged text to DOM as fallback
  // (injected.js will handle the actual network-level caging)
  writeText(el, cagedText);
  shareEntitiesWithPage(entities);

  sessionTotal += totalCaged;

  try {
    void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities });
  } catch { /* ignore */ }
}

// ─── EVENT LISTENERS ───────────────────────────────────────────────────────────

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey) return;
  const target = e.target as HTMLElement;
  const isPrompt = PROMPT_SELECTORS.some(sel => {
    try { return target.matches(sel) || !!target.closest(sel); }
    catch { return false; }
  });
  if (isPrompt) handlePrompt(target);
}, true);

function hookButtons(): void {
  SEND_SELECTORS.forEach(sel => {
    document.querySelectorAll<HTMLElement>(sel).forEach(btn => {
      if (btn.getAttribute(CAGED_ATTR) === '1') return;
      btn.setAttribute(CAGED_ATTR, '1');
      btn.addEventListener('click', () => {
        const p = findPrompt();
        if (p) handlePrompt(p);
      }, true);
    });
  });
}

document.addEventListener('submit', (e: Event) => {
  const form = e.target as HTMLFormElement;
  const sel = PROMPT_SELECTORS.join(',');
  try {
    const input = form.querySelector<HTMLElement>(sel);
    if (input) handlePrompt(input);
  } catch { /* ignore */ }
}, true);

// Listen for network-level events from injected.js
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const d = event.data as { type?: string; count?: number };
  if (d?.type === 'AI_CAGE_NETWORK_CAGED' && d.count) {
    sessionTotal += d.count;
    bubbleState = 'caged';
    updateBubble();
    try {
      void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] });
    } catch { /* ignore */ }
  }
  if (d?.type === 'AI_CAGE_NETWORK_RESTORED') {
    bubbleState = 'restored';
    updateBubble();
    setTimeout(() => { bubbleState = 'idle'; updateBubble(); }, 3000);
  }
});

const domObserver = new MutationObserver(() => {
  hookButtons();
  if (!document.getElementById(BUBBLE_ID)) createBubble();
});

// Response uncaging observer
const responseObserver = new MutationObserver((mutations) => {
  if (pendingEntities.length === 0 && sessionTotal === 0) return;
  for (const mut of mutations) {
    mut.addedNodes.forEach(node => {
      if (node instanceof Element && node.innerHTML?.includes('[CAGED_')) {
        // Signal injected.js to handle restoration
        window.postMessage({ type: 'AI_CAGE_RESTORE_REQUEST' }, '*');
      }
    });
    if (mut.type === 'characterData' && mut.target.textContent?.includes('[CAGED_')) {
      window.postMessage({ type: 'AI_CAGE_RESTORE_REQUEST' }, '*');
    }
  }
});

// ─── BOOT ──────────────────────────────────────────────────────────────────────

function boot(): void {
  // 1. Inject network interceptor first
  injectPageScript();

  // 2. Create floating bubble
  const tryBubble = () => {
    if (document.body) { createBubble(); return true; }
    return false;
  };
  if (!tryBubble()) {
    const w = new MutationObserver(() => { if (tryBubble()) w.disconnect(); });
    w.observe(document.documentElement, { childList: true });
  }

  // 3. Start observers
  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });
    responseObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  hookButtons();
  console.warn(`[AI CAGE] 🔒 v0.4.5 active on ${window.location.hostname} — bubble mode`);
}

boot();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hookButtons();
    if (!document.getElementById(BUBBLE_ID)) createBubble();
  });
}
