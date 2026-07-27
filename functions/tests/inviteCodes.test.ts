// functions/tests/inviteCodes.test.ts
//
// Contrat d'invitation club — tests unitaires du coeur (aucun emulateur).
//
// Le magasin est remplace par un faux qui rejoue la semantique OPTIMISTE des
// transactions Firestore : chaque lecture memorise la version du document, et
// le commit est refuse (puis rejoue) si l'un des documents lus a change entre
// temps. C'est ce qui rend testable, sans infrastructure, l'invariant le plus
// important du quota : deux rattachements simultanes ne peuvent pas depasser
// `maxUses`.

import {
  EMPTY_ATTEMPT_STATE,
  INVITE_ATTEMPT_BLOCK_MS,
  INVITE_ATTEMPT_MAX_PER_ORIGIN,
  INVITE_ATTEMPT_MAX_PER_USER,
  INVITE_ATTEMPT_WINDOW_MS,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_CODE_MAX_USES,
  INVITE_CODE_TTL_MS,
  INVITE_RATE_LIMITED_CODE,
  INVITE_REJECTED_CODE,
  INVITE_REJECTED_MESSAGE,
  INVITE_UNAVAILABLE_CODE,
  InviteError,
  evaluateInviteRecord,
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteRejectedError,
  invitePaths,
  isAttemptBlocked,
  issueInviteCode,
  joinClubWithCode,
  normalizeInviteCode,
  readAttemptState,
  registerAttemptFailure,
  type AbuseSignal,
  type DocData,
  type InviteRejectionReason,
  type InviteStore,
  type InviteTx,
} from "../src/inviteCodes";

// ─── Faux magasin transactionnel ────────────────────────────────────────────

type Stored = { data: DocData; version: number };

class FakeStore implements InviteStore {
  readonly docs = new Map<string, Stored>();
  readonly failReads = new Set<string>();
  readonly failWrites = new Set<string>();
  /** Hook d'entrelacement : appele a CHAQUE lecture transactionnelle. */
  onTxRead: ((path: string) => Promise<void> | void) | null = null;
  transactionAttempts = 0;

  seed(path: string, data: DocData): void {
    this.docs.set(path, { data: { ...data }, version: 0 });
  }

  read(path: string): DocData | null {
    return this.docs.get(path)?.data ?? null;
  }

  private write(path: string, data: DocData, merge: boolean): void {
    const current = this.docs.get(path);
    const next = merge && current ? { ...current.data, ...data } : { ...data };
    this.docs.set(path, { data: next, version: (current?.version ?? 0) + 1 });
  }

  async get(path: string): Promise<DocData | null> {
    if (this.failReads.has(path)) throw new Error("read failed");
    return this.read(path);
  }

  async set(path: string, data: DocData, opts?: { merge?: boolean }): Promise<void> {
    if (this.failWrites.has(path)) throw new Error("write failed");
    this.write(path, data, opts?.merge ?? false);
  }

  async runTransaction<T>(fn: (tx: InviteTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      this.transactionAttempts += 1;
      const readVersions = new Map<string, number>();
      const writes: { path: string; data: DocData; merge: boolean }[] = [];

      const tx: InviteTx = {
        get: async (path) => {
          if (this.failReads.has(path)) throw new Error("read failed");
          readVersions.set(path, this.docs.get(path)?.version ?? -1);
          const snapshot = this.read(path);
          if (this.onTxRead) await this.onTxRead(path);
          return snapshot;
        },
        set: (path, data, opts) => {
          writes.push({ path, data, merge: opts?.merge ?? false });
        },
      };

      const result = await fn(tx);

      const conflict = [...readVersions.entries()].some(
        ([path, version]) => (this.docs.get(path)?.version ?? -1) !== version,
      );
      if (conflict) continue;

      for (const w of writes) this.write(w.path, w.data, w.merge);
      return result;
    }
    throw new Error("TRANSACTION_CONTENTION");
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CLUB = "clubX";
const OWNER = "coachOwner";
const COACH = "coachStaff";
const PLAYER = "playerA";
const NOW = Date.UTC(2026, 6, 27, 10, 0, 0);

/** Alea deterministe : suite d'octets fournie telle quelle. */
const bytesFrom = (values: number[]) => {
  let cursor = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = values[cursor++ % values.length];
    return out;
  };
};

function baseStore(): FakeStore {
  const store = new FakeStore();
  store.seed(invitePaths.club(CLUB), { name: "AS Test", ownerUid: OWNER });
  store.seed(invitePaths.member(CLUB, OWNER), { uid: OWNER, role: "coach" });
  store.seed(invitePaths.member(CLUB, COACH), { uid: COACH, role: "coach" });
  return store;
}

const deps = (store: FakeStore, over: Partial<Parameters<typeof joinClubWithCode>[0]> = {}) => ({
  store,
  now: () => NOW,
  ...over,
});

/** Pose un code valide directement (sans passer par l'emission). */
function seedCode(
  store: FakeStore,
  canonical: string,
  over: Partial<DocData> = {},
): string {
  const hash = hashInviteCode(canonical);
  store.seed(invitePaths.code(hash), {
    clubId: CLUB,
    createdBy: OWNER,
    createdAt: NOW - 1000,
    expiresAt: NOW + INVITE_CODE_TTL_MS,
    maxUses: INVITE_CODE_MAX_USES,
    uses: 0,
    revokedAt: null,
    ...over,
  });
  return hash;
}

const catchInvite = async (p: Promise<unknown>): Promise<InviteError> => {
  try {
    await p;
  } catch (err) {
    if (err instanceof InviteError) return err;
    throw err;
  }
  throw new Error("aucune erreur levee");
};

// ─── 1. Generation ──────────────────────────────────────────────────────────

describe("generateInviteCode — entropie, alphabet, format", () => {
  test("alphabet sans caracteres ambigus (ni I, L, O, 0, 1) et 31 symboles distincts", () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(31);
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(31);
    for (const forbidden of ["I", "L", "O", "0", "1"]) {
      expect(INVITE_CODE_ALPHABET.includes(forbidden)).toBe(false);
    }
  });

  test("entropie reelle >= 48 bits (exigence du contrat)", () => {
    const bits = INVITE_CODE_LENGTH * Math.log2(INVITE_CODE_ALPHABET.length);
    expect(bits).toBeGreaterThanOrEqual(48);
  });

  test("code de la bonne longueur, uniquement dans l'alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`));
    }
  });

  test("200 tirages consecutifs : aucune collision (preuve grossiere d'alea reel)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateInviteCode());
    expect(seen.size).toBe(200);
  });

  test("echantillonnage par REJET : un octet dont les 5 bits de poids faible valent 31 est ignore, pas replie", () => {
    // 31 = hors alphabet (indices 0..30). Un modulo l'aurait replie sur 'A' et
    // rendu la premiere lettre plus probable ; ici il doit etre saute.
    const code = generateInviteCode(bytesFrom([31, 0, 31, 1, 31, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(code.startsWith("ABC")).toBe(true);
  });

  test("format affiche groupe par 5, et la normalisation revient au code canonique", () => {
    const canonical = generateInviteCode();
    const display = formatInviteCode(canonical);
    expect(display).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(normalizeInviteCode(display)).toBe(canonical);
  });
});

// ─── 2. Normalisation & hachage ─────────────────────────────────────────────

describe("normalizeInviteCode / hashInviteCode", () => {
  test("majuscules, separateurs et espaces retires (le piege 'espace au lieu du tiret' est ferme)", () => {
    expect(normalizeInviteCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCode("ABCDE FGHJK")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCode(" abcde . fghjk ")).toBe("ABCDEFGHJK");
    expect(hashInviteCode(normalizeInviteCode("abcde fghjk"))).toBe(
      hashInviteCode(normalizeInviteCode("ABCDE-FGHJK")),
    );
  });

  test("entree non-chaine ou vide → chaine vide (jamais de crash)", () => {
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(42)).toBe("");
    expect(normalizeInviteCode("   ")).toBe("");
  });

  test("empreinte SHA-256 : 64 hex, stable, ne contient pas le code", () => {
    const hash = hashInviteCode("ABCDEFGHJK");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInviteCode("ABCDEFGHJK"));
    expect(hash).not.toContain("ABCDEFGHJK");
    expect(hashInviteCode("ABCDEFGHJM")).not.toBe(hash);
  });
});

// ─── 3. Jugement d'un code stocke ───────────────────────────────────────────

describe("evaluateInviteRecord", () => {
  const record = {
    clubId: CLUB,
    expiresAt: NOW + 1000,
    maxUses: 5,
    uses: 0,
    revokedAt: null,
  };

  test("code sain → ok", () => {
    expect(evaluateInviteRecord(record, NOW)).toEqual({ ok: true, record });
  });

  test("absent / malforme / revoque / expire / epuise → refus type", () => {
    expect(evaluateInviteRecord(null, NOW)).toEqual({ ok: false, reason: "unknown" });
    expect(evaluateInviteRecord({ clubId: CLUB }, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(evaluateInviteRecord({ ...record, revokedAt: NOW - 1 }, NOW)).toEqual({
      ok: false,
      reason: "revoked",
    });
    expect(evaluateInviteRecord({ ...record, expiresAt: NOW }, NOW)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(evaluateInviteRecord({ ...record, uses: 5 }, NOW)).toEqual({
      ok: false,
      reason: "exhausted",
    });
  });
});

// ─── 4. Emission ────────────────────────────────────────────────────────────

describe("issueClubInviteCode — emission reservee au coach, empreinte seule en base", () => {
  test("l'owner emet : code affichable renvoye UNE fois, seule l'empreinte est stockee", async () => {
    const store = baseStore();
    const result = await issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB });

    expect(result.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(result.expiresAt).toBe(NOW + INVITE_CODE_TTL_MS);
    expect(result.maxUses).toBe(INVITE_CODE_MAX_USES);
    expect(result.replacedPrevious).toBe(false);

    const canonical = normalizeInviteCode(result.code);
    const hash = hashInviteCode(canonical);
    const stored = store.read(invitePaths.code(hash));
    expect(stored).toMatchObject({
      clubId: CLUB,
      createdBy: OWNER,
      expiresAt: NOW + INVITE_CODE_TTL_MS,
      maxUses: INVITE_CODE_MAX_USES,
      uses: 0,
      revokedAt: null,
    });

    // NON REVERSIBILITE : le code en clair n'apparait dans AUCUN document,
    // ni comme valeur, ni comme identifiant de document.
    const dump = JSON.stringify([...store.docs.entries()]);
    expect(dump).not.toContain(canonical);
  });

  test("un membre coach (non owner) peut emettre ; un joueur NON", async () => {
    const store = baseStore();
    await expect(issueInviteCode(deps(store), { uid: COACH, clubId: CLUB })).resolves.toBeTruthy();

    store.seed(invitePaths.member(CLUB, PLAYER), { uid: PLAYER, role: "player" });
    const err = await catchInvite(issueInviteCode(deps(store), { uid: PLAYER, clubId: CLUB }));
    expect(err.code).toBe("permission-denied");
  });

  test("inconnu du club, club absent, clubId vide : refus explicites", async () => {
    const store = baseStore();
    expect((await catchInvite(issueInviteCode(deps(store), { uid: "etranger", clubId: CLUB }))).code).toBe(
      "permission-denied",
    );
    expect((await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: "nope" }))).code).toBe(
      "not-found",
    );
    expect((await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: "" }))).code).toBe(
      "invalid-argument",
    );
  });

  test("emettre un nouveau code REVOQUE le precedent (un seul code vivant par club)", async () => {
    const store = baseStore();
    const first = await issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB });
    const firstHash = hashInviteCode(normalizeInviteCode(first.code));

    const second = await issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB });
    expect(second.replacedPrevious).toBe(true);
    expect(second.code).not.toBe(first.code);

    expect(store.read(invitePaths.code(firstHash))?.revokedAt).toBe(NOW);
    expect(store.read(invitePaths.meta(CLUB))?.activeCodeHash).toBe(
      hashInviteCode(normalizeInviteCode(second.code)),
    );

    // Et l'ancien code ne rattache plus personne.
    const err = await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, rawCode: first.code }),
    );
    expect(err.code).toBe(INVITE_REJECTED_CODE);
  });
});

// ─── 5. Rattachement ────────────────────────────────────────────────────────

describe("joinClubWithInviteCode — chemin nominal", () => {
  test("code valide : membership + clubId ecrits par le serveur, usage consomme", async () => {
    const store = baseStore();
    const hash = seedCode(store, "ABCDEFGHJK");

    const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "abcde-fghjk" });

    expect(result).toEqual({ clubId: CLUB, clubName: "AS Test", alreadyMember: false });
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toMatchObject({
      uid: PLAYER,
      role: "player",
    });
    // Le membership NE PORTE PLUS de code : la preuve d'invitation n'est plus
    // un champ client, c'est l'ecriture serveur elle-meme.
    expect(store.read(invitePaths.member(CLUB, PLAYER))).not.toHaveProperty("inviteCode");
    expect(store.read(invitePaths.user(PLAYER))).toMatchObject({ clubId: CLUB });
    expect(store.read(invitePaths.code(hash))?.uses).toBe(1);
  });

  test("rejeu du MEME joueur : aucun usage supplementaire consomme", async () => {
    const store = baseStore();
    const hash = seedCode(store, "ABCDEFGHJK");

    await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
    const second = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });

    expect(second.alreadyMember).toBe(true);
    expect(store.read(invitePaths.code(hash))?.uses).toBe(1);
  });
});

// ─── 6. AUCUN ORACLE ────────────────────────────────────────────────────────

describe("joinClubWithInviteCode — reponse d'erreur STRICTEMENT identique", () => {
  test("inviteRejectedError renvoie le meme objet quelle que soit la raison interne", () => {
    const reasons: InviteRejectionReason[] = [
      "malformed",
      "unknown",
      "expired",
      "revoked",
      "exhausted",
      "club-missing",
    ];
    const shapes = reasons.map((r) => {
      const e = inviteRejectedError(r);
      return { code: e.code, message: e.message };
    });
    for (const shape of shapes) expect(shape).toEqual(shapes[0]);
    expect(shapes[0]).toEqual({ code: INVITE_REJECTED_CODE, message: INVITE_REJECTED_MESSAGE });
  });

  test("de bout en bout : inconnu / expire / revoque / epuise / club disparu / saisie vide → meme code ET meme message", async () => {
    const scenarios: { label: string; build: () => Promise<unknown> }[] = [
      {
        label: "inconnu",
        build: () => {
          const store = baseStore();
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ZZZZZZZZZZ" });
        },
      },
      {
        label: "expire",
        build: () => {
          const store = baseStore();
          seedCode(store, "ABCDEFGHJK", { expiresAt: NOW - 1 });
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
        },
      },
      {
        label: "revoque",
        build: () => {
          const store = baseStore();
          seedCode(store, "ABCDEFGHJK", { revokedAt: NOW - 10 });
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
        },
      },
      {
        label: "epuise",
        build: () => {
          const store = baseStore();
          seedCode(store, "ABCDEFGHJK", { maxUses: 2, uses: 2 });
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
        },
      },
      {
        label: "club disparu",
        build: () => {
          const store = new FakeStore();
          seedCode(store, "ABCDEFGHJK");
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
        },
      },
      {
        label: "saisie vide",
        build: () => {
          const store = baseStore();
          return joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "   " });
        },
      },
    ];

    const observed: { code: string; message: string }[] = [];
    for (const scenario of scenarios) {
      const err = await catchInvite(scenario.build());
      observed.push({ code: err.code, message: err.message });
    }

    for (const shape of observed) {
      expect(shape).toEqual({ code: INVITE_REJECTED_CODE, message: INVITE_REJECTED_MESSAGE });
    }
  });

  test("un refus n'ecrit AUCUN membership et ne divulgue pas le club", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK", { revokedAt: NOW - 1 });
    await catchInvite(joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" }));
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toBeNull();
    expect(store.read(invitePaths.user(PLAYER))).toBeNull();
  });
});

// ─── 7. Quota : increment transactionnel concurrent ─────────────────────────

describe("quota d'usages — increment transactionnel", () => {
  test("deux rattachements CONCURRENTS sur un code a 1 usage : un seul passe, le quota n'est jamais depasse", async () => {
    const store = baseStore();
    const hash = seedCode(store, "ABCDEFGHJK", { maxUses: 1, uses: 0 });
    const codePath = invitePaths.code(hash);

    // Entrelacement force : pendant que le joueur A tient sa lecture du code,
    // le joueur B execute sa transaction ENTIERE et commite. A doit alors
    // detecter le conflit, rejouer, relire uses=1 et se faire refuser.
    let interleaved = false;
    store.onTxRead = async (path) => {
      if (path !== codePath || interleaved) return;
      interleaved = true;
      await joinClubWithCode(deps(store), { uid: "playerB", rawCode: "ABCDEFGHJK" });
    };

    const err = await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" }),
    );

    expect(interleaved).toBe(true);
    expect(err.code).toBe(INVITE_REJECTED_CODE);
    expect(store.read(codePath)?.uses).toBe(1);
    expect(store.read(invitePaths.member(CLUB, "playerB"))).toBeTruthy();
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toBeNull();
  });

  test("usages consommes un par un jusqu'a la borne, puis refus", async () => {
    const store = baseStore();
    const hash = seedCode(store, "ABCDEFGHJK", { maxUses: 2, uses: 0 });

    await joinClubWithCode(deps(store), { uid: "p1", rawCode: "ABCDEFGHJK" });
    await joinClubWithCode(deps(store), { uid: "p2", rawCode: "ABCDEFGHJK" });
    const err = await catchInvite(joinClubWithCode(deps(store), { uid: "p3", rawCode: "ABCDEFGHJK" }));

    expect(err.code).toBe(INVITE_REJECTED_CODE);
    expect(store.read(invitePaths.code(hash))?.uses).toBe(2);
  });
});

// ─── 8. Limitation de tentatives ────────────────────────────────────────────

describe("fenetre glissante — helpers purs", () => {
  test("etat vide, lecture defensive, blocage expire", () => {
    expect(readAttemptState(null)).toEqual(EMPTY_ATTEMPT_STATE);
    expect(readAttemptState({ failures: "nope", blockedUntil: "hier" })).toEqual(EMPTY_ATTEMPT_STATE);
    expect(isAttemptBlocked({ failures: [], blockedUntil: NOW - 1 }, NOW)).toBe(false);
    expect(isAttemptBlocked({ failures: [], blockedUntil: NOW + 1 }, NOW)).toBe(true);
  });

  test("les echecs HORS fenetre ne comptent pas", () => {
    const old = [NOW - INVITE_ATTEMPT_WINDOW_MS - 1, NOW - INVITE_ATTEMPT_WINDOW_MS - 2];
    const { next, thresholdReached } = registerAttemptFailure(
      { failures: old, blockedUntil: null },
      NOW,
      2,
    );
    expect(thresholdReached).toBe(false);
    expect(next.failures).toEqual([NOW]);
  });

  test("seuil atteint → blocage date, duree exportee", () => {
    const { next, thresholdReached } = registerAttemptFailure(
      { failures: [NOW - 10, NOW - 5], blockedUntil: null },
      NOW,
      3,
    );
    expect(thresholdReached).toBe(true);
    expect(next.blockedUntil).toBe(NOW + INVITE_ATTEMPT_BLOCK_MS);
  });
});

describe("limitation de tentatives — de bout en bout", () => {
  test("apres le seuil utilisateur, meme un code VALIDE est refuse (blocage, pas oracle)", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");

    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_USER; i++) {
      const err = await catchInvite(
        joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ZZZZZZZZZZ" }),
      );
      expect(err.code).toBe(INVITE_REJECTED_CODE);
    }

    const blocked = await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" }),
    );
    expect(blocked.code).toBe(INVITE_RATE_LIMITED_CODE);
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toBeNull();
  });

  test("le blocage EXPIRE : passe la duree, le code valide est de nouveau accepte", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");

    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_USER; i++) {
      await catchInvite(joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ZZZZZZZZZZ" }));
    }

    const later = NOW + INVITE_ATTEMPT_BLOCK_MS + 1;
    const result = await joinClubWithCode(
      { store, now: () => later },
      { uid: PLAYER, rawCode: "ABCDEFGHJK" },
    );
    expect(result.clubId).toBe(CLUB);
  });

  test("portee ORIGINE : un attaquant qui change de compte reste bloque par son IP", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    const ip = "203.0.113.7";

    // Chaque tentative utilise un compte NEUF : le compteur utilisateur ne
    // declenche jamais, seul le compteur d'origine monte.
    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_ORIGIN; i++) {
      await catchInvite(
        joinClubWithCode(deps(store), { uid: `jetable${i}`, originKey: ip, rawCode: "ZZZZZZZZZZ" }),
      );
    }

    const blocked = await catchInvite(
      joinClubWithCode(deps(store), { uid: "jetableNeuf", originKey: ip, rawCode: "ABCDEFGHJK" }),
    );
    expect(blocked.code).toBe(INVITE_RATE_LIMITED_CODE);

    // Une AUTRE origine n'est pas punie pour autant.
    const ok = await joinClubWithCode(deps(store), {
      uid: "joueurLegitime",
      originKey: "198.51.100.2",
      rawCode: "ABCDEFGHJK",
    });
    expect(ok.clubId).toBe(CLUB);
  });

  test("l'IP n'est jamais stockee en clair (cle de compteur hachee)", async () => {
    const store = baseStore();
    const ip = "203.0.113.7";
    await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, originKey: ip, rawCode: "ZZZZZZZZZZ" }),
    );
    const keys = [...store.docs.keys()].filter((k) => k.startsWith("inviteAttempts/"));
    expect(keys.length).toBe(2);
    expect(JSON.stringify([...store.docs.entries()])).not.toContain(ip);
  });

  test("FAIL-CLOSED : compteur illisible → acces refuse, jamais ouvert", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    store.failReads.add(invitePaths.attempt("uid_" + PLAYER));

    const err = await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" }),
    );
    expect(err.code).toBe(INVITE_UNAVAILABLE_CODE);
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toBeNull();
  });

  test("FAIL-CLOSED : compteur non ecrivable → le refus reste un refus (aucun rattachement)", async () => {
    const store = baseStore();
    store.failWrites.add(invitePaths.attempt("uid_" + PLAYER));

    const err = await catchInvite(
      joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ZZZZZZZZZZ" }),
    );
    expect(err.code).toBe(INVITE_REJECTED_CODE);
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toBeNull();
  });
});

// ─── 9. Journalisation ──────────────────────────────────────────────────────

describe("journalisation d'abus — sobre par construction", () => {
  test("signale UNIQUEMENT le franchissement de seuil, sans code ni empreinte", async () => {
    const store = baseStore();
    const signals: AbuseSignal[] = [];
    const d = { store, now: () => NOW, onAbuse: (s: AbuseSignal) => signals.push(s) };

    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_USER - 1; i++) {
      await catchInvite(joinClubWithCode(d, { uid: PLAYER, rawCode: "ZZZZZZZZZZ" }));
    }
    expect(signals).toHaveLength(0);

    await catchInvite(joinClubWithCode(d, { uid: PLAYER, rawCode: "ZZZZZZZZZZ" }));
    expect(signals).toHaveLength(1);
    expect(Object.keys(signals[0]).sort()).toEqual(["at", "scope", "uid"]);
    expect(signals[0]).toEqual({ scope: "user", uid: PLAYER, at: NOW });
  });
});
