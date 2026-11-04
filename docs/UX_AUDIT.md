# AI CAGE — Audit UX Complet v0.5.0
**Date :** 2026-11-04  
**Auditeur :** Kiro, Senior UX Auditor + Product Finisher  
**Persona cible :** Karim, 34 ans, agence Bizerte, 8 employés, non-tech, vient de payer 5€/mois  
**Méthode :** Code source lu ligne par ligne + capture d'écran analysée pixel par pixel  
**Verdict global :** ❌ Pas encore vendable. 14 bloquants P0 identifiés.

---

## 1. INVENTAIRE DE L'EXISTANT (d'après capture + code)

### Ce qu'on voit sur la capture d'écran

La capture montre **deux popups AI CAGE simultanément** sur chat.deepseek.com :

**Popup grande (v0.4.5) — extension popup principale :**
- Header vert foncé `AI CAGE — Enterprise AI Data Protection v0.4.5`
- Bandeau vert `✅ Monitoring — no PII detected yet`
- 3 onglets : `📊 Overview` | `👁️ Shadow AI` | `🤖 Agent`
- 4 stat-cards : **14** Caged this month · **13** Shadow AI calls · **0** Caged this session · **0** Caged this tab
- Section "TOP AI SITES" : chatgpt.com 27, background 0
- Footer : `Zero data leaves your device` + bouton vert `📄 Export CSV`

**Popup petite (v0.5.0) — mini-panel Shadow DOM (content.ts) :**
- Header vert `AI CAGE — chat.deepseek.com`
- Stat : **0** Total caged · `✅ Zero data sent`
- Texte : `🔍 Monitoring... Type a prompt with sensitive data.`
- Footer : `🇹🇳 Made in Tunisia` **coupé** · `v0.5.0`

**Contexte page :**
- Site : `chat.deepseek.com` — conversation "Alerte sécurité identifiants"
- Icône extension : badge vert visible dans la barre Chrome
- DeepSeek en mode clair (light mode)
- **"Activer Windows — Accédez aux paramètres pour activer Windows"** visible en bas de l'écran (watermark OS)

### Boutons et éléments existants (inventaire complet)

| Élément | Fichier source | Ligne aprox. |
|---------|---------------|--------------|
| Tab `Overview` | `popup.html` | `<button id="tab-overview">` |
| Tab `Shadow AI` | `popup.html` | `<button id="tab-shadow">` |
| Tab `Agent` | `popup.html` | `<button id="tab-agent">` |
| `📄 Export CSV` | `popup.html` | `<button id="export-btn">` |
| Upgrade link `Upgrade to Pro` | `popup.html` | `<a href="#" id="upgrade-link">` |
| Bulle flottante 🔒 | `content.ts` | `createBubble()` |
| Panneau mini `Total caged` | `content.ts` | `showStatusPanel()` |
| `🔒 Cage All & Send` | `content.ts` | `showNetworkPanel()` |
| `⚡ Send Unprotected` | `content.ts` | `showNetworkPanel()` |
| `× close` | `content.ts` | `#cage-close` |
| `🌐 Install Free for Chrome` | `landing/index.html` | CTA hero |
| `Start Pro Trial` | `landing/index.html` | Pricing section |
| `Contact Sales` | `landing/index.html` | Enterprise pricing |
| `🔒 Cage PII` | `desktop/src/index.html` | Panel 1 |
| `🔓 Restore AI Response` | `desktop/src/index.html` | Panel 1 |
| `📋 Copy Caged Text` | `desktop/src/index.html` | Panel 1 |
| `📄 Export CSV for Auditor` | `desktop/src/index.html` | Panel 3 |
| `🗑 Clear Log` | `desktop/src/index.html` | Panel 3 |

### Ce qui marche visuellement

- ✅ Design cohérent (vert cage, typo propre, cartes bien proportionnées)
- ✅ Badge de l'extension visible dans Chrome toolbar
- ✅ Bulle 🔒 flottante ancrée en bas-droite
- ✅ Panneau de décision (Cage All / Send Unprotected) s'affiche quand PII détecté
- ✅ Shadow AI tab liste les endpoints par site
- ✅ Desktop app : 4 panels fonctionnels (Cage PII, Agent Cage, Audit Log, Shadow AI)
- ✅ Landing : belle, professionnelle, bien rédigée

---

## 2. LACUNES UX CRITIQUES — BOUTONS QUI N'AFFICHENT RIEN / NE FONT RIEN (P0)

### 2.1 Bouton `📄 Export CSV` → **COMPORTEMENT IMPRÉVISIBLE**

**Fichier :** `apps/extension/src/popup.ts` — fonction `exportCSV()` ligne ~100

**Ce qui se passe quand Karim clique :**
```typescript
const a = document.createElement('a');
a.href = url;       // blob:chrome-extension://...
a.download = `ai-cage-audit-...csv`;
a.click();          // ← déclenche un téléchargement
```

**Le problème réel :**
- `a.click()` depuis un popup d'extension déclenche un téléchargement via l'API Blob — ça fonctionne techniquement dans Chrome.
- **Mais** si le log est vide (premier jour d'utilisation), `resp?.csv` est falsy → `alert('Audit log is empty.')` — Karim voit une boîte d'alerte native Chrome, pas de toast, pas d'explication, rien.
- **Le fichier CSV ne contient PAS de valeurs PII** (seulement les types et comptes, par design privacy) mais l'interface n'explique pas ça. Karim télécharge un CSV et cherche ses emails → il ne les trouve pas → il pense que ça ne marche pas.
- **Compliance P0 :** Le CSV ne contient aucun PII en clair (voulu), mais cette information n'est nulle part dans l'UI. Le client se demande à quoi sert l'export.

**Critère d'échec :** Karim clique → rien ou boîte d'alerte froide → il croit que le produit est cassé.

---

### 2.2 Bandeau `Monitoring — no PII detected yet` vs `14 Caged this month` → **CONTRADICTION LOGIQUE**

**Fichier :** `apps/extension/src/popup.ts` — `renderOverview()` + `background.ts`

**Le problème :**
- `status-text` affiche `✅ Monitoring — no PII detected yet` quand `sessionCageCount === 0`
- `monthly-caged` affiche `14` — persisté dans `chrome.storage.local`
- Ces deux valeurs proviennent de **compteurs différents** : `sessionCageCount` (mémoire SW, reset au restart du service worker) vs `monthlyPiiCaged` (audit log persisté)

**Ce que Karim comprend :** "Le truc dit qu'il ne détecte rien mais il dit aussi 14 ce mois. C'est quoi ces 14? Le logiciel fonctionne ou pas?"

**Critère d'échec :** Contradiction visible à l'ouverture du popup → perte de confiance immédiate.

---

### 2.3 `Total caged: 0` (mini-popup) vs `14 Caged this month` (grand popup) → **INCOHÉRENCE ENTRE 2 UIs**

**Fichiers :**  
- `apps/extension/src/content.ts` — variable `sessionTotal` (portée page, reset au rechargement)  
- `apps/extension/src/popup.ts` — `monthlyPiiCaged` depuis `chrome.storage.local`

**Le problème technique :**
- `sessionTotal` dans `content.ts` est une variable JS en mémoire de page : elle repart à `0` à chaque rechargement de page ou navigation.
- `monthlyPiiCaged` dans le grand popup lit l'audit log persisté dans `chrome.storage.local`.
- Les deux métriques mesurent des choses différentes mais portent des noms similaires ("Total caged" vs "Caged this month") — aucun utilisateur ne peut distinguer ça.

**Ce que Karim voit :** Il ouvre le mini-panel → 0. Il ouvre le grand popup → 14. Il se demande lequel est le vrai chiffre.

**Critère d'échec :** 2 chiffres différents pour la même métrique apparente = produit cassé aux yeux du client.

---

### 2.4 Bouton `Start Pro Trial` sur la landing → **OUVRE GMAIL, PAS UN CHECKOUT**

**Fichier :** `apps/landing/index.html` — pricing section

```html
<a href="mailto:contact@ai-cage.io?subject=AI CAGE Pro Trial" ...>
  Start Pro Trial
</a>
```

**Ce que Karim voit :** Il clique sur "Start Pro Trial" → son client mail s'ouvre avec un email pré-rempli. Il doit **écrire un email manuellement** et attendre une réponse humaine pour payer 5€.

**Critère d'échec :** Pour un produit à 5€/mois, un `mailto:` en guise de checkout = pas professionnel, conversion 0%.  
Un client qui arrive de Google, il clique "Start Pro Trial" et il attend une carte de paiement Stripe. Il ne comprend pas pourquoi il doit écrire un email.

---

### 2.5 Lien `Upgrade to Pro` dans le popup → **DEAD LINK (href="#")**

**Fichier :** `apps/extension/src/popup.html`

```html
<a href="#" id="upgrade-link" style="color:#92400e;text-decoration:underline">
  Upgrade to Pro
</a>
```

**Ce que Karim voit :** Ce bandeau jaune n'apparaît que quand il a atteint 100 cages/mois. Quand il clique → rien. La page ne scroll pas, rien ne s'ouvre.

**Critère d'échec :** La seule invitation payante du produit ne mène nulle part.

---

### 2.6 Clic sur `Shadow AI — 13 calls` → **PAS DE DÉTAIL CLIQUABLE**

**Fichier :** `apps/extension/src/popup.ts` — `renderShadowAi()` + `popup.html`

**Le problème :** La stat "13 Shadow AI calls" est affichée dans la Overview tab. Elle n'est pas cliquable. Dans l'onglet Shadow AI, les items sont listés (site + count + date) mais aucun item n'est cliquable pour voir le détail.

```typescript
listEl.innerHTML = [...bysite.entries()].map(([site, info]) => `
  <li class="shadow-item">  // ← pas d'event listener, pas de cursor:pointer
    <div class="shadow-site">${escHtml(site)}</div>
    ...
  </li>`).join('');
```

**Ce que Karim voit :** "Il y a 13 appels IA cachés — mais d'où? De quelle app? Qu'est-ce qu'ils ont envoyé?" → Impossible à savoir depuis l'UI.

**Critère d'échec :** La feature Shadow AI (argument de vente principal) n'a pas d'écran de détail. C'est un chiffre sans sens.

---

### 2.7 Onboarding à la première installation → **PAGE VIDE, KARIM EST SEUL**

**Ce qui se passe à la première installation :**
- L'extension s'installe → aucun `chrome.runtime.onInstalled` listener dans `background.ts`
- Aucune page de bienvenue n'est ouverte
- Aucun tooltip, aucun tour guidé
- Le popup s'ouvre et affiche `0 — 0 — 0 — 0` avec le statut "Monitoring — no PII detected yet"

**Ce que Karim voit :** Il installe, il clique sur l'icône → 4 zéros et un message en anglais qu'il ne comprend pas. Il ne sait pas si l'extension fonctionne. Il ne sait pas quoi faire.

**Critère d'échec :** Premier contact avec le produit = écran vide. Karim désinstalle ou ignore.

---

### 2.8 Empty state : 0 données → **ÉCRAN BLANC QUI FAIT PEUR**

**Fichier :** `apps/extension/src/popup.html`

```html
<ul id="top-sites">
  <li class="empty">No activity recorded yet.</li>
</ul>
```

**Ce que Karim voit :** "No activity recorded yet." — message en anglais, aucune instruction sur quoi faire. Pas de CTA "Allez sur ChatGPT et tapez quelque chose".

**Critère d'échec :** L'empty state ne guide pas, il inquiète.

---

## 3. LACUNES EXPÉRIENCE FLUIDITÉ (P0)

### 3.1 Double popup simultané → **LEQUEL EST LE VRAI AI CAGE?**

**Preuve :** Visible sur la capture. Deux éléments AI CAGE simultanément :
- Grand popup (clic icône extension, `popup.html`) = version v0.4.5
- Mini-panel (Shadow DOM, `content.ts`, `showStatusPanel()`) = version v0.5.0

**Cause technique :** La bulle 🔒 flottante de `content.ts` est TOUJOURS injectée sur la page. Quand Karim clique sur l'icône extension, il ouvre aussi le popup. Les deux co-existent.

**Ce que Karim voit :** Deux fenêtres vertes AI CAGE qui se chevauchent. Laquelle est la vraie? Pourquoi il y en a deux?

**Critère d'échec :** Double interface = produit amateur. Produit professionnel = 1 seule interface.

---

### 3.2 Versions multiples visibles → **QUEL PRODUIT J'AI ACHETÉ?**

| Composant | Version affichée |
|-----------|-----------------|
| `manifest.json` | `"version": "0.4.5"` |
| `popup.html` header | `v0.4.5` |
| `background.ts` console | `v0.4.5` |
| `content.ts` mini-panel footer | `v0.5.0` |
| `desktop/src/index.html` | `v0.3.0` |
| Landing navbar | `v0.4.5` |
| Landing footer | `v0.4.5` |

**Résultat :** Karim voit v0.4.5 sur le grand popup et v0.5.0 sur le mini. L'app desktop dit v0.3.0. **3 versions différentes pour le même produit payant.**

**Critère d'échec :** Incohérence de version = produit bêta, pas un produit payant.

---

### 3.3 Feedback de caging → **SILENCE RADIO**

**Ce qui se passe quand un email est cagé :**
1. `content.ts` — `handlePrompt()` modifie le texte dans le champ
2. La bulle 🔒 change de couleur (verte → bleue) pendant 250ms
3. C'est tout.

**Ce qui manque :** Aucun toast visible du type "✅ 1 email protégé", aucune notification Chrome, aucune confirmation textuelle dans la page.

**Ce que Karim voit :** Il tape, il envoie, rien ne change visuellement. Il ne sait pas si ça a marché. Il ouvre le popup → "Caged this session : 1". Mais il a déjà envoyé le message 3 fois pour être sûr.

**Critère d'échec :** Feedback invisible = client qui ne fait pas confiance au produit.

---

### 3.4 Clash visuel : dark mode DeepSeek vs light popup vert

**Preuve :** Visible sur la capture. DeepSeek est en mode clair (light) sur la capture, mais le produit supporte aussi le dark mode.

**Le vrai problème :** Le popup extension est en fond blanc (`#f8fafc`) avec header vert foncé. Sur un site en dark mode, le popup fait un contraste brutal. Le mini-panel Shadow DOM est toujours en `background:#fff` hardcodé dans `content.ts`.

```typescript
background:#fff;color:#0f172a;border-radius:14px;  // ← toujours light
```

**Ce que Karim voit :** Sur Claude.ai (dark mode) ou perplexity.ai, le mini-panel blanc flashe au milieu d'une page sombre. Résultat : "cheap", "pas fini".

**Critère d'échec :** Extension qui ne respecte pas le thème du site = sentiment de produit non fini.

---

### 3.5 Langue : 100% anglais pour un client FR/AR

**Inventaire des chaînes anglaises dans l'UI :**
- "Monitoring — no PII detected yet"
- "Caged this month" / "Caged this session" / "Caged this tab"
- "Shadow AI calls" / "No shadow AI calls detected yet. Keep browsing — AI is everywhere."
- "No activity recorded yet."
- "These SaaS tools made requests to AI APIs from your browser. 88% of AI traffic is invisible to most companies."
- "Monitoring... Type a prompt with sensitive data."
- "Zero data leaves your device."
- "Total caged" / "Zero data sent"
- "Export CSV" / "Upgrade to Pro"
- "Injections blocked" / "Exfil attempts"

**Fichiers concernés :** `popup.html` (entier), `content.ts` (`showStatusPanel()`), `popup.ts` (messages d'état)

**Ce que Karim voit :** Une interface 100% anglais. Son client arabe tunisien lit "Shadow AI calls" et "exfil attempts" — il ne comprend pas. "Caged this month" sonne bizarre en français.

**Critère d'échec :** Produit vendu en Tunisie, interface en anglais only = frein à l'adoption non-tech.

---

### 3.6 Badge `Made in Tunisia` coupé — Bug UI confirmé sur capture

**Fichier :** `apps/extension/src/content.ts` — `showStatusPanel()`

```typescript
<div class="cf">
  <span>🇹🇳 Made in Tunisia</span>
  <span>v0.5.0</span>
</div>
```

**Preuve capture :** Le mini-panel est positionné `bottom:74px;right:20px`. Sur la capture, la barre des tâches Windows (48px) + "Activer Windows" watermark font que le bas du panel est partiellement caché. Le footer "Made in Tunisia" est coupé.

**Cause :** Pas de `max-height` adaptatif, pas de `margin-bottom` tenant compte de la taskbar Windows.

**Critère d'échec :** L'unique mention de fierté nationale (`🇹🇳 Made in Tunisia`) est invisible sur Windows.

---

### 3.7 `Activer Windows` visible sur la capture → **Conflit visuel + crédibilité zéro**

**Preuve :** Visible en bas de la capture — le watermark Windows "Activer Windows — Accédez aux paramètres pour activer Windows".

**Ce que ça implique :**
- La machine de démonstration utilise Windows non activé.
- Si Karim reçoit cette capture comme démo ou screenshot de vente, il voit un OS piraté en fond.
- Le mini-panel v0.5.0 est visuellement confondu avec ce watermark — ils sont au même endroit (bas-droit de l'écran).

**Ce n'est pas un bug du code AI CAGE** — c'est un bug de l'environnement de démonstration. Mais pour Karim, il voit ça et se demande si le produit est sérieux.

**Critère d'échec :** Screenshot de vente avec Windows non activé = image non professionnelle.

---

### 3.8 Performance : scroll sur 100 messages — risque réel

**Fichier :** `apps/extension/src/content.ts` — `domObserver`

```typescript
const domObserver = new MutationObserver(() => {
  hookButtons();
  const root = getShadowRoot();
  if (root && !root.getElementById('cage-bubble')) createBubble();
});
domObserver.observe(document.body, { childList: true, subtree: true });
```

**Le problème :** `subtree: true` sur `document.body` = le MutationObserver se déclenche sur CHAQUE mutation DOM, y compris les streams de tokens IA (qui génèrent des dizaines de mutations par seconde sur les réponses longues).

**Impact potentiel :** Sur une conversation DeepSeek de 100 messages avec streaming, `hookButtons()` est appelé en boucle. `document.querySelectorAll` sur tous les SEND_SELECTORS à chaque mutation = CPU spike possible.

**Critère d'échec :** Extension qui ralentit le chat = désinstallation immédiate.

---

## 4. LACUNES TECHNIQUES QUI BLOQUENT UX NORMALE (P0)

### 4.1 DeepSeek anti-escape : le produit fonctionne mais reste fragile

**Fichier :** `apps/extension/src/injected.ts` — `isAI()` function

```typescript
const AI_PATTERNS = [
  ...
  /chat\.deepseek\.com/,  // ← DeepSeek bien listé
];
```

**Statut :** DeepSeek est dans la liste des patterns AI. L'interception fetch/XHR est active.

**Risque réel :** DeepSeek utilise `text/event-stream` pour le streaming. Le code `injected.ts` gère ça. Mais si DeepSeek change son endpoint (ex: `/api/v2/chat`) ou ajoute de l'obfuscation, la regex casse silencieusement. Aucun mécanisme d'alerte n'existe pour Karim.

**Ce que Karim voit :** L'extension semble active (badge vert) mais ne cage plus rien. Il ne le sait pas.

---

### 4.2 File upload / glisser-déposer PDF → **FUITE POSSIBLE, PAS COUVERTE**

**Fichier :** `apps/extension/src/injected.ts` + `content.ts`

**Le problème :** AI CAGE intercepte les requêtes fetch/XHR avec body `string`. Si Karim glisse un PDF dans DeepSeek ou Claude, le fichier est envoyé comme `FormData` ou `Blob` — pas un string JSON.

```typescript
let body = init?.body;
if (typeof body === 'string' && body.length > 2) {  // ← seulement si string
  body = await processRequestBody(body);
}
```

**Ce qui se passe :** Le PDF avec noms de clients, CIN, IBAN est envoyé directement à l'API DeepSeek **sans aucun caging**. La bulle reste verte. Karim croit qu'il est protégé.

**Critère d'échec :** Fausse protection = pire que pas de protection. Risque GDPR réel.

---

### 4.3 Multi-onglets : compteurs mélangés → **KARIM EST PERDU**

**Fichier :** `apps/extension/src/background.ts`

```typescript
let sessionCageCount   = 0;  // ← global au service worker
let sessionShadowCount = 0;  // ← global au service worker
const tabCageCounts    = new Map<number, number>();  // ← par tab
```

**Ce qui se passe :** 
- Karim a 3 onglets ouverts : ChatGPT, DeepSeek, Claude.
- `sessionCageCount` cumule les cages de TOUS les onglets.
- `tabCageCounts` est par onglet mais aucune UI ne le communique clairement.
- Dans le popup : "Caged this session: 7" — Karim ne sait pas si c'est sur ChatGPT ou DeepSeek.
- Le mini-panel `content.ts` montre `sessionTotal` qui ne concerne que la page courante.

**Critère d'échec :** Client ne sait pas sur quel site son PII a été cagé.

---

### 4.4 Persistance : le service worker redémarre → compteur reset

**Fichier :** `apps/extension/src/background.ts`

```typescript
let sessionCageCount   = 0;  // ← IN MEMORY, perd tout au restart SW
let sessionShadowCount = 0;  // ← IN MEMORY
```

**Le problème :** En MV3, le service worker est tué après ~30 secondes d'inactivité. Quand il redémarre :
- `sessionCageCount` repart à 0
- `sessionShadowCount` repart à 0
- `tabCageCounts` repart vide
- Dans le popup : "Caged this session: 0" même si Karim a fait 10 cages il y a 2 minutes

**Ce que Karim voit :** "J'ai fait 10 protections, je reviens dans 5 minutes, le chiffre est à 0. Vous avez pris mon argent et ça reset?"

**Critère d'échec :** Données de session disparaissent → sentiment de produit qui vole.

---

### 4.5 Conflit extensions : `webRequest` intercepté par AdBlock

**Fichier :** `apps/extension/src/manifest.json` — `"webRequest"` permission

**Le problème :** AdBlock Plus, uBlock Origin et autres extensions utilisent `webRequest` avec priorité. En MV3, les conflits de `declarativeNetRequest` peuvent masquer des requêtes. `background.ts` fait :

```typescript
chrome.webRequest.onBeforeRequest.addListener(
  (details) => { ... },
  { urls: ['<all_urls>'] }  // ← ambition maximale, conflit maximal
);
```

**Résultat potentiel :** Sur la machine de Karim avec AdBlock + AI CAGE, certaines requêtes vers les AI endpoints peuvent être bloquées avant que AI CAGE les analyse, ou analysées sans être modifiées.

**Critère d'échec :** Karim a AdBlock (90% des utilisateurs tech) → Shadow AI detection silencieusement cassée.

---

## 5. LACUNES PRODUIT PAYANT FINI (P1)

### 5.1 Paywall : le bouton Pro est introuvable dans l'extension

**Ce qui existe :**
- Dans `popup.html` : un bandeau jaune "Upgrade to Pro" qui n'apparaît **qu'à 100 cages** → `href="#"` (mort)
- Dans la landing : `Start Pro Trial` → `mailto:` (pas un checkout)
- Dans le desktop : aucun bouton Pro, aucun freemium gate

**Ce que Karim cherche :** Un bouton clair "Passer à Pro — 5€/mois" accessible depuis l'extension sans atteindre 100 cages. Quelque chose comme une page `/upgrade` ou un lien Stripe.

**Critère d'échec :** Chemin de conversion absent = 0 revenue.

---

### 5.2 Activation de licence : 2 endroits, 0 instructions

**Ce qui existe :**
- L'extension n'a aucun champ "entrez votre clé licence"
- Le desktop n'a aucun champ "entrez votre clé licence"  
- La landing dit "Start Pro Trial" → mailto sans instructions sur comment activer

**Ce que Karim fait quand il paye :** Il envoie l'email, il reçoit quoi? Une clé? Un lien? Un `.crx`? Il ne sait pas où coller quoi.

**Critère d'échec :** Pas de flux d'activation = produit impossible à utiliser même après paiement.

---

### 5.3 Aide et support : 0 point de contact dans le produit

**Fichiers audités :** `popup.html`, `content.ts`, `desktop/src/index.html`

**Ce qui existe :** Aucun bouton "Help", "?" ou "Support" dans :
- Le popup extension
- Le mini-panel flottant
- L'app desktop

**Ce qui existe dans la landing :** Un email `support@ai-cage.io` dans le footer — que Karim ne visitera jamais depuis son extension.

**Ce que Karim fait quand ça bloque :** Il cherche un bouton d'aide → il n'en trouve pas → il désinstalle.

**Critère d'échec :** Produit payant sans aide accessible = churm immédiat.

---

### 5.4 Preuve `Zero data leaves your device` : un claim sans vérifiabilité

**Ce qui existe :**
- Footer du popup : `✅ Zero data leaves your device.` — texte statique
- Landing : Section "Privacy Guarantee" avec lien vers GitHub
- Desktop footer : `All detection and audit logging runs locally.`

**Ce qui manque :**
- Aucun lien vers le code source depuis le popup
- Aucun "View audit log" cliquable depuis le mini-panel
- Aucun certificat visuel ou badge de vérification
- La mention GitHub dans la landing pointe vers un repo qui n'existe pas encore publiquement

**Ce que Karim pense :** "Ils disent que ça ne sort pas de mon PC — comment je sais que c'est vrai? Il y a un certificat? Un audit externe?"

**Critère d'échec :** Claim de sécurité sans preuve accessible dans le produit = argument de vente non crédible.

---

### 5.5 Features marquées LIVE sur la landing qui n'existent pas dans l'extension

**Fichier :** `apps/landing/index.html` vs `docs/THREAT_MODEL.md`

| Feature | Landing dit | THREAT_MODEL dit | Extension v0.4.5 |
|---------|------------|-----------------|-----------------|
| Cage 4: Code Leak | ✅ Live | 🟡 PLANNED (V2) | ❌ Absent |
| Cage 5: Voice/Video | ✅ Live | 🟡 PLANNED (V3) | ❌ Absent |
| Cage 6: Credential Hijack | ⚡ Partial | 🟡 PLANNED (V2) | Partiel |

**Ce que Karim voit :** Il lit la landing, il voit "✅ Live", il installe l'extension, il cherche la feature VS Code → introuvable. Il cherche le module Voice → introuvable.

**Critère d'échec :** Publicité mensongère sur un produit payant = risque légal + churn garanti.

---

## 6. PLAN DE CORRECTION — SPRINT UX v0.6.0

### P0-1 : Unifier les versions — Afficher une seule version partout

**Fix technique :** Lire `chrome.runtime.getManifest().version` dans `popup.ts` et l'injecter dans le header popup. Passer la version via `postMessage` ou lire depuis `chrome.runtime` dans `content.ts`.

```typescript
// popup.ts — DOMContentLoaded
const { version } = chrome.runtime.getManifest();
document.querySelector('.header-version').textContent = `v${version}`;
```

```typescript
// content.ts — showStatusPanel()
const version = chrome.runtime.getManifest().version;
// Remplacer le hardcode 'v0.5.0' par `v${version}`
```

**Fichiers :** `popup.html` (suppr. hardcode `v0.4.5`), `content.ts` (suppr. hardcode `v0.5.0`), `desktop/src/index.html` (passer à `v0.4.5`)

**Critère de validation :** Karim ouvre le popup et le mini-panel → même numéro de version sur les deux, en <1s.

---

### P0-2 : Résoudre la contradiction sessionCount vs monthlyCount

**Fix technique :** Dans `popup.ts`, si `monthlyPiiCaged > 0` ET `sessionCageCount === 0`, afficher :
`🔒 Protecting — ${monthlyPiiCaged} total cagés ce mois (session en cours : 0)`

**Fichier :** `apps/extension/src/popup.ts` — `renderOverview()` — section `status-text`

**Critère de validation :** Karim ouvre le popup → le message d'état est cohérent avec les chiffres affichés en <1s.

---

### P0-3 : Supprimer la double interface — 1 seul point d'entrée

**Fix technique :** Quand le grand popup est ouvert (`chrome.extension.getViews` ou flag `storage`), masquer/éviter d'ouvrir le mini-panel Shadow DOM. **OU** : Rendre la bulle flottante le seul point d'entrée et supprimer le popup Chrome standard.

**Recommandation architecturale :** Garder la bulle flottante Shadow DOM comme seul UI en page. Faire en sorte que l'icône extension ouvre un nouvel onglet `popup.html` en mode fullscreen (pas un popup 360px). Ainsi : 1 interface, pas de double-panel.

**Critère de validation :** Karim clique sur l'icône → 1 seule fenêtre AI CAGE s'ouvre, pas deux.

---

### P0-4 : Fixer le lien `Upgrade to Pro`

**Fix technique :** Remplacer `href="#"` par un vrai lien.

```html
<!-- popup.html -->
<a href="https://ai-cage-gamma.vercel.app/#pricing" 
   id="upgrade-link" 
   target="_blank"
   style="color:#92400e;text-decoration:underline">
  Upgrade to Pro — 5€/mois
</a>
```

**Critère de validation :** Karim voit le watermark Pro, clique → landing pricing s'ouvre en <1s.

---

### P0-5 : Remplacer le mailto `Start Pro Trial` par un vrai CTA

**Fix technique :** Intégrer Stripe Payment Link (génération gratuite, 0 code backend).

```html
<!-- landing/index.html — Pro pricing card -->
<a href="https://buy.stripe.com/[votre-lien]" 
   class="block text-center bg-cage-green text-white py-2.5 rounded-lg ...">
  💳 Start Pro Trial — 5€/mois
</a>
```

**Alternative immédiate (sans Stripe) :** Rediriger vers un formulaire Tally.so ou Google Form qui collecte email + commence l'onboarding manuel.

**Critère de validation :** Karim clique "Start Pro Trial" → écran de paiement en <2s, pas son client mail.

---

### P0-6 : Onboarding — page de bienvenue à la 1ère installation

**Fix technique :** Ajouter dans `background.ts` :

```typescript
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    void chrome.tabs.create({ url: 'https://ai-cage-gamma.vercel.app/welcome' });
  }
});
```

Créer `apps/landing/welcome.html` avec : "AI CAGE est installé. Voici comment ça marche en 3 étapes. Allez sur ChatGPT et tapez un email — vous verrez la protection en action."

**Critère de validation :** Karim installe → une page de bienvenue s'ouvre automatiquement en <1s.

---

### P0-7 : Toast de confirmation quand un item est cagé

**Fix technique :** Dans `content.ts`, après `sessionTotal += totalCaged`, afficher un toast Shadow DOM :

```typescript
function showToast(message: string): void {
  const root = getShadowRoot();
  if (!root) return;
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:80px;right:20px;z-index:2147483647;
    background:#15803d;color:#fff;border-radius:8px;
    padding:8px 14px;font-size:12px;font-weight:700;
    font-family:${FONT};box-shadow:0 4px 12px rgba(0,0,0,.3);
    animation:cage-in .2s ease;
  `;
  toast.textContent = message; // ex: "✅ 1 email protégé"
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
```

**Critère de validation :** Karim envoie un email → toast vert "✅ 1 email protégé" visible 2.5s en <100ms.

---

### P0-8 : Fixer le `bottom` du mini-panel sur Windows (taskbar)

**Fix technique :** Dans `content.ts`, détecter la hauteur disponible ou utiliser `bottom: env(safe-area-inset-bottom, 74px)`. En pratique, augmenter le `bottom` à `80px` minimum et ajouter `max-height: calc(100vh - 180px)` pour éviter le clip.

```typescript
// content.ts — style du panel
position:fixed;bottom:80px;right:20px;
max-height:calc(100vh - 200px);overflow-y:auto;
```

**Critère de validation :** "Made in Tunisia" visible en entier sur Windows avec taskbar standard (48px) et "Activer Windows" watermark (32px).

---

### P0-9 : Bloquer les FormData/Blob (PDF upload non cagé)

**Fix technique :** Dans `injected.ts`, intercepter aussi `FormData` :

```typescript
// Si body est FormData, scanner les champs texte
if (body instanceof FormData) {
  // Parcourir les champs string, appliquer PII detection
  // Si PII trouvé, montrer le panneau de décision
  // NOTER dans UI : "PDF non scannable — risque de fuite"
}
```

**Alternative à court terme :** Détecter un upload de fichier et afficher un warning :
`⚠️ Fichier uploadé — contenu non scanné. Risque de fuite PII.`

**Critère de validation :** Karim glisse un PDF → warning visible en <500ms.

---

### P1-1 : Traduire l'interface en FR (ou bilingue FR/EN)

**Fix technique :** Créer `_locales/fr/messages.json` (MV3 i18n natif) et remplacer les strings hardcodées.

```json
// _locales/fr/messages.json
{
  "statusMonitoring": { "message": "Surveillance active — aucun PII détecté" },
  "cagedThisMonth": { "message": "Protégés ce mois" },
  "shadowAiCalls": { "message": "IA cachées détectées" },
  "exportCsv": { "message": "Exporter le rapport" },
  "zeroDataLeaves": { "message": "✅ Aucune donnée ne quitte votre appareil." }
}
```

**Critère de validation :** Karim (FR) voit l'interface en français. Chrome en AR → interface en arabe possible.

---

### P1-2 : Ajouter un bouton Help dans le popup

**Fix technique :** Ajouter dans `popup.html` footer :

```html
<a href="https://ai-cage-gamma.vercel.app/help" 
   target="_blank" 
   title="Aide"
   style="font-size:18px;cursor:pointer;text-decoration:none">
  ❓
</a>
```

**Critère de validation :** Karim est bloqué → clique ❓ → page d'aide en <1s.

---

### P1-3 : Rendre les Shadow AI entries cliquables (détail)

**Fix technique :** Dans `popup.ts` `renderShadowAi()`, ajouter un toggle pour afficher le `detail` complet + risque :

```typescript
.map(([site, info]) => `
  <li class="shadow-item" style="cursor:pointer" onclick="this.querySelector('.shadow-detail').style.display='block'">
    ...
    <div class="shadow-detail" style="display:none">${escHtml(info.detail)}</div>
  </li>`)
```

**Critère de validation :** Karim clique sur "chat.deepseek.com 13 calls" → détail expand en <300ms.

---

## 7. QUALITY GATE

### Checklist de sortie avant la mise en vente à 5€/mois

| # | Check | Statut actuel | Cible v0.6.0 |
|---|-------|--------------|-------------|
| QG-1 | Une seule version affichée partout | ❌ 3 versions | ✅ 1 version dynamique |
| QG-2 | 0 dead link (`href="#"`) | ❌ upgrade-link mort | ✅ Tous les liens fonctionnels |
| QG-3 | Start Pro Trial → checkout réel | ❌ mailto: | ✅ Stripe ou Tally |
| QG-4 | Onboarding page à l'install | ❌ absent | ✅ welcome.html auto-open |
| QG-5 | 1 seule interface visible à la fois | ❌ double popup | ✅ 1 UI |
| QG-6 | Feedback visible après caging | ❌ aucun toast | ✅ toast 2.5s |
| QG-7 | "Made in Tunisia" visible sur Windows | ❌ coupé | ✅ bottom:80px |
| QG-8 | Empty states en FR avec CTA | ❌ EN, sans CTA | ✅ FR + "Allez sur ChatGPT" |
| QG-9 | Bouton Help dans le popup | ❌ absent | ✅ ❓ dans footer |
| QG-10 | Warning PDF upload non couvert | ❌ fuite silencieuse | ✅ warning visible |
| QG-11 | Features landing = features réelles | ❌ Cage 4/5 "Live" faux | ✅ badges "Bientôt" |
| QG-12 | Session counters persistent (SW restart) | ❌ reset invisible | ✅ lire depuis storage |

---

## Annexe — Preuves code (références exactes)

| Bug | Fichier | Ligne / Identifiant |
|-----|---------|---------------------|
| href="#" upgrade-link | `apps/extension/src/popup.html` | `id="upgrade-link"` |
| v0.5.0 hardcodé | `apps/extension/src/content.ts` | `showStatusPanel()` → `<span>v0.5.0</span>` |
| v0.4.5 hardcodé popup | `apps/extension/src/popup.html` | `<span class="header-version">v0.4.5</span>` |
| v0.3.0 desktop | `apps/desktop/src/index.html` | `<span class="header-badge">v0.3.0</span>` |
| mailto: Pro Trial | `apps/landing/index.html` | `href="mailto:contact@ai-cage.io?subject=AI CAGE Pro Trial"` |
| sessionTotal reset | `apps/extension/src/content.ts` | `let sessionTotal = 0;` (module scope) |
| sessionCageCount reset | `apps/extension/src/background.ts` | `let sessionCageCount = 0;` (SW memory) |
| FormData non couvert | `apps/extension/src/injected.ts` | `if (typeof body === 'string' && body.length > 2)` |
| Cage 4/5 Live (faux) | `apps/landing/index.html` | `<span class="bg-green-100 ...">✅ Live</span>` |
| Empty state EN | `apps/extension/src/popup.html` | `<li class="empty">No activity recorded yet.</li>` |
| MutationObserver subtree | `apps/extension/src/content.ts` | `domObserver.observe(document.body, { childList: true, subtree: true })` |
| bottom:74px clip Windows | `apps/extension/src/content.ts` | `position:fixed;bottom:74px;right:20px` |
