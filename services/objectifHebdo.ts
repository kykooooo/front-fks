// services/objectifHebdo.ts
// =============================================================================
// L'OBJECTIF HEBDO — UN SEUL CHAMP, UN SEUL ENDROIT QUI L'ECRIT
// =============================================================================
//
// LE DEFAUT QUE CE FICHIER FERME
// -----------------------------------------------------------------------------
// L'app portait DEUX objectifs hebdomadaires :
//
//   . `users/{uid}.targetFksSessionsPerWeek` — le rythme que le joueur declare
//     au setup profil, champ OBLIGATOIRE (le setup refuse de valider sans lui),
//     synchronise dans `useExternalStore` par le watcher Firestore ;
//   . `useSettingsStore.weeklyGoal` — un reglage local, jamais synchronise,
//     que le curseur des Reglages modifiait.
//
// Tant que l'accueil lisait `weeklyGoal`, le curseur marchait. Depuis que le
// resume canonique resout l'objectif (`resoudreObjectifHebdo`) en essayant
// `targetFksSessionsPerWeek` EN PREMIER, le curseur des Reglages etait devenu un
// bouton mort pour tout joueur ayant fait son setup — c'est-a-dire pour tous :
// il bougeait, le compteur de l'accueil ne bougeait pas.
//
// LA DECISION
// -----------------------------------------------------------------------------
// « Une info = un endroit = une verite. » Le champ canonique est
// `targetFksSessionsPerWeek`, et c'est LUI que les Reglages editent desormais —
// lecture ET ecriture, persistance Firestore comprise, exactement comme le fait
// le setup profil. `weeklyGoal` devient un repli DEPRECIE : plus personne ne
// l'ecrit, il ne sert qu'aux comptes anciens qui n'ont jamais porte le champ
// canonique, et uniquement a travers `resoudreObjectifHebdo`.
//
// POURQUOI UN SERVICE ET PAS TROIS LIGNES DANS L'ECRAN
// -----------------------------------------------------------------------------
// Parce que l'ecriture a trois effets qui doivent rester ensemble : le store
// local (pour que l'ecran reponde tout de suite), Firestore (pour que la valeur
// survive et se propage aux autres appareils), et le retour arriere si la base
// refuse. Eparpilles dans un `onChange`, ces trois-la se desynchronisent au
// premier ecran qui voudra editer la meme chose.
// =============================================================================

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import { useExternalStore } from "../state/stores/useExternalStore";

/** Bornes du reglage. Identiques a celles que le setup profil propose. */
export const OBJECTIF_HEBDO_MIN = 1;
export const OBJECTIF_HEBDO_MAX = 6;

/**
 * Issue de l'enregistrement, pour que l'appelant sache quoi dire au joueur :
 *   . "enregistre"    — ecrit dans Firestore, donc conserve ;
 *   . "hors-ligne"    — pose localement, la base n'a pas repondu. La valeur
 *                       reste affichee : le watcher la reecrira a la synchro
 *                       suivante si elle differe ;
 *   . "refuse"        — la base a refuse. L'ancienne valeur est RETABLIE, pour
 *                       que l'ecran ne montre pas un objectif qui n'existe pas.
 */
export type IssueObjectifHebdo = "enregistre" | "hors-ligne" | "refuse";

/** Ramene une saisie dans les bornes. Un objectif de zero seance n'existe pas. */
export function normaliserObjectifHebdo(valeur: number): number {
  if (!Number.isFinite(valeur)) return OBJECTIF_HEBDO_MIN;
  return Math.max(OBJECTIF_HEBDO_MIN, Math.min(OBJECTIF_HEBDO_MAX, Math.round(valeur)));
}

/**
 * Ecrit l'objectif hebdo du joueur — le champ canonique, et lui seul.
 *
 * L'ecriture Firestore est un `merge` qui ne touche QUE deux clefs. Les regles
 * de securite (`firestore.rules`, `userMutableFields`) jugent les clefs
 * reellement affectees : `targetFksSessionsPerWeek` et `updatedAt` y figurent
 * toutes les deux, cette ecriture passe donc sans elargir la surface autorisee.
 */
export async function enregistrerObjectifHebdo(valeur: number): Promise<IssueObjectifHebdo> {
  const normalise = normaliserObjectifHebdo(valeur);
  const precedent = useExternalStore.getState().targetFksSessionsPerWeek;

  // Optimiste : l'ecran doit repondre au doigt, pas a la latence du reseau.
  useExternalStore.setState({ targetFksSessionsPerWeek: normalise });

  const utilisateur = auth.currentUser;
  if (!utilisateur) {
    // Aucun compte resolu : rien a persister, et surtout rien a annuler — la
    // valeur locale reste juste tant que la session n'est pas etablie.
    return "hors-ligne";
  }

  try {
    await setDoc(
      doc(db, "users", utilisateur.uid),
      { targetFksSessionsPerWeek: normalise, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return "enregistre";
  } catch (err) {
    const code =
      err != null && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";

    // Coupure reseau : Firestore garde l'ecriture en attente et la rejouera. On
    // ne remet PAS l'ancienne valeur, sinon le joueur verrait son reglage sauter
    // tout seul alors qu'il finira bien par partir.
    if (code === "unavailable" || code === "deadline-exceeded") return "hors-ligne";

    // Refus franc (permission, valeur invalide) : retour arriere, parce qu'un
    // ecran ne doit jamais afficher un reglage que la base n'a pas accepte.
    useExternalStore.setState({ targetFksSessionsPerWeek: precedent });
    return "refuse";
  }
}
