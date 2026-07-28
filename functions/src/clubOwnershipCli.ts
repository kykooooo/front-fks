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
// ─── CINQ GARDE-FOUS, dans cet ordre (LE MEME VERROU que la migration) ──────
//  1. CIBLE OBLIGATOIRE, et ici elle vaut DEUX choses : `--projet=<projectId>`
//     ET `--clubId=<id>`. Cet outil n'ecrit pas "quelque part dans une base" :
//     il agit sur UN club. Sa cible est donc le COUPLE — se tromper de club dans
//     la bonne base est exactement l'accident que le nom du projet, seul,
//     n'attrape pas ;
//  2. CIBLE VERIFIEE : le projet nomme doit correspondre a celui de
//     l'environnement. Le terminal ouvert la veille sur un autre projet est
//     rattrape ici (cf. migrationCible.ts) ;
//  3. SIMULATION PAR DEFAUT : sans `--apply`, le magasin d'ecriture est REMPLACE
//     par un magasin qui n'ecrit rien — aucune ecriture n'est meme possible ;
//  4. CONFIRMATION NOMINATIVE : `--apply` exige `--je-confirme=<projet>/<club>`,
//     et une cible qui ressemble a de la production exige EN PLUS
//     `--oui-je-vise-la-production` ;
//  5. la sortie ne contient que des identifiants et des roles. Aucun nom de
//     club, aucun prenom, aucune donnee de suivi.
//
// Le magasin Firestore n'est CONSTRUIT qu'apres un feu vert complet : un refus
// n'a physiquement pas de quoi ecrire. Un test le compte.
//
// Usage :
//   node lib/clubOwnershipCli.js --projet=<id> --clubId=<club> --nouveauProprietaire=<uid>
//   ... puis, pour ecrire :
//     --apply --je-confirme=<id>/<club>
//   ... et sur une cible de production, ajouter --oui-je-vise-la-production

import { getDb } from "./admin";
import { createMemberStore } from "./clubMembersApi";
import { adminTransferClubOwnership } from "./clubOwnership";
import { analyserCible, argValue, libelleCible } from "./migrationCible";
import type { MemberStore, MemberTx } from "./clubMembers";

const ETIQUETTE = "[transfertPropriete]";

/**
 * Magasin de SIMULATION : il lit la vraie base, et jette toutes les ecritures.
 * La transaction se deroule donc entierement (donc tous les refus metier sont
 * reellement prononces), et rien n'est ecrit. C'est un remplacement, pas une
 * condition posee sur chaque ecriture : on ne peut pas oublier un `if`.
 *
 * Il enveloppe un MAGASIN (et non plus un `Firestore`) : c'est ce qui permet de
 * le tester en memoire, et ce qui garde la construction du magasin reel
 * PARESSEUSE — la simulation ne fabrique rien toute seule.
 */
export function createDryRunStore(reel: MemberStore, log: (message: string) => void): MemberStore {
  return {
    runTransaction(fn) {
      return reel.runTransaction((tx: MemberTx) => {
        const dry: MemberTx = {
          get: (path) => tx.get(path),
          set: (path) => {
            log(`${ETIQUETTE} (simulation) ecriture ignoree : ${path}`);
          },
          delete: (path) => {
            log(`${ETIQUETTE} (simulation) suppression ignoree : ${path}`);
          },
        };
        return fn(dry);
      });
    },
  };
}

export type TransfertCliDeps = {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Construit le magasin REEL. N'est appele QU'APRES le feu vert : c'est le test. */
  creerStore: () => MemberStore;
  log: (message: string) => void;
  erreur: (message: string) => void;
  now?: () => number;
};

/**
 * Le corps de la commande, sans `process` ni Firestore : c'est ce qui la rend
 * testable, et donc ce qui rend le test negatif possible (un magasin instrumente
 * compte les ecritures ; l'absence d'ecriture est PROUVEE, pas supposee).
 *
 * Retourne le CODE DE SORTIE : 0 = fait, 1 = refuse ou echec.
 */
export async function executerTransfertCli(deps: TransfertCliDeps): Promise<number> {
  const decision = analyserCible(deps.argv, deps.env, {
    peutEcrire: true,
    etiquette: ETIQUETTE,
    portee: "projet-et-club",
  });

  if (!decision.ok) {
    deps.erreur(decision.message);
    return 1;
  }

  // Le SUJET de l'operation, lu apres la cible : un successeur sans cible n'a
  // aucun sens, et on ne veut surtout pas que l'operateur corrige un oubli de
  // successeur pour decouvrir ensuite qu'il visait la mauvaise base.
  const newOwnerUid = argValue(deps.argv, "nouveauProprietaire");
  if (!newOwnerUid) {
    deps.erreur(
      `${ETIQUETTE} REFUS : aucun successeur nomme. --nouveauProprietaire=<uid> est ` +
        "obligatoire. Rien n'a ete lu.",
    );
    return 1;
  }

  const demoteUid = argValue(deps.argv, "retrograde");
  const grantCoachSpace = deps.argv.includes("--espace-coach");
  const cible = libelleCible(decision.projet, decision.clubId);

  deps.log(
    `${ETIQUETTE} mode=${decision.apply ? "APPLY" : "SIMULATION"} cible=${cible} ` +
      `nouveauProprietaire=${newOwnerUid} retrograde=${demoteUid ?? "aucun"} ` +
      `espaceCoach=${grantCoachSpace ? "OUI" : "non"} base=${
        decision.emulateur
          ? "emulateur"
          : decision.production
            ? "PRODUCTION PRESUMEE"
            : "bac a sable"
      }`,
  );

  // Construction PARESSEUSE, ici et pas plus haut : tous les refus ci-dessus se
  // sont prononces sans qu'aucun objet capable d'ecrire n'ait existe.
  const reel = deps.creerStore();
  const store = decision.apply ? reel : createDryRunStore(reel, deps.log);

  try {
    const result = await adminTransferClubOwnership(
      {
        store,
        now: deps.now ?? Date.now,
        // Aucun signalement a brancher : l'outil sert justement a REPARER les
        // incoherences, il n'a pas a en journaliser une de plus a chaque passage.
      },
      {
        clubId: decision.clubId,
        newOwnerUid,
        ...(demoteUid !== undefined ? { demoteUid } : {}),
        grantCoachSpace,
      },
    );

    deps.log(`${ETIQUETTE} termine ${JSON.stringify(result)}`);
  } catch (err) {
    deps.erreur(`${ETIQUETTE} echec : ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (!decision.apply) {
    deps.log(
      `${ETIQUETTE} SIMULATION : rien n'a ete ecrit. Relis la sortie, puis relance avec ` +
        `--apply --je-confirme=${cible}` +
        (decision.production ? " --oui-je-vise-la-production" : "") +
        " si le resultat te convient.",
    );
  }

  return 0;
}

if (require.main === module) {
  executerTransfertCli({
    argv: process.argv.slice(2),
    env: process.env,
    // Fonction paresseuse : aucun acces Firestore n'existe tant que la cible n'a
    // pas ete acceptee.
    creerStore: () => createMemberStore(getDb()),
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
