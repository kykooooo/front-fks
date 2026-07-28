// functions/tests/coachAccessBackfill.test.ts
//
// Script de mise a niveau des membership existants — teste EXCLUSIVEMENT sur
// des donnees inventees, en memoire. Aucune base, aucun emulateur, aucun
// credential. Le script n'a jamais ete execute ailleurs qu'ici.
//
// Ce qui est verrouille :
//  1. la SIMULATION n'ecrit rien, mais compte exactement ce qui serait ecrit ;
//  2. le script ne fabrique JAMAIS un "approved" ;
//  3. il ne pietine AUCUN etat deja pose ("approved" et "revoked" compris) ;
//  4. l'etat pose suit la POLITIQUE DU CLUB, et rien d'autre : aucun age nulle
//     part, y compris dans le port du magasin (il ne sait plus lire un profil).

import {
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
} from "../src/coachAccessBackfill";
import type { MemberSnapshot } from "../src/coachAccessSync";

type Monde = {
  members: Record<string, MemberSnapshot>;
  policies: Record<string, unknown>;
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
    async readClubPolicy(clubId) {
      return monde.policies[clubId];
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
    "clubA/joueur1": { playerStatus: "active", coachAccess: undefined },
    "clubA/joueur2": { playerStatus: "active", coachAccess: undefined },
    "clubA/valeurPourrie": { playerStatus: "active", coachAccess: "APPROVED" },
    // Deja traites : ne doivent pas bouger.
    "clubA/dejaApprouve": { playerStatus: "active", coachAccess: "approved" },
    "clubA/retire": { playerStatus: "active", coachAccess: "revoked" },
    // Autre club, en mode approval_required (sert aussi au ciblage --clubId).
    "clubB/autre": { playerStatus: "active", coachAccess: undefined },
  },
  policies: {
    // clubA : politique volontairement ABSENTE -> defaut serveur.
    clubB: "approval_required",
  },
  ecritures: [],
});

describe("runCoachAccessBackfill — simulation (mode par defaut)", () => {
  it("n'ecrit RIEN, mais annonce exactement ce qui serait ecrit", async () => {
    const m = monde();
    const stats = await runCoachAccessBackfill(magasin(m));

    expect(m.ecritures).toHaveLength(0); // aucune donnee modifiee
    expect(stats.scanned).toBe(6);
    expect(stats.updated).toBe(4); // joueur1, joueur2, valeurPourrie, autre
    expect(stats.unchanged).toBe(2); // dejaApprouve, retire
    expect(stats.errors).toBe(0);
    expect(stats.parEtat).toEqual({
      not_required: 3, // les 3 de clubA (politique absente -> defaut)
      pending: 1, // clubB/autre (club en approval_required)
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
  it("pose le champ manquant selon la politique du club, sans fabriquer d'autorisation", async () => {
    const m = monde();
    await runCoachAccessBackfill(magasin(m), { apply: true });

    const parCle = Object.fromEntries(m.ecritures.map((e) => [e.cle, e.state]));
    expect(parCle).toEqual({
      // clubA : aucune politique configuree -> defaut serveur.
      "clubA/joueur1": "not_required",
      "clubA/joueur2": "not_required",
      "clubA/valeurPourrie": "not_required",
      // clubB : approval_required -> rien ne s'ouvre.
      "clubB/autre": "pending",
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

  it("un club en approval_required ne devient PAS consultable par ce script", async () => {
    const m = monde();
    await runCoachAccessBackfill(magasin(m), { apply: true, clubId: "clubB" });
    expect(m.ecritures).toEqual([{ cle: "clubB/autre", state: "pending" }]);
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
