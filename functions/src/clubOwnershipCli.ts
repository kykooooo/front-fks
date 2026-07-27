// functions/src/clubOwnershipCli.ts
//
// OUTIL ADMINISTRATEUR du transfert de propriete. Script one-shot en ligne de
// commande, JAMAIS deploye comme Cloud Function (il n'est exporte nulle part
// dans index.ts, et un test le verifie).
//
// ⚠️⚠️ JAMAIS EXECUTE. Aucune base reelle n'a ete lue ni ecrite par ce fichier.
// La procedure (qui, quand, dans quel ordre, avec quelle verification avant et
// apres) est ecrite dans docs/coach-pilote-2026-07/TRANSFERT_PROPRIETE.md.
//
// ─── POURQUOI UN OUTIL SEPARE PLUTOT QU'UN PARAMETRE DE LA CALLABLE ─────────
// Parce qu'il saute la verification d'autorite de l'appelant. Un tel chemin ne
// doit avoir AUCUNE route reseau : pas de callable, pas de drapeau dans une
// charge utile, pas de mode injectable. Le coeur (`clubOwnership.ts`) rend cela
// structurel — la fonction commune n'est pas exportee, et le mode "admin" n'est
// atteignable que par `adminTransferClubOwnership`, importee ici et nulle part
// ailleurs.
//
// ─── SA RAISON D'ETRE : DEBLOQUER UN CLUB INCOHERENT ────────────────────────
// Quand `ownerUid` designe quelqu'un qui n'a pas (ou plus) l'appartenance
// proprietaire, PERSONNE n'est autorise — pas meme le designe. Le chemin nominal
// ne peut donc, par construction, rien reparer. C'est exactement le cas que cet
// outil existe pour debloquer.
//
// ─── TROIS GARDE-FOUS, dans cet ordre (memes que le backfill) ───────────────
//  1. SIMULATION PAR DEFAUT : sans `--apply`, le magasin d'ecriture est REMPLACE
//     par un magasin qui n'ecrit rien — aucune ecriture n'est meme possible ;
//  2. `--apply` seul ne suffit pas : il faut AUSSI `--je-confirme` ;
//  3. la sortie ne contient que des identifiants et des roles. Aucun nom de
//     club, aucun prenom, aucune donnee de suivi.

import type { Firestore } from "firebase-admin/firestore";

import { getDb } from "./admin";
import { createMemberStore } from "./clubMembersApi";
import { adminTransferClubOwnership } from "./clubOwnership";
import type { MemberStore, MemberTx } from "./clubMembers";

/**
 * Magasin de SIMULATION : il lit la vraie base, et jette toutes les ecritures.
 * La transaction se deroule donc entierement (donc tous les refus metier sont
 * reellement prononces), et rien n'est ecrit. C'est un remplacement, pas une
 * condition posee sur chaque ecriture : on ne peut pas oublier un `if`.
 */
export function createDryRunStore(db: Firestore): MemberStore {
  const real = createMemberStore(db);
  return {
    runTransaction(fn) {
      return real.runTransaction((tx: MemberTx) => {
        const dry: MemberTx = {
          get: (path) => tx.get(path),
          set: (path) => {
            console.log(`[transfertPropriete] (simulation) ecriture ignoree : ${path}`);
          },
          delete: (path) => {
            console.log(`[transfertPropriete] (simulation) suppression ignoree : ${path}`);
          },
        };
        return fn(dry);
      });
    },
  };
}

function argValue(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const clubId = argValue(argv, "clubId");
  const newOwnerUid = argValue(argv, "nouveauProprietaire");
  const demoteUid = argValue(argv, "retrograde");
  const grantCoachSpace = argv.includes("--espace-coach");
  const demandeApply = argv.includes("--apply");
  const confirme = argv.includes("--je-confirme");

  if (!clubId || !newOwnerUid) {
    console.error(
      "[transfertPropriete] usage : --clubId=<id> --nouveauProprietaire=<uid> " +
        "[--retrograde=<uid>] [--espace-coach] [--apply --je-confirme]",
    );
    process.exitCode = 1;
    return;
  }

  if (demandeApply && !confirme) {
    console.error(
      "[transfertPropriete] REFUS : --apply exige aussi --je-confirme. Rien n'a ete ecrit.",
    );
    process.exitCode = 1;
    return;
  }

  const apply = demandeApply && confirme;
  const db = getDb();
  console.log(
    `[transfertPropriete] mode=${apply ? "APPLY" : "SIMULATION"} clubId=${clubId} ` +
      `nouveauProprietaire=${newOwnerUid} retrograde=${demoteUid ?? "aucun"} ` +
      `espaceCoach=${grantCoachSpace ? "OUI" : "non"} cible=${
        process.env.FIRESTORE_EMULATOR_HOST ? "emulateur" : "credentials par defaut"
      }`,
  );

  const result = await adminTransferClubOwnership(
    {
      store: apply ? createMemberStore(db) : createDryRunStore(db),
      now: Date.now,
      // Aucun signalement a brancher : l'outil sert justement a REPARER les
      // incoherences, il n'a pas a en journaliser une de plus a chaque passage.
    },
    { clubId, newOwnerUid, demoteUid, grantCoachSpace },
  );

  console.log(`[transfertPropriete] termine ${JSON.stringify(result)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      "[transfertPropriete] echec",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  });
}
