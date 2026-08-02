// functions/src/weekContextNoteAuditCli.ts
//
// COMMANDE DE VERIFICATION : reste-t-il, quelque part, une note de coach dans un
// document lisible par les joueurs ?
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle.
//
// ─── POURQUOI UNE COMMANDE SEPAREE, ET PAS UNE ASSERTION DE TEST ────────────
// Un test prouve que le CODE fait ce qu'il dit. Il ne dit rien de l'etat de LA
// BASE apres coup. La question de Kyllian — « est-ce que c'est propre,
// maintenant ? » — se pose apres la migration, un jour ou personne ne relance
// une suite de tests. Elle merite donc une commande a lancer et un resultat a
// lire.
//
// Cette commande N'ECRIT RIEN, par construction : elle n'appelle que la lecture
// du port. Il n'y a pas de `--apply` a se tromper de doigt.
//
// ─── MAIS LA CIBLE RESTE OBLIGATOIRE ────────────────────────────────────────
// Meme en lecture seule : un verdict PROPRE lu sur le mauvais projet est PIRE
// qu'aucun verdict, parce qu'il rassure a tort. `--projet=` est donc exige, et
// verifie contre le projet de l'environnement (cf. migrationCible.ts). En
// revanche, rien a confirmer ni a assumer : on ne confirme pas un regard.
//
// Usage :
//   node lib/weekContextNoteAuditCli.js --projet=<id>
//   node lib/weekContextNoteAuditCli.js --projet=<id> --clubId=<club>
//
// Verdicts (et codes de sortie) :
//   PROPRE    (0) : aucun texte hors contrat, et tout a ete lu.
//   RESIDU    (2) : il reste au moins une note dans un document lisible par un joueur.
//   INCERTAIN (2) : rien trouve, mais au moins un document n'a pas pu etre lu — on
//                   ne prononce pas "propre" sur une lecture incomplete.
//   refus     (1) : cible absente, mal formee ou differente de l'environnement.

import { getDb } from "./admin";
import { analyserCible } from "./migrationCible";
import { auditWeekContextNotes, type NoteMigrationStore } from "./weekContextNoteMigration";
import { createWeekContextNoteStore } from "./weekContextNoteStore";

const ETIQUETTE = "[auditNotes]";

export type AuditCliDeps = {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** N'est appele QU'APRES le feu vert sur la cible. */
  creerStore: () => NoteMigrationStore;
  log: (message: string) => void;
  erreur: (message: string) => void;
};

/** Retourne le CODE DE SORTIE : 0 = propre, 2 = pas propre, 1 = refus/echec. */
export async function executerAuditCli(deps: AuditCliDeps): Promise<number> {
  const decision = analyserCible(deps.argv, deps.env, {
    peutEcrire: false,
    etiquette: ETIQUETTE,
  });

  if (!decision.ok) {
    deps.erreur(decision.message);
    return 1;
  }

  deps.log(
    `${ETIQUETTE} lecture seule projet=${decision.projet} clubId=${decision.clubId ?? "TOUS"} ` +
      `cible=${
        decision.emulateur ? "emulateur" : decision.production ? "PRODUCTION PRESUMEE" : "bac a sable"
      }`,
  );

  const rapport = await auditWeekContextNotes(deps.creerStore(), { clubId: decision.clubId });

  deps.log(`${ETIQUETTE} cadres de semaine lus      : ${rapport.scannes}`);
  deps.log(`${ETIQUETTE} documents avec du texte    : ${rapport.documentsAvecTexte}`);
  deps.log(`${ETIQUETTE} champs concernes           : ${JSON.stringify(rapport.champsDetectes)}`);
  deps.log(
    `${ETIQUETTE} champs hors contrat (non textuels) : ${JSON.stringify(rapport.champsNonTextuels)}`,
  );
  deps.log(`${ETIQUETTE} documents illisibles       : ${rapport.erreurs}`);
  deps.log(`${ETIQUETTE} VERDICT : ${rapport.verdict}`);

  if (rapport.verdict === "RESIDU") {
    deps.log(
      `${ETIQUETTE} Il reste des notes lisibles par les joueurs. Relance la migration : ` +
        `node lib/weekContextNoteMigrationCli.js --projet=${decision.projet} --apply ` +
        `--je-confirme=${decision.projet}` +
        (decision.production ? " --oui-je-vise-la-production" : ""),
    );
  }
  if (rapport.verdict === "INCERTAIN") {
    deps.log(
      `${ETIQUETTE} Lecture incomplete : ne conclus PAS "propre". Relance cette meme ` +
        "verification ; si le compteur d'illisibles ne retombe pas a zero, arrete-toi et dis-le.",
    );
  }

  // Sortie non nulle si ce n'est pas propre : la commande peut etre enchainee
  // dans un script sans qu'on ait a lire la sortie a l'oeil.
  return rapport.verdict === "PROPRE" ? 0 : 2;
}

if (require.main === module) {
  executerAuditCli({
    argv: process.argv.slice(2),
    env: process.env,
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
