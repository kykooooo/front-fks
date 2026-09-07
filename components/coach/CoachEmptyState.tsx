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

// UNE VARIANTE = UN ÉCRAN QUI LA REND. Il n'y a pas de « copie de réserve »
// ici : une variante que personne n'affiche n'est pas relue, personne ne la
// corrige, et elle finit par promettre un bouton qui n'existe plus nulle part.
// C'est ce qui était arrivé à `firstLogin` (elle proposait « Générer un code
// d'invitation ») et à `noRecentData` (« Voir tout l'historique ») : deux
// variantes que seul le test de couverture rendait encore. Un test de ce
// fichier vérifie désormais que chaque variante est bien citée par un écran.
export const COACH_EMPTY_VARIANTS = [
  "accountWithoutClub", // le compte connecté n'est rattaché à aucun club
  "clubWithoutPlayers", // personne n'a rejoint l'effectif — écran QUI PORTE le code
  "clubWithoutPlayersElsewhere", // idem, mais le code se génère sur un AUTRE écran
  "playerWithoutSession", // joueur inscrit, aucune séance terminée
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
  // ── LE COMPTE N'A PAS DE CLUB ───────────────────────────────────────────────
  //
  // POURQUOI UNE VARIANTE, ALORS QUE LES TROIS ÉCRANS COMPOSAIENT DÉJÀ LE BLOC.
  // Ils le composaient chacun à sa façon, et les trois phrases avaient divergé :
  //   . Aujourd'hui : « Crée ton club pour ouvrir ton espace, ou contacte FKS… »
  //   . Semaine     : « Crée ton club, ou demande à FKS de te rattacher au tien… »
  //   . Effectif    : « Déconnecte-toi puis choisis « Tu es coach ? »… »
  // Les deux premières décrivent une création de club QUI N'EXISTE PAS depuis
  // l'espace coach : `CoachOnboarding`, le seul écran qui crée un club, vit dans
  // la pile JOUEUR et aucune route de `CoachStackParamList` ne l'atteint. La
  // troisième décrit le chemin réel, et elle est testée ailleurs
  // (navigation/__tests__/coachEntryIntent.test.tsx). C'est donc elle qu'on garde,
  // à un seul endroit — trois copies d'une même phrase, c'est trois occasions
  // qu'une seule dérive.
  //
  // CET ÉTAT EST QUASI INATTEIGNABLE, ET C'EST VOULU. `useAppSpace` n'ouvre
  // l'espace coach qu'à partir d'une appartenance `clubs/{clubId}/members/{uid}` :
  // un coach sans `clubId` est envoyé côté joueur, il n'arrive jamais ici. Il
  // reste une fenêtre de course (le pointeur disparaît pendant la session) et un
  // RÉSIDU : un `clubId` qui désigne un club supprimé, dont l'appartenance
  // orpheline continue d'ouvrir l'espace. Ce résidu n'a AUCUN chemin de sortie
  // propre à ce jour — la phrase ci-dessous est ce qu'on sait dire de mieux, et
  // elle ne promet rien qu'on ne puisse tenir.
  accountWithoutClub: {
    icon: "people-circle-outline",
    title: "Aucun club rattaché",
    body:
      "Ton compte n'est rattaché à aucun club. Déconnecte-toi puis choisis « Tu es coach ? » à la connexion pour en créer un.",
    level: "unknown",
  },
  // NB : le libellé d'action ne dit plus « partager le code », mais
  // « générer » — un code n'existe plus tant que le coach ne l'a pas demandé,
  // et il n'est affiché qu'à ce moment-là.
  clubWithoutPlayers: {
    icon: "people-outline",
    title: "Aucun joueur dans l'effectif",
    body:
      "Personne n'a encore rejoint le club. Génère un code d'invitation, partage-le, et l'effectif se remplit au fur et à mesure des inscriptions.",
    level: "unknown",
    actionLabel: "Générer un code d'invitation",
  },
  // MÊME VIDE, AUTRE ÉCRAN — et donc autre phrase.
  //
  // `clubWithoutPlayers` est écrit pour l'écran Semaine, le seul qui porte le
  // bouton d'émission : son « Générez un code d'invitation » y désigne un bouton
  // qui est là, sous les yeux du coach. Recopié ailleurs, le même impératif
  // devient une consigne sans objet — le coach cherche un bouton qui n'existe
  // pas sur cet écran.
  //
  // Cette variante dit donc la même chose au mode DESCRIPTIF, et nomme l'endroit
  // où le code se génère. Elle ne promet aucune émission : son action ne fait
  // qu'ouvrir l'onglet Semaine, un déplacement qui ne peut pas échouer.
  clubWithoutPlayersElsewhere: {
    icon: "people-outline",
    title: "Aucun joueur pour l'instant",
    body:
      "Personne n'a encore rejoint le club. Chaque joueur y entre avec ton code d'invitation, qui se génère dans l'onglet Semaine.",
    level: "unknown",
    actionLabel: "Ouvrir l'onglet Semaine",
  },
  playerWithoutSession: {
    icon: "calendar-outline",
    title: "Aucune séance pour l'instant",
    body:
      "Ce joueur a rejoint le club mais n'a pas encore terminé de séance FKS. Il n'y a donc rien à lire : ce n'est pas un problème technique.",
    level: "unknown",
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
  // AUCUN REPLI SILENCIEUX. L'ancien `?? EMPTY_COPY.noRecentData` désignait une
  // variante qui n'existe plus, et surtout il rendait la PHRASE D'UN AUTRE VIDE
  // en cas de variante inconnue — un texte faux vaut moins qu'une erreur visible
  // au développeur. `CoachEmptyVariant` est une union fermée, et les quatre
  // écrans qui montent ce composant passent tous un littéral : le compilateur
  // couvre entièrement le cas.
  const copy = EMPTY_COPY[variant];
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
