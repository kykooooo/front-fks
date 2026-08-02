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
//     (front) — lu en PARSANT son source avec le compilateur TypeScript
//     (`ts.createSourceFile`), jamais recopie a la main, et plus jamais par
//     scan de texte. Fail-closed : l'en-tete de la section 11 donne son
//     MODELE DE MENACE, ses trois gardes (G1/G2/G3) et les limites qui
//     restent reelles — a lire avant de lui faire confiance ;
// 12. un champ HERITE CONNU (`createdAt`) est archive comme le reste mais
//     n'est JAMAIS promu note visible : une date ISO n'est pas une note.

import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
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
    const horodatage = { toDate: () => new Date("2026-07-20T08:00:00.000Z") };
    expect(detecterTextesHorsContrat(cadre({ vieilHorodatage: horodatage }))).toEqual([]);
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
// ── MODELE DE MENACE (a lire AVANT de faire confiance a ce verrou) ──────────
// Ce verrou attrape la derive ACCIDENTELLE et les refactors ordinaires : on
// ajoute un champ au payload, on renomme une cle, on deplace une ecriture, on
// passe par un helper — et le contrat cote functions ne suit pas. C'est CA
// qu'il protege, et c'est tout ce qu'il pretend proteger.
// Un contributeur activement MALVEILLANT peut contourner n'importe quel test
// qu'il peut editer (il edite le test, ou le contrat, ou les deux) : ce n'est
// pas le sujet, et aucune analyse statique ne changera ca. Ce qui protege de
// ce cas-la, ce sont les regles Firestore et la revue de code, pas ce fichier.
//
// ── COMMENT (AST, plus aucun scan de texte) ─────────────────────────────────
// Le source est PARSE par le compilateur TypeScript (`ts.createSourceFile`) et
// toute l'analyse se fait sur l'AST. Cinq passes de regex ont perdu la course
// contre la syntaxe JS : un leurre `function saveClubWeekContext(` glisse dans
// un COMMENTAIRE, `(0, alias)(...)`, `ns["setDoc"](...)`, un tagged template,
// et — dans l'autre sens — un FAUX POSITIF sur une simple apostrophe francaise
// dans un commentaire. Un parseur ne se fait avoir par aucun des cinq : un
// commentaire n'est pas un noeud, une apostrophe dans un commentaire n'existe
// pas, et une forme d'appel exotique est un noeud d'un TYPE precis — donc
// refusable explicitement plutot qu'ignoree en silence.
//
// Trois gardes, tous FAIL-CLOSED (en cas de doute le test TOMBE ; il ne
// « passe » jamais en ayant vu MOINS que la realite) :
//
//  G1. LA FONCTION EST TROUVEE DANS L'AST, jamais par `indexOf`. Une
//      declaration commentee, ou son nom dans une chaine, ne sont pas des
//      noeuds : invisibles. Zero declaration trouvee = echec (le verrou ne
//      verrouille plus rien) ; plusieurs = echec aussi (il ne sait pas
//      laquelle est la vraie).
//
//  G2. LISTE BLANCHE FERMEE DES APPELS. Chaque `CallExpression` et chaque
//      `TaggedTemplateExpression` du corps est examine, dans l'ordre du source :
//        - callee = identifiant simple present dans `APPELS_AUTORISES` → tolere ;
//        - callee = identifiant simple ABSENT de la liste → echec
//          « appel non whitelisté » (helper local, alias d'import, `addDoc`,
//          `writeBatch`, `runTransaction`…) ;
//        - TOUTE autre forme de callee → echec « forme d'appel non
//          analysable ». Par construction `(0, setDoc)(...)` (parenthesee),
//          `ns["setDoc"](...)` (calculee), `batch.set(...)` (membre),
//          `Object.assign(...)` (membre) et un tagged template tombent tous
//          ici : le verrou ne pretend pas les comprendre, il les refuse.
//
//  G3. LE PAYLOAD EST L'ARGUMENT D'INDEX 1, ET C'EST UN OBJET LITTERAL.
//      Pour chaque `setDoc`/`updateDoc`, `arguments[1]` DOIT etre un
//      `ObjectLiteralExpression` — une variable, un ternaire, un `{...} as X`,
//      un appel : echec. C'est ce qui ferme le bug de conception d'origine
//      (localiser le payload par « la premiere accolade » faisait lire
//      `{ merge: true }`, donc comparer le contrat a la cle `merge`).
//      Les cles sont ensuite lues sur l'AST :
//        - `PropertyAssignment` a nom identifiant OU chaine litterale — les
//          DEUX sont parfaitement lisibles ici (`"champ-quote": v` est extrait
//          et compare au contrat, la ou le scan de texte le rejetait) ;
//        - `ShorthandPropertyAssignment` (`champCourt,`) ;
//        - `SpreadAssignment` dont l'expression est un objet litteral :
//          recursion, ses cles fusionnent au niveau du dessus comme a
//          l'execution.
//      Une cle CALCULEE (`[k]: v`) ou un spread d'expression NON litterale
//      (`...opts.extra`, `...(cond ? {} : {})`) : echec explicite, jamais un
//      silence — ils peuvent nommer n'importe quel champ.
//      Une cle dont la valeur est `deleteField()` compte comme SUPPRIMEE, pas
//      comme un champ du contrat (c'est le cas de `note`).
//
// ── LES LIMITES QUI RESTENT, ET ELLES SONT REELLES ──────────────────────────
//  L1. PORTEE. Le verrou lit `saveClubWeekContext` et ELLE SEULE. Une ecriture
//      dans `clubs/{clubId}/weekContexts/{weekKey}` faite depuis une autre
//      fonction, un autre fichier, un script, ou l'Admin SDK cote serveur,
//      n'est pas vue par ce test.
//  L2. INTRA-PROCEDURAL. Le verrou ne suit pas ce que FAIT une fonction
//      appelee ; G2 la refuse, il ne la comprend pas. Consequence directe :
//      toute evolution legitime du code oblige a relire `APPELS_AUTORISES` a
//      la main (le temoin `textesAppels` est la pour rendre ca visible).
//  L3. CLES, PAS DONNEES. Ce verrou compare des NOMS DE CHAMPS. Ce qui est
//      reellement stocke depend des valeurs a l'execution ; il ne dit rien de
//      leur contenu.
describe("11. VERROU — WEEK_CONTEXT_CONTRACT_FIELDS == cles ecrites par saveClubWeekContext", () => {
  const CLUBS_REPO_PATH = join(__dirname, "..", "..", "repositories", "clubsRepo.ts");
  const CLUBS_REPO_SOURCE = readFileSync(CLUBS_REPO_PATH, "utf8");
  const NOM_FONCTION = "saveClubWeekContext";

  /**
   * Les SEULS appels de fonction toleres dans le corps de
   * `saveClubWeekContext`. Liste relevee sur le corps REEL (`doc`, `setDoc`,
   * `deleteField`, `serverTimestamp`) puis figee, plus `updateDoc` qui est
   * l'autre ecriture dont G3 sait lire le payload. Tout le reste fait tomber
   * le test (cf. G2 / limite L2).
   */
  const APPELS_AUTORISES = new Set(["doc", "setDoc", "deleteField", "serverTimestamp", "updateDoc"]);

  /** Les deux appels dont le 2e argument EST le payload de donnees. */
  const APPELS_ECRITURE = new Set(["setDoc", "updateDoc"]);

  type ClesEcriture = { ecrites: string[]; supprimees: string[] };

  /** Fonction analysable : declaration classique, ou fonction affectee a un const. */
  type NoeudFonction = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

  /** Ce dont toute l'analyse a besoin : l'arbre, la fonction, son corps. */
  type CibleAnalyse = { sf: ts.SourceFile; fn: NoeudFonction; corps: ts.Node };

  /** Extrait borne, pour garder les messages d'erreur lisibles. */
  function extraitCourt(texte: string): string {
    const plat = texte.replace(/\s+/g, " ").trim();
    return plat.length > 160 ? `${plat.slice(0, 160)}…` : plat;
  }

  /**
   * G1 — la fonction ciblee, retrouvee DANS L'AST du source fourni.
   *
   * `ts.createSourceFile` suffit : on n'a besoin d'aucune resolution de type,
   * seulement de la forme syntaxique exacte. Les erreurs de syntaxe sont
   * verifiees parce qu'un source a moitie parse produit un arbre a moitie vrai
   * — et un verrou a moitie vrai est un verrou vert a tort.
   */
  function cible(source: string, nom = NOM_FONCTION): CibleAnalyse {
    const sf = ts.createSourceFile("clubsRepo.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    if (diagnostics.length > 0) {
      throw new Error(
        `clubsRepo.ts n'est pas parsable (${diagnostics.length} erreur(s) de syntaxe) : ` +
          `le verrou refuse d'analyser un arbre incomplet`,
      );
    }

    const trouves: NoeudFonction[] = [];
    const visiter = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name?.text === nom) trouves.push(n);
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === nom &&
        n.initializer &&
        (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
      ) {
        trouves.push(n.initializer);
      }
      ts.forEachChild(n, visiter);
    };
    visiter(sf);

    if (trouves.length === 0) {
      throw new Error(
        `fonction ${nom} introuvable dans l'AST de clubsRepo.ts — ` +
          `un nom en commentaire ou dans une chaine n'est PAS une declaration`,
      );
    }
    if (trouves.length > 1) {
      throw new Error(
        `${trouves.length} declarations de ${nom} dans l'AST : le verrou ne sait pas laquelle verrouiller`,
      );
    }
    const fn = trouves[0];
    const corps = fn.body;
    if (!corps) throw new Error(`la declaration de ${nom} n'a pas de corps`);
    return { sf, fn, corps };
  }

  /**
   * G2 — parcourt TOUS les appels du corps dans l'ordre du source et appelle
   * `surAppel(nom)` pour chacun.
   *
   * FAIL-CLOSED sur la FORME : toute construction d'appel dont le callee n'est
   * pas un identifiant simple leve immediatement. On ne peut pas confronter a
   * une liste blanche ce qu'on ne sait pas nommer — `(0, setDoc)(...)`,
   * `ns["setDoc"](...)`, `batch.set(...)` et les tagged templates sont donc
   * refuses PAR CONSTRUCTION, sans avoir a les enumerer un par un (c'est
   * exactement ce qu'une liste de motifs regex n'arrivait pas a faire).
   *
   * Le callee est examine AVANT de descendre dans les arguments : sur
   * `runTransaction(db, async (tx) => tx.set(...))`, c'est `runTransaction`
   * qui est signale, pas le `tx.set` interieur.
   */
  function parcourirAppels({ sf, corps }: CibleAnalyse, surAppel: (nom: string) => void): void {
    const visiter = (n: ts.Node): void => {
      if (ts.isTaggedTemplateExpression(n)) {
        throw new Error(
          `forme d'appel non analysable dans ${NOM_FONCTION} : ${extraitCourt(n.getText(sf))} ` +
            `(tagged template : il appelle sa fonction sans parenthese)`,
        );
      }
      if (ts.isCallExpression(n)) {
        if (!ts.isIdentifier(n.expression)) {
          throw new Error(
            `forme d'appel non analysable dans ${NOM_FONCTION} : ${extraitCourt(n.expression.getText(sf))} — ` +
              `seul un appel a un identifiant simple peut etre confronte a la liste blanche`,
          );
        }
        surAppel(n.expression.text);
      }
      ts.forEachChild(n, visiter);
    };
    visiter(corps);
  }

  /** G2 — un seul appel hors liste blanche fait tomber le test. */
  function verifierAppelsWhitelistes(c: CibleAnalyse): void {
    parcourirAppels(c, (callee) => {
      if (APPELS_AUTORISES.has(callee)) return;
      throw new Error(
        `appel non whitelisté dans ${NOM_FONCTION} : ${callee} — un helper ou un alias peut cacher une écriture`,
      );
    });
  }

  /**
   * G3 — les objets litteraux passes en 2e ARGUMENT de chaque `setDoc`/
   * `updateDoc` du corps, dans l'ordre. Une fonction peut ecrire plusieurs
   * documents, ou le meme en plusieurs appels : ne regarder que le PREMIER
   * laissait toute ecriture suivante hors radar.
   */
  function payloadsEcriture({ sf, corps }: CibleAnalyse): ts.ObjectLiteralExpression[] {
    const payloads: ts.ObjectLiteralExpression[] = [];
    const visiter = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && APPELS_ECRITURE.has(n.expression.text)) {
        const nomAppel = n.expression.text;
        if (n.arguments.length < 2) {
          throw new Error(
            `${nomAppel}(...) : moins de 2 arguments, aucun payload en 2e position — "${extraitCourt(n.getText(sf))}"`,
          );
        }
        const argument = n.arguments[1];
        if (!ts.isObjectLiteralExpression(argument)) {
          throw new Error(
            `${nomAppel}(...) : le 2e argument n'est pas un objet litteral "{ ... }" ` +
              `(${ts.SyntaxKind[argument.kind]}) — le verrou ne sait pas lire ce payload statiquement : ` +
              `"${extraitCourt(argument.getText(sf))}"`,
          );
        }
        payloads.push(argument);
      }
      ts.forEachChild(n, visiter);
    };
    visiter(corps);
    return payloads;
  }

  /** Nom d'une cle de propriete, ou `null` si elle est CALCULEE (donc illisible ici). */
  function nomDeCle(nom: ts.PropertyName): string | null {
    if (ts.isIdentifier(nom)) return nom.text;
    if (ts.isStringLiteral(nom) || ts.isNoSubstitutionTemplateLiteral(nom)) return nom.text;
    if (ts.isNumericLiteral(nom)) return nom.text;
    return null;
  }

  /** `deleteField()` — une SUPPRESSION de champ, pas un champ du contrat. */
  function estDeleteField(expr: ts.Expression): boolean {
    return (
      ts.isCallExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      expr.expression.text === "deleteField" &&
      expr.arguments.length === 0
    );
  }

  function deparenthese(expr: ts.Expression): ts.Expression {
    let courant = expr;
    while (ts.isParenthesizedExpression(courant)) courant = courant.expression;
    return courant;
  }

  /**
   * G3 — cles portees par un objet litteral. `ecrites` porte une vraie valeur,
   * `supprimees` porte un `deleteField()`.
   *
   * Toute propriete dont le nom ou la forme n'est pas lisible statiquement fait
   * TOMBER l'extraction : rester vert en ayant vu moins de cles que le payload
   * n'en ecrit vraiment est exactement le mode de defaillance que ce verrou
   * doit rendre impossible.
   */
  function clesObjetLitteral(obj: ts.ObjectLiteralExpression, sf: ts.SourceFile): ClesEcriture {
    const ecrites: string[] = [];
    const supprimees: string[] = [];
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const cle = nomDeCle(prop.name);
        if (cle === null) {
          throw new Error(
            `cle non lisible statiquement dans le payload de ${NOM_FONCTION} : ${extraitCourt(prop.getText(sf))} — ` +
              `une cle calculee peut nommer n'importe quel champ`,
          );
        }
        if (estDeleteField(prop.initializer)) supprimees.push(cle);
        else ecrites.push(cle);
        continue;
      }
      if (ts.isShorthandPropertyAssignment(prop)) {
        ecrites.push(prop.name.text);
        continue;
      }
      if (ts.isSpreadAssignment(prop)) {
        const expression = deparenthese(prop.expression);
        if (!ts.isObjectLiteralExpression(expression)) {
          throw new Error(
            `spread non lisible statiquement dans le payload de ${NOM_FONCTION} : ` +
              `${extraitCourt(prop.getText(sf))} — seul un spread d'objet litteral revele ses cles`,
          );
        }
        const trouve = clesObjetLitteral(expression, sf);
        ecrites.push(...trouve.ecrites);
        supprimees.push(...trouve.supprimees);
        continue;
      }
      throw new Error(
        `forme de propriete non reconnue dans le payload de ${NOM_FONCTION} : ${extraitCourt(prop.getText(sf))}`,
      );
    }
    return { ecrites: [...new Set(ecrites)], supprimees: [...new Set(supprimees)] };
  }

  /**
   * Union des cles ECRITES et SUPPRIMEES par toutes les ecritures de
   * `saveClubWeekContext`, lue dans le SOURCE fourni (le vrai fichier, ou une
   * copie mutee en memoire).
   *
   * Fail-closed en quatre temps : G1 (fonction introuvable, ambigue, ou source
   * non parsable), G2 (appel non whitelisté / forme non analysable), G3
   * (payload ou cle non lisible), puis « aucune ecriture trouvee » — une
   * fonction censee ecrire qui n'ecrit visiblement rien n'est pas un verrou qui
   * passe, c'est un verrou qui ne verrouille plus rien.
   */
  function clesEcritesParSaveClubWeekContext(source: string): ClesEcriture {
    const c = cible(source);
    verifierAppelsWhitelistes(c);
    const payloads = payloadsEcriture(c);
    if (payloads.length === 0) {
      throw new Error(`Aucune ecriture setDoc/updateDoc trouvee dans ${NOM_FONCTION}`);
    }
    const ecrites = new Set<string>();
    const supprimees = new Set<string>();
    for (const payload of payloads) {
      const trouve = clesObjetLitteral(payload, c.sf);
      trouve.ecrites.forEach((k) => ecrites.add(k));
      trouve.supprimees.forEach((k) => supprimees.add(k));
    }
    return { ecrites: [...ecrites], supprimees: [...supprimees] };
  }

  /** Texte des payloads d'ecriture — sonde de test, pour montrer CE QUI est lu. */
  function textesPayloads(source: string): string[] {
    const c = cible(source);
    return payloadsEcriture(c).map((p) => p.getText(c.sf));
  }

  /** Noms des appels du corps, dans l'ordre — temoin de test de la liste blanche. */
  function textesAppels(source: string): string[] {
    const noms: string[] = [];
    parcourirAppels(cible(source), (nom) => noms.push(nom));
    return noms;
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

  // ── OUTILLAGE DE MUTATION ────────────────────────────────────────────────
  // Les preuves ci-dessous ne touchent JAMAIS le fichier sur disque : elles
  // mutent une COPIE en memoire du texte source, puis relancent exactement la
  // meme analyse. Les bornes de la fonction sont lues sur l'AST, donc une
  // mutation atterrit toujours DANS `saveClubWeekContext` et nulle part
  // ailleurs.

  /**
   * Applique `muter` au TEXTE de `saveClubWeekContext` et recolle le resultat
   * dans une copie du source. Jette si la mutation est inoperante : une preuve
   * par mutation qui n'a rien mute ne prouve rien (le fichier est en CRLF, un
   * `\n` en dur dans un motif ne matcherait rien).
   */
  function muterFonction(source: string, muter: (texteFonction: string) => string): string {
    const { sf, fn } = cible(source);
    const debut = fn.getStart(sf);
    const fin = fn.getEnd();
    const avant = source.slice(debut, fin);
    const apres = muter(avant);
    if (apres === avant) {
      throw new Error("mutation de test inoperante : le motif cible n'a pas matche dans saveClubWeekContext");
    }
    return source.slice(0, debut) + apres + source.slice(fin);
  }

  /** Fin de l'appel `setDoc` reel — point d'insertion d'une instruction supplementaire. */
  const RE_FIN_APPEL_SETDOC = /\{ merge: true \}\r?\n\s*\);/;

  /** Le payload REEL du `setDoc` (objet litteral, 2e argument), pour le remplacer. */
  const RE_PAYLOAD_SETDOC = /(await setDoc\(\s*ref,\s*)(\{[\s\S]*?\},)(\s*\{ merge: true \})/;

  /** Remplace le PAYLOAD du setDoc reel par autre chose, sur une copie en memoire. */
  function remplacerPayload(source: string, remplacement: string): string {
    return muterFonction(source, (texte) =>
      texte.replace(RE_PAYLOAD_SETDOC, (_m, avant, _payload, apres) => `${avant}${remplacement}${apres}`),
    );
  }

  /** Ajoute une instruction juste apres l'appel `setDoc` reel. */
  function ajouterApresSetDoc(source: string, instruction: string): string {
    return muterFonction(source, (texte) => texte.replace(RE_FIN_APPEL_SETDOC, (m) => `${m}\n  ${instruction}`));
  }

  /** Remplace la ligne `clubId: opts.clubId,` du payload reel par `texteInsere`. */
  function insererDansPayload(source: string, texteInsere: string): string {
    return muterFonction(source, (texte) => texte.replace("clubId: opts.clubId,", () => texteInsere));
  }

  /**
   * Insere du texte JUSTE AVANT la vraie declaration (donc hors de la
   * fonction). Le point d'insertion est lu sur l'AST, pas par `indexOf` sur le
   * nom : sinon un leurre en commentaire — precisement ce que ces mutations
   * fabriquent — capterait l'ancre et l'insertion atterrirait DANS le
   * commentaire.
   */
  function insererAvantLaFonction(source: string, texteInsere: string): string {
    const { sf, fn } = cible(source);
    const debut = fn.getStart(sf);
    return source.slice(0, debut) + texteInsere + source.slice(debut);
  }

  /**
   * Echange les DEUX PREMIERES cles du payload reel, bornes lues sur l'AST.
   * Volontairement independant des noms de champs : un reformatage doit rester
   * vert quel que soit l'ordre dans lequel le fichier se trouve deja.
   */
  function reordonnerDeuxPremieresCles(source: string): string {
    const c = cible(source);
    const payload = payloadsEcriture(c)[0];
    const [p1, p2] = payload.properties;
    if (!p1 || !p2) throw new Error("mutation de test inoperante : moins de 2 cles dans le payload");
    const d1 = p1.getStart(c.sf);
    const d2 = p2.getStart(c.sf);
    return (
      source.slice(0, d1) +
      source.slice(d2, p2.getEnd()) +
      source.slice(p1.getEnd(), d2) +
      source.slice(d1, p1.getEnd()) +
      source.slice(p2.getEnd())
    );
  }

  // ── LE CONTRAT, SUR LE FICHIER REEL ──────────────────────────────────────

  test("G1 : saveClubWeekContext est une VRAIE declaration dans l'AST (sinon le verrou ne verrouille rien)", () => {
    expect(() => cible(CLUBS_REPO_SOURCE)).not.toThrow();
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

  test("mord si le CONTRAT porte une cle que le code n'ecrit jamais (le bug `createdAt` reproduit)", () => {
    // Reproduit l'incident sur une COPIE : le tableau reel exporte par le
    // module n'est jamais modifie.
    const contratAvecFantome = [...WEEK_CONTEXT_CONTRACT_FIELDS, "createdAt"];
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    expect([...ecrites].sort()).not.toEqual([...contratAvecFantome].sort());
  });

  test("temoin positif : chaque champ du contrat est bien ecrit, et rien de plus", () => {
    // Sans ce temoin, un verrou trop strict pourrait rougir sur un simple
    // reformatage du code sans qu'aucune derive reelle n'existe.
    const { ecrites } = clesEcritesParSaveClubWeekContext(CLUBS_REPO_SOURCE);
    for (const champ of WEEK_CONTEXT_CONTRACT_FIELDS) {
      expect(ecrites).toContain(champ);
    }
    expect(ecrites.length).toBe(WEEK_CONTEXT_CONTRACT_FIELDS.length);
  });

  test("G3 temoin : le payload lu est bien le 2e argument, JAMAIS `{ merge: true }`", () => {
    const c = cible(CLUBS_REPO_SOURCE);
    const payloads = payloadsEcriture(c);
    expect(payloads).toHaveLength(1);

    const { ecrites } = clesObjetLitteral(payloads[0], c.sf);
    expect(ecrites).toContain("weekKey");
    expect(ecrites).toContain("trainingIntensity");
    // La sonde : `merge` appartient au 3e argument (les options de setDoc). La
    // verification porte sur les CLES EXTRAITES, pas sur le texte du payload —
    // un commentaire qui contient le mot « merge » n'est pas une derive de
    // contrat, et ne doit pas faire rougir le verrou.
    expect(ecrites).not.toContain("merge");
  });

  test("G2 temoin : le corps reel n'appelle QUE des fonctions de la liste blanche", () => {
    // La liste blanche est figee a la main : ce temoin la rend auditable et
    // oblige a la relire si le code evolue (limite L2).
    expect(textesAppels(CLUBS_REPO_SOURCE)).toEqual(["doc", "setDoc", "deleteField", "serverTimestamp"]);
    for (const callee of textesAppels(CLUBS_REPO_SOURCE)) {
      expect(APPELS_AUTORISES.has(callee)).toBe(true);
    }
  });

  // ── LE VERROU MORD : DERIVE DE CLES ──────────────────────────────────────

  test("mord si le CODE ecrit une cle absente du contrat (ex: futur champFantome)", () => {
    const mute = insererDansPayload(CLUBS_REPO_SOURCE, "clubId: opts.clubId,\n      champFantome: opts.uid,");
    const { ecrites } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champFantome");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("mord si une DEUXIEME ecriture (setDoc) ajoute une cle hors contrat", () => {
    // `saveClubWeekContext` n'a aujourd'hui qu'une seule ecriture : cette
    // mutation simule un futur ou elle en aurait deux.
    const mute = ajouterApresSetDoc(
      CLUBS_REPO_SOURCE,
      "await setDoc(ref, { champFantomeDeuxiemeEcriture: opts.uid });",
    );
    const { ecrites } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champFantomeDeuxiemeEcriture");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("mord si une ecriture updateDoc ajoute une cle hors contrat", () => {
    const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, "await updateDoc(ref, { champFantomeUpdateDoc: opts.uid });");
    const { ecrites } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champFantomeUpdateDoc");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("une cle QUOTEE est LUE et comparee au contrat (l'AST sait la lire, le scan de texte la rejetait)", () => {
    // Progres net sur le scan de texte : `"champ-quote": v` n'est plus une
    // « forme non reconnue » qui faisait rougir le verrou pour la mauvaise
    // raison — c'est une cle, elle est extraite, et elle sort du contrat.
    const mute = insererDansPayload(CLUBS_REPO_SOURCE, 'clubId: opts.clubId,\n      "champ-quote": opts.uid,');
    const { ecrites } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champ-quote");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("une cle SHORTHAND (`champCourt,`) est lue comme une cle ecrite", () => {
    const mute = muterFonction(CLUBS_REPO_SOURCE, (texte) =>
      texte
        .replace("const ref = doc(", () => "const champCourt = opts.uid;\n  const ref = doc(")
        .replace("clubId: opts.clubId,", () => "clubId: opts.clubId,\n      champCourt,"),
    );
    const { ecrites } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champCourt");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
  });

  test("un SPREAD d'objet litteral est deroule : ses cles et ses deleteField() remontent", () => {
    const mute = insererDansPayload(
      CLUBS_REPO_SOURCE,
      "clubId: opts.clubId,\n      ...{ champSpreadLitteral: opts.uid, ancienChamp: deleteField() },",
    );
    const { ecrites, supprimees } = clesEcritesParSaveClubWeekContext(mute);
    expect(ecrites).toContain("champSpreadLitteral");
    expect([...supprimees].sort()).toEqual(["ancienChamp", "note"]);
  });

  // ── LE VERROU MORD : FORMES NON LISIBLES (FAIL-CLOSED) ───────────────────

  test("fail-closed : une cle CALCULEE (`[expr]: v`) fait tomber le test, elle peut nommer n'importe quoi", () => {
    const mute = insererDansPayload(CLUBS_REPO_SOURCE, "clubId: opts.clubId,\n      [opts.uid]: true,");
    expect(messageLeve(() => clesEcritesParSaveClubWeekContext(mute))).toMatch(/cle non lisible statiquement/);
  });

  test("fail-closed : un SPREAD CONDITIONNEL n'est pas litteral, donc refuse (jamais ignore en silence)", () => {
    // `...(opts.uid ? { champSpread: opts.uid } : {})` ajoute un champ tout
    // aussi bien qu'un `cle: valeur`. Le scan de texte tentait de deviner les
    // deux branches ; l'AST refuse net, parce qu'une branche non litterale
    // rendrait l'extraction incomplete sans que personne ne le sache.
    const mute = insererDansPayload(
      CLUBS_REPO_SOURCE,
      "clubId: opts.clubId,\n      ...(opts.uid ? { champSpread: opts.uid } : {}),",
    );
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/spread non lisible statiquement/);
    expect(message).toContain("champSpread");
  });

  test("fail-closed : le payload est un TERNAIRE (aucune des deux branches n'est lue en douce)", () => {
    const mute = remplacerPayload(
      CLUBS_REPO_SOURCE,
      "opts.uid ? { champTernaireA: opts.uid } : { champTernaireB: opts.uid },",
    );
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/le 2e argument n'est pas un objet litteral/);
    expect(message).toContain("champTernaireA"); // le segment fautif est dans le message
  });

  test("fail-closed : le payload est une VARIABLE — et le message nomme la variable, pas `merge`", () => {
    // LE cas qui prouve la correction du bug de conception d'origine : en
    // localisant le payload par « la premiere accolade », ce corps mute donnait
    // `ecrites === ["merge"]` sans rien lever, le verrou comparant le contrat
    // aux OPTIONS de setDoc.
    const mute = muterFonction(CLUBS_REPO_SOURCE, (texte) =>
      texte
        .replace(RE_PAYLOAD_SETDOC, (_m, avant, _payload, apres) => `${avant}payloadCache,${apres}`)
        .replace("await setDoc(", () => "const payloadCache = { champCache: opts.uid };\n  await setDoc("),
    );
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/le 2e argument n'est pas un objet litteral/);
    expect(message).toContain("payloadCache");
    expect(message).not.toContain("merge");
  });

  test("fail-closed : le payload est un `{...} as Record<string, unknown>`", () => {
    const mute = remplacerPayload(CLUBS_REPO_SOURCE, "{ champCaste: opts.uid } as Record<string, unknown>,");
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/le 2e argument n'est pas un objet litteral/);
    expect(message).toContain("champCaste");
  });

  test("fail-closed : un appel d'ecriture sans 2e argument du tout", () => {
    const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, "await updateDoc(ref);");
    expect(messageLeve(() => clesEcritesParSaveClubWeekContext(mute))).toMatch(
      /updateDoc\(\.\.\.\) : moins de 2 arguments/,
    );
  });

  // ── LE VERROU MORD : APPELS (G2) ─────────────────────────────────────────

  test("G2 mord si un HELPER LOCAL est appele (il pourrait ecrire sans qu'on le voie)", () => {
    const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, "await ecrireCadreHelper(ref, opts);");
    // Le payload du vrai setDoc reste parfaitement lisible : sans G2, la suite
    // resterait VERTE alors qu'une ecriture entiere est passee par le helper.
    expect(() => textesPayloads(mute)).not.toThrow();
    expect(messageLeve(() => clesEcritesParSaveClubWeekContext(mute))).toMatch(
      /appel non whitelisté dans saveClubWeekContext : ecrireCadreHelper — un helper ou un alias peut cacher une écriture/,
    );
  });

  test("G2 mord si setDoc est importe sous un ALIAS (`import { setDoc as ecrireDoc }`)", () => {
    const mute = muterFonction(CLUBS_REPO_SOURCE, (texte) => texte.replace("await setDoc(", () => "await ecrireDoc("));
    expect(messageLeve(() => clesEcritesParSaveClubWeekContext(mute))).toMatch(
      /appel non whitelisté dans saveClubWeekContext : ecrireDoc/,
    );
  });

  test("G2 mord sur addDoc / writeBatch / runTransaction (autres API d'ecriture Firestore)", () => {
    for (const [instruction, attendu] of [
      ['await addDoc(collection(db, "clubs"), { champAddDoc: opts.uid });', /addDoc/],
      ["const batch = writeBatch(db);", /writeBatch/],
      ["await runTransaction(db, async (tx) => { tx.set(ref, { x: 1 }); });", /runTransaction/],
    ] as const) {
      const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, instruction);
      const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
      expect(message).toMatch(/appel non whitelisté/);
      expect(message).toMatch(attendu);
    }
  });

  test("G2 mord sur un appel de MEMBRE (`batch.set(...)`, `Object.assign(...)`) : forme non analysable", () => {
    for (const [instruction, attendu] of [
      ["batch.set(ref, { champBatch: opts.uid });", "batch.set"],
      ["Object.assign(ref, { champAssign: opts.uid });", "Object.assign"],
    ] as const) {
      const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, instruction);
      const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
      expect(message).toMatch(/forme d'appel non analysable dans saveClubWeekContext/);
      expect(message).toContain(attendu);
    }
  });

  // ── LES QUATRE PIEGES QUI AVAIENT BATTU LE SCAN DE TEXTE ─────────────────

  test("PIEGE 1 — un LEURRE en commentaire ne deplace plus l'analyse (un commentaire n'est pas un noeud)", () => {
    // La regex localisait la fonction par `indexOf("function saveClubWeekContext(")`
    // : ce commentaire, place AVANT la vraie declaration, lui faisait analyser
    // un faux corps. Pour un parseur il n'existe pas — le verrou reste VERT sur
    // le vrai payload, et c'est le bon verdict.
    const mute = insererAvantLaFonction(
      CLUBS_REPO_SOURCE,
      "// export async function saveClubWeekContext(opts: any) {\n" +
        "//   await setDoc(ref, { champLeurre: opts.uid }, { merge: true });\n" +
        "// }\n",
    );
    expect(mute).not.toBe(CLUBS_REPO_SOURCE);

    const { ecrites, supprimees } = clesEcritesParSaveClubWeekContext(mute);
    expect([...ecrites].sort()).toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
    expect(supprimees).toEqual(["note"]);
    expect(ecrites).not.toContain("champLeurre");
  });

  test("PIEGE 1bis — un VRAI doublon de declaration, lui, fait tomber le test (G1)", () => {
    // Le pendant du leurre : si le nom apparait deux fois pour de vrai, le
    // verrou ne choisit pas au hasard, il refuse.
    const mute = insererAvantLaFonction(
      CLUBS_REPO_SOURCE,
      "export async function saveClubWeekContext(o: { uid: string }): Promise<void> {\n" +
        "  await setDoc(doc(db), { champDoublon: o.uid }, { merge: true });\n" +
        "}\n",
    );
    expect(messageLeve(() => clesEcritesParSaveClubWeekContext(mute))).toMatch(
      /2 declarations de saveClubWeekContext dans l'AST/,
    );
  });

  test("PIEGE 2 — `(0, alias)(...)` : callee parenthese, forme non analysable", () => {
    // L'astuce classique pour appeler une fonction en cassant toute detection
    // par nom. En AST le callee est une `ParenthesizedExpression` : refuse.
    const mute = muterFonction(CLUBS_REPO_SOURCE, (texte) =>
      texte.replace("await setDoc(", () => "await (0, setDoc)("),
    );
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/forme d'appel non analysable dans saveClubWeekContext/);
    expect(message).toContain("(0, setDoc)");
  });

  test('PIEGE 3 — `ns["setDoc"](...)` : callee calcule, forme non analysable', () => {
    const mute = muterFonction(CLUBS_REPO_SOURCE, (texte) =>
      texte.replace("await setDoc(", () => 'await ns["setDoc"]('),
    );
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/forme d'appel non analysable dans saveClubWeekContext/);
    expect(message).toContain('ns["setDoc"]');
  });

  test("PIEGE 4 — un TAGGED TEMPLATE appelle sa fonction sans parenthese : refuse aussi", () => {
    const mute = ajouterApresSetDoc(CLUBS_REPO_SOURCE, "await ecrireCadre`setDoc ${ref}`;");
    const message = messageLeve(() => clesEcritesParSaveClubWeekContext(mute));
    expect(message).toMatch(/forme d'appel non analysable dans saveClubWeekContext/);
    expect(message).toMatch(/tagged template/);
  });

  // ── LES DEUX ANTI-FAUX-POSITIFS ──────────────────────────────────────────
  // Un verrou qui rougit pour la mauvaise raison finit desactive. Ces deux
  // temoins fixent ce qui doit rester VERT.

  test("ANTI-FAUX-POSITIF 1 — des commentaires francais (apostrophes comprises) ne changent RIEN", () => {
    // La derniere passe de regex tombait sur l'apostrophe de « l'ecran » : elle
    // la prenait pour une ouverture de chaine et avalait tout le reste du
    // fichier. Un parseur ne lit meme pas l'interieur d'un commentaire.
    const mute = insererDansPayload(
      CLUBS_REPO_SOURCE,
      "// on n'ecrit plus la note ici : c'est l'ecran coach qui s'en charge,\n" +
        "      // et l'audit d'apres-coup n'en trouve plus rien qu'un joueur puisse lire\n" +
        "      /* rappel : le merge conserve ce qu'on n'ecrit pas — d'ou le deleteField() */\n" +
        "      clubId: opts.clubId, // idem, en fin de ligne, avec l'apostrophe qui va bien",
    );

    const { ecrites, supprimees } = clesEcritesParSaveClubWeekContext(mute);
    expect([...ecrites].sort()).toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
    expect(supprimees).toEqual(["note"]);
    expect(textesAppels(mute)).toEqual(["doc", "setDoc", "deleteField", "serverTimestamp"]);
  });

  test("ANTI-FAUX-POSITIF 2 — reordonner les cles du payload reel ne change RIEN", () => {
    // Le verrou compare des ENSEMBLES de cles : un reformatage n'est pas une
    // derive de contrat, il ne doit pas rougir.
    const mute = reordonnerDeuxPremieresCles(CLUBS_REPO_SOURCE);
    expect(mute).not.toBe(CLUBS_REPO_SOURCE);
    const { ecrites, supprimees } = clesEcritesParSaveClubWeekContext(mute);
    expect([...ecrites].sort()).toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
    expect(supprimees).toEqual(["note"]);
  });
});
