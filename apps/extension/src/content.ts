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
 *   → "🔒 1 email protégé" appears 2.5s, then auto-dismisses.
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

import { cageText } from '@ai-cage/core';
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

    /* ── Toast (P0-7) ── */
    #cage-toast {
      position:fixed;
      bottom:80px;           /* P0-8: was 74px — clears Windows taskbar */
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
      bottom:80px;           /* P0-8: safe above taskbar */
      right:20px;
      z-index:2147483647;
      width:320px;
      max-height:calc(100vh - 160px);   /* never overflow screen */
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

// ─── BADGE ONLY (replaces bubble) ─────────────────────────────────────────────
/**
 * Update the extension icon badge counter.
 * This replaces the old in-page bubble — one UI only.
 */
function updateBadge(): void {
  try {
    void chrome.action.setBadgeText({ text: sessionTotal > 0 ? String(sessionTotal) : '' });
    void chrome.action.setBadgeBackgroundColor({ color: '#15803d' });
  } catch { /* ignore — may not be in extension context */ }
}

// ─── NETWORK PII PANEL ─────────────────────────────────────────────────────────
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
        <button class="bs" data-idx="${idx}" data-act="cage">🔒 Cager</button>
        <button class="gs" data-idx="${idx}" data-act="pass">Ignorer</button>
      </div>
    </div>`).join('');

  const panel = document.createElement('div');
  panel.id = 'cage-panel';
  panel.innerHTML = `
    <div class="ch amber">
      <span style="font-size:16px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">Données sensibles détectées !</div>
        <div style="font-size:11px;opacity:.9">${items.length} élément${items.length > 1 ? 's' : ''} — choisissez une action</div>
      </div>
      <button id="cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:2px 6px">×</button>
    </div>
    <div class="cl">${itemsHtml}</div>
    <div class="ca">
      <button class="bg" id="cage-all">🔒 Tout cager &amp; envoyer</button>
      <button class="gg" id="pass-all">⚡ Envoyer sans protection</button>
    </div>
    <div class="cw">⚠️ "Envoyer sans protection" transmet vos vraies données à l'IA.</div>`;
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
      // P0-7: toast confirmation after network cage
      const types = [...new Set(cageItems.map(i => i.type.replace(/_/g, ' ').toLowerCase()))].slice(0, 2).join(', ');
      showToast(`🔒 ${cageItems.length} élément${cageItems.length > 1 ? 's' : ''} protégé${cageItems.length > 1 ? 's' : ''} (${types})`);
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

// ─── CAGE LOGIC ────────────────────────────────────────────────────────────────
function handlePrompt(el: HTMLElement): void {
  const raw = readText(el);
  if (!raw || raw.length < 3) return;

  const { cagedText, entities, totalCaged } = cageText(raw);
  if (totalCaged === 0) return;

  pendingEntities = [...pendingEntities, ...entities];
  writeText(el, cagedText);
  shareEntitiesWithPage(entities);
  sessionTotal += totalCaged;
  updateBadge();

  // P0-7: Show toast confirmation so Karim knows it worked
  const typeLabels = [...new Set(entities.map(e => e.type.replace(/_/g, ' ').toLowerCase()))].slice(0, 2);
  const more       = entities.length > 2 ? ` +${entities.length - 2}` : '';
  showToast(`🔒 ${totalCaged} protégé${totalCaged > 1 ? 's' : ''} (${typeLabels.join(', ')}${more})`);

  try {
    void chrome.runtime.sendMessage({
      type: 'CAGE_REPORT',
      tabId: 0,
      site: window.location.hostname,
      entities,
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
  if (isPrompt) handlePrompt(target);
}, true);

function hookButtons(): void {
  SEND_SELECTORS.forEach(sel => {
    document.querySelectorAll<HTMLElement>(sel).forEach(btn => {
      if (btn.getAttribute(CAGED_ATTR) === '1') return;
      btn.setAttribute(CAGED_ATTR, '1');
      btn.addEventListener('click', () => { const p = findPrompt(); if (p) handlePrompt(p); }, true);
    });
  });
}

document.addEventListener('submit', (e: Event) => {
  const form = e.target as HTMLFormElement;
  try {
    const input = form.querySelector<HTMLElement>(PROMPT_SELECTORS.join(','));
    if (input) handlePrompt(input);
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
    try {
      void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] });
    } catch { /* ignore */ }
  }

  // Response tokens restored locally
  if (d?.type === 'AI_CAGE_NETWORK_RESTORED') {
    showToast('✅ Données restaurées localement — l\'IA n\'a jamais vu l\'original');
  }

  // Prompt injection detected by injected.ts
  if (d?.type === 'AI_CAGE_INJECTION_DETECTED') {
    try {
      void chrome.runtime.sendMessage({
        type:    'AGENT_EVENT',
        site:    window.location.hostname,
        detail:  d.detail ?? 'Injection detected',
        blocked: true,
      });
    } catch { /* ignore */ }
    showToast('🚫 Injection bloquée', 'warning');
  }

  // P0-9: File upload warning from injected.ts
  if (d?.type === 'AI_CAGE_FILE_UPLOAD_WARNING') {
    showToast('📄 Fichier détecté — vérifiez qu\'il ne contient pas de données sensibles avant d\'envoyer', 'warning', 5000);
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
    // P0-4: NO bubble, NO mini-popup — Ghost Mode only
    // The extension popup (chrome.action) is the single UI entry point
    domObserver.observe(document.body, { childList: true, subtree: true });
    return true;
  };
  if (!tryInit()) {
    const w = new MutationObserver(() => { if (tryInit()) w.disconnect(); });
    w.observe(document.documentElement, { childList: true });
  }
  hookButtons();

  // P0-1: version from manifest, no hardcode
  const v = (() => { try { return chrome.runtime.getManifest().version; } catch { return '0.6.0'; } })();
  console.warn(`[AI CAGE] 🔒 Ghost Mode v${v} on ${window.location.hostname} — single UI mode active`);
}

boot();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { hookButtons(); });
}
