// functions/tests/coachAccess.test.ts
//
// AUTORISATION D'ACCES AUX DONNEES DE SUIVI — couches 2 et 3 (projecteur serveur
// + Cloud Functions). Tests UNITAIRES purs, aucun emulateur.
//
// Ce que cette suite verrouille :
//  1. la decision elle-meme (default-deny sur toute valeur non autorisante) ;
//  2. l'etat INITIAL au rattachement, dont le cas "age inconnu -> pending" ;
//  3. le fait que le PROJECTEUR ne produit RIEN quand l'etat refuse — donc que
//     rebuild supprime la projection existante (chemin `null` deja teste) ;
//  4. le recalcul serveur : il ne fabrique jamais un "approved", il ne pietine
//     jamais une decision humaine, et il n'ecrit que s'il change quelque chose.

import {
  COACH_ACCESS_FIELD,
  COACH_ACCESS_GRANTING_STATES,
  COACH_ACCESS_STATES,
  initialCoachAccess,
  isCoachAccessGranted,
  isMembershipCoachAccessGranted,
  normalizeCoachAccess,
  requiresExtraStep,
  resolveCoachAccess,
} from "../src/coachAccess";
import {
  syncCoachAccessFromProfile,
  type MemberAccessStore,
  type MemberSnapshot,
} from "../src/coachAccessSync";
import { projectPlayerSummary, type ProjectorInput } from "../src/projector";

// ─── 1. La decision ─────────────────────────────────────────────────────────

describe("isCoachAccessGranted — default-deny", () => {
  it("n'autorise QUE approved et not_required", () => {
    expect(COACH_ACCESS_GRANTING_STATES).toEqual(["approved", "not_required"]);
    expect(isCoachAccessGranted("approved")).toBe(true);
    expect(isCoachAccessGranted("not_required")).toBe(true);
    expect(isCoachAccessGranted("pending")).toBe(false);
    expect(isCoachAccessGranted("revoked")).toBe(false);
  });

  it("refuse TOUTE valeur absente, vide, mal typee ou inconnue", () => {
    const refusees: unknown[] = [
      undefined,
      null,
      "",
      "   ",
      "APPROVED", // la casse compte : la valeur est un jeton, pas une phrase
      "Approved",
      "ok",
      "granted",
      "not required",
      true,
      1,
      {},
      [],
      ["approved"],
      { state: "approved" },
    ];
    for (const v of refusees) {
      expect(isCoachAccessGranted(v)).toBe(false);
    }
  });

  it("tolere les espaces autour d'un jeton par ailleurs exact", () => {
    expect(isCoachAccessGranted(" approved ")).toBe(true);
    expect(normalizeCoachAccess("  pending")).toBe("pending");
    expect(normalizeCoachAccess("nimporte")).toBeNull();
  });

  it("un membership ANCIEN (sans le champ) n'ouvre rien", () => {
    expect(isMembershipCoachAccessGranted({ uid: "p1", role: "player" })).toBe(false);
    expect(isMembershipCoachAccessGranted(null)).toBe(false);
    expect(isMembershipCoachAccessGranted({ [COACH_ACCESS_FIELD]: "approved" })).toBe(true);
  });

  it("les quatre etats sont exactement ceux du vocabulaire produit arrete", () => {
    expect(COACH_ACCESS_STATES).toEqual(["pending", "approved", "revoked", "not_required"]);
  });
});

// ─── 2. Etat initial au rattachement ────────────────────────────────────────

describe("initialCoachAccess — l'age inconnu vaut refus", () => {
  it("U13 et U15 exigent une etape supplementaire -> pending", () => {
    expect(initialCoachAccess("U13")).toBe("pending");
    expect(initialCoachAccess("U15")).toBe("pending");
    expect(requiresExtraStep("U15")).toBe(true);
  });

  it("U17 / U18 / Senior -> not_required (aucune friction ajoutee)", () => {
    expect(initialCoachAccess("U17")).toBe("not_required");
    expect(initialCoachAccess("U18")).toBe("not_required");
    expect(initialCoachAccess("Senior")).toBe("not_required");
    expect(requiresExtraStep("Senior")).toBe(false);
  });

  it("categorie ABSENTE, vide ou non reconnue -> pending (on ne devine jamais un age)", () => {
    for (const v of [undefined, null, "", "  ", "U11", "u15", "adulte", 15, {}]) {
      expect(initialCoachAccess(v)).toBe("pending");
    }
  });
});

// ─── 3. Le projecteur ne produit RIEN quand l'etat refuse ───────────────────

const baseInput = (over: Partial<ProjectorInput> = {}): ProjectorInput => ({
  playerUid: "playerA1",
  clubId: "clubA",
  membership: { uid: "playerA1", role: "player", coachAccess: "approved" },
  profile: {
    uid: "playerA1",
    clubId: "clubA",
    role: "player",
    firstName: "Anna",
    ageCategory: "U15",
    profileCompleted: true,
  },
  sessions: [
    {
      __id: "s1",
      date: "2026-06-28",
      focus: "strength",
      feedback: { pain: 3, comment: "mal au genou", durationMin: 40 },
    },
  ],
  plannedSessions: [],
  now: new Date("2026-06-30T12:00:00.000Z"),
  ...over,
});

describe("projectPlayerSummary — verrou d'autorisation (couche 2)", () => {
  it("etat autorisant -> projection produite (temoin positif)", () => {
    expect(projectPlayerSummary(baseInput())).not.toBeNull();
    expect(
      projectPlayerSummary(
        baseInput({ membership: { uid: "playerA1", role: "player", coachAccess: "not_required" } }),
      ),
    ).not.toBeNull();
  });

  it("pending / revoked / champ absent / valeur inconnue -> AUCUNE projection", () => {
    const refus = ["pending", "revoked", "APPROVED", "", undefined];
    for (const coachAccess of refus) {
      const membership: Record<string, unknown> = { uid: "playerA1", role: "player" };
      if (coachAccess !== undefined) membership.coachAccess = coachAccess;
      expect(projectPlayerSummary(baseInput({ membership }))).toBeNull();
    }
  });

  it("le refus est prononce AVANT toute lecture du profil ou des seances", () => {
    // Meme avec un profil parfait et des seances presentes, rien ne sort. C'est
    // ce `null` que `rebuildPlayerSummary` traduit en SUPPRESSION de la
    // projection existante : un passage en "revoked" retire la donnee deja
    // projetee, il ne la laisse pas trainer.
    const out = projectPlayerSummary(
      baseInput({ membership: { uid: "playerA1", role: "player", coachAccess: "revoked" } }),
    );
    expect(out).toBeNull();
  });
});

// ─── 4. Recalcul serveur ────────────────────────────────────────────────────

describe("resolveCoachAccess — ne fabrique jamais une autorisation", () => {
  it("approved et revoked sont des decisions humaines : jamais ecrasees", () => {
    expect(resolveCoachAccess("approved", "U15")).toBe("approved");
    expect(resolveCoachAccess("approved", undefined)).toBe("approved");
    expect(resolveCoachAccess("revoked", "Senior")).toBe("revoked");
  });

  it("leve le doute quand la categorie devient connue et hors etape supplementaire", () => {
    expect(resolveCoachAccess("pending", "Senior")).toBe("not_required");
    expect(resolveCoachAccess(undefined, "U18")).toBe("not_required");
  });

  it("RESSERRE quand la categorie devient une categorie a etape supplementaire", () => {
    expect(resolveCoachAccess("not_required", "U15")).toBe("pending");
  });

  it("ne produit JAMAIS approved, quelle que soit l'entree", () => {
    const etats: unknown[] = ["pending", "not_required", "", undefined, null, "bidon"];
    const ages: unknown[] = ["U13", "U15", "U17", "U18", "Senior", undefined, "inconnu"];
    for (const e of etats) {
      for (const a of ages) {
        expect(resolveCoachAccess(e, a)).not.toBe("approved");
      }
    }
  });
});

type FakeState = {
  members: Record<string, MemberSnapshot | null>;
  ages: Record<string, unknown>;
  writes: { clubId: string; playerUid: string; state: string }[];
};

const fakeStore = (state: FakeState): MemberAccessStore => ({
  async readMember(clubId, playerUid) {
    return state.members[`${clubId}/${playerUid}`] ?? null;
  },
  async readAgeCategory(playerUid) {
    return state.ages[playerUid];
  },
  async writeCoachAccess(clubId, playerUid, s) {
    state.writes.push({ clubId, playerUid, state: s });
  },
});

describe("syncCoachAccessFromProfile — recalcul au changement de profil", () => {
  const mk = (over: Partial<FakeState> = {}): FakeState => ({
    members: {},
    ages: {},
    writes: [],
    ...over,
  });

  it("age inconnu au rattachement, puis profil Senior renseigne -> not_required", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "pending" } },
      ages: { p1: "Senior" },
    });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: "pending", to: "not_required" });
    expect(state.writes).toEqual([{ clubId: "clubA", playerUid: "p1", state: "not_required" }]);
  });

  it("profil passe a U15 -> RESSERRE en pending", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "not_required" } },
      ages: { p1: "U15" },
    });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: "not_required", to: "pending" });
  });

  it("un approved n'est JAMAIS retouche (aucune ecriture, donc aucun re-declenchement)", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "approved" } },
      ages: { p1: "U15" },
    });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "unchanged", state: "approved" });
    expect(state.writes).toHaveLength(0);
  });

  it("valeur deja correcte -> aucune ecriture (pas de boucle de triggers)", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "pending" } },
      ages: { p1: "U15" },
    });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "unchanged", state: "pending" });
    expect(state.writes).toHaveLength(0);
  });

  it("membership ANCIEN sans le champ -> le champ est pose (default-deny si age inconnu)", async () => {
    const state = mk({ members: { "clubA/p1": { role: "player", coachAccess: undefined } } });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: undefined, to: "pending" });
    expect(state.writes).toEqual([{ clubId: "clubA", playerUid: "p1", state: "pending" }]);
  });

  it("aucun membership -> rien a autoriser, aucune ecriture (jamais de creation)", async () => {
    const state = mk();
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "no-member" });
    expect(state.writes).toHaveLength(0);
  });

  it("un coach n'a pas d'etat d'acces a son propre suivi -> ignore", async () => {
    const state = mk({ members: { "clubA/c1": { role: "coach", coachAccess: undefined } } });
    const res = await syncCoachAccessFromProfile(fakeStore(state), "clubA", "c1");
    expect(res).toEqual({ action: "not-player" });
    expect(state.writes).toHaveLength(0);
  });
});
