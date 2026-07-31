// schemas/__tests__/sessionSchema.test.ts
// FIX contrat front↔back : le backend émet recovery_tips à la RACINE de la
// réponse v2 (fks/src/fksSchema.ts) alors que le front ne les lisait que dans
// post_session.recovery_tips — et la racine du schéma, non-passthrough,
// jetait le champ avant même l'UI. Ces tests verrouillent :
// 1) recovery_tips racine déclaré et parsé,
// 2) la racine en .passthrough() (un champ backend inconnu survit au parse —
//    c'est ce strip silencieux qui avait déjà coûté player_context),
// 3) la chaîne complète parse → snakeToCamel → readRecoveryTips (ce que
//    voient réellement Preview/Live/Summary).

import {
  SEUIL_SENTINELLES_REPARATION,
  detecterSentinellesReparation,
  estSeanceReparee,
  sessionV2Schema,
} from "../sessionSchema";
import { snakeToCamel } from "../../utils/caseTransform";
import { readRecoveryTips } from "../../screens/newSession/helpers";
import type { FKS_NextSessionV2 } from "../../screens/newSession/types";

const baseV2 = {
  version: "fks.next_session.v2",
  title: "Séance force",
  intensity: "moderate",
  focus_primary: "strength",
  duration_min: 45,
  rpe_target: 6,
  blocks: [],
};

describe("sessionV2Schema — recovery_tips à la racine (contrat backend)", () => {
  test("recovery_tips racine survit au parse", () => {
    const parsed = sessionV2Schema.safeParse({
      ...baseV2,
      recovery_tips: ["Bois 500ml d'eau", "Étirements légers 10 min"],
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.recovery_tips).toEqual([
      "Bois 500ml d'eau",
      "Étirements légers 10 min",
    ]);
  });

  test("post_session.recovery_tips reste accepté (compat)", () => {
    const parsed = sessionV2Schema.safeParse({
      ...baseV2,
      post_session: { cooldown_min: 5, recovery_tips: ["Sommeil 8h"] },
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.post_session.recovery_tips).toEqual(["Sommeil 8h"]);
  });

  test("passthrough racine : un champ backend inconnu n'est plus jeté", () => {
    const parsed = sessionV2Schema.safeParse({
      ...baseV2,
      futur_champ_backend: { any: "value" },
    });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.futur_champ_backend).toEqual({ any: "value" });
  });

  test("chaîne complète parse → snakeToCamel → readRecoveryTips (racine seule, comme le backend actuel)", () => {
    const parsed = sessionV2Schema.safeParse({
      ...baseV2,
      recovery_tips: ["Protéines dans les 2h"],
      post_session: { cooldown_min: 5, mobility: ["hanches"] },
    });
    expect(parsed.success).toBe(true);
    const v2 = snakeToCamel<FKS_NextSessionV2>((parsed as any).data);
    expect(v2.recoveryTips).toEqual(["Protéines dans les 2h"]);
    // Ce que les écrans affichent réellement :
    expect(readRecoveryTips(v2)).toEqual(["Protéines dans les 2h"]);
  });
});

describe("readRecoveryTips — priorité et fallback", () => {
  test("postSession prioritaire si non vide (compat si le backend les y remet)", () => {
    expect(
      readRecoveryTips({
        recoveryTips: ["racine"],
        postSession: { recoveryTips: ["post"] },
      })
    ).toEqual(["post"]);
  });

  test("racine utilisée quand postSession absent ou vide", () => {
    expect(readRecoveryTips({ recoveryTips: ["racine"], postSession: null })).toEqual(["racine"]);
    expect(
      readRecoveryTips({ recoveryTips: ["racine"], postSession: { recoveryTips: [] } })
    ).toEqual(["racine"]);
  });

  test("undefined si aucun conseil (jamais de tableau vide)", () => {
    expect(readRecoveryTips({ postSession: { cooldownMin: 5 } })).toBeUndefined();
    expect(readRecoveryTips({ recoveryTips: [] })).toBeUndefined();
    expect(readRecoveryTips(null)).toBeUndefined();
    expect(readRecoveryTips(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// LOT 3 (P1) — détection de réparation silencieuse : un manque de données ne
// devient jamais une fausse séance. Chaque .catch() du schéma répare un champ
// isolé en valeur plausible ; ces tests prouvent qu'au-delà d'un seuil (ou
// toujours quand blocks est vide) la réparation redevient détectable.
// ---------------------------------------------------------------------------

const seanceComplete = {
  version: "fks.next_session.v2",
  title: "Séance renfo bas du corps",
  intensity: "moderate",
  focus_primary: "strength",
  duration_min: 45,
  rpe_target: 7,
  blocks: [
    {
      id: "main",
      type: "strength",
      goal: "renfo",
      intensity: "moderate",
      duration_min: 20,
      items: [{ name: "Squat barre", sets: 4, reps: 8 }],
    },
  ],
};

/** Copie de `seanceComplete` sans les champs listés (déclenche leur `.catch()`). */
function sansChamps(champs: (keyof typeof seanceComplete)[]): Record<string, unknown> {
  const copie: Record<string, unknown> = { ...seanceComplete };
  for (const champ of champs) delete copie[champ];
  return copie;
}

describe("SEUIL_SENTINELLES_REPARATION — constante nommée, pas un chiffre magique", () => {
  test("vaut 2 : un seul champ par défaut reste plausible, deux à la fois ne le sont plus", () => {
    expect(SEUIL_SENTINELLES_REPARATION).toBe(2);
  });
});

describe("detecterSentinellesReparation", () => {
  test("séance complète, rien de réparé : aucune sentinelle", () => {
    const parsed = sessionV2Schema.parse(seanceComplete);
    expect(detecterSentinellesReparation(parsed)).toEqual([]);
  });

  test("blocks vide : sentinelle blocks_vides", () => {
    const parsed = sessionV2Schema.parse({ ...seanceComplete, blocks: [] });
    expect(detecterSentinellesReparation(parsed)).toContain("blocks_vides");
  });

  test("blocks absent (declenche le .catch([]) du schema) : sentinelle blocks_vides aussi", () => {
    const parsed = sessionV2Schema.parse(sansChamps(["blocks"]));
    expect(detecterSentinellesReparation(parsed)).toContain("blocks_vides");
  });

  test("titre absent (repare en 'Séance') : sentinelle titre_defaut", () => {
    const parsed = sessionV2Schema.parse(sansChamps(["title"]));
    expect(detecterSentinellesReparation(parsed)).toEqual(["titre_defaut"]);
  });

  test("duration_min absente (reparee en 30) : sentinelle duree_defaut", () => {
    const parsed = sessionV2Schema.parse(sansChamps(["duration_min"]));
    expect(detecterSentinellesReparation(parsed)).toEqual(["duree_defaut"]);
  });

  test("une VRAIE seance de 30 minutes n'est pas confondue avec une reparation (duree seule)", () => {
    const parsed = sessionV2Schema.parse({ ...seanceComplete, duration_min: 30 });
    expect(detecterSentinellesReparation(parsed)).toEqual(["duree_defaut"]);
    expect(estSeanceReparee(parsed)).toBe(false);
  });
});

describe("estSeanceReparee — le verdict qui declenche l'echec type", () => {
  test("blocks vide SEUL : reparee, meme sans aucune autre sentinelle (TOUJOURS disqualifiant)", () => {
    const parsed = sessionV2Schema.parse({ ...seanceComplete, blocks: [] });
    expect(detecterSentinellesReparation(parsed)).toHaveLength(1);
    expect(estSeanceReparee(parsed)).toBe(true);
  });

  test("une seule sentinelle non-blocks (sous le seuil) : PAS reparee, la seance passe", () => {
    const parsed = sessionV2Schema.parse(sansChamps(["title"]));
    expect(detecterSentinellesReparation(parsed)).toHaveLength(1);
    expect(estSeanceReparee(parsed)).toBe(false);
  });

  test("deux sentinelles non-blocks simultanees (titre ET duree) : atteint le seuil, reparee", () => {
    const parsed = sessionV2Schema.parse(sansChamps(["title", "duration_min"]));
    expect(detecterSentinellesReparation(parsed)).toEqual(
      expect.arrayContaining(["titre_defaut", "duree_defaut"])
    );
    expect(estSeanceReparee(parsed)).toBe(true);
  });

  test("séance complète : jamais reparee", () => {
    const parsed = sessionV2Schema.parse(seanceComplete);
    expect(estSeanceReparee(parsed)).toBe(false);
  });
});
