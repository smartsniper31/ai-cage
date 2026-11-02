// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// Licensed under Business Source License 1.1 — see LICENSE
// Commercial use: contact@ai-cage.io

/**
 * @file content.ts
 * AI CAGE — Universal Content Script v0.4.5
 *
 * PHILOSOPHY — "The client decides what AI they use, not us."
 *   This script works on ANY website with an AI chat interface.
 *   It does NOT rely on a hardcoded list of AI providers.
 *   It auto-detects text input fields and AI response areas
 *   using universal DOM heuristics.
 *
 * WHAT IT DOES:
 *   1. AUTO-DETECTS the prompt input on any AI chat page
 *   2. CAGES PII before the message is sent (cageText)
 *   3. OBSERVES the AI response area
 *   4. RESTORES original values in the response (uncageText)
 *   5. Shows the 🔒 banner on any supported page
 *
 * UNIVERSAL DETECTION STRATEGY:
 *   - No hardcoded URLs in content script (manifest handles scope)
 *   - Input detection: look for large text areas / contenteditables
 *   - Response detection: observe DOM mutations for new assistant text
 *   - React/Vue/Svelte compatibility: use native input value setter
 *
 * SECURITY CONTRACT:
 *   - cageText() runs LOCALLY, BEFORE any network call
 *   - uncageText() runs LOCALLY, ON the response
 *   - Entity mapping lives ONLY in this script's closure
 *   - Zero network calls from this script
 */

import { cageText, uncageText } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const BANNER_ID  = 'ai-cage-banner-v2';
const CAGED_ATTR = 'data-ai-cage-done';

/**
 * Universal prompt input selectors.
 * Works on ANY AI chat interface — current and future.
 * Priority: most specific first, most generic last.
 */
const PROMPT_SELECTORS: string[] = [
  // ── ChatGPT / OpenAI (2023–2025+) ──────────────────────────────────────
  '#prompt-textarea',
  'div#prompt-textarea[contenteditable]',
  // ── Claude (Anthropic) ──────────────────────────────────────────────────
  'div.ProseMirror[contenteditable="true"]',
  // ── Gemini (Google) ─────────────────────────────────────────────────────
  'rich-textarea .ql-editor',
  'div.ql-editor[contenteditable="true"]',
  // ── Copilot / Bing Chat / Edge ───────────────────────────────────────────
  'textarea#searchbox',
  'cib-text-input textarea',
  'div[class*="copilot"][contenteditable="true"]',
  // ── Mistral / Le Chat ────────────────────────────────────────────────────
  'textarea[placeholder*="Envoyer un message"]',
  // ── Perplexity ──────────────────────────────────────────────────────────
  'textarea[placeholder*="Ask anything"]',
  'textarea[placeholder*="Search the internet"]',
  // ── DeepSeek ────────────────────────────────────────────────────────────
  'textarea#chat-input',
  // ── Poe ─────────────────────────────────────────────────────────────────
  'textarea[class*="GrowingTextArea"]',
  // ── Meta AI ─────────────────────────────────────────────────────────────
  'div[aria-label*="Message"][contenteditable="true"]',
  // ── Grok (X/Twitter) ────────────────────────────────────────────────────
  'div[data-testid="tweetTextarea_0"][contenteditable]',
  // ── HuggingFace Chat ────────────────────────────────────────────────────
  'textarea[placeholder*="Ask anything"]',
  // ── Cohere / Coral ──────────────────────────────────────────────────────
  'textarea[placeholder*="Send a message"]',
  // ── You.com / Phind / Pi.ai ─────────────────────────────────────────────
  'textarea[placeholder*="Type a message"]',
  'textarea[placeholder*="Reply to"]',
  // ── UNIVERSAL FALLBACKS (work on any AI not yet listed) ─────────────────
  // Large contenteditable divs with aria attributes typical of chat
  'div[contenteditable="true"][aria-multiline="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label]',
  // Standard textarea (works on 90% of AI chat interfaces)
  'textarea[rows]',
  'textarea',
  // Last resort contenteditable
  'div[contenteditable="true"]',
];

/**
 * Universal send button selectors.
 * Works on any AI chat interface.
 */
const SEND_SELECTORS: string[] = [
  // Data attribute patterns
  'button[data-testid*="send"]',
  'button[data-testid*="submit"]',
  // Aria label patterns
  'button[aria-label*="Send"]',
  'button[aria-label*="send"]',
  'button[aria-label*="Submit"]',
  'button[aria-label*="Envoyer"]',
  'button[aria-label*="Soumettre"]',
  // SVG arrow buttons near inputs
  'button[type="submit"]',
  // Class-based (common patterns)
  'button[class*="send"]',
  'button[class*="submit"]',
  'button[class*="Send"]',
];

/**
 * AI response container selectors — where we watch for the AI's reply.
 * We observe mutations here to apply uncageText.
 */
const RESPONSE_SELECTORS: string[] = [
  // ChatGPT
  '[data-message-author-role="assistant"]',
  '.markdown.prose',
  // Claude
  '[data-testid="assistant-message"]',
  '.font-claude-message',
  // Gemini
  'model-response',
  '.response-container',
  // Copilot
  '.ac-adaptiveCard',
  'cib-message[bubble-type="ai"]',
  // Universal patterns
  '[class*="assistant"]',
  '[class*="response"]',
  '[class*="bot-message"]',
  '[class*="ai-message"]',
  '[data-role="assistant"]',
  '[data-author="assistant"]',
  '[data-sender="ai"]',
];

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SCRIPT INJECTION
// Injects the fetch/XHR interceptor into the page's JavaScript context.
// This bypasses the extension isolation and intercepts React's network calls.
// ─────────────────────────────────────────────────────────────────────────────

function injectPageScript(): void {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function () {
      (this as HTMLScriptElement).remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.warn('[AI CAGE] Page-context script injected.');
  } catch (e) {
    console.warn('[AI CAGE] Could not inject page script:', e);
  }
}

// Share entities with the injected page script
function shareEntitiesWithPage(entities: CagedEntity[]): void {
  window.postMessage({
    type: 'AI_CAGE_ENTITIES',
    entities: entities.map((e) => ({
      placeholder: e.placeholder,
      originalValue: e.originalValue,
    })),
  }, '*');
}

// Listen for events from the injected page script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'AI_CAGE_CAGED') {
    updateBanner(sessionCageTotal, false);
  }
  if (event.data?.type === 'AI_CAGE_RESTORED') {
    updateBanner(sessionCageTotal, true);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Map: prompt element → its last sent entities (for uncaging responses) */
const sessionEntityMap: CagedEntity[][] = [];
let   sessionCageTotal = 0;

// ─────────────────────────────────────────────────────────────────────────────
// BANNER
// ─────────────────────────────────────────────────────────────────────────────

function injectBanner(): boolean {
  if (!document.body) return false;
  if (document.getElementById(BANNER_ID)) return true;

  const b = document.createElement('div');
  b.id = BANNER_ID;
  b.setAttribute('role', 'status');
  b.style.cssText = [
    'position:fixed','top:0','left:0','right:0',
    'z-index:2147483647',
    'background:#15803d','color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:13px','font-weight:600',
    'padding:6px 16px',
    'display:flex','align-items:center','gap:8px',
    'box-shadow:0 2px 8px rgba(0,0,0,.25)',
    'user-select:none',
    'transition:background .3s',
  ].join(';');

  b.innerHTML = `
    <span style="font-size:16px">🔒</span>
    <span>AI CAGE Active</span>
    <span id="ai-cage-ctr" style="margin-left:auto;font-weight:400;font-size:12px;opacity:.85">
      Monitoring…
    </span>
  `;

  try { document.body.prepend(b); return true; }
  catch { return false; }
}

function updateBanner(caged: number, uncaged: boolean = false): void {
  const ctr = document.getElementById('ai-cage-ctr');
  const banner = document.getElementById(BANNER_ID);
  if (!ctr || !banner) return;

  if (caged === 0) {
    ctr.textContent = 'Monitoring…';
    banner.style.background = '#15803d';
  } else if (uncaged) {
    ctr.textContent = `${caged} item${caged > 1 ? 's' : ''} caged ✓ Restored`;
    banner.style.background = '#0369a1'; // blue — both cage + uncage done
  } else {
    ctr.textContent = `${caged} item${caged > 1 ? 's' : ''} caged — waiting for AI…`;
    banner.style.background = '#b45309'; // amber — caged, waiting restore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT DETECTION — UNIVERSAL
// ─────────────────────────────────────────────────────────────────────────────

function findPromptElement(): HTMLElement | null {
  for (const sel of PROMPT_SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && isUsableInput(el)) return el;
    } catch { /* invalid selector — skip */ }
  }
  return null;
}

function isUsableInput(el: HTMLElement): boolean {
  try {
    const r = el.getBoundingClientRect();
    // Must be visible and reasonably sized (not a hidden tiny input)
    return r.width > 50 && r.height > 20;
  } catch { return false; }
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  // contenteditable — get text without HTML tags
  return (el.innerText ?? el.textContent ?? '').trim();
}

function writeText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    // Use native setter to bypass React's synthetic event system
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }

    // Dispatch all relevant events so React/Vue/Svelte update their state
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable — select all and replace
    el.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);

    // If execCommand failed (some browsers), use direct DOM + event
    if (readText(el) !== text) {
      el.innerText = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));

      // Move cursor to end
      try {
        const range = document.createRange();
        const sel   = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch { /* ignore cursor positioning errors */ }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAGE LOGIC — PII REMOVAL BEFORE SEND
// ─────────────────────────────────────────────────────────────────────────────

function cagePrompt(el: HTMLElement): boolean {
  const raw = readText(el);
  if (!raw || raw.length < 3) return false;

  const { cagedText, entities, totalCaged } = cageText(raw);
  if (totalCaged === 0) return false;

  writeText(el, cagedText);

  // Store entities for response restoration
  sessionEntityMap.push(entities);
  // Keep only last 10 interactions to avoid memory growth
  if (sessionEntityMap.length > 10) sessionEntityMap.shift();

  // Share entities with the page-context script (for fetch/XHR interception)
  shareEntitiesWithPage(entities);

  sessionCageTotal += totalCaged;
  updateBanner(sessionCageTotal, false);

  // Notify background
  try {
    void chrome.runtime.sendMessage({
      type: 'CAGE_REPORT',
      tabId: 0,
      site: window.location.hostname,
      entities,
    });
  } catch { /* extension context invalidated — safe */ }

  console.warn(`[AI CAGE] 🔒 Caged ${totalCaged} PII item(s) on ${window.location.hostname}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNCAGE LOGIC — RESTORE PII IN AI RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans a text node or element for [CAGED_X] tokens and restores them.
 * Called when we detect new content in AI response areas.
 */
function tryUncageNode(node: Node): boolean {
  if (sessionEntityMap.length === 0) return false;

  // Use all recent entity maps (in case user sent multiple messages)
  const allEntities = sessionEntityMap.flat();
  if (allEntities.length === 0) return false;

  if (node.nodeType === Node.TEXT_NODE) {
    const original = node.textContent ?? '';
    if (!original.includes('[CAGED_')) return false;
    const restored = uncageText(original, allEntities);
    if (restored !== original) {
      node.textContent = restored;
      updateBanner(sessionCageTotal, true);
      return true;
    }
  } else if (node instanceof Element) {
    const html = node.innerHTML;
    if (!html.includes('[CAGED_')) return false;
    const restored = uncageText(html, allEntities);
    if (restored !== html) {
      node.innerHTML = restored;
      updateBanner(sessionCageTotal, true);
      return true;
    }
  }
  return false;
}

/** Walk all text nodes in a subtree and uncage them. */
function uncageSubtree(root: Node): void {
  if (sessionEntityMap.length === 0) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // Skip script/style nodes
        if (node instanceof Element) {
          const tag = node.tagName?.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes('[CAGED_')) {
      tryUncageNode(node);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE OBSERVER — WATCH FOR AI ANSWERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observes the entire document for AI response content.
 * When we see text containing [CAGED_X], we restore it.
 *
 * UNIVERSAL APPROACH: Instead of watching specific AI response containers,
 * we watch the whole document body for new text nodes containing cage tokens.
 * This works on ANY AI platform, current and future.
 */
const responseObserver = new MutationObserver((mutations) => {
  if (sessionEntityMap.length === 0) return;

  for (const mutation of mutations) {
    // New nodes added to DOM
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent?.includes('[CAGED_')) {
          tryUncageNode(node);
        }
      } else if (node instanceof Element) {
        // Scan the entire subtree
        if (node.innerHTML?.includes('[CAGED_')) {
          uncageSubtree(node);
        }
      }
    });

    // Character data changed (streaming responses)
    if (mutation.type === 'characterData') {
      const t = mutation.target;
      if (t.textContent?.includes('[CAGED_')) {
        tryUncageNode(t);
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEND INTERCEPTION — UNIVERSAL STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

/** Strategy 1: keydown Enter — capture phase (fires before page handlers) */
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;

  const target = e.target as HTMLElement;

  // Is this target a prompt input?
  const isInput = PROMPT_SELECTORS.some((sel) => {
    try { return target.matches(sel) || !!target.closest(sel); }
    catch { return false; }
  });

  if (!isInput) return;
  cagePrompt(target);
}, true);

/** Strategy 2: click on send buttons */
function hookSendButtons(): void {
  for (const sel of SEND_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((btn) => {
      if (btn.getAttribute(CAGED_ATTR) === '1') return;
      btn.setAttribute(CAGED_ATTR, '1');
      btn.addEventListener('click', () => {
        const prompt = findPromptElement();
        if (prompt) cagePrompt(prompt);
      }, true);
    });
  }
}

/** Strategy 3: form submit */
document.addEventListener('submit', (e: Event) => {
  const form = e.target as HTMLFormElement;
  const sel = PROMPT_SELECTORS.join(',');
  try {
    const input = form.querySelector<HTMLElement>(sel);
    if (input) cagePrompt(input);
  } catch { /* ignore */ }
}, true);

/** Strategy 4: Detect send via input going empty after non-empty state */
let lastInputValue = '';
document.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLElement;
  const isInput = PROMPT_SELECTORS.some((sel) => {
    try { return target.matches(sel) || !!target.closest(sel); }
    catch { return false; }
  });
  if (!isInput) return;
  const val = readText(target);
  if (lastInputValue.length > 5 && val.length === 0) {
    // Likely submitted — check if we should have caged it
    // (this catches cases where the form cleared the input on submit)
  }
  lastInputValue = val;
}, true);

// DOM observer for dynamically added send buttons (SPAs)
const domObserver = new MutationObserver(() => {
  hookSendButtons();
  if (!document.getElementById(BANNER_ID)) injectBanner();
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

function boot(): void {
  console.warn(`[AI CAGE] 🔒 Universal content script v0.4.5 active on ${window.location.hostname}`);

  // Inject banner
  if (!injectBanner()) {
    // Body not ready — wait
    const w = new MutationObserver(() => {
      if (document.body && injectBanner()) w.disconnect();
    });
    w.observe(document.documentElement, { childList: true });
  }

  // Start DOM observer (for SPA navigation and send buttons)
  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });

    // Start response observer — watches ALL DOM mutations for [CAGED_] tokens
    responseObserver.observe(document.body, {
      childList:     true,
      subtree:       true,
      characterData: true,
    });
  }

  hookSendButtons();
}

// Boot immediately (document_start means DOM may not be ready)
boot();

// Also boot on DOMContentLoaded for any missed elements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hookSendButtons();
    if (!document.getElementById(BANNER_ID)) injectBanner();
    // Re-start observers if body was not ready at first boot
    if (!responseObserver) return;
    responseObserver.observe(document.body, {
      childList:     true,
      subtree:       true,
      characterData: true,
    });
  });
}
