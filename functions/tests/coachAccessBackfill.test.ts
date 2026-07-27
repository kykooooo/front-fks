// functions/tests/coachAccessBackfill.test.ts
//
// Script de mise a niveau des membership existants — teste EXCLUSIVEMENT sur
// des donnees inventees, en memoire. Aucune base, aucun emulateur, aucun
// credential. Le script n'a jamais ete execute ailleurs qu'ici.
//
// Ce qui est verrouille :
//  1. la SIMULATION n'ecrit rien, mais compte exactement ce qui serait ecrit ;
//  2. le script ne fabrique JAMAIS un "approved" ;
//  3. il ne pietine ni un "approved" ni un "revoked" existant ;
//  4. un membership sans categorie d'age connue devient "pending" (default-deny).

import {
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
} from "../src/coachAccessBackfill";
import type { MemberSnapshot } from "../src/coachAccessSync";

type Monde = {
  members: Record<string, MemberSnapshot>;
  ages: Record<string, unknown>;
  ecritures: { cle: string; state: string }[];
};

function magasin(monde: Monde): CoachAccessBackfillStore {
  return {
    async listPlayerMembers(clubId?: string): Promise<MemberRef[]> {
      return Object.keys(monde.members)
        .map((cle) => {
          const [c, p] = cle.split("/");
          return { clubId: c, playerUid: p };
        })
        .filter((m) => !clubId || m.clubId === clubId);
    },
    async readMember(clubId, playerUid) {
      return monde.members[`${clubId}/${playerUid}`] ?? null;
    },
    async readAgeCategory(playerUid) {
      return monde.ages[playerUid];
    },
    async writeCoachAccess(clubId, playerUid, state) {
      monde.ecritures.push({ cle: `${clubId}/${playerUid}`, state });
      monde.members[`${clubId}/${playerUid}`] = {
        ...monde.members[`${clubId}/${playerUid}`],
        coachAccess: state,
      };
    },
  };
}

const monde = (): Monde => ({
  members: {
    // Membership ANCIENS : aucun champ d'autorisation.
    "clubA/adulte": { role: "player", coachAccess: undefined },
    "clubA/jeune": { role: "player", coachAccess: undefined },
    "clubA/ageInconnu": { role: "player", coachAccess: undefined },
    // Deja traites : ne doivent pas bouger.
    "clubA/dejaApprouve": { role: "player", coachAccess: "approved" },
    "clubA/retire": { role: "player", coachAccess: "revoked" },
    // Autre club (sert au ciblage --clubId).
    "clubB/autre": { role: "player", coachAccess: undefined },
  },
  ages: {
    adulte: "Senior",
    jeune: "U15",
    dejaApprouve: "U15",
    retire: "Senior",
    autre: "U18",
    // `ageInconnu` : volontairement absent.
  },
  ecritures: [],
});

describe("runCoachAccessBackfill — simulation (mode par defaut)", () => {
  it("n'ecrit RIEN, mais annonce exactement ce qui serait ecrit", async () => {
    const m = monde();
    const stats = await runCoachAccessBackfill(magasin(m));

    expect(m.ecritures).toHaveLength(0); // aucune donnee modifiee
    expect(stats.scanned).toBe(6);
    expect(stats.updated).toBe(4); // adulte, jeune, ageInconnu, autre
    expect(stats.unchanged).toBe(2); // dejaApprouve, retire
    expect(stats.errors).toBe(0);
    expect(stats.parEtat).toEqual({
      not_required: 2, // adulte (Senior) + autre (U18)
      pending: 2, // jeune (U15) + ageInconnu (categorie absente)
      approved: 1, // inchange
      revoked: 1, // inchange
    });
  });

  it("le ciblage par club borne reellement le parcours", async () => {
    const m = monde();
    const stats = await runCoachAccessBackfill(magasin(m), { clubId: "clubB" });
    expect(stats.scanned).toBe(1);
    expect(m.ecritures).toHaveLength(0);
  });
});

describe("runCoachAccessBackfill — application", () => {
  it("pose le champ manquant, sans jamais fabriquer une autorisation", async () => {
    const m = monde();
    await runCoachAccessBackfill(magasin(m), { apply: true });

    const parCle = Object.fromEntries(m.ecritures.map((e) => [e.cle, e.state]));
    expect(parCle).toEqual({
      "clubA/adulte": "not_required",
      "clubA/jeune": "pending",
      "clubA/ageInconnu": "pending",
      "clubB/autre": "not_required",
    });
    // AUCUNE ecriture ne vaut "approved" : approuver reste un geste humain.
    expect(m.ecritures.some((e) => e.state === "approved")).toBe(false);
  });

  it("ne touche ni un approved ni un revoked existant", async () => {
    const m = monde();
    await runCoachAccessBackfill(magasin(m), { apply: true });
    expect(m.ecritures.map((e) => e.cle)).not.toContain("clubA/dejaApprouve");
    expect(m.ecritures.map((e) => e.cle)).not.toContain("clubA/retire");
    expect(m.members["clubA/dejaApprouve"].coachAccess).toBe("approved");
    expect(m.members["clubA/retire"].coachAccess).toBe("revoked");
  });

  it("est idempotent : un second passage n'ecrit plus rien", async () => {
    const m = monde();
    await runCoachAccessBackfill(magasin(m), { apply: true });
    const apresPremier = m.ecritures.length;
    const stats = await runCoachAccessBackfill(magasin(m), { apply: true });
    expect(m.ecritures).toHaveLength(apresPremier);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(6);
  });

  it("membership disparu entre l'inventaire et le traitement : compte, ne casse pas", async () => {
    const m = monde();
    const store = magasin(m);
    const original = store.listPlayerMembers.bind(store);
    store.listPlayerMembers = async (clubId?: string) => [
      ...(await original(clubId)),
      { clubId: "clubA", playerUid: "parti" },
    ];
    const stats = await runCoachAccessBackfill(store, { apply: true });
    expect(stats.missing).toBe(1);
    expect(stats.errors).toBe(0);
  });
});
