// functions/tests/accountPurge.test.ts
// Logique pure de la suppression de compte : construction de la liste des
// documents club à purger. Aucune dépendance Firebase.

import { buildClubPurgePaths, collectClubIds } from "../src/accountPurge";

describe("collectClubIds", () => {
  it("garde les ids valides dans l'ordre, sans doublon", () => {
    expect(collectClubIds(["club-a", "club-b", "club-a"])).toEqual(["club-a", "club-b"]);
  });

  it("trim les ids et déduplique après trim", () => {
    expect(collectClubIds([" club-a ", "club-a"])).toEqual(["club-a"]);
  });

  it("ignore non-string, vide, blanc et pseudo-chemins", () => {
    expect(
      collectClubIds([null, undefined, 42, "", "   ", "clubs/x/members/y", { clubId: "x" }]),
    ).toEqual([]);
  });

  it("liste vide → liste vide", () => {
    expect(collectClubIds([])).toEqual([]);
  });
});

describe("buildClubPurgePaths", () => {
  it("produit membership + projection coach-safe pour chaque club", () => {
    expect(buildClubPurgePaths("uid-1", ["club-a", "club-b"])).toEqual([
      "clubs/club-a/members/uid-1",
      "clubs/club-a/playerSummaries/uid-1",
      "clubs/club-b/members/uid-1",
      "clubs/club-b/playerSummaries/uid-1",
    ]);
  });

  it("déduplique les clubs découverts deux fois (profil + membership)", () => {
    expect(buildClubPurgePaths("uid-1", ["club-a", "club-a"])).toEqual([
      "clubs/club-a/members/uid-1",
      "clubs/club-a/playerSummaries/uid-1",
    ]);
  });

  it("aucun club → aucune purge club (utilisateur sans club)", () => {
    expect(buildClubPurgePaths("uid-1", [])).toEqual([]);
    expect(buildClubPurgePaths("uid-1", [null, undefined, ""])).toEqual([]);
  });

  it("uid vide ou invalide → aucune purge (garde-fou)", () => {
    expect(buildClubPurgePaths("", ["club-a"])).toEqual([]);
    expect(buildClubPurgePaths("   ", ["club-a"])).toEqual([]);
    expect(buildClubPurgePaths("a/b", ["club-a"])).toEqual([]);
  });

  it("tolère un clubId non-string mélangé à des valides (candidats bruts)", () => {
    expect(buildClubPurgePaths("uid-1", [undefined, "club-a", 7])).toEqual([
      "clubs/club-a/members/uid-1",
      "clubs/club-a/playerSummaries/uid-1",
    ]);
  });
});
