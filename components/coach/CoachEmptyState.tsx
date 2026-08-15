// components/coach/CoachEmptyState.tsx
//
// États vides de l'espace coach.
//
// POURQUOI ces textes sont écrits ici et pas dans les écrans.
// Un écran vide ne doit JAMAIS donner l'impression que l'app est cassée. La
// différence entre "personne n'a encore rejoint le club" et "on n'arrive pas à
// lire les données" est capitale pour un entraîneur qui teste FKS pour la
// première fois : dans un cas il sait quoi faire, dans l'autre il désinstalle.
// En centralisant la copie, on garantit que chaque vide est nommé, expliqué, et
// qu'il propose la sortie utile — au lieu d'un "Aucune donnée" sec.
//
// Le vide n'est pas une erreur : le ton reste neutre ou positif, jamais alarmé.
// Les vraies erreurs (accès refusé, réseau) vivent dans `CoachErrorState`.
//
// Composant purement présentationnel.

import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";

import { CoachStateBlock, type CoachStateAction } from "./CoachStateBlock";
import type { CoachIconName, CoachStatusLevel } from "./coachTheme";

export const COACH_EMPTY_VARIANTS = [
  "firstLogin", // première connexion : le club existe, il est vide
  "clubWithoutPlayers", // personne n'a rejoint l'effectif
  "playerWithoutSession", // joueur inscrit, aucune séance terminée
  "noRecentData", // rien sur la période affichée (l'historique existe peut-être)
  "syncPending", // projections en cours de préparation côté serveur
  "accessRestricted", // le serveur n'autorise pas l'accès au suivi de ce joueur
] as const;
export type CoachEmptyVariant = (typeof COACH_EMPTY_VARIANTS)[number];

type EmptyCopy = {
  icon: CoachIconName;
  title: string;
  body: string;
  level: CoachStatusLevel;
  /** Libellé d'action par défaut ; l'écran fournit le `onPress`. */
  actionLabel?: string;
};

const EMPTY_COPY: Record<CoachEmptyVariant, EmptyCopy> = {
  // NB : le libellé d'action ne dit plus « partager le code », mais
  // « générer » — un code n'existe plus tant que le coach ne l'a pas demandé,
  // et il n'est affiché qu'à ce moment-là.
  firstLogin: {
    icon: "clipboard-outline",
    title: "Bienvenue dans ton espace",
    body:
      "Ton club est créé. Génère un code d'invitation et partage-le à tes joueurs : dès qu'ils rejoignent et terminent une séance, leur suivi apparaît ici.",
    level: "unknown",
    actionLabel: "Générer un code d'invitation",
  },
  clubWithoutPlayers: {
    icon: "people-outline",
    title: "Aucun joueur dans l'effectif",
    body:
      "Personne n'a encore rejoint le club. Générez un code d'invitation, partagez-le, et l'effectif se remplit au fur et à mesure des inscriptions.",
    level: "unknown",
    actionLabel: "Générer un code d'invitation",
  },
  playerWithoutSession: {
    icon: "calendar-outline",
    title: "Aucune séance pour l'instant",
    body:
      "Ce joueur a rejoint le club mais n'a pas encore terminé de séance FKS. Il n'y a donc rien à lire : ce n'est pas un problème technique.",
    level: "unknown",
  },
  noRecentData: {
    icon: "time-outline",
    title: "Rien de récent à afficher",
    body:
      "Aucune séance terminée sur la période affichée. Les séances plus anciennes restent visibles dans la fiche de chaque joueur.",
    level: "unknown",
    actionLabel: "Voir tout l'historique",
  },
  syncPending: {
    icon: "sync-outline",
    title: "Synchronisation en cours",
    body:
      "Les données de certains joueurs sont en cours de préparation. Elles apparaissent d'elles-mêmes dès qu'elles sont prêtes, sans rien faire de ton côté.",
    level: "watch",
    actionLabel: "Actualiser",
  },
  // Décision SERVEUR, pas un incident : le suivi de ce joueur n'est pas ouvert.
  // Trois choses que cette copie doit faire, et qu'elle fait :
  //  1. ne pas alarmer (niveau `unknown`, le neutre de la hiérarchie à 4 statuts,
  //     aucune 5e couleur inventée) ;
  //  2. ne JAMAIS laisser croire que le joueur ne s'entraîne pas — c'est
  //     l'affichage qui est fermé, pas l'entraînement ;
  //  3. rester dans un vocabulaire produit : aucune mention juridique, médicale,
  //     ni d'un tiers. Le coach n'a pas de bouton parce qu'il n'a rien à cliquer :
  //     l'état se pose côté serveur (cf. AUTORISATION_ACCES.md).
  accessRestricted: {
    icon: "lock-closed-outline",
    title: "Suivi non accessible",
    body:
      "Une étape reste à faire avant que le suivi de ce joueur soit consultable. Il fait partie de l'effectif et peut s'entraîner normalement : seul l'affichage de ses données est en attente.",
    level: "unknown",
  },
};

type CoachEmptyStateProps = {
  variant: CoachEmptyVariant;
  /**
   * Action proposée. Le libellé par défaut de la variante est utilisé si
   * `label` n'est pas fourni. Omettre entièrement `action` = pas de bouton
   * (cas d'un vide sur lequel le coach n'a rien à faire).
   */
  action?: (Omit<CoachStateAction, "label"> & { label?: string }) | null;
  /** Remplace le titre par défaut (ex. pour nommer le joueur concerné). */
  title?: string;
  /** Précision discrète sous le bloc. */
  footnote?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachEmptyState({
  variant,
  action,
  title,
  footnote,
  style,
  testID,
}: CoachEmptyStateProps) {
  const copy = EMPTY_COPY[variant] ?? EMPTY_COPY.noRecentData;
  const label = action?.label ?? copy.actionLabel;

  return (
    <CoachStateBlock
      icon={copy.icon}
      title={title ?? copy.title}
      body={copy.body}
      level={copy.level}
      action={action && label ? { ...action, label } : null}
      footnote={footnote}
      style={style}
      testID={testID}
    />
  );
}
