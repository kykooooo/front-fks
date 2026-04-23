// hooks/useInjuryActions.ts
//
// Centralise les mutations sur `users/{uid}.activeInjuries` + `lastSeenPainSpike`.
// Exporte 4 actions :
//   - `markInjuryResolved(area)`     : retire une injury de activeInjuries.
//   - `downgradeInjury(area)`        : passe l'injury en severity 1 + reset
//                                      lastConfirm. Utilisé quand le joueur
//                                      répond "un peu encore" à la question
//                                      honnête "Tu peux courir et sauter ?".
//   - `confirmInjuryStill(area)`     : reset lastConfirm à now (réponse Home
//                                      card `injury_stale`).
//   - `acknowledgePainSpike()`       : set lastSeenPainSpike à now (bouton
//                                      "J'ai consulté" de PainSpikeModal).
//
// Toutes les mutations utilisent `setDoc(..., { merge: true })` avec
// `serverTimestamp()` pour `updatedAt`. Elles lèvent en cas d'erreur — le
// caller affiche un toast. Aucun retry automatique (mutations rapides).
//
// IMPORTANT charte (règle 3) :
//   - L'IA ne doit JAMAIS appeler ces fonctions automatiquement.
//   - Toujours déclenchées par une action utilisateur explicite.

import { useCallback } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useActiveInjuries } from "./useActiveInjuries";
import type { ActiveInjuryParsed } from "../schemas/firestoreSchemas";

type UseInjuryActions = {
  /**
   * Retire l'injury de `activeInjuries` (zone sensible résolue).
   * Réponse "Oui, pas de gêne" à la question honnête.
   */
  markInjuryResolved: (area: string) => Promise<void>;
  /**
   * Downgrade une injury à severity 1 (Gêne légère) + reset lastConfirm.
   * Réponse "Un peu encore" à la question honnête — on ne retire pas,
   * on propose un recheck dans 7 jours (via règle `injury_stale`).
   */
  downgradeInjury: (area: string) => Promise<void>;
  /**
   * Renouvelle `lastConfirm` à now. Utilisé quand le joueur confirme que
   * sa zone est toujours sensible (réponse à la carte `injury_stale`).
   * Évite l'auto-désactivation à 14 jours.
   */
  confirmInjuryStill: (area: string) => Promise<void>;
  /**
   * Set `lastSeenPainSpike` à now dans le profil. Déclenché par le bouton
   * "J'ai consulté, ma déclaration reste active" de PainSpikeModal.
   * Empêche la carte `injury_pain_spike` de re-déclencher.
   */
  acknowledgePainSpike: () => Promise<void>;
  /**
   * État courant (proxy vers `useActiveInjuries`) pour éviter aux consumers
   * d'appeler le hook 2 fois.
   */
  activeInjuries: ActiveInjuryParsed[];
  loading: boolean;
};

export function useInjuryActions(): UseInjuryActions {
  const { activeInjuries, loading } = useActiveInjuries();

  const writeActiveInjuries = useCallback(
    async (nextList: ActiveInjuryParsed[]) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Non connecté");
      await setDoc(
        doc(db, "users", uid),
        { activeInjuries: nextList, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    [],
  );

  const markInjuryResolved = useCallback(
    async (area: string) => {
      const next = activeInjuries.filter((i) => i.area !== area);
      await writeActiveInjuries(next);
    },
    [activeInjuries, writeActiveInjuries],
  );

  const downgradeInjury = useCallback(
    async (area: string) => {
      const nowISO = new Date().toISOString();
      const next = activeInjuries.map((i) =>
        i.area === area ? { ...i, severity: 1 as const, lastConfirm: nowISO } : i,
      );
      await writeActiveInjuries(next);
    },
    [activeInjuries, writeActiveInjuries],
  );

  const confirmInjuryStill = useCallback(
    async (area: string) => {
      const nowISO = new Date().toISOString();
      const next = activeInjuries.map((i) =>
        i.area === area ? { ...i, lastConfirm: nowISO } : i,
      );
      await writeActiveInjuries(next);
    },
    [activeInjuries, writeActiveInjuries],
  );

  const acknowledgePainSpike = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Non connecté");
    const nowISO = new Date().toISOString();
    await setDoc(
      doc(db, "users", uid),
      { lastSeenPainSpike: nowISO, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, []);

  return {
    markInjuryResolved,
    downgradeInjury,
    confirmInjuryStill,
    acknowledgePainSpike,
    activeInjuries,
    loading,
  };
}
