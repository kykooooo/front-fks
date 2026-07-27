// functions/src/weekContextNoteMigrationCli.ts
//
// COMMANDE ADMINISTRATEUR : deplacer les anciennes notes de coach hors du
// document lu par les joueurs. Script one-shot, JAMAIS deploye comme Cloud
// Function (il n'est exporte nulle part dans index.ts, et un test le verifie).
//
// ⚠️⚠️ JAMAIS EXECUTE. Aucune base reelle n'a ete lue ni ecrite par ce fichier.
// La procedure complete (avant, pendant, apres, comment lire les compteurs) est
// dans docs/coach-pilote-2026-07/MIGRATION_NOTES.md.
//
// ─── TROIS GARDE-FOUS, dans cet ordre (memes que le backfill et le transfert) ─
//  1. SIMULATION PAR DEFAUT : sans `--apply`, le magasin d'ecriture est REMPLACE
//     par un magasin qui n'ecrit rien — aucune ecriture n'est meme possible ;
//  2. `--apply` seul ne suffit pas : il faut AUSSI `--je-confirme`. Deux mots a
//     taper, c'est le minimum pour une commande qui touche une base ;
//  3. la sortie ne contient AUCUN contenu de note, AUCUN identifiant de club ni
//     de compte : uniquement des compteurs et des NOMS DE CHAMPS.
//
// Usage :
//   node lib/weekContextNoteMigrationCli.js                       (simulation, tout)
//   node lib/weekContextNoteMigrationCli.js --clubId=<id>          (simulation, un club)
//   node lib/weekContextNoteMigrationCli.js --apply --je-confirme  (execution)

import { getDb } from "./admin";
import { runWeekContextNoteMigration } from "./weekContextNoteMigration";
import { createWeekContextNoteStore } from "./weekContextNoteStore";

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const demandeApply = argv.includes("--apply");
  const confirme = argv.includes("--je-confirme");
  const clubId = argValue(argv, "clubId");

  if (demandeApply && !confirme) {
    console.error(
      "[migrationNotes] REFUS : --apply exige aussi --je-confirme. Rien n'a ete ecrit.",
    );
    process.exitCode = 1;
    return;
  }

  const apply = demandeApply && confirme;
  console.log(
    `[migrationNotes] mode=${apply ? "APPLY" : "SIMULATION"} clubId=${clubId ?? "TOUS"} cible=${
      process.env.FIRESTORE_EMULATOR_HOST ? "emulateur" : "credentials par defaut"
    }`,
  );

  const stats = await runWeekContextNoteMigration(createWeekContextNoteStore(getDb()), {
    apply,
    clubId,
  });

  console.log(`[migrationNotes] termine ${JSON.stringify(stats)}`);
  if (!apply) {
    console.log(
      "[migrationNotes] SIMULATION : rien n'a ete ecrit. Relis les compteurs, " +
        "puis relance avec --apply --je-confirme si le resultat te convient.",
    );
  }
  console.log(
    "[migrationNotes] verification finale : node lib/weekContextNoteAuditCli.js" +
      (clubId ? ` --clubId=${clubId}` : ""),
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[migrationNotes] echec", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
