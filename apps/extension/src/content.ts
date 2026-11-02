// Copyright (c) 2026 Frikha, Tunisia. All rights reserved.
// AI CAGE — Enterprise AI Data Protection
// Licensed under Business Source License 1.1 — see LICENSE
// Commercial use: contact@ai-cage.io

/**
 * @file content.ts
 * AI CAGE — Content Script v0.4.5
 *
 * CRITICAL FIX (Nov 2026):
 *   - ChatGPT now uses div[contenteditable] not textarea for the prompt
 *   - Intercept via MutationObserver on the full document to catch
 *     all submit events regardless of element type
 *   - Banner injection retried until document.body is ready
 *
 * SUPPORTED TARGETS:
 *   - chat.openai.com / chatgpt.com (ChatGPT)
 *   - claude.ai (Anthropic Claude)
 *   - gemini.google.com (Google Gemini)
 *   - copilot.microsoft.com + bing.com/chat (Microsoft Copilot)
 */

import { cageText, uncageText } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANNER_ID   = 'ai-cage-banner';
const CAGED_ATTR  = 'data-ai-cage-processed';

/**
 * Selectors for the prompt input — ordered by specificity.
 * Covers ALL major AI chat platforms (2025+).
 */
const PROMPT_SELECTORS = [
  // ChatGPT (2024+) — contenteditable div
  '#prompt-textarea',
  'div#prompt-textarea',
  // ChatGPT generic contenteditable
  'div[contenteditable="true"][data-id]',
  // Claude
  'div[contenteditable="true"].ProseMirror',
  // Gemini
  'rich-textarea .ql-editor',
  'div.ql-editor[contenteditable="true"]',
  // Mistral / Le Chat
  'textarea[placeholder*="Envoyer" i]',
  'textarea[placeholder*="Message" i]',
  // Perplexity
  'textarea[placeholder*="Ask" i]',
  // Poe / Phind / generic
  'textarea[data-testid*="chat" i]',
  'textarea[data-testid*="input" i]',
  // DeepSeek
  'textarea#chat-input',
  // Meta AI
  'div[aria-label*="message" i][contenteditable="true"]',
  // Grok (X/Twitter)
  'div[data-testid="tweetTextarea_0"]',
  // Copilot / Edge
  'cib-text-input textarea',
  'textarea[id*="userInput"]',
  // HuggingFace
  'textarea[placeholder*="Type" i]',
  // Generic fallbacks (last resort)
  'div[contenteditable="true"][aria-label]',
  'div[contenteditable="true"][aria-multiline]',
  'textarea[placeholder*="chat" i]',
  'div[contenteditable="true"]',
  'textarea',
];

/**
 * Send button selectors — ALL major AI platforms.
 */
const SEND_BUTTON_SELECTORS = [
  // ChatGPT 2025
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  // Claude
  'button[aria-label="Send Message"]',
  'button[data-testid="send-button"]',
  // Gemini
  'button[aria-label="Send message"]',
  'button.send-button',
  // Mistral
  'button[type="submit"]',
  // Perplexity
  'button[aria-label*="submit" i]',
  // Copilot / Edge
  'button[aria-label*="send" i]',
  'button[aria-label*="envoyer" i]',
  'cib-typing-indicator + div button',
  // Poe
  'button[class*="SendButton"]',
  // Meta AI
  'div[aria-label="Send"][role="button"]',
  // Grok
  'button[data-testid="tweetButton"]',
  // Generic
  'button[type="submit"]',
  'form button:last-of-type',
];

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

let sessionEntities: CagedEntity[] = [];
let sessionCageTotal = 0;

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function injectBanner(): boolean {
  if (!document.body) return false;
  if (document.getElementById(BANNER_ID)) return true;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'z-index:2147483647',
    'background:#15803d', 'color:#ffffff',
    'font-family:system-ui,sans-serif',
    'font-size:13px', 'font-weight:600',
    'padding:6px 16px',
    'display:flex', 'align-items:center', 'gap:8px',
    'box-shadow:0 2px 8px rgba(0,0,0,.25)',
    'user-select:none',
  ].join(';');

  banner.innerHTML = `
    <span aria-hidden="true">🔒</span>
    <span>AI CAGE Active</span>
    <span id="ai-cage-counter" style="margin-left:auto;opacity:.85;font-weight:400">
      Ready to cage PII
    </span>
  `;

  try {
    document.body.prepend(banner);
    return true;
  } catch {
    return false;
  }
}

function updateBannerCounter(total: number): void {
  const counter = document.getElementById('ai-cage-counter');
  if (counter) {
    counter.textContent = total === 0
      ? 'Ready to cage PII'
      : total === 1 ? '1 item caged' : `${total} items caged`;
    counter.style.color = total > 0 ? '#86efac' : '';
  }
}

// ---------------------------------------------------------------------------
// Prompt element finder
// ---------------------------------------------------------------------------

function findPromptElement(): HTMLElement | null {
  for (const selector of PROMPT_SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && isVisible(el)) return el;
    } catch { /* invalid selector — skip */ }
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  try {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch {
    return false;
  }
}

function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  // contenteditable div
  return el.innerText ?? el.textContent ?? '';
}

function writeText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? text.length;
    const end   = el.selectionEnd   ?? text.length;

    // Native input setter — needed for React synthetic events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set ?? Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, text);
    } else {
      el.value = text;
    }

    el.setSelectionRange(start, end);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable div — ChatGPT 2025+
    el.focus();

    // Select all content and replace
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('insertText', false, text);

    // Also set innerText as fallback
    if (el.innerText !== text) {
      el.innerText = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// ---------------------------------------------------------------------------
// Core cage logic
// ---------------------------------------------------------------------------

function interceptPrompt(el: HTMLElement): boolean {
  const raw = readText(el).trim();
  if (!raw) return false;

  const { cagedText, entities, totalCaged } = cageText(raw);
  if (totalCaged === 0) return false;

  writeText(el, cagedText);

  sessionEntities = [...sessionEntities, ...entities];
  sessionCageTotal += totalCaged;
  updateBannerCounter(sessionCageTotal);

  try {
    void chrome.runtime.sendMessage({
      type: 'CAGE_REPORT',
      tabId: 0,
      site: window.location.hostname,
      entities,
    });
  } catch { /* extension context invalidated — safe to ignore */ }

  console.warn(`[AI CAGE] 🔒 Caged ${totalCaged} PII item(s) before send.`);
  return true;
}

// ---------------------------------------------------------------------------
// Event listeners — multiple strategies for maximum compatibility
// ---------------------------------------------------------------------------

// Strategy 1: keydown Enter on the document (capture phase)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.shiftKey) return;

  const target = e.target as HTMLElement;

  // Check if target IS or IS INSIDE a prompt element
  const isPrompt = PROMPT_SELECTORS.some((sel) => {
    try { return target.matches(sel) || target.closest(sel) !== null; }
    catch { return false; }
  });

  if (!isPrompt) return;
  interceptPrompt(target);
}, true);

// Strategy 2: click on send buttons
function attachSendButtonListeners(): void {
  for (const sel of SEND_BUTTON_SELECTORS) {
    document.querySelectorAll<HTMLButtonElement>(sel).forEach((btn) => {
      if (btn.getAttribute(CAGED_ATTR)) return;
      btn.setAttribute(CAGED_ATTR, 'true');
      btn.addEventListener('click', () => {
        const prompt = findPromptElement();
        if (prompt) interceptPrompt(prompt);
      }, true);
    });
  }
}

// Strategy 3: MutationObserver — handles SPAs where DOM changes dynamically
const observer = new MutationObserver(() => {
  attachSendButtonListeners();
  // Retry banner injection if body wasn't ready at boot
  if (!document.getElementById(BANNER_ID)) injectBanner();
});

// Strategy 4: form submit
document.addEventListener('submit', (e: Event) => {
  const form = e.target as HTMLFormElement;
  const textarea = form.querySelector<HTMLElement>(PROMPT_SELECTORS.join(','));
  if (textarea) interceptPrompt(textarea);
}, true);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  console.warn('[AI CAGE] Content script v0.4.5 booting on', window.location.hostname);

  // Inject banner
  if (!injectBanner()) {
    // body not ready — wait
    const bodyWatcher = new MutationObserver(() => {
      if (document.body && injectBanner()) {
        bodyWatcher.disconnect();
      }
    });
    bodyWatcher.observe(document.documentElement, { childList: true });
  }

  // Start observing
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  attachSendButtonListeners();

  console.warn('[AI CAGE] 🔒 Active — intercepting prompts on', window.location.hostname);
}

// Boot immediately regardless of readyState
boot();

// Also hook into page load events in case early boot missed something
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    attachSendButtonListeners();
    if (!document.getElementById(BANNER_ID)) injectBanner();
  });
}
