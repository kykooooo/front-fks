// screens/PrebuiltSessionsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrainingStore } from "../state/trainingStore";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../constants/theme";

const palette = theme.colors;

type Prebuilt = {
  category: string;
  title: string;
  intensity: "easy" | "moderate" | "hard";
  duration: string;
  objective: string;
  detail: string[];
  focus?: "run" | "strength" | "speed" | "circuit" | "plyo" | "mobility";
  location?: "gym" | "pitch" | "home";
  equipment?: string[];
  tags?: string[];
  level?: string;
  expectations?: string[];
  rpe_target?: number;
};

const PREBUILT_SESSIONS: Prebuilt[] = [
  {
    category: "EXPLOSIVITÉ",
    title: "EXPLO #1 — Power bas du corps (gym)",
    intensity: "hard",
    duration: "50-60 min",
    objective: "Puissance + transfert sprint/duels",
    focus: "strength",
    location: "gym",
    equipment: ["Trap bar", "Box", "Haltères"],
    tags: ["Power", "Lower", "Gym"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 8-10 min vélo + mobilité hanches/chevilles",
      "Bloc 1 — Pré-activation: Pogos 2 x 20 + CMJ 3 x 5 (60\" rec)",
      "Bloc 2 — Power: Trap bar deadlift 5 x 3 @ 70-80% (2'30 rec)",
      "Bloc 3 — Contrast: Box jump 4 x 4 + Split squat 3 x 6 / jambe",
      "Bloc 4 — Core: Pallof press 3 x 10 / côté + Farmer carry 3 x 20 m",
      "Retour au calme: 6 min respiration + étirements dynamiques",
    ],
    expectations: [
      "Qualité d'appui > charge. Si la vitesse chute, stop.",
      "Repos complet sur les efforts puissants.",
      "Amplitude propre sur les sauts, atterrissages silencieux.",
    ],
  },
  {
    category: "EXPLOSIVITÉ",
    title: "EXPLO #2 — Plyo + bounds (terrain)",
    intensity: "moderate",
    duration: "35-45 min",
    objective: "Réactivité, élasticité et qualité d'appui",
    focus: "plyo",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["Plyo", "Elasticité", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10-12 min gammes + 3 lignes droites progressives",
      "Bloc 1 — Pré-activation: Pogos 2 x 20 + Skips 2 x 20 m",
      "Bloc 2 — Bounds: 4 x 20 m bonds (60-90\" rec)",
      "Bloc 3 — Sauts: 3 x 5 CMJ + 3 x 5 broad jump",
      "Retour au calme: 6 min footing léger + mobilité chevilles",
    ],
    expectations: [
      "Contacts courts, gainage actif.",
      "Stop si douleur ou lourdeur excessive.",
      "Priorité à la vitesse d'exécution, pas au volume.",
    ],
  },
  {
    category: "EXPLOSIVITÉ",
    title: "EXPLO #3 — Accel + medball (terrain)",
    intensity: "moderate",
    duration: "40-50 min",
    objective: "Départs puissants + transfert haut du corps",
    focus: "speed",
    location: "pitch",
    equipment: ["Cônes", "Medball"],
    tags: ["Accel", "Medball", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10-12 min gammes + 3 lignes droites",
      "Bloc 1 — Accel: 4 x 10 m + 3 x 15 m (90\" rec)",
      "Bloc 2 — Medball: chest pass 4 x 5 + rotational throw 3 x 5 / côté",
      "Bloc 3 — Relâché: 4 x 20 m progressifs",
      "Retour au calme: 6 min footing léger",
    ],
    expectations: [
      "Départs propres, angle de projection stable.",
      "Repos complet sur les accélérations.",
      "Lancer explosif sans cambrer.",
    ],
  },
  {
    category: "EXPLOSIVITÉ",
    title: "EXPLO #4 — Upper power + contacts (gym)",
    intensity: "moderate",
    duration: "40-50 min",
    objective: "Puissance haut du corps + appuis réactifs",
    focus: "plyo",
    location: "gym",
    equipment: ["Banc", "Medball", "Box"],
    tags: ["Upper", "Power", "Gym"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 8 min mobilité épaules + activation",
      "Bloc 1 — Upper power: bench press dynamique 5 x 3 @ 60-70% (2' rec)",
      "Bloc 2 — Medball: slam 4 x 6 + chest pass 3 x 5",
      "Bloc 3 — Appuis: pogo hops 3 x 20 + line hops 3 x 15",
      "Retour au calme: 5 min mobilité haut du corps",
    ],
    expectations: [
      "Vitesse d'exécution maximale.",
      "Repos complet, pas de fatigue résiduelle.",
    ],
  },
  {
    category: "VITESSE",
    title: "SPEED #1 — Accélération 0-20 m",
    intensity: "hard",
    duration: "30-40 min",
    objective: "Premiers appuis explosifs et angle de projection",
    focus: "speed",
    location: "pitch",
    equipment: ["Cônes", "Chrono"],
    tags: ["Accel", "Technique", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 12 min footing + gammes + 3 lignes droites",
      "Bloc 1 — Technique: wall drill 2 x 20\" + falling start 4 x 10 m",
      "Bloc 2 — Accélération: 3 x 3 x 10-20 m, 20\" rec, 2' entre séries",
      "Bloc 3 — Finition: 4 x 10 m départ statique (RPE 7)",
      "Retour au calme: 6 min footing léger",
    ],
    expectations: [
      "Repos long pour garder la vitesse.",
      "Position neutre, poussée horizontale.",
      "Arrête si la technique se dégrade.",
    ],
  },
  {
    category: "VITESSE",
    title: "SPEED #2 — MaxV flying 10 m",
    intensity: "hard",
    duration: "35-45 min",
    objective: "Vitesse max sans fatigue résiduelle",
    focus: "speed",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["MaxV", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 12-15 min footing + gammes + 4 lignes droites",
      "Bloc 1 — Build-up: 4 x 30 m progressifs (60\" rec)",
      "Bloc 2 — Flying: 6 x 10 m lancés (20 m d'élan, 2-3' rec)",
      "Bloc 3 — Relâché: 4 x 60 m à 90% (RPE 6)",
      "Retour au calme: 6-8 min footing léger",
    ],
    expectations: [
      "Repos complet. Qualité avant quantité.",
      "Regard haut, relâchement épaules.",
      "Arrêter si la foulée raccourcit.",
    ],
  },
  {
    category: "FORCE",
    title: "FORCE #1 — Lower strength (gym)",
    intensity: "hard",
    duration: "55-65 min",
    objective: "Force maximale utile aux duels",
    focus: "strength",
    location: "gym",
    equipment: ["Barre", "Rack", "Banc"],
    tags: ["Lower", "Max Force", "Gym"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10 min vélo + activation hanches/post chaine",
      "Bloc 1 — Squat: 5 x 4 @ 80-85% (2-3' rec)",
      "Bloc 2 — Hinge: RDL 4 x 6 (2' rec)",
      "Bloc 3 — Unilat: Bulgarian split squat 3 x 6 / jambe",
      "Bloc 4 — Core: Copenhagen 3 x 20\" / côté + planche 3 x 30\"",
      "Retour au calme: 6 min étirements dynamiques",
    ],
    expectations: [
      "Priorité au contrôle et à la profondeur.",
      "RPE 7-8 sur les séries lourdes.",
      "Pas d'échec musculaire.",
    ],
  },
  {
    category: "FORCE",
    title: "FORCE #2 — Upper duel + core",
    intensity: "moderate",
    duration: "45-55 min",
    objective: "Haut du corps solide + gainage anti-contact",
    focus: "strength",
    location: "gym",
    equipment: ["Banc", "Haltères", "Tirage"],
    tags: ["Upper", "Core", "Gym"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 8 min mobilité épaules + band pull-apart",
      "Bloc 1 — Push/Pull: Bench press 4 x 6 + Row 4 x 8",
      "Bloc 2 — Unilat: One-arm row 3 x 10 / côté + Landmine press 3 x 8",
      "Bloc 3 — Core: Pallof press 3 x 10 / côté + side plank 3 x 25\"",
      "Retour au calme: 5 min mobilité scapulaire",
    ],
    expectations: [
      "Amplitude contrôlée, pas de douleurs épaules.",
      "Rythme régulier, tempo propre.",
      "RPE 6-7 global.",
    ],
  },
  {
    category: "FORCE",
    title: "FORCE #3 — Full body maintenance (in-season)",
    intensity: "moderate",
    duration: "40-50 min",
    objective: "Entretenir sans générer trop de fatigue",
    focus: "strength",
    location: "gym",
    equipment: ["Haltères", "Banc"],
    tags: ["Maintenance", "Full Body"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 8 min circuit léger (squat, push-up, hip hinge)",
      "Bloc 1 — Full body: Goblet squat 3 x 8 + Row 3 x 10 + Hip thrust 3 x 8",
      "Bloc 2 — Unilat: Split squat 3 x 6 / jambe",
      "Bloc 3 — Core: Dead bug 3 x 10 / côté + hollow 3 x 20\"",
      "Retour au calme: 5 min mobilité",
    ],
    expectations: [
      "RPE 6-7, garder des reps en réserve.",
      "Objectif = fraîcheur, pas de fatigue résiduelle.",
    ],
  },
  {
    category: "PRÉPA",
    title: "PREPA #1 — Base athlétique (terrain)",
    intensity: "moderate",
    duration: "45-55 min",
    objective: "Base endurance + force légère",
    focus: "circuit",
    location: "pitch",
    equipment: ["Cônes", "Tapis"],
    tags: ["Base", "Circuit", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10 min footing + mobilité hanches/chevilles",
      "Circuit 1: 3 tours — squat 12, pompe 10, gainage 30\", 60\" rec",
      "Bloc 2 — Course: 3 x 6 min allure confort-dur, 2 min rec",
      "Bloc 3 — Core: dead bug 3 x 10 / côté + side plank 2 x 25\"",
      "Retour au calme: 6 min footing léger",
    ],
    expectations: [
      "RPE 6-7, garder de la marge.",
      "Technique propre sur tous les mouvements.",
    ],
  },
  {
    category: "PRÉPA",
    title: "PREPA #2 — Force + accel (gym)",
    intensity: "hard",
    duration: "55-65 min",
    objective: "Force utile + départs courts",
    focus: "strength",
    location: "gym",
    equipment: ["Barre", "Box", "Chrono"],
    tags: ["Force", "Accel", "Gym"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 8-10 min vélo + activation post chaîne",
      "Bloc 1 — Squat: 4 x 4 @ 80-85% (2'30 rec)",
      "Bloc 2 — Trap bar jump: 4 x 4 @ 20-30% (2' rec)",
      "Bloc 3 — Accel: 6 x 10 m départ statique (90\" rec)",
      "Bloc 4 — Core: pallof press 3 x 10 / côté",
      "Retour au calme: 6 min mobilité",
    ],
    expectations: [
      "Qualité d'appui, pas d'échec.",
      "Explosif sur les départs, repos complet.",
    ],
  },
  {
    category: "PRÉPA",
    title: "PREPA #3 — Prévention + mobilité (home)",
    intensity: "easy",
    duration: "30-40 min",
    objective: "Préparer les tissus sans fatigue",
    focus: "mobility",
    location: "home",
    equipment: ["Élastiques", "Tapis"],
    tags: ["Prévention", "Mobilité", "Home"],
    level: "Tout niveau",
    detail: [
      "Respiration: 2 min 90/90 breathing",
      "Bloc 1 — Chevilles: tib raise 3 x 12 + calf raise 3 x 12",
      "Bloc 2 — Ischios: ham walkout 3 x 6 + nordic assisté 3 x 4",
      "Bloc 3 — Hanches: 90/90 switches 3 x 6 / côté",
      "Fin: 3 min étirements doux",
    ],
    expectations: [
      "RPE 4-5, pas de douleur.",
      "Tempo lent, amplitude contrôlée.",
    ],
  },
  {
    category: "ENDURANCE",
    title: "ENDURANCE #1 — Tempo aérobie",
    intensity: "moderate",
    duration: "45-55 min",
    objective: "Tenir l'intensité match sans exploser",
    focus: "run",
    location: "pitch",
    equipment: ["Chrono"],
    tags: ["Tempo", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10 min footing progressif + 2 lignes droites",
      "Bloc: 3 x 8 min allure confort-dur, 3 min rec",
      "Option: 4 x 20\" accélérations légères",
      "Retour au calme: 8 min footing léger",
    ],
    expectations: [
      "Respiration contrôlée, pas d'asphyxie.",
      "Allure stable sur chaque répétition.",
    ],
  },
  {
    category: "ENDURANCE",
    title: "ENDURANCE #2 — Intervalles 30/30",
    intensity: "hard",
    duration: "35-45 min",
    objective: "Capacité à répéter des efforts intenses",
    focus: "run",
    location: "pitch",
    equipment: ["Chrono"],
    tags: ["Intervalles", "Terrain"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 10-12 min footing + gammes",
      "Bloc: 2 x 8 x 30\" rapide / 30\" trot, 3 min rec entre séries",
      "Option: 4 x 60 m progressifs",
      "Retour au calme: 6-8 min footing léger",
    ],
    expectations: [
      "Qualité de foulée, pas de sprint max.",
      "RPE 7-8, gestion du rythme.",
    ],
  },
  {
    category: "PRÉVENTION",
    title: "PREV #1 — Ischios + adducteurs",
    intensity: "moderate",
    duration: "35-45 min",
    objective: "Prévention blessures clés du foot",
    focus: "strength",
    location: "home",
    equipment: ["Élastiques", "Tapis"],
    tags: ["Prévention", "Ischios", "Adducteurs"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 6-8 min mobilité hanches + activation fessiers",
      "Bloc 1 — Ischios: Nordic assisté 4 x 4 + ham walkout 3 x 6",
      "Bloc 2 — Adducteurs: Copenhagen 3 x 20\" / côté + squeeze 3 x 20\"",
      "Bloc 3 — Hinge léger: RDL 3 x 8 (tempo contrôlé)",
      "Retour au calme: 5 min mobilité adducteurs",
    ],
    expectations: [
      "Qualité d'exécution avant volume.",
      "Pas de douleur vive. Arrêter si gêne.",
    ],
  },
  {
    category: "PRÉVENTION",
    title: "PREV #2 — Chevilles + plan frontal",
    intensity: "easy",
    duration: "30-40 min",
    objective: "Stabilité appuis, genou et hanche",
    focus: "mobility",
    location: "home",
    equipment: ["Élastiques", "Tapis"],
    tags: ["Chevilles", "Genou", "Appuis"],
    level: "Amateur / semi-pro",
    detail: [
      "Échauffement: 6 min mobilité cheville + genou",
      "Bloc 1 — Chevilles: calf raise 3 x 12 + tib raise 3 x 15",
      "Bloc 2 — Plan frontal: side lunge 3 x 8 / côté + lateral band walk 3 x 12",
      "Bloc 3 — Équilibre: single-leg reach 3 x 6 / côté",
      "Retour au calme: 5 min mobilité",
    ],
    expectations: [
      "Amplitude contrôlée, tempo lent.",
      "Alignement genou-pied sur chaque rep.",
    ],
  },
  {
    category: "MOBILITÉ",
    title: "MOBILITÉ #1 — Hanches & chevilles de sprinteur",
    intensity: "easy",
    duration: "25-30 min",
    objective: "Appuis plus libres, genou stable, amplitude utile au sprint",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis", "Mini-bands"],
    tags: ["Hanches", "Chevilles", "Appuis"],
    level: "Amateur / semi-pro",
    detail: [
      "Respiration + reset: 2 min 90/90 breathing + cat-camel 8 reps",
      "Bloc 1 — Hanches: 90/90 switches 3 x 6 / cote + hip airplanes 2 x 5 / cote",
      "Bloc 2 — Adducteurs: rockback 3 x 8 + copenhagen short lever 3 x 15\"",
      "Bloc 3 — Chevilles: dorsiflexion murale 3 x 10 + tib raise 3 x 12",
      "Fin: 2 min squat hold + respiration lente",
    ],
    expectations: [
      "Tempo lent, controle avant amplitude.",
      "Aucune douleur vive. Stop si gene.",
      "Respiration nasale, relachement epaules.",
    ],
  },
  {
    category: "MOBILITÉ",
    title: "MOBILITÉ #2 — T-spine + epaules solides",
    intensity: "easy",
    duration: "20-25 min",
    objective: "Posture, epaules stables et rotation thoracique",
    focus: "mobility",
    location: "home",
    equipment: ["Elastiques", "Mur"],
    tags: ["Epaules", "Posture", "T-spine"],
    level: "Amateur / semi-pro",
    detail: [
      "Echauffement: 3 min rotations thoraciques + open book",
      "Bloc 1 — T-spine: open book 3 x 6 / cote + extensions sur serviette 3 x 8",
      "Bloc 2 — Scapula: wall slides 3 x 8 + scap push-up 3 x 10",
      "Bloc 3 — Rotateurs: band external rotation 3 x 12 + YTW 2 x 8",
      "Fin: doorway stretch 2 x 30\" + respiration 2 min",
    ],
    expectations: [
      "Amplitude propre, pas de pincement.",
      "Mains legeres, nuque longue.",
      "Rythme calme, pas de force.",
    ],
  },
  {
    category: "MOBILITÉ",
    title: "MOBILITÉ #3 — Flow pre-seance 18 min",
    intensity: "easy",
    duration: "15-20 min",
    objective: "Activer et lubrifier avant entrainement",
    focus: "mobility",
    location: "pitch",
    equipment: ["Tapis"],
    tags: ["Warm-up", "Flow", "Terrain"],
    level: "Tout niveau",
    detail: [
      "Flow 1: world greatest stretch 2 x 5 / cote",
      "Flow 2: leg swings 2 x 12 / jambe + ankle rocks 2 x 10",
      "Flow 3: squat to stand 2 x 8 + lunge rotation 2 x 6 / cote",
      "Flow 4: pogo hops 2 x 15 + A-march 2 x 15 m",
      "Fin: 2 lignes droites progressives",
    ],
    expectations: [
      "Objectif = readiness, pas fatigue.",
      "Respiration fluide, mouvement propre.",
    ],
  },
  {
    category: "MOBILITÉ",
    title: "MOBILITÉ #4 — Recovery active 25 min",
    intensity: "easy",
    duration: "20-25 min",
    objective: "Récupération douce sans perte de mobilité",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Recovery", "Mobilité", "Home"],
    level: "Tout niveau",
    detail: [
      "Respiration: 2 min 4-7-8",
      "Bloc 1 — Hanches: hip flexor stretch 2 x 30\" / côté",
      "Bloc 2 — T-spine: open book 2 x 6 / côté",
      "Bloc 3 — Ischios: hamstring floss 2 x 8 / côté",
      "Fin: relaxation 3 min",
    ],
    expectations: [
      "Rythme calme, zéro douleur.",
      "Sortir plus mobile qu'au départ.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 1: Reset hanches + chevilles",
    intensity: "easy",
    duration: "18-22 min",
    objective: "Redonner de la marge aux appuis des le jour 1",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Pack 7J", "Jour 1", "Hanches", "Chevilles"],
    level: "Amateur / semi-pro",
    detail: [
      "Respiration: 90/90 breathing 2 min",
      "Hanches: 90/90 switches 3 x 6 / cote",
      "Adducteurs: rockback 3 x 8",
      "Chevilles: dorsiflexion murale 3 x 10 + tib raise 2 x 12",
      "Fin: squat hold 2 x 30\"",
    ],
    expectations: [
      "Tempo lent, pas d'a-coups.",
      "Amplitude controlee, aucune douleur vive.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 2: T-spine + epaules",
    intensity: "easy",
    duration: "18-22 min",
    objective: "Posture haute pour duels et tirs",
    focus: "mobility",
    location: "home",
    equipment: ["Elastiques", "Mur"],
    tags: ["Pack 7J", "Jour 2", "Epaules", "T-spine"],
    level: "Amateur / semi-pro",
    detail: [
      "Open book 3 x 6 / cote",
      "Wall slides 3 x 8",
      "Scap push-up 3 x 10",
      "Band external rotation 3 x 12",
      "Doorway stretch 2 x 30\"",
    ],
    expectations: [
      "Pas de pincement, amplitude propre.",
      "Nuque longue, epaules basses.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 3: Ischios + chaine post",
    intensity: "easy",
    duration: "20-24 min",
    objective: "Libere la chaine post sans perdre de force",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Pack 7J", "Jour 3", "Ischios"],
    level: "Amateur / semi-pro",
    detail: [
      "Cat-camel 2 x 8",
      "Hip hinge drill 3 x 6",
      "Hamstring floss 3 x 8 / cote",
      "Couch stretch 2 x 30\" / cote",
      "Fin: posterior stretch 2 min",
    ],
    expectations: [
      "Pas de douleur, sensation d'allongement.",
      "Respiration lente, relachement.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 4: Adducteurs + plan frontal",
    intensity: "easy",
    duration: "18-22 min",
    objective: "Securiser les changements d'appui",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis", "Mini-bands"],
    tags: ["Pack 7J", "Jour 4", "Adducteurs"],
    level: "Amateur / semi-pro",
    detail: [
      "Copenhagen short lever 3 x 15\" / cote",
      "Side lunge 3 x 6 / cote",
      "Lateral band walk 2 x 12",
      "Single-leg reach 3 x 6 / cote",
      "Fin: adductor stretch 2 x 30\"",
    ],
    expectations: [
      "Alignement genou-pied.",
      "Controle lent, pas de rebond.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 5: Flow terrain express",
    intensity: "easy",
    duration: "15-20 min",
    objective: "Activation rapide avant seance ou match",
    focus: "mobility",
    location: "pitch",
    equipment: ["Tapis"],
    tags: ["Pack 7J", "Jour 5", "Flow", "Terrain"],
    level: "Tout niveau",
    detail: [
      "Leg swings 2 x 12 / jambe",
      "Squat to stand 2 x 8",
      "Lunge rotation 2 x 6 / cote",
      "Pogo hops 2 x 15",
      "2 lignes droites progressives",
    ],
    expectations: [
      "Objectif readiness, pas fatigue.",
      "Mouvement fluide, controle.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 6: Recuperation profonde",
    intensity: "easy",
    duration: "22-28 min",
    objective: "Relacher sans casser la nervosité",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Pack 7J", "Jour 6", "Recup"],
    level: "Tout niveau",
    detail: [
      "Respiration 4-7-8: 3 cycles",
      "Hip flexor stretch 2 x 40\" / cote",
      "Hamstring stretch 2 x 40\" / cote",
      "T-spine rotation 2 x 6 / cote",
      "Fin: relaxation 3 min",
    ],
    expectations: [
      "Aucune douleur, uniquement relachement.",
      "Sortir frais, pas endormi.",
    ],
  },
  {
    category: "MOBILITÉ 7 JOURS",
    title: "MOB 7J — Jour 7: Full reset + respiration",
    intensity: "easy",
    duration: "20-25 min",
    objective: "Faire le point avant un nouveau cycle",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Pack 7J", "Jour 7", "Reset"],
    level: "Tout niveau",
    detail: [
      "Cat-camel 2 x 8 + open book 2 x 6 / cote",
      "90/90 switches 2 x 6 / cote",
      "Ankle rocks 2 x 10 / cote",
      "Couch stretch 2 x 30\" / cote",
      "Respiration lente 3 min",
    ],
    expectations: [
      "Rythme calme, focus sur la respiration.",
      "Terminer plus mobile qu'au debut.",
    ],
  },
  {
    category: "MATCH DAY",
    title: "MATCH DAY-1 — Activation express",
    intensity: "easy",
    duration: "20-25 min",
    objective: "Réveiller le système sans fatigue",
    focus: "speed",
    location: "pitch",
    equipment: ["Cônes"],
    tags: ["Activation", "Match-1"],
    level: "Tout niveau",
    detail: [
      "Échauffement: 6-8 min footing + gammes",
      "Bloc: 4 x 20 m progressifs + 4 x 10 m accélérations",
      "Bloc technique: 5 min appuis rapides",
      "Retour au calme: 4 min trot léger",
    ],
    expectations: [
      "RPE 4-5 max.",
      "Sortir frais, pas fatigué.",
    ],
  },
  {
    category: "MATCH DAY",
    title: "MATCH DAY+1 — Regen + circulation",
    intensity: "easy",
    duration: "25-35 min",
    objective: "Récupérer des impacts du match",
    focus: "mobility",
    location: "home",
    equipment: ["Tapis"],
    tags: ["Regen", "Match+1"],
    level: "Tout niveau",
    detail: [
      "Bloc 1: 10 min mobilité douce (hanches, dos, chevilles)",
      "Bloc 2: 10-12 min cardio très léger (trot ou vélo)",
      "Bloc 3: 5 min respiration + étirements légers",
    ],
    expectations: [
      "RPE 2-3.",
      "Aucune douleur ou contrainte.",
    ],
  },
  {
    category: "HOME",
    title: "HOME #1 — Circuit sans matos",
    intensity: "moderate",
    duration: "30-35 min",
    objective: "Full body efficace, zéro matériel",
    focus: "circuit",
    location: "home",
    equipment: ["Poids du corps"],
    tags: ["Maison", "Circuit"],
    level: "Tout niveau",
    detail: [
      "Échauffement: 6-8 min mobilité + activation",
      "Circuit 1: 4 tours — 30\" squat, 30\" pompe, 30\" fente, 30\" gainage, 60\" rec",
      "Circuit 2: 3 tours — 20\" mountain climber, 20\" hollow hold, 20\" repos, 90\" rec",
      "Retour au calme: 5 min étirements",
    ],
    expectations: [
      "RPE 6-7, garder de la marge.",
      "Tempo contrôlé, qualité d'exécution.",
    ],
  },
];

const INTENSITY_LABEL: Record<string, string> = {
  easy: "Facile",
  moderate: "Modéré",
  hard: "Dur",
};

const INTENSITY_COLOR: Record<string, string> = {
  easy: palette.success,
  moderate: palette.accent,
  hard: palette.danger,
};

const LOCATION_LABEL: Record<string, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
};

const CATEGORY_ORDER = [
  "EXPLOSIVITÉ",
  "VITESSE",
  "FORCE",
  "PRÉPA",
  "ENDURANCE",
  "PRÉVENTION",
  "MOBILITÉ",
  "MOBILITÉ 7 JOURS",
  "MATCH DAY",
  "HOME",
];

const intensityRank: Record<Prebuilt["intensity"], number> = {
  hard: 0,
  moderate: 1,
  easy: 2,
};

const parseDurationMin = (raw?: string) => {
  if (!raw) return undefined;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return undefined;
  const values = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
  if (!values.length) return undefined;
  if (values.length === 1) return values[0];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg);
};

export default function PrebuiltSessionsScreen() {
  const sessions = useTrainingStore((s) => s.sessions);
  const pending = sessions.filter((s) => !s.completed);
  const nav = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");

  const grouped = useMemo(() => {
    const map: Record<string, Prebuilt[]> = {};
    for (const s of PREBUILT_SESSIONS) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return Object.entries(map)
      .map(([category, list]) => {
        const sorted = [...list].sort((a, b) => {
          const rankDiff = intensityRank[a.intensity] - intensityRank[b.intensity];
          if (rankDiff !== 0) return rankDiff;
          const durA = parseDurationMin(a.duration) ?? 0;
          const durB = parseDurationMin(b.duration) ?? 0;
          if (durA !== durB) return durA - durB;
          return a.title.localeCompare(b.title);
        });
        return [category, sorted] as const;
      })
      .sort((a, b) => {
        const idxA = CATEGORY_ORDER.indexOf(a[0]);
        const idxB = CATEGORY_ORDER.indexOf(b[0]);
        if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0]);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
  }, []);

  const categories = useMemo(() => {
    const fromSessions = grouped.map(([category, list]) => ({
      category,
      count: list.length,
    }));
    return [{ category: "Tous", count: PREBUILT_SESSIONS.length }, ...fromSessions];
  }, []);

  const pendingCount = pending.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroTitle}>Séances FKS</Text>
              <Text style={styles.heroSubtitle}>Bibliothèque opti par catégorie</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>Pré-construites</Text>
              <Text style={styles.heroBadgeValue}>
                {PREBUILT_SESSIONS.length}
              </Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>En attente</Text>
              <Text style={styles.heroStatValue}>{pendingCount}</Text>
              <Text style={styles.heroStatSub}>séance(s)</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Catégories</Text>
              <Text style={styles.heroStatValue}>{grouped.length}</Text>
              <Text style={styles.heroStatSub}>types de travail</Text>
            </View>
          </View>
        </View>

        {/* Pending sessions block */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Séances planifiées</Text>
            {pendingCount > 0 && (
              <View style={styles.sectionChip}>
                <Text style={styles.sectionChipText}>{pendingCount} en attente</Text>
              </View>
            )}
          </View>

          {pendingCount === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Aucune séance en attente. Tu peux lancer une séance FKS ou choisir un
                template ci-dessous.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {pending.map((s) => {
                const date = (s.dateISO ?? (s as any).date ?? "").slice(0, 10);
                const focus = s.focus ?? (s as any).modality ?? "—";
                const dur =
                  typeof s.durationMin === "number"
                    ? `${Math.round(s.durationMin)} min`
                    : typeof s.volumeScore === "number"
                    ? `${Math.round(s.volumeScore)} min`
                    : "—";

                return (
                  <View key={s.id} style={styles.pendingCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingTitle}>{focus}</Text>
                      <Text style={styles.pendingSub}>
                        {date} · {s.intensity ?? "—"} · {dur}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Library by category */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bibliothèque FKS</Text>
            <Text style={styles.sectionSubTitle}>Séances prêtes à l’emploi</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {categories.map((item) => {
              const active = selectedCategory === item.category;
              return (
                <TouchableOpacity
                  key={item.category}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(item.category)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {item.category}
                  </Text>
                  <View
                    style={[
                      styles.filterBadge,
                      active && styles.filterBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        active && styles.filterBadgeTextActive,
                      ]}
                    >
                      {item.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {grouped
            .filter(([category]) =>
              selectedCategory === "Tous" ? true : selectedCategory === category
            )
            .map(([category, list]) => (
            <View key={category} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{category}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{list.length} séances</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {list.map((s) => {
                  const intensityColor =
                    INTENSITY_COLOR[s.intensity] ?? palette.accent;

                  return (
                    <TouchableOpacity
                      key={s.title}
                      style={styles.prebuiltCard}
                      activeOpacity={0.9}
                      onPress={() =>
                        nav.navigate(
                          "PrebuiltSessionDetail" as never,
                          { session: s } as never
                        )
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardTitle}>{s.title}</Text>
                        </View>

                        <View style={styles.tagsRow}>
                          <View style={[styles.tag, { borderColor: intensityColor }]}>
                            <View
                              style={[
                                styles.tagDot,
                                { backgroundColor: intensityColor },
                              ]}
                            />
                            <Text style={styles.tagText}>
                              {INTENSITY_LABEL[s.intensity] ?? s.intensity}
                            </Text>
                          </View>
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>{s.duration}</Text>
                          </View>
                          {s.location ? (
                            <View style={styles.tag}>
                              <Text style={styles.tagText}>
                                {LOCATION_LABEL[s.location] ?? s.location}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.cardObjective} numberOfLines={2}>
                          {s.objective}
                        </Text>
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: palette.bg,
  },

  // HERO
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    backgroundColor: palette.card,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroBadgeLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: palette.sub,
  },
  heroBadgeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.accent,
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.text,
    marginTop: 2,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
    marginHorizontal: 16,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: palette.sub,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  filterChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  filterChipText: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: palette.accent,
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  filterBadgeActive: {
    borderColor: palette.accent,
    backgroundColor: palette.card,
  },
  filterBadgeText: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "700",
  },
  filterBadgeTextActive: {
    color: palette.accent,
  },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  sectionChipText: {
    fontSize: 11,
    color: palette.sub,
  },

  // Pending
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.bgSoft,
  },
  emptyText: {
    fontSize: 12,
    color: palette.sub,
  },
  pendingCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.cardSoft,
    flexDirection: "row",
    alignItems: "center",
  },
  pendingTitle: {
    color: palette.text,
    fontWeight: "600",
    fontSize: 14,
  },
  pendingSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },

  // Categories
  categoryBlock: {
    marginTop: 8,
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: palette.sub,
  },

  // Prebuilt cards
  prebuiltCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    backgroundColor: palette.cardSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },
  tagText: {
    fontSize: 11,
    color: palette.sub,
  },
  cardObjective: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 6,
  },

  arrow: {
    fontSize: 20,
    color: palette.sub,
    marginLeft: 8,
  },
});
