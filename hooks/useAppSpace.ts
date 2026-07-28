// hooks/useAppSpace.ts
//
// L'ESPACE AFFICHÉ, EN TEMPS RÉEL, DÉRIVÉ DE L'AUTORITÉ SERVEUR.
//
// Ce hook ne décide de rien : il ABONNE l'application à sa propre appartenance
// au club (`clubs/{clubId}/members/{uid}`) et passe ce qu'il lit à la dérivation
// pure (`domain/appSpace.resolveAppSpace`).
//
// ─── POURQUOI UN ABONNEMENT, ET PAS UNE LECTURE PONCTUELLE ──────────────────
// L'exigence est « aucune reconnexion manuelle ». Le dépôt s'appuie déjà sur des
// abonnements temps réel (`onSnapshot` sur `users/{uid}` dans RootNavigator,
// `startFirestoreWatch` dans le store) : un abonnement de plus sur UN document
// suit exactement le même modèle, et il donne les trois propriétés demandées
// sans une ligne de code spécial :
//
//  . BASCULE IMMÉDIATE. Quand le transfert de propriété écrit `role: "owner"`
//    sur l'appartenance du successeur, l'instantané arrive sur son téléphone et
//    l'espace change. Aucun bouton, aucune reconnexion, aucun redémarrage.
//  . REDÉMARRAGE À FROID. Il n'y a rien à restaurer : l'abonnement se repose au
//    démarrage et relit la même source. L'espace ne dépend d'aucun cache que
//    l'application aurait écrit elle-même — donc d'aucun cache qu'on pourrait
//    falsifier ou oublier d'invalider.
//  . RETRAIT ET RÉTROGRADATION. Le même chemin ferme l'espace coach quand
//    l'appartenance devient une pierre tombale ou disparaît.
//
// Alternative écartée, et pourquoi : forcer un rafraîchissement de jeton
// (`getIdToken(true)`) ne servirait à rien ici. Aucune revendication personnalisée
// ne porte le rôle — l'autorité vit dans des DOCUMENTS, pas dans le jeton. Un
// rafraîchissement de jeton relirait donc exactement la même chose, en plus lent.
//
// ─── CE QUE CE HOOK N'INTRODUIT PAS ─────────────────────────────────────────
// Aucune persistance locale de l'espace. Écrire « cet appareil est un espace
// coach » dans AsyncStorage créerait précisément la seconde source de vérité
// qu'on refuse : un cache client, falsifiable et désynchronisable. Le seul cache
// en jeu est celui du SDK Firestore, qui est déjà la source, servie hors ligne.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../services/firebase";
import {
  readMembershipRole,
  resolveAppSpace,
  type AppSpace,
  type AppSpaceDecision,
  type ClubMembershipReading,
} from "../domain/appSpace";
import type { ClubRole } from "../domain/clubRoles";

export type AppSpaceState = {
  /**
   * Ce que la navigation doit faire, `en-attente` compris. C'est la valeur à
   * consulter pour savoir s'il faut encore afficher l'écran de chargement.
   */
  decision: AppSpaceDecision;
  /**
   * L'espace à afficher une fois la décision prise. Vaut `"player"` tant que la
   * décision est `en-attente` : ne l'utilise JAMAIS sans avoir testé `decision`,
   * sinon l'espace joueur clignote devant un coach au démarrage.
   */
  space: AppSpace;
  /** Rôle d'appartenance lu, ou `null`. Pour DIRE l'état, jamais pour ouvrir un droit. */
  membershipRole: ClubRole | null;
  /** La lecture de l'appartenance a échoué (incident, pas un refus attendu). */
  membershipUnreadable: boolean;
};

/**
 * @param uid    compte connecté, ou `null` (déconnecté : aucun abonnement).
 * @param clubId `users/{uid}.clubId`, ou `null`.
 *
 * SUR `clubId`, QUI EST ÉCRIVABLE PAR L'UTILISATEUR. Ce champ ne dit pas QUI
 * on est, il dit OÙ regarder. Le pointer ailleurs ne fabrique aucune
 * appartenance : on lirait `clubs/{autre}/members/{uid}`, qui n'existe pas, donc
 * espace joueur. Le falsifier ne peut que se retirer un accès à soi-même, jamais
 * en obtenir un. Ce qui DÉCIDE reste le rôle, et lui, aucun client ne l'écrit.
 */
export function useAppSpace(params: { uid: string | null; clubId: string | null }): AppSpaceState {
  const uid = params.uid;
  const clubId = params.clubId;

  // Clé de l'abonnement en cours. Elle sert à savoir, PENDANT LE RENDU, si
  // l'instantané que l'on détient décrit bien le couple (compte, club) courant.
  // Sans elle, un changement de compte afficherait une fraction de seconde
  // l'espace dérivé de l'appartenance du compte précédent.
  const cle = uid && clubId ? `${uid} ${clubId}` : null;

  // État MINIMAL : uniquement ce qui vient du serveur, et la clé qui dit de quoi
  // il parle. Tout le reste est dérivé pendant le rendu — donc aucun `setState`
  // au montage, et aucun rendu en cascade.
  const [recu, setRecu] = useState<{ cle: string; lecture: ClubMembershipReading } | null>(null);

  useEffect(() => {
    if (!cle || !uid || !clubId) return;
    // `annule` couvre la fenêtre entre le démontage et l'arrivée d'un instantané
    // déjà en vol : `unsubscribe()` coupe la source, il ne rembobine pas ce qui
    // a déjà été émis.
    let annule = false;
    const unsubscribe = onSnapshot(
      doc(db, "clubs", clubId, "members", uid),
      (snap) => {
        if (annule) return;
        setRecu({
          cle,
          lecture: { statut: "lu", role: snap.exists() ? snap.data()?.role : null },
        });
      },
      () => {
        // Échec de lecture. On ne DEVINE pas : `illisible` est un état nommé, et
        // la dérivation retombe sur l'espace joueur (default-deny). Firestore
        // démonte l'abonnement après une erreur ; il sera reposé au prochain
        // changement de compte/club ou au prochain démarrage.
        if (annule) return;
        setRecu({ cle, lecture: { statut: "illisible" } });
      },
    );
    return () => {
      annule = true;
      unsubscribe();
    };
  }, [cle, uid, clubId]);

  // Dérivation pendant le rendu, à partir de la seule information disponible.
  const lecture: ClubMembershipReading = !cle
    ? { statut: "aucun-club" }
    : recu?.cle === cle
      ? recu.lecture
      : { statut: "en-attente" };

  const decision = resolveAppSpace(lecture);
  return {
    decision,
    space: decision === "coach" ? "coach" : "player",
    membershipRole: readMembershipRole(lecture),
    membershipUnreadable: lecture.statut === "illisible",
  };
}
