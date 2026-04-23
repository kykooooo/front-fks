// hooks/useActiveInjuries.ts
//
// Lecture temps réel de `users/{uid}.activeInjuries` depuis Firestore.
// Créé en Jour 4 pour alimenter :
//   - `screens/profile/InjuryZonesSection.tsx` (affichage)
//   - `hooks/home/useContextualAdvice.ts` (règle injury_stale + filtrage 14j)
//
// N'utilise PAS `useSyncStore.startFirestoreWatch` (fichier WIP) pour rester
// en option α stricte. On écoute directement le doc profil via onSnapshot :
// coût Firestore négligeable (1 listener par session ouverte) et réactivité
// immédiate après une action de `useInjuryActions`.
//
// Validation : `userProfileSchema.safeParse` — si `activeInjuries` est
// corrompu en Firestore, on retombe sur `[]` sans crasher (cohérent avec
// le pattern `aiContext.ts`).

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type Unsubscribe } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { userProfileSchema, type ActiveInjuryParsed } from "../schemas/firestoreSchemas";

export type UseActiveInjuriesResult = {
  activeInjuries: ActiveInjuryParsed[];
  /**
   * Timestamp ISO du dernier acquittement manuel d'un pic de douleur
   * (PainSpikeModal bouton "J'ai consulté"). `null` si jamais acquitté.
   * Consommé par la règle advice `injury_pain_spike` pour éviter de
   * re-déclencher sur le même feedback.
   */
  lastSeenPainSpike: string | null;
  loading: boolean;
  /**
   * UID du joueur actuellement surveillé. `null` si pas connecté.
   * Utile pour invalider un cache local après logout.
   */
  uid: string | null;
};

/**
 * Hook React qui expose en temps réel le champ `activeInjuries` du profil.
 *
 * Pattern :
 *   - Écoute `onAuthStateChanged` pour ouvrir/fermer le listener Firestore
 *     au bon moment.
 *   - `onSnapshot(users/{uid})` pour propagation temps réel après mutations.
 *   - Validation Zod à chaque snapshot.
 */
export function useActiveInjuries(): UseActiveInjuriesResult {
  const [state, setState] = useState<UseActiveInjuriesResult>({
    activeInjuries: [],
    lastSeenPainSpike: null,
    loading: true,
    uid: null,
  });
  const unsubDocRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    const cleanupDoc = () => {
      if (unsubDocRef.current) {
        try { unsubDocRef.current(); } catch { /* noop */ }
        unsubDocRef.current = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      cleanupDoc();

      if (!user) {
        setState({ activeInjuries: [], lastSeenPainSpike: null, loading: false, uid: null });
        return;
      }

      const ref = doc(db, "users", user.uid);
      setState((prev) => ({ ...prev, loading: true, uid: user.uid }));

      const unsubDoc = onSnapshot(
        ref,
        (snap) => {
          const raw = snap.data() ?? {};
          const parsed = userProfileSchema.safeParse(raw);
          const data = parsed.success ? parsed.data : userProfileSchema.parse({});

          const activeInjuries: ActiveInjuryParsed[] = Array.isArray(data.activeInjuries)
            ? data.activeInjuries
            : [];

          const lastSeenPainSpikeRaw = (data as { lastSeenPainSpike?: string | null }).lastSeenPainSpike;
          const lastSeenPainSpike =
            typeof lastSeenPainSpikeRaw === "string" && lastSeenPainSpikeRaw.length > 0
              ? lastSeenPainSpikeRaw
              : null;

          setState({ activeInjuries, lastSeenPainSpike, loading: false, uid: user.uid });
        },
        (err) => {
          if (__DEV__) console.warn("[useActiveInjuries] onSnapshot error:", err);
          setState((prev) => ({ ...prev, loading: false }));
        },
      );

      unsubDocRef.current = unsubDoc;
    });

    return () => {
      cleanupDoc();
      try { unsubAuth(); } catch { /* noop */ }
    };
  }, []);

  return state;
}
