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
// ─── LES GARDE-FOUS, dans cet ordre ────────────────────────────────────────
// D'abord OU (le meme verrou que les deux autres outils, migrationCible.ts) :
//  1. CIBLE OBLIGATOIRE : sans `--projet=<projectId>`, la commande ne fait RIEN.
//     Elle ne se connecte meme pas : on ne devine pas la base sur laquelle on
//     travaille. `--clubId` reste, lui, une BORNE facultative — sans lui la
//     commande parcourt toute la base, ce que la procedure ecrite interdit ;
//  2. CIBLE VERIFIEE : le projet nomme doit correspondre a celui de
//     l'environnement. Le terminal ouvert la veille sur un autre projet est
//     rattrape ici ;
//  3. SIMULATION PAR DEFAUT : sans `--apply`, le chemin d'ecriture est
//     physiquement REMPLACE (cf. `readOnly` dans coachAccessBackfill.ts), pas
//     conditionne par un `if` qu'on pourrait oublier ;
//  4. CONFIRMATION NOMINATIVE : `--apply` exige `--je-confirme=<le meme projet>`,
//     et une cible qui ressemble a de la production exige EN PLUS
//     `--oui-je-vise-la-production` ;
//
// Ensuite COMBIEN (migrationBornes.ts) — parce qu'une commande peut viser la
// bonne base et parcourir tout autre chose que ce que l'operateur avait en tete :
//  5. PLAFOND OBLIGATOIRE : `--limite=<n>`, sans valeur par defaut. Depasser le
//     plafond ARRETE proprement et le DIT, code de sortie non nul, avec le point
//     de reprise — jamais une troncature muette ;
//  6. COMPTEUR ATTENDU : `--attendu=<n>`, obligatoire des qu'on ecrit. Si le
//     reel s'en ecarte, refus AVANT la moindre ecriture ;
//  7. REPRISE PAR CURSEUR : `--reprendre-apres=<clubId>/<playerUid>`, le point
//     exact affiche par l'execution precedente ;
//  8. la sortie ne contient AUCUN identifiant, AUCUN prenom : uniquement des
//     compteurs — a une exception assumee, le CURSEUR, qui est un couple
//     d'identifiants techniques et sans lequel la reprise serait impossible.
//
// Le magasin Firestore n'est CONSTRUIT qu'apres un feu vert complet — cible ET
// bornes : un refus n'a physiquement pas de quoi ecrire, ni meme de quoi lire.
// Un test le compte.
//
// Usage :
//   node lib/coachAccessBackfillCli.js --projet=<id> --clubId=<club> --limite=<n>
//   node lib/coachAccessBackfillCli.js --projet=<id> --clubId=<club> --limite=<n> \
//     --attendu=<n> --apply --je-confirme=<id>
//   ... reprise apres interruption : --reprendre-apres=<clubId>/<playerUid>
//   ... et sur une cible de production, ajouter --oui-je-vise-la-production

import { FieldPath, type Firestore, type Query } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { PLAYER_STATUS_ACTIVE, PLAYER_STATUS_FIELD } from "./clubAuthority";
import { COACH_ACCESS_FIELD, type CoachAccessState } from "./coachAccess";
import { JOIN_ACCESS_POLICY_FIELD } from "./joinAccessPolicy";
import { analyserCible } from "./migrationCible";
import { analyserBornes } from "./migrationBornes";
import { paths } from "./config";
import {
  refDepuisPoint,
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
  type ParcoursMembres,
} from "./coachAccessBackfill";

const ETIQUETTE = "[coachAccessBackfill]";

/**
 * Combien de clubs on regarde a la fois quand aucune borne `--clubId` n'est
 * donnee. Le parcours s'arrete des que le plafond de membres est atteint : sans
 * cette pagination, lire l'annuaire complet des clubs pour ne traiter que dix
 * membres serait, lui aussi, un parcours illimite.
 */
const CLUBS_PAR_PAGE = 50;

export function createBackfillStore(db: Firestore): CoachAccessBackfillStore {
  /** Membres actifs d'UN club, ordonnes par identifiant, bornes en nombre. */
  const membresDUnClub = async (
    clubId: string,
    max: number,
    apresUid?: string,
  ): Promise<MemberRef[]> => {
    if (max <= 0) return [];
    // orderBy(documentId) : l'identifiant de document est unique, donc l'ordre
    // est TOTAL. Un tri sur un champ non unique (une date de creation, un
    // statut) laisserait des ex aequo, et `startAfter` sauterait ou repeterait
    // les documents a egalite.
    let q: Query = db
      .collection(paths.members(clubId))
      .where(PLAYER_STATUS_FIELD, "==", PLAYER_STATUS_ACTIVE)
      .orderBy(FieldPath.documentId());
    if (apresUid !== undefined) q = q.startAfter(apresUid);
    const snap = await q.limit(max).get();
    return snap.docs.map((d) => ({ clubId, playerUid: d.id }));
  };

  return {
    async listPlayerMembers({ clubId, apres, max }: ParcoursMembres): Promise<MemberRef[]> {
      if (max <= 0) return [];

      if (clubId) {
        // Borne a un club : une reprise qui nommerait un autre club a deja ete
        // refusee par `analyserBornes`. On la traite quand meme comme une borne
        // vide plutot que de l'ignorer — ignorer une incoherence, c'est en
        // fabriquer une autre.
        if (apres && apres.clubId !== clubId) return [];
        return membresDUnClub(clubId, max, apres?.playerUid);
      }

      const out: MemberRef[] = [];
      let dernierClubVu: string | undefined;
      // `startAt` et non `startAfter` : quand on reprend au milieu d'un club, il
      // faut d'abord FINIR ce club-la avant de passer au suivant.
      let debutClub: string | undefined = apres?.clubId;

      for (;;) {
        let qClubs: Query = db.collection(paths.clubs()).orderBy(FieldPath.documentId());
        if (debutClub !== undefined) qClubs = qClubs.startAt(debutClub);
        else if (dernierClubVu !== undefined) qClubs = qClubs.startAfter(dernierClubVu);
        const clubs = await qClubs.limit(CLUBS_PAR_PAGE).get();
        if (clubs.empty) return out;
        debutClub = undefined;

        for (const club of clubs.docs) {
          if (out.length >= max) return out;
          dernierClubVu = club.id;
          const apresUid = apres && club.id === apres.clubId ? apres.playerUid : undefined;
          out.push(...(await membresDUnClub(club.id, max - out.length, apresUid)));
        }

        // Page de clubs entierement consommee sans atteindre le plafond : on
        // continue. Dans tous les autres cas, on s'arrete ici.
        if (out.length >= max || clubs.size < CLUBS_PAR_PAGE) return out;
      }
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
 * Retourne le CODE DE SORTIE : 0 = fait, 1 = refuse, incomplet ou en echec.
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

  // OU d'abord, COMBIEN ensuite — et les deux AVANT toute connexion.
  const bornes = analyserBornes(deps.argv, {
    etiquette: ETIQUETTE,
    apply: decision.apply,
    ...(decision.clubId !== undefined ? { conteneur: decision.clubId } : {}),
    nomConteneur: "clubId",
  });

  if (!bornes.ok) {
    deps.erreur(bornes.message);
    return 1;
  }

  const repriseLisible = bornes.reprise
    ? `${bornes.reprise.conteneur}/${bornes.reprise.document}`
    : "DEBUT";

  deps.log(
    `${ETIQUETTE} mode=${decision.apply ? "APPLY" : "SIMULATION"} projet=${decision.projet} ` +
      `clubId=${decision.clubId ?? "TOUS"} limite=${bornes.limite} ` +
      `attendu=${bornes.attendu ?? "non declare"} reprise=${repriseLisible} cible=${
        decision.emulateur
          ? "emulateur"
          : decision.production
            ? "PRODUCTION PRESUMEE"
            : "bac a sable"
      }`,
  );

  // Construction PARESSEUSE, ici et pas plus haut : tous les refus ci-dessus se
  // sont prononces sans qu'aucun objet capable de lire ou d'ecrire n'ait existe.
  const resultat = await runCoachAccessBackfill(deps.creerStore(), {
    apply: decision.apply,
    limite: bornes.limite,
    ...(decision.clubId !== undefined ? { clubId: decision.clubId } : {}),
    ...(bornes.attendu !== undefined ? { attendu: bornes.attendu } : {}),
    ...(bornes.reprise !== undefined ? { apres: refDepuisPoint(bornes.reprise) } : {}),
  });

  if (!resultat.ok) {
    deps.erreur(`${ETIQUETTE} REFUS : ${resultat.message}`);
    return 1;
  }

  const { stats, limiteAtteinte, curseur } = resultat;

  deps.log(`${ETIQUETTE} termine ${JSON.stringify(stats)}`);
  deps.log(
    `${ETIQUETTE} controle de somme : updated+unchanged+missing+errors=${
      stats.updated + stats.unchanged + stats.missing + stats.errors
    } doit valoir scanned=${stats.scanned}`,
  );

  // LE PLAFOND A ETE ATTEINT. On le dit avant tout le reste, et fort : c'est le
  // seul cas ou les compteurs ci-dessus ne decrivent PAS tout le perimetre.
  if (limiteAtteinte) {
    const suite =
      `--limite=<n> --reprendre-apres=${curseur}` +
      (decision.clubId ? ` --clubId=${decision.clubId}` : "");
    deps.log(
      `${ETIQUETTE} ARRET SUR PLAFOND : ${stats.scanned} document(s) parcouru(s), et il ` +
        "en RESTE. Rien n'a ete tronque en silence — ce compte-la est INCOMPLET.",
    );
    if (decision.apply) {
      deps.log(
        `${ETIQUETTE} ce qui a ete ecrit avant l'arret : ${stats.updated} membership(s) ` +
          `mis a jour (${stats.unchanged} deja a jour, ${stats.missing} disparu(s), ` +
          `${stats.errors} en echec).`,
      );
    } else {
      deps.log(
        `${ETIQUETTE} NE DECLARE PAS ce chiffre en --attendu : il ne compte que la ` +
          "tranche parcourue, pas le perimetre entier.",
      );
    }
    deps.log(
      `${ETIQUETTE} pour continuer : relance la meme commande en ajoutant ${suite} ` +
        "(et remonte --limite si tu veux tout couvrir d'un coup).",
    );
    if (stats.errors > 0) {
      deps.log(
        `${ETIQUETTE} ATTENTION : ${stats.errors} document(s) en echec dans cette ` +
          "tranche. Ne reprends pas apres le curseur avant d'avoir relance la MEME " +
          "tranche : l'outil est idempotent, un second passage ne refait rien de ce " +
          "qui a deja ete fait.",
      );
    }
    return 1;
  }

  if (!decision.apply) {
    deps.log(
      `${ETIQUETTE} SIMULATION : rien n'a ete ecrit. Le perimetre COMPLET fait ` +
        `${stats.scanned} document(s). Relis les compteurs, puis relance avec ` +
        `--limite=${bornes.limite} --attendu=${stats.scanned} --apply ` +
        `--je-confirme=${decision.projet}` +
        (bornes.reprise ? ` --reprendre-apres=${repriseLisible}` : "") +
        (decision.production ? " --oui-je-vise-la-production" : "") +
        " si le resultat te convient.",
    );
  } else if (stats.errors > 0) {
    deps.log(
      `${ETIQUETTE} ${stats.errors} membership(s) en echec : rien n'a ete ecrit pour ` +
        "ceux-la. Relance la MEME commande — elle les reprendra, les autres seront " +
        "reconnus comme deja a jour.",
    );
  }

  // Une execution qui a laisse des echecs derriere elle ne se declare pas reussie.
  return decision.apply && stats.errors > 0 ? 1 : 0;
}

if (require.main === module) {
  executerBackfillCli({
    argv: process.argv.slice(2),
    env: process.env,
    // Fonction paresseuse : aucun acces Firestore n'existe tant que la cible et
    // les bornes n'ont pas ete acceptees.
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
