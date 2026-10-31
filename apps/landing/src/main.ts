/**
 * @file main.ts
 * AI CAGE Landing Page — minimal JS for smooth scroll + analytics-ready hooks.
 * No tracking. No telemetry. No external scripts.
 */

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
    if (href && href.length > 1) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

console.log('[AI CAGE] Landing page loaded. Use Monster AI. Leak Zero Data.');
