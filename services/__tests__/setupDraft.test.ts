// services/__tests__/setupDraft.test.ts
//
// LE BROUILLON DU QUESTIONNAIRE — reprise, isolation entre comptes, contenu.
// Exécuté sur le vrai module, avec un stockage en mémoire à la place du
// stockage chiffré (dont on vérifie à part qu'il est bien celui de l'instance).

jest.mock("../encryptedStorage", () => ({
  __esModule: true,
  getEncryptedItem: jest.fn(async () => null),
  setEncryptedItem: jest.fn(async () => undefined),
  removeEncryptedItem: jest.fn(async () => undefined),
}));

import * as encrypted from "../encryptedStorage";
import {
  createSetupDraftStore,
  sanitizeDraftAnswers,
  setupDraft,
  SETUP_DRAFT_MAX_AGE_MS,
  type DraftStorage,
} from "../setupDraft";
import { localAccountKeysToPurge } from "../accountDeletionHelpers";
import { STORAGE_KEYS } from "../../constants/storage";

function memoire(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

const reponses = {
  firstName: "Lina",
  position: "Milieu",
  ageCategory: "U17",
  clubTrainingDays: ["tue", "thu"],
  matchDays: ["sat"],
  geneSetup: "oui" as const,
  geneZone: "genou",
  geneGravite: 2 as const,
};

describe("reprise après fermeture de l'application", () => {
  test("réponses ET étape sont relues pour le même compte", async () => {
    const stock = memoire();
    const avant = createSetupDraftStore(stock, () => 1_000);
    expect(await avant.save("uid-A", { step: 2, answers: reponses })).toBe(true);

    // « Redémarrage » : une nouvelle instance sur le même disque.
    const apres = createSetupDraftStore(stock, () => 5_000);
    const relu = await apres.load("uid-A");
    expect(relu?.step).toBe(2);
    expect(relu?.answers).toEqual(reponses);
  });

  test("un formulaire encore vide n'écrase pas un vrai brouillon", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 1, answers: reponses });
    expect(await store.save("uid-A", { step: 0, answers: {} })).toBe(false);
    expect((await store.load("uid-A"))?.answers.firstName).toBe("Lina");
  });
});

describe("isolation entre deux comptes", () => {
  test("le compte B ne voit jamais le brouillon du compte A", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 3, answers: reponses });
    expect(await store.load("uid-B")).toBeNull();
    await store.save("uid-B", { step: 1, answers: { firstName: "Noé" } });
    expect((await store.load("uid-A"))?.answers.firstName).toBe("Lina");
    expect((await store.load("uid-B"))?.answers.firstName).toBe("Noé");
  });

  test("une valeur rangée sous la clé d'un compte mais écrite pour un autre est jetée", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 1, answers: reponses });
    // Copie du brouillon de A sous la clé de B (disque trafiqué / bug de clé).
    stock.data.set(STORAGE_KEYS.SETUP_DRAFT("uid-B"), stock.data.get(STORAGE_KEYS.SETUP_DRAFT("uid-A")) as string);
    expect(await store.load("uid-B")).toBeNull();
    expect(stock.data.has(STORAGE_KEYS.SETUP_DRAFT("uid-B"))).toBe(false);
  });

  test("sans compte, rien n'est lu ni écrit", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock);
    expect(await store.save(null, { step: 1, answers: reponses })).toBe(false);
    expect(await store.load("")).toBeNull();
    expect(stock.data.size).toBe(0);
  });
});

describe("contenu : une liste fermée, jamais un secret", () => {
  test("mot de passe, email, jeton et clés inconnues sont jetés", () => {
    const propre = sanitizeDraftAnswers({
      ...reponses,
      password: "secret123",
      pwd: "secret123",
      email: "lina@example.com",
      token: "eyJhbGciOi",
      parentalConsentChecked: true,
    });
    expect(Object.keys(propre).sort()).toEqual(Object.keys(reponses).sort());
    expect(JSON.stringify(propre)).not.toMatch(/secret123|example\.com|eyJ/);
  });

  test("valeurs hors forme : jetées, jamais devinées", () => {
    expect(sanitizeDraftAnswers({ clubTrainingDays: ["tue", "mardi", 3, "tue"], geneGravite: 9, hasGymAccess: "parfois" }))
      .toEqual({ clubTrainingDays: ["tue"] });
    expect(sanitizeDraftAnswers(null)).toEqual({});
  });
});

describe("fin de vie", () => {
  test("clear supprime le brouillon (finalisation)", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 3, answers: reponses });
    await store.clear("uid-A");
    expect(await store.load("uid-A")).toBeNull();
    expect(stock.data.size).toBe(0);
  });

  test("un brouillon de plus de 30 jours est jeté", async () => {
    const stock = memoire();
    await createSetupDraftStore(stock, () => 0).save("uid-A", { step: 1, answers: reponses });
    const tard = createSetupDraftStore(stock, () => SETUP_DRAFT_MAX_AGE_MS + 1);
    expect(await tard.load("uid-A")).toBeNull();
    expect(stock.data.size).toBe(0);
  });

  test("un contenu illisible est jeté sans planter", async () => {
    const stock = memoire();
    stock.data.set(STORAGE_KEYS.SETUP_DRAFT("uid-A"), "{pas du json");
    expect(await createSetupDraftStore(stock).load("uid-A")).toBeNull();
  });

  test("un stockage en panne ne rejette jamais", async () => {
    const enPanne: DraftStorage = {
      getItem: async () => { throw new Error("disque"); },
      setItem: async () => { throw new Error("disque"); },
      removeItem: async () => { throw new Error("disque"); },
    };
    const store = createSetupDraftStore(enPanne);
    await expect(store.save("uid-A", { step: 1, answers: reponses })).resolves.toBe(false);
    await expect(store.load("uid-A")).resolves.toBeNull();
    await expect(store.clear("uid-A")).resolves.toBeUndefined();
  });

  test("la suppression de compte purge la clé du brouillon de CE compte", () => {
    expect(localAccountKeysToPurge("uid-A")).toContain(STORAGE_KEYS.SETUP_DRAFT("uid-A"));
    expect(localAccountKeysToPurge("uid-A")).not.toContain(STORAGE_KEYS.SETUP_DRAFT("uid-B"));
  });
});

describe("l'instance de l'application passe par le stockage CHIFFRÉ", () => {
  test("save / load / clear appellent services/encryptedStorage", async () => {
    await setupDraft.save("uid-A", { step: 1, answers: reponses });
    await setupDraft.load("uid-A");
    await setupDraft.clear("uid-A");
    const cle = STORAGE_KEYS.SETUP_DRAFT("uid-A");
    expect((encrypted.setEncryptedItem as jest.Mock).mock.calls[0][0]).toBe(cle);
    expect(encrypted.getEncryptedItem).toHaveBeenCalledWith(cle);
    expect(encrypted.removeEncryptedItem).toHaveBeenCalledWith(cle);
  });
});

// ─── Coordination par compte : ordre des sauvegardes et suppression ─────────
/** Stockage dont chaque `setItem` reste SUSPENDU jusqu'à ce que le test le libère. */
function stockageControle() {
  const data = new Map<string, string>();
  const enVol: Array<{ key: string; value: string; liberer: () => void }> = [];
  const storage: DraftStorage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: (k, v) =>
      new Promise<void>((resolve) => {
        enVol.push({ key: k, value: v, liberer: () => { data.set(k, v); resolve(); } });
      }),
    removeItem: async (k) => void data.delete(k),
  };
  return { storage, data, enVol };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const lu = (data: Map<string, string>, uid: string) => {
  const raw = data.get(STORAGE_KEYS.SETUP_DRAFT(uid));
  return raw ? (JSON.parse(raw) as { step: number; answers: Record<string, unknown> }) : null;
};

describe("coordination par compte", () => {
  test("deux sauvegardes : la DERNIÈRE demandée gagne, quel que soit l'ordre de réponse du disque", async () => {
    const c = stockageControle();
    const store = createSetupDraftStore(c.storage, () => 1_000);
    const p1 = store.save("uid-A", { step: 1, answers: { firstName: "Ancien" } });
    const p2 = store.save("uid-A", { step: 2, answers: { firstName: "Recent" } });
    await tick();
    // Une seule écriture est en vol à la fois : la seconde attend la première,
    // elle ne peut donc plus « finir avant » et se faire écraser ensuite.
    expect(c.enVol).toHaveLength(1);
    while (c.enVol.length > 0) { c.enVol.pop()!.liberer(); await tick(); }
    await Promise.all([p1, p2]);
    expect(lu(c.data, "uid-A")).toMatchObject({ step: 2, answers: { firstName: "Recent" } });
  });

  test("trois sauvegardes rapides : celle du milieu, dépassée, n'est même pas écrite", async () => {
    const c = stockageControle();
    const store = createSetupDraftStore(c.storage, () => 1_000);
    const p1 = store.save("uid-A", { step: 1, answers: { firstName: "un" } });
    const p2 = store.save("uid-A", { step: 1, answers: { firstName: "deux" } });
    const p3 = store.save("uid-A", { step: 1, answers: { firstName: "trois" } });
    const ecrites: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      await tick();
      const w = c.enVol.shift();
      if (w) { ecrites.push(JSON.parse(w.value).answers.firstName); w.liberer(); }
    }
    // Demandées dans la même frame : quand la file démarre, « un » et « deux »
    // sont déjà dépassées — elles ne touchent même pas le disque.
    expect(await Promise.all([p1, p2, p3])).toEqual([false, false, true]);
    expect(ecrites).toEqual(["trois"]);
    expect(lu(c.data, "uid-A")?.answers.firstName).toBe("trois");
  });

  test("sauvegarde SUSPENDUE, puis suppression, puis résolution tardive : le brouillon ne renaît pas", async () => {
    const c = stockageControle();
    const store = createSetupDraftStore(c.storage, () => 1_000);
    const pSave = store.save("uid-A", { step: 3, answers: { firstName: "Lina" } });
    await tick();
    expect(c.enVol).toHaveLength(1); // l'écriture est partie, elle n'a pas répondu
    const pAttente = store.save("uid-A", { step: 3, answers: { firstName: "En attente" } });
    let supprime = false;
    const pClear = store.clear("uid-A").then(() => { supprime = true; });
    await tick();
    expect(supprime).toBe(false); // la suppression ATTEND l'écriture engagée
    c.enVol.shift()!.liberer(); // résolution tardive
    await Promise.all([pSave, pAttente, pClear]);
    expect(await pAttente).toBe(false); // neutralisée : demandée avant la suppression
    expect(c.enVol).toHaveLength(0);
    expect(c.data.has(STORAGE_KEYS.SETUP_DRAFT("uid-A"))).toBe(false);
    expect(await store.load("uid-A")).toBeNull();
  });

  test("une sauvegarde demandée APRÈS la suppression est légitime (nouvelle saisie)", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 1, answers: { firstName: "Lina" } });
    await store.clear("uid-A");
    expect(await store.save("uid-A", { step: 0, answers: { firstName: "Noé" } })).toBe(true);
    expect((await store.load("uid-A"))?.answers.firstName).toBe("Noé");
  });

  test("indépendance : le compte A bloqué ne retarde ni ne périme le compte B", async () => {
    const c = stockageControle();
    const store = createSetupDraftStore(c.storage, () => 1_000);
    void store.save("uid-A", { step: 1, answers: { firstName: "A" } });
    const pB = store.save("uid-B", { step: 2, answers: { firstName: "B" } });
    await tick();
    expect(c.enVol.map((w) => w.key).sort()).toEqual([STORAGE_KEYS.SETUP_DRAFT("uid-A"), STORAGE_KEYS.SETUP_DRAFT("uid-B")]);
    c.enVol.find((w) => w.key === STORAGE_KEYS.SETUP_DRAFT("uid-B"))!.liberer();
    expect(await pB).toBe(true); // B aboutit alors que A est toujours suspendu
    const pClearA = store.clear("uid-A");
    c.enVol.find((w) => w.key === STORAGE_KEYS.SETUP_DRAFT("uid-A"))!.liberer();
    await pClearA;
    expect(lu(c.data, "uid-B")?.answers.firstName).toBe("B"); // la suppression de A n'a pas touché B
    expect(c.data.has(STORAGE_KEYS.SETUP_DRAFT("uid-A"))).toBe(false);
  });
});

describe("absent ≠ vidé", () => {
  test("une réponse explicitement vidée est conservée et relue telle quelle", async () => {
    const stock = memoire();
    const store = createSetupDraftStore(stock, () => 1_000);
    await store.save("uid-A", { step: 2, answers: { matchDays: [], selfReportedGapOption: "", firstName: "Lina" } });
    const relu = await store.load("uid-A");
    expect(relu?.answers).toEqual({ matchDays: [], selfReportedGapOption: "", firstName: "Lina" });
    expect("clubTrainingDays" in (relu?.answers ?? {})).toBe(false); // jamais approché = absent
  });
});
