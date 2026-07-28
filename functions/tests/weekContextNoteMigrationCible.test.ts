// functions/tests/weekContextNoteMigrationCible.test.ts
//
// LE TEST NEGATIF : une execution SANS AUTORISATION EXPLICITE n'ecrit RIEN.
//
// ─── POURQUOI PAR COMPTAGE, ET PAS PAR COMPARAISON D'ETAT ───────────────────
// « La base n'a pas change » ne prouve rien : un magasin qui n'ecrit pas et un
// magasin qui ecrit puis annule sont indiscernables apres coup. On INSTRUMENTE
// donc le magasin et on COMPTE les appels d'ecriture. Zero appel, c'est une
// preuve ; « je ne vois pas de difference », c'est une impression.
//
// Le compteur compte aussi les CONSTRUCTIONS de magasin : dans les cas de refus,
// le magasin n'est meme pas fabrique — la commande n'a physiquement pas de quoi
// ecrire. Et un temoin positif (dernier describe) prouve que ce compteur sait
// compter : sans lui, un zero pourrait n'etre qu'un compteur casse.
//
// Aucune base reelle, aucun emulateur, aucun reseau.

import {
  analyserCible,
  projetDeLEnvironnement,
  ressembleAProduction,
} from "../src/migrationCible";
import { executerAuditCli } from "../src/weekContextNoteAuditCli";
import { executerMigrationCli } from "../src/weekContextNoteMigrationCli";
import type {
  NoteMigrationStore,
  NoteMigrationTx,
  WeekContextRef,
} from "../src/weekContextNoteMigration";

const NOTE_SENSIBLE = "Rachid tendinite genou droit, se plaint tout le temps";
const PROJET_BAC_A_SABLE = "demo-fks";
const PROJET_PRODUCTION = "fks-apps";

type Base = Record<string, Record<string, unknown>>;

type Compteurs = {
  /** Combien de fois le magasin a ete CONSTRUIT (donc combien de fois on a ouvert la base). */
  constructions: number;
  lectures: number;
  ecritures: number;
  suppressions: number;
};

/** Un cadre de semaine complet, avec une vieille note a deplacer. */
const cadreAvecNote = (weekKey: string) => ({
  weekKey,
  clubId: "clubA",
  createdBy: "coach1",
  trainingIntensity: "normal",
  weekGoal: "freshness",
  matchThisWeekend: true,
  note: NOTE_SENSIBLE,
});

/**
 * Magasin INSTRUMENTE : il se comporte comme le magasin en memoire des autres
 * tests, mais chaque operation incremente un compteur. C'est l'instrument de
 * mesure du test negatif.
 */
function magasinInstrumente(): { creerStore: () => NoteMigrationStore; compteurs: Compteurs; base: Base } {
  const base: Base = {
    "clubs/clubA/weekContexts/2026-07-20": cadreAvecNote("2026-07-20"),
    "clubs/clubA/weekContexts/2026-07-13": cadreAvecNote("2026-07-13"),
  };
  const refs: WeekContextRef[] = [
    { clubId: "clubA", weekKey: "2026-07-20" },
    { clubId: "clubA", weekKey: "2026-07-13" },
  ];
  const compteurs: Compteurs = { constructions: 0, lectures: 0, ecritures: 0, suppressions: 0 };

  const creerStore = (): NoteMigrationStore => {
    compteurs.constructions += 1;
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
            compteurs.lectures += 1;
            const doc = base[path];
            return doc ? { ...doc } : null;
          },
          merge(path, data) {
            compteurs.ecritures += 1;
            enAttente.push(() => {
              base[path] = { ...(base[path] ?? {}), ...data };
            });
          },
          deleteFields(path, champs) {
            compteurs.suppressions += 1;
            enAttente.push(() => {
              const doc = base[path];
              if (!doc) return;
              for (const c of champs) delete doc[c];
            });
          },
        };
        const res = await fn(tx);
        for (const op of enAttente) op();
        return res;
      },
    };
  };

  return { creerStore, compteurs, base };
}

/** Lance la commande de migration et rend le code de sortie + ce qui a ete compte. */
async function lancer(
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; compteurs: Compteurs; base: Base; sorties: string[]; erreurs: string[] }> {
  const { creerStore, compteurs, base } = magasinInstrumente();
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const code = await executerMigrationCli({
    argv,
    env,
    creerStore,
    log: (m) => sorties.push(m),
    erreur: (m) => erreurs.push(m),
    now: () => "2026-07-27T10:00:00.000Z",
  });
  return { code, compteurs, base, sorties, erreurs };
}

// ────────────────────────────────────────────────────────────────────────────
describe("TEST NEGATIF : sans autorisation explicite, ZERO ecriture", () => {
  // Chaque ligne : un scenario, les arguments, l'environnement, le motif attendu.
  const scenarios: {
    nom: string;
    argv: string[];
    env: NodeJS.ProcessEnv;
    motif: string;
  }[] = [
    {
      nom: "aucune option du tout",
      argv: [],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "--apply tout seul (l'erreur la plus probable)",
      argv: ["--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "--apply --je-confirme mais AUCUNE cible nommee",
      argv: ["--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "un club nomme, mais pas le projet",
      argv: ["--clubId=clubA", "--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "cible mal formee (majuscules, point d'exclamation)",
      argv: ["--projet=Fks-Apps!", "--apply", "--je-confirme=Fks-Apps!"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "identifiant de projet",
    },
    {
      nom: "cible vide (--projet= sans rien)",
      argv: ["--projet=", "--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "club mal forme",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--clubId=club A/../autre"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "--clubId invalide",
    },
    {
      nom: "l'environnement ne declare aucun projet",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      env: {},
      motif: "aucun projet",
    },
    {
      nom: "l'environnement pointe ailleurs que la cible demandee",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "desaccord de cible",
    },
    {
      nom: "confirmation NUE (l'ancienne commande, copiee-collee)",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", "--je-confirme"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "confirmation qui NOMME la cible",
    },
    {
      nom: "confirmation qui nomme un AUTRE projet",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", "--je-confirme=demo-autre"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "ne correspond pas a la cible",
    },
    {
      nom: "production visee sans l'option qui l'assume",
      argv: [`--projet=${PROJET_PRODUCTION}`, "--apply", `--je-confirme=${PROJET_PRODUCTION}`],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "PRODUCTION",
    },
  ];

  it.each(scenarios)("$nom : ZERO ecriture, sortie non nulle", async ({ argv, env, motif }) => {
    const { code, compteurs, base, erreurs } = await lancer(argv, env);

    // 1. Le compte d'ecritures est a ZERO. C'est la preuve demandee.
    expect(compteurs.ecritures).toBe(0);
    expect(compteurs.suppressions).toBe(0);
    // 2. Mieux : le magasin n'a meme pas ete construit. Pas de quoi ecrire.
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.lectures).toBe(0);
    // 3. Code de sortie non nul : un script enchaine s'arrete la.
    expect(code).not.toBe(0);
    // 4. Un refus, et un refus EXPLICABLE.
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain(motif);
    // 5. Et la note est toujours a sa place : rien n'a bouge nulle part.
    expect(base["clubs/clubA/weekContexts/2026-07-20"].note).toBe(NOTE_SENSIBLE);
  });

  it("un refus ne divulgue AUCUN contenu de note (il n'a rien lu, il ne peut rien dire)", async () => {
    const { erreurs } = await lancer(["--apply"], { GCLOUD_PROJECT: PROJET_BAC_A_SABLE });
    expect(erreurs.join(" ")).not.toContain("tendinite");
    expect(erreurs.join(" ")).not.toContain("Rachid");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("SIMULATION : la cible est acceptee, mais toujours ZERO ecriture", () => {
  it("cible correcte, sans --apply : on LIT, on n'ecrit pas", async () => {
    const { code, compteurs, base, sorties } = await lancer([`--projet=${PROJET_BAC_A_SABLE}`], {
      GCLOUD_PROJECT: PROJET_BAC_A_SABLE,
    });

    expect(code).toBe(0);
    expect(compteurs.constructions).toBe(1);
    expect(compteurs.lectures).toBeGreaterThan(0); // il a bien regarde...
    expect(compteurs.ecritures).toBe(0); // ...et n'a rien ecrit
    expect(compteurs.suppressions).toBe(0);
    expect(base["clubs/clubA/weekContexts/2026-07-20"].note).toBe(NOTE_SENSIBLE);

    // Les compteurs disent ce qui SERAIT fait : c'est tout l'interet de l'etape 1.
    const ligne = sorties.find((s) => s.includes("termine")) ?? "";
    expect(ligne).toContain('"migres":2');
    expect(ligne).not.toContain("tendinite");
  });

  it("simulation sur la PRODUCTION : autorisee (elle ne peut rien ecrire), et annoncee comme telle", async () => {
    const { code, compteurs, sorties } = await lancer([`--projet=${PROJET_PRODUCTION}`], {
      GCLOUD_PROJECT: PROJET_PRODUCTION,
    });

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(sorties[0]).toContain("PRODUCTION PRESUMEE");
    // Et elle dit exactement quoi taper ensuite, option production comprise.
    expect(sorties.join(" ")).toContain("--oui-je-vise-la-production");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("TEMOIN POSITIF : le compteur sait compter", () => {
  // Sans ce temoin, tous les zeros ci-dessus pourraient venir d'un compteur mort.
  it("cible + --apply + confirmation nominative : la migration ecrit vraiment", async () => {
    const { code, compteurs, base } = await lancer(
      [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(2);
    expect(compteurs.suppressions).toBe(2);
    expect(base["clubs/clubA/weekContexts/2026-07-20"].note).toBeUndefined();
    expect(base["clubs/clubA/coachNotes/2026-07-20"].note).toBe(NOTE_SENSIBLE);
  });

  it("production ASSUMEE : les trois options ensemble, et seulement ensemble", async () => {
    const { code, compteurs } = await lancer(
      [
        `--projet=${PROJET_PRODUCTION}`,
        "--apply",
        `--je-confirme=${PROJET_PRODUCTION}`,
        "--oui-je-vise-la-production",
      ],
      { GCLOUD_PROJECT: PROJET_PRODUCTION },
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(2);
  });

  it("borner a un club n'ecrit que pour ce club", async () => {
    const { compteurs } = await lancer(
      [
        `--projet=${PROJET_BAC_A_SABLE}`,
        "--clubId=clubB",
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}`,
      ],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );
    // clubB n'existe pas dans la fixture : rien a ecrire, et surtout rien
    // d'ecrit pour clubA.
    expect(compteurs.ecritures).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("la VERIFICATION exige elle aussi une cible", () => {
  async function lancerAudit(argv: string[], env: NodeJS.ProcessEnv) {
    const { creerStore, compteurs } = magasinInstrumente();
    const sorties: string[] = [];
    const erreurs: string[] = [];
    const code = await executerAuditCli({
      argv,
      env,
      creerStore,
      log: (m) => sorties.push(m),
      erreur: (m) => erreurs.push(m),
    });
    return { code, compteurs, sorties, erreurs };
  }

  it("sans --projet : refus, aucune lecture, sortie non nulle", async () => {
    const { code, compteurs, erreurs } = await lancerAudit([], { GCLOUD_PROJECT: PROJET_BAC_A_SABLE });
    expect(code).toBe(1);
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.lectures).toBe(0);
    expect(erreurs[0]).toContain("aucune cible");
  });

  it("cible qui ne correspond pas a l'environnement : refus (un verdict lu sur le mauvais projet rassure a tort)", async () => {
    const { code, erreurs } = await lancerAudit([`--projet=${PROJET_BAC_A_SABLE}`], {
      GCLOUD_PROJECT: PROJET_PRODUCTION,
    });
    expect(code).toBe(1);
    expect(erreurs[0]).toContain("desaccord de cible");
  });

  it("cible correcte : verdict RESIDU (code 2), et zero ecriture", async () => {
    const { code, compteurs, sorties } = await lancerAudit([`--projet=${PROJET_BAC_A_SABLE}`], {
      GCLOUD_PROJECT: PROJET_BAC_A_SABLE,
    });
    expect(code).toBe(2);
    expect(compteurs.ecritures).toBe(0);
    expect(compteurs.suppressions).toBe(0);
    expect(sorties.join(" ")).toContain("VERDICT : RESIDU");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("la regle de cible, dans le detail", () => {
  it("le projet de l'environnement se lit aussi dans FIREBASE_CONFIG", () => {
    expect(projetDeLEnvironnement({ GCLOUD_PROJECT: "demo-a" })).toBe("demo-a");
    expect(projetDeLEnvironnement({ GOOGLE_CLOUD_PROJECT: "demo-b" })).toBe("demo-b");
    expect(projetDeLEnvironnement({ FIREBASE_CONFIG: '{"projectId":"demo-c"}' })).toBe("demo-c");
    expect(projetDeLEnvironnement({ FIREBASE_CONFIG: "{pas du json" })).toBeUndefined();
    expect(projetDeLEnvironnement({})).toBeUndefined();
  });

  it("tout ce qui n'est pas MANIFESTEMENT un bac a sable est traite comme la production", () => {
    expect(ressembleAProduction("fks-apps", {})).toBe(true);
    expect(ressembleAProduction("fks-client-2026", {})).toBe(true);
    expect(ressembleAProduction("demo-fks", {})).toBe(false);
    expect(ressembleAProduction("fks-staging", {})).toBe(false);
    expect(ressembleAProduction("fks-preprod", {})).toBe(false);
    // Emulateur branche : les ecritures ne quittent pas la machine.
    expect(ressembleAProduction("fks-apps", { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toBe(
      false,
    );
  });

  it("les motifs de refus sont stables (la documentation s'appuie dessus)", () => {
    const env = { GCLOUD_PROJECT: PROJET_BAC_A_SABLE };
    const opts = { peutEcrire: true, etiquette: "[t]" };
    const motif = (argv: string[]) => {
      const d = analyserCible(argv, env, opts);
      return d.ok ? "ok" : d.motif;
    };

    expect(motif([])).toBe("cible-absente");
    expect(motif(["--projet=A"])).toBe("cible-mal-formee");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`, "--clubId=a b"])).toBe("club-mal-forme");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`, "--apply"])).toBe("confirmation-absente");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`, "--apply", "--je-confirme=x"])).toBe(
      "confirmation-non-correspondante",
    );
    expect(analyserCible([`--projet=${PROJET_BAC_A_SABLE}`], {}, opts)).toMatchObject({
      motif: "environnement-muet",
    });
    expect(
      analyserCible([`--projet=${PROJET_BAC_A_SABLE}`], { GCLOUD_PROJECT: "autre-projet" }, opts),
    ).toMatchObject({ motif: "cible-differente" });
    expect(
      analyserCible(
        [`--projet=${PROJET_PRODUCTION}`, "--apply", `--je-confirme=${PROJET_PRODUCTION}`],
        { GCLOUD_PROJECT: PROJET_PRODUCTION },
        opts,
      ),
    ).toMatchObject({ motif: "production-non-assumee" });
  });

  it("la commande de lecture seule ne reclame ni confirmation ni option production", () => {
    const d = analyserCible([`--projet=${PROJET_PRODUCTION}`], { GCLOUD_PROJECT: PROJET_PRODUCTION }, {
      peutEcrire: false,
      etiquette: "[t]",
    });
    expect(d).toMatchObject({ ok: true, apply: false, production: true });
  });
});
