// hooks/useClubDirective.ts
//
// Lecture JOUEUR de la directive d'entraînement du club.
//
// POURQUOI CE HOOK EXISTE. Une directive influence la préparation du joueur.
// Elle doit donc lui être lisible — sinon on retombe exactement dans le défaut
// qu'on vient de corriger, mais dans l'autre sens : une consigne qui pèse sur
// ses séances sans qu'il puisse savoir laquelle. Ce hook est la contrepartie
// visible de la note privée : ce qui reste caché ne modifie rien, ce qui
// modifie quelque chose est montré.
//
// CE QU'IL NE LIT PAS. Ni la note privée (les règles Firestore la lui refusent,
// et rien ici ne la demande), ni les données d'un autre joueur. Deux documents
// au total : son propre profil, pour connaître son club, puis la directive à sa
// clé connue d'avance (`directives/current`).
//
// Lecture best-effort : un échec ne casse jamais un écran de séance. Rien à
// afficher, c'est tout — on n'invente pas de directive, et on n'affiche pas
// d'erreur pour une information d'appoint.

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../services/firebase";
import {
  CLUB_DIRECTIVES_COLLECTION,
  CLUB_DIRECTIVE_CURRENT_ID,
  clubDirectiveNotice,
  parseClubDirective,
  type ClubDirectiveNoticeCopy,
  type ClubTrainingDirective,
} from "../domain/clubDirective";
import { toDateKey } from "../utils/dateHelpers";

export type UseClubDirectiveState = {
  directive: ClubTrainingDirective | null;
  /** Rendu prêt à afficher, ou `null` si la directive ne s'applique pas ce jour. */
  notice: ClubDirectiveNoticeCopy | null;
  isLoading: boolean;
};

export type UseClubDirectiveOptions = {
  /** Horloge injectable (tests / horloge virtuelle dev). */
  now?: () => number;
  /**
   * Club déjà connu de l'appelant. Fourni, il évite la lecture du profil ;
   * absent, le hook résout le club depuis `users/{uid}` comme le fait déjà la
   * construction du contexte IA.
   */
  clubId?: string | null;
};

export function useClubDirective(options?: UseClubDirectiveOptions): UseClubDirectiveState {
  const [directive, setDirective] = useState<ClubTrainingDirective | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Jour de référence figé HORS RENDU. Lire l'horloge pendant le rendu rendrait
  // celui-ci non idempotent, et une directive expirant à minuit disparaîtrait
  // au milieu d'un re-rendu sans qu'aucun état n'ait bougé.
  const [todayKey, setTodayKey] = useState<string>(() =>
    toDateKey(new Date((options?.now ?? Date.now)())),
  );

  // Même motif que useCoachClub : l'horloge est gardée dans une ref pour qu'un
  // appelant passant un littéral ne relance pas la lecture à chaque rendu.
  const nowRef = useRef<() => number>(options?.now ?? Date.now);
  useEffect(() => {
    nowRef.current = options?.now ?? Date.now;
  });

  const knownClubId = typeof options?.clubId === "string" ? options.clubId.trim() : "";

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (uid: string, providedClubId: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const accept = () => mountedRef.current && requestId === requestIdRef.current;

    let parsed: ClubTrainingDirective | null = null;
    try {
      let clubId = providedClubId;
      if (!clubId) {
        const userSnap = await getDoc(doc(db, "users", uid));
        const raw = userSnap.exists() ? (userSnap.data() as { clubId?: unknown })?.clubId : null;
        clubId = typeof raw === "string" ? raw.trim() : "";
      }
      if (clubId) {
        const snap = await getDoc(
          doc(db, "clubs", clubId, CLUB_DIRECTIVES_COLLECTION, CLUB_DIRECTIVE_CURRENT_ID),
        );
        if (snap.exists()) parsed = parseClubDirective(snap.data() as Record<string, unknown>);
      }
    } catch {
      // Lecture refusée / réseau : aucune directive affichée. On ne prétend
      // surtout pas qu'il n'y en a pas — on n'affiche simplement rien.
      parsed = null;
    }

    if (!accept()) return;
    // Jour recalculé À CHAQUE lecture : une app laissée ouverte toute la nuit ne
    // doit pas continuer à raisonner sur la veille.
    setTodayKey(toDateKey(new Date(nowRef.current())));
    setDirective(parsed);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) {
      requestIdRef.current += 1;
      // Remise à zéro explicite : après déconnexion, on ne laisse pas traîner la
      // directive du club précédent.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirective(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }
    // `load` n'atteint aucun setState avant son premier `await` : le montage ne
    // provoque donc pas de rendu en cascade (même raisonnement que useCoachClub).
    load(uid, knownClubId);
    return () => {
      requestIdRef.current += 1;
    };
  }, [knownClubId, load]);

  const notice = clubDirectiveNotice(directive, todayKey);
  return { directive, notice, isLoading };
}
