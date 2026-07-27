// functions/src/coachAccessBackfillCli.ts
//
// Branchement Firestore + ligne de commande du script de mise a niveau des
// membership (`coachAccessBackfill.ts`).
//
// ⚠️⚠️ JAMAIS EXECUTE. Aucune base reelle n'a ete lue ni ecrite par ce fichier.
// La procedure d'execution (qui, quand, dans quel ordre, avec quelle
// verification avant/apres) est ecrite dans
// docs/coach-pilote-2026-07/AUTORISATION_ACCES.md.
//
// TROIS GARDE-FOUS, dans cet ordre :
//  1. SIMULATION PAR DEFAUT : sans `--apply`, aucune ecriture n'est meme
//     possible (le magasin d'ecriture est remplace, pas conditionne) ;
//  2. `--apply` seul ne suffit pas : il faut AUSSI `--je-confirme`. Deux mots a
//     taper, c'est le minimum pour une commande qui touche une base ;
//  3. la sortie ne contient AUCUN identifiant, AUCUN prenom, AUCUNE categorie
//     d'age : uniquement des compteurs.

import { type Firestore } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { COACH_ACCESS_FIELD, type CoachAccessState } from "./coachAccess";
import { paths } from "./config";
import {
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
} from "./coachAccessBackfill";

export function createBackfillStore(db: Firestore): CoachAccessBackfillStore {
  return {
    async listPlayerMembers(clubId?: string): Promise<MemberRef[]> {
      if (clubId) {
        const snap = await db.collection(paths.members(clubId)).where("role", "==", "player").get();
        return snap.docs.map((d) => ({ clubId, playerUid: d.id }));
      }
      const clubs = await db.collection(paths.clubs()).get();
      const out: MemberRef[] = [];
      for (const club of clubs.docs) {
        const snap = await db.collection(paths.members(club.id)).where("role", "==", "player").get();
        for (const d of snap.docs) out.push({ clubId: club.id, playerUid: d.id });
      }
      return out;
    },
    async readMember(clubId: string, playerUid: string) {
      const snap = await db.doc(paths.member(clubId, playerUid)).get();
      if (!snap.exists) return null;
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      return { role: data.role, coachAccess: data[COACH_ACCESS_FIELD] };
    },
    async readAgeCategory(playerUid: string) {
      const snap = await db.doc(paths.user(playerUid)).get();
      if (!snap.exists) return undefined;
      return ((snap.data() ?? {}) as Record<string, unknown>).ageCategory;
    },
    async writeCoachAccess(clubId: string, playerUid: string, state: CoachAccessState) {
      await db
        .doc(paths.member(clubId, playerUid))
        .set({ [COACH_ACCESS_FIELD]: state }, { merge: true });
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const demandeApply = argv.includes("--apply");
  const confirme = argv.includes("--je-confirme");
  const clubArg = argv.find((a) => a.startsWith("--clubId="));
  const clubId = clubArg ? clubArg.slice("--clubId=".length) : undefined;

  if (demandeApply && !confirme) {
    console.error(
      "[coachAccessBackfill] REFUS : --apply exige aussi --je-confirme. Rien n'a ete ecrit.",
    );
    process.exitCode = 1;
    return;
  }

  const apply = demandeApply && confirme;
  console.log(
    `[coachAccessBackfill] mode=${apply ? "APPLY" : "SIMULATION"} clubId=${clubId ?? "TOUS"} cible=${
      process.env.FIRESTORE_EMULATOR_HOST ? "emulateur" : "credentials par defaut"
    }`,
  );

  const stats = await runCoachAccessBackfill(createBackfillStore(getDb()), { apply, clubId });
  console.log(`[coachAccessBackfill] termine ${JSON.stringify(stats)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      "[coachAccessBackfill] echec",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  });
}
