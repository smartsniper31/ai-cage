# AI CAGE — Release Process (Standard Operating Procedure)

**Version :** v0.6.0+  
**Règle :** Après CHAQUE modification de code, exécuter ce processus. Sans exception.

---

## La règle d'or

> **Toute modification de code → lancer le script de release → vérifier Vercel.**

Si le script passe, le client reçoit automatiquement la mise à jour via :
1. Vercel (landing) — auto-deploy dès que `git push origin master` réussit
2. GitHub Release — zips frais disponibles en téléchargement immédiat

---

## Commande unique (Windows)

```powershell
# Depuis la racine du repo :
powershell -ExecutionPolicy Bypass -File scripts/release.ps1

# Avec un message de commit personnalisé :
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Message "fix: ma correction"
```

## Commande unique (Linux/Mac/CI)

```bash
bash scripts/release.sh
# Avec message :
bash scripts/release.sh "fix: ma correction"
```

---

## Ce que le script fait (11 étapes automatiques)

| Étape | Action | Vérifie |
|-------|--------|---------|
| 1 | Build `@ai-cage/presidio-lite` + `@ai-cage/core` | 0 erreur TypeScript |
| 2 | Build extension Chrome → `apps/extension/dist/` | content.js, background.js, popup.js, welcome.html |
| 3 | Build Firefox → `apps/extension/firefox-dist/` | manifest.json patché pour Firefox |
| 4 | Build landing → `apps/landing/dist/` | index.html + install.html copiés |
| 5 | Tests `pnpm test` | 202/202 pass obligatoire |
| 6 | Chrome ZIP → `dist/ai-cage-extension-vX.X.X-chrome.zip` | Taille cohérente |
| 7 | Firefox ZIP → `dist/ai-cage-extension-vX.X.X-firefox.zip` | Taille cohérente |
| 8 | SHA256 checksums → `dist/checksums-vX.X.X.txt` | Intégrité des zips |
| 9 | `test-results-vX.X.X.txt` mis à jour | Date + tailles |
| 10 | `git add --all` + `git commit` + `git push origin master` | Vercel déclenché |
| 11 | GitHub Release : suppression anciens assets + upload nouveaux | 4 assets frais |

---

## Comment bumper la version (ex: v0.6.0 → v0.7.0)

1. Modifier `apps/extension/src/manifest.json` → `"version": "0.7.0"`
2. Modifier `package.json` racine → `"version": "0.7.0"`
3. Modifier `apps/landing/package.json` → `"version": "0.7.0"`
4. Créer le tag GitHub : `git tag -a v0.7.0 -m "v0.7.0 - description"`
5. Créer la release GitHub : `gh release create v0.7.0 --title "v0.7.0 - ..." --notes "..."`
6. Lancer le script : `powershell -ExecutionPolicy Bypass -File scripts/release.ps1`

Le script lit la version depuis `manifest.json` automatiquement — plus besoin de changer les noms de fichiers manuellement.

---

## Vérification post-release (2 minutes)

Après que le script termine, vérifier ces 4 points :

| # | Vérification | URL / Commande |
|---|-------------|----------------|
| 1 | Vercel landing affiche la bonne version | https://ai-cage-gamma.vercel.app/ → footer |
| 2 | GitHub Release contient les 4 assets | https://github.com/smartsniper31/ai-cage/releases |
| 3 | Chrome zip téléchargeable | Cliquer le lien dans la Release |
| 4 | Extension chargée → welcome.html EN | Recharger depuis `apps/extension/dist/` |

---

## Ce que Vercel déploie automatiquement

**Déclencheur :** `git push origin master` (Step 10 du script)

**Ce qui est déployé :**
- `apps/landing/dist/index.html` → https://ai-cage-gamma.vercel.app/
- `apps/landing/dist/install.html` → https://ai-cage-gamma.vercel.app/install.html

**Configuration Vercel :**
- Root Directory : `apps/landing`
- Build Command : `npm run build`
- Output Directory : `dist`
- Framework : Vite

**Les zips NE vont PAS sur Vercel** (ce sont des assets binaires, ils vont sur GitHub Release).

---

## Points d'attention (ne jamais oublier)

1. **`dist/` est dans `.gitignore`** — c'est normal. Les zips vont sur GitHub Release via `gh`, pas dans git.
2. **`firefox-dist/` doit être rebuil à chaque fois** via `node build-firefox.mjs` — sinon il garde l'ancienne version.
3. **La version vient toujours de `manifest.json`** — ne jamais hardcoder une version ailleurs.
4. **Le pre-commit relance les tests** — si le commit bloque, c'est que les tests ont échoué. Fix avant de continuer.
5. **Vercel auto-deploy prend ~60 secondes** après le push. Attendre avant de vérifier.

---

## Checklist rapide (à coller dans chaque PR)

```
[ ] pnpm build → 0 erreur
[ ] pnpm test  → 202/202
[ ] scripts/release.ps1 exécuté
[ ] GitHub Release v0.X.X assets mis à jour (4 fichiers)
[ ] https://ai-cage-gamma.vercel.app/ affiche la bonne version
[ ] Chrome zip téléchargeable + installable
[ ] welcome.html s'ouvre EN à l'installation
```
