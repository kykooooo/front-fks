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
  ISSUE_ATTEMPT_BLOCK_MS,
  ISSUE_ATTEMPT_MAX_PER_ORIGIN,
  ISSUE_ATTEMPT_MAX_PER_USER,
  ISSUE_ATTEMPT_POLICY,
  ISSUE_ATTEMPT_WINDOW_MS,
  ISSUE_REJECTED_CODE,
  ISSUE_REJECTED_MESSAGE,
  JOIN_ATTEMPT_POLICY,
  MAX_CLUB_ID_LENGTH,
  InviteError,
  evaluateInviteRecord,
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteRejectedError,
  invitePaths,
  isAttemptBlocked,
  isPlausibleClubId,
  issueInviteCode,
  issueRejectedError,
  joinClubWithCode,
  normalizeInviteCode,
  readAttemptState,
  registerAttemptFailure,
  type AbuseSignal,
  type DocData,
  type InviteRejectionReason,
  type InviteStore,
  type InviteTx,
  type IssueRejectionReason,
} from "../src/inviteCodes";
import type { ClubAuthoritySignal } from "../src/clubAuthority";

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
  // Le proprietaire porte le role "owner" : c'est ce que le PREDICAT D'AUTORITE
  // exige (ownerUid le designe ET son appartenance le confirme), et c'est ce
  // qu'ecrit desormais la creation de club. Un `accessRole: "coach"` ici serait
  // exactement l'etat incoherent que le predicat refuse — il est teste comme tel
  // dans "autorite incoherente", plus bas.
  store.seed(invitePaths.member(CLUB, OWNER), { uid: OWNER, accessRole: "owner" });
  store.seed(invitePaths.member(CLUB, COACH), { uid: COACH, accessRole: "coach" });
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

    store.seed(invitePaths.member(CLUB, PLAYER), { uid: PLAYER, playerStatus: "active" });
    const err = await catchInvite(issueInviteCode(deps(store), { uid: PLAYER, clubId: CLUB }));
    expect(err.code).toBe("permission-denied");
  });

  test("inconnu du club, club absent, clubId vide : refus INDISCERNABLES", async () => {
    // Trois causes distinctes, une seule reponse. Le detail de cette egalite est
    // verrouille dans la section 6bis ; ici on constate juste qu'aucun des trois
    // chemins ne se singularise.
    const store = baseStore();
    for (const attempt of [
      { uid: "etranger", clubId: CLUB },
      { uid: OWNER, clubId: "nope" },
      { uid: OWNER, clubId: "" },
    ]) {
      const err = await catchInvite(issueInviteCode(deps(store), attempt));
      expect(err.code).toBe(ISSUE_REJECTED_CODE);
      expect(err.message).toBe(ISSUE_REJECTED_MESSAGE);
    }
  });

  test("une emission REUSSIE n'ecrit aucun compteur de tentatives", async () => {
    // Le coach qui fait son travail n'est jamais rationne : seuls les REFUS
    // comptent. Emettre plusieurs fois d'affilee reste possible.
    const store = baseStore();
    for (let i = 0; i < 5; i++) {
      await expect(issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB })).resolves.toBeTruthy();
    }
    expect([...store.docs.keys()].some((k) => k.startsWith("inviteAttempts/"))).toBe(false);
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

// ─── 4 bis. Le PREDICAT D'AUTORITE gouverne aussi l'emission ────────────────
//
// Avant ce lot, l'emission accordait le droit sur `club.ownerUid === uid` SEUL,
// sans jamais lire l'appartenance : une source unique decidait d'un droit. Ces
// tests verrouillent le nouveau comportement — et surtout, ils prouvent que
// TOUTES les Functions consomment le meme predicat.

describe("issueClubInviteCode — autorite incoherente", () => {
  test("ownerUid designe l'appelant mais son appartenance dit 'coach' : REFUS + SIGNAL", async () => {
    const store = baseStore();
    // L'etat historique que ce lot supprime : le createur du club s'ecrivait
    // lui-meme en "coach". Il reste ENCADRANT (role coach), mais il n'est plus
    // autorise en tant que PROPRIETAIRE — et l'ecart doit etre signale.
    store.seed(invitePaths.member(CLUB, OWNER), { uid: OWNER, accessRole: "coach" });

    const signals: ClubAuthoritySignal[] = [];
    const err = await catchInvite(
      issueInviteCode(deps(store, { onInconsistency: (s) => signals.push(s) }), {
        uid: OWNER,
        clubId: CLUB,
      }),
    );

    expect(err.code).toBe(ISSUE_REJECTED_CODE);
    // Le message reste le refus GENERIQUE : signaler ne veut pas dire avouer.
    expect(err.message).toBe(ISSUE_REJECTED_MESSAGE);
    expect(signals).toEqual([
      {
        clubId: CLUB,
        uid: OWNER,
        authority: "designation-without-membership",
        action: "issueClubInviteCode",
      },
    ]);
  });

  test("appartenance 'owner' mais ownerUid designe un autre : REFUS + SIGNAL", async () => {
    const store = baseStore();
    store.seed(invitePaths.member(CLUB, COACH), { uid: COACH, accessRole: "owner" });

    const signals: ClubAuthoritySignal[] = [];
    const err = await catchInvite(
      issueInviteCode(deps(store, { onInconsistency: (s) => signals.push(s) }), {
        uid: COACH,
        clubId: CLUB,
      }),
    );

    expect(err.code).toBe(ISSUE_REJECTED_CODE);
    expect(signals).toHaveLength(1);
    expect(signals[0].authority).toBe("membership-without-designation");
  });

  test("ownerUid SANS aucune appartenance : REFUS (une source ne suffit plus)", async () => {
    const store = baseStore();
    store.docs.delete(invitePaths.member(CLUB, OWNER));

    const signals: ClubAuthoritySignal[] = [];
    const err = await catchInvite(
      issueInviteCode(deps(store, { onInconsistency: (s) => signals.push(s) }), {
        uid: OWNER,
        clubId: CLUB,
      }),
    );

    expect(err.code).toBe(ISSUE_REJECTED_CODE);
    expect(signals[0]?.authority).toBe("designation-without-membership");
  });

  test("un etat COHERENT n'emet AUCUN signal (owner comme coach ordinaire)", async () => {
    const signals: ClubAuthoritySignal[] = [];
    const store = baseStore();
    const d = deps(store, { onInconsistency: (s: ClubAuthoritySignal) => signals.push(s) });
    await expect(issueInviteCode(d, { uid: OWNER, clubId: CLUB })).resolves.toBeTruthy();
    await expect(issueInviteCode(d, { uid: COACH, clubId: CLUB })).resolves.toBeTruthy();
    expect(signals).toEqual([]);
  });
});

// ─── 5. Rattachement ────────────────────────────────────────────────────────

describe("joinClubWithInviteCode — chemin nominal", () => {
  test("code valide : membership + clubId ecrits par le serveur, usage consomme", async () => {
    const store = baseStore();
    const hash = seedCode(store, "ABCDEFGHJK");

    const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "abcde-fghjk" });

    // `coachAccess: "not_required"` = mode par DEFAUT du club (le document club
    // seede ne porte aucune politique). Le joueur est entre VOLONTAIREMENT avec
    // une invitation valide : sa projection coach NON SENSIBLE est active sans
    // validation administrative (cf. functions/src/joinAccessPolicy.ts).
    expect(result).toEqual({
      clubId: CLUB,
      clubName: "AS Test",
      alreadyMember: false,
      coachAccess: "not_required",
    });
    expect(store.read(invitePaths.member(CLUB, PLAYER))).toMatchObject({
      uid: PLAYER,
      playerStatus: "active",
      coachAccess: "not_required",
    });
    // Le membership NE PORTE PLUS de code : la preuve d'invitation n'est plus
    // un champ client, c'est l'ecriture serveur elle-meme.
    expect(store.read(invitePaths.member(CLUB, PLAYER))).not.toHaveProperty("inviteCode");
    expect(store.read(invitePaths.user(PLAYER))).toMatchObject({ clubId: CLUB });
    expect(store.read(invitePaths.code(hash))?.uses).toBe(1);
  });

  // ── Etat d'autorisation d'acces pose AU RATTACHEMENT ──────────────────────
  // C'est la POLITIQUE DU CLUB, et elle seule, qui decide de cet etat. Le profil
  // du joueur n'est meme pas lu sur ce chemin.

  test("club en approval_required -> pending (le joueur entre, son suivi attend)", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    store.seed(invitePaths.club(CLUB), {
      name: "AS Test",
      ownerUid: OWNER,
      joinAccessPolicy: "approval_required",
    });

    const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });

    expect(result.coachAccess).toBe("pending");
    expect(store.read(invitePaths.member(CLUB, PLAYER))?.coachAccess).toBe("pending");
  });

  test("club en automatic_safe_projection (explicite) -> not_required", async () => {
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    store.seed(invitePaths.club(CLUB), {
      name: "AS Test",
      ownerUid: OWNER,
      joinAccessPolicy: "automatic_safe_projection",
    });

    const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });

    expect(result.coachAccess).toBe("not_required");
  });

  test("politique ABSENTE, vide ou inconnue -> defaut serveur, donc not_required", async () => {
    for (const politique of [undefined, "", "   ", "APPROVAL_REQUIRED", "strict", 1, {}]) {
      const store = baseStore();
      seedCode(store, "ABCDEFGHJK");
      store.seed(invitePaths.club(CLUB), {
        name: "AS Test",
        ownerUid: OWNER,
        ...(politique === undefined ? {} : { joinAccessPolicy: politique }),
      });

      const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
      expect(result.coachAccess).toBe("not_required");
    }
  });

  test("AUCUN VERROU D'AGE : mineur et adulte obtiennent le MEME etat", async () => {
    // Memes conditions, seule la categorie d'age declaree change. Avant ce lot,
    // "U15" donnait "pending" et "Senior" donnait "not_required" — c'est
    // exactement ce qui vidait l'effectif d'un club de jeunes.
    const etats: string[] = [];
    for (const age of ["U13", "U15", "U17", "Senior", undefined]) {
      const store = baseStore();
      seedCode(store, "ABCDEFGHJK");
      store.seed(invitePaths.user(PLAYER), { uid: PLAYER, ...(age ? { ageCategory: age } : {}) });

      const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
      etats.push(result.coachAccess);
    }
    expect(new Set(etats).size).toBe(1);
    expect(etats[0]).toBe("not_required");
  });

  test("le profil du joueur n'est meme PAS LU pendant le rattachement", async () => {
    // Preuve la plus forte de l'absence de verrou d'age : la donnee n'entre pas
    // dans la transaction. Le profil EXISTE et porte "U13" — s'il etait lu, il
    // pourrait peser sur la decision. Il ne l'est pas.
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    store.seed(invitePaths.user(PLAYER), { uid: PLAYER, ageCategory: "U13" });

    const lectures: string[] = [];
    store.onTxRead = (path) => {
      lectures.push(path);
    };

    const result = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });

    expect(lectures).not.toContain(invitePaths.user(PLAYER));
    // Temoin positif : le club, lui, EST bien lu (c'est de la que vient la
    // politique). Sans ce temoin, l'assertion ci-dessus passerait meme si plus
    // rien n'etait lu du tout.
    expect(lectures).toContain(invitePaths.club(CLUB));
    expect(result.coachAccess).toBe("not_required");
  });

  test("rejeu : un acces DEJA accorde n'est jamais remis a zero, un acces retire jamais reveille", async () => {
    // approved conserve…
    const store = baseStore();
    seedCode(store, "ABCDEFGHJK");
    store.seed(invitePaths.member(CLUB, PLAYER), {
      uid: PLAYER, playerStatus: "active", coachAccess: "approved",
    });
    const rejeu = await joinClubWithCode(deps(store), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
    expect(rejeu.coachAccess).toBe("approved");
    expect(store.read(invitePaths.member(CLUB, PLAYER))?.coachAccess).toBe("approved");

    // …et revoked aussi : rejoindre a nouveau ne rouvre RIEN.
    const store2 = baseStore();
    seedCode(store2, "ABCDEFGHJK");
    store2.seed(invitePaths.member(CLUB, PLAYER), {
      uid: PLAYER, playerStatus: "active", coachAccess: "revoked",
    });
    const rejeu2 = await joinClubWithCode(deps(store2), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
    expect(rejeu2.coachAccess).toBe("revoked");
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

// ─── 6bis. AUCUN ORACLE A L'EMISSION ────────────────────────────────────────
//
// Le pendant, cote coach, de la section 6. L'emission repondait `not-found` sur
// un club inexistant et `permission-denied` sur un club existant : elle disait
// donc si un identifiant de club existait. Les trois causes de refus doivent
// maintenant produire un objet d'erreur INDISCERNABLE.

describe("issueClubInviteCode — refus STRICTEMENT identique (oracle d'existence de club ferme)", () => {
  test("issueRejectedError renvoie le meme objet quelle que soit la raison interne", () => {
    const reasons: IssueRejectionReason[] = ["invalid-club-id", "club-missing", "not-coach"];
    const shapes = reasons.map((r) => {
      const e = issueRejectedError(r);
      return { code: e.code, message: e.message };
    });
    for (const shape of shapes) expect(shape).toEqual(shapes[0]);
    expect(shapes[0]).toEqual({ code: ISSUE_REJECTED_CODE, message: ISSUE_REJECTED_MESSAGE });
  });

  test("forme d'identifiant : ce qui est ecarte AVANT toute lecture", () => {
    expect(isPlausibleClubId(CLUB)).toBe(true);
    for (const bad of [
      "",
      "   ",
      null,
      undefined,
      42,
      {},
      [],
      "A".repeat(MAX_CLUB_ID_LENGTH + 1),
      `${CLUB}/members/${OWNER}`,
      "../clubs/autre",
    ]) {
      expect(isPlausibleClubId(bad)).toBe(false);
    }
  });

  test("de bout en bout : club inexistant / club interdit / identifiant invalide → MEME code ET meme message", async () => {
    // Chaque cas part d'un magasin NEUF : sans cela, la limitation de tentatives
    // (qui est bien active, cf. section 8bis) transformerait les derniers refus
    // en blocages et le test mesurerait autre chose que l'egalite voulue.
    const cases: { label: string; uid: string; clubId: unknown }[] = [
      { label: "club existant, appelant sans lien", uid: "etranger", clubId: CLUB },
      { label: "club existant, appelant joueur du club", uid: PLAYER, clubId: CLUB },
      { label: "club inexistant, appelant coach ailleurs", uid: OWNER, clubId: "clubFantome" },
      { label: "club inexistant, appelant sans lien", uid: "etranger", clubId: "clubFantome" },
      { label: "identifiant vide", uid: OWNER, clubId: "" },
      { label: "identifiant blanc", uid: OWNER, clubId: "   " },
      { label: "identifiant null", uid: OWNER, clubId: null },
      { label: "identifiant absent", uid: OWNER, clubId: undefined },
      { label: "identifiant nombre", uid: OWNER, clubId: 42 },
      { label: "identifiant objet", uid: OWNER, clubId: { clubId: CLUB } },
      { label: "identifiant tableau", uid: OWNER, clubId: [CLUB] },
      { label: "identifiant booleen", uid: OWNER, clubId: true },
      { label: "identifiant demesure", uid: OWNER, clubId: "A".repeat(MAX_CLUB_ID_LENGTH + 1) },
      { label: "identifiant portant un chemin", uid: OWNER, clubId: `${CLUB}/members/${OWNER}` },
    ];

    for (const c of cases) {
      const store = baseStore();
      store.seed(invitePaths.member(CLUB, PLAYER), { uid: PLAYER, playerStatus: "active" });
      const err = await catchInvite(issueInviteCode(deps(store), { uid: c.uid, clubId: c.clubId }));
      expect({ label: c.label, code: err.code, message: err.message }).toEqual({
        label: c.label,
        code: ISSUE_REJECTED_CODE,
        message: ISSUE_REJECTED_MESSAGE,
      });
    }
  });

  test("l'egalite porte sur l'OBJET d'erreur, pas seulement sur son code", async () => {
    const build = async (uid: string, clubId: unknown) => {
      const store = baseStore();
      return catchInvite(issueInviteCode(deps(store), { uid, clubId }));
    };
    const interdit = await build("etranger", CLUB);
    const fantome = await build("etranger", "clubFantome");
    const malforme = await build("etranger", { clubId: CLUB });

    const shape = (e: InviteError) => ({
      constructeur: e.constructor.name,
      name: e.name,
      code: e.code,
      message: e.message,
      // Un champ supplementaire porteur d'indice serait un oracle deguise.
      champs: Object.keys(e).sort(),
    });

    expect(shape(fantome)).toEqual(shape(interdit));
    expect(shape(malforme)).toEqual(shape(interdit));
  });

  test("un refus n'ecrit RIEN : ni code, ni pointeur de code actif, et ne nomme pas le club", async () => {
    const store = baseStore();
    const err = await catchInvite(issueInviteCode(deps(store), { uid: "etranger", clubId: CLUB }));

    expect(err.message).not.toContain(CLUB);
    expect(err.message).not.toContain("AS Test");
    expect(store.read(invitePaths.meta(CLUB))).toBeNull();
    expect([...store.docs.keys()].some((k) => k.startsWith("inviteCodes/"))).toBe(false);
  });

  test("`unauthenticated` reste distinct : il parle de la session, jamais de la cible", async () => {
    const store = baseStore();
    const err = await catchInvite(issueInviteCode(deps(store), { uid: "", clubId: CLUB }));
    expect(err.code).toBe("unauthenticated");
    // Et il ne depend pas du club vise : meme reponse sur un club inexistant.
    const err2 = await catchInvite(issueInviteCode(deps(store), { uid: "", clubId: "clubFantome" }));
    expect({ code: err2.code, message: err2.message }).toEqual({
      code: err.code,
      message: err.message,
    });
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

// ─── 8bis. Limitation de tentatives A L'EMISSION ────────────────────────────

describe("politiques de limitation — seuils distincts et compteurs separes", () => {
  test("les deux gestes ne partagent NI les seuils NI l'espace de nom des compteurs", () => {
    // Recycler les valeurs du rattachement serait de la paresse : emettre est un
    // geste de coach, rare et delibere ; saisir un code est un geste de joueur,
    // frequent et faillible.
    expect(ISSUE_ATTEMPT_POLICY.keyPrefix).not.toBe(JOIN_ATTEMPT_POLICY.keyPrefix);
    expect(ISSUE_ATTEMPT_POLICY.keyPrefix).toBe("issue_");
    // Le rattachement garde le prefixe VIDE : les compteurs deja en base ne sont
    // pas renommes par ce lot.
    expect(JOIN_ATTEMPT_POLICY.keyPrefix).toBe("");

    expect(ISSUE_ATTEMPT_MAX_PER_USER).not.toBe(INVITE_ATTEMPT_MAX_PER_USER);
    expect(ISSUE_ATTEMPT_MAX_PER_ORIGIN).not.toBe(INVITE_ATTEMPT_MAX_PER_ORIGIN);
    expect(ISSUE_ATTEMPT_WINDOW_MS).not.toBe(INVITE_ATTEMPT_WINDOW_MS);
    // Fenetre d'emission plus LARGE : sonder des identifiants de club est un jeu
    // patient, une fenetre courte se contournerait en espacant les essais.
    expect(ISSUE_ATTEMPT_WINDOW_MS).toBeGreaterThan(INVITE_ATTEMPT_WINDOW_MS);
  });

  test("les echecs de rattachement ne bloquent PAS l'emission (et reciproquement)", async () => {
    // Sans compteurs separes, un joueur qui se trompe cinq fois de code sur le
    // wifi du club fermerait la porte d'emission de son propre coach.
    const store = baseStore();
    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_USER + 1; i++) {
      await catchInvite(joinClubWithCode(deps(store), { uid: OWNER, rawCode: "ZZZZZZZZZZ" }));
    }
    await expect(issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB })).resolves.toBeTruthy();

    // Sens inverse : saturer l'emission n'empeche pas de rejoindre un club.
    const store2 = baseStore();
    seedCode(store2, "ABCDEFGHJK");
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER + 1; i++) {
      await catchInvite(issueInviteCode(deps(store2), { uid: PLAYER, clubId: "clubFantome" }));
    }
    const joined = await joinClubWithCode(deps(store2), { uid: PLAYER, rawCode: "ABCDEFGHJK" });
    expect(joined.clubId).toBe(CLUB);
  });
});

describe("limitation de tentatives a l'emission — de bout en bout", () => {
  test("apres le seuil utilisateur, meme une demande LEGITIME est bloquee (blocage, pas oracle)", async () => {
    const store = baseStore();

    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER; i++) {
      const err = await catchInvite(
        issueInviteCode(deps(store), { uid: OWNER, clubId: `fantome${i}` }),
      );
      expect(err.code).toBe(ISSUE_REJECTED_CODE);
    }

    const blocked = await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB }));
    expect(blocked.code).toBe(INVITE_RATE_LIMITED_CODE);
    // Rien n'a ete emis pendant le blocage.
    expect(store.read(invitePaths.meta(CLUB))).toBeNull();
  });

  test("le blocage EXPIRE : passe la duree, le coach emet de nouveau", async () => {
    const store = baseStore();
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER; i++) {
      await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: `fantome${i}` }));
    }

    const later = NOW + ISSUE_ATTEMPT_BLOCK_MS + 1;
    const result = await issueInviteCode(
      { store, now: () => later },
      { uid: OWNER, clubId: CLUB },
    );
    expect(result.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  });

  test("les refus HORS fenetre ne s'additionnent pas (fenetre glissante)", async () => {
    const store = baseStore();
    // Un premier paquet de refus, puis un saut au-dela de la fenetre : le
    // compteur repart, le coach n'est pas bloque par une histoire ancienne.
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER - 1; i++) {
      await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: `fantome${i}` }));
    }
    const later = NOW + ISSUE_ATTEMPT_WINDOW_MS + 1;
    const d = { store, now: () => later };
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER - 1; i++) {
      const err = await catchInvite(issueInviteCode(d, { uid: OWNER, clubId: `tardif${i}` }));
      expect(err.code).toBe(ISSUE_REJECTED_CODE);
    }
    await expect(issueInviteCode(d, { uid: OWNER, clubId: CLUB })).resolves.toBeTruthy();
  });

  test("portee ORIGINE : changer de compte a chaque essai ne contourne rien", async () => {
    const store = baseStore();
    const ip = "203.0.113.7";

    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_ORIGIN; i++) {
      const err = await catchInvite(
        issueInviteCode(deps(store), { uid: `jetable${i}`, originKey: ip, clubId: CLUB }),
      );
      expect(err.code).toBe(ISSUE_REJECTED_CODE);
    }

    const blocked = await catchInvite(
      issueInviteCode(deps(store), { uid: "jetableNeuf", originKey: ip, clubId: CLUB }),
    );
    expect(blocked.code).toBe(INVITE_RATE_LIMITED_CODE);

    // Une AUTRE origine n'est pas punie : le vrai coach passe toujours.
    await expect(
      issueInviteCode(deps(store), { uid: OWNER, originKey: "198.51.100.2", clubId: CLUB }),
    ).resolves.toBeTruthy();
  });

  test("l'IP n'est jamais stockee en clair (cle de compteur hachee, prefixee)", async () => {
    const store = baseStore();
    const ip = "203.0.113.7";
    await catchInvite(
      issueInviteCode(deps(store), { uid: "etranger", originKey: ip, clubId: CLUB }),
    );

    const keys = [...store.docs.keys()].filter((k) => k.startsWith("inviteAttempts/"));
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.startsWith("inviteAttempts/issue_"))).toBe(true);
    expect(JSON.stringify([...store.docs.entries()])).not.toContain(ip);
  });

  test("FAIL-CLOSED : compteur illisible → emission REFUSEE, jamais ouverte", async () => {
    const store = baseStore();
    store.failReads.add(invitePaths.attempt(`issue_uid_${OWNER}`));

    const err = await catchInvite(issueInviteCode(deps(store), { uid: OWNER, clubId: CLUB }));
    expect(err.code).toBe(INVITE_UNAVAILABLE_CODE);
    // Aucun code n'a ete cree : une panne de compteur n'ouvre pas la porte.
    expect(store.read(invitePaths.meta(CLUB))).toBeNull();
    expect([...store.docs.keys()].some((k) => k.startsWith("inviteCodes/"))).toBe(false);
  });

  test("FAIL-CLOSED : compteur non ecrivable → le refus reste un refus", async () => {
    const store = baseStore();
    store.failWrites.add(invitePaths.attempt(`issue_uid_${OWNER}`));

    const err = await catchInvite(
      issueInviteCode(deps(store), { uid: OWNER, clubId: "clubFantome" }),
    );
    expect({ code: err.code, message: err.message }).toEqual({
      code: ISSUE_REJECTED_CODE,
      message: ISSUE_REJECTED_MESSAGE,
    });
    expect([...store.docs.keys()].some((k) => k.startsWith("inviteCodes/"))).toBe(false);
  });

  test("la limitation s'applique AVANT la lecture du club (un balayage ne s'achete pas de requetes)", async () => {
    const store = baseStore();
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER; i++) {
      await catchInvite(issueInviteCode(deps(store), { uid: "sonde", clubId: `fantome${i}` }));
    }
    const attemptsAvant = store.transactionAttempts;

    // Une fois bloque, plus AUCUNE transaction n'est ouverte : le refus est
    // rendu sur la seule lecture du compteur.
    await catchInvite(issueInviteCode(deps(store), { uid: "sonde", clubId: CLUB }));
    expect(store.transactionAttempts).toBe(attemptsAvant);
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

  test("l'EMISSION journalise de la meme facon : seuil franchi, rien d'autre", async () => {
    const store = baseStore();
    const signals: AbuseSignal[] = [];
    const d = { store, now: () => NOW, onAbuse: (s: AbuseSignal) => signals.push(s) };

    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER - 1; i++) {
      await catchInvite(issueInviteCode(d, { uid: "sonde", clubId: CLUB }));
    }
    expect(signals).toHaveLength(0);

    await catchInvite(issueInviteCode(d, { uid: "sonde", clubId: CLUB }));
    expect(signals).toHaveLength(1);
    expect(Object.keys(signals[0]).sort()).toEqual(["at", "scope", "uid"]);
    expect(signals[0]).toEqual({ scope: "user", uid: "sonde", at: NOW });

    // Le GESTE (emission / rattachement) n'est volontairement pas porte par le
    // signal : chaque callable choisit son propre callback et l'ecrit elle-meme
    // (cf. clubInvites.ts). La charge du signal reste minimale par construction.
  });

  test("AUCUN SECRET dans le journal : ni code emis, ni code tente, ni empreinte, ni club, ni IP", async () => {
    const store = baseStore();
    const signals: AbuseSignal[] = [];
    const d = { store, now: () => NOW, onAbuse: (s: AbuseSignal) => signals.push(s) };
    const ip = "203.0.113.42";

    // Un VRAI code est emis : c'est le secret le plus sensible du systeme.
    const issued = await issueInviteCode(d, { uid: OWNER, clubId: CLUB });
    const canonical = normalizeInviteCode(issued.code);
    const empreinte = hashInviteCode(canonical);

    // Puis on sature les deux portes pour declencher plusieurs signaux.
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER; i++) {
      await catchInvite(issueInviteCode(d, { uid: "sonde", originKey: ip, clubId: CLUB }));
    }
    for (let i = 0; i < INVITE_ATTEMPT_MAX_PER_USER; i++) {
      await catchInvite(
        joinClubWithCode(d, { uid: "sonde2", originKey: ip, rawCode: "ZZZZZZZZZZ" }),
      );
    }
    expect(signals.length).toBeGreaterThanOrEqual(2);

    const journal = JSON.stringify(signals);
    for (const secret of [
      canonical, // le code emis, forme canonique
      issued.code, // le code emis, forme affichee
      empreinte, // son empreinte SHA-256
      "ZZZZZZZZZZ", // un code TENTE (journaliser les essais = enumeration offerte)
      CLUB, // l'identifiant du club vise
      "AS Test", // son nom
      ip, // l'origine reseau en clair
    ]) {
      expect(journal).not.toContain(secret);
    }
  });
});
