// functions/tests/weekContextNoteMigration.test.ts
//
// MIGRATION DES ANCIENNES NOTES — sur fixtures EN MEMOIRE uniquement.
//
// Aucune base reelle, aucun emulateur, aucun reseau. Le magasin ci-dessous imite
// Firestore sur les seuls points qui comptent ici : une transaction applique
// TOUT ou RIEN, une fusion fusionne, une suppression de champ supprime.
//
// Ce que cette suite prouve, point par point (les exigences de Kyllian) :
//  1. detection de TOUS les champs de note, pas seulement `note` ;
//  2. copie vers le stockage coach-only, avec les metadonnees utiles ;
//  3. suppression du champ ancien DANS LA MEME TRANSACTION ;
//  4. simulation par defaut : aucune ecriture ;
//  5. idempotence : deux passages = meme etat ;
//  6. reprise apres interruption au milieu ;
//  7. compteurs exacts, champ par champ ;
//  8. aucun contenu de note dans la sortie ;
//  9. si la suppression echoue, la copie n'est PAS conservee (tout ou rien) ;
// 10. l'audit final prouve qu'il ne reste rien de lisible par un joueur.

import {
  auditWeekContextNotes,
  detecterTextesHorsContrat,
  runWeekContextNoteMigration,
  WEEK_CONTEXT_CONTRACT_FIELDS,
  type NoteMigrationStore,
  type NoteMigrationTx,
  type WeekContextRef,
} from "../src/weekContextNoteMigration";

const MAINTENANT = "2026-07-27T10:00:00.000Z";
const now = () => MAINTENANT;

const NOTE_SENSIBLE = "Rachid tendinite genou droit, se plaint tout le temps";
const AUTRE_NOTE = "Gros match dimanche, revoir la sortie de balle";

type Base = Record<string, Record<string, unknown>>;

/** Cadre de semaine conforme au contrat, plus ce qu'on lui ajoute. */
const cadre = (over: Record<string, unknown> = {}) => ({
  weekKey: "2026-07-20",
  clubId: "clubA",
  createdBy: "coach1",
  trainingIntensity: "normal",
  weekGoal: "freshness",
  matchThisWeekend: true,
  ...over,
});

type Options = {
  /** Chemins dont la SUPPRESSION doit echouer (simulation d'interruption). */
  suppressionKO?: Set<string>;
  /** Chemins dont la LECTURE doit echouer. */
  lectureKO?: Set<string>;
};

/**
 * Magasin en memoire. La transaction accumule les operations et ne les applique
 * qu'a la fin : si la fonction jette, la base n'a pas bouge. C'est exactement le
 * comportement dont depend la garantie "copie et suppression, ou rien".
 */
function magasin(base: Base, refs: WeekContextRef[], opts: Options = {}): NoteMigrationStore {
  return {
    async listWeekContexts(clubId?: string) {
      return clubId ? refs.filter((r) => r.clubId === clubId) : refs;
    },
    weekContextPath: (r) => `clubs/${r.clubId}/weekContexts/${r.weekKey}`,
    coachNotePath: (r) => `clubs/${r.clubId}/coachNotes/${r.weekKey}`,
    async runTransaction<T>(fn: (tx: NoteMigrationTx) => Promise<T>): Promise<T> {
      const enAttente: (() => void)[] = [];
      const tx: NoteMigrationTx = {
        async read(path) {
          if (opts.lectureKO?.has(path)) throw new Error("lecture indisponible");
          const doc = base[path];
          return doc ? { ...doc } : null;
        },
        merge(path, data) {
          enAttente.push(() => {
            base[path] = { ...(base[path] ?? {}), ...data };
          });
        },
        deleteFields(path, champs) {
          if (opts.suppressionKO?.has(path)) throw new Error("suppression refusee");
          enAttente.push(() => {
            const doc = base[path];
            if (!doc) return;
            for (const c of champs) delete doc[c];
          });
        },
      };
      const res = await fn(tx);
      // Commit : uniquement si rien n'a jete au-dessus.
      for (const op of enAttente) op();
      return res;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
describe("1. detection : le contrat en liste BLANCHE, pas les noms en liste noire", () => {
  it("le champ `note` est trouve", () => {
    expect(detecterTextesHorsContrat(cadre({ note: NOTE_SENSIBLE }))).toEqual([
      { chemin: "note", texte: NOTE_SENSIBLE },
    ]);
  });

  it("une VARIANTE inventee par un ancien build est trouvee aussi", () => {
    const doc = cadre({
      notes: "premiere variante",
      coachNote: "deuxieme variante",
      commentaire: "troisieme variante",
      staff: { note: "note imbriquee" },
      memos: ["dans un tableau"],
    });
    expect(detecterTextesHorsContrat(doc).map((t) => t.chemin)).toEqual([
      "coachNote",
      "commentaire",
      "memos[0]",
      "notes",
      "staff.note",
    ]);
  });

  it("AUCUN champ du contrat n'est confondu avec une note", () => {
    expect(detecterTextesHorsContrat(cadre())).toEqual([]);
    // Temoin : le contrat contient bien des champs textuels (weekKey, clubId,
    // createdBy...). Sans liste blanche, ils seraient tous pris pour des notes.
    expect(WEEK_CONTEXT_CONTRACT_FIELDS).toContain("createdBy");
    expect(WEEK_CONTEXT_CONTRACT_FIELDS).not.toContain("note");
  });

  it("un champ vide ou blanc n'est pas une note (il n'expose rien)", () => {
    expect(detecterTextesHorsContrat(cadre({ note: "   ", autre: "" }))).toEqual([]);
  });

  it("un horodatage Firestore n'est pas du texte", () => {
    const ts = { toDate: () => new Date("2026-07-20T08:00:00.000Z") };
    expect(detecterTextesHorsContrat(cadre({ vieilHorodatage: ts }))).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("2-3. copie vers le coach-only, suppression dans la MEME transaction", () => {
  const cheminCadre = "clubs/clubA/weekContexts/2026-07-20";
  const cheminNote = "clubs/clubA/coachNotes/2026-07-20";
  const refs: WeekContextRef[] = [{ clubId: "clubA", weekKey: "2026-07-20" }];

  it("la note part vers coachNotes, et disparait du document public", async () => {
    const base: Base = { [cheminCadre]: cadre({ note: NOTE_SENSIBLE }) };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(base[cheminNote].note).toBe(NOTE_SENSIBLE);
    expect(base[cheminCadre].note).toBeUndefined();
    expect(stats.migres).toBe(1);
    expect(stats.conflits).toBe(0);

    // Le reste du cadre est INTACT : on deplace une note, on ne repeint pas le
    // document.
    expect(base[cheminCadre].trainingIntensity).toBe("normal");
    expect(base[cheminCadre].weekGoal).toBe("freshness");
    expect(base[cheminCadre].matchThisWeekend).toBe(true);
  });

  it("les metadonnees utiles suivent : champ d'origine, auteur, date, semaine", async () => {
    const base: Base = { [cheminCadre]: cadre({ note: NOTE_SENSIBLE }) };
    await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(base[cheminNote].legacyImport).toEqual({
      champs: { note: NOTE_SENSIBLE },
      source: "weekContexts",
      weekKey: "2026-07-20",
      migratedAt: MAINTENANT,
      sourceCreatedBy: "coach1",
    });
    expect(base[cheminNote].clubId).toBe("clubA");
  });

  it("plusieurs champs : tous copies, tous supprimes", async () => {
    const base: Base = {
      [cheminCadre]: cadre({ note: NOTE_SENSIBLE, notes: AUTRE_NOTE, staff: { note: "abc" } }),
    };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(base[cheminCadre].note).toBeUndefined();
    expect(base[cheminCadre].notes).toBeUndefined();
    expect(base[cheminCadre].staff).toBeUndefined();
    expect(base[cheminNote].legacyImport).toMatchObject({
      champs: { note: NOTE_SENSIBLE, notes: AUTRE_NOTE, "staff.note": "abc" },
    });
    // La note VISIBLE est celle du champ `note` : le choix est deterministe.
    expect(base[cheminNote].note).toBe(NOTE_SENSIBLE);
    expect(stats.champsDetectes).toEqual({ note: 1, notes: 1, "staff.note": 1 });
  });

  it("une note privee DEJA ecrite n'est jamais ecrasee : les deux textes survivent", async () => {
    const base: Base = {
      [cheminCadre]: cadre({ note: NOTE_SENSIBLE }),
      [cheminNote]: { weekKey: "2026-07-20", note: AUTRE_NOTE },
    };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(base[cheminNote].note).toBe(AUTRE_NOTE); // la recente fait foi
    expect(base[cheminNote].legacyImport).toMatchObject({ champs: { note: NOTE_SENSIBLE } });
    expect(stats.conflits).toBe(1);
    expect(base[cheminCadre].note).toBeUndefined(); // et le public est propre
  });

  it("9. si la SUPPRESSION echoue, la copie n'est pas conservee non plus", async () => {
    const base: Base = { [cheminCadre]: cadre({ note: NOTE_SENSIBLE }) };
    const stats = await runWeekContextNoteMigration(
      magasin(base, refs, { suppressionKO: new Set([cheminCadre]) }),
      { apply: true, now },
    );

    // Tout ou rien : ni note copiee a moitie, ni document public a moitie vide.
    expect(base[cheminNote]).toBeUndefined();
    expect(base[cheminCadre].note).toBe(NOTE_SENSIBLE);
    expect(stats.erreurs).toBe(1);
    expect(stats.migres).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("4. SIMULATION par defaut : rien n'est ecrit", () => {
  const cheminCadre = "clubs/clubA/weekContexts/2026-07-20";
  const refs: WeekContextRef[] = [{ clubId: "clubA", weekKey: "2026-07-20" }];

  it("sans --apply, la base est identique apres passage", async () => {
    const base: Base = { [cheminCadre]: cadre({ note: NOTE_SENSIBLE }) };
    const avant = JSON.stringify(base);

    const stats = await runWeekContextNoteMigration(magasin(base, refs), { now });

    expect(JSON.stringify(base)).toBe(avant);
    // ...mais les compteurs disent ce qui SERAIT fait : c'est tout l'interet.
    expect(stats.migres).toBe(1);
    expect(stats.champsDetectes).toEqual({ note: 1 });
  });

  it("la simulation peut etre rejouee sans fin sans jamais rien changer", async () => {
    const base: Base = { [cheminCadre]: cadre({ note: NOTE_SENSIBLE }) };
    const avant = JSON.stringify(base);
    for (let i = 0; i < 3; i += 1) {
      await runWeekContextNoteMigration(magasin(base, refs), { now });
    }
    expect(JSON.stringify(base)).toBe(avant);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("5-6. idempotence et reprise apres interruption", () => {
  const refs: WeekContextRef[] = [
    { clubId: "clubA", weekKey: "2026-07-06" },
    { clubId: "clubA", weekKey: "2026-07-13" },
    { clubId: "clubB", weekKey: "2026-07-20" },
  ];
  const chemin = (r: WeekContextRef) => `clubs/${r.clubId}/weekContexts/${r.weekKey}`;
  const cheminNote = (r: WeekContextRef) => `clubs/${r.clubId}/coachNotes/${r.weekKey}`;

  const baseTrois = (): Base => ({
    [chemin(refs[0])]: cadre({ weekKey: "2026-07-06", note: "note un" }),
    [chemin(refs[1])]: cadre({ weekKey: "2026-07-13", note: "note deux" }),
    [chemin(refs[2])]: cadre({ weekKey: "2026-07-20", clubId: "clubB", note: "note trois" }),
  });

  it("deux passages complets = MEME etat final", async () => {
    const base = baseTrois();
    await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });
    const apresPremier = JSON.stringify(base);

    const stats2 = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(JSON.stringify(base)).toBe(apresPremier);
    expect(stats2.migres).toBe(0);
    expect(stats2.dejaMigres).toBe(3); // reconnus comme deja passes
    expect(stats2.detectes).toBe(0);
  });

  it("interruption au milieu : le 2e echoue, les autres passent, la relance solde", async () => {
    const base = baseTrois();
    const stats1 = await runWeekContextNoteMigration(
      magasin(base, refs, { suppressionKO: new Set([chemin(refs[1])]) }),
      { apply: true, now },
    );

    expect(stats1.migres).toBe(2);
    expect(stats1.erreurs).toBe(1);
    // Le document en echec a garde sa note (rien n'a ete ecrit pour lui).
    expect(base[chemin(refs[1])].note).toBe("note deux");
    expect(base[cheminNote(refs[1])]).toBeUndefined();

    // RELANCE, sans interruption cette fois.
    const stats2 = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });
    expect(stats2.migres).toBe(1);
    expect(stats2.dejaMigres).toBe(2);
    expect(stats2.erreurs).toBe(0);
    expect(base[chemin(refs[1])].note).toBeUndefined();
    expect(base[cheminNote(refs[1])].note).toBe("note deux");
  });

  it("borner a un club ne touche pas les autres", async () => {
    const base = baseTrois();
    const stats = await runWeekContextNoteMigration(magasin(base, refs), {
      apply: true,
      clubId: "clubB",
      now,
    });
    expect(stats.scannes).toBe(1);
    expect(stats.migres).toBe(1);
    expect(base[chemin(refs[0])].note).toBe("note un"); // clubA intact
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("7-8. compteurs exacts, et AUCUN contenu dans la sortie", () => {
  const refs: WeekContextRef[] = [
    { clubId: "clubA", weekKey: "s1" },
    { clubId: "clubA", weekKey: "s2" },
    { clubId: "clubA", weekKey: "s3" },
    { clubId: "clubA", weekKey: "s4" },
  ];

  it("chaque document tombe dans une seule categorie, et le total est juste", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre({ note: NOTE_SENSIBLE }), // a migrer
      "clubs/clubA/weekContexts/s2": cadre(), // propre
      "clubs/clubA/weekContexts/s3": cadre(), // deja migre
      "clubs/clubA/coachNotes/s3": { note: AUTRE_NOTE, legacyImport: { champs: {} } },
      // s4 : absent de la base (disparu entre l'inventaire et le traitement)
    };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(stats).toEqual({
      scannes: 4,
      detectes: 1,
      migres: 1,
      dejaMigres: 1,
      sansNote: 1,
      disparus: 1,
      conflits: 0,
      erreurs: 0,
      champsDetectes: { note: 1 },
    });
    expect(stats.migres + stats.dejaMigres + stats.sansNote + stats.disparus + stats.erreurs).toBe(
      stats.scannes,
    );
  });

  it("le champ par champ dit OU etaient les notes, jamais CE QU'ELLES DISAIENT", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre({ note: NOTE_SENSIBLE }),
      "clubs/clubA/weekContexts/s2": cadre({ notes: AUTRE_NOTE }),
      "clubs/clubA/weekContexts/s3": cadre({ note: "encore une" }),
      "clubs/clubA/weekContexts/s4": cadre(),
    };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(stats.champsDetectes).toEqual({ note: 2, notes: 1 });
    // LA sonde hostile : la sortie complete du script ne contient RIEN du texte.
    const sortie = JSON.stringify(stats);
    expect(sortie).not.toContain("tendinite");
    expect(sortie).not.toContain("Rachid");
    expect(sortie).not.toContain("dimanche");
    expect(sortie).not.toContain(NOTE_SENSIBLE);
    expect(sortie).not.toContain(AUTRE_NOTE);
    // Et pas davantage d'identifiant de club ou de compte.
    expect(sortie).not.toContain("clubA");
    expect(sortie).not.toContain("coach1");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("10. l'audit final : est-ce que c'est propre, maintenant ?", () => {
  const refs: WeekContextRef[] = [
    { clubId: "clubA", weekKey: "s1" },
    { clubId: "clubA", weekKey: "s2" },
  ];

  it("avant migration : RESIDU, avec le detail champ par champ", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre({ note: NOTE_SENSIBLE }),
      "clubs/clubA/weekContexts/s2": cadre({ coachNote: AUTRE_NOTE }),
    };
    const rapport = await auditWeekContextNotes(magasin(base, refs));

    expect(rapport.verdict).toBe("RESIDU");
    expect(rapport.documentsAvecTexte).toBe(2);
    expect(rapport.champsDetectes).toEqual({ note: 1, coachNote: 1 });
    expect(JSON.stringify(rapport)).not.toContain("tendinite");
  });

  it("apres migration : PROPRE — plus AUCUNE note dans un document lisible par un joueur", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre({ note: NOTE_SENSIBLE }),
      "clubs/clubA/weekContexts/s2": cadre({ coachNote: AUTRE_NOTE, staff: { memo: "x" } }),
    };
    await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    const rapport = await auditWeekContextNotes(magasin(base, refs));
    expect(rapport.verdict).toBe("PROPRE");
    expect(rapport.documentsAvecTexte).toBe(0);
    expect(rapport.champsDetectes).toEqual({});

    // Et la preuve directe, document par document : plus un seul texte hors
    // contrat dans ce que les joueurs peuvent lire.
    for (const r of refs) {
      const doc = base[`clubs/${r.clubId}/weekContexts/${r.weekKey}`];
      expect(detecterTextesHorsContrat(doc)).toEqual([]);
    }
    // ...et rien n'a ete perdu : tout est dans le coach-only.
    expect(base["clubs/clubA/coachNotes/s1"].note).toBe(NOTE_SENSIBLE);
    expect(base["clubs/clubA/coachNotes/s2"].legacyImport).toMatchObject({
      champs: { coachNote: AUTRE_NOTE, "staff.memo": "x" },
    });
  });

  it("un document illisible -> INCERTAIN, jamais PROPRE", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre(),
      "clubs/clubA/weekContexts/s2": cadre(),
    };
    const rapport = await auditWeekContextNotes(
      magasin(base, refs, { lectureKO: new Set(["clubs/clubA/weekContexts/s2"]) }),
    );
    expect(rapport.erreurs).toBe(1);
    expect(rapport.verdict).toBe("INCERTAIN");
  });

  it("l'audit n'ecrit RIEN, meme sur une base pleine de notes", async () => {
    const base: Base = {
      "clubs/clubA/weekContexts/s1": cadre({ note: NOTE_SENSIBLE }),
      "clubs/clubA/weekContexts/s2": cadre({ note: AUTRE_NOTE }),
    };
    const avant = JSON.stringify(base);
    await auditWeekContextNotes(magasin(base, refs));
    expect(JSON.stringify(base)).toBe(avant);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("l'outil reste un outil : aucune route reseau", () => {
  it("les deux commandes ne sont exportees par AUCUNE Cloud Function", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const brut = require("fs").readFileSync(
      require("path").join(__dirname, "../src/index.ts"),
      "utf8",
    ) as string;
    // Les COMMENTAIRES sont retires : ce qui compte est ce que le fichier
    // EXPORTE, pas ce qu'il explique (index.ts documente justement pourquoi les
    // outils administrateur n'y sont pas). Meme methode que
    // clubOwnership.test.ts, pour que les deux verrous restent comparables.
    const index = brut
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(index).not.toContain("weekContextNoteMigrationCli");
    expect(index).not.toContain("weekContextNoteAuditCli");
    expect(index).not.toContain("runWeekContextNoteMigration");
  });

  it("aucune conversion de note en directive n'est exposee", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = Object.keys(require("../src/weekContextNoteMigration"));
    expect(api.filter((k) => /directive|publi|share|expose/i.test(k))).toEqual([]);
  });
});
