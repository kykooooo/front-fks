// functions/tests/callableRights.test.ts
//
// SCENARIO 9 DE LA MATRICE DES DROITS COACH — APPEL DIRECT A UNE FUNCTION.
//
// Les regles Firestore ne protegent PAS de ce scenario : l'Admin SDK les
// contourne par construction. Une Cloud Function est donc une porte de plus, et
// c'est elle qui doit dire non. Ce fichier interroge cette porte directement,
// comme le ferait un attaquant qui appelle la callable avec curl au lieu de
// passer par l'application.
//
// Ce qui est teste ici : le COEUR de decision (functions/src/inviteCodes.ts),
// que les callables appellent sans rien y ajouter (functions/src/clubInvites.ts
// se contente de fournir l'uid du jeton, de brancher Firestore et de traduire
// l'erreur). Le coeur ne connait ni Firestore ni le runtime : il est donc
// interrogeable sans emulateur, avec un faux magasin.
//
// CE QUI N'EST PAS TESTE ICI, ET POURQUOI. La couche d'enveloppe elle-meme
// (`request.auth?.uid` comme SEULE source d'identite, cf. clubInvites.ts:105 et
// :127, deleteAccount.ts:27) n'est pas exercee : `firebase-functions` et
// `firebase-admin` ne sont installes nulle part dans ce depot, aucun test ne
// peut donc importer ces fichiers. C'est une limite reelle, ecrite comme telle
// dans docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md. Elle est bornee : ces
// trois lignes ne contiennent aucune logique metier, et aucune callable ne lit
// un identifiant d'utilisateur dans `request.data` (verifiable a l'oeil sur
// 3 fichiers courts).

import {
  INVITE_CODE_MAX_USES,
  INVITE_CODE_TTL_MS,
  INVITE_RATE_LIMITED_CODE,
  INVITE_REJECTED_CODE,
  INVITE_REJECTED_MESSAGE,
  ISSUE_ATTEMPT_MAX_PER_USER,
  ISSUE_REJECTED_CODE,
  ISSUE_REJECTED_MESSAGE,
  InviteError,
  hashInviteCode,
  invitePaths,
  issueInviteCode,
  joinClubWithCode,
  type DocData,
  type InviteStore,
  type InviteTx,
} from "../src/inviteCodes";

// ─── Faux magasin (sans machinerie de concurrence : inutile ici) ─────────────

class SimpleStore implements InviteStore {
  readonly docs = new Map<string, DocData>();

  seed(path: string, data: DocData): void {
    this.docs.set(path, { ...data });
  }

  read(path: string): DocData | null {
    return this.docs.get(path) ?? null;
  }

  async get(path: string): Promise<DocData | null> {
    return this.read(path);
  }

  async set(path: string, data: DocData, opts?: { merge?: boolean }): Promise<void> {
    const current = this.docs.get(path);
    this.docs.set(path, opts?.merge && current ? { ...current, ...data } : { ...data });
  }

  async runTransaction<T>(fn: (tx: InviteTx) => Promise<T>): Promise<T> {
    const writes: { path: string; data: DocData; merge: boolean }[] = [];
    const tx: InviteTx = {
      get: async (path) => this.read(path),
      set: (path, data, opts) => writes.push({ path, data, merge: opts?.merge ?? false }),
    };
    const result = await fn(tx);
    for (const w of writes) await this.set(w.path, w.data, { merge: w.merge });
    return result;
  }
}

// ─── Deux clubs, comme dans la matrice cote regles ──────────────────────────

const CLUB_A = "clubA";
const CLUB_B = "clubB";
const COACH_A = "coachA"; // owner ET coach du club A
const COACH_A2 = "coachA2"; // coach du club A, NON owner (celui qu'on peut retirer)
const COACH_B = "coachB"; // owner ET coach du club B
const PLAYER_A1 = "playerA1";
const STRANGER = "stranger";
const CLUB_INEXISTANT = "clubQuiNExistePas";
const NOW = Date.UTC(2026, 6, 27, 10, 0, 0);

function baseStore(): SimpleStore {
  const store = new SimpleStore();
  store.seed(invitePaths.club(CLUB_A), { name: "Club A", ownerUid: COACH_A });
  store.seed(invitePaths.club(CLUB_B), { name: "Club B", ownerUid: COACH_B });
  store.seed(invitePaths.member(CLUB_A, COACH_A), { uid: COACH_A, role: "coach" });
  store.seed(invitePaths.member(CLUB_A, COACH_A2), { uid: COACH_A2, role: "coach" });
  store.seed(invitePaths.member(CLUB_A, PLAYER_A1), { uid: PLAYER_A1, role: "player" });
  store.seed(invitePaths.member(CLUB_B, COACH_B), { uid: COACH_B, role: "coach" });
  return store;
}

const deps = (store: SimpleStore) => ({ store, now: () => NOW });

/** Pose un code valide du club A sans passer par l'emission. */
function seedCodeClubA(store: SimpleStore, canonical: string, over: Partial<DocData> = {}): string {
  const hash = hashInviteCode(canonical);
  store.seed(invitePaths.code(hash), {
    clubId: CLUB_A,
    createdBy: COACH_A,
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

// ═══════════════════════════════════════════════════════════════════════════
// 9.a — EMISSION D'UN CODE : qui a le droit d'ouvrir la porte d'un club ?
// ═══════════════════════════════════════════════════════════════════════════

describe("9.a — issueClubInviteCode appelee directement", () => {
  it("9.1 un coach d'un AUTRE club ne peut pas emettre de code pour le club A", async () => {
    const store = baseStore();
    const err = await catchInvite(issueInviteCode(deps(store), { uid: COACH_B, clubId: CLUB_A }));
    expect(err.code).toBe("permission-denied");
    // Et rien n'a ete ecrit : ni code, ni pointeur de code actif.
    expect(store.read(invitePaths.meta(CLUB_A))).toBeNull();
    expect([...store.docs.keys()].some((k) => k.startsWith("inviteCodes/"))).toBe(false);
  });

  it("9.2 un joueur, meme membre du club, ne peut pas emettre de code", async () => {
    const store = baseStore();
    const err = await catchInvite(issueInviteCode(deps(store), { uid: PLAYER_A1, clubId: CLUB_A }));
    expect(err.code).toBe("permission-denied");
    expect(store.read(invitePaths.meta(CLUB_A))).toBeNull();
  });

  it("9.3 un utilisateur sans aucun lien avec le club ne peut pas emettre", async () => {
    const store = baseStore();
    const err = await catchInvite(issueInviteCode(deps(store), { uid: STRANGER, clubId: CLUB_A }));
    expect(err.code).toBe("permission-denied");
  });

  it("9.4 un ancien coach, retire de l'effectif, ne peut plus emettre", async () => {
    const store = baseStore();
    // Temoin positif AVANT : il en avait le droit.
    await expect(issueInviteCode(deps(store), { uid: COACH_A2, clubId: CLUB_A })).resolves.toBeTruthy();
    // Retrait de l'effectif (ce que fait l'owner via deleteDoc).
    store.docs.delete(invitePaths.member(CLUB_A, COACH_A2));
    const err = await catchInvite(issueInviteCode(deps(store), { uid: COACH_A2, clubId: CLUB_A }));
    expect(err.code).toBe("permission-denied");
  });

  it("9.5 l'identite vient du jeton : un uid glisse dans la charge utile ne sert a rien", async () => {
    // La callable ne lit l'uid QUE dans `request.auth` (clubInvites.ts). Le coeur
    // recoit donc toujours l'uid reel de l'appelant ; ce qui arrive du client,
    // c'est `clubId` — et lui seul. On le prouve en envoyant un objet complet
    // « comme si » le client pouvait choisir son identite : le clubId non-chaine
    // est refuse, et aucune usurpation n'a lieu.
    //
    // Le code d'erreur n'est plus `invalid-argument` mais le refus UNIQUE de
    // l'emission : une charge utile malformee et un club interdit doivent etre
    // indiscernables (cf. 9.12).
    const store = baseStore();
    const forge = { clubId: CLUB_A, uid: COACH_A, role: "coach" } as unknown;
    const err = await catchInvite(issueInviteCode(deps(store), { uid: STRANGER, clubId: forge }));
    expect(err.code).toBe(ISSUE_REJECTED_CODE);
    expect(err.message).toBe(ISSUE_REJECTED_MESSAGE);
    expect(store.read(invitePaths.meta(CLUB_A))).toBeNull();
  });

  it("9.6 la reponse d'emission ne transporte que le code et ses bornes", async () => {
    // Ni le nom du club, ni l'effectif, ni l'empreinte stockee : une callable
    // legitime ne doit pas devenir une fenetre de lecture derobee.
    const store = baseStore();
    const result = await issueInviteCode(deps(store), { uid: COACH_A, clubId: CLUB_A });
    expect(Object.keys(result).sort()).toEqual(
      ["code", "expiresAt", "maxUses", "replacedPrevious"].sort(),
    );
    expect(JSON.stringify(result)).not.toContain("Club A");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9.b — RATTACHEMENT : entrer dans un club qu'on n'a pas ete invite a rejoindre
// ═══════════════════════════════════════════════════════════════════════════

describe("9.b — joinClubWithInviteCode appelee directement", () => {
  it("9.7 un identifiant de club connu ne rattache a rien : seul un code valide rattache", async () => {
    // Le club vise n'est JAMAIS un parametre : il est deduit du code cote
    // serveur. Un attaquant qui connait clubA n'a donc rien a en faire.
    const store = baseStore();
    const err = await catchInvite(
      joinClubWithCode(deps(store), { uid: STRANGER, rawCode: CLUB_A }),
    );
    expect(err.code).toBe(INVITE_REJECTED_CODE);
    expect(store.read(invitePaths.member(CLUB_A, STRANGER))).toBeNull();
  });

  it("9.8 une charge utile structuree (objet, tableau) est traitee comme une saisie vide, jamais interpretee", async () => {
    const store = baseStore();
    seedCodeClubA(store, "ABCDEFGHJK");
    for (const rawCode of [
      { code: "ABCDEFGHJK", clubId: CLUB_A } as unknown,
      ["ABCDEFGHJK"] as unknown,
      { toString: () => "ABCDEFGHJK" } as unknown,
      42 as unknown,
      null as unknown,
    ]) {
      const err = await catchInvite(joinClubWithCode(deps(store), { uid: STRANGER, rawCode }));
      expect(err.code).toBe(INVITE_REJECTED_CODE);
    }
    expect(store.read(invitePaths.member(CLUB_A, STRANGER))).toBeNull();
  });

  it("9.9 l'etat d'acces pose au rattachement vient du SERVEUR, jamais du client", async () => {
    // Franchir la porte du club et devenir consultable par le coach restent
    // deux choses differentes. Ce qui les relie est la POLITIQUE DU CLUB, posee
    // cote serveur : un club en "approval_required" laisse entrer sans ouvrir.
    // Le client ne peut ni choisir cet etat, ni le suggerer.
    const store = baseStore();
    seedCodeClubA(store, "ABCDEFGHJK");
    store.seed(invitePaths.club(CLUB_A), {
      name: "Club A",
      ownerUid: COACH_A,
      coachAccessPolicy: "approval_required",
    });
    store.seed(invitePaths.user(STRANGER), { uid: STRANGER, ageCategory: "U15" });

    const result = await joinClubWithCode(deps(store), { uid: STRANGER, rawCode: "ABCDEFGHJK" });
    expect(result.coachAccess).toBe("pending");
    expect(store.read(invitePaths.member(CLUB_A, STRANGER))?.coachAccess).toBe("pending");
  });

  it("9.9b sur un club en mode par defaut, un rattachement volontaire ouvre la projection non sensible", async () => {
    // Le pendant du test precedent : sans configuration explicite, le club du
    // pilote laisse entrer ET rend le joueur consultable. Ce qui reste ferme,
    // ce sont les donnees sensibles — c'est la frontiere coach-safe qui s'en
    // charge (functions/src/dto.ts), pas cet interrupteur.
    const store = baseStore();
    seedCodeClubA(store, "ABCDEFGHJK");
    store.seed(invitePaths.user(STRANGER), { uid: STRANGER, ageCategory: "U15" });

    const result = await joinClubWithCode(deps(store), { uid: STRANGER, rawCode: "ABCDEFGHJK" });
    expect(result.coachAccess).toBe("not_required");
  });

  it("9.10 la reponse de rattachement ne transporte aucune donnee d'un autre joueur", async () => {
    const store = baseStore();
    seedCodeClubA(store, "ABCDEFGHJK");
    const result = await joinClubWithCode(deps(store), { uid: STRANGER, rawCode: "ABCDEFGHJK" });
    // Le club est nomme (l'app doit pouvoir dire « bienvenue au Club A »), et
    // c'est TOUT : ni effectif, ni identifiants d'autres joueurs, ni code.
    expect(Object.keys(result).sort()).toEqual(
      ["alreadyMember", "clubId", "clubName", "coachAccess"].sort(),
    );
    expect(JSON.stringify(result)).not.toContain(PLAYER_A1);
    expect(JSON.stringify(result)).not.toContain("ABCDEFGHJK");
  });

  it("9.11 un refus ne dit jamais POURQUOI : code inconnu et code du mauvais club sont indiscernables", async () => {
    const store = baseStore();
    seedCodeClubA(store, "ABCDEFGHJK", { revokedAt: NOW - 1 });
    const inconnu = await catchInvite(
      joinClubWithCode(deps(store), { uid: STRANGER, rawCode: "ZZZZZZZZZZ" }),
    );
    const revoque = await catchInvite(
      joinClubWithCode(deps(store), { uid: STRANGER, rawCode: "ABCDEFGHJK" }),
    );
    expect({ code: inconnu.code, message: inconnu.message }).toEqual({
      code: revoque.code,
      message: revoque.message,
    });
    expect(inconnu.message).toBe(INVITE_REJECTED_MESSAGE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9.c — LES DEUX FAIBLESSES DE LA PORTE D'EMISSION, MAINTENANT FERMEES.
//
// Ces deux tests etaient verts EN CONSTATANT LE DEFAUT (l'emission distinguait
// un club inexistant d'un club interdit, et n'etait bornee par rien). Ils sont
// conserves au meme numero, retournes : ils constatent desormais la fermeture.
// L'historique de ce qui etait mesure reste ecrit ici, pour qu'une regression
// se lise comme un retour en arriere et pas comme une nouveaute.
// ═══════════════════════════════════════════════════════════════════════════

describe("9.c — porte d'emission : oracle ferme, tentatives bornees", () => {
  it("9.12 l'emission ne distingue PLUS un club inexistant d'un club dont on n'est pas coach", async () => {
    const store = baseStore();
    const clubReel = await catchInvite(
      issueInviteCode(deps(store), { uid: STRANGER, clubId: CLUB_A }),
    );
    const clubFantome = await catchInvite(
      issueInviteCode(deps(store), { uid: "stranger2", clubId: CLUB_INEXISTANT }),
    );

    // AVANT : permission-denied vs not-found — un appelant apprenait si un
    // identifiant de club existait. MAINTENANT : reponse strictement identique,
    // objet compare en entier (pas seulement le code).
    expect({ code: clubReel.code, message: clubReel.message }).toEqual({
      code: clubFantome.code,
      message: clubFantome.message,
    });
    expect(clubReel.code).toBe(ISSUE_REJECTED_CODE);
    expect(clubReel.message).toBe(ISSUE_REJECTED_MESSAGE);

    // Et toujours : aucune donnee du club ne fuit dans le message.
    expect(clubReel.message).not.toContain("Club A");
    expect(clubReel.message).not.toContain(CLUB_A);
  });

  it("9.13 l'emission EST soumise a la limitation de tentatives (plus de rafale)", async () => {
    // AVANT : 50 essais consecutifs passaient, aucun compteur ecrit. On rejoue
    // exactement ce scenario : il doit maintenant se solder par un blocage.
    const store = baseStore();
    const codes: string[] = [];
    for (let i = 0; i < 50; i++) {
      const err = await catchInvite(
        issueInviteCode(deps(store), { uid: STRANGER, clubId: CLUB_A }),
      );
      codes.push(err.code);
    }

    // Les premiers essais sont des refus, les suivants un blocage.
    expect(codes.slice(0, ISSUE_ATTEMPT_MAX_PER_USER)).toEqual(
      new Array(ISSUE_ATTEMPT_MAX_PER_USER).fill(ISSUE_REJECTED_CODE),
    );
    expect(codes[ISSUE_ATTEMPT_MAX_PER_USER]).toBe(INVITE_RATE_LIMITED_CODE);
    expect(new Set(codes.slice(ISSUE_ATTEMPT_MAX_PER_USER))).toEqual(
      new Set([INVITE_RATE_LIMITED_CODE]),
    );

    // Un compteur a bien ete ecrit, dans l'espace de nom PROPRE a l'emission.
    const keys = [...store.docs.keys()].filter((k) => k.startsWith("inviteAttempts/"));
    expect(keys).toEqual([invitePaths.attempt(`issue_uid_${STRANGER}`)]);
  });

  it("9.14 un coach legitime n'est PAS puni par le sondage d'un autre compte", async () => {
    // La limitation porte sur l'utilisateur (et l'origine), pas sur le club :
    // saturer le compteur de STRANGER ne doit pas fermer la porte de COACH_A.
    const store = baseStore();
    for (let i = 0; i < ISSUE_ATTEMPT_MAX_PER_USER + 2; i++) {
      await catchInvite(issueInviteCode(deps(store), { uid: STRANGER, clubId: CLUB_A }));
    }
    await expect(
      issueInviteCode(deps(store), { uid: COACH_A, clubId: CLUB_A }),
    ).resolves.toBeTruthy();
  });
});
