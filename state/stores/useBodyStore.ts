// state/stores/useBodyStore.ts
// =============================================================================
// « MON CORPS » — LE STORE DES GENES ET BLESSURES DECLAREES
// =============================================================================
//
// CONTRAINTE DE CONCEPTION, PAS EFFET DE BORD : **AUCUNE ECRITURE FIRESTORE**.
// Le detail des blessures est une donnee de sante (art. 9 RGPD). Au lot 1 il
// reste sur l'appareil, exactement comme `fks-feedback-v1`. La frontiere
// coach-safe tient donc par construction : la donnee n'existe pas cote serveur.
// Contrepartie ASSUMEE et DITE au joueur dans l'ecran : un changement de
// telephone perd ces declarations.
// Le jour ou une synchronisation existera, cette garantie ne reposera plus sur
// « la donnee n'existe pas » mais uniquement sur la projection serveur et les
// regles Firestore — c'est une decision a part entiere, pas un detail.
//
// LECTURE : personne ne lit ce store directement, sauf
// `state/selectors/blessures.ts` (le moteur et les ecrans passent par lui) et
// `hooks/monCorps/*` (l'ecran dedie). Une sentinelle le verifie sur la source :
// `domain/__tests__/monCorpsLectureUnique.test.ts`.
// =============================================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { BodyInjury, BodyInjurySeverity, BodyInjuryStatus, BodyArea } from "../../domain/types";
import { createMigratedStorage } from "./storage";
import type { BodyState } from "./types";

const baseBodyState = () => ({
  bodyInjuries: [] as BodyInjury[],
  /**
   * Marqueur d'idempotence de la reprise des `dayStates.feedback.injury`
   * historiques. `null` = jamais jouee. Une fois pose, la migration ne rejoue
   * plus, meme si de vieux `dayStates` restent en place.
   */
  migrationFeedbackAt: null as string | null,
});

/**
 * Identifiant stable. Pas de dependance uuid dans le projet : zone + horodatage
 * + compteur de collision suffisent (une declaration = un geste humain).
 */
let _compteur = 0;
export function genererIdBlessure(zone: BodyArea, nowISO: string): string {
  _compteur += 1;
  const base = Date.parse(nowISO);
  const horodatage = Number.isFinite(base) ? base.toString(36) : "0";
  return `b_${zone}_${horodatage}_${_compteur.toString(36)}`;
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      ...baseBodyState(),

      /**
       * GARDE ANTI-DOUBLON PAR ZONE (P3, round 2). Une zone deja `active` ou
       * `recovering` ne peut pas se retrouver declaree deux fois : le setup
       * (D6) et la passerelle du feedback (D3) peuvent tous les deux ecrire
       * pour une meme zone deja suivie ailleurs — sans cette garde, « genou »
       * pourrait exister en double, et `collectActivePainConstraints` prendrait
       * la mauvaise ligne. Une gene deja guérie, elle, NE bloque rien : la
       * rouvrir est une nouvelle declaration légitime (une même zone peut se
       * blesser à nouveau).
       *
       * Quand une ligne active/en reprise existe deja pour la zone, ce n'est
       * plus un AJOUT mais une MISE A JOUR de cette ligne : gravite et statut
       * (repasse a `active`, une nouvelle déclaration dit "ça recommence" ou
       * "c'est toujours la", jamais "en reprise" — ce serait inventer un
       * jugement que le joueur n'a pas donne) suivent la nouvelle
       * declaration ; la note n'est remplacee que si une nouvelle est fournie,
       * jamais effacee par une declaration silencieuse.
       */
      ajouterBlessure: ({ zone, gravite, note, source, nowISO }) => {
        const horodatage = nowISO ?? new Date().toISOString();
        const noteFinale = note && note.trim() ? note.trim() : undefined;

        const state = get();
        const existante = state.bodyInjuries.find(
          (b) => b.zone === zone && (b.statut === "active" || b.statut === "recovering")
        );

        if (existante) {
          const misAJour: BodyInjury = {
            ...existante,
            gravite,
            statut: "active",
            updatedAt: horodatage,
            ...(noteFinale ? { note: noteFinale } : {}),
          };
          set((s) => ({
            bodyInjuries: s.bodyInjuries.map((b) => (b.id === existante.id ? misAJour : b)),
          }));
          return misAJour;
        }

        const blessure: BodyInjury = {
          id: genererIdBlessure(zone, horodatage),
          zone,
          gravite,
          statut: "active",
          source,
          declaredAt: horodatage,
          updatedAt: horodatage,
          // Note ABSENTE si vide : on ne stocke pas une chaine vide comme s'il
          // y avait quelque chose a lire.
          ...(noteFinale ? { note: noteFinale } : {}),
        };
        set((s) => ({ bodyInjuries: [blessure, ...s.bodyInjuries] }));
        return blessure;
      },

      changerStatut: (id, statut, nowISO) =>
        set((state) => ({
          bodyInjuries: state.bodyInjuries.map((b) =>
            b.id === id ? { ...b, statut, updatedAt: nowISO ?? new Date().toISOString() } : b
          ),
        })),

      changerGravite: (id, gravite, nowISO) =>
        set((state) => ({
          bodyInjuries: state.bodyInjuries.map((b) =>
            b.id === id ? { ...b, gravite, updatedAt: nowISO ?? new Date().toISOString() } : b
          ),
        })),

      supprimerBlessure: (id) =>
        set((state) => ({ bodyInjuries: state.bodyInjuries.filter((b) => b.id !== id) })),

      /**
       * Reprise des declarations historiques (voir
       * `state/migration/migrateInjuries.ts` pour la regle de selection).
       *
       * IDEMPOTENTE PAR DEUX GARDES INDEPENDANTES :
       *   1. le marqueur `migrationFeedbackAt` — une fois pose, on ne rejoue plus ;
       *   2. la cle de dedoublonnage `zone + jour de declaration` — meme si le
       *      marqueur etait perdu (snapshot ancien, reinstallation partielle),
       *      rejouer n'ajoute aucun doublon.
       */
      appliquerMigrationFeedback: (candidats, nowISO) => {
        if (get().migrationFeedbackAt) return;
        set((state) => {
          const dejaLa = new Set(
            state.bodyInjuries.map((b) => `${b.zone}|${b.declaredAt.slice(0, 10)}`)
          );
          const nouvelles = candidats.filter(
            (c) => !dejaLa.has(`${c.zone}|${c.declaredAt.slice(0, 10)}`)
          );
          return {
            bodyInjuries: [...nouvelles, ...state.bodyInjuries],
            migrationFeedbackAt: nowISO,
          };
        });
      },

      resetAll: () => set({ ...baseBodyState() }),
    }),
    {
      name: "fks-body-v1",
      version: 1,
      storage: createMigratedStorage(),
      partialize: (s) => ({
        bodyInjuries: s.bodyInjuries,
        migrationFeedbackAt: s.migrationFeedbackAt,
      }),
      // Comme `useExecutionStore` : on n'appelle PAS `onStoreHydrated()` ici.
      // `state/orchestrators/rehydrate.ts` compte un `TOTAL_STORES = 6` fige,
      // correspondant aux 6 stores qui alimentent le rebuild ATL/CTL/TSB. Ce
      // store n'y joue aucun role ; l'y brancher declencherait le rebuild avant
      // que tous les stores comptes aient fini de charger.
      //
      // La reprise des declarations historiques n'est PAS armee ici : elle a
      // besoin de `useFeedbackStore` hydrate lui aussi, et l'armer depuis ce
      // fichier creerait un cycle d'imports. Elle est armee une fois au
      // demarrage (`App.tsx`) et rejouee apres un changement d'utilisateur
      // (`state/orchestrators/resetUser.ts`). Elle est idempotente.
      migrate: (persisted) => persisted as BodyState,
    }
  )
);

export const getBodyDefaults = baseBodyState;

export type { BodyInjury, BodyInjurySeverity, BodyInjuryStatus };
