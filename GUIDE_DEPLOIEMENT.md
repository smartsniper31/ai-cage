# AI CAGE — Guide de Déploiement pour le Client Final

**Version:** 0.4.5
**Budget:** 0€ (plans gratuits)
**Cible:** PME sans serveur IA privé

---

## ÉTAPE 1 — Landing Page sur Vercel (0€)

La landing page est 100% autonome (Tailwind CDN, pas de build nécessaire).

### Méthode A — Drag & Drop (le plus simple, 5 minutes)

1. Va sur https://vercel.com et crée un compte gratuit (avec GitHub)
2. Clique sur **"Add New"** → **"Project"**
3. Clique sur **"Browse all templates"** → en bas, **"Other"** → **"Deploy"**
4. Dans le champ **"Root Directory"**, indique le chemin vers `apps/landing/` :
   ```
   C:\Users\frik\Desktop\stuff-final\AI CAGE\ai-cage\apps\landing
   ```
5. Vercel détecte le `index.html` automatiquement
6. Laisse **"Build Command"** vide (pas de build nécessaire)
7. Laisse **"Output Directory"** à `.` (le dossier lui-même)
8. Clique **"Deploy"**
9. Ton site est en ligne sur `https://ai-cage-landing.vercel.app` (ou similaire)

### Méthode B — Via GitHub (auto-déploiement, recommandé)

1. Va sur https://vercel.com → **"Add New"** → **"Project"**
2. Importe le repo **smartsniper31/ai-cage** depuis GitHub
3. Configure le projet:
   - **Framework Preset:** Other
   - **Root Directory:** `apps/landing`
   - **Build Command:** (laisser vide)
   - **Output Directory:** `.`
4. Clique **"Deploy"**
5. Vercel déploie automatiquement à chaque `git push`

### Personnaliser le domaine (optionnel, gratuit)

1. Dans Vercel → Settings → Domains
2. Ajoute un domaine gratuit (ex: `ai-cage.vercel.app` est automatique)
3. Ou connecte un domaine personnalisé (ex: `ai-cage.io` — coûte ~10€/an chez un registrar)

---

## ÉTAPE 2 — Chrome Web Store (Extension)

### 2.1 — Préparer le package

```bash
cd "c:\Users\frik\Desktop\stuff-final\AI CAGE\ai-cage"
pnpm install --network-concurrency 1
pnpm build
# Le package est dans apps/extension/dist/
```

### 2.2 — Créer le ZIP

Sur Windows, zippe le contenu de `apps/extension/dist/` :
1. Ouvre `apps/extension/dist/` dans l'Explorateur
2. Sélectionne TOUS les fichiers (background.js, content.js, popup.js, popup.html, manifest.json, icons/)
3. Clic droit → **"Compresser dans un fichier ZIP"**
4. Nomme-le `ai-cage-extension-v0.4.5.zip`

### 2.3 — Publier sur le Chrome Web Store

1. Va sur https://chrome.google.com/webstore/devconsole
2. Connecte-toi avec un compte Google
3. Clique **"New Item"**
4. Upload `ai-cage-extension-v0.4.5.zip`
5. Remplis la fiche:
   - **Nom:** AI CAGE — Enterprise AI Data Protection
   - **Description courte:** Copie depuis `apps/extension/store-assets/description-en.md`
   - **Catégorie:** Productivity / Privacy & Security
   - **Screenshots:** Prends 5 captures (1280x800) selon `store-assets/screenshots.md`
   - **Privacy Policy URL:** `https://github.com/smartsniper31/ai-cage/blob/main/apps/extension/store-assets/privacy-policy.md`
   - **Permissions justification:** Explique chaque permission (voir privacy-policy.md)
6. Clique **"Submit for Review"**
7. Attends 1-3 jours pour l'approbation Google

### 2.4 — Prendre les screenshots

Voici comment prendre les 5 screenshots requis (1280x800):

1. **Screenshot 1 — Overview:**
   - Charge l'extension dans Chrome (`chrome://extensions` → Load Unpacked → `apps/extension/dist/`)
   - Va sur chat.openai.com
   - Clique sur l'icône AI CAGE → capture le popup (Overview tab)
   - Redimensionne la fenêtre à 1280x800

2. **Screenshot 2 — Shadow AI:**
   - Clique sur l'onglet "Shadow AI" dans le popup
   - Capture la liste des endpoints détectés

3. **Screenshot 3 — Agent Cage:**
   - Ouvre le Desktop app (ou capture l'extension popup avec l'onglet Agent)
   - Montre le feed avec des badges BLOCKED/APPROVAL/ALLOWED

4. **Screenshot 4 — Audit Log:**
   - Capture le panneau Audit Log du Desktop app
   - Montre le tableau + bouton Export CSV

5. **Screenshot 5 — Banner on ChatGPT:**
   - Va sur chat.openai.com avec l'extension active
   - Capture la page entière avec le bandeau vert "AI CAGE Active"

---

## ÉTAPE 3 — Firefox Add-ons (Extension)

### 3.1 — Build Firefox

```bash
cd "c:\Users\frik\Desktop\stuff-final\AI CAGE\ai-cage"
pnpm --filter @ai-cage/extension build
node apps/extension/build-firefox.mjs
# Le package Firefox est dans apps/extension/firefox-dist/
```

### 3.2 — Publier sur Firefox Add-ons (AMO)

1. Va sur https://addons.mozilla.org/developers/
2. Crée un compte développeur
3. Clique **"Submit a New Add-on"**
4. Upload le contenu de `apps/extension/firefox-dist/` (ou zippe-le)
5. Remplis la fiche (même description que Chrome, fichier `description-en.md`)
6. Soumet pour review (1-5 jours)

---

## ÉTAPE 4 — Desktop App (Tauri)

### 4.1 — Prérequis

- Rust installé (`rustup`) — déjà fait sur ta machine
- WebView2 runtime (inclus sur Windows 10+)

### 4.2 — Build l'installeur

```bash
cd "c:\Users\frik\Desktop\stuff-final\AI CAGE\ai-cage\apps\desktop"
pnpm build
pnpm run tauri build
# L'installeur est dans src-tauri/target/release/bundle/
```

⚠️ **Attention:** Le build Tauri prend 10-15 minutes la première fois (Rust compile).

### 4.3 — Distribuer

- **Windows:** Le fichier `.msi` ou `.exe` dans `src-tauri/target/release/bundle/`
- **macOS:** Le fichier `.dmg` (cross-compile non supporté, besoin d'un Mac)
- **Linux:** Le fichier `.deb` ou `.AppImage`
- Héberge le fichier sur GitHub Releases (gratuit): `https://github.com/smartsniper31/ai-cage/releases`

---

## ÉTAPE 5 — VS Code Extension

### 5.1 — Build

```bash
cd "c:\Users\frik\Desktop\stuff-final\AI CAGE\ai-cage"
pnpm --filter @ai-cage/presidio-lite build
pnpm --filter @ai-cage/core build
pnpm --filter ai-cage-vscode build
```

### 5.2 — Package

```bash
cd apps/vscode-extension
npx vsce package --no-dependencies
# Produit ai-cage-vscode-0.4.5.vsix
```

### 5.3 — Installer localement (test)

Dans VS Code:
1. `Ctrl+Shift+P` → **"Extensions: Install from VSIX..."**
2. Sélectionne `ai-cage-vscode-0.4.5.vsix`
3. L'extension est active — ouvre un fichier `.ts` avec une clé API pour voir les diagnostics

### 5.4 — Publier (optionnel, nécessite un token VS Code Marketplace)

1. Va sur https://marketplace.visualstudio.com/manage
2. Crée un publisher (gratuit)
3. `npx vsce publish --no-dependencies`

---

## ÉTAPE 6 — GitHub Releases (téléchargement Desktop + VS Code)

1. Va sur https://github.com/smartsniper31/ai-cage/releases
2. Clique **"Create a new release"**
3. Tag: `v0.4.5`
4. Title: `AI CAGE v0.4.5 — Enterprise AI Data Protection`
5. Description: Copie depuis `PHASE5_REPORT.md`
6. Attach files:
   - `ai-cage-extension-v0.4.5.zip` (Chrome)
   - `apps/extension/firefox-dist/` zippé (Firefox)
   - `ai-cage-vscode-0.4.5.vsix` (VS Code)
   - Desktop installer (si build Tauri terminé)
7. Clique **"Publish release"**

---

## RÉCAPITULATIF — Checklist Finale

| # | Tâche | Où | Coût | Temps |
|---|------|-----|------|-------|
| 1 | Landing page sur Vercel | vercel.com | 0€ | 5 min |
| 2 | Screenshots (5x 1280x800) | Local (OBS/Win+Shift+S) | 0€ | 15 min |
| 3 | Chrome Web Store | chrome.google.com/webstore/devconsole | 5€ (frais unique Google) | 30 min |
| 4 | Firefox Add-ons | addons.mozilla.org | 0€ | 20 min |
| 5 | Desktop installer | `pnpm run tauri build` | 0€ | 15 min (build) |
| 6 | VS Code VSIX | `npx vsce package` | 0€ | 5 min |
| 7 | GitHub Release | github.com/smartsniper31/ai-cage/releases | 0€ | 10 min |
| 8 | Demo video 30s | OBS Studio | 0€ | 30 min |

**Total: 5€ (frais unique Chrome Web Store) + 0€/mois**

---

## LIENS UTILES

| Lien | Description |
|------|-------------|
| https://github.com/smartsniper31/ai-cage | Repo GitHub (source) |
| https://vercel.com | Déploiement landing page (gratuit) |
| https://chrome.google.com/webstore/devconsole | Chrome Web Store (5€ frais unique) |
| https://addons.mozilla.org/developers | Firefox Add-ons (gratuit) |
| https://marketplace.visualstudio.com/manage | VS Code Marketplace (gratuit) |

---

*AI CAGE v0.4.5 — Use Monster AI. Leak Zero Data.*
*Made in Tunisia 🇹🇳 · 100% Offline · Open Source · MIT License*
