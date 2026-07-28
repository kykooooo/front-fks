// functions/src/weekContextNoteMigrationCli.ts
//
// COMMANDE ADMINISTRATEUR : deplacer les anciennes notes de coach hors du
// document lu par les joueurs. Script one-shot, JAMAIS deploye comme Cloud
// Function (il n'est exporte nulle part dans index.ts, et un test le verifie).
//
// ⚠️⚠️ JAMAIS EXECUTE. Aucune base reelle n'a ete lue ni ecrite par ce fichier.
// La procedure complete en 8 etapes (avant, pendant, apres, comment lire les
// compteurs, comment reprendre, comment revenir en arriere) est dans
// docs/coach-pilote-2026-07/MIGRATION_NOTES.md.
//
// ─── CINQ GARDE-FOUS, dans cet ordre ────────────────────────────────────────
//  1. CIBLE OBLIGATOIRE : sans `--projet=<projectId>`, la commande ne fait RIEN.
//     Elle ne se connecte meme pas : on ne devine pas la base sur laquelle on
//     travaille (cf. migrationCible.ts) ;
//  2. CIBLE VERIFIEE : la cible nommee doit correspondre au projet de
//     l'environnement. Le terminal ouvert la veille sur un autre projet est
//     rattrape ici ;
//  3. SIMULATION PAR DEFAUT : sans `--apply`, le magasin d'ecriture est REMPLACE
//     par un magasin qui n'ecrit rien — aucune ecriture n'est meme possible ;
//  4. CONFIRMATION NOMINATIVE : `--apply` exige `--je-confirme=<le meme projet>`,
//     et une cible qui ressemble a de la production exige EN PLUS
//     `--oui-je-vise-la-production` ;
//  5. la sortie ne contient AUCUN contenu de note, AUCUN identifiant de compte :
//     uniquement des compteurs et des NOMS DE CHAMPS.
//
// Le magasin Firestore n'est CONSTRUIT qu'apres un feu vert complet : un refus
// ne peut pas ecrire, faute d'avoir de quoi ecrire. Un test le compte.
//
// Usage :
//   node lib/weekContextNoteMigrationCli.js --projet=<id>                       (simulation, tout)
//   node lib/weekContextNoteMigrationCli.js --projet=<id> --clubId=<club>        (simulation, un club)
//   node lib/weekContextNoteMigrationCli.js --projet=<id> --apply --je-confirme=<id>
//   ... et sur une cible de production, ajouter --oui-je-vise-la-production

import { getDb } from "./admin";
import { analyserCible } from "./migrationCible";
import { runWeekContextNoteMigration, type NoteMigrationStore } from "./weekContextNoteMigration";
import { createWeekContextNoteStore } from "./weekContextNoteStore";

const ETIQUETTE = "[migrationNotes]";

export type MigrationCliDeps = {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Construit le magasin. N'est appele QU'APRES le feu vert : c'est le test. */
  creerStore: () => NoteMigrationStore;
  log: (message: string) => void;
  erreur: (message: string) => void;
  now?: () => string;
};

/**
 * Le corps de la commande, sans `process` ni Firestore : c'est ce qui la rend
 * testable, et donc ce qui rend le test negatif possible (un magasin instrumente
 * compte les ecritures ; l'absence d'ecriture est PROUVEE, pas supposee).
 *
 * Retourne le CODE DE SORTIE : 0 = fait, 1 = refuse ou echec.
 */
export async function executerMigrationCli(deps: MigrationCliDeps): Promise<number> {
  const decision = analyserCible(deps.argv, deps.env, {
    peutEcrire: true,
    etiquette: ETIQUETTE,
  });

  if (!decision.ok) {
    deps.erreur(decision.message);
    return 1;
  }

  deps.log(
    `${ETIQUETTE} mode=${decision.apply ? "APPLY" : "SIMULATION"} projet=${decision.projet} ` +
      `clubId=${decision.clubId ?? "TOUS"} cible=${
        decision.emulateur ? "emulateur" : decision.production ? "PRODUCTION PRESUMEE" : "bac a sable"
      }`,
  );

  const stats = await runWeekContextNoteMigration(deps.creerStore(), {
    apply: decision.apply,
    clubId: decision.clubId,
    ...(deps.now ? { now: deps.now } : {}),
  });

  deps.log(`${ETIQUETTE} termine ${JSON.stringify(stats)}`);
  deps.log(
    `${ETIQUETTE} controle de somme : migres+dejaMigres+sansNote+disparus+erreurs=${
      stats.migres + stats.dejaMigres + stats.sansNote + stats.disparus + stats.erreurs
    } doit valoir scannes=${stats.scannes}`,
  );

  if (!decision.apply) {
    deps.log(
      `${ETIQUETTE} SIMULATION : rien n'a ete ecrit. Relis les compteurs, puis relance avec ` +
        `--apply --je-confirme=${decision.projet}` +
        (decision.production ? " --oui-je-vise-la-production" : "") +
        " si le resultat te convient.",
    );
  } else if (stats.erreurs > 0) {
    deps.log(
      `${ETIQUETTE} ${stats.erreurs} semaine(s) en echec : RIEN n'a ete ecrit pour ` +
        "celles-la (copie et suppression sont dans la meme transaction). Relance la " +
        "meme commande : elle les reprendra, les autres seront reconnues comme deja passees.",
    );
  }

  deps.log(
    `${ETIQUETTE} verification finale : node lib/weekContextNoteAuditCli.js --projet=${decision.projet}` +
      (decision.clubId ? ` --clubId=${decision.clubId}` : ""),
  );

  // Une execution qui a laisse des echecs derriere elle ne se declare pas reussie.
  return decision.apply && stats.erreurs > 0 ? 1 : 0;
}

if (require.main === module) {
  executerMigrationCli({
    argv: process.argv.slice(2),
    env: process.env,
    // Fonction paresseuse : aucun acces Firestore n'existe tant que la cible n'a
    // pas ete acceptee.
    creerStore: () => createWeekContextNoteStore(getDb()),
    log: (m) => console.log(m),
    erreur: (m) => console.error(m),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`${ETIQUETTE} echec`, err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
