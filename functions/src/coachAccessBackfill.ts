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
//    (`resolveCoachAccess`), donc il ne peut produire que "pending" ou
//    "not_required" ;
//  - il ne produit JAMAIS "approved" : aucune autorisation ne peut naitre d'un
//    script. Approuver reste un geste humain, un joueur a la fois ;
//  - il ne touche JAMAIS un membership qui porte deja "approved" ou "revoked" ;
//  - en mode simulation (defaut), il n'ecrit RIEN et se contente de compter.
//
// Consequence a assumer, et c'est voulu : apres passage, un joueur adulte deja
// rattache devient consultable (not_required), et TOUT joueur dont la categorie
// d'age est inconnue devient NON consultable (pending) — y compris s'il l'etait
// de fait avant, puisqu'avant il n'y avait aucun verrou. C'est le prix du
// default-deny, et c'est la bonne direction pour un pilote qui compte des U15.

import { syncCoachAccessFromProfile, type MemberAccessStore } from "./coachAccessSync";

/** Reference d'un membership joueur a traiter. */
export type MemberRef = { clubId: string; playerUid: string };

/**
 * Port de lecture de l'inventaire. Separe du reste pour que ce module reste
 * testable sans emulateur et sans firebase-admin (le branchement Firestore vit
 * dans coachAccessBackfillCli.ts).
 */
export type CoachAccessBackfillStore = MemberAccessStore & {
  /** Tous les membership role=player, eventuellement bornes a un club. */
  listPlayerMembers(clubId?: string): Promise<MemberRef[]>;
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
};

/**
 * En simulation, on enveloppe le magasin pour NEUTRALISER l'ecriture. Ce n'est
 * pas un `if (apply)` dissemine dans la boucle : le chemin d'ecriture est
 * physiquement absent du mode simulation, donc il ne peut pas etre pris par
 * erreur.
 */
function readOnly(store: CoachAccessBackfillStore): MemberAccessStore {
  return {
    readMember: (clubId, playerUid) => store.readMember(clubId, playerUid),
    readAgeCategory: (playerUid) => store.readAgeCategory(playerUid),
    async writeCoachAccess() {
      /* simulation : aucune ecriture, jamais */
    },
  };
}

export async function runCoachAccessBackfill(
  store: CoachAccessBackfillStore,
  opts: CoachAccessBackfillOptions = {},
): Promise<CoachAccessBackfillStats> {
  const apply = opts.apply === true;
  const cible: MemberAccessStore = apply ? store : readOnly(store);

  const stats: CoachAccessBackfillStats = {
    scanned: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    errors: 0,
    parEtat: {},
  };

  const membres = await store.listPlayerMembers(opts.clubId);
  for (const { clubId, playerUid } of membres) {
    stats.scanned += 1;
    try {
      const res = await syncCoachAccessFromProfile(cible, clubId, playerUid);
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
      // identifiants ou des categories d'age serait exactement ce qu'on protege.
      stats.errors += 1;
    }
  }

  return stats;
}
