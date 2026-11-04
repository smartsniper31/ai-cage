# AI CAGE — Vercel Deploy Guide v0.6.0

## Configuration Vercel (Dashboard)

| Paramètre | Valeur |
|-----------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `apps/landing` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 20.x |

> ⚠️ **Important** : le Root Directory doit être `apps/landing`, pas la racine du repo.
> Vercel ne doit pas voir le monorepo entier — seulement `apps/landing`.

## Variables d'environnement

Aucune variable d'environnement requise pour v0.6.0.
La landing est 100% statique — zéro appel serveur.

## Fichier vercel.json

Le fichier `apps/landing/vercel.json` est configuré :

```json
{
  "version": 2,
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "cleanUrls": true,
  "trailingSlash": false
}
```

## Déclenchement du déploiement

Vercel se déploie automatiquement à chaque `git push origin master` si le repo GitHub est connecté.

**Vérification après déploiement :**
1. Aller sur https://ai-cage-gamma.vercel.app/
2. Vérifier que la navbar affiche `v0.6.0`
3. Vérifier que le footer affiche `v0.6.0`
4. Cliquer "Start Pro Trial" → doit ouvrir une modale, pas Gmail
5. Cage 4 et 5 doivent afficher `🔜 v0.7.0`, pas `✅ Live`

## Déploiement manuel (sans GitHub connecté)

```bash
# Installer Vercel CLI
npm i -g vercel

# Depuis apps/landing/
cd apps/landing
vercel --prod
```

## URL de production

https://ai-cage-gamma.vercel.app/

## Logs de build attendus

```
Running "npm run build"
> @ai-cage/landing@0.6.0 build
> vite build
dist/index.html  32.80 kB │ gzip: 8.02 kB
✓ built in ~36s
```
