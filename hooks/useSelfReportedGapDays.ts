// hooks/useSelfReportedGapDays.ts
// Lecture directe (onSnapshot) de users/{uid}.selfReportedGapDays -- le gap
// d'entrainement auto-declare au setup profil (cf. screens/ProfileSetupScreen.tsx,
// etape "Objectif"). Pas de nouveau champ de store ici : state/stores/** est
// hors perimetre (lecture seule) pour ce lot, et ce champ ne sert qu'a
// domain/tracking/resumption.ts (detectTrainingGap) comme filet quand aucune
// seance terminee n'est encore connue localement (nouvel utilisateur).
// Tolerant a tout : pas d'utilisateur connecte, doc absent, champ absent ou
// mal type -> null (jamais de donnee inventee).
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export function useSelfReportedGapDays(): number | null {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const raw = snap.data()?.selfReportedGapDays;
        setValue(typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : null);
      },
      (err: unknown) => {
        const code =
          err != null && typeof err === "object" && "code" in err
            ? (err as { code: string }).code
            : undefined;
        if (code === "permission-denied") return;
        if (__DEV__) console.warn("[useSelfReportedGapDays] onSnapshot error:", err);
      }
    );

    return unsub;
  }, []);

  return value;
}
