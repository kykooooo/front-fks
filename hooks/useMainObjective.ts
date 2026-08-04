// hooks/useMainObjective.ts
// Lecture directe (onSnapshot) de users/{uid}.mainObjective — l'objectif
// principal choisi a l'etape 1 du setup profil (screens/ProfileSetupScreen.tsx).
//
// POURQUOI UN HOOK, ALORS QUE DEUX ECRANS LISENT DEJA CE CHAMP
// ---------------------------------------------------------------------------
// `screens/CycleModalScreen.tsx:141` fait un `getDoc` a la main dans un effet, et
// `screens/ProfileScreen.tsx:163` lit `lastAiContext.profile.main_objective`,
// c'est-a-dire une COPIE datant de la derniere generation IA — elle peut avoir
// une seance de retard. Deux lectures, deux fraicheurs, zero source commune.
// Ce hook suit le patron deja pose par `hooks/useSelfReportedGapDays.ts` :
// onSnapshot sur le document canonique, temps reel, et tolerant a tout.
//
// VALEUR BRUTE, SANS ACCENT : les 4 valeurs possibles sont persistees telles
// quelles et comparees sans accent cote Cloud Functions. On ne les affiche
// jamais directement — elles vont a `recommendMicrocycle`, qui rend un libelle
// de cycle deja propre.
//
// Tolerant a tout : pas d'utilisateur connecte, doc absent, champ absent ou mal
// type -> null. Jamais de valeur inventee.
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export function useMainObjective(): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const raw = snap.data()?.mainObjective;
        const texte = typeof raw === "string" ? raw.trim() : "";
        setValue(texte.length > 0 ? texte : null);
      },
      (err: unknown) => {
        const code =
          err != null && typeof err === "object" && "code" in err
            ? (err as { code: string }).code
            : undefined;
        if (code === "permission-denied") return;
        if (__DEV__) console.warn("[useMainObjective] onSnapshot error:", err);
      }
    );

    return unsub;
  }, []);

  return value;
}
