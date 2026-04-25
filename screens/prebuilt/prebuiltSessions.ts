// screens/prebuilt/prebuiltSessions.ts
// Catalogue complet des routines FKS — exercices structurés
import type { Prebuilt } from "./prebuiltConfig";

export const PREBUILT_SESSIONS: Prebuilt[] = [
  // ============================================================
  // AVANT L'EFFORT — Prépare ton corps
  // ============================================================
  {
    id: "avant-reveil-express",
    category: "AVANT L'EFFORT",
    title: "Réveil musculaire express",
    intensity: "easy",
    durationMin: 8,
    objective: "Réveille tes muscles et tes articulations en douceur",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["Express", "Matin"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mobilité articulaire",
        exercises: [
          { name: "Cat-camel", sets: 1, reps: 8, notes: "Lent et contrôlé, alterne dos rond et dos creux" },
          { name: "World's greatest stretch", sets: 1, reps: "5/côté", notes: "Fente + rotation buste, bras vers le ciel" },
          { name: "Cercles de hanches", sets: 1, reps: "10/côté", notes: "Cercles amples avec le genou, debout" },
        ],
      },
      {
        title: "Activation neuromusculaire",
        exercises: [
          { name: "Pogo hops", sets: 2, reps: 15, rest_s: 20, notes: "Chevilles rigides, contacts rapides au sol" },
          { name: "Gamme montée de genoux", sets: 2, reps: "10/jambe", rest_s: 15, notes: "Montée de genou dynamique, bras coordonnés" },
        ],
      },
    ],
    coaching: [
      "Mouvement fluide, pas de force.",
      "Respiration calme — objectif = réveiller, pas fatiguer.",
    ],
  },
  {
    id: "avant-warmup-terrain",
    category: "AVANT L'EFFORT",
    title: "Warm-up terrain complet",
    intensity: "easy",
    durationMin: 14,
    objective: "L'échauffement pro pour performer dès la 1re minute",
    focus: "mobility",
    location: "pitch",
    equipment: [],
    tags: ["Terrain", "Complet"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mise en route cardio",
        exercises: [
          { name: "Footing facile", sets: 1, reps: "4 min", notes: "Rythme conversationnel, progressif" },
        ],
      },
      {
        title: "Mobilité dynamique",
        exercises: [
          { name: "Fente avant + rotation", sets: 1, reps: "5/côté", notes: "Grande amplitude, buste droit" },
          { name: "Fente latérale", sets: 1, reps: "5/côté", notes: "Descends dans la fente, poids dans le talon" },
          { name: "Cercles de hanches", sets: 1, reps: "8/côté" },
        ],
      },
      {
        title: "Gammes athlétiques",
        exercises: [
          { name: "Montées de genoux", sets: 1, reps: "2×20m", notes: "Fréquence rapide, sur les orteils" },
          { name: "Talons-fesses", sets: 1, reps: "2×20m" },
          { name: "Gamme montée de genoux", sets: 1, reps: "2×20m", notes: "Impulsion nette, bras opposé" },
        ],
      },
      {
        title: "Accélérations progressives",
        exercises: [
          { name: "Accélération progressive 30m", sets: 4, reps: "30m", rest_s: 30, notes: "60% → 70% → 80% → 90% vitesse max" },
        ],
      },
    ],
    coaching: [
      "Progressif du début à la fin — terminé avec une légère sudation.",
      "Pas d'étirements statiques prolongés avant l'effort.",
    ],
  },
  {
    id: "avant-activation-sprint",
    category: "AVANT L'EFFORT",
    title: "Activation sprint",
    intensity: "moderate",
    durationMin: 11,
    objective: "Déverrouille ta vitesse max avant les sprints",
    focus: "speed",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["Vitesse", "Explosif"],
    level: "Intermédiaire",
    impactsTsb: false,
    blocks: [
      {
        title: "Réactivité cheville",
        exercises: [
          { name: "Pogo hops", sets: 2, reps: 20, rest_s: 20, notes: "Contacts ultra-courts, mollets actifs" },
          { name: "Ankle bounces", sets: 2, reps: 15, rest_s: 15 },
        ],
      },
      {
        title: "Gammes de sprint",
        exercises: [
          { name: "Gamme montée de genoux", sets: 2, reps: "20m", rest_s: 20, notes: "Montées de genoux alternées + impulsion" },
          { name: "Montées de genoux", sets: 2, reps: "10m", rest_s: 15, notes: "Fréquence max, rester sur les orteils" },
        ],
      },
      {
        title: "Départs",
        exercises: [
          { name: "Falling start 10m", sets: 4, reps: "10m", rest_s: 45, notes: "Déséquilibre avant puis sprint — récup complète" },
          { name: "Accélération 20m", sets: 2, reps: "20m", rest_s: 60, notes: "85-90% — contrôlé. Échauffe bien tes ischios avant. Si gêne, passe à 80%." },
        ],
      },
    ],
    coaching: [
      "Contacts au sol ultra-courts sur les drills.",
      "Récup complète entre les sprints — qualité > quantité.",
    ],
  },
  {
    id: "avant-activation-salle",
    category: "AVANT L'EFFORT",
    title: "Activation pré-salle",
    intensity: "easy",
    durationMin: 9,
    objective: "Prépare muscles et articulations avant la muscu",
    focus: "strength",
    location: "gym",
    equipment: ["Élastiques", "Rouleau de massage"],
    tags: ["Salle", "Force"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Relâchement",
        exercises: [
          { name: "Rouleau de massage cuisses", sets: 1, reps: "90s", notes: "Quadriceps + ischio-jambiers + fessiers" },
        ],
      },
      {
        title: "Activation haut du corps",
        exercises: [
          { name: "Band pull-apart", sets: 2, reps: 15, rest_s: 15, notes: "Omoplates serrées en fin de mouvement" },
          { name: "Scap push-up", sets: 2, reps: 10, rest_s: 15 },
        ],
      },
      {
        title: "Activation bas du corps",
        exercises: [
          { name: "Goblet squat", sets: 2, reps: 8, rest_s: 20, notes: "Léger — sentir les muscles s'activer" },
          { name: "Glute bridge", sets: 2, reps: 10, rest_s: 15, notes: "Serrer les fessiers en haut, 2s de pause" },
        ],
      },
    ],
    coaching: [
      "Pas de charge lourde — l'objectif est de s'échauffer, pas de fatiguer.",
      "Sentir chaque muscle s'allumer progressivement.",
    ],
  },

  // ============================================================
  // APRÈS L'EFFORT — Récupération (2 routines : express + post-match)
  // ============================================================
  {
    id: "apres-recup-express",
    category: "APRÈS L'EFFORT",
    title: "Récup express",
    intensity: "easy",
    durationMin: 10,
    objective: "Les essentiels en 10 min après une séance ou un entraînement club",
    focus: "mobility",
    location: "pitch",
    equipment: [],
    tags: ["Post-séance", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Retour au calme",
        exercises: [
          { name: "Marche lente", sets: 1, reps: "2 min", notes: "Respiration profonde, relâche les épaules" },
        ],
      },
      {
        title: "Étirements essentiels",
        exercises: [
          { name: "Étirement ischio-jambiers", sets: 1, reps: "30s/côté", notes: "Jambe tendue sur support, penche le buste" },
          { name: "Étirement quadriceps debout", sets: 1, reps: "30s/côté", notes: "Genou vers le sol, bassin neutre" },
          { name: "Étirement fléchisseurs de hanche", sets: 1, reps: "30s/côté", notes: "Genou arrière au sol, bassin vers l'avant" },
          { name: "Étirement mollets", sets: 1, reps: "30s/côté", notes: "Pied à plat contre un mur, jambe tendue" },
        ],
      },
    ],
    coaching: [
      "Maintiens chaque position sans forcer — étire en douceur.",
      "Expire profondément à chaque étirement pour relâcher.",
    ],
  },
  {
    id: "apres-recup-post-match",
    category: "APRÈS L'EFFORT",
    title: "Récup post-match",
    intensity: "easy",
    durationMin: 20,
    objective: "Protocole complet de régénération après un match",
    focus: "mobility",
    location: "home",
    equipment: ["Rouleau de massage"],
    tags: ["Post-match", "Régénération", "J+1"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Décharge",
        exercises: [
          { name: "Marche lente", sets: 1, reps: "5 min", notes: "Pieds nus si possible — ou vélo très facile" },
        ],
      },
      {
        title: "Rouleau de massage",
        exercises: [
          { name: "Rouleau de massage quadriceps", sets: 1, reps: "90s" },
          { name: "Rouleau de massage ischio-jambiers", sets: 1, reps: "90s" },
          { name: "Rouleau de massage mollets", sets: 1, reps: "60s" },
        ],
      },
      {
        title: "Étirements profonds",
        exercises: [
          { name: "Étirement fléchisseurs de hanche", sets: 1, reps: "45s/côté", notes: "Les fléchisseurs souffrent le plus en match" },
          { name: "Étirement adducteurs", sets: 1, reps: "40s/côté" },
          { name: "Étirement ischio-jambiers", sets: 1, reps: "40s/côté" },
          { name: "Étirement quadriceps debout", sets: 1, reps: "30s/côté" },
        ],
      },
    ],
    coaching: [
      "Protéine 25-30g dans les 30 min après le match.",
      "Pas de jambes lourdes demain — cette routine fait la différence.",
    ],
  },

  // ============================================================
  // JOUR DE MATCH — Le cycle J-1 / J0 / MT / J+1
  // ============================================================
  {
    id: "match-j-1",
    category: "JOUR DE MATCH",
    title: "J-1 — Activation légère",
    intensity: "easy",
    durationMin: 12,
    objective: "Reste mobile sans te fatiguer la veille du match",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["J-1", "Pré-match"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Flow mobilité",
        exercises: [
          { name: "Cat-camel", sets: 1, reps: 8 },
          { name: "World's greatest stretch", sets: 1, reps: "5/côté" },
          { name: "Cossack squat", sets: 1, reps: "5/côté", notes: "Amplitude douce" },
          { name: "Cercles de hanches", sets: 1, reps: "8/côté" },
        ],
      },
      {
        title: "Activation légère",
        exercises: [
          { name: "Glute bridge", sets: 2, reps: 10, rest_s: 15, notes: "Contracte 2s en haut" },
          { name: "Dead bug", sets: 2, reps: "8/côté", rest_s: 15, notes: "Lent et contrôlé" },
          { name: "Pogo hops", sets: 2, reps: 12, rest_s: 15, notes: "Léger, juste réveiller les mollets" },
        ],
      },
    ],
    coaching: [
      "Aucun effort intense — tu gardes tout pour demain.",
      "Bonne hydratation + couché tôt ce soir.",
    ],
  },
  {
    id: "match-warmup-j0",
    category: "JOUR DE MATCH",
    title: "Warm-up pré-match",
    intensity: "moderate",
    durationMin: 18,
    objective: "Prêt physiquement et mentalement pour le coup d'envoi",
    focus: "speed",
    location: "pitch",
    equipment: [],
    tags: ["Jour J", "Warm-up"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mise en route",
        exercises: [
          { name: "Footing facile", sets: 1, reps: "4 min", notes: "Progressif, commence doucement" },
        ],
      },
      {
        title: "Mobilité dynamique",
        exercises: [
          { name: "Fente avant + rotation", sets: 1, reps: "5/côté" },
          { name: "Fente latérale", sets: 1, reps: "5/côté" },
          { name: "Balanciers de jambe", sets: 1, reps: "10/jambe", notes: "Avant-arrière puis latéral" },
        ],
      },
      {
        title: "Gammes",
        exercises: [
          { name: "Gamme montée de genoux", sets: 1, reps: "2×20m" },
          { name: "Montées de genoux", sets: 1, reps: "2×15m" },
          { name: "Talons-fesses", sets: 1, reps: "2×15m" },
        ],
      },
      {
        title: "Activation match",
        exercises: [
          { name: "Accélération 20m", sets: 3, reps: "20m", rest_s: 40, notes: "80% → 90% → 95%" },
          { name: "Changements de direction", sets: 2, reps: "3 changements", rest_s: 30, notes: "Courts et vifs" },
        ],
      },
    ],
    coaching: [
      "Finis cet échauffement 5 min avant le coup d'envoi.",
      "Les derniers sprints doivent te donner des jambes légères, pas lourdes.",
    ],
  },
  {
    id: "match-mi-temps",
    category: "JOUR DE MATCH",
    title: "Routine mi-temps",
    intensity: "easy",
    durationMin: 5,
    objective: "Reste chaud et prêt pour la 2e mi-temps",
    focus: "mobility",
    location: "pitch",
    equipment: [],
    tags: ["Mi-temps", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Maintien actif",
        exercises: [
          { name: "Marche lente", sets: 1, reps: "1 min" },
          { name: "Étirement fléchisseurs de hanche", sets: 1, reps: "20s/côté", notes: "Rapide, pas profond" },
          { name: "Étirement mollets", sets: 1, reps: "15s/côté" },
          { name: "Pogo hops", sets: 1, reps: 10, notes: "Réveille les mollets avant de repartir" },
          { name: "Accélération progressive 30m", sets: 2, reps: "20m", rest_s: 15, notes: "70-80% — juste se relancer" },
        ],
      },
    ],
    coaching: [
      "Hydrate-toi pendant cette routine.",
      "L'objectif c'est de pas repartir froid.",
    ],
  },
  {
    id: "match-j-plus-1",
    category: "JOUR DE MATCH",
    title: "J+1 — Récup sans matériel",
    intensity: "easy",
    durationMin: 15,
    objective: "Récupère le lendemain du match — zéro matériel nécessaire",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["J+1", "Régénération", "Sans matériel"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Circulation douce",
        exercises: [
          { name: "Marche lente", sets: 1, reps: "5 min", notes: "Ou vélo très facile — juste faire circuler le sang" },
        ],
      },
      {
        title: "Mobilité douce",
        exercises: [
          { name: "Cat-camel", sets: 1, reps: 8, notes: "Très lent, respiration synchronisée" },
          { name: "World's greatest stretch", sets: 1, reps: "5/côté" },
          { name: "Cossack squat", sets: 1, reps: "5/côté", notes: "Amplitude confortable, pas de douleur" },
        ],
      },
      {
        title: "Étirements ciblés",
        exercises: [
          { name: "Étirement fléchisseurs de hanche", sets: 1, reps: "40s/côté" },
          { name: "Étirement ischio-jambiers", sets: 1, reps: "30s/côté" },
          { name: "Étirement quadriceps debout", sets: 1, reps: "30s/côté" },
          { name: "Étirement mollets", sets: 1, reps: "20s/côté" },
        ],
      },
    ],
    coaching: [
      "Zéro charge aujourd'hui — le match était ta séance.",
      "Pas de rouleau ? Pas de problème — cette version marche sans.",
    ],
  },

  // ============================================================
  // MOBILITÉ — Amplitude & entretien
  // ============================================================
  {
    id: "mob-flow-hanches",
    category: "MOBILITÉ",
    title: "Flow hanches",
    intensity: "easy",
    durationMin: 8,
    objective: "Déverrouille tes hanches — la clé de la performance foot",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["Hanches", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Ouverture de hanche",
        exercises: [
          { name: "Hip 90/90", sets: 1, reps: "8/côté", notes: "Assis au sol, pivote lentement d'un côté à l'autre" },
          { name: "World's greatest stretch", sets: 1, reps: "5/côté" },
          { name: "Cossack squat", sets: 1, reps: "6/côté", notes: "Descends aussi bas que confortable" },
          { name: "Cercles de hanches", sets: 1, reps: "10/côté", notes: "Grands cercles, debout" },
          { name: "Pigeon stretch", sets: 1, reps: "45s/côté", notes: "Jambe avant fléchie, buste vers le sol" },
        ],
      },
    ],
    coaching: [
      "Respire dans les positions — expire pour aller plus loin.",
      "Fais cette routine le matin ou avant chaque séance bas du corps.",
    ],
  },
  {
    id: "mob-flow-chevilles",
    category: "MOBILITÉ",
    title: "Chevilles & appuis",
    intensity: "easy",
    durationMin: 7,
    objective: "Des chevilles mobiles = moins d'entorses et de meilleurs appuis",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["Chevilles", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mobilité cheville",
        exercises: [
          { name: "Dorsiflexion genou au mur", sets: 1, reps: "10/côté", notes: "Pied à 10cm du mur, genou touche le mur" },
          { name: "Marche sur pointes", sets: 1, reps: "2×15m", notes: "Sur la pointe, mollets actifs" },
          { name: "Marche sur talons", sets: 1, reps: "2×15m", notes: "Sur les talons, tibias actifs" },
          { name: "Cercles de chevilles", sets: 1, reps: "10/sens/pied", notes: "Grands cercles lents" },
          { name: "Équilibre unipodal", sets: 1, reps: "30s/côté", notes: "Yeux ouverts, puis yeux fermés si facile" },
        ],
      },
    ],
    coaching: [
      "Fais ce flow après chaque entorse ou si tes chevilles sont raides.",
      "La mobilité de cheville impacte directement ta qualité de squat et tes appuis.",
    ],
  },
  {
    id: "mob-flow-tspine",
    category: "MOBILITÉ",
    title: "Débloque ton dos",
    intensity: "easy",
    durationMin: 8,
    objective: "Libère ta colonne thoracique et tes épaules",
    focus: "mobility",
    location: "home",
    equipment: ["Élastiques"],
    tags: ["Dos", "Épaules", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Colonne thoracique",
        exercises: [
          { name: "Cat-camel", sets: 1, reps: 8, notes: "Focus sur le milieu du dos" },
          { name: "Rotation thoracique à 4 pattes", sets: 1, reps: "8/côté", notes: "Main derrière la tête, tourne vers le plafond" },
          { name: "Book opener", sets: 1, reps: "8/côté", notes: "Allongé sur le côté, ouvre le bras vers l'arrière" },
        ],
      },
      {
        title: "Épaules",
        exercises: [
          { name: "Wall slide", sets: 2, reps: 10, rest_s: 15, notes: "Dos et bras collés au mur, monte et descend" },
          { name: "Wall angels", sets: 1, reps: 10, notes: "Bras en croix le long du mur" },
          { name: "Band pull-apart", sets: 2, reps: 12, rest_s: 15, notes: "Élastique léger, omoplates serrées" },
        ],
      },
    ],
    coaching: [
      "Parfait pour ceux qui travaillent assis ou conduisent beaucoup.",
      "Mobilité thoracique = meilleur transfert de force dans les duels.",
    ],
  },
  {
    id: "mob-reveil-complet",
    category: "MOBILITÉ",
    title: "Réveil complet 10 min",
    intensity: "easy",
    durationMin: 10,
    objective: "Flow matinal tête-pieds pour bien démarrer la journée",
    focus: "mobility",
    location: "home",
    equipment: [],
    tags: ["Matin", "Full body"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Colonne & hanches",
        exercises: [
          { name: "Cat-camel", sets: 1, reps: 6 },
          { name: "Rotation thoracique à 4 pattes", sets: 1, reps: "6/côté" },
          { name: "World's greatest stretch", sets: 1, reps: "4/côté" },
          { name: "Hip 90/90", sets: 1, reps: "6/côté" },
        ],
      },
      {
        title: "Bas du corps & core",
        exercises: [
          { name: "Cossack squat", sets: 1, reps: "5/côté" },
          { name: "Dorsiflexion genou au mur", sets: 1, reps: "8/côté" },
          { name: "Dead bug", sets: 1, reps: "6/côté", notes: "Lent, contrôle le bas du dos" },
          { name: "Glute bridge", sets: 1, reps: 10, notes: "Pause 2s en haut" },
        ],
      },
    ],
    coaching: [
      "Pas besoin de matériel — faisable au réveil en pyjama.",
      "Enchaîne les exercices sans pause, comme un flow.",
    ],
  },

  // ============================================================
  // PRÉVENTION — Protocoles anti-blessure
  // ============================================================
  {
    id: "prev-ischio-nordic",
    category: "PRÉVENTION",
    title: "Anti-claquage ischios",
    intensity: "moderate",
    durationMin: 15,
    objective: "Renforce tes ischios en excentrique — la blessure #1 en foot",
    focus: "strength",
    location: "home",
    equipment: ["Ancrage pieds (canapé, banc)"],
    tags: ["Ischios", "Nordic", "Essentiel"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Activation",
        exercises: [
          { name: "Glute bridge", sets: 2, reps: 10, rest_s: 15, notes: "Fessiers actifs, ischios engagés" },
          { name: "Pont fessier unilat", sets: 2, reps: "8/côté", rest_s: 15 },
        ],
      },
      {
        title: "Protocole Nordic",
        exercises: [
          { name: "Nordic assisté élastique", sets: 3, reps: 5, rest_s: 60, tempo: "3-0-1-0", notes: "Cale tes pieds sous un canapé ou un banc. Descends lentement 3-4s. Si tu ne contrôles pas la descente, réduis l'amplitude." },
          { name: "RDL unilat", sets: 2, reps: "8/côté", rest_s: 45, notes: "Dos droit, descends jusqu'à sentir l'étirement ischio" },
        ],
      },
      {
        title: "Finition",
        exercises: [
          { name: "Hamstring walkout", sets: 2, reps: 6, rest_s: 30, notes: "Allongé, marche tes pieds vers l'avant et reviens" },
        ],
      },
    ],
    coaching: [
      "Le Nordic est l'exercice #1 pour prévenir les lésions aux ischios.",
      "Contrôle la descente — c'est l'excentrique qui protège.",
    ],
  },
  {
    id: "prev-adducteurs",
    category: "PRÉVENTION",
    title: "Renforce tes adducteurs",
    intensity: "moderate",
    durationMin: 14,
    objective: "Renforce la zone la plus sollicitée par les changements de direction",
    focus: "strength",
    location: "home",
    equipment: ["Coussin ou petite balle"],
    tags: ["Adducteurs", "Pubalgie"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mobilité",
        exercises: [
          { name: "Cossack squat", sets: 2, reps: "6/côté", rest_s: 15, notes: "Descends aussi bas que confortable" },
        ],
      },
      {
        title: "Renforcement",
        exercises: [
          { name: "Copenhagen short lever", sets: 3, reps: "8/côté", rest_s: 45, notes: "Appui sur le genou (pas le pied) — isométrie 2s en haut" },
          { name: "Adductor squeeze iso", sets: 3, reps: "20s", rest_s: 30, notes: "Coussin ou petite balle entre les genoux, serre à fond" },
          { name: "Fente latérale", sets: 2, reps: "8/côté", rest_s: 30, notes: "Poussée latérale contrôlée, genou dans l'axe du pied" },
        ],
      },
    ],
    coaching: [
      "Les adducteurs sont la zone #1 de pubalgie chez le footballeur.",
      "Copenhagen = exercice roi pour la prévention. Commence court levier puis progresse.",
    ],
  },
  {
    id: "prev-genoux-acl",
    category: "PRÉVENTION",
    title: "Blinde tes genoux",
    intensity: "moderate",
    durationMin: 18,
    objective: "Stabilise tes genoux — prévention ligaments croisés",
    focus: "strength",
    location: "home",
    equipment: [],
    tags: ["Genoux", "ACL", "Stabilité"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Stabilité",
        exercises: [
          { name: "Équilibre unipodal", sets: 2, reps: "30s/côté", rest_s: 15, notes: "Genou légèrement fléchi, stable" },
          { name: "Équilibre unipodal + toucher sol", sets: 2, reps: "6/côté", rest_s: 15, notes: "Touche le sol devant/côté/derrière en équilibre" },
        ],
      },
      {
        title: "Contrôle du genou",
        exercises: [
          { name: "Split squat iso hold", sets: 2, reps: "20s/côté", rest_s: 30, notes: "Position basse, genou aligné sur le 2e orteil" },
          { name: "Step-down", sets: 2, reps: "8/côté", rest_s: 30, tempo: "3-1-1-0", notes: "Contrôle excentrique 3s, genou dans l'axe" },
          { name: "Step-down latéral", sets: 2, reps: "8/côté", rest_s: 30, notes: "Lent, contrôle la descente latérale" },
        ],
      },
      {
        title: "Atterrissage",
        exercises: [
          { name: "Squat jump + réception", sets: 2, reps: 6, rest_s: 30, notes: "Atterris genoux fléchis, JAMAIS jambes tendues. Tiens 2s." },
          { name: "Saut latéral + réception", sets: 2, reps: "5/côté", rest_s: 30, notes: "Atterrissage stable 2s, genou aligné" },
        ],
      },
    ],
    coaching: [
      "L'ACL se blesse souvent à l'atterrissage ou au changement de direction.",
      "Entraîne le contrôle du genou dans toutes les directions.",
    ],
  },
  {
    id: "prev-chevilles",
    category: "PRÉVENTION",
    title: "Chevilles en béton",
    intensity: "moderate",
    durationMin: 14,
    objective: "Chevilles solides = moins d'entorses et de meilleurs appuis",
    focus: "strength",
    location: "home",
    equipment: ["Élastiques"],
    tags: ["Chevilles", "Entorses"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Mobilité",
        exercises: [
          { name: "Dorsiflexion genou au mur", sets: 2, reps: "10/côté", rest_s: 15 },
          { name: "Cercles de chevilles", sets: 1, reps: "10/sens/pied" },
        ],
      },
      {
        title: "Renforcement",
        exercises: [
          { name: "Élévation mollets", sets: 3, reps: 12, rest_s: 30, tempo: "2-1-2-0", notes: "Monte lentement, descends lentement, amplitude max" },
          { name: "Tibialis raise", sets: 2, reps: 15, rest_s: 20, notes: "Dos au mur, monte les pointes de pieds" },
          { name: "Inversion/éversion élastique", sets: 2, reps: "10/sens/pied", rest_s: 20, notes: "Élastique autour du pied, résiste dans chaque direction" },
        ],
      },
      {
        title: "Proprioception",
        exercises: [
          { name: "Équilibre unipodal", sets: 2, reps: "30s/côté", notes: "Yeux fermés si c'est trop facile" },
          { name: "Pogo hops", sets: 2, reps: 15, rest_s: 20, notes: "Rebonds chevilles rigides, stabilise à chaque contact" },
        ],
      },
    ],
    coaching: [
      "Fais ce protocole 2-3×/semaine si tu as des chevilles fragiles.",
      "La proprioception yeux fermés est le game-changer pour la stabilité.",
    ],
  },
  {
    id: "prev-core-anti-rotation",
    category: "PRÉVENTION",
    title: "Gainage spécial foot",
    intensity: "moderate",
    durationMin: 12,
    objective: "Un core qui résiste aux contacts et aux changements de direction",
    focus: "strength",
    location: "home",
    equipment: ["Élastiques"],
    tags: ["Core", "Gainage"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "Anti-extension",
        exercises: [
          { name: "Dead bug", sets: 3, reps: "8/côté", rest_s: 20, notes: "Bas du dos collé au sol, lent et contrôlé" },
          { name: "RKC plank", sets: 2, reps: "20s", rest_s: 30, notes: "Serre TOUT : fessiers, abdos, quadriceps — max tension" },
        ],
      },
      {
        title: "Anti-rotation",
        exercises: [
          { name: "Pallof press", sets: 3, reps: "8/côté", rest_s: 30, notes: "Pousse devant toi et résiste à la rotation, 2s bras tendus" },
          { name: "Plank shoulder taps", sets: 2, reps: "8/côté", rest_s: 20, notes: "Garde les hanches stables — pas de rotation" },
        ],
      },
      {
        title: "Anti-flexion latérale",
        exercises: [
          { name: "Gainage latéral", sets: 2, reps: "25s/côté", rest_s: 15, notes: "Corps aligné de la tête aux pieds" },
        ],
      },
    ],
    coaching: [
      "Le gainage anti-rotation est plus utile au foot que les abdos classiques.",
      "Pense aux duels et aux changements de direction — c'est ça que tu entraînes ici.",
    ],
  },

  // ============================================================
  // CIRCUITS — Vrais entraînements (impactent le TSB)
  // ============================================================
  {
    id: "circuit-hiit-terrain",
    category: "CIRCUITS",
    title: "HIIT terrain",
    intensity: "hard",
    durationMin: 22,
    objective: "Cardio haute intensité spécifique football",
    focus: "circuit",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["HIIT", "Terrain", "Cardio"],
    level: "Intermédiaire",
    impactsTsb: true,
    rpeTarget: 8,
    blocks: [
      {
        title: "Échauffement",
        exercises: [
          { name: "Footing facile", sets: 1, reps: "3 min" },
          { name: "Gammes athlétiques", sets: 1, reps: "2 min", notes: "Montées de genoux, talons-fesses, pas chassés" },
        ],
      },
      {
        title: "Bloc HIIT — Répète 4 tours (repos 60s entre tours)",
        exercises: [
          { name: "Sprint 30m", sets: 1, reps: "30m", rest_s: 30, notes: "90-95% vitesse max. Si gêne musculaire, passe à 80%." },
          { name: "Déplacement latéral 10m", sets: 1, reps: "10m aller-retour", rest_s: 20, notes: "Bas sur les appuis, reste réactif" },
          { name: "Sprint navette 5-10-5", sets: 1, reps: 1, rest_s: 45, notes: "5m aller, touche, 10m retour, touche, 5m aller" },
        ],
      },
      {
        title: "Retour au calme",
        exercises: [
          { name: "Marche lente", sets: 1, reps: "2 min" },
          { name: "Étirement quadriceps debout", sets: 1, reps: "20s/côté" },
          { name: "Étirement ischio-jambiers", sets: 1, reps: "20s/côté" },
        ],
      },
    ],
    coaching: [
      "Pousse à fond sur les sprints — la récup est courte exprès.",
      "Si tu sens que ta technique lâche, rallonge la récup de 15s.",
    ],
  },
  {
    id: "circuit-force-endurance-maison",
    category: "CIRCUITS",
    title: "Force-endurance maison",
    intensity: "moderate",
    durationMin: 25,
    objective: "Renforcement complet sans matériel — endurance musculaire",
    focus: "circuit",
    location: "home",
    equipment: [],
    tags: ["Maison", "Full body", "Sans matériel"],
    level: "Tout niveau",
    impactsTsb: true,
    rpeTarget: 7,
    blocks: [
      {
        title: "Circuit A — Bas du corps — Répète 3 tours (repos 45s entre tours)",
        exercises: [
          { name: "Air squat", sets: 1, reps: 15, rest_s: 15, notes: "Amplitude complète, cuisses parallèles au sol" },
          { name: "Fente arrière alternée", sets: 1, reps: "10/côté", rest_s: 15 },
          { name: "Glute bridge", sets: 1, reps: 15, rest_s: 15, notes: "Serrer 2s en haut" },
        ],
      },
      {
        title: "Circuit B — Haut du corps + core — Répète 3 tours (repos 45s entre tours)",
        exercises: [
          { name: "Pompes", sets: 1, reps: 10, rest_s: 15, notes: "Inclinées si trop dur — qualité > quantité" },
          { name: "Plank shoulder taps", sets: 1, reps: "8/côté", rest_s: 15, notes: "Hanches stables" },
          { name: "Rowing table", sets: 1, reps: 10, rest_s: 15, notes: "Sous une table solide, tire le buste vers le dessous" },
          { name: "Dead bug", sets: 1, reps: "8/côté", rest_s: 15 },
        ],
      },
    ],
    coaching: [
      "Enchaîne les exercices avec le minimum de repos.",
      "Si c'est trop facile, réduis les repos de 45s à 30s entre les tours.",
    ],
  },
  {
    id: "circuit-explosif-appuis",
    category: "CIRCUITS",
    title: "Circuit explosif appuis",
    intensity: "hard",
    durationMin: 20,
    objective: "Explosivité et réactivité des appuis — spécifique football",
    focus: "plyo",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["Explosif", "Appuis", "Terrain"],
    level: "Intermédiaire",
    impactsTsb: true,
    rpeTarget: 8,
    blocks: [
      {
        title: "Activation plyométrique",
        exercises: [
          { name: "Pogo hops", sets: 2, reps: 15, rest_s: 20 },
          { name: "Ankle bounces", sets: 2, reps: 12, rest_s: 15 },
        ],
      },
      {
        title: "Bloc explosif — Répète 3 tours (repos 60s entre tours)",
        exercises: [
          { name: "Squat jump + réception", sets: 1, reps: 5, rest_s: 30, notes: "Max hauteur, atterris stable 2s" },
          { name: "Bond latéral + réception", sets: 1, reps: "5/côté", rest_s: 30, notes: "Bond latéral max, stabilise" },
          { name: "Skater jump", sets: 1, reps: "6/côté", rest_s: 20, notes: "Alternance rapide gauche-droite" },
          { name: "Falling start 10m", sets: 1, reps: "10m", rest_s: 45, notes: "Départ en déséquilibre, sprint court" },
        ],
      },
    ],
    coaching: [
      "Qualité d'atterrissage = priorité. Si tes genoux tremblent, arrête.",
      "Récupère bien entre les tours — chaque répétition doit être explosive.",
    ],
  },
  {
    id: "circuit-haut-du-corps",
    category: "CIRCUITS",
    title: "Haut du corps duels",
    intensity: "moderate",
    durationMin: 22,
    objective: "Renforce le haut du corps pour les duels et les protections de balle",
    focus: "strength",
    location: "gym",
    equipment: ["Haltères", "Élastiques"],
    tags: ["Haut du corps", "Duels", "Salle"],
    level: "Tout niveau",
    impactsTsb: true,
    rpeTarget: 7,
    blocks: [
      {
        title: "Poussée (3 séries)",
        exercises: [
          { name: "Pompes", sets: 3, reps: 12, rest_s: 45, notes: "Contrôle la descente 2s, push explosif" },
          { name: "Développé épaules", sets: 3, reps: 10, rest_s: 45, notes: "Haltères ou barre légère" },
        ],
      },
      {
        title: "Tirage (3 séries)",
        exercises: [
          { name: "Rowing unilat", sets: 3, reps: "10/côté", rest_s: 45, notes: "Haltère, tire le coude vers la hanche" },
          { name: "Face pull", sets: 3, reps: 15, rest_s: 30, notes: "Élastique, tire vers le visage, coudes hauts" },
        ],
      },
      {
        title: "Core anti-contact",
        exercises: [
          { name: "Pallof press", sets: 3, reps: "8/côté", rest_s: 30 },
          { name: "Farmer carry", sets: 2, reps: "30m", rest_s: 30, notes: "Marche lente, épaules basses, core gainé" },
        ],
      },
    ],
    coaching: [
      "Un bon haut du corps = tu tiens les duels et tu protèges ta balle.",
      "Pas besoin de charges lourdes — travaille l'endurance musculaire.",
    ],
  },
  {
    id: "circuit-full-body-express",
    category: "CIRCUITS",
    title: "Full body express",
    intensity: "moderate",
    durationMin: 15,
    objective: "Circuit rapide quand tu as peu de temps mais que tu veux bouger",
    focus: "circuit",
    location: "home",
    equipment: [],
    tags: ["Express", "Full body", "15 min"],
    level: "Tout niveau",
    impactsTsb: true,
    rpeTarget: 6,
    blocks: [
      {
        title: "Circuit — Répète 3 tours (repos 60s entre tours)",
        exercises: [
          { name: "Air squat", sets: 1, reps: 15, rest_s: 10 },
          { name: "Pompes", sets: 1, reps: 10, rest_s: 10, notes: "Inclinées si besoin" },
          { name: "Fente arrière alternée", sets: 1, reps: "8/côté", rest_s: 10 },
          { name: "Plank shoulder taps", sets: 1, reps: "8/côté", rest_s: 10 },
          { name: "Glute bridge", sets: 1, reps: 12, rest_s: 10 },
          { name: "Dead bug", sets: 1, reps: "6/côté", rest_s: 10 },
        ],
      },
    ],
    coaching: [
      "15 minutes > 0 minute. Mieux vaut ça que rien.",
      "Enchaîne vite — le repos est court exprès.",
    ],
  },
  {
    id: "circuit-defi-core-5min",
    category: "CIRCUITS",
    title: "Défi Core 5 min",
    intensity: "moderate",
    durationMin: 5,
    objective: "Teste ton core en 5 minutes chrono — sans pause",
    focus: "strength",
    location: "home",
    equipment: [],
    tags: ["Défi", "Core", "Express"],
    level: "Tout niveau",
    impactsTsb: false,
    blocks: [
      {
        title: "5 min non-stop",
        exercises: [
          { name: "Planche", sets: 1, reps: "30s" },
          { name: "Dead bug", sets: 1, reps: "8/côté" },
          { name: "Gainage latéral", sets: 1, reps: "20s/côté" },
          { name: "Plank shoulder taps", sets: 1, reps: "10/côté" },
          { name: "Hollow hold", sets: 1, reps: "20s" },
          { name: "Bird dog", sets: 1, reps: "6/côté" },
          { name: "RKC plank", sets: 1, reps: "20s", notes: "Donne tout — dernière position !" },
        ],
      },
    ],
    coaching: [
      "Zéro pause entre les exercices — c'est un défi.",
      "Chronomètre-toi et note ton temps. Bats-le la prochaine fois.",
    ],
  },
];
