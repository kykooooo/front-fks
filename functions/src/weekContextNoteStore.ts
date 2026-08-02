// functions/src/weekContextNoteStore.ts
//
// Branchement Firestore du port `NoteMigrationStore`.
//
// Il vit dans son PROPRE fichier parce que DEUX commandes s'en servent : la
// migration (weekContextNoteMigrationCli.ts) et l'audit
// (weekContextNoteAuditCli.ts). Deux branchements separes auraient pu diverger,
// et l'audit aurait alors verifie autre chose que ce que la migration a traite.
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle.

import { FieldValue, type Firestore } from "firebase-admin/firestore";

import { paths, WEEK_CONTEXTS_COLLECTION } from "./config";
import type {
  NoteMigrationStore,
  NoteMigrationTx,
  WeekContextRef,
} from "./weekContextNoteMigration";

export function createWeekContextNoteStore(db: Firestore): NoteMigrationStore {
  return {
    async listWeekContexts(clubId?: string): Promise<WeekContextRef[]> {
      if (clubId) {
        const snap = await db.collection(paths.weekContexts(clubId)).get();
        return snap.docs.map((d) => ({ clubId, weekKey: d.id }));
      }
      // Requete de GROUPE : tous les cadres de semaine de tous les clubs, sans
      // avoir a enumerer les clubs puis leurs sous-collections. Le clubId est
      // relu depuis le chemin du document (jamais depuis son contenu, qui
      // pourrait mentir).
      const snap = await db.collectionGroup(WEEK_CONTEXTS_COLLECTION).get();
      const out: WeekContextRef[] = [];
      for (const d of snap.docs) {
        const club = d.ref.parent.parent?.id;
        if (club) out.push({ clubId: club, weekKey: d.id });
      }
      return out;
    },

    weekContextPath: (ref) => paths.weekContext(ref.clubId, ref.weekKey),
    coachNotePath: (ref) => paths.coachNote(ref.clubId, ref.weekKey),

    runTransaction<T>(fn: (tx: NoteMigrationTx) => Promise<T>): Promise<T> {
      return db.runTransaction(async (t) => {
        const tx: NoteMigrationTx = {
          async read(path: string) {
            const snap = await t.get(db.doc(path));
            return snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
          },
          merge(path: string, data: Record<string, unknown>) {
            t.set(db.doc(path), data, { merge: true });
          },
          deleteFields(path: string, champs: string[]) {
            if (champs.length === 0) return;
            t.update(
              db.doc(path),
              Object.fromEntries(champs.map((c) => [c, FieldValue.delete()])),
            );
          },
        };
        return fn(tx);
      });
    },
  };
}
