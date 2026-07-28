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
// ─── CINQ GARDE-FOUS, dans cet ordre (LE MEME VERROU que la migration) ──────
//  1. CIBLE OBLIGATOIRE : sans `--projet=<projectId>`, la commande ne fait RIEN.
//     Elle ne se connecte meme pas : on ne devine pas la base sur laquelle on
//     travaille (cf. migrationCible.ts). `--clubId` reste, lui, une BORNE
//     facultative — sans lui la commande parcourt toute la base, ce qui est
//     precisement ce que la procedure ecrite interdit ;
//  2. CIBLE VERIFIEE : le projet nomme doit correspondre a celui de
//     l'environnement. Le terminal ouvert la veille sur un autre projet est
//     rattrape ici ;
//  3. SIMULATION PAR DEFAUT : sans `--apply`, le chemin d'ecriture est
//     physiquement REMPLACE (cf. `readOnly` dans coachAccessBackfill.ts), pas
//     conditionne par un `if` qu'on pourrait oublier ;
//  4. CONFIRMATION NOMINATIVE : `--apply` exige `--je-confirme=<le meme projet>`,
//     et une cible qui ressemble a de la production exige EN PLUS
//     `--oui-je-vise-la-production` ;
//  5. la sortie ne contient AUCUN identifiant, AUCUN prenom : uniquement des
//     compteurs.
//
// Le magasin Firestore n'est CONSTRUIT qu'apres un feu vert complet : un refus
// n'a physiquement pas de quoi ecrire. Un test le compte.
//
// Usage :
//   node lib/coachAccessBackfillCli.js --projet=<id> --clubId=<club>          (simulation)
//   node lib/coachAccessBackfillCli.js --projet=<id> --clubId=<club> --apply --je-confirme=<id>
//   ... et sur une cible de production, ajouter --oui-je-vise-la-production

import { type Firestore } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { PLAYER_STATUS_ACTIVE, PLAYER_STATUS_FIELD } from "./clubAuthority";
import { COACH_ACCESS_FIELD, type CoachAccessState } from "./coachAccess";
import { JOIN_ACCESS_POLICY_FIELD } from "./joinAccessPolicy";
import { analyserCible } from "./migrationCible";
import { paths } from "./config";
import {
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
} from "./coachAccessBackfill";

const ETIQUETTE = "[coachAccessBackfill]";

export function createBackfillStore(db: Firestore): CoachAccessBackfillStore {
  return {
    async listPlayerMembers(clubId?: string): Promise<MemberRef[]> {
      if (clubId) {
        const snap = await db.collection(paths.members(clubId)).where(PLAYER_STATUS_FIELD, "==", PLAYER_STATUS_ACTIVE).get();
        return snap.docs.map((d) => ({ clubId, playerUid: d.id }));
      }
      const clubs = await db.collection(paths.clubs()).get();
      const out: MemberRef[] = [];
      for (const club of clubs.docs) {
        const snap = await db.collection(paths.members(club.id)).where(PLAYER_STATUS_FIELD, "==", PLAYER_STATUS_ACTIVE).get();
        for (const d of snap.docs) out.push({ clubId: club.id, playerUid: d.id });
      }
      return out;
    },
    async readMember(clubId: string, playerUid: string) {
      const snap = await db.doc(paths.member(clubId, playerUid)).get();
      if (!snap.exists) return null;
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      return { playerStatus: data[PLAYER_STATUS_FIELD], coachAccess: data[COACH_ACCESS_FIELD] };
    },
    async readClubPolicy(clubId: string) {
      const snap = await db.doc(paths.club(clubId)).get();
      if (!snap.exists) return undefined;
      return ((snap.data() ?? {}) as Record<string, unknown>)[JOIN_ACCESS_POLICY_FIELD];
    },
    async writeCoachAccess(clubId: string, playerUid: string, state: CoachAccessState) {
      await db
        .doc(paths.member(clubId, playerUid))
        .set({ [COACH_ACCESS_FIELD]: state }, { merge: true });
    },
  };
}

export type BackfillCliDeps = {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Construit le magasin. N'est appele QU'APRES le feu vert : c'est le test. */
  creerStore: () => CoachAccessBackfillStore;
  log: (message: string) => void;
  erreur: (message: string) => void;
};

/**
 * Le corps de la commande, sans `process` ni Firestore : c'est ce qui la rend
 * testable, et donc ce qui rend le test negatif possible (un magasin instrumente
 * compte les ecritures ; l'absence d'ecriture est PROUVEE, pas supposee).
 *
 * Retourne le CODE DE SORTIE : 0 = fait, 1 = refuse ou echec.
 */
export async function executerBackfillCli(deps: BackfillCliDeps): Promise<number> {
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
        decision.emulateur
          ? "emulateur"
          : decision.production
            ? "PRODUCTION PRESUMEE"
            : "bac a sable"
      }`,
  );

  // Construction PARESSEUSE, ici et pas plus haut : tous les refus ci-dessus se
  // sont prononces sans qu'aucun objet capable d'ecrire n'ait existe.
  const stats = await runCoachAccessBackfill(deps.creerStore(), {
    apply: decision.apply,
    ...(decision.clubId !== undefined ? { clubId: decision.clubId } : {}),
  });

  deps.log(`${ETIQUETTE} termine ${JSON.stringify(stats)}`);
  deps.log(
    `${ETIQUETTE} controle de somme : updated+unchanged+missing+errors=${
      stats.updated + stats.unchanged + stats.missing + stats.errors
    } doit valoir scanned=${stats.scanned}`,
  );

  if (!decision.apply) {
    deps.log(
      `${ETIQUETTE} SIMULATION : rien n'a ete ecrit. Relis les compteurs, puis relance avec ` +
        `--apply --je-confirme=${decision.projet}` +
        (decision.production ? " --oui-je-vise-la-production" : "") +
        " si le resultat te convient.",
    );
  }

  // Une execution qui a laisse des echecs derriere elle ne se declare pas reussie.
  return decision.apply && stats.errors > 0 ? 1 : 0;
}

if (require.main === module) {
  executerBackfillCli({
    argv: process.argv.slice(2),
    env: process.env,
    // Fonction paresseuse : aucun acces Firestore n'existe tant que la cible n'a
    // pas ete acceptee.
    creerStore: () => createBackfillStore(getDb()),
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
