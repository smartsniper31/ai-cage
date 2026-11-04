# AI CAGE — UX Fixes Priorisés v0.6.0
**Date :** 2026-11-04  
**Source :** docs/UX_AUDIT.md — Audit complet v0.5.0  
**Persona :** Karim, 34 ans, Bizerte, non-tech, paie 5€/mois  
**Règle :** P0 = bloque la vente. P1 = dégrade l'expérience. P2 = nice to have.

---

## P0 — BLOQUANTS VENTE (à corriger avant tout lancement commercial)

> Ces 9 bugs font que Karim désinstalle ou ne paie pas. Aucune exception.

---

### FIX-P0-1 · Versions multiples visibles (3 versions différentes)
**Priorité :** P0 · **Effort :** 30 min · **Risque fix :** faible

**Problème :**  
- `popup.html` affiche `v0.4.5` (hardcodé)  
- `content.ts` `showStatusPanel()` affiche `v0.5.0` (hardcodé)  
- `desktop/src/index.html` affiche `v0.3.0` (hardcodé)  
- `manifest.json` version réelle : `0.4.5`

**Fix :**
```typescript
// popup.ts — DOMContentLoaded (ajouter)
const { version } = chrome.runtime.getManifest();
document.querySelector<HTMLElement>('.header-version')!.textContent = `v${version}`;
```
```typescript
// content.ts — showStatusPanel() — remplacer le hardcode
const v = (() => { try { return chrome.runtime.getManifest().version; } catch { return '0.5.0'; } })();
// puis dans le HTML du panel : `<span>v${v}</span>`
```
```html
<!-- popup.html — supprimer le hardcode -->
<span class="header-version" id="popup-version"></span>
```
```html
<!-- desktop/src/index.html — aligner sur v0.4.5 -->
<span class="header-badge">v0.4.5 · Cage 3: Agent Rogue Active</span>
```

**Fichiers modifiés :**
- `apps/extension/src/popup.html`
- `apps/extension/src/popup.ts`
- `apps/extension/src/content.ts`
- `apps/desktop/src/index.html`

**Critère de validation :** Popup + mini-panel + desktop affichent la même version. Si `manifest.json` passe à `0.6.0`, tous les affichages se mettent à jour automatiquement.

---

### FIX-P0-2 · Dead link `Upgrade to Pro` (href="#")
**Priorité :** P0 · **Effort :** 5 min · **Risque fix :** faible

**Problème :** `popup.html` — `<a href="#" id="upgrade-link">Upgrade to Pro</a>` ne fait rien.

**Fix :**
```html
<!-- popup.html — remplacer href="#" -->
<a href="https://ai-cage-gamma.vercel.app/#pricing"
   id="upgrade-link"
   target="_blank"
   rel="noopener noreferrer"
   style="color:#92400e;text-decoration:underline;font-weight:700">
  🚀 Upgrade to Pro — 5€/mois →
</a>
```

**Fichier modifié :** `apps/extension/src/popup.html`

**Critère de validation :** Karim voit le watermark jaune → clique → landing pricing s'ouvre dans un nouvel onglet en <1s.

---

### FIX-P0-3 · `Start Pro Trial` → mailto remplacé par vrai checkout
**Priorité :** P0 · **Effort :** 2h (création Stripe Payment Link) · **Risque fix :** faible

**Problème :** `landing/index.html` pricing — `href="mailto:contact@ai-cage.io?subject=AI CAGE Pro Trial"`.

**Fix (étape 1 — immédiate sans Stripe) :**
```html
<!-- landing/index.html — Pro card -->
<a href="https://tally.so/r/[votre-form]"
   target="_blank"
   class="block text-center bg-cage-green text-white py-2.5 rounded-lg font-semibold hover:bg-cage-green-dark transition text-sm">
  💳 Démarrer l'essai Pro — 5€/mois
</a>
```

**Fix (étape 2 — Stripe) :**
1. Créer un Stripe Payment Link sur https://dashboard.stripe.com/payment-links
2. Remplacer par `href="https://buy.stripe.com/[link-id]"`

**Fichier modifié :** `apps/landing/index.html`

**Critère de validation :** Karim clique "Start Pro Trial" → page de paiement ou formulaire en <2s. Jamais son client mail.

---

### FIX-P0-4 · Double popup simultané (mini-panel + grand popup)
**Priorité :** P0 · **Effort :** 1h · **Risque fix :** moyen

**Problème :** La bulle flottante + mini-panel Shadow DOM de `content.ts` est toujours visible. Quand Karim clique sur l'icône Chrome, le grand popup s'ouvre en plus. Les deux co-existent.

**Fix :**
```typescript
// content.ts — boot() — vérifier si popup est ouvert avant de créer la bulle
// Option A (simple) : ne pas créer le mini-panel flottant si l'extension popup est déjà ouvert
// Option B (recommandée) : remplacer le popup Chrome par une bulle seule

// Dans manifest.json — supprimer "default_popup" pour ne garder que la bulle
// "action": { "default_title": "AI CAGE", "default_icon": {...} }
// Le clic sur l'icône extension envoie un message à content.ts pour toggle le panel
```

```typescript
// background.ts — ajouter
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    void chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  }
});
```

```typescript
// content.ts — écouter TOGGLE_PANEL
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_PANEL') togglePanel();
});
```

**Fichiers modifiés :**
- `apps/extension/src/manifest.json` (suppr. `default_popup`)
- `apps/extension/src/background.ts`
- `apps/extension/src/content.ts`

**Critère de validation :** Karim clique sur l'icône → 1 seul panneau s'ouvre. Pas deux. La bulle flottante devient le seul point d'entrée.

> ⚠️ **Alternative moins risquée :** Garder le popup Chrome mais supprimer la bulle flottante et le mini-panel Shadow DOM. Le grand popup devient l'interface principale. Plus simple, moins de surface.

---

### FIX-P0-5 · Contradiction `Monitoring — no PII detected yet` vs `14 Caged this month`
**Priorité :** P0 · **Effort :** 30 min · **Risque fix :** faible

**Problème :** `popup.ts` `renderOverview()` — `status-text` affiche "no PII detected yet" alors que `monthly-caged` affiche 14.

**Fix :**
```typescript
// popup.ts — renderOverview() — remplacer la logique status
const monthly = resp?.monthlyPiiCaged ?? 0;
const session = resp?.sessionCageCount ?? 0;
const shadow  = resp?.sessionShadowCount ?? 0;

if (status) {
  if (shadow > 0) {
    status.textContent = `⚠️ Shadow AI détecté (${shadow} appels)`;
    status.style.background = '#fef2f2';
    status.style.color = '#991b1b';
    status.style.borderColor = '#fecaca';
  } else if (session > 0) {
    status.textContent = `🔒 Protection active — ${session} protégés cette session`;
  } else if (monthly > 0) {
    // ← FIX : ne pas dire "no PII detected" si monthly > 0
    status.textContent = `✅ Actif — ${monthly} éléments protégés ce mois`;
  } else {
    status.textContent = `✅ Surveillance active — tapez un prompt sur une IA pour tester`;
  }
}
```

**Fichier modifié :** `apps/extension/src/popup.ts`

**Critère de validation :** Karim ouvre le popup après avoir eu 14 cages → le message dit "14 éléments protégés ce mois", pas "no PII detected yet".

---

### FIX-P0-6 · Onboarding — aucune page de bienvenue à la 1ère installation
**Priorité :** P0 · **Effort :** 2h · **Risque fix :** faible

**Problème :** Aucun `chrome.runtime.onInstalled` dans `background.ts`. Premier contact = 4 zéros + anglais.

**Fix :**
```typescript
// background.ts — ajouter après registerShadowAiObserver()
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    void chrome.tabs.create({
      url: 'https://ai-cage-gamma.vercel.app/bienvenue'
    });
  }
});
```

Créer `apps/landing/bienvenue.html` (ou une section sur la landing) avec :
1. "AI CAGE est installé et actif ✅"
2. "Comment tester en 30 secondes : allez sur ChatGPT, tapez votre email → regardez la bulle verte"
3. "Ce que vous voyez dans le popup expliqué"
4. CTA "Voir les stats de protection →"

**Fichiers modifiés :**
- `apps/extension/src/background.ts`
- `apps/landing/bienvenue.html` (nouveau fichier)

**Critère de validation :** Karim installe l'extension → page de bienvenue s'ouvre automatiquement en <2s. Il comprend quoi faire sans lire une doc.

---

### FIX-P0-7 · Toast de confirmation invisible après caging
**Priorité :** P0 · **Effort :** 1h · **Risque fix :** faible

**Problème :** `content.ts` — quand un item est cagé, aucun feedback visuel autre que la bulle qui change de couleur 250ms.

**Fix :**
```typescript
// content.ts — ajouter la fonction showToast()
function showToast(message: string, type: 'success' | 'warning' = 'success'): void {
  const root = getShadowRoot();
  if (!root) return;
  const existing = root.getElementById('cage-toast');
  if (existing) existing.remove();

  const bg = type === 'success' ? '#15803d' : '#d97706';
  const toast = document.createElement('div');
  toast.id = 'cage-toast';
  toast.style.cssText = `
    position:fixed;bottom:76px;right:74px;z-index:2147483647;
    background:${bg};color:#fff;border-radius:8px;
    padding:8px 14px;font-size:12px;font-weight:700;
    font-family:${FONT};box-shadow:0 4px 12px rgba(0,0,0,.3);
    animation:cage-in .15s ease;pointer-events:none;
    max-width:220px;
  `;
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// Dans handlePrompt() — après sessionTotal += totalCaged :
const labels = entities.slice(0, 2).map(e => e.type.replace(/_/g,' ').toLowerCase()).join(', ');
const more = entities.length > 2 ? ` +${entities.length - 2}` : '';
showToast(`🔒 ${totalCaged} protégé${totalCaged > 1 ? 's' : ''} (${labels}${more})`);

// Dans decide() mode 'cage' — content.ts showNetworkPanel() :
showToast(`🔒 ${cageItems.length} élément${cageItems.length > 1 ? 's' : ''} cagé${cageItems.length > 1 ? 's' : ''}`);
```

**Fichier modifié :** `apps/extension/src/content.ts`

**Critère de validation :** Karim envoie un message avec son email → toast vert "🔒 1 protégé (email address)" apparaît en bas-droite en <100ms, disparaît après 2.5s.

---

### FIX-P0-8 · Mini-panel coupé par la taskbar Windows
**Priorité :** P0 · **Effort :** 15 min · **Risque fix :** faible

**Problème :** `content.ts` — `position:fixed;bottom:74px;right:20px` — insuffisant sur Windows avec taskbar (48px) + "Activer Windows" watermark (32px).

**Fix :**
```typescript
// content.ts — CSS du panel Shadow DOM — remplacer bottom:74px
#cage-panel{
  position:fixed;
  bottom:max(80px, env(safe-area-inset-bottom, 80px));
  right:20px;
  z-index:2147483647;
  width:310px;
  max-height:min(440px, calc(100vh - 160px));  /* ← ne jamais dépasser l'écran */
  ...
}

// Et pour la bulle :
#cage-bubble {
  position:fixed;
  bottom:max(20px, env(safe-area-inset-bottom, 20px));
  right:20px;
  ...
}
```

**Fichier modifié :** `apps/extension/src/content.ts`

**Critère de validation :** "🇹🇳 Made in Tunisia" visible en entier sur Windows 11 avec taskbar normale (48px) et watermark "Activer Windows".

---

### FIX-P0-9 · Warning manquant pour les uploads PDF (fuite non couverte)
**Priorité :** P0 · **Effort :** 2h · **Risque fix :** moyen

**Problème :** `injected.ts` — les `FormData` et `Blob` ne sont pas scannés. Un PDF uploadé fuit sans alerte.

**Fix (court terme — warning visible) :**
```typescript
// injected.ts — dans la fonction fetch wrappée
// Ajouter après la vérification isAI(url)

// Détecter FormData
if (init?.body instanceof FormData) {
  // Afficher un warning via postMessage à content.ts
  window.postMessage({
    type: 'AI_CAGE_FILE_UPLOAD_WARNING',
    url,
  }, '*');
  // Ne pas bloquer — juste avertir
  return _fetch(input, init);
}
```

```typescript
// content.ts — écouter AI_CAGE_FILE_UPLOAD_WARNING
if (d?.type === 'AI_CAGE_FILE_UPLOAD_WARNING') {
  showToast('⚠️ Fichier uploadé — contenu non scanné. Vérifiez avant d\'envoyer.', 'warning');
  return;
}
```

**Fichiers modifiés :**
- `apps/extension/src/injected.ts`
- `apps/extension/src/content.ts`

**Critère de validation :** Karim glisse un PDF dans DeepSeek → toast orange "⚠️ Fichier uploadé — contenu non scanné" en <500ms. Aucune fuite silencieuse.

---

## P1 — DÉGRADENT L'EXPÉRIENCE (à corriger en sprint v0.6.0)

> Ces bugs ne bloquent pas la vente mais augmentent le churn. À corriger dans le même sprint.

---

### FIX-P1-1 · Interface 100% anglais (client FR/AR)
**Priorité :** P1 · **Effort :** 4h · **Risque fix :** faible

**Problème :** Toutes les chaînes UI sont en anglais. Client tunisien francophone.

**Fix :**
Créer `apps/extension/src/_locales/fr/messages.json` :
```json
{
  "extName": { "message": "AI CAGE — Protection Données IA" },
  "statusMonitoring": { "message": "✅ Surveillance active — aucun PII détecté" },
  "statusProtecting": { "message": "🔒 Protection active" },
  "statusShadow": { "message": "⚠️ IA cachée détectée" },
  "cagedThisMonth": { "message": "Protégés ce mois" },
  "cagedThisSession": { "message": "Cette session" },
  "cagedThisTab": { "message": "Cet onglet" },
  "shadowAiCalls": { "message": "IA cachées" },
  "exportCsv": { "message": "📄 Exporter le rapport" },
  "noActivityYet": { "message": "Aucune activité enregistrée. Tapez un message sur ChatGPT pour tester." },
  "zeroDataLeaves": { "message": "✅ Aucune donnée ne quitte votre appareil." },
  "upgradePro": { "message": "🚀 Passer à Pro — 5€/mois" },
  "monitoringPrompt": { "message": "🔍 Surveillance... Tapez un message avec des données sensibles." },
  "totalCaged": { "message": "Total protégés" },
  "zeroDataSent": { "message": "✅ Zéro donnée envoyée" }
}
```

Référencer dans `manifest.json` : `"default_locale": "fr"`

**Fichiers modifiés :**
- `apps/extension/src/manifest.json` (ajouter `default_locale`)
- `apps/extension/src/_locales/fr/messages.json` (nouveau)
- `apps/extension/src/_locales/en/messages.json` (nouveau, fallback)
- `apps/extension/src/popup.html` (remplacer strings par `chrome.i18n.getMessage()`)
- `apps/extension/src/content.ts` (remplacer strings hardcodées)

**Critère de validation :** Chrome en français → popup en français. Chrome en anglais → popup en anglais.

---

### FIX-P1-2 · Bouton Help absent dans le popup et mini-panel
**Priorité :** P1 · **Effort :** 30 min · **Risque fix :** faible

**Problème :** Aucun point de contact support visible dans l'extension.

**Fix :**
```html
<!-- popup.html — footer, avant export-btn -->
<a href="https://ai-cage-gamma.vercel.app/aide"
   target="_blank"
   rel="noopener noreferrer"
   title="Aide & Support"
   style="font-size:16px;cursor:pointer;text-decoration:none;color:#166534"
   aria-label="Aide">
  ❓
</a>
```

```typescript
// content.ts — showStatusPanel() — ajouter dans le footer du mini-panel
<a href="https://ai-cage-gamma.vercel.app/aide" 
   target="_blank" 
   style="color:#94a3b8;font-size:10px;text-decoration:none">
  ❓ Aide
</a>
```

**Fichiers modifiés :**
- `apps/extension/src/popup.html`
- `apps/extension/src/content.ts`

**Critère de validation :** Karim bloqué → clique ❓ → page d'aide en <1s, sans devoir chercher sur Google.

---

### FIX-P1-3 · Empty states sans instruction (texte en anglais, pas de CTA)
**Priorité :** P1 · **Effort :** 1h · **Risque fix :** faible

**Problème :** `popup.html` — `"No activity recorded yet."` — aucune instruction.

**Fix :**
```html
<!-- popup.html — #top-sites empty -->
<li class="empty" style="line-height:1.8;padding:12px 0">
  Aucune activité enregistrée.<br />
  <span style="color:#15803d;font-weight:700">
    Allez sur ChatGPT et tapez votre email → regardez la magie.
  </span>
</li>
```

```html
<!-- popup.html — #shadow-list empty -->
<li class="empty" style="line-height:1.8">
  Aucune IA cachée détectée pour l'instant.<br />
  Continuez à naviguer — on surveille pour vous.
</li>
```

**Fichier modifié :** `apps/extension/src/popup.html`

**Critère de validation :** Karim installe → ouvre popup → voit une instruction claire en français sur quoi faire ensuite.

---

### FIX-P1-4 · Shadow AI entries non cliquables (pas de détail)
**Priorité :** P1 · **Effort :** 1h · **Risque fix :** faible

**Problème :** `popup.ts` `renderShadowAi()` — les items sont affichés mais pas interactifs.

**Fix :**
```typescript
// popup.ts — renderShadowAi() — rendre les items toggle
listEl.innerHTML = [...bysite.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .map(([site, info]) => `
    <li class="shadow-item" 
        style="cursor:pointer" 
        data-detail="${escHtml(info.detail)}"
        onclick="const d=this.querySelector('.shadow-detail-full');d.style.display=d.style.display==='none'?'block':'none'">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="shadow-site">${escHtml(site)}</div>
        <div style="font-size:10px;color:#64748b">${info.count} appels · ${formatDate(info.lastSeen)} ▾</div>
      </div>
      <div class="shadow-detail-full" style="display:none;margin-top:4px;font-size:10px;color:#64748b;word-break:break-all">
        ${escHtml(info.detail)}
      </div>
    </li>`)
  .join('');
```

**Fichier modifié :** `apps/extension/src/popup.ts`

**Critère de validation :** Karim clique sur "chat.deepseek.com 13 calls" → détail se déroule en <300ms.

---

### FIX-P1-5 · Corriger les fausses features LIVE sur la landing
**Priorité :** P1 · **Effort :** 30 min · **Risque fix :** faible

**Problème :** `landing/index.html` — Cage 4 (Code Leak) et Cage 5 (Voice/Video) marquées "✅ Live" mais n'existent pas dans v0.4.5.

**Fix :**
```html
<!-- landing/index.html — Cage 4 card -->
<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
  🔜 Bientôt — v0.6.0
</span>

<!-- landing/index.html — Cage 5 card -->
<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
  🔜 Bientôt — v0.7.0
</span>
```

**Fichier modifié :** `apps/landing/index.html`

**Critère de validation :** Landing ne promet pas des features inexistantes. 0 risque de plainte client.

---

### FIX-P1-6 · Persistance `sessionCageCount` après restart du service worker
**Priorité :** P1 · **Effort :** 2h · **Risque fix :** moyen

**Problème :** `background.ts` — `sessionCageCount` et `sessionShadowCount` sont en mémoire SW → reset toutes les 30s d'inactivité en MV3.

**Fix :**
```typescript
// background.ts — remplacer les variables mémoire par chrome.storage.session (MV3)
// chrome.storage.session persiste pendant la session Chrome (pas reset au restart SW)

async function getSessionCounts(): Promise<{ cage: number; shadow: number }> {
  const result = await chrome.storage.session.get(['sessionCage', 'sessionShadow']);
  return {
    cage:   (result['sessionCage']   as number) ?? 0,
    shadow: (result['sessionShadow'] as number) ?? 0,
  };
}

async function incrementSessionCage(n: number): Promise<void> {
  const { cage } = await getSessionCounts();
  await chrome.storage.session.set({ sessionCage: cage + n });
}

async function incrementSessionShadow(): Promise<void> {
  const { shadow } = await getSessionCounts();
  await chrome.storage.session.set({ sessionShadow: shadow + 1 });
}
```

**Fichier modifié :** `apps/extension/src/background.ts`

**Critère de validation :** Karim cage 10 items, attend 5 minutes (SW s'endort et redémarre), rouvre le popup → "Caged this session: 10" toujours affiché.

---

### FIX-P1-7 · Performance : MutationObserver trop large (CPU spike)
**Priorité :** P1 · **Effort :** 1h · **Risque fix :** faible

**Problème :** `content.ts` — `domObserver.observe(document.body, { childList: true, subtree: true })` + `hookButtons()` appelé à chaque mutation.

**Fix :**
```typescript
// content.ts — throttle hookButtons() dans le MutationObserver
let hookDebounce: ReturnType<typeof setTimeout> | null = null;
const domObserver = new MutationObserver(() => {
  // Throttle hookButtons : au plus 1x toutes les 500ms
  if (!hookDebounce) {
    hookDebounce = setTimeout(() => {
      hookButtons();
      hookDebounce = null;
    }, 500);
  }
  // Bulle : vérifier seulement si nécessaire
  const root = getShadowRoot();
  if (root && !root.getElementById('cage-bubble')) createBubble();
});
```

**Fichier modifié :** `apps/extension/src/content.ts`

**Critère de validation :** Sur DeepSeek avec 100 messages streamés, pas de spike CPU visible dans Chrome Task Manager.

---

## P2 — AMÉLIORATIONS QUALITÉ (sprint v0.7.0)

> Pas bloquant mais visible pour un client qui paie régulièrement.

---

### FIX-P2-1 · Dark mode du mini-panel (respect du thème du site)
**Priorité :** P2 · **Effort :** 2h

**Fix :** Utiliser `prefers-color-scheme` dans le Shadow DOM :
```css
@media (prefers-color-scheme: dark) {
  #cage-panel { background:#1e293b; color:#f1f5f9; }
  .cs { background:#0f172a; border-color:#334155; }
  .cf { background:#0f172a; color:#64748b; }
}
```

**Critère de validation :** Sur Claude.ai dark → mini-panel dark. Sur ChatGPT light → mini-panel light.

---

### FIX-P2-2 · Activation de licence dans l'extension
**Priorité :** P2 · **Effort :** 8h

**Fix :** Ajouter un tab "⚙️ Compte" dans le popup avec un champ "Votre clé Pro" + validation locale (hash comparison, 0 réseau).

**Critère de validation :** Karim colle sa clé → Pro activé, watermark disparaît, cages illimitées.

---

### FIX-P2-3 · Lien vers le code source depuis le popup (preuve zero-data)
**Priorité :** P2 · **Effort :** 30 min

**Fix :** Ajouter dans le footer du popup :
```html
<a href="https://github.com/smartsniper31/ai-cage" target="_blank" 
   style="font-size:9px;color:#94a3b8;text-decoration:none">
  🔍 Code source vérifiable
</a>
```

**Critère de validation :** Karim dit "comment je sais que vous ne volez pas mes données?" → il clique → GitHub s'ouvre.

---

### FIX-P2-4 · Section Multi-onglets : identifier le site dans les stats
**Priorité :** P2 · **Effort :** 3h

**Fix :** Dans la popup Overview, ajouter le nom du site actif à côté de "Caged this tab" :
`Caged this tab (deepseek.com) : 3`

**Critère de validation :** Karim a 3 onglets IA ouverts → il sait quel site a déclenché quelle protection.

---

## Récapitulatif Priorisation

| ID | Titre | P | Effort | Sprint |
|----|-------|---|--------|--------|
| P0-1 | Version unifiée partout | P0 | 30 min | v0.6.0 |
| P0-2 | Dead link Upgrade Pro | P0 | 5 min | v0.6.0 |
| P0-3 | Pro Trial → checkout réel | P0 | 2h | v0.6.0 |
| P0-4 | Double popup → 1 seule UI | P0 | 1h | v0.6.0 |
| P0-5 | Contradiction status vs monthly | P0 | 30 min | v0.6.0 |
| P0-6 | Onboarding page install | P0 | 2h | v0.6.0 |
| P0-7 | Toast confirmation après cage | P0 | 1h | v0.6.0 |
| P0-8 | Mini-panel coupé Windows | P0 | 15 min | v0.6.0 |
| P0-9 | Warning PDF upload non couvert | P0 | 2h | v0.6.0 |
| P1-1 | Interface FR (i18n) | P1 | 4h | v0.6.0 |
| P1-2 | Bouton Help dans popup | P1 | 30 min | v0.6.0 |
| P1-3 | Empty states avec CTA FR | P1 | 1h | v0.6.0 |
| P1-4 | Shadow AI items cliquables | P1 | 1h | v0.6.0 |
| P1-5 | Fausses features LIVE landing | P1 | 30 min | v0.6.0 |
| P1-6 | Session counts persist (SW restart) | P1 | 2h | v0.6.0 |
| P1-7 | MutationObserver throttle | P1 | 1h | v0.6.0 |
| P2-1 | Dark mode mini-panel | P2 | 2h | v0.7.0 |
| P2-2 | Activation licence dans popup | P2 | 8h | v0.7.0 |
| P2-3 | Lien code source depuis popup | P2 | 30 min | v0.7.0 |
| P2-4 | Stats par site dans popup | P2 | 3h | v0.7.0 |

**Total P0 :** ~10h  
**Total P1 :** ~11h  
**Total P2 :** ~14h  

**Conclusion :** 21h de travail pour passer de "POC dev" à "produit à 5€/mois qu'on n'a pas honte de vendre à Karim."
