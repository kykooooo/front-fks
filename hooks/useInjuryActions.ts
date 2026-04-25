// hooks/useInjuryActions.ts
//
// Centralise les mutations sur `users/{uid}.activeInjuries` + `lastSeenPainSpike`.
// Exporte 5 actions :
//   - `upsertInjury(injury)`         : ajoute ou met à jour une zone sensible.
//                                      Remplace l'entrée existante de même
//                                      `area`, refresh `lastConfirm`, préserve
//                                      `startDate`, persiste `healthConsent`
//                                      (consentement RGPD art. 9).
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
import type { InjuryRecord } from "../domain/types";

/** Version du contrat de consentement RGPD santé (cf. INJURY_IA_CHARTER + PRIVACY_POLICY). */
export const HEALTH_CONSENT_VERSION = "1.0";

type UseInjuryActions = {
  /**
   * Ajoute ou met à jour une zone sensible dans `activeInjuries`.
   * - Si une entrée avec la même `area` existe : remplace en préservant
   *   `startDate` (source de vérité = la 1re déclaration), refresh
   *   `lastConfirm = now`.
   * - Si pas d'entrée : ajoute avec `startDate = now`, `lastConfirm = now`.
   * Écrit aussi `healthConsent: { givenAt, version: HEALTH_CONSENT_VERSION }`
   * dans le profil — obligation RGPD art. 9 (données de santé).
   */
  upsertInjury: (injury: InjuryRecord) => Promise<void>;
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

  const upsertInjury = useCallback(
    async (injury: InjuryRecord) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Non connecté");
      const nowISO = new Date().toISOString();

      // Cherche une entrée existante pour la même zone (unicité par area).
      const existing = activeInjuries.find((i) => i.area === injury.area);

      // Construit l'entrée persistée :
      //   - startDate : 1re déclaration (source de vérité), préservée.
      //   - lastConfirm : toujours refresh au moment de l'upsert.
      const persisted: ActiveInjuryParsed = {
        area: injury.area,
        severity: injury.severity,
        type: injury.type,
        restrictions: injury.restrictions ?? {},
        startDate: existing?.startDate || injury.startDate || nowISO,
        lastConfirm: nowISO,
        note: injury.note ?? null,
      };

      const nextList = existing
        ? activeInjuries.map((i) => (i.area === injury.area ? persisted : i))
        : [...activeInjuries, persisted];

      await setDoc(
        doc(db, "users", uid),
        {
          activeInjuries: nextList,
          // RGPD art. 9 — on persiste le consentement à chaque upsert
          // (équivalent à "ré-acquitté" si re-modification). Le front
          // a validé les 2 checkboxes médical + RGPD avant d'arriver ici.
          healthConsent: { givenAt: nowISO, version: HEALTH_CONSENT_VERSION },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    [activeInjuries],
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
    upsertInjury,
    markInjuryResolved,
    downgradeInjury,
    confirmInjuryStill,
    acknowledgePainSpike,
    activeInjuries,
    loading,
  };
}
