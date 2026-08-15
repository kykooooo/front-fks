// screens/coach/CoachAccessUnconfirmedScreen.tsx
//
// L'ECRAN DU « JE NE SAIS PAS ».
//
// Il s'affiche dans un seul cas : l'autorite coach a ete CONFIRMEE au moins une
// fois pour ce compte et ce club, puis elle est devenue INVERIFIABLE (lecture en
// echec, ou revalidation qui n'aboutit pas). L'espace coach est ferme et les
// donnees ont ete effacees de l'appareil — cet ecran le dit, plutot que de
// laisser un coach devant une application qui a l'air en panne.
//
// ─── POURQUOI PAS SIMPLEMENT L'ESPACE JOUEUR ────────────────────────────────
// Parce que ce serait deux mensonges en un. Le premier : un coach reverse sans
// un mot dans une application de joueur croit a un bug (ou pire, se croit
// retire du club). Le second, plus grave pour un compte purement encadrant : son
// profil joueur n'est pas rempli, il atterrirait sur le questionnaire de
// creation de profil — l'application lui demanderait son poste et son pied fort
// parce qu'elle n'a pas reussi a lire un document.
//
// Un joueur, lui, ne voit JAMAIS cet ecran : sans autorite coach confirmee, une
// lecture en echec le laisse dans son application, qui sait deja vivre hors
// ligne. C'est la seule chose que la memoire « deja confirmee » sert a decider —
// entre deux etats DEJA FERMES. Elle n'ouvre rien.
//
// ─── DEUX HIERARCHIES QU'ON NE MELANGE PAS ──────────────────────────────────
// Les ecrans coach portent une hierarchie de statut a quatre niveaux qui parle
// des JOUEURS (a verifier / a surveiller / ok / inconnu). Celle-ci parle de
// l'ACCES : ce n'est pas le meme sujet, et il n'y a aucune raison de creer un
// cinquieme niveau pour l'exprimer. On emploie donc le ton NEUTRE (`unknown`),
// qui est deja celui de « on ne sait pas » — et surtout on n'emprunte pas la
// couleur d'alerte d'un signal joueur pour dire quelque chose qui ne concerne
// aucun joueur.

import React from "react";

import { CoachScreen } from "../../components/coach/CoachScreen";
import { CoachStateBlock } from "../../components/coach/CoachStateBlock";
import { COACH_ACCESS_UNCONFIRMED_COPY } from "../../domain/coachAuthority";

type Props = {
  /** Repose l'abonnement a l'appartenance et repasse par `chargement`. */
  onRetry: () => void;
};

export default function CoachAccessUnconfirmedScreen({ onRetry }: Props) {
  return (
    <CoachScreen testID="coach-access-unconfirmed">
      {/* Icone NEUTRE, volontairement. Un nuage barre affirmerait « pas de
          reseau » aussi surement qu'une phrase — or la cause reelle peut aussi
          etre un droit retire, et l'application ne sait pas laquelle des deux
          elle vit (meme raisonnement que components/coach/CoachErrorState). */}
      <CoachStateBlock
        icon="help-circle-outline"
        title={COACH_ACCESS_UNCONFIRMED_COPY.titre}
        body={COACH_ACCESS_UNCONFIRMED_COPY.corps}
        level="unknown"
        action={{
          label: COACH_ACCESS_UNCONFIRMED_COPY.action,
          onPress: onRetry,
          accessibilityHint: "Relance la vérification de tes accès au club",
        }}
      />
    </CoachScreen>
  );
}
