// functions/tests/coachAccess.test.ts
//
// AUTORISATION D'ACCES AUX DONNEES DE SUIVI — couches 2 et 3 (projecteur serveur
// + Cloud Functions). Tests UNITAIRES purs, aucun emulateur.
//
// Ce que cette suite verrouille :
//  1. la decision elle-meme (default-deny sur toute valeur non autorisante) ;
//  2. l'etat INITIAL au rattachement, gouverne par la SEULE politique du club —
//     et l'absence totale de verrou d'age dans ce chemin ;
//  3. le fait que le PROJECTEUR ne produit RIEN quand l'etat refuse — donc que
//     rebuild supprime la projection existante (chemin `null` deja teste) ;
//  4. la reparation serveur : elle ne fabrique jamais un "approved", ne
//     reevalue jamais un etat deja pose, et n'ecrit que si elle change quelque
//     chose.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  COACH_ACCESS_FIELD,
  COACH_ACCESS_GRANTING_STATES,
  COACH_ACCESS_STATES,
  initialCoachAccess,
  isCoachAccessGranted,
  isMembershipCoachAccessGranted,
  normalizeCoachAccess,
  resolveCoachAccess,
} from "../src/coachAccess";
import {
  ensureCoachAccessState,
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

// ─── 2. Etat initial au rattachement : la politique, PAS l'age ──────────────

describe("initialCoachAccess — plus AUCUN verrou d'age", () => {
  it("le mode par defaut ouvre la projection non sensible", () => {
    expect(initialCoachAccess("automatic_safe_projection")).toBe("not_required");
    expect(initialCoachAccess(undefined)).toBe("not_required");
  });

  it("le mode approval_required pose pending", () => {
    expect(initialCoachAccess("approval_required")).toBe("pending");
  });

  it("une CATEGORIE D'AGE passee ici n'est pas une politique : elle vaut le defaut", () => {
    // Temoin explicite de la suppression du verrou. Avant, "U15" produisait
    // "pending" et "Senior" produisait "not_required". Desormais, aucune de ces
    // chaines n'est une politique reconnue : elles retombent toutes sur le
    // defaut, donc sur le MEME etat. Un mineur et un adulte sont indiscernables
    // pour cette fonction.
    for (const age of ["U13", "U15", "U17", "U18", "Senior", "u15", "adulte", 15, {}]) {
      expect(initialCoachAccess(age)).toBe("not_required");
    }
  });

  it("le fichier de decision ne contient plus AUCUN symbole d'age", () => {
    // Verrou de non-regression lisible : reintroduire normalizeAgeCategory ou
    // une liste de categories dans le chemin de decision fait echouer ce test.
    // On ne juge que le CODE (les commentaires, eux, ont le droit d'expliquer
    // pourquoi le verrou d'age a ete retire).
    const code = readFileSync(resolve(__dirname, "..", "src", "coachAccess.ts"), "utf8")
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    for (const symbole of ["normalizeAgeCategory", "ageCategory", "AgeCategory", "coachLabels"]) {
      expect(code).not.toContain(symbole);
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

// ─── 4. Reparation serveur ──────────────────────────────────────────────────

describe("resolveCoachAccess — ne fabrique ni ne retire jamais une autorisation", () => {
  it("TOUT etat deja pose est conserve, dans les deux modes", () => {
    for (const politique of ["automatic_safe_projection", "approval_required", undefined]) {
      expect(resolveCoachAccess("approved", politique)).toBe("approved");
      expect(resolveCoachAccess("revoked", politique)).toBe("revoked");
      expect(resolveCoachAccess("pending", politique)).toBe("pending");
      expect(resolveCoachAccess("not_required", politique)).toBe("not_required");
    }
  });

  it("changer la politique NE REEVALUE PAS un membre existant", () => {
    // Un club qui bascule en approval_required ne perd pas la visibilite sur
    // ses membres deja rattaches : leur "not_required" reste tel quel.
    expect(resolveCoachAccess("not_required", "approval_required")).toBe("not_required");
    // Et l'inverse est vrai aussi : repasser en mode par defaut n'ouvre pas
    // d'un coup les acces laisses en attente.
    expect(resolveCoachAccess("pending", "automatic_safe_projection")).toBe("pending");
  });

  it("une valeur ILLISIBLE est reparee selon la politique du club", () => {
    expect(resolveCoachAccess(undefined, "approval_required")).toBe("pending");
    expect(resolveCoachAccess("APPROVED", "approval_required")).toBe("pending");
    expect(resolveCoachAccess(undefined, "automatic_safe_projection")).toBe("not_required");
    expect(resolveCoachAccess("", undefined)).toBe("not_required");
  });

  it("ne produit JAMAIS approved, quelle que soit l'entree", () => {
    const etats: unknown[] = ["pending", "not_required", "revoked", "", undefined, null, "bidon"];
    const politiques: unknown[] = [
      "automatic_safe_projection",
      "approval_required",
      undefined,
      "inconnu",
      {},
    ];
    for (const e of etats) {
      for (const p of politiques) {
        expect(resolveCoachAccess(e, p)).not.toBe("approved");
      }
    }
  });
});

type FakeState = {
  members: Record<string, MemberSnapshot | null>;
  policies: Record<string, unknown>;
  writes: { clubId: string; playerUid: string; state: string }[];
  /** Clubs dont la politique a REELLEMENT ete lue (mesure du cout). */
  policyReads: string[];
};

const fakeStore = (state: FakeState): MemberAccessStore => ({
  async readMember(clubId, playerUid) {
    return state.members[`${clubId}/${playerUid}`] ?? null;
  },
  async readClubPolicy(clubId) {
    state.policyReads.push(clubId);
    return state.policies[clubId];
  },
  async writeCoachAccess(clubId, playerUid, s) {
    state.writes.push({ clubId, playerUid, state: s });
  },
});

describe("ensureCoachAccessState — reparation, jamais reevaluation", () => {
  const mk = (over: Partial<FakeState> = {}): FakeState => ({
    members: {},
    policies: {},
    writes: [],
    policyReads: [],
    ...over,
  });

  it("membership ANCIEN sans le champ, club en mode par defaut -> not_required", async () => {
    const state = mk({ members: { "clubA/p1": { role: "player", coachAccess: undefined } } });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: undefined, to: "not_required" });
    expect(state.writes).toEqual([{ clubId: "clubA", playerUid: "p1", state: "not_required" }]);
  });

  it("membership ANCIEN sans le champ, club en approval_required -> pending", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: undefined } },
      policies: { clubA: "approval_required" },
    });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: undefined, to: "pending" });
  });

  it("valeur ILLISIBLE -> reparee, jamais laissee telle quelle", async () => {
    const state = mk({ members: { "clubA/p1": { role: "player", coachAccess: "APPROVED" } } });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "updated", from: "APPROVED", to: "not_required" });
  });

  it("un approved n'est JAMAIS retouche (aucune ecriture, donc aucun re-declenchement)", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "approved" } },
      policies: { clubA: "approval_required" },
    });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "unchanged", state: "approved" });
    expect(state.writes).toHaveLength(0);
  });

  it("un revoked n'est JAMAIS reveille, meme en mode par defaut", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "revoked" } },
      policies: { clubA: "automatic_safe_projection" },
    });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "unchanged", state: "revoked" });
    expect(state.writes).toHaveLength(0);
  });

  it("un not_required n'est PAS resserre quand le club passe en approval_required", async () => {
    const state = mk({
      members: { "clubA/p1": { role: "player", coachAccess: "not_required" } },
      policies: { clubA: "approval_required" },
    });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "unchanged", state: "not_required" });
    expect(state.writes).toHaveLength(0);
  });

  it("etat deja pose -> la politique du club n'est meme PAS lue (cout nul)", async () => {
    const state = mk({ members: { "clubA/p1": { role: "player", coachAccess: "pending" } } });
    await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(state.policyReads).toHaveLength(0);
  });

  it("aucun membership -> rien a autoriser, aucune ecriture (jamais de creation)", async () => {
    const state = mk();
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "p1");
    expect(res).toEqual({ action: "no-member" });
    expect(state.writes).toHaveLength(0);
    expect(state.policyReads).toHaveLength(0);
  });

  it("un coach n'a pas d'etat d'acces a son propre suivi -> ignore", async () => {
    const state = mk({ members: { "clubA/c1": { role: "coach", coachAccess: undefined } } });
    const res = await ensureCoachAccessState(fakeStore(state), "clubA", "c1");
    expect(res).toEqual({ action: "not-player" });
    expect(state.writes).toHaveLength(0);
  });

  it("MINEUR et ADULTE, memes conditions -> MEME etat (aucune lecture d'age)", async () => {
    // Le magasin n'expose meme plus de canal pour l'age : le port
    // `MemberAccessStore` ne sait plus lire un profil. Ce test le prouve par le
    // resultat, la signature du port le prouve par la compilation.
    const state = mk({
      members: {
        "clubA/mineur": { role: "player", coachAccess: undefined },
        "clubA/adulte": { role: "player", coachAccess: undefined },
      },
    });
    const store = fakeStore(state);
    const a = await ensureCoachAccessState(store, "clubA", "mineur");
    const b = await ensureCoachAccessState(store, "clubA", "adulte");
    expect(a).toEqual({ action: "updated", from: undefined, to: "not_required" });
    expect(b).toEqual({ action: "updated", from: undefined, to: "not_required" });
  });
});
