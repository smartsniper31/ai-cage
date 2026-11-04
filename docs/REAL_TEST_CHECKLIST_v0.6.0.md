# AI CAGE v0.6.0 — Checklist Tests Réels Fondateur

**Date :** ___________  
**Testeur :** ___________  
**Extension chargée depuis :** `apps/extension/dist/`  
**Chrome version :** ___________

> Ces 6 tests doivent être faits manuellement après chaque release.
> Cochez [x] quand validé. Notez le résultat observé.

---

## TEST 1 — Landing : version v0.6.0 affichée

**URL :** https://ai-cage-gamma.vercel.app/

**Étapes :**
1. Ouvrir la landing en navigation privée (Ctrl+Maj+N)
2. Vérifier la navbar en haut à droite
3. Vérifier le footer en bas de page

**Attendu :**
- Navbar : `AI CAGE v0.6.0`
- Footer : `v0.6.0`
- Cage 4 "Code Leak" affiche `🔜 v0.7.0` (pas ✅ Live)
- Cage 5 "Voice/Video" affiche `🔜 v0.7.0` (pas ✅ Live)

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## TEST 2 — Start Pro Trial : modale pas Gmail

**URL :** https://ai-cage-gamma.vercel.app/#pricing

**Étapes :**
1. Scroller jusqu'à la section Pricing
2. Cliquer le bouton **"💳 Démarrer l'essai Pro — 5€/mois"**

**Attendu :**
- Une modale s'ouvre dans la page en <300ms
- La modale contient un champ email, un champ nom
- Un bouton "Démarrer mon essai gratuit →"
- **Le client mail Gmail/Outlook ne s'ouvre PAS**

**Bonus :** Remplir le formulaire → cliquer le bouton → voir l'état succès "Demande envoyée !"

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## TEST 3 — Extension : 1 seul popup, version v0.6.0

**Prérequis :** Extension chargée en mode développeur depuis `apps/extension/dist/`

**Étapes :**
1. Aller sur https://chat.deepseek.com (ou n'importe quelle IA)
2. Cliquer sur l'icône 🔒 AI CAGE dans la barre Chrome

**Attendu :**
- **1 seul** popup s'ouvre (le popup extension standard)
- **Aucune** bulle flottante dans la page
- **Aucun** mini-panel qui apparaît en bas-droite
- Le header du popup affiche `v0.6.0`

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## TEST 4 — Cage + Toast vert visible

**Prérequis :** Extension active, sur https://chat.deepseek.com ou https://chatgpt.com

**Étapes :**
1. Cliquer dans le champ de message
2. Taper : `Mon email est karim.test@agence-bizerte.tn et mon IBAN est TN5910006035183598478831`
3. Appuyer sur **Entrée** (ou cliquer le bouton Envoyer)

**Attendu dans les 200ms :**
- Un **toast vert** apparaît en bas-droite : `🔒 2 protégés (email address, iban)`
- Le toast disparaît automatiquement après 2.5s
- Le badge de l'icône extension affiche `2`

**Vérification dans le popup :**
- Ouvrir le popup → "Caged this session" affiche `2` minimum

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## TEST 5 — DevTools : payload réseau contient [CAGED] pas PII réel

**Prérequis :** Extension active, sur https://chat.deepseek.com

**Étapes :**
1. Ouvrir DevTools (F12) → onglet **Network**
2. Filtrer par `api` ou `chat`
3. Taper un message contenant votre email réel
4. Envoyer
5. Dans Network, trouver la requête POST vers DeepSeek
6. Inspecter le **Payload** (Request Body)

**Attendu :**
- Le payload contient `[CAGED_EMAIL_1]` à la place de votre vrai email
- Votre vrai email n'apparaît **nulle part** dans le payload réseau

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS ← **Preuve zéro-data la plus importante**
- [ ] FAIL — Raison : ___________

---

## TEST 6 — Upload PDF : Warning orange 5s

**Prérequis :** Extension active, sur https://chat.deepseek.com ou https://claude.ai

**Étapes :**
1. Préparer un PDF quelconque (même vide)
2. Glisser-déposer le PDF dans le champ de message OU cliquer l'icône pièce jointe
3. Observer le bas-droite de l'écran

**Attendu dans les 500ms :**
- Un **toast orange** apparaît : `📄 Fichier détecté — vérifiez qu'il ne contient pas de données sensibles avant d'envoyer`
- Le toast reste visible **5 secondes** (plus long qu'un toast normal)
- Aucun fichier n'est bloqué — le warning est informatif

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## TEST BONUS — Onboarding à la 1ère installation

**Étapes :**
1. Désinstaller l'extension
2. Recharger l'extension depuis `chrome://extensions` → "Charger l'extension non empaquetée" → `apps/extension/dist/`

**Attendu dans les 2s :**
- Un **nouvel onglet s'ouvre automatiquement** avec la page de bienvenue
- La page affiche : "✅ Installation réussie" + 3 étapes en français
- CTA "Tester sur ChatGPT maintenant"

**Résultat observé :** ___________________________________________

- [ ] TODO
- [ ] PASS
- [ ] FAIL — Raison : ___________

---

## Résumé Final

| Test | Statut |
|------|--------|
| TEST 1 — Landing v0.6.0 | [ ] PASS / [ ] FAIL |
| TEST 2 — Modal Pro Trial | [ ] PASS / [ ] FAIL |
| TEST 3 — 1 seul popup | [ ] PASS / [ ] FAIL |
| TEST 4 — Toast vert cage | [ ] PASS / [ ] FAIL |
| TEST 5 — Payload [CAGED] | [ ] PASS / [ ] FAIL |
| TEST 6 — Warning PDF | [ ] PASS / [ ] FAIL |
| BONUS — Onboarding | [ ] PASS / [ ] FAIL |

**Score : ___/6 PASS**

**Prêt à vendre à Karim : [ ] OUI / [ ] NON**

Si NON → créer un issue GitHub avec le test qui a échoué.
