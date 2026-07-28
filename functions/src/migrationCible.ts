// functions/src/migrationCible.ts
//
// LA CIBLE : sur QUELLE base une commande administrateur a le droit de tourner.
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle. Ce module ne lit ni n'ecrit rien : il
// ne fait que LIRE DES ARGUMENTS et REPONDRE OUI OU NON, bien avant qu'un
// magasin Firestore n'existe.
//
// ─── LE PROBLEME QU'IL REGLE ────────────────────────────────────────────────
// Un script administrateur ne demande pas ou il tourne : il tourne la ou pointent
// les credentials de la machine. Un terminal ouvert la veille sur la production,
// une variable d'environnement oubliee, et une commande tapee "pour voir" tourne
// sur les vraies donnees. Le mode simulation protege des ECRITURES ; il ne dit
// rien de la CIBLE.
//
// D'ou trois exigences, dans cet ordre :
//  1. la cible doit etre NOMMEE (`--projet=`). Sans elle, la commande ne fait
//     rien : on ne devine pas la base sur laquelle on travaille ;
//  2. la cible nommee doit CORRESPONDRE a celle de l'environnement. Si la main
//     dit `demo-fks` et que les credentials disent `fks-apps`, c'est un desaccord,
//     pas un detail : on refuse. C'est le garde-fou qui rattrape le terminal
//     oublie ;
//  3. une cible qui ressemble a de la production exige, EN PLUS, une option
//     explicite pour ecrire. Par defaut, tout ce qui n'est pas manifestement un
//     bac a sable est traite comme la production — on se trompe du bon cote.
//
// Et pour ecrire : une confirmation qui NOMME la cible (`--je-confirme=<projet>`).
// Un `--je-confirme` nu se copie-colle sans reflechir ; un `--je-confirme=fks-apps`
// oblige a relire le nom qu'on est en train de viser.

/** Motifs de refus. Des etiquettes stables : les tests s'appuient dessus. */
export type MotifRefus =
  | "cible-absente"
  | "cible-mal-formee"
  | "environnement-muet"
  | "cible-differente"
  | "confirmation-absente"
  | "confirmation-non-correspondante"
  | "production-non-assumee"
  | "club-mal-forme";

export type DecisionCible =
  | { ok: false; motif: MotifRefus; message: string }
  | {
      ok: true;
      /** Projet vise, verifie identique a celui de l'environnement. */
      projet: string;
      /** true = la commande va ecrire (`--apply` + confirmation nominative). */
      apply: boolean;
      /** Borne facultative a un seul club. */
      clubId?: string;
      /** L'ecriture partirait vers un emulateur local. */
      emulateur: boolean;
      /** La cible est traitee comme de la production (voir `ressembleAProduction`). */
      production: boolean;
    };

/** Identifiant de projet Firebase : 6 a 30 caracteres, minuscules, chiffres, tirets. */
const FORME_PROJET = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

/** Identifiant de club : ce que Firestore accepte comme id de document, sans exotisme. */
const FORME_CLUB = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Prefixes et mots qui designent SANS AMBIGUITE un bac a sable. Tout le reste est
 * presume production. La liste est volontairement courte : plus elle s'allonge,
 * plus elle finit par blanchir une vraie base.
 */
const MARQUEURS_BAC_A_SABLE = /(^|-)(demo|test|tests|staging|preprod|sandbox|local|dev)(-|$)/;

export function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : undefined;
}

/**
 * Le projet vers lequel pointe REELLEMENT l'environnement.
 *
 * C'est la seule verite disponible avant d'ouvrir une connexion : l'Admin SDK
 * resout son projet dans cet ordre-la aussi.
 */
export function projetDeLEnvironnement(env: NodeJS.ProcessEnv): string | undefined {
  const direct = (env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? "").trim();
  if (direct) return direct;
  const brut = (env.FIREBASE_CONFIG ?? "").trim();
  if (!brut) return undefined;
  try {
    const conf = JSON.parse(brut) as { projectId?: unknown };
    return typeof conf.projectId === "string" && conf.projectId.trim()
      ? conf.projectId.trim()
      : undefined;
  } catch {
    // Une configuration illisible n'est pas une cible connue : on ne devine pas.
    return undefined;
  }
}

/**
 * Est-ce que ca ressemble a de la production ?
 *
 * Reponse PAR DEFAUT : oui. Un projet n'echappe a cette presomption que s'il
 * porte un marqueur de bac a sable, ou si les ecritures partent vers un
 * emulateur local (auquel cas la vraie base n'est pas touchee, quel que soit le
 * nom du projet).
 */
export function ressembleAProduction(projet: string, env: NodeJS.ProcessEnv): boolean {
  if ((env.FIRESTORE_EMULATOR_HOST ?? "").trim()) return false;
  return !MARQUEURS_BAC_A_SABLE.test(projet.toLowerCase());
}

export type OptionsAnalyse = {
  /**
   * true : la commande peut ecrire (migration) — `--apply` est lu, la
   * confirmation nominative et l'option production sont exigees.
   * false : commande de lecture seule (audit) — la cible reste obligatoire, mais
   * il n'y a rien a confirmer : on ne confirme pas un regard.
   */
  peutEcrire: boolean;
  /** Prefixe des messages, pour que l'operateur sache qui parle. */
  etiquette: string;
};

/**
 * Repond OUI ou NON, AVANT toute connexion.
 *
 * L'ordre des controles est celui de la reflexion : ou ? est-ce bien la ? ai-je
 * confirme ? est-ce la production ? Chaque refus porte un motif stable et un
 * message qui dit quoi taper ensuite.
 */
export function analyserCible(
  argv: string[],
  env: NodeJS.ProcessEnv,
  opts: OptionsAnalyse,
): DecisionCible {
  const p = opts.etiquette;
  const projet = argValue(argv, "projet");
  const clubId = argValue(argv, "clubId");

  if (!projet) {
    return {
      ok: false,
      motif: "cible-absente",
      message:
        `${p} REFUS : aucune cible. Nomme le projet : --projet=<projectId>. ` +
        "Sans cible, la commande ne fait rien — on ne devine pas la base sur laquelle on travaille.",
    };
  }

  if (!FORME_PROJET.test(projet)) {
    return {
      ok: false,
      motif: "cible-mal-formee",
      message:
        `${p} REFUS : "${projet}" n'est pas un identifiant de projet Firebase ` +
        "(6 a 30 caracteres, minuscules, chiffres et tirets, commence par une lettre). Rien n'a ete lu.",
    };
  }

  if (clubId !== undefined && !FORME_CLUB.test(clubId)) {
    return {
      ok: false,
      motif: "club-mal-forme",
      message: `${p} REFUS : --clubId invalide. Rien n'a ete lu.`,
    };
  }

  const projetEnv = projetDeLEnvironnement(env);
  if (!projetEnv) {
    return {
      ok: false,
      motif: "environnement-muet",
      message:
        `${p} REFUS : l'environnement ne declare aucun projet (GCLOUD_PROJECT / ` +
        "GOOGLE_CLOUD_PROJECT / FIREBASE_CONFIG). Impossible de verifier que --projet " +
        "designe bien la base ou l'on va tourner. Declare-le, puis relance.",
    };
  }

  if (projetEnv !== projet) {
    return {
      ok: false,
      motif: "cible-differente",
      message:
        `${p} REFUS : desaccord de cible. Tu demandes "${projet}", ` +
        `l'environnement pointe sur "${projetEnv}". Rien n'a ete lu ni ecrit.`,
    };
  }

  const emulateur = Boolean((env.FIRESTORE_EMULATOR_HOST ?? "").trim());
  const production = ressembleAProduction(projet, env);

  if (!opts.peutEcrire) {
    return { ok: true, projet, apply: false, clubId, emulateur, production };
  }

  const demandeApply = argv.includes("--apply");
  if (!demandeApply) {
    return { ok: true, projet, apply: false, clubId, emulateur, production };
  }

  const confirmation = argValue(argv, "je-confirme");
  if (confirmation === undefined) {
    return {
      ok: false,
      motif: "confirmation-absente",
      message:
        `${p} REFUS : --apply exige une confirmation qui NOMME la cible : ` +
        `--je-confirme=${projet}. (Un --je-confirme nu ne suffit plus : il se ` +
        "copie-colle sans relire ce qu'on vise.) Rien n'a ete ecrit.",
    };
  }

  if (confirmation !== projet) {
    return {
      ok: false,
      motif: "confirmation-non-correspondante",
      message:
        `${p} REFUS : la confirmation ne correspond pas a la cible ` +
        `(--je-confirme=${confirmation} contre --projet=${projet}). Rien n'a ete ecrit.`,
    };
  }

  if (production && !argv.includes("--oui-je-vise-la-production")) {
    return {
      ok: false,
      motif: "production-non-assumee",
      message:
        `${p} REFUS : "${projet}" est traite comme la PRODUCTION (aucun marqueur ` +
        "demo/test/staging/preprod/sandbox/local/dev, aucun emulateur). Ecrire sur la " +
        "production demande en plus : --oui-je-vise-la-production. Rien n'a ete ecrit.",
    };
  }

  return { ok: true, projet, apply: true, clubId, emulateur, production };
}
