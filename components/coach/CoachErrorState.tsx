// components/coach/CoachErrorState.tsx
//
// États d'erreur de l'espace coach.
//
// RÈGLE : une erreur explique CE QUI N'A PAS MARCHÉ, propose UNE action, et
// s'arrête là. Ni code technique, ni "Une erreur est survenue" — cette phrase-là
// ne dit rien et laisse le coach penser qu'il a fait une bêtise.
//
// CE QUI A ÉTÉ RETIRÉ ICI, ET POURQUOI (retour terrain).
// L'ancienne copie « réseau » disait : « Vérifiez votre connexion, puis
// réessayez : rien n'est perdu, les données sont conservées côté serveur. »
// Deux affirmations que l'app ne peut PAS prouver :
//   - la cause. Un échec de lecture peut venir du réseau, du serveur, ou d'un
//     droit retiré sur le club. Envoyer le coach vérifier son wifi quand c'est
//     son accès qui a sauté, c'est le faire chercher au mauvais endroit.
//   - la garantie. « Les données sont conservées côté serveur » est une promesse
//     sur un système qu'on n'a justement pas réussi à joindre. Rien ne l'établit
//     au moment où la phrase s'affiche.
// La copie suit donc partout la même structure : CONSTAT (ce qui n'a pas pu être
// chargé) → ACTION (réessayer) → HYPOTHÈSE AU CONDITIONNEL (« devra peut-être
// être vérifié »). Une hypothèse annoncée comme telle ne trompe personne ; une
// cause affirmée à tort, si.
//
// La distinction avec `CoachEmptyState` est structurante :
//   - vide  = il n'y a rien à montrer, et c'est normal ;
//   - erreur = il y a peut-être quelque chose, on n'a pas réussi à le lire.
// Les confondre revient à mentir au coach dans un sens ou dans l'autre.
//
// Composant purement présentationnel.

import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";

import { CoachStateBlock, type CoachStateAction } from "./CoachStateBlock";
import type { CoachIconName, CoachStatusLevel } from "./coachTheme";

export const COACH_ERROR_VARIANTS = [
  "accessDenied", // droits insuffisants sur la projection du club
  "network", // pas de réseau / serveur injoignable
  "unexpected", // tout le reste : on ne prétend pas savoir
] as const;
export type CoachErrorVariant = (typeof COACH_ERROR_VARIANTS)[number];

/**
 * CE QUI n'a pas pu être chargé. Le constat doit nommer l'objet réel, sinon le
 * coach ne sait pas si c'est toute son application ou une seule fiche qui est
 * hors service. Défaut volontairement neutre (« les données ») : un écran qui
 * n'a rien précisé n'affirme rien de plus qu'il ne sait.
 */
export const COACH_ERROR_SUBJECTS = ["donnees", "effectif", "fiche", "club", "semaine"] as const;
export type CoachErrorSubject = (typeof COACH_ERROR_SUBJECTS)[number];

const SUBJECT_CONSTAT: Record<CoachErrorSubject, string> = {
  donnees: "Impossible de charger les données.",
  effectif: "Impossible de charger l'effectif.",
  fiche: "Impossible de charger la fiche du joueur.",
  club: "Impossible de charger les informations du club.",
  semaine: "Impossible de charger la semaine du club.",
};

/**
 * ACTION puis HYPOTHÈSE. Le conditionnel n'est pas une précaution de style :
 * c'est ce qui distingue « voilà ce que c'est » de « voilà ce que ça pourrait
 * être », et l'app ne sait pas laquelle des deux causes s'applique.
 */
const RETRY_ET_HYPOTHESE =
  "Réessaie. Si le problème persiste, ton accès au club devra peut-être être vérifié.";

type ErrorCopy = {
  icon: CoachIconName;
  title: string;
  /** Corps FIXE des variantes qui n'ont pas à nommer d'objet (accès refusé). */
  body?: string;
  level: CoachStatusLevel;
  actionLabel: string;
};

const ERROR_COPY: Record<CoachErrorVariant, ErrorCopy> = {
  // Seule variante où la cause est RÉELLEMENT connue (l'appelant ne l'emploie
  // que sur un refus explicite) : elle peut donc la nommer. Elle reste au
  // conditionnel sur la suite à donner, parce que « qui est l'entraîneur de ce
  // club » n'est pas une information que cet écran possède.
  accessDenied: {
    icon: "lock-closed-outline",
    title: "Accès non autorisé",
    body:
      "Cet espace n'a pas pu être ouvert avec ton compte. Reconnecte-toi ; si le problème persiste, ton rattachement au club devra peut-être être vérifié.",
    level: "check",
    actionLabel: "Se reconnecter",
  },
  // `network` et `unexpected` produisent VOLONTAIREMENT la même copie, et c'est
  // la conséquence directe du retour ci-dessus : les hooks coach ne remontent
  // aucun code d'erreur, l'app ne SAIT donc pas laquelle des deux situations
  // elle vit. Deux textes différents laisseraient croire à un diagnostic qui
  // n'existe pas. L'icône a suivi : un nuage barré affirme « pas de réseau »
  // aussi sûrement qu'une phrase, or c'est précisément ce qu'on ne peut pas
  // prouver. Le jour où une erreur typée remontera, les deux copies pourront
  // diverger — sur une preuve, pas sur une intuition d'appelant.
  network: {
    icon: "alert-circle-outline",
    title: "Chargement impossible",
    level: "watch",
    actionLabel: "Réessayer",
  },
  unexpected: {
    icon: "alert-circle-outline",
    title: "Chargement impossible",
    level: "watch",
    actionLabel: "Réessayer",
  },
};

type CoachErrorStateProps = {
  variant: CoachErrorVariant;
  /**
   * Objet réellement concerné par l'échec. Sert à écrire le constat d'ouverture
   * (« Impossible de charger l'effectif. ») ; la suite du message est identique
   * partout, c'est la structure qui compte.
   */
  subject?: CoachErrorSubject;
  /** Action de sortie. Le libellé par défaut de la variante s'applique. */
  action?: (Omit<CoachStateAction, "label"> & { label?: string }) | null;
  /**
   * Précision discrète, non technique, destinée au support
   * (ex. "Dernière mise à jour affichée : hier 18:40").
   */
  footnote?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CoachErrorState({
  variant,
  subject = "donnees",
  action,
  footnote,
  style,
  testID,
}: CoachErrorStateProps) {
  const copy = ERROR_COPY[variant] ?? ERROR_COPY.unexpected;
  const label = action?.label ?? copy.actionLabel;
  const constat = SUBJECT_CONSTAT[subject] ?? SUBJECT_CONSTAT.donnees;
  const body = copy.body ?? `${constat} ${RETRY_ET_HYPOTHESE}`;

  return (
    <CoachStateBlock
      icon={copy.icon}
      title={copy.title}
      body={body}
      level={copy.level}
      action={action ? { ...action, label } : null}
      footnote={footnote}
      style={style}
      testID={testID}
    />
  );
}
