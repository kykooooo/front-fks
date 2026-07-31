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

import { readFileSync } from "fs";
import { join } from "path";
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

// ════════════════════════════════════════════════════════════════════════════
// 11. VERROU — le contrat colle aux cles REELLEMENT ecrites par le front
// ════════════════════════════════════════════════════════════════════════════
//
// WEEK_CONTEXT_CONTRACT_FIELDS est une recopie a la main de ce qu'ecrit
// repositories/clubsRepo.saveClubWeekContext (front). Une recopie a la main
// derive en silence : c'est exactement comme ca que `createdAt` s'est retrouve
// dans le contrat alors que saveClubWeekContext ne l'a JAMAIS ecrit (corrige le
// 2026-07-31). Cette section lit le VRAI source de clubsRepo.ts et prouve que
// les deux listes restent identiques — meme technique que le scan de
// `firestore-tests/rules.userDocument.test.ts` (extraction depuis le source,
// pas depuis une copie qu'on pourrait oublier de mettre a jour).
describe("11. VERROU — WEEK_CONTEXT_CONTRACT_FIELDS == cles ecrites par saveClubWeekContext", () => {
  const CLUBS_REPO_PATH = join(__dirname, "..", "..", "repositories", "clubsRepo.ts");
  const CLUBS_REPO_SOURCE = readFileSync(CLUBS_REPO_PATH, "utf8");

  /**
   * Indice JUSTE APRES l'accolade fermante correspondant a l'accolade ouvrante
   * en position `debut` (qui DOIT etre un "{"). Ignore les accolades trouvees
   * a l'interieur d'une chaine ('...', "...", `...`) pour ne pas se faire
   * piéger par un texte contenant "{" ou "}".
   */
  function finAccoladeEquilibree(texte: string, debut: number): number {
    if (texte[debut] !== "{") throw new Error("Position de depart invalide (attendu '{')");
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
      if (c === "{") profondeur += 1;
      else if (c === "}") {
        profondeur -= 1;
        if (profondeur === 0) return i + 1;
      }
    }
    throw new Error("Accolade fermante introuvable");
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

  /** Objet passe en 2e argument du premier `setDoc(` trouve dans un corps de fonction. */
  function objetPayloadSetDoc(corpsFn: string): string {
    const appel = corpsFn.indexOf("setDoc(");
    if (appel < 0) throw new Error("Aucun appel setDoc trouve dans ce corps de fonction");
    const debutObjet = corpsFn.indexOf("{", appel);
    if (debutObjet < 0) throw new Error("Objet de payload introuvable apres setDoc(");
    const finObjet = finAccoladeEquilibree(corpsFn, debutObjet);
    // Contenu STRICTEMENT entre les accolades (finObjet pointe juste apres le "}").
    return corpsFn.slice(debutObjet + 1, finObjet - 1);
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
   * Cles top-level d'un objet litteral : `ecrites` porte une vraie valeur,
   * `supprimees` porte un `deleteField()` — c'est une SUPPRESSION, pas un champ
   * du contrat (cas de `note` dans saveClubWeekContext).
   */
  function extraireClesObjet(corpsObjet: string): ClesEcriture {
    const ecrites: string[] = [];
    const supprimees: string[] = [];
    for (const segment of segmentsTopLevel(corpsObjet)) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/);
      if (!m) continue; // propriete raccourcie (`{ opts }`) : pas utilisee ici
      const [, cle, valeur] = m;
      if (/^deleteField\(\s*\)$/.test(valeur.trim())) supprimees.push(cle);
      else ecrites.push(cle);
    }
    return { ecrites, supprimees };
  }

  /** Cles reellement ecrites par saveClubWeekContext, lues DANS `source`. */
  function clesEcritesParSaveClubWeekContext(source: string): ClesEcriture {
    const corps = corpsFonction(source, "saveClubWeekContext");
    const payload = objetPayloadSetDoc(corps);
    return extraireClesObjet(payload);
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

    const { ecrites } = extraireClesObjet(objetPayloadSetDoc(corpsMute));
    expect(ecrites).toContain("champFantome");
    expect([...ecrites].sort()).not.toEqual([...WEEK_CONTEXT_CONTRACT_FIELDS].sort());
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
});
