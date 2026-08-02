// functions/src/migrationBornes.ts
//
// LES BORNES : jusqu'ou une commande administrateur a le droit d'aller, et
// comment elle reprend si on l'interrompt.
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle. Ce module ne lit ni n'ecrit rien : il
// LIT DES ARGUMENTS et REPOND OUI OU NON, bien avant qu'un magasin Firestore
// n'existe. Meme discipline, meme place dans l'ordre que `migrationCible.ts`.
//
// ─── LE PROBLEME QU'IL REGLE ────────────────────────────────────────────────
// `migrationCible.ts` repond a « SUR QUELLE BASE ? ». Il ne dit rien de
// « COMBIEN ? ». Une commande qui parcourt sans plafond a trois defauts qu'on ne
// voit qu'apres coup :
//
//  1. elle peut tourner beaucoup plus longtemps et beaucoup plus large que ce
//     que l'operateur avait en tete — viser douze membres et en traiter quatre
//     mille, ce n'est pas une commande lente, c'est une commande qui s'est
//     trompee de cible ;
//  2. interrompue au milieu (Ctrl-C, coupure, quota), elle ne sait pas ou elle
//     s'est arretee : on relance tout, ou on ne relance rien ;
//  3. si elle tronque en silence a un nombre arbitraire, elle laisse croire que
//     tout a ete traite. C'est le pire des trois : une troncature muette est un
//     mensonge, pas une protection.
//
// D'ou trois exigences, dans cet ordre :
//
//  1. PLAFOND OBLIGATOIRE (`--limite=<n>`). Pas de valeur par defaut. Une valeur
//     par defaut serait un nombre que personne n'a choisi : l'operateur ne le
//     verrait pas, et croirait avoir tout traite. C'est exactement la doctrine
//     de `--projet` : on ne devine pas, on nomme. Et parce que le plafond doit
//     etre connu AVANT d'ouvrir la base, il doit venir de la ligne de commande —
//     un defaut, lui, se decide dans le code, loin de l'operateur ;
//  2. REPRISE PAR CURSEUR (`--reprendre-apres=<conteneur>/<document>`). Le
//     curseur est un COUPLE D'IDENTIFIANTS DE DOCUMENTS, pas une date ni un
//     compteur : deux documents ne peuvent pas etre a egalite, donc le parcours
//     ne saute rien et ne repete rien. Un curseur pose sur un champ non unique
//     (un horodatage, un statut) perd ou redonne tous les documents a egalite ;
//  3. COMPTEUR ATTENDU (`--attendu=<n>`). L'operateur declare COMBIEN il pense
//     traiter ; l'outil refuse si le reel s'en ecarte, AVANT d'ecrire quoi que
//     ce soit. C'est le garde-fou de perimetre : la simulation produit le
//     chiffre, l'execution le redeclare.
//
// ─── ET LES INCOHERENCES ENTRE OPTIONS ──────────────────────────────────────
// Declarer 500 attendus sous un plafond de 100 n'a aucun sens : les deux options
// se contredisent. Ce genre de contradiction se refuse ICI, a la lecture des
// arguments — pas au centieme document, une fois quatre-vingt-dix-neuf ecritures
// deja faites. Meme chose pour une reprise qui nomme un autre conteneur que la
// borne demandee.
//
// ─── POURQUOI UN MODULE A PART, ET PAS DANS migrationCible.ts ───────────────
// Ce sont deux questions differentes : `migrationCible` repond « OU », celui-ci
// repond « COMBIEN, ET A PARTIR D'OU ». Les melanger donnerait une fonction qui
// refuse pour deux raisons sans rapport. En revanche, meme regle qu'a cote : ces
// bornes sont ECRITES UNE FOIS et destinees a etre relues par les autres
// commandes qui PARCOURENT une base (aujourd'hui la mise a niveau des acces
// coach ; la migration des notes le jour ou elle en aura besoin). Le couple
// (conteneur, document) est volontairement neutre : c'est (club, joueur) pour le
// backfill, ce serait (club, semaine) pour les notes.

/** Motifs de refus. Des etiquettes stables : les tests s'appuient dessus. */
export type MotifRefusBornes =
  | "limite-absente"
  | "limite-mal-formee"
  | "attendu-absent"
  | "attendu-mal-forme"
  | "attendu-superieur-limite"
  | "reprise-mal-formee"
  | "reprise-hors-borne";

export type RefusBornes = { ok: false; motif: MotifRefusBornes; message: string };

/**
 * Point de reprise : un COUPLE d'identifiants de documents, ordonne
 * lexicographiquement. Unique par construction, donc utilisable comme curseur
 * sans risque d'egalite.
 */
export type PointDeReprise = { conteneur: string; document: string };

export type BornesAcceptees = {
  ok: true;
  /** Plafond de documents PARCOURUS par cette execution. Toujours defini. */
  limite: number;
  /** Nombre de documents que l'operateur declare traiter. */
  attendu?: number;
  /** On ne traite que ce qui vient STRICTEMENT APRES ce point. */
  reprise?: PointDeReprise;
};

export type DecisionBornes = RefusBornes | BornesAcceptees;

/** Identifiant de document Firestore, sans exotisme (meme forme que FORME_CLUB). */
const FORME_IDENTIFIANT = /^[A-Za-z0-9_-]{1,128}$/;

export type OptionsBornes = {
  /** Prefixe des messages, pour que l'operateur sache qui parle. */
  etiquette: string;
  /**
   * true : la commande va ECRIRE. Le compteur attendu devient OBLIGATOIRE — on
   * n'ecrit pas sur un perimetre que personne n'a compte.
   * false : simulation. Le compteur reste facultatif, parce que la simulation
   * est precisement ce qui le PRODUIT : l'exiger la serait demander de deviner
   * le nombre qu'on vient chercher.
   */
  apply: boolean;
  /**
   * Conteneur deja accepte par le verrou de cible (`--clubId`). Sert a refuser
   * une reprise qui nommerait un AUTRE conteneur : les deux options diraient
   * alors deux perimetres differents.
   */
  conteneur?: string;
  /** Nom du conteneur dans les messages ("club" par defaut). */
  nomConteneur?: string;
};

export function encoderPointDeReprise(point: PointDeReprise): string {
  return `${point.conteneur}/${point.document}`;
}

/**
 * Lit un curseur `<conteneur>/<document>`. `null` si la forme n'est pas
 * exactement celle-la : un curseur approximatif ferait sauter des documents en
 * silence, ce qui est le defaut qu'on est en train de fermer.
 */
export function analyserPointDeReprise(brut: string): PointDeReprise | null {
  const morceaux = brut.split("/");
  if (morceaux.length !== 2) return null;
  const [conteneur, document] = morceaux;
  if (!FORME_IDENTIFIANT.test(conteneur) || !FORME_IDENTIFIANT.test(document)) return null;
  return { conteneur, document };
}

/** Ordre TOTAL sur les points : conteneur d'abord, document ensuite. */
export function comparerPointsDeReprise(a: PointDeReprise, b: PointDeReprise): number {
  if (a.conteneur !== b.conteneur) return a.conteneur < b.conteneur ? -1 : 1;
  if (a.document !== b.document) return a.document < b.document ? -1 : 1;
  return 0;
}

/**
 * Verifie qu'une page rendue par un magasin est STRICTEMENT CROISSANTE et
 * STRICTEMENT APRES le curseur.
 *
 * Ce n'est pas de la paranoia : tout le contrat de reprise repose sur cet ordre.
 * Un magasin qui rendrait ses documents dans un ordre instable ferait sauter ou
 * repeter des documents a chaque tranche, et RIEN ne le dirait — les compteurs,
 * eux, resteraient plausibles. On prefere un arret bruyant.
 *
 * Retourne `null` si tout va bien, sinon la raison (sans aucun identifiant).
 */
export function verifierOrdreStrict(
  page: readonly PointDeReprise[],
  apres?: PointDeReprise,
): string | null {
  let precedent = apres;
  for (const point of page) {
    if (precedent && comparerPointsDeReprise(precedent, point) >= 0) {
      return precedent === apres
        ? "le premier document rendu n'est pas strictement apres le point de reprise"
        : "les documents ne sont pas rendus dans un ordre strictement croissant";
    }
    precedent = point;
  }
  return null;
}

/** Entier >= min, ecrit en clair. Tout le reste est un refus, pas un arrondi. */
function lireEntier(brut: string, min: number): number | null {
  if (!/^\d+$/.test(brut)) return null;
  const n = Number(brut);
  if (!Number.isSafeInteger(n) || n < min) return null;
  return n;
}

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : undefined;
}

/**
 * Repond OUI ou NON sur les bornes, AVANT toute connexion.
 *
 * L'ordre des controles est celui de la reflexion : jusqu'ou ? combien ? a
 * partir d'ou ? est-ce coherent entre elles ? Chaque refus porte un motif stable
 * et un message qui dit quoi taper ensuite.
 */
export function analyserBornes(argv: string[], opts: OptionsBornes): DecisionBornes {
  const p = opts.etiquette;
  const nomConteneur = opts.nomConteneur ?? "club";

  // 1. LE PLAFOND. Obligatoire, toujours, y compris en simulation : une
  //    simulation sans plafond parcourrait deja toute la base pour compter.
  const limiteBrute = argValue(argv, "limite");
  if (limiteBrute === undefined || limiteBrute === "") {
    return {
      ok: false,
      motif: "limite-absente",
      message:
        `${p} REFUS : aucun plafond. Nomme le nombre MAXIMAL de documents a ` +
        "parcourir : --limite=<n>. Il n'y a pas de valeur par defaut, et c'est " +
        "voulu : un plafond que personne n'a choisi laisse croire qu'on a tout " +
        "traite. Rien n'a ete lu.",
    };
  }
  const limite = lireEntier(limiteBrute, 1);
  if (limite === null) {
    return {
      ok: false,
      motif: "limite-mal-formee",
      message:
        `${p} REFUS : --limite doit etre un entier positif ecrit en chiffres ` +
        `(recu "${limiteBrute}"). Rien n'a ete lu.`,
    };
  }

  // 2. LE COMPTEUR ATTENDU. Obligatoire des qu'on ecrit.
  const attenduBrut = argValue(argv, "attendu");
  let attendu: number | undefined;
  if (attenduBrut === undefined || attenduBrut === "") {
    if (opts.apply) {
      return {
        ok: false,
        motif: "attendu-absent",
        message:
          `${p} REFUS : --apply exige de declarer combien de documents tu ` +
          "t'attends a traiter : --attendu=<n>. Lance d'abord la SIMULATION " +
          "(sans --apply) : elle affiche le chiffre exact a redeclarer ici. " +
          "Rien n'a ete ecrit.",
      };
    }
  } else {
    const lu = lireEntier(attenduBrut, 0);
    if (lu === null) {
      return {
        ok: false,
        motif: "attendu-mal-forme",
        message:
          `${p} REFUS : --attendu doit etre un entier positif ou nul ecrit en ` +
          `chiffres (recu "${attenduBrut}"). Rien n'a ete lu.`,
      };
    }
    attendu = lu;
  }

  // 3. L'INCOHERENCE ENTRE LES DEUX. Elle se voit ici, pas au n-ieme document :
  //    un plafond plus bas que ce qu'on declare traiter, c'est une commande qui
  //    ne peut pas tenir sa propre promesse.
  if (attendu !== undefined && attendu > limite) {
    return {
      ok: false,
      motif: "attendu-superieur-limite",
      message:
        `${p} REFUS : options contradictoires. Tu declares ${attendu} documents ` +
        `attendus sous un plafond de ${limite} : la commande ne pourrait pas les ` +
        "traiter tous, et s'arreterait au plafond. Remonte --limite, ou corrige " +
        "--attendu. Rien n'a ete lu.",
    };
  }

  // 4. LE CURSEUR DE REPRISE.
  const repriseBrute = argValue(argv, "reprendre-apres");
  let reprise: PointDeReprise | undefined;
  if (repriseBrute !== undefined && repriseBrute !== "") {
    const point = analyserPointDeReprise(repriseBrute);
    if (!point) {
      return {
        ok: false,
        motif: "reprise-mal-formee",
        message:
          `${p} REFUS : --reprendre-apres attend exactement ` +
          `<${nomConteneur}>/<document> (recu "${repriseBrute}"). C'est le point ` +
          "affiche par l'execution precedente, a recopier tel quel. Rien n'a ete lu.",
      };
    }
    if (opts.conteneur !== undefined && point.conteneur !== opts.conteneur) {
      return {
        ok: false,
        motif: "reprise-hors-borne",
        message:
          `${p} REFUS : options contradictoires. La reprise nomme le ` +
          `${nomConteneur} "${point.conteneur}" alors que la commande est bornee ` +
          `au ${nomConteneur} "${opts.conteneur}". Les deux options designent deux ` +
          "perimetres differents. Rien n'a ete lu.",
      };
    }
    reprise = point;
  }

  return {
    ok: true,
    limite,
    ...(attendu !== undefined ? { attendu } : {}),
    ...(reprise !== undefined ? { reprise } : {}),
  };
}
