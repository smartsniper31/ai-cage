// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection v0.5.0-stealth
// Licensed under Business Source License 1.1
// Commercial use: contact@ai-cage.io

/**
 * @file content.ts — AI CAGE Ghost Mode v0.5.0
 *
 * GHOST MODE fixes:
 *   1. Shadow DOM (closed) — bubble + panel invisible to page JS
 *   2. No style tag in document.head — no React hydration mismatch
 *   3. No localStorage/sessionStorage touches — no dark mode reload
 *   4. Pass fix: sendDecision always resolves gate immediately
 *   5. Stop-after-3-messages fix: regex lastIndex reset + gate cleanup
 */

import { cageText } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ─── Constants ────────────────────────────────────────────────────────────────
const SHADOW_HOST_ID = 'ai-cage-host-v5';
const CAGED_ATTR     = 'data-ai-cage-done';
const FONT           = 'system-ui,-apple-system,sans-serif';

// ─── Session state ─────────────────────────────────────────────────────────────
let sessionTotal   = 0;
let bubbleState: 'idle' | 'detected' | 'caged' | 'restored' = 'idle';
let pendingEntities: CagedEntity[] = [];

// ─── Shadow DOM host ───────────────────────────────────────────────────────────
let shadowRoot: ShadowRoot | null = null;

function getShadowRoot(): ShadowRoot | null {
  if (shadowRoot) return shadowRoot;
  if (!document.body) return null;

  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  host.style.cssText = 'display:contents;position:static;all:unset;';
  // closed mode = page JS cannot access .shadowRoot
  shadowRoot = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes cage-in { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    #cage-bubble {
      position:fixed;bottom:20px;right:20px;z-index:2147483647;
      width:44px;height:44px;border-radius:50%;
      background:#15803d;color:#fff;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;font-size:18px;font-weight:800;
      box-shadow:0 2px 12px rgba(0,0,0,.35);
      user-select:none;transition:all .25s;
      border:2px solid rgba(255,255,255,.25);
      font-family:${FONT};
    }
    #cage-bubble.amber{background:#d97706}
    #cage-bubble.blue{background:#0369a1}
    #cage-badge{
      position:absolute;top:-4px;right:-4px;
      background:#dc2626;color:#fff;border-radius:999px;
      font-size:10px;font-weight:800;min-width:16px;height:16px;
      display:none;align-items:center;justify-content:center;padding:0 3px;
    }
    #cage-panel{
      position:fixed;bottom:74px;right:20px;z-index:2147483647;
      width:310px;max-height:440px;
      background:#fff;color:#0f172a;border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.28);
      font-family:${FONT};font-size:13px;overflow:hidden;
      animation:cage-in .2s ease;
    }
    .ch{background:#15803d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}
    .ch.amber{background:#d97706}
    .cs{padding:10px 14px;background:#f0fdf4;border-bottom:1px solid #e2e8f0;display:flex;gap:16px}
    .cl{max-height:200px;overflow-y:auto;padding:6px 0}
    .cr{padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px}
    .ca{padding:10px 14px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .cw{padding:8px 14px;background:#fef2f2;border-top:1px solid #fecaca;font-size:11px;color:#991b1b}
    .cf{padding:8px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
    .bg{background:#15803d;color:#fff;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
    .gg{background:#e2e8f0;color:#374151;border:none;padding:9px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
    .bs{background:#15803d;color:#fff;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer}
    .gs{background:#e2e8f0;color:#374151;border:none;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer}
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
  window.postMessage({ type: 'AI_CAGE_ENTITIES', entities: entities.map(e => ({ placeholder: e.placeholder, originalValue: e.originalValue })) }, '*');
}

// ─── BUBBLE ────────────────────────────────────────────────────────────────────
function createBubble(): void {
  const root = getShadowRoot();
  if (!root || root.getElementById('cage-bubble')) return;
  const b = document.createElement('div');
  b.id = 'cage-bubble';
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', 'AI CAGE');
  b.innerHTML = '🔒';
  b.addEventListener('click', togglePanel);
  const badge = document.createElement('span');
  badge.id = 'cage-badge';
  b.appendChild(badge);
  root.appendChild(b);
}

function updateBubble(): void {
  const root = getShadowRoot();
  if (!root) return;
  const b = root.getElementById('cage-bubble') as HTMLElement | null;
  const badge = root.getElementById('cage-badge') as HTMLElement | null;
  if (!b) return;
  b.className = bubbleState === 'detected' ? 'amber' : bubbleState === 'caged' ? 'blue' : '';
  const icon = b.childNodes[0];
  if (icon) icon.textContent = bubbleState === 'detected' ? '⚠️' : bubbleState === 'restored' ? '✅' : '🔒';
  if (badge) b.appendChild(badge);
  if (sessionTotal > 0 && badge) { badge.style.display = 'flex'; badge.textContent = String(sessionTotal); }
  b.style.transform = 'scale(1.15)';
  setTimeout(() => { b.style.transform = 'scale(1)'; }, 250);
  try { void chrome.action.setBadgeText({ text: sessionTotal > 0 ? String(sessionTotal) : '' }); } catch { /* ignore */ }
}

// ─── STATUS PANEL ──────────────────────────────────────────────────────────────
function togglePanel(): void {
  const root = getShadowRoot();
  if (!root) return;
  const existing = root.getElementById('cage-panel');
  if (existing) { existing.remove(); return; }
  showStatusPanel();
}

function showStatusPanel(): void {
  const root = getShadowRoot();
  if (!root) return;
  root.getElementById('cage-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'cage-panel';
  panel.innerHTML = `
    <div class="ch">
      <span style="font-size:16px">🔒</span>
      <div style="flex:1"><div style="font-weight:700;font-size:13px">AI CAGE</div><div style="font-size:11px;opacity:.8">${window.location.hostname}</div></div>
      <button id="cage-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;padding:2px">×</button>
    </div>
    <div class="cs">
      <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#15803d">${sessionTotal}</div><div style="font-size:10px;color:#64748b">Total caged</div></div>
      <div style="margin-left:auto;align-self:center;font-size:11px;color:#166534;font-weight:600">✅ Zero data sent</div>
    </div>
    <div style="padding:14px;font-size:12px;color:#64748b;text-align:center">
      ${sessionTotal > 0 ? `✅ ${sessionTotal} item(s) caged this session` : '🔍 Monitoring... Type a prompt with sensitive data.'}
    </div>
    <div class="cf"><span>🇹🇳 Made in Tunisia</span><span>v0.5.0</span></div>`;
  root.appendChild(panel);
  root.getElementById('cage-close')?.addEventListener('click', () => panel.remove());
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      const host = document.getElementById(SHADOW_HOST_ID);
      if (host && !host.contains(e.target as Node)) root.getElementById('cage-panel')?.remove();
    }, { once: true });
  }, 150);
}

// ─── NETWORK PII PANEL ─────────────────────────────────────────────────────────
function showNetworkPanel(gateId: string, items: Array<{ type: string; label: string; value: string; preview: string }>): void {
  const root = getShadowRoot();
  if (!root) { sendGateDecision(gateId, 'pass', []); return; }
  root.getElementById('cage-panel')?.remove();

  const itemsHtml = items.map((item, idx) => `
    <div class="cr" id="cr-${idx}">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:700;color:#0369a1;text-transform:uppercase">${item.type.replace(/_/g,' ')}</div>
        <div style="font-size:12px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.preview}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="bs" data-idx="${idx}" data-act="cage">🔒 Cage</button>
        <button class="gs" data-idx="${idx}" data-act="pass">Pass</button>
      </div>
    </div>`).join('');

  const panel = document.createElement('div');
  panel.id = 'cage-panel';
  panel.innerHTML = `
    <div class="ch amber">
      <span style="font-size:16px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:13px">Sensitive data detected!</div>
        <div style="font-size:11px;opacity:.9">${items.length} item${items.length > 1 ? 's' : ''} — choose action</div>
      </div>
    </div>
    <div class="cl">${itemsHtml}</div>
    <div class="ca">
      <button class="bg" id="cage-all">🔒 Cage All & Send</button>
      <button class="gg" id="pass-all">⚡ Send Unprotected</button>
    </div>
    <div class="cw">⚠️ "Send Unprotected" sends your real data to the AI.</div>`;
  root.appendChild(panel);
  bubbleState = 'detected';
  updateBubble();

  let sent = false;
  function decide(mode: 'cage' | 'pass', cageItems: typeof items): void {
    if (sent) return;
    sent = true;
    root.getElementById('cage-panel')?.remove();
    sendGateDecision(gateId, mode, cageItems);
    if (mode === 'cage') { sessionTotal += cageItems.length; bubbleState = 'caged'; }
    else { bubbleState = 'idle'; }
    updateBubble();
    if (mode === 'cage') {
      try { void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] }); } catch { /* ignore */ }
    }
  }

  root.getElementById('cage-all')?.addEventListener('click', () => decide('cage', items));
  root.getElementById('pass-all')?.addEventListener('click', () => decide('pass', []));
  root.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const t = e.currentTarget as HTMLElement;
      const idx = parseInt(t.dataset['idx'] ?? '0', 10);
      const act = t.dataset['act'] as 'cage' | 'pass';
      const row = root.getElementById(`cr-${idx}`);
      if (row) { row.style.background = act === 'cage' ? '#f0fdf4' : '#fef2f2'; row.querySelectorAll('button').forEach(b => ((b as HTMLButtonElement).disabled = true)); }
      if (items.length === 1) decide(act, act === 'cage' ? [items[0]!] : []);
    });
  });
}

function sendGateDecision(gateId: string, mode: 'cage' | 'pass', items: Array<{ value: string; label: string }>): void {
  window.postMessage({ type: 'AI_CAGE_PROCEED', gateId, mode, items }, '*');
}

function handleNetworkPII(gateId: string, items: Array<{ type: string; label: string; value: string; preview: string }>): void {
  showNetworkPanel(gateId, items);
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
    try { const el = document.querySelector<HTMLElement>(sel); if (el) { const r = el.getBoundingClientRect(); if (r.width > 50 && r.height > 20) return el; } }
    catch { /* skip */ }
  }
  return null;
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return (el.innerText ?? el.textContent ?? '').trim();
}

function writeText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text); else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);
    if (readText(el) !== text) { el.innerText = text; el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text })); }
  }
}

// ─── CAGE LOGIC ────────────────────────────────────────────────────────────────
function handlePrompt(el: HTMLElement): void {
  const raw = readText(el);
  if (!raw || raw.length < 3) return;
  const { cagedText, entities, totalCaged } = cageText(raw);
  if (totalCaged === 0) return;
  pendingEntities = [...pendingEntities, ...entities];
  bubbleState = 'detected';
  updateBubble();
  writeText(el, cagedText);
  shareEntitiesWithPage(entities);
  sessionTotal += totalCaged;
  try { void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities }); } catch { /* ignore */ }
}

// ─── EVENT LISTENERS ───────────────────────────────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey) return;
  const target = e.target as HTMLElement;
  const isPrompt = PROMPT_SELECTORS.some(sel => { try { return target.matches(sel) || !!target.closest(sel); } catch { return false; } });
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
  try { const input = form.querySelector<HTMLElement>(PROMPT_SELECTORS.join(',')); if (input) handlePrompt(input); } catch { /* ignore */ }
}, true);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const d = event.data as { type?: string; count?: number; gateId?: string; items?: Array<{ type: string; label: string; value: string; preview: string }> };

  if (d?.type === 'AI_CAGE_PII_DETECTED' && d.gateId && d.items) { handleNetworkPII(d.gateId, d.items); return; }
  if (d?.type === 'AI_CAGE_NETWORK_CAGED' && d.count) {
    sessionTotal += d.count; bubbleState = 'caged'; updateBubble();
    try { void chrome.runtime.sendMessage({ type: 'CAGE_REPORT', tabId: 0, site: window.location.hostname, entities: [] }); } catch { /* ignore */ }
  }
  if (d?.type === 'AI_CAGE_NETWORK_RESTORED') { bubbleState = 'restored'; updateBubble(); setTimeout(() => { bubbleState = 'idle'; updateBubble(); }, 3000); }
  if (d?.type === 'AI_CAGE_INJECTION_DETECTED') {
    try { void chrome.runtime.sendMessage({ type: 'AGENT_EVENT', site: window.location.hostname, detail: (d as { detail?: string }).detail ?? 'Injection detected', blocked: true }); } catch { /* ignore */ }
    bubbleState = 'detected'; updateBubble();
  }
});

const domObserver = new MutationObserver(() => {
  hookButtons();
  const root = getShadowRoot();
  if (root && !root.getElementById('cage-bubble')) createBubble();
});

// ─── BOOT ──────────────────────────────────────────────────────────────────────
function boot(): void {
  injectPageScript();
  const tryInit = () => {
    if (!document.body) return false;
    createBubble();
    domObserver.observe(document.body, { childList: true, subtree: true });
    return true;
  };
  if (!tryInit()) {
    const w = new MutationObserver(() => { if (tryInit()) w.disconnect(); });
    w.observe(document.documentElement, { childList: true });
  }
  hookButtons();
  console.warn(`[AI CAGE] 🔒 Ghost Mode v0.5.0 on ${window.location.hostname}`);
}

boot();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { hookButtons(); createBubble(); });
}
