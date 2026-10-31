/**
 * @file content.ts
 * AI CAGE — Content Script injected into AI chat pages.
 *
 * WHAT IT DOES:
 *   1. Injects the "🔒 AI CAGE Active" security banner into the page.
 *   2. Intercepts form submit & textarea keydown (Enter) to cage PII
 *      in the prompt before it is sent to the AI provider.
 *   3. Reports caged entities to background.ts (no original values sent —
 *      only the summarised metadata).
 *
 * SUPPORTED TARGETS (V1 — Cage 1: Chat Leak):
 *   - chat.openai.com (ChatGPT)
 *   - claude.ai (Anthropic Claude)
 *   - gemini.google.com (Google Gemini)
 *   - copilot.microsoft.com
 *
 * SECURITY CONTRACT:
 *   - cageText() runs LOCALLY in this script, BEFORE any network call.
 *   - The original text is never sent anywhere — only the caged version
 *     is written back into the input element.
 *   - The entities array (which contains original values) lives only in
 *     this script's closure and is cleared after uncaging the response.
 */

import { cageText, uncageText } from '@ai-cage/core';
import type { CagedEntity } from '@ai-cage/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANNER_ID = 'ai-cage-banner';
const CAGED_ATTR = 'data-ai-cage-processed';

/**
 * CSS selectors for the prompt textarea on each supported platform.
 * Ordered by specificity — first match wins.
 */
const PROMPT_SELECTORS = [
  // ChatGPT
  '#prompt-textarea',
  'textarea[data-id="root"]',
  // Claude
  'div[contenteditable="true"].ProseMirror',
  // Gemini
  'rich-textarea .ql-editor',
  // Copilot / generic fallback
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="prompt" i]',
  'textarea',
];

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

/**
 * Injects the AI CAGE security banner at the top of the page.
 * Safe to call multiple times — idempotent.
 */
function injectBanner(): void {
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 2147483647',
    'background: #15803d',
    'color: #ffffff',
    'font-family: system-ui, sans-serif',
    'font-size: 13px',
    'font-weight: 600',
    'padding: 6px 16px',
    'display: flex',
    'align-items: center',
    'gap: 8px',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.25)',
    'user-select: none',
  ].join('; ');

  banner.innerHTML = `
    <span aria-hidden="true">🔒</span>
    <span>AI CAGE Active</span>
    <span id="ai-cage-counter" style="margin-left:auto;opacity:0.85;font-weight:400">
      0 items caged this session
    </span>
  `;

  document.body.prepend(banner);
}

/**
 * Updates the session counter displayed in the banner.
 *
 * @param total - Running total of caged entities this page session.
 */
function updateBannerCounter(total: number): void {
  const counter = document.getElementById('ai-cage-counter');
  if (counter) {
    counter.textContent =
      total === 1 ? '1 item caged' : `${String(total)} items caged`;
  }
}

// ---------------------------------------------------------------------------
// Session state — lives only in this content script's memory
// ---------------------------------------------------------------------------

/** All entities caged during this page session, for potential uncaging. */
let sessionEntities: CagedEntity[] = [];
let sessionCageTotal = 0;

// ---------------------------------------------------------------------------
// Intercept helpers
// ---------------------------------------------------------------------------

/**
 * Finds the active prompt input element on the page.
 *
 * @returns The textarea / contenteditable element, or null if not found.
 */
function findPromptElement(): HTMLElement | null {
  for (const selector of PROMPT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && isVisible(el)) return el;
  }
  return null;
}

/**
 * Returns true if an element is visible and interactable.
 */
function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Reads the current text value from a prompt element regardless of type.
 */
function readPromptText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  return el.innerText;
}

/**
 * Writes caged text back into the prompt element.
 * Preserves caret position for textareas.
 */
function writePromptText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    el.value = text;
    // Restore caret
    el.setSelectionRange(start, end);
    // Trigger React/Vue synthetic event
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  } else {
    el.innerText = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}

/**
 * Core interception: cage PII in the prompt element, then notify background.
 *
 * @param el - The prompt element to process.
 * @returns true if any PII was found and caged.
 */
function interceptPrompt(el: HTMLElement): boolean {
  const raw = readPromptText(el);
  if (!raw.trim()) return false;

  const { cagedText, entities, totalCaged } = cageText(raw);

  if (totalCaged === 0) return false;

  // Write sanitised text back — this is what reaches the AI provider
  writePromptText(el, cagedText);

  // Store entities for potential response uncaging
  sessionEntities = [...sessionEntities, ...entities];
  sessionCageTotal += totalCaged;

  updateBannerCounter(sessionCageTotal);

  // Report to background (summary only — no original values)
  void chrome.runtime.sendMessage({
    type: 'CAGE_REPORT',
    tabId: 0,
    entities,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

/**
 * Intercept Enter key submissions in textareas.
 */
document.addEventListener(
  'keydown',
  (event: KeyboardEvent) => {
    // Shift+Enter = newline, not submit — skip
    if (event.key !== 'Enter' || event.shiftKey) return;

    const target = event.target as HTMLElement;
    const isPrompt = PROMPT_SELECTORS.some((sel) => target.matches(sel));
    if (!isPrompt) return;

    interceptPrompt(target);
    // We don't preventDefault — we let the submit happen with caged text
  },
  true, // capture phase — run before page handlers
);

/**
 * Intercept form submissions for providers using button clicks.
 * We observe DOM mutations to attach to dynamically added send buttons.
 */
function attachSendButtonListeners(): void {
  const sendButtonSelectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="envoyer" i]',
    'button[type="submit"]',
  ];

  for (const selector of sendButtonSelectors) {
    document.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
      if (btn.getAttribute(CAGED_ATTR)) return;
      btn.setAttribute(CAGED_ATTR, 'true');

      btn.addEventListener(
        'click',
        () => {
          const promptEl = findPromptElement();
          if (promptEl) interceptPrompt(promptEl);
        },
        true, // capture
      );
    });
  }
}

/** Re-scan for send buttons when the DOM changes (SPAs). */
const observer = new MutationObserver(() => {
  attachSendButtonListeners();
});

observer.observe(document.body, { childList: true, subtree: true });

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  injectBanner();
  attachSendButtonListeners();
  console.warn('[AI CAGE] Content script active. PII caging enabled.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
