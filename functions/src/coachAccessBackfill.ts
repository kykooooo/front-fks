// functions/src/coachAccessBackfill.ts
//
// MISE A NIVEAU DES MEMBERSHIPS EXISTANTS (joueurs deja rattaches avant
// l'existence du champ `coachAccess`).
//
// ⚠️⚠️ CE SCRIPT N'A JAMAIS ETE EXECUTE — ni en production, ni sur une base
// reelle, ni sur un export. Il est ecrit, relu et teste UNIQUEMENT sur des
// donnees inventees (functions/tests/coachAccessBackfill.test.ts). Son
// execution est une decision humaine, decrite pas a pas dans
// docs/coach-pilote-2026-07/AUTORISATION_ACCES.md.
//
// CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS
//  - il POSE le champ manquant sur les membership qui ne l'ont pas ;
//  - il utilise EXACTEMENT la meme decision que le serveur en production
//    (`ensureCoachAccessState`), donc il ne peut produire que "not_required"
//    (politique par defaut) ou "pending" (club en "approval_required") ;
//  - il ne produit JAMAIS "approved" : aucune autorisation ne peut naitre d'un
//    script. Approuver reste un geste humain, un joueur a la fois ;
//  - il ne touche JAMAIS un membership qui porte deja un etat valide, quel
//    qu'il soit — "approved" et "revoked" compris ;
//  - en mode simulation (defaut), il n'ecrit RIEN et se contente de compter.
//
// Consequence a assumer, et c'est voulu : apres passage, les joueurs deja
// rattaches a un club en mode par defaut deviennent consultables
// ("not_required"), sans distinction d'age. C'est la decision produit de
// juillet 2026 (cf. joinAccessPolicy.ts) : sur un club en
// "approval_required", le meme script pose "pending" et n'ouvre rien.
//
// ─── LE PARCOURS EST BORNE (et pourquoi ce n'est pas un detail) ─────────────
// Ce script PARCOURT une base. Un parcours sans plafond a trois defauts qu'on
// ne voit qu'apres coup — perimetre plus large que prevu, reprise impossible
// apres interruption, troncature muette. Le plafond, le curseur de reprise et
// le compteur attendu sont donc OBLIGATOIRES cote ligne de commande
// (`migrationBornes.ts`), et le coeur les fait respecter ici :
//
//  1. il ne demande JAMAIS plus de `limite + 1` references au magasin. Le "+ 1"
//     n'est pas traite : il sert uniquement a savoir s'il RESTE quelque chose ;
//  2. s'il reste quelque chose, il s'ARRETE et le DIT (`limiteAtteinte`), avec
//     le point exact ou reprendre. Il ne tronque jamais en silence ;
//  3. si un compteur attendu est declare et que le reel s'en ecarte, il REFUSE
//     avant la moindre ecriture. Viser douze membres et en trouver quatre
//     mille, ce n'est pas une commande lente : c'est une erreur de perimetre ;
//  4. il verifie que le magasin rend bien ses documents dans un ordre
//     strictement croissant. Tout le contrat de reprise repose la-dessus.
//
// La LOGIQUE METIER, elle, n'a pas bouge d'une ligne : ce qui est ecrit, et
// selon quelle regle, reste `ensureCoachAccessState`.

import { ensureCoachAccessState, type MemberAccessStore } from "./coachAccessSync";
import {
  comparerPointsDeReprise,
  encoderPointDeReprise,
  verifierOrdreStrict,
  type PointDeReprise,
} from "./migrationBornes";

/** Reference d'un membership joueur a traiter. */
export type MemberRef = { clubId: string; playerUid: string };

/**
 * Le couple (club, joueur) vu comme un point de reprise. Deux identifiants de
 * documents : unique par construction, donc utilisable comme curseur sans
 * risque d'egalite.
 */
export function pointDeReprise(ref: MemberRef): PointDeReprise {
  return { conteneur: ref.clubId, document: ref.playerUid };
}

/** L'inverse : un point de reprise redevient une reference de membership. */
export function refDepuisPoint(point: PointDeReprise): MemberRef {
  return { clubId: point.conteneur, playerUid: point.document };
}

/**
 * Ce que le coeur demande au magasin pour UNE tranche de parcours.
 *
 * CONTRAT, et il est strict — la reprise ne vaut rien sans lui :
 *  - les references sont rendues dans l'ordre CROISSANT (clubId, puis
 *    playerUid), qui est un ordre TOTAL sur des identifiants de documents ;
 *  - `apres` exclut son propre point : on rend ce qui vient STRICTEMENT apres ;
 *  - au plus `max` references, jamais une de plus.
 * Le coeur verifie l'ordre a la reception : un magasin qui mentirait ferait
 * echouer bruyamment, au lieu de sauter des documents en silence.
 */
export type ParcoursMembres = {
  /** Borne facultative a un seul club. */
  clubId?: string;
  /** Reprise : ne rend que ce qui vient strictement apres ce point. */
  apres?: MemberRef;
  /** Nombre MAXIMAL de references rendues. Toujours fourni. */
  max: number;
};

/**
 * Port de lecture de l'inventaire. Separe du reste pour que ce module reste
 * testable sans emulateur et sans firebase-admin (le branchement Firestore vit
 * dans coachAccessBackfillCli.ts).
 */
export type CoachAccessBackfillStore = MemberAccessStore & {
  /** Membership playerStatus=active, ORDONNES et BORNES (voir ParcoursMembres). */
  listPlayerMembers(parcours: ParcoursMembres): Promise<MemberRef[]>;
};

export type CoachAccessBackfillStats = {
  scanned: number;
  /** Champ pose ou corrige (en simulation : ce qui SERAIT ecrit). */
  updated: number;
  /** Deja a la bonne valeur : rien a faire. */
  unchanged: number;
  /** Membership disparu entre l'inventaire et le traitement. */
  missing: number;
  /** Erreurs de traitement (jamais de donnee journalisee). */
  errors: number;
  /** Repartition des valeurs CIBLES, pour relire le resultat avant d'appliquer. */
  parEtat: Record<string, number>;
};

export type CoachAccessBackfillOptions = {
  /** false (defaut) = SIMULATION : aucune ecriture. */
  apply?: boolean;
  clubId?: string;
  /**
   * Plafond de documents PARCOURUS. OBLIGATOIRE : le type l'impose, pour qu'un
   * appelant ne puisse pas relancer un parcours illimite par distraction.
   */
  limite: number;
  /**
   * Nombre de documents que l'operateur declare traiter. Si le reel s'en ecarte,
   * la commande REFUSE avant toute ecriture.
   */
  attendu?: number;
  /** On ne traite que ce qui vient STRICTEMENT APRES ce membership. */
  apres?: MemberRef;
};

/** Motifs de refus du parcours. Des etiquettes stables : les tests s'y appuient. */
export type MotifRefusParcours = "limite-invalide" | "inventaire-different" | "ordre-instable";

export type RefusParcours = { ok: false; motif: MotifRefusParcours; message: string };

export type SuccesParcours = {
  ok: true;
  stats: CoachAccessBackfillStats;
  /** true = le plafond a ete atteint et il RESTE des documents non traites. */
  limiteAtteinte: boolean;
  /** Ou reprendre (`clubId/playerUid`), ou null si rien n'a ete parcouru. */
  curseur: string | null;
};

/**
 * Un refus ne porte AUCUN compteur, et c'est delibere : l'absence de statistiques
 * est la preuve qu'aucun document n'a ete traite.
 */
export type ResultatBackfill = RefusParcours | SuccesParcours;

/**
 * En simulation, on enveloppe le magasin pour NEUTRALISER l'ecriture. Ce n'est
 * pas un `if (apply)` dissemine dans la boucle : le chemin d'ecriture est
 * physiquement absent du mode simulation, donc il ne peut pas etre pris par
 * erreur.
 */
function readOnly(store: CoachAccessBackfillStore): MemberAccessStore {
  return {
    readMember: (clubId, playerUid) => store.readMember(clubId, playerUid),
    readClubPolicy: (clubId) => store.readClubPolicy(clubId),
    async writeCoachAccess() {
      /* simulation : aucune ecriture, jamais */
    },
  };
}

export async function runCoachAccessBackfill(
  store: CoachAccessBackfillStore,
  opts: CoachAccessBackfillOptions,
): Promise<ResultatBackfill> {
  const limite = opts.limite;
  // Filet de securite du coeur : la ligne de commande a deja refuse une limite
  // absente ou mal formee, mais ce module est aussi appele par des tests et
  // pourrait l'etre demain par un autre outil. Un refus ICI ne lit rien.
  if (!Number.isSafeInteger(limite) || limite < 1) {
    return {
      ok: false,
      motif: "limite-invalide",
      message:
        "Plafond de parcours absent ou invalide : le backfill ne parcourt jamais " +
        "sans limite. Rien n'a ete lu.",
    };
  }

  const apply = opts.apply === true;
  const cible: MemberAccessStore = apply ? store : readOnly(store);

  // On demande UN DE PLUS que le plafond. Ce document supplementaire n'est
  // jamais traite : il sert uniquement a repondre « est-ce qu'il en reste ? ».
  // Sans lui, on ne saurait pas distinguer « exactement le plafond » de « le
  // plafond, et il en reste trois mille » — c'est-a-dire qu'on tronquerait en
  // silence.
  const page = await store.listPlayerMembers({
    ...(opts.clubId !== undefined ? { clubId: opts.clubId } : {}),
    ...(opts.apres !== undefined ? { apres: opts.apres } : {}),
    max: limite + 1,
  });

  const desordre = verifierOrdreStrict(
    page.map(pointDeReprise),
    opts.apres ? pointDeReprise(opts.apres) : undefined,
  );
  if (desordre) {
    return {
      ok: false,
      motif: "ordre-instable",
      message:
        `Inventaire incoherent : ${desordre}. La reprise par curseur suppose un ` +
        "ordre stable ; sans lui, une tranche sauterait ou repeterait des " +
        "documents sans que rien ne le dise. Rien n'a ete ecrit.",
    };
  }

  const limiteAtteinte = page.length > limite;
  const aTraiter = limiteAtteinte ? page.slice(0, limite) : page;

  // Le compteur attendu se compare AVANT la boucle : refuser au centieme
  // document, alors que quatre-vingt-dix-neuf ecritures sont deja faites, ne
  // serait pas un garde-fou.
  if (opts.attendu !== undefined && aTraiter.length !== opts.attendu) {
    const reel = limiteAtteinte
      ? `${aTraiter.length} (plafond atteint : il y en a strictement plus)`
      : `${aTraiter.length}`;
    return {
      ok: false,
      motif: "inventaire-different",
      message:
        `Perimetre different de ce qui a ete declare : ${opts.attendu} attendu(s), ` +
        `${reel} trouve(s). Ce n'est pas un detail de comptage : c'est le signe que ` +
        "la commande ne vise pas ce que tu crois. Relance la SIMULATION pour lire " +
        "le chiffre reel. Rien n'a ete ecrit.",
    };
  }

  const stats: CoachAccessBackfillStats = {
    scanned: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    errors: 0,
    parEtat: {},
  };

  let curseur: string | null = null;
  for (const ref of aTraiter) {
    const { clubId, playerUid } = ref;
    stats.scanned += 1;
    // Le curseur suit le PARCOURS, pas le succes : il avance meme sur un
    // document en echec. Sinon une reprise repasserait indefiniment sur le
    // meme document bloquant. Reprendre ne rejoue donc pas les echecs : pour
    // ceux-la, on relance la MEME tranche (l'outil est idempotent).
    curseur = encoderPointDeReprise(pointDeReprise(ref));
    try {
      const res = await ensureCoachAccessState(cible, clubId, playerUid);
      if (res.action === "updated") {
        stats.updated += 1;
        stats.parEtat[res.to] = (stats.parEtat[res.to] ?? 0) + 1;
      } else if (res.action === "unchanged") {
        stats.unchanged += 1;
        stats.parEtat[res.state] = (stats.parEtat[res.state] ?? 0) + 1;
      } else {
        // no-member (disparu) / not-player (inventaire desynchronise)
        stats.missing += 1;
      }
    } catch {
      // AUCUNE donnee journalisee : un journal de migration qui contiendrait des
      // identifiants de joueurs serait exactement ce qu'on protege.
      stats.errors += 1;
    }
  }

  return { ok: true, stats, limiteAtteinte, curseur };
}

/**
 * L'ORDRE DU PARCOURS, expose sous forme de fonction.
 *
 * C'est la definition qu'un magasin doit respecter (contrat de
 * `ParcoursMembres`). L'exporter evite que chaque implementation de magasin
 * reecrive « clubId puis playerUid » a sa facon — c'est exactement le genre de
 * detail qu'on recopie de travers, et un ordre recopie de travers fait sauter
 * des documents en silence.
 */
export function comparerMemberRefs(a: MemberRef, b: MemberRef): number {
  return comparerPointsDeReprise(pointDeReprise(a), pointDeReprise(b));
}
