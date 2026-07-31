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
// 10. l'audit final prouve qu'il ne reste rien de lisible par un joueur ;
// 11. VERROU MECANIQUE : WEEK_CONTEXT_CONTRACT_FIELDS colle exactement aux
//     cles reellement ecrites par repositories/clubsRepo.saveClubWeekContext
//     (front) — lu par scan statique de son source, jamais recopie a la main.
//     Scan de TEXTE, fail-closed : l'en-tete de la section 11 dit precisement
//     de quels mecanismes il est fait (M1/M2) et ce qui reste une limite
//     declaree — a lire avant de lui faire confiance ;
// 12. un champ HERITE CONNU (`createdAt`) est archive comme le reste mais
//     n'est JAMAIS promu note visible : une date ISO n'est pas une note.

import { readFileSync } from "fs";
import { join } from "path";
import {
  auditWeekContextNotes,
  CHAMPS_HERITES_CONNUS,
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
// 12. Un champ HERITE CONNU (`createdAt`) n'est jamais promu note visible.
//
// `createdAt` a ete retire de WEEK_CONTEXT_CONTRACT_FIELDS le 2026-07-31 (cf.
// section 11) parce que `saveClubWeekContext` ne l'a jamais ecrit. Consequence
// directe : un vieux document qui porte encore un `createdAt` EN CHAINE (une
// autre origine que le front, ex: Admin SDK) devient desormais un champ « hors
// contrat » aux yeux de `detecterTextesHorsContrat` — exactement comme une
// vraie note. Sans traitement special, un document SANS note mais AVEC ce
// `createdAt` aurait vu sa date ISO choisie comme `principale` et ecrite comme
// note VISIBLE du coach (`base[cheminNote].note === "2020-01-01T00:00:00.000Z"`).
// Cette section prouve que ce n'est plus le cas : le champ est bien deplace
// (archive dans `legacyImport`, retire du document public), mais jamais
// affiche comme si un coach l'avait ecrit.
describe("12. champs HERITES CONNUS (createdAt) : archives, jamais promus note visible", () => {
  const cheminCadre = "clubs/clubA/weekContexts/2026-07-20";
  const cheminNote = "clubs/clubA/coachNotes/2026-07-20";
  const refs: WeekContextRef[] = [{ clubId: "clubA", weekKey: "2026-07-20" }];
  const CREATED_AT_HERITE = "2020-01-01T00:00:00.000Z";

  it("`createdAt` fait bien partie des champs herites connus (temoin)", () => {
    expect(CHAMPS_HERITES_CONNUS).toContain("createdAt");
  });

  it("doc avec createdAt STRING et SANS note : archive, mais AUCUNE note visible creee", async () => {
    const base: Base = { [cheminCadre]: cadre({ createdAt: CREATED_AT_HERITE }) };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    // Le champ a bien ete detecte et deplace : le document public est propre.
    expect(stats.migres).toBe(1);
    expect(base[cheminCadre].createdAt).toBeUndefined();
    expect(base[cheminNote].legacyImport).toMatchObject({ champs: { createdAt: CREATED_AT_HERITE } });

    // Mais la date n'est PAS devenue une note : c'est la faille qu'on ferme ici.
    expect(base[cheminNote].note).toBeUndefined();
    expect(stats.conflits).toBe(0);
  });

  it("doc avec createdAt ET une vraie note : la vraie note est promue, createdAt reste archive seulement", async () => {
    const base: Base = {
      [cheminCadre]: cadre({ createdAt: CREATED_AT_HERITE, note: NOTE_SENSIBLE }),
    };
    const stats = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(base[cheminNote].note).toBe(NOTE_SENSIBLE);
    expect(base[cheminNote].legacyImport).toMatchObject({
      champs: { createdAt: CREATED_AT_HERITE, note: NOTE_SENSIBLE },
    });
    expect(stats.migres).toBe(1);
    expect(stats.conflits).toBe(0);
  });

  it("relance apres coup : le document sans note reste sans note visible (idempotent)", async () => {
    const base: Base = { [cheminCadre]: cadre({ createdAt: CREATED_AT_HERITE }) };
    await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });
    const stats2 = await runWeekContextNoteMigration(magasin(base, refs), { apply: true, now });

    expect(stats2.migres).toBe(0);
    expect(stats2.dejaMigres).toBe(1);
    expect(base[cheminNote].note).toBeUndefined();
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

// ════════════════════════════════════════════════════════════════════════════
// 11. VERROU — le contrat colle aux cles REELLEMENT ecrites par le front
// ════════════════════════════════════════════════════════════════════════════
//
// WEEK_CONTEXT_CONTRACT_FIELDS est une recopie a la main de ce qu'ecrit
// repositories/clubsRepo.saveClubWeekContext (front). Une recopie a la main
// derive en silence : c'est exactement comme ca que `createdAt` s'est retrouve
// dans le contrat alors que saveClubWeekContext ne l'a JAMAIS ecrit (corrige le
// 2026-07-31). Cette section lit le VRAI source de clubsRepo.ts et compare.
//
// ── CE QUE CE VERROU COUVRE, EXACTEMENT ─────────────────────────────────────
// L'analyse est un scan de TEXTE, pas un compilateur. Elle tient sur DEUX
// mecanismes, tous les deux fail-closed (en cas de doute, le test TOMBE ; il ne
// « passe » jamais en ayant vu moins que la realite) :
//
//  M1. LECTURE DU PAYLOAD PAR POSITION D'ARGUMENT. Pour chaque `setDoc(...)` /
//      `updateDoc(...)` du corps, les ARGUMENTS top-level sont decoupes (memes
//      regles que `segmentsTopLevel` : chaines, imbrications, parentheses), et
//      c'est l'argument d'INDEX 1 qui est lu — jamais « la premiere accolade
//      trouvee ». Cet argument DOIT etre un objet litteral `{ ... }` ; toute
//      autre forme (ternaire, `Object.assign(...)`, variable, appel, `{...} as
//      X`) fait TOMBER le test avec le segment fautif dans le message.
//      Ce mecanisme ferme le bug de conception precedent : le verrou localisait
//      le payload par `indexOf("{")`, donc `setDoc(ref, payload, { merge: true })`
//      lui faisait lire `{ merge: true }` comme s'il s'agissait du contrat.
//
//  M2. LISTE BLANCHE FERMEE DES APPELS DU CORPS. Tout appel de fonction present
//      dans le corps de `saveClubWeekContext` dont le callee n'est pas dans
//      `APPELS_AUTORISES` fait TOMBER le test. Sans ca, la detection des
//      ecritures restait purement NOMINALE (« je cherche le mot setDoc ») : un
//      helper local (`await ecrireCadre(ref, opts)`) ou un alias d'import
//      (`import { setDoc as ecrireDoc }`) ecrivait sans jamais etre vu. La
//      liste blanche est relevee sur le corps REEL et figee ; elle est verifiee
//      par un test temoin (`appelsDuCorps`), donc toute evolution legitime du
//      code oblige a la relire a la main.
//
// Ces deux mecanismes se completent : M2 ferme « l'ecriture cachee derriere un
// nom inconnu », M1 ferme « l'ecriture visible dont le payload n'est pas
// lisible statiquement ». S'y ajoute le garde-fou historique
// `verifierAucuneEcritureNonReconnue` (addDoc/writeBatch/runTransaction,
// `batch.set(`...), conserve tel quel.
//
// ── CE QUI RESTE UNE LIMITE DECLAREE (et n'est donc PAS couvert) ────────────
//  L1. Un spread d'expression sans objet litteral visible (`...opts.extra`) ne
//      revele aucune cle : il est ignore (cf. `clesEcritesParSpread`). Aucun
//      champ du contrat actuel n'est ecrit ainsi.
//  L2. L'analyse est INTRA-procedurale et intra-fichier : ce qui se passe DANS
//      une fonction appelee n'est pas suivi. M2 compense en refusant l'appel
//      lui-meme, il ne le comprend pas.
//  L3. Le contenu des chaines (y compris l'interieur d'un `${...}` de template)
//      est neutralise avant toute recherche : un appel ecrit a l'interieur d'un
//      template litteral serait invisible. Le corps reel n'en contient aucun.
//  L4. Le verrou lit `saveClubWeekContext` et elle seule : une ecriture dans le
//      meme document faite depuis une AUTRE fonction du repo n'est pas vue.
describe("11. VERROU — WEEK_CONTEXT_CONTRACT_FIELDS == cles ecrites par saveClubWeekContext", () => {
  const CLUBS_REPO_PATH = join(__dirname, "..", "..", "repositories", "clubsRepo.ts");
  const CLUBS_REPO_SOURCE = readFileSync(CLUBS_REPO_PATH, "utf8");

  /**
   * Indice JUSTE APRES le delimiteur fermant correspondant au delimiteur
   * ouvrant en position `debut` (qui DOIT etre `ouvrant`). Ignore les
   * delimiteurs trouves a l'interieur d'une chaine ('...', "...", `...`) pour
   * ne pas se faire piéger par un texte contenant "{"/"}" ou "("/")".
   * Generique : sert aux accolades d'un objet ET aux parentheses d'un appel
   * de fonction (`setDoc(...)`), meme logique, meme risque de piege.
   */
  function finDelimiteurEquilibre(texte: string, debut: number, ouvrant: string, fermant: string): number {
    if (texte[debut] !== ouvrant) throw new Error(`Position de depart invalide (attendu '${ouvrant}')`);
    let profondeur = 0;
    let i = debut;
    for (; i < texte.length; i += 1) {
      const c = texte[i];
      if (c === '"' || c === "'" || c === "`") {
        const guillemet = c;
        i += 1;
        while (i < texte.length && texte[i] !== guillemet) {
          if (texte[i] === "\\") i += 1;
          i += 1;
        }
        continue;
      }
      if (c === ouvrant) profondeur += 1;
      else if (c === fermant) {
        profondeur -= 1;
        if (profondeur === 0) return i + 1;
      }
    }
    throw new Error(`Delimiteur fermant '${fermant}' introuvable`);
  }

  function finAccoladeEquilibree(texte: string, debut: number): number {
    return finDelimiteurEquilibre(texte, debut, "{", "}");
  }

  /** Meme garantie que `finAccoladeEquilibree`, pour les parentheses d'un appel. */
  function finParenEquilibree(texte: string, debut: number): number {
    return finDelimiteurEquilibre(texte, debut, "(", ")");
  }

  /**
   * Retire les commentaires `//...` et `/* ... *\/` d'un texte, SAUF quand ils
   * apparaissent a l'interieur d'une chaine ('...', "...", `...`) — une chaine
   * qui contient litteralement "//" ne doit jamais etre tronquee. Un
   * commentaire n'est jamais une cle de payload : sans ce nettoyage, un simple
   * `// commentaire` glisse dans `segmentsTopLevel` comme un segment top-level
   * qui ne matche ni un spread ni `cle: valeur`, et fait tomber
   * `extraireClesObjet` en erreur « forme non reconnue » — un FAUX POSITIF du
   * verrou (le test rougirait pour la mauvaise raison : un commentaire n'est
   * pas une derive de contrat).
   */
  function retirerCommentaires(texte: string): string {
    let resultat = "";
    let i = 0;
    while (i < texte.length) {
      const c = texte[i];
      if (c === '"' || c === "'" || c === "`") {
        const guillemet = c;
        let j = i + 1;
        while (j < texte.length && texte[j] !== guillemet) {
          if (texte[j] === "\\") j += 1;
          j += 1;
        }
        resultat += texte.slice(i, Math.min(j + 1, texte.length));
        i = j + 1;
        continue;
      }
      if (c === "/" && texte[i + 1] === "/") {
        // Jusqu'a la fin de ligne EXCLUE : le "\n" est laisse en place pour ne
        // pas coller deux tokens qui se retrouvaient sur des lignes distinctes.
        while (i < texte.length && texte[i] !== "\n") i += 1;
        continue;
      }
      if (c === "/" && texte[i + 1] === "*") {
        const fin = texte.indexOf("*/", i + 2);
        i = fin < 0 ? texte.length : fin + 2;
        resultat += " "; // evite de coller deux tokens adjacents
        continue;
      }
      resultat += c;
      i += 1;
    }
    return resultat;
  }

  /**
   * Meme texte, mais avec le CONTENU de chaque chaine remplace par des espaces
   * (longueur preservee, pour ne pas decaler les indices utiles aux messages
   * d'erreur). Sert a chercher un motif d'appel (`.set(`, `runTransaction(`...)
   * sans se faire piéger par une chaine qui contiendrait litteralement ce texte.
   */
  function masquerChaines(texte: string): string {
    let resultat = "";
    let i = 0;
    while (i < texte.length) {
      const c = texte[i];
      if (c === '"' || c === "'" || c === "`") {
        const guillemet = c;
        let j = i + 1;
        while (j < texte.length && texte[j] !== guillemet) {
          if (texte[j] === "\\") j += 1;
          j += 1;
        }
        const finChaine = Math.min(j + 1, texte.length);
        resultat += " ".repeat(finChaine - i);
        i = finChaine;
        continue;
      }
      resultat += c;
      i += 1;
    }
    return resultat;
  }

  /** Corps complet (bloc `{ ... }`) d'une fonction exportee, retrouve dans `source`. */
  function corpsFonction(source: string, nom: string): string {
    const marqueur = `function ${nom}(`;
    const debutSignature = source.indexOf(marqueur);
    if (debutSignature < 0) throw new Error(`Fonction ${nom} introuvable dans le source fourni`);
    // Referme la liste de PARAMETRES (peut contenir un type objet avec ses
    // propres accolades, ex: `opts: { clubId: string; ... }`) — on ne compte
    // donc que les parentheses, jamais les accolades, a cette etape.
    let i = debutSignature + marqueur.length;
    let profondeurParens = 1;
    while (i < source.length && profondeurParens > 0) {
      if (source[i] === "(") profondeurParens += 1;
      else if (source[i] === ")") profondeurParens -= 1;
      i += 1;
    }
    const debutCorps = source.indexOf("{", i);
    if (debutCorps < 0) throw new Error(`Corps de ${nom} introuvable`);
    const finCorps = finAccoladeEquilibree(source, debutCorps);
    return source.slice(debutCorps, finCorps);
  }

  /** `setDoc(` / `updateDoc(` : les DEUX seules ecritures Firestore dont ce
   * fichier sait lire statiquement le payload (l'objet de donnees suit
   * immediatement la reference du document). */
  const RE_APPEL_ECRITURE_RECONNU = /\b(setDoc|updateDoc)\s*\(/g;

  /**
   * TOUTE forme d'ecriture Firestore que ce fichier ne sait PAS lire
   * statiquement : `addDoc`/`deleteDoc`/`writeBatch`/`runTransaction`, ou un
   * appel de methode caracteristique d'un batch/d'une transaction
   * (`batch.set(`, `tx.update(`, `transaction.delete(`...). Volontairement
   * plus large que necessaire : mieux vaut un faux positif genant qu'une
   * ecriture invisible pour le verrou.
   */
  const RE_ECRITURE_NON_RECONNUE =
    /\b(addDoc|deleteDoc|writeBatch|runTransaction)\s*\(|[)\]\w]\s*\.\s*(set|update|delete)\s*\(/g;

  /**
   * FAIL-CLOSED : leve si le corps de fonction contient une ecriture que ce
   * fichier ne sait pas lire statiquement (cf. `RE_ECRITURE_NON_RECONNUE`).
   * Sans ce garde-fou, une ecriture ajoutee via `writeBatch`/`runTransaction`/
   * `addDoc` resterait invisible du verrou — celui-ci ne regarderait QUE les
   * `setDoc`/`updateDoc` qu'il sait parcourir, et resterait vert en silence
   * sur tout le reste. Les commentaires et le contenu des chaines sont
   * neutralises avant la recherche : un commentaire ou une chaine qui
   * mentionne "runTransaction(" ne doit jamais faire tomber le verrou.
   */
  function verifierAucuneEcritureNonReconnue(corpsFn: string): void {
    const texte = masquerChaines(retirerCommentaires(corpsFn));
    RE_ECRITURE_NON_RECONNUE.lastIndex = 0;
    const trouve = RE_ECRITURE_NON_RECONNUE.exec(texte);
    if (trouve) {
      const extrait = corpsFn.slice(trouve.index, trouve.index + trouve[0].length).trim();
      throw new Error(
        `forme d'ecriture non reconnue dans le corps de la fonction (verrou fail-closed) : "${extrait}" — ` +
          `seuls setDoc(...) et updateDoc(...) sont lus statiquement ici ; etends l'extraction ou normalise l'ecriture`,
      );
    }
  }

  // ── M2 : LISTE BLANCHE FERMEE DES APPELS DU CORPS ────────────────────────

  /**
   * Les SEULS appels de fonction tolerés dans le corps de
   * `saveClubWeekContext`. Liste relevee sur le corps REEL (`doc`, `setDoc`,
   * `deleteField`, `serverTimestamp`) puis figee, plus `updateDoc` qui est
   * l'autre ecriture que M1 sait lire. Tout le reste fait tomber le test.
   *
   * Pourquoi une liste blanche et pas « je cherche le mot setDoc » : la
   * detection nominale ne voit que ce qu'elle a nomme. Un helper local
   * (`await ecrireCadre(ref, opts)`) ou un alias d'import
   * (`import { setDoc as ecrireDoc }`) ecrit exactement comme `setDoc`, sans
   * jamais porter son nom — invisible pour une liste enumeree, refuse par une
   * liste blanche. C'est un refus, pas une comprehension : le verrou ne suit
   * PAS ce que fait la fonction appelee (limite L2).
   */
  const APPELS_AUTORISES = new Set(["setDoc", "updateDoc", "doc", "deleteField", "serverTimestamp"]);

  /**
   * Mots-cles du langage qui peuvent etre suivis d'une parenthese sans etre un
   * appel de fonction (`if (...)`, `return (...)`, `typeof (...)`,
   * `async (...) => ...`). Les ignorer evite un faux positif de M2 sur de la
   * syntaxe ordinaire. Contrepartie assumee : une fonction qui porterait
   * litteralement un de ces noms (seul `async` est un identifiant legal) ne
   * serait pas signalee.
   */
  const MOTS_CLES_NON_APPEL = new Set([
    "if", "for", "while", "switch", "catch", "return", "typeof", "await", "new", "delete",
    "void", "yield", "instanceof", "in", "of", "do", "else", "case", "throw", "async", "function",
  ]);

  /** Un identifiant (eventuellement une chaine `a.b.c`) colle a une "(". */
  const RE_APPEL_QUELCONQUE = /[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\(/g;

  /**
   * Tous les callees appeles dans un corps de fonction, dans l'ordre, doublons
   * compris. Commentaires retires et CONTENU des chaines neutralise avant la
   * recherche : ni un commentaire ni une chaine qui mentionne `foo(` ne doit
   * compter comme un appel.
   */
  function appelsDuCorps(corpsFn: string): string[] {
    const texte = masquerChaines(retirerCommentaires(corpsFn));
    const appels: string[] = [];
    RE_APPEL_QUELCONQUE.lastIndex = 0;
    let trouve: RegExpExecArray | null;
    while ((trouve = RE_APPEL_QUELCONQUE.exec(texte))) {
      const callee = trouve[0].slice(0, -1).replace(/\s+/g, "");
      if (!MOTS_CLES_NON_APPEL.has(callee)) appels.push(callee);
    }
    return appels;
  }

  /** FAIL-CLOSED (M2) : un seul appel hors liste blanche fait tomber le test. */
  function verifierAppelsWhitelistes(corpsFn: string, nomFonction: string): void {
    for (const callee of appelsDuCorps(corpsFn)) {
      if (APPELS_AUTORISES.has(callee)) continue;
      throw new Error(
        `appel non whitelisté dans ${nomFonction} : ${callee} — un helper ou un alias peut cacher une écriture`,
      );
    }
  }

  // ── M1 : LECTURE DU PAYLOAD PAR POSITION D'ARGUMENT ──────────────────────

  /** Extrait borne, pour garder les messages d'erreur lisibles. */
  function extraitCourt(texte: string): string {
    const plat = texte.replace(/\s+/g, " ").trim();
    return plat.length > 160 ? `${plat.slice(0, 160)}…` : plat;
  }

  /**
   * Corps de l'objet litteral passe en 2e ARGUMENT d'un appel d'ecriture
   * (`setDoc(ref, PAYLOAD, ...)`, `updateDoc(ref, PAYLOAD)`), retourne
   * STRICTEMENT entre ses accolades.
   *
   * C'est la correction du bug de conception : la version precedente localisait
   * le payload avec `indexOf("{")`, donc la PREMIERE accolade de l'appel. Sur
   * `setDoc(ref, payload, { merge: true })` elle lisait `{ merge: true }` et
   * concluait, en silence, que le contrat valait `merge`. Ici l'argument est
   * designe par sa POSITION, et sa forme est EXIGEE : tout ce qui n'est pas un
   * objet litteral (ternaire, `Object.assign(...)`, variable, appel,
   * `{...} as X`) fait tomber le test en nommant le segment fautif.
   */
  function payloadLitteralDeAppel(nomAppel: string, texteArguments: string): string {
    const args = segmentsTopLevel(texteArguments);
    if (args.length < 2) {
      throw new Error(
        `${nomAppel}(...) : moins de 2 arguments, aucun payload en 2e position — "${extraitCourt(texteArguments)}"`,
      );
    }
    const brut = args[1].trim();
    const echoue = (raison: string) => {
      throw new Error(
        `${nomAppel}(...) : le 2e argument n'est pas un objet litteral "{ ... }" (${raison}) — ` +
          `le verrou ne sait pas lire ce payload statiquement : "${extraitCourt(brut)}"`,
      );
    };
    if (brut[0] !== "{") echoue("il ne commence pas par une accolade");
    const finObjet = finAccoladeEquilibree(brut, 0);
    if (finObjet !== brut.length) echoue("du code suit l'accolade fermante");
    return brut.slice(1, finObjet - 1);
  }

  /**
   * Objets de donnees (texte STRICTEMENT entre accolades) de TOUTES les
   * ecritures `setDoc(...)`/`updateDoc(...)` trouvees dans un corps de
   * fonction, dans l'ordre d'apparition. Une fonction peut ecrire plusieurs
   * documents, ou le meme document en plusieurs appels : ne regarder que le
   * PREMIER `setDoc` laissait toute ecriture suivante hors radar — un
   * deuxieme `setDoc`/`updateDoc` ajoutant une cle hors contrat passait
   * inapercu, suite verte a tort.
   *
   * Le motif d'appel est cherche sur une copie dont le CONTENU des chaines est
   * neutralise (longueur preservee, donc indices identiques) : une chaine qui
   * contiendrait litteralement "setDoc(" ne doit pas etre prise pour un appel.
   */
  function objetsPayloadEcriture(corpsFn: string): string[] {
    const texte = retirerCommentaires(corpsFn);
    const masque = masquerChaines(texte); // meme longueur : les indices restent valides
    const objets: string[] = [];
    RE_APPEL_ECRITURE_RECONNU.lastIndex = 0;
    let appel: RegExpExecArray | null;
    while ((appel = RE_APPEL_ECRITURE_RECONNU.exec(masque))) {
      const nomAppel = appel[1];
      const debutParen = appel.index + appel[0].length - 1; // position du "(" ouvrant
      const finAppel = finParenEquilibree(texte, debutParen);
      // Texte STRICTEMENT entre les parentheses de l'appel (finAppel pointe
      // juste apres le ")").
      objets.push(payloadLitteralDeAppel(nomAppel, texte.slice(debutParen + 1, finAppel - 1)));
      RE_APPEL_ECRITURE_RECONNU.lastIndex = finAppel; // reprend APRES cet appel, jamais dedans
    }
    return objets;
  }

  /** Decoupe un corps d'objet en segments top-level, en respectant chaines et imbrications. */
  function segmentsTopLevel(corps: string): string[] {
    const segments: string[] = [];
    let profondeur = 0;
    let debutSegment = 0;
    let i = 0;
    while (i < corps.length) {
      const c = corps[i];
      if (c === '"' || c === "'" || c === "`") {
        const guillemet = c;
        i += 1;
        while (i < corps.length && corps[i] !== guillemet) {
          if (corps[i] === "\\") i += 1;
          i += 1;
        }
        i += 1;
        continue;
      }
      if (c === "{" || c === "(" || c === "[") profondeur += 1;
      else if (c === "}" || c === ")" || c === "]") profondeur -= 1;
      else if (c === "," && profondeur === 0) {
        segments.push(corps.slice(debutSegment, i));
        i += 1;
        debutSegment = i;
        continue;
      }
      i += 1;
    }
    const dernier = corps.slice(debutSegment);
    if (dernier.trim()) segments.push(dernier);
    return segments;
  }

  type ClesEcriture = { ecrites: string[]; supprimees: string[] };

  /**
   * Cles portees par un SEGMENT SPREAD (`...expr`) d'un objet litteral :
   * `...(opts.uid ? { a: opts.uid } : {})`, `...(cond ? {a} : {b: deleteField()})`,
   * `...extra(...)`. Un spread FUSIONNE ses cles au niveau ou il apparait — c'est
   * exactement ce que fait JavaScript a l'execution — donc on cherche TOUT objet
   * litteral `{ ... }` present dans l'expression du spread (les deux branches d'un
   * ternaire, une expression parenthesee, peu importe l'imbrication) et on
   * recycle `extraireClesObjet` sur son contenu : si cet objet contient lui-meme
   * un spread, il est deroule pareil, recursivement.
   *
   * Un spread qui ne contient AUCUN objet litteral visible (`...opts.extra`, une
   * variable dont la forme n'est pas connue statiquement) ne peut rien reveler :
   * il est ignore, comme avant — c'est une limite assumee de l'analyse statique,
   * pas un trou du verrou (aucun champ du contrat actuel n'est ecrit ainsi).
   */
  function clesEcritesParSpread(segmentSpread: string): ClesEcriture {
    const ecrites: string[] = [];
    const supprimees: string[] = [];
    const expression = segmentSpread.replace(/^\.\.\./, "");
    let i = 0;
    while (i < expression.length) {
      const c = expression[i];
      if (c === '"' || c === "'" || c === "`") {
        const guillemet = c;
        i += 1;
        while (i < expression.length && expression[i] !== guillemet) {
          if (expression[i] === "\\") i += 1;
          i += 1;
        }
        i += 1;
        continue;
      }
      if (c === "{") {
        const fin = finAccoladeEquilibree(expression, i);
        const trouve = extraireClesObjet(expression.slice(i + 1, fin - 1));
        ecrites.push(...trouve.ecrites);
        supprimees.push(...trouve.supprimees);
        i = fin;
        continue;
      }
      i += 1;
    }
    return { ecrites, supprimees };
  }

  /**
   * Cles top-level d'un objet litteral : `ecrites` porte une vraie valeur,
   * `supprimees` porte un `deleteField()` — c'est une SUPPRESSION, pas un champ
   * du contrat (cas de `note` dans saveClubWeekContext). Un segment SPREAD
   * (`...(cond ? { cle: ... } : ...)`) est deroule par `clesEcritesParSpread` :
   * sans ca, une cle ajoutee derriere un spread conditionnel n'apparaissait dans
   * AUCUNE des deux listes et le verrou ne la voyait jamais deriver.
   *
   * ECHOUE OUVERT, PAS FERME : un segment top-level non vide qui n'est ni un
   * spread, ni de la forme `identifiant: valeur` (une cle entre guillemets
   * `"x": v`, une cle calculee `[expr]: v`, etc.) ne doit JAMAIS etre ignore en
   * silence — sinon le verrou peut rester vert en ayant simplement vu MOINS de
   * cles que ce que le payload ecrit vraiment. On fait donc echouer
   * l'extraction avec un message explicite plutot que de `continue`r. La seule
   * limite qui reste assumee telle quelle est celle de `clesEcritesParSpread` :
   * un spread sans objet litteral visible (`...opts.extra`) ne revele rien
   * statiquement (cf. sa doc juste au-dessus).
   */
  function extraireClesObjet(corpsObjet: string): ClesEcriture {
    const ecrites: string[] = [];
    const supprimees: string[] = [];
    // Un commentaire n'est jamais une cle : retire AVANT de couper en segments,
    // sinon un `// commentaire` isole se retrouve seul dans son segment (ou
    // colle au segment suivant) et ne matche ni un spread ni `cle: valeur`.
    for (const segment of segmentsTopLevel(retirerCommentaires(corpsObjet))) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("...")) {
        const trouve = clesEcritesParSpread(trimmed);
        ecrites.push(...trouve.ecrites);
        supprimees.push(...trouve.supprimees);
        continue;
      }
      const m = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/);
      if (!m) {
        throw new Error(
          `forme non reconnue dans le payload de saveClubWeekContext : ${trimmed} — étends l'extraction ou normalise l'écriture`,
        );
      }
      const [, cle, valeur] = m;
      if (/^deleteField\(\s*\)$/.test(valeur.trim())) supprimees.push(cle);
      else ecrites.push(cle);
    }
    return { ecrites: [...new Set(ecrites)], supprimees: [...new Set(supprimees)] };
  }

  /**
   * Union des cles ECRITES et SUPPRIMEES par TOUTES les ecritures
   * `setDoc`/`updateDoc` d'un corps de fonction (une fonction peut ecrire
   * plusieurs documents, ou le meme document en plusieurs appels).
   *
   * Fail-closed en QUATRE temps, du filet le plus large au plus precis :
   *  1. `verifierAucuneEcritureNonReconnue` : autre API d'ecriture
   *     (addDoc/writeBatch/runTransaction, `batch.set(`...) ;
   *  2. M2 `verifierAppelsWhitelistes` : appel dont le nom n'est pas dans la
   *     liste blanche — helper local ou alias d'import ;
   *  3. M1, dans `objetsPayloadEcriture` : 2e argument qui n'est pas un objet
   *     litteral ;
   *  4. absence totale de `setDoc`/`updateDoc` reconnu (une fonction censee
   *     ecrire qui n'ecrit visiblement rien n'est pas un verrou qui passe,
   *     c'est un verrou qui ne verrouille plus rien).
   */
  function clesEcritesDansCorpsFonction(
    corpsFn: string,
    nomFonction = "saveClubWeekContext",
  ): ClesEcriture {
    verifierAucuneEcritureNonReconnue(corpsFn);
    verifierAppelsWhitelistes(corpsFn, nomFonction);
    const payloads = objetsPayloadEcriture(corpsFn);
    if (payloads.length === 0) {
      throw new Error("Aucune ecriture setDoc/updateDoc trouvee dans ce corps de fonction");
    }
    const ecrites = new Set<string>();
    const supprimees = new Set<string>();
    for (const payload of payloads) {
      const trouve = extraireClesObjet(payload);
      trouve.ecrites.forEach((c) => ecrites.add(c));
      trouve.supprimees.forEach((c) => supprimees.add(c));
    }
    return { ecrites: [...ecrites], supprimees: [...supprimees] };
  }

  /** Cles reellement ecrites par saveClubWeekContext, lues DANS `source`. */
  function clesEcritesParSaveClubWeekContext(source: string): ClesEcriture {
    const corps = corpsFonction(source, "saveClubWeekContext");
    return clesEcritesDansCorpsFonction(corps);
  }

  test("saveClubWeekContext existe toujours a l'endroit attendu (sinon le verrou ne verrouille rien)", () => {
    expect(CLUBS_REPO_SOURCE).toContain("function saveClubWeekContext(");
  });

  test("`note` est une SUPPRESSION (deleteField()), jamais une cle ecrite", () => {
    const { ecrites, supprimees } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    expect(supprimees).toEqual(["note"]);
    expect(ecrites).not.toContain("note");
  });

  test("LE VERROU : les cles ecrites == WEEK_CONTEXT_CONTRACT_FIELDS, exactement", () => {
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    expect([...ecrites].sort()).toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("`createdAt` n'est plus dans le contrat — il n'a jamais ete ecrit par le code", () => {
    // Le bug reel corrige ici : `createdAt` vivait dans le contrat sans jamais
    // etre pose par saveClubWeekContext. Sans lui, un vieux document qui porte
    // encore un `createdAt` d'une autre origine (ex: Admin SDK) n'est plus pris
    // pour un champ legitime.
    expect(WEEK_CONTEXT_CONTRACT_FIELDS).not.toContain("createdAt");
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    expect(ecrites).not.toContain("createdAt");
  });

  // ── LA PREUVE QUE LE VERROU MORD ─────────────────────────────────────────
  // Les deux tests ci-dessous ne touchent JAMAIS le fichier sur disque : ils
  // mutent une COPIE en memoire du texte source (jamais ecrite), puis relancent
  // exactement la meme extraction. Si le verrou ne detectait pas ces
  // divergences fabriquees, il ne detecterait pas non plus une vraie derive.

  test("mord si le CODE ecrit une cle absente du contrat (ex: futur champFantome)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      "weekKey: opts.weekKey,",
      "weekKey: opts.weekKey,\n      champFantome: opts.uid,",
    );
    // La mutation a bien eu lieu : sinon le test suivant ne prouverait rien.
    expect(corpsMute).not.toBe(corpsOriginal);

    const { ecrites } = extraireClesObjet(objetsPayloadEcriture(corpsMute)[0]);
    expect(ecrites).toContain("champFantome");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("mord si le CODE ecrit une cle via un SPREAD CONDITIONNEL (`...(cond ? { cle } : ...)`)", () => {
    // Un simple `key: value` n'est pas la seule facon d'ajouter un champ au
    // payload : `...(opts.uid ? { champSpread: opts.uid } : {})` le fait tout
    // aussi bien, et une extraction qui ne regarde que les segments `cle:` tout
    // court passe totalement a cote (elle ignore le segment spread en silence).
    // Verifie AVANT tout que ce cas etait bien un trou : sans le derouleur de
    // spread, cette meme mutation laissait `ecrites` identique au contrat et le
    // test suivant aurait echoue a tort — c'est exactement l'incident vecu sur
    // `repositories/clubsRepo.ts` (preuve en dehors du fichier, cf. rapport).
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      "note: deleteField(),",
      "note: deleteField(),\n      ...(opts.uid ? { champSpread: opts.uid } : {}),",
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    const { ecrites } = extraireClesObjet(objetsPayloadEcriture(corpsMute)[0]);
    expect(ecrites).toContain("champSpread");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("un spread conditionnel dont AUCUNE branche n'est retenue (deleteField()) reste une suppression", () => {
    // Temoin : un spread peut aussi porter une suppression, pas seulement une
    // ecriture. `...(cond ? { note: deleteField() } : {})` doit ranger `note`
    // dans `supprimees`, pas dans `ecrites` — meme regle que pour un `deleteField()`
    // ecrit directement.
    const { ecrites, supprimees } = extraireClesObjet(
      "weekKey: opts.weekKey,\n...(opts.flag ? { note: deleteField() } : {}),",
    );
    expect(supprimees).toEqual(["note"]);
    expect(ecrites).toEqual(["weekKey"]);
  });

  test("mord si le CONTRAT porte une cle que le code n'ecrit jamais (le bug `createdAt` reproduit)", () => {
    // Reproduit EXACTEMENT l'incident corrige par ce commit, sur une COPIE :
    // le tableau reel exporte par le module n'est jamais modifie.
    const contratAvecFantome = [...WEEK_CONTEXT_CONTRACT_FIELDS, "createdAt"];
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    expect([...ecrites].sort()).not.toEqual([...contratAvecFantome].sort());
  });

  test("reecrire la MEME valeur qu'un champ deja dans le contrat ne casse rien (temoin positif)", () => {
    // Sans ce temoin, un verrou trop strict pourrait rougir sur un simple
    // reformatage du code (ex: reordonner les cles) sans qu'aucune derive
    // reelle n'existe.
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    for (const champ of WEEK_CONTEXT_CONTRACT_FIELDS) {
      expect(ecrites).toContain(champ);
    }
    expect(ecrites.length).toBe(WEEK_CONTEXT_CONTRACT_FIELDS.length);
  });

  // ── LE VERROU COUVRE TOUTES LES ECRITURES, PAS SEULEMENT LA PREMIERE ────
  // Avant cette section, `objetPayloadSetDoc` ne regardait que le PREMIER
  // `setDoc(` du corps de fonction : une deuxieme ecriture vers le meme
  // document (un deuxieme `setDoc`, ou un `updateDoc`) ajoutant une cle hors
  // contrat passait totalement inapercue, suite verte a tort. Les deux tests
  // ci-dessous mutent une COPIE en memoire (jamais le fichier sur disque) pour
  // le prouver : `saveClubWeekContext` n'a aujourd'hui qu'une seule ecriture,
  // ces mutations simulent un futur ou elle en aurait deux.

  // Le fichier source est en CRLF (Windows) : toute mutation par substring doit
  // matcher la fin de l'appel `setDoc` via une regex tolerante a `\r?\n`,
  // jamais un `\n` en dur qui ne matcherait rien sur ce depot et laisserait
  // silencieusement `corpsMute === corpsOriginal` (le `.not.toBe` ci-dessous
  // est justement le garde-fou qui l'aurait revele).
  const RE_FIN_APPEL_SETDOC = /\{ merge: true \}\r?\n\s*\);/;

  test("mord si une DEUXIEME ecriture (setDoc) ajoute une cle hors contrat", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      RE_FIN_APPEL_SETDOC,
      (m) => `${m}\n  await setDoc(ref, { champFantomeDeuxiemeEcriture: opts.uid });`,
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    const { ecrites } = clesEcritesDansCorpsFonction(corpsMute);
    expect(ecrites).toContain("champFantomeDeuxiemeEcriture");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("mord si une ecriture updateDoc ajoute une cle hors contrat", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      RE_FIN_APPEL_SETDOC,
      (m) => `${m}\n  await updateDoc(ref, { champFantomeUpdateDoc: opts.uid });`,
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    const { ecrites } = clesEcritesDansCorpsFonction(corpsMute);
    expect(ecrites).toContain("champFantomeUpdateDoc");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("fail-closed : une ecriture BATCH/TRANSACTION non reconnue fait tomber le test, message explicite", () => {
    // `batch.set(...)`/`transaction.update(...)` sont des ecritures Firestore
    // tout aussi reelles qu'un `setDoc` — ce fichier ne sait pas lire leur
    // payload statiquement, donc il ne doit JAMAIS les ignorer en silence.
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      RE_FIN_APPEL_SETDOC,
      (m) => `${m}\n  batch.set(ref, { champBatch: opts.uid });`,
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    expect(() => clesEcritesDansCorpsFonction(corpsMute)).toThrow(/forme d'ecriture non reconnue/);
  });

  test("fail-closed : addDoc/writeBatch/runTransaction font aussi tomber le test (autre API d'ecriture)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    for (const appelSuspect of [
      'await addDoc(collection(db, "clubs"), { champAddDoc: opts.uid });',
      "const batch = writeBatch(db);",
      "await runTransaction(db, async (tx) => { tx.set(ref, { x: 1 }); });",
    ]) {
      const corpsMute = corpsOriginal.replace(RE_FIN_APPEL_SETDOC, (m) => `${m}\n  ${appelSuspect}`);
      expect(corpsMute).not.toBe(corpsOriginal);
      expect(() => clesEcritesDansCorpsFonction(corpsMute)).toThrow(/forme d'ecriture non reconnue/);
    }
  });

  test("un commentaire // dans le payload n'est PAS pris pour une forme non reconnue (faux positif desamorce)", () => {
    // Preuve inverse des tests fail-closed ci-dessus : un simple commentaire
    // n'est pas une ecriture non reconnue, ni une cle mal formee. Sans le
    // nettoyage `retirerCommentaires`, ce commentaire glissait dans un segment
    // top-level et faisait tomber `extraireClesObjet` en erreur — un faux
    // positif du verrou, pas une vraie derive de contrat.
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    // Substring sur UNE seule ligne (`clubId: opts.clubId,`) : pas de `\n` en
    // dur a faire matcher contre le CRLF du fichier source.
    const corpsMute = corpsOriginal.replace(
      "clubId: opts.clubId,",
      "// commentaire de dev, jamais une cle\n      clubId: opts.clubId, // idem, en fin de ligne\n      /* et un bloc, tant qu'on y est */",
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    const { ecrites, supprimees } = clesEcritesDansCorpsFonction(corpsMute);
    expect([...ecrites].sort()).toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
    expect(supprimees).toEqual(["note"]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // M1 — LE PAYLOAD EST L'ARGUMENT D'INDEX 1, PAS « LA PREMIERE ACCOLADE »
  // ══════════════════════════════════════════════════════════════════════════
  // Le bug de conception ferme ici : le verrou localisait le payload avec
  // `indexOf("{")`. Des que le 2e argument n'etait pas deja une accolade
  // (variable, ternaire, Object.assign), la premiere accolade rencontree etait
  // celle des OPTIONS — `{ merge: true }` — et le verrou comparait donc le
  // contrat a la cle `merge`, en silence, sans jamais rougir.

  /** Le payload REEL du `setDoc` de saveClubWeekContext (objet litteral, 2e argument). */
  const RE_PAYLOAD_SETDOC = /(await setDoc\(\s*ref,\s*)(\{[\s\S]*?\},)(\s*\{ merge: true \})/;

  /**
   * Remplace le PAYLOAD du setDoc reel par autre chose, sur une COPIE en
   * memoire. Jette si le motif ne matche pas : une mutation inoperante rendrait
   * la preuve creuse (le test « passerait » en n'ayant rien mute du tout).
   */
  function remplacerPayload(corps: string, remplacement: string): string {
    const mute = corps.replace(RE_PAYLOAD_SETDOC, (_m, avant, _payload, apres) => `${avant}${remplacement}${apres}`);
    if (mute === corps) throw new Error("mutation de test inoperante : le motif du payload n'a pas matche");
    return mute;
  }

  /** Message d'erreur leve par `fn`, ou "" si `fn` n'a rien leve. */
  function messageLeve(fn: () => unknown): string {
    try {
      fn();
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  }

  test("M1 temoin : le payload lu est bien le 2e argument, JAMAIS `{ merge: true }`", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const payloads = objetsPayloadEcriture(corpsOriginal);

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toContain("weekKey");
    expect(payloads[0]).toContain("trainingIntensity");
    // La sonde : `merge` appartient au 3e argument (les options), il ne doit
    // jamais se retrouver dans le texte pris pour le payload.
    expect(payloads[0]).not.toContain("merge");
    expect(extraireClesObjet(payloads[0]).ecrites).not.toContain("merge");
  });

  test("M1 mord si le payload est un TERNAIRE (aucune des deux branches n'est lue en douce)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = remplacerPayload(
      corpsOriginal,
      "opts.uid ? { champTernaireA: opts.uid } : { champTernaireB: opts.uid },",
    );

    const message = messageLeve(() => clesEcritesDansCorpsFonction(corpsMute));
    expect(message).toMatch(/le 2e argument n'est pas un objet litteral/);
    expect(message).toContain("champTernaireA"); // le segment fautif est dans le message
  });

  test("M1 mord si le payload est un Object.assign(...)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = remplacerPayload(corpsOriginal, "Object.assign({}, { champAssign: opts.uid }),");

    // M1, pris isolement, refuse deja ce payload...
    expect(() => objetsPayloadEcriture(corpsMute)).toThrow(/le 2e argument n'est pas un objet litteral/);
    // ...et dans la chaine complete c'est M2 qui parle en premier, parce qu'un
    // appel `Object.assign` n'a rien a faire dans cette fonction. Les deux
    // messages nomment le vrai probleme ; aucun des deux ne laisse passer.
    expect(messageLeve(() => clesEcritesDansCorpsFonction(corpsMute))).toMatch(
      /appel non whitelisté dans saveClubWeekContext : Object\.assign/,
    );
  });

  test("M1 mord si le payload est une VARIABLE — et le message nomme la variable, pas `merge`", () => {
    // LE cas qui prouve la correction du bug de conception. Avec l'ancienne
    // localisation par `indexOf("{")`, ce corps mute donnait `ecrites === ["merge"]`
    // sans rien lever : le verrou comparait le contrat aux OPTIONS de setDoc.
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = remplacerPayload(corpsOriginal, "payloadCache,").replace(
      "await setDoc(",
      "const payloadCache = { champCache: opts.uid };\n  await setDoc(",
    );
    expect(corpsMute).toContain("payloadCache,");

    const message = messageLeve(() => clesEcritesDansCorpsFonction(corpsMute));
    expect(message).toMatch(/le 2e argument n'est pas un objet litteral/);
    expect(message).toContain("payloadCache");
    // Le message dit le VRAI probleme (payload non litteral), il ne part pas
    // sur une fausse piste en parlant de `merge`.
    expect(message).not.toContain("merge");
  });

  test("M1 mord si du code suit l'accolade fermante (`{...} as Record<string, unknown>`)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = remplacerPayload(
      corpsOriginal,
      "{ champCaste: opts.uid } as Record<string, unknown>,",
    );

    expect(messageLeve(() => clesEcritesDansCorpsFonction(corpsMute))).toMatch(
      /le 2e argument n'est pas un objet litteral .*du code suit l'accolade fermante/,
    );
  });

  test("M1 mord si l'appel d'ecriture n'a pas de 2e argument du tout", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      RE_FIN_APPEL_SETDOC,
      (m) => `${m}\n  await updateDoc(refConstruiteAilleurs);`,
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    expect(messageLeve(() => clesEcritesDansCorpsFonction(corpsMute))).toMatch(
      /updateDoc\(\.\.\.\) : moins de 2 arguments/,
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // M2 — LISTE BLANCHE FERMEE DES APPELS DU CORPS
  // ══════════════════════════════════════════════════════════════════════════
  // Avant M2, la detection des ecritures etait purement NOMINALE : le verrou
  // cherchait les mots `setDoc`/`updateDoc`. Un helper local ou un alias
  // d'import ecrit exactement pareil sans jamais porter ces noms — invisible.

  test("M2 temoin : le corps reel n'appelle QUE des fonctions de la liste blanche", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    // La liste blanche est figee a la main : ce temoin la rend auditable et
    // oblige a la relire si le code evolue.
    expect(appelsDuCorps(corpsOriginal)).toEqual(["doc", "setDoc", "deleteField", "serverTimestamp"]);
    for (const callee of appelsDuCorps(corpsOriginal)) {
      expect(APPELS_AUTORISES.has(callee)).toBe(true);
    }
    expect(() => verifierAppelsWhitelistes(corpsOriginal, "saveClubWeekContext")).not.toThrow();
  });

  test("M2 mord si un HELPER LOCAL est appele (il pourrait ecrire sans qu'on le voie)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      RE_FIN_APPEL_SETDOC,
      (m) => `${m}\n  await ecrireCadreHelper(ref, opts);`,
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    // Le payload du vrai setDoc reste parfaitement lisible : sans M2, la suite
    // resterait VERTE alors qu'une ecriture entiere est passee par le helper.
    expect(() => objetsPayloadEcriture(corpsMute)).not.toThrow();
    expect(messageLeve(() => clesEcritesDansCorpsFonction(corpsMute))).toMatch(
      /appel non whitelisté dans saveClubWeekContext : ecrireCadreHelper — un helper ou un alias peut cacher une écriture/,
    );
  });

  test("M2 mord si setDoc est importe sous un ALIAS (`import { setDoc as ecrireDoc }`)", () => {
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace("await setDoc(", "await ecrireDoc(");
    expect(corpsMute).not.toBe(corpsOriginal);

    expect(messageLeve(() => clesEcritesDansCorpsFonction(corpsMute))).toMatch(
      /appel non whitelisté dans saveClubWeekContext : ecrireDoc/,
    );
  });

  test("M2 ne se declenche PAS sur un commentaire ou une chaine qui mentionne un appel", () => {
    // Faux positif desamorce : `appelsDuCorps` travaille sur un texte dont les
    // commentaires sont retires et le contenu des chaines neutralise.
    const corpsOriginal = corpsFonction(CLUBS_REPO_SOURCE, "saveClubWeekContext");
    const corpsMute = corpsOriginal.replace(
      "clubId: opts.clubId,",
      'clubId: opts.clubId, // ne pas utiliser helperInterdit(ref)\n      trace: "appel ecrireDoc(ref) documente ici",',
    );
    expect(corpsMute).not.toBe(corpsOriginal);

    expect(appelsDuCorps(corpsMute)).toEqual(["doc", "setDoc", "deleteField", "serverTimestamp"]);
    // La cle `trace` est bien vue, elle : le verrou rougit pour la BONNE raison
    // (une cle hors contrat), pas pour un appel imaginaire.
    const { ecrites } = clesEcritesDansCorpsFonction(corpsMute);
    expect(ecrites).toContain("trace");
  });
});
