// hooks/coach/useCoachLandingTab.ts
//
// LA LECTURE QUI DÉCIDE DE L'ONGLET D'ATTERRISSAGE COACH.
//
// Il n'y a ici NI règle, NI compteur : la règle est dans
// `domain/coachView/landing.ts`, et l'effectif vient de `useCoachRoster` —
// exactement la même source de vérité que les trois écrans coach. Ce hook ne
// fait que brancher l'une sur l'autre, et ajouter un délai de garde.
//
// ─── LA MÉMOIRE LOCALE PASSE AVANT LE RÉSEAU (contre-vérification 07/09) ────
// Décider demandait jusque-là une lecture d'effectif : une requête sur les
// membres PLUS une par joueur. Sur 25 joueurs, 26 lectures — et pendant tout ce
// temps, un squelette à la place de la barre d'onglets, pour TOUS les coachs, y
// compris ceux dont le club est plein et qui atterrissaient de toute façon sur
// l'onglet historique. C'était échanger un défaut d'affichage contre un défaut
// de latence, et le second frappait le cas majoritaire.
//
// Donc : si la dernière taille d'effectif connue POUR CE CLUB est mémorisée
// (services/memoireEffectifCoach, écrite par `useCoachRoster` à chaque lecture
// aboutie), on tranche avec elle, et on ne demande PAS l'effectif du tout —
// `useCoachRoster(null)` ne lit rien. Seule la toute première ouverture attend
// encore le réseau.
//
// LE DÉLAI DE GARDE, RAMENÉ DE 8 s À 3 s. Il ne couvre plus que cette première
// ouverture : une seule, jamais répétée, et suivie d'un écran qui fonctionne.
// Huit secondes de squelette avant la moindre barre d'onglets étaient un écran
// mort ; trois secondes, c'est une attente qu'on peut regarder.

import { useEffect, useState } from "react";

import { useCoachClub } from "./useCoachClub";
import { useCoachRoster } from "./useCoachRoster";
import { auth } from "../../services/firebase";
import { lireEffectifMemorise } from "../../services/memoireEffectifCoach";
import { chooseCoachLandingTab, type CoachLandingTab } from "../../domain/coachView/landing";

/**
 * Au-delà de ce délai, on n'attend plus la réponse de l'effectif et on ouvre
 * l'espace sur l'onglet historique.
 *
 * Il ne s'applique QU'À la première ouverture d'un club (ensuite la mémoire
 * locale tranche immédiatement), ce qui permet de le tenir court : au-delà de
 * trois secondes, un coach devant un squelette croit que l'app est bloquée.
 */
export const COACH_LANDING_TIMEOUT_MS = 3000;

export type UseCoachLandingTabOptions = {
  /** Délai de garde. Injectable pour les tests. */
  timeoutMs?: number;
};

/** Ce que la mémoire locale a répondu, et pour quel couple compte + club. */
type MemoireLue = { cle: string; taille: number | null };

const cleMemoire = (uid: string | null, clubId: string | null): string | null =>
  uid && clubId ? `${uid} ${clubId}` : null;

/**
 * Taille d'effectif mémorisée pour le compte courant et ce club :
 *  - `"en-attente"` : le disque n'a pas encore répondu (ou il n'y a pas encore
 *    de club à interroger) — on ne conclut rien, et on ne lit rien non plus ;
 *  - `number`       : on sait, sans réseau ;
 *  - `null`         : rien de mémorisé pour ce couple. Il faut lire l'effectif.
 *
 * DÉRIVATION PENDANT LE RENDU, comme `useAppSpacePreference` : tant que ce qu'on
 * détient ne parle pas du couple courant, la réponse est « en attente » — jamais
 * la valeur d'avant. C'est ce qui rend impossible d'appliquer à un club la
 * mémoire d'un autre.
 */
function useEffectifMemorise(clubId: string | null): number | null | "en-attente" {
  const uid = auth.currentUser?.uid ?? null;
  const [lu, setLu] = useState<MemoireLue | null>(null);
  const cle = cleMemoire(uid, clubId);

  useEffect(() => {
    const cleCourante = cleMemoire(uid, clubId);
    if (!cleCourante) return undefined;
    let annule = false;
    void (async () => {
      // `lireEffectifMemorise` ne lève jamais : une panne de stockage vaut
      // « rien de mémorisé », donc on retombe sur la lecture réseau.
      const taille = await lireEffectifMemorise(uid, clubId);
      if (!annule) setLu({ cle: cleCourante, taille });
    })();
    return () => {
      annule = true;
    };
  }, [uid, clubId]);

  if (cle === null) return "en-attente";
  return lu?.cle === cle ? lu.taille : "en-attente";
}

/**
 * Onglet sur lequel ouvrir l'espace coach, ou `null` tant qu'on ne sait pas.
 *
 * `null` veut dire ATTENDS, jamais « prends le défaut » : l'appelant doit rendre
 * un squelette. C'est ce qui évite le clignotement « Aujourd'hui → Semaine ».
 */
export function useCoachLandingTab(options?: UseCoachLandingTabOptions): CoachLandingTab | null {
  const club = useCoachClub();
  const memoire = useEffectifMemorise(club.clubId);

  // LA SEULE CONDITION QUI DÉCLENCHE UNE LECTURE D'EFFECTIF : la mémoire a
  // répondu, et elle ne sait rien. Tant qu'elle n'a pas répondu (`en-attente`)
  // ou qu'elle sait (`number`), on passe `null` — et `useCoachRoster` n'émet
  // alors AUCUNE requête, ni au montage ni au focus.
  const besoinDeLireEffectif = memoire === null;
  const roster = useCoachRoster(besoinDeLireEffectif ? club.clubId : null);

  const timeoutMs = options?.timeoutMs ?? COACH_LANDING_TIMEOUT_MS;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // `setTimedOut` part d'un `setTimeout`, pas du corps de l'effet : aucun
    // rendu en cascade au montage.
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  return chooseCoachLandingTab({
    clubStatus: club.status,
    rosterStatus: roster.status,
    // La preuve qu'une lecture d'effectif a abouti POUR CE CLUB. Voir le
    // commentaire de `CoachLandingInput.rosterAnswered` : sans elle, la fenêtre
    // de rendu pendant laquelle le club est résolu mais l'effectif pas encore
    // demandé se lirait comme « club vide ».
    rosterAnswered: roster.fetchedAt !== null,
    memberCount: roster.memberCount,
    tailleEffectifMemorisee: typeof memoire === "number" ? memoire : null,
    timedOut,
  });
}
