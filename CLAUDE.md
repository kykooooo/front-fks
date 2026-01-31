# FKS - App de Préparation Physique Football

## 🎯 Vision
Application mobile de préparation physique personnalisée pour footballeurs, pilotée par IA.

## 🏗️ Architecture Technique

### Backend
- **Langage** : [Node.js/Python/autre - mettez ce que GPT a utilisé]
- **Base de données** : Firestore
- **Cœur métier** : Génération de séances d'entraînement via système de tokens/formats/cycles

### Frontend
- **Framework** : React Native
- **State Management** : Zustand (avec persistance AsyncStorage)
- **Auth & Sync** : Firebase Auth + watchers Firestore

## 🧠 Concepts Clés Métier

### Système de Génération (Backend)
- **Token** = type d'exercice (accel, force, core, run, recovery, etc.)
- **Format** = template de structure (A, B, C) pour la variété
- **Cycle/Playlist** = programme de 12 séances (Fondation, Force, Endurance, Technique & Vitesse)
- **Archetype** = séance type dans un cycle
- **Whitelist** = liste d'exercices autorisés par token/format pour éviter les exos hors scope

### Génération de Séance (Flow)
1. Context envoyé par le front (profil, ATL/CTL/TSB, contraintes, temps dispo, matériel, douleurs)
2. Backend choisit un archetype dans le cycle actif
3. Génère un plan de blocs (tokens)
4. Pour chaque token, choisit format + pioche exercices dans exercise bank
5. Applique filtres (matériel/douleurs) + garde-fous (durée, volume)
6. Retourne JSON fks.next_session.v2

### Métriques de Charge
- **ATL** (Acute Training Load) = charge aiguë
- **CTL** (Chronic Training Load) = charge chronique  
- **TSB** (Training Stress Balance) = équilibre forme/fatigue

### Cycles Disponibles (avec lieux recommandés)
- **Fondation**  
  Maison ✅ · Terrain ✅ · Salle ✅  
  Objectif : base physique générale, renfo + run facile.
- **Force**  
  Maison ✅ (version light) · Terrain ❌ · Salle ✅ (idéal)  
  Objectif : renfo bas/haut, besoin d’équipement si possible.
- **Endurance / Engine**  
  Maison ✅ (cardio léger) · Terrain ✅ · Salle ✅ (vélo/rameur/tapis)  
  Objectif : aérobie, tempo, intervalles.
- **Explosivité (vitesse & technique)**  
  Maison ⚠️ (drills + technique light) · Terrain ✅ (idéal) · Salle ✅ (medball + drills)  
  Objectif : vitesse, appuis, accélération.
- **Explosif (puissance)**  
  Maison ⚠️ (version light) · Terrain ✅ · Salle ✅ (idéal)  
  Objectif : sprint + power + plyo.
- **RSA (Repeated Sprint Ability)**  
  Maison ⚠️ (version light) · Terrain ✅ (idéal) · Salle ✅ (cardio + circuits)  
  Objectif : répéter les sprints, récup courte.
- **Saison / Maintien**  
  Maison ✅ · Terrain ✅ · Salle ✅  
  Objectif : rester frais sans fatigue.
- **Off‑Season / Transition**  
  Maison ✅ · Terrain ✅ · Salle ✅  
  Objectif : récup active, fun, maintien léger.

## 📱 Parcours Utilisateur (Frontend)

### Onboarding
Login/register → Setup profil (poste, niveau, pied fort, objectif, charge club/match, matériel, code club)

### Mode Joueur
- **Home** : readiness, semaine (séances + charges), cycle en cours, boutons génération
- **Cycles** : 1 seul cycle actif, choix/gestion cycles
- **Génération** : choix environnement + matériel → backend génère → preview → live → feedback (RPE, fatigue, douleur)
- **Tests terrain** : batterie de tests par playlist, conseillés avant démarrage cycle
- **Bibliothèque** : catalogue exercices + vidéos validées + alternatives

### Mode Coach  
Dashboard coach : création club + code invitation, liste joueurs, détails joueur (profil + séances)

## 🔧 Points Techniques Importants

### Garde-fous Backend
- Caps durée selon match/club/deload
- Fallback vers séances "safe" si contraintes trop strictes
- Anti-répétition (système de mémoire)
- Post-traitements validation (structure, volume, équipement)

### Contraintes Génération
- **Obligatoire** : respecter matériel disponible + douleurs/blessures
- **Cycle actif** : obligatoire pour générer
- **Feedback** : doit être rempli après séance (bloque prochaine génération hors mode dev)
- **12 séances** : fin de cycle → prompt choix nouveau cycle

### Assistant Chat (endpoint séparé)
- Explique séances générées
- Propose variantes/adaptations légères
- Ne contredit JAMAIS la séance proposée
- Auth + rate limit + timeout serveur

## 📂 Structure Probablement
```
/backend
  /routes
  /services
    - sessionGenerator.js (ou .py)
    - tokenManager.js
    - exerciseBank.js
  /models
  
/frontend  
  /screens
    - Home.jsx
    - CycleManager.jsx
    - SessionLive.jsx
    - Feedback.jsx
    - CoachDashboard.jsx
  /store (Zustand)
  /components
  /services
    - firebaseService.js
```

## ⚠️ Règles à TOUJOURS Respecter

1. **Jamais de génération sans cycle actif**
2. **Filtres matériel/douleurs = priorité absolue**
3. **12 séances = cycle complet**
4. **Feedback obligatoire après séance** (met à jour charge + avance cycle)
5. **Un seul cycle actif à la fois**
6. **Format JSON fks.next_session.v2 pour les séances**

## 💬 Note pour Claude
Je ne suis pas développeur, j'ai créé cette app avec GPT. Quand tu m'expliques du code, utilise un français simple et des analogies foot si possible. Merci ! ⚽
```

**Adaptez** ce template avec vos vraies infos (langages, structure de dossiers, etc.)

---

### **2. Première Conversation avec Claude** (5 min)

Une fois le fichier `CLAUDE.md` créé, lancez Claude dans VS Code et dites juste :
```
Lis le fichier CLAUDE.md puis explore le projet. 
Dis-moi si tu comprends bien l'architecture et s'il y a des choses à clarifier.
```

Claude va :
1. ✅ Lire CLAUDE.md
2. ✅ Explorer votre arborescence
3. ✅ Regarder quelques fichiers clés
4. ✅ Vous poser des questions pour clarifier si besoin

---