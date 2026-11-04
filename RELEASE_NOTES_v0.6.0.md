# v0.6.0 — Prêt à vendre à Karim

## 9 P0 UX bloquants corrigés

### Fixes

- **P0-1** — Version unifiée `v0.6.0` partout (dynamique depuis manifest, plus de hardcode)
- **P0-2** — `Upgrade to Pro` ouvre la landing pricing (était `href="#"` mort)
- **P0-3** — `Start Pro Trial` ouvre une modale propre (plus de mailto Gmail)
- **P0-4** — Ghost Mode : 1 seule UI (popup extension), bulle flottante supprimée
- **P0-5** — Status cohérent : "✅ Actif — 14 protégés ce mois" (plus de contradiction)
- **P0-6** — Onboarding : page de bienvenue FR s'ouvre à la 1ère installation
- **P0-7** — Toast vert "🔒 1 protégé (email)" visible 2.5s après chaque cage
- **P0-8** — `bottom:80px` — UI visible au-dessus de la taskbar Windows
- **P0-9** — Warning orange 5s si PDF/fichier uploadé sur une IA (FormData détecté)

### Build

- `background.js` 21.29 kB · `content.js` 25.55 kB · `injected.js` 9.94 kB
- Landing `dist/index.html` 32.80 kB
- **202/202 tests pass** · **12/12 quality gate** · **0 erreur de build**

### Installation

**Chrome / Edge :**
1. Télécharger `ai-cage-extension-v0.6.0-chrome.zip`
2. Dézipper
3. `chrome://extensions` → Mode développeur → "Charger l'extension non empaquetée" → sélectionner le dossier dézippé

**Firefox :**
1. Télécharger `ai-cage-extension-v0.6.0-firefox.zip`
2. `about:debugging` → "Ce Firefox" → "Charger un module complémentaire temporaire" → sélectionner le zip

**Landing :** https://ai-cage-gamma.vercel.app/

### Vérification des fichiers

Vérifier les checksums SHA256 avec `checksums-v0.6.0.txt` inclus dans cette release.

### Prochaines étapes v0.7.0

- i18n FR complet (`_locales/fr/messages.json`)
- Stripe Payment Link (remplace le fallback mailto)
- Session counts persistants via `chrome.storage.session`
- Dark mode mini-panel (`prefers-color-scheme`)
