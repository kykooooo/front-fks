// services/__tests__/registerAccount.test.ts
//
// CRÉATION DE COMPTE — exécutée avec des promesses contrôlées.
// Aucun Firebase : les dépendances sont injectées, aucun compte réel créé.

import { createSubmitGuard, registerAccount, type RegisterDeps } from "../registerAccount";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

function harnais(over: Partial<RegisterDeps> = {}) {
  const journal: string[] = [];
  const docs: Array<Record<string, unknown>> = [];
  const deps: RegisterDeps = {
    createUser: async (email) => {
      journal.push("createUser");
      return { uid: "uid-1", email, raw: { uid: "uid-1" } };
    },
    updateDisplayName: async () => void journal.push("updateDisplayName"),
    writeStartDoc: async (_uid, data) => {
      journal.push("writeStartDoc");
      docs.push(data);
    },
    markOnboardingStart: async () => void journal.push("chrono"),
    serverTimestamp: () => "TS",
    ...over,
  };
  return { deps, journal, docs };
}

const saisie = { email: "lina@example.com", password: "motdepasse123", firstName: " Lina " };

describe("les trois issues", () => {
  test("compte NON créé : le code Firebase remonte, rien d'autre n'est tenté", async () => {
    const h = harnais({ createUser: async () => { throw { code: "auth/email-already-in-use" }; } });
    await expect(registerAccount(h.deps, saisie)).resolves.toEqual({ status: "failed", code: "auth/email-already-in-use" });
    expect(h.journal).toEqual([]);
  });

  test("compte créé et document de départ écrit", async () => {
    const h = harnais();
    await expect(registerAccount(h.deps, saisie)).resolves.toEqual({ status: "created", uid: "uid-1" });
    expect(h.docs[0]).toEqual({ email: "lina@example.com", displayName: "Lina", firstName: "Lina", createdAt: "TS", updatedAt: "TS" });
  });

  test("compte créé PUIS échec d'une opération secondaire : jamais « failed »", async () => {
    const h = harnais({ writeStartDoc: async () => { throw new Error("unavailable"); } });
    await expect(registerAccount(h.deps, saisie)).resolves.toEqual({ status: "created-degraded", uid: "uid-1", echecs: ["doc"] });

    const h2 = harnais({ updateDisplayName: async () => { throw new Error("network"); } });
    expect((await registerAccount(h2.deps, saisie)).status).toBe("created-degraded");
  });

  test("l'échec du seul chrono interne ne dégrade rien pour le joueur", async () => {
    const h = harnais({ markOnboardingStart: async () => { throw new Error("disque"); } });
    expect((await registerAccount(h.deps, saisie)).status).toBe("created");
  });
});

describe("l'écriture de l'inscription ne peut pas écraser le questionnaire", () => {
  test("le document est mis en file AVANT toute attente — même si updateProfile ne répond jamais", async () => {
    const nomLent = deferred<void>();
    const h = harnais({ updateDisplayName: () => { h.journal.push("updateDisplayName"); return nomLent.promise; } });
    const p = registerAccount(h.deps, saisie);
    await flush();
    // updateProfile est toujours en attente, et pourtant l'écriture est partie :
    // le SDK l'enverra donc avant celle du questionnaire, forcément postérieure.
    expect(h.journal.indexOf("writeStartDoc")).toBeGreaterThan(-1);
    expect(h.journal.indexOf("writeStartDoc")).toBeLessThan(h.journal.indexOf("updateDisplayName"));
    nomLent.resolve();
    await expect(p).resolves.toMatchObject({ status: "created" });
  });

  test("le contenu est inoffensif même s'il atterrissait tard : ni `profileCompleted`, ni prénom nul", async () => {
    const h = harnais();
    await registerAccount(h.deps, { ...saisie, firstName: "   " });
    const doc = h.docs[0];
    expect("profileCompleted" in doc).toBe(false);
    expect("firstName" in doc).toBe(false);
    expect("displayName" in doc).toBe(false);
    // Et jamais la partie locale de l'email en guise de prénom (règle 12).
    expect(JSON.stringify(doc)).not.toContain("\"lina\"");
  });

  test("le mot de passe n'entre dans aucune écriture", async () => {
    const h = harnais();
    await registerAccount(h.deps, saisie);
    expect(JSON.stringify(h.docs)).not.toContain("motdepasse123");
  });
});

describe("double soumission", () => {
  test("deux appuis dans la même frame : un seul compte créé", async () => {
    const creation = deferred<{ uid: string; email: string | null; raw: unknown }>();
    let appels = 0;
    const h = harnais({ createUser: () => { appels += 1; return creation.promise; } });
    const garde = createSubmitGuard();
    const a = garde.run(() => registerAccount(h.deps, saisie));
    const b = garde.run(() => registerAccount(h.deps, saisie));
    expect(garde.busy).toBe(true);
    creation.resolve({ uid: "uid-1", email: saisie.email, raw: {} });
    expect(await b).toBeUndefined(); // le second appui est ignoré
    expect((await a)?.status).toBe("created");
    expect(appels).toBe(1);
    expect(garde.busy).toBe(false);
  });

  test("après un échec, on peut réessayer (la garde se libère)", async () => {
    const garde = createSubmitGuard();
    await expect(garde.run(async () => { throw new Error("réseau"); })).rejects.toThrow("réseau");
    await expect(garde.run(async () => "ok")).resolves.toBe("ok");
  });
});
