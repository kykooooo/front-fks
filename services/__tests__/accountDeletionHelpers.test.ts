// services/__tests__/accountDeletionHelpers.test.ts
// Helpers PURS de la suppression de compte : clés locales à purger + mapping
// erreur → message FR. Aucune dépendance Firebase/RN.

import {
  deletionErrorMessage,
  localAccountKeysToPurge,
} from "../accountDeletionHelpers";

describe("localAccountKeysToPurge", () => {
  it("sans uid : purge les clés globales (queue offline, welcome, notifs, tests legacy)", () => {
    const keys = localAccountKeysToPurge(null);
    expect(keys).toEqual(
      expect.arrayContaining([
        "fks_offline_queue",
        "fks_welcome_done",
        "fks_onboarding_start_ts",
        "fks_tests_v1",
        "fks_push_token",
        "fks_notif_prefs",
      ]),
    );
    // Aucune clé par-uid ne doit apparaître sans uid.
    expect(keys.some((k) => k.startsWith("fks-snapshot-v2-"))).toBe(false);
    expect(keys.some((k) => k.startsWith("training-store-snapshot-"))).toBe(false);
  });

  it("avec uid : ajoute snapshot cross-stores, ancien snapshot et tests terrain par uid", () => {
    const keys = localAccountKeysToPurge("uid-42");
    expect(keys).toEqual(
      expect.arrayContaining([
        "fks-snapshot-v2-uid-42",
        "training-store-snapshot-uid-42",
        "fks_tests_v1_uid-42",
      ]),
    );
  });

  it("trim l'uid et ignore un uid blanc", () => {
    expect(localAccountKeysToPurge("  uid-42  ")).toEqual(
      expect.arrayContaining(["fks-snapshot-v2-uid-42"]),
    );
    const blank = localAccountKeysToPurge("   ");
    expect(blank.some((k) => k.startsWith("fks-snapshot-v2-"))).toBe(false);
  });

  it("aucun doublon dans la liste", () => {
    const keys = localAccountKeysToPurge("uid-42");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("deletionErrorMessage", () => {
  const titleFor = (err: unknown) => deletionErrorMessage(err).title;

  it("mot de passe refusé (tous les codes Firebase connus)", () => {
    for (const code of [
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/missing-password",
      "auth/invalid-login-credentials",
    ]) {
      expect(titleFor({ code })).toBe("Mot de passe incorrect");
    }
  });

  it("trop de tentatives", () => {
    expect(titleFor({ code: "auth/too-many-requests" })).toBe("Trop de tentatives");
  });

  it("réseau : codes auth/functions + messages fetch", () => {
    for (const err of [
      { code: "auth/network-request-failed" },
      { code: "functions/unavailable" },
      { code: "functions/deadline-exceeded" },
      { message: "Network request failed" },
      { message: "TypeError: Failed to fetch" },
    ]) {
      expect(titleFor(err)).toBe("Pas de connexion");
    }
  });

  it("function pas encore déployée → message propre, pas de crash", () => {
    for (const code of ["functions/not-found", "functions/unimplemented"]) {
      const copy = deletionErrorMessage({ code });
      expect(copy.title).toBe("Service indisponible");
      expect(copy.message).toContain("kyllian@fks-app.com");
    }
  });

  it("session expirée / non authentifié", () => {
    for (const code of [
      "functions/unauthenticated",
      "auth/requires-recent-login",
      "auth/user-token-expired",
    ]) {
      expect(titleFor({ code })).toBe("Session expirée");
    }
  });

  it("fallback : échec serveur générique, compte conservé", () => {
    const copy = deletionErrorMessage({ code: "functions/internal" });
    expect(copy.title).toBe("Suppression échouée");
    expect(copy.message).toContain("Réessaie");
  });

  it("entrées dégénérées (null, string, objet vide) → fallback sans crash", () => {
    for (const err of [null, undefined, "boom", {}, 42]) {
      expect(titleFor(err)).toBe("Suppression échouée");
    }
  });
});
