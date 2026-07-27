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
// Usage :
//   node lib/weekContextNoteAuditCli.js
//   node lib/weekContextNoteAuditCli.js --clubId=<id>
//
// Verdicts :
//   PROPRE    : aucun texte hors contrat, et tout a ete lu.
//   RESIDU    : il reste au moins une note dans un document lisible par un joueur.
//   INCERTAIN : rien trouve, mais au moins un document n'a pas pu etre lu — on
//               ne prononce pas "propre" sur une lecture incomplete.

import { getDb } from "./admin";
import { auditWeekContextNotes } from "./weekContextNoteMigration";
import { createWeekContextNoteStore } from "./weekContextNoteStore";

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const clubId = argValue(argv, "clubId");

  console.log(
    `[auditNotes] lecture seule clubId=${clubId ?? "TOUS"} cible=${
      process.env.FIRESTORE_EMULATOR_HOST ? "emulateur" : "credentials par defaut"
    }`,
  );

  const rapport = await auditWeekContextNotes(createWeekContextNoteStore(getDb()), { clubId });

  console.log(`[auditNotes] cadres de semaine lus      : ${rapport.scannes}`);
  console.log(`[auditNotes] documents avec du texte    : ${rapport.documentsAvecTexte}`);
  console.log(`[auditNotes] champs concernes           : ${JSON.stringify(rapport.champsDetectes)}`);
  console.log(`[auditNotes] champs hors contrat (non textuels) : ${JSON.stringify(rapport.champsNonTextuels)}`);
  console.log(`[auditNotes] documents illisibles       : ${rapport.erreurs}`);
  console.log(`[auditNotes] VERDICT : ${rapport.verdict}`);

  if (rapport.verdict === "RESIDU") {
    console.log(
      "[auditNotes] Il reste des notes lisibles par les joueurs. " +
        "Relance la migration : node lib/weekContextNoteMigrationCli.js --apply --je-confirme",
    );
  }
  // Sortie non nulle si ce n'est pas propre : la commande peut etre enchainee
  // dans un script sans qu'on ait a lire la sortie a l'oeil.
  if (rapport.verdict !== "PROPRE") process.exitCode = 2;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[auditNotes] echec", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
