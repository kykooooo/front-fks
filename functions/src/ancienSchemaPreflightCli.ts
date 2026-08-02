// functions/src/ancienSchemaPreflightCli.ts
//
// COMMANDE DE PREFLIGHT : a lancer AVANT de deployer les Cloud Functions et les
// regles Firestore. Elle repond a une seule question — « reste-t-il des
// appartenances ecrites avec l'ANCIEN schema (`role`) ? » — et elle repond par
// un CODE DE SORTIE, pour qu'un enchainement de deploiement puisse s'arreter
// dessus sans lire la sortie a l'oeil.
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle. La procedure d'execution (ou elle
// s'insere, ce qu'on lit, ce qui doit faire arreter) est ecrite dans
// docs/coach-pilote-2026-07/INTEGRATION_BOUCLE.md §5.
//
// ─── LES GARDE-FOUS, dans cet ordre ────────────────────────────────────────
// D'abord OU (migrationCible.ts, le meme verrou que les autres outils) :
//  1. CIBLE OBLIGATOIRE : sans `--projet=<projectId>`, la commande ne fait RIEN
//     et n'ouvre meme pas la base. Un verdict PROPRE lu sur le mauvais projet
//     est PIRE qu'aucun verdict : il autorise un deploiement a tort ;
//  2. CIBLE VERIFIEE : le projet nomme doit correspondre a celui de
//     l'environnement. Le terminal ouvert la veille sur un autre projet est
//     rattrape ici ;
//  3. RIEN A CONFIRMER, ET C'EST VOULU : cette commande est en LECTURE SEULE.
//     Le port qu'elle consomme (`PreflightStore`) n'a AUCUNE methode
//     d'ecriture — ce n'est pas un `if` qu'on pourrait oublier, c'est une
//     absence de type. Il n'y a donc ni `--apply`, ni `--je-confirme=`, ni
//     `--oui-je-vise-la-production` : on ne confirme pas un regard.
//
// Ensuite COMBIEN (migrationBornes.ts) :
//  4. PLAFOND OBLIGATOIRE : `--limite=<n>`, sans valeur par defaut ;
//  5. REPRISE PAR CURSEUR : `--reprendre-apres=<clubId>/<uid>` ;
//  6. `--attendu=` est REFUSE : ce compteur sert a redeclarer un perimetre avant
//     d'ECRIRE. Ici il n'y a rien a ecrire, et c'est precisement cette commande
//     qui PRODUIT le chiffre. L'accepter sans le faire respecter serait un
//     mensonge poli ;
//  7. la sortie ne contient AUCUN identifiant, AUCUN nom, AUCUN contenu de
//     document : uniquement des compteurs et des valeurs de schema — a une
//     exception assumee, le CURSEUR, affiche uniquement quand le plafond a ete
//     atteint, sans lequel la reprise serait impossible.
//
// ─── CE QU'IL FAUT FAIRE DU VERDICT ─────────────────────────────────────────
// PROPRE (0)    : l'hypothese « aucune appartenance a l'ancien schema » est
//                 VERIFIEE a l'instant. Le deploiement peut continuer.
// RESIDU (2)    : NE PAS DEPLOYER. Il existe des documents que le nouveau code
//                 lira comme « aucune permission, aucun suivi ». Une migration
//                 est necessaire — et elle N'EXISTE PAS : elle reste a ecrire.
// INCERTAIN (3) : NE PAS DEPLOYER. Rien trouve, mais tout n'a pas ete lu.
//                 « Rien trouve » n'est pas « rien a trouver ».
// refus (1)     : cible absente / differente, bornes absentes ou incoherentes,
//                 ou echec technique. Rien n'a ete conclu.
//
// Usage :
//   node lib/ancienSchemaPreflightCli.js --projet=<id> --limite=<n>
//   node lib/ancienSchemaPreflightCli.js --projet=<id> --clubId=<club> --limite=<n>
//   ... reprise apres un arret sur plafond : --reprendre-apres=<clubId>/<uid>

import { FieldPath, type Firestore, type Query } from "firebase-admin/firestore";
import { getDb } from "./admin";
import { paths } from "./config";
import { analyserCible } from "./migrationCible";
import { analyserBornes } from "./migrationBornes";
import {
  refDepuisPoint,
  runAncienSchemaPreflight,
  type AppartenanceLue,
  type ParcoursAppartenances,
  type PreflightStore,
} from "./ancienSchemaPreflight";

const ETIQUETTE = "[preflightAncienSchema]";

/** Codes de sortie, nommes une fois : un enchainement de deploiement les lit. */
export const CODE_PROPRE = 0;
export const CODE_REFUS = 1;
export const CODE_RESIDU = 2;
export const CODE_INCERTAIN = 3;

/** Clubs regardes a la fois quand aucune borne `--clubId` n'est donnee. */
const CLUBS_PAR_PAGE = 50;

/**
 * Magasin Firestore, en LECTURE SEULE.
 *
 * ─── POURQUOI CE PARCOURS N'EST PAS CELUI DU BACKFILL ───────────────────────
 * Celui de `coachAccessBackfillCli.ts` filtre sur `playerStatus == "active"`.
 * Ce filtre porte sur un champ du NOUVEAU modele : une appartenance a l'ancien
 * schema ne le porte pas, donc elle serait INVISIBLE — c'est-a-dire que le
 * preflight prononcerait PROPRE precisement sur les documents qu'il cherche.
 * Ici, aucun filtre : on lit TOUTES les appartenances, quel que soit leur etat.
 * C'est la difference qui justifie un parcours a part plutot qu'un parametre de
 * plus sur le premier.
 */
export function createPreflightStore(db: Firestore): PreflightStore {
  /** Appartenances d'UN club, ordonnees par identifiant, bornees en nombre. */
  const membresDUnClub = async (
    clubId: string,
    max: number,
    apresUid?: string,
  ): Promise<AppartenanceLue[]> => {
    if (max <= 0) return [];
    // orderBy(documentId) : l'identifiant de document est unique, donc l'ordre
    // est TOTAL. Un tri sur un champ non unique laisserait des ex aequo, et
    // `startAfter` sauterait ou repeterait les documents a egalite.
    let q: Query = db.collection(paths.members(clubId)).orderBy(FieldPath.documentId());
    if (apresUid !== undefined) q = q.startAfter(apresUid);
    const snap = await q.limit(max).get();
    return snap.docs.map((d) => {
      const donnees = d.data();
      return {
        clubId,
        uid: d.id,
        donnees: donnees && typeof donnees === "object" ? (donnees as Record<string, unknown>) : null,
      };
    });
  };

  return {
    async listAppartenances({ clubId, apres, max }: ParcoursAppartenances) {
      if (max <= 0) return [];

      if (clubId) {
        // Une reprise nommant un autre club a deja ete refusee par
        // `analyserBornes`. On la traite quand meme comme une borne vide plutot
        // que de l'ignorer : ignorer une incoherence, c'est en fabriquer une autre.
        if (apres && apres.clubId !== clubId) return [];
        return membresDUnClub(clubId, max, apres?.uid);
      }

      const out: AppartenanceLue[] = [];
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
          const apresUid = apres && club.id === apres.clubId ? apres.uid : undefined;
          out.push(...(await membresDUnClub(club.id, max - out.length, apresUid)));
        }

        if (out.length >= max || clubs.size < CLUBS_PAR_PAGE) return out;
      }
    },
  };
}

export type PreflightCliDeps = {
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Construit le magasin. N'est appele QU'APRES le feu vert : c'est le test. */
  creerStore: () => PreflightStore;
  log: (message: string) => void;
  erreur: (message: string) => void;
};

/**
 * Le corps de la commande, sans `process` ni Firestore : c'est ce qui la rend
 * testable, et donc ce qui rend le test negatif possible (un magasin instrumente
 * compte les ouvertures de base ; zero ouverture est une preuve, pas une
 * supposition).
 *
 * Retourne le CODE DE SORTIE (voir les constantes plus haut).
 */
export async function executerPreflightCli(deps: PreflightCliDeps): Promise<number> {
  // peutEcrire: false — la commande ne peut rien ecrire, donc rien a confirmer.
  const decision = analyserCible(deps.argv, deps.env, {
    peutEcrire: false,
    etiquette: ETIQUETTE,
  });

  if (!decision.ok) {
    deps.erreur(decision.message);
    return CODE_REFUS;
  }

  // `--attendu` n'a pas de sens ici, et l'accepter en silence laisserait croire
  // qu'il est respecte. On refuse AVANT d'ouvrir la base.
  if (deps.argv.some((a) => a === "--attendu" || a.startsWith("--attendu="))) {
    deps.erreur(
      `${ETIQUETTE} REFUS : --attendu n'existe pas pour cette commande. Ce compteur ` +
        "sert a redeclarer un perimetre avant d'ECRIRE ; ici il n'y a rien a ecrire, " +
        "et c'est justement cette commande qui PRODUIT le chiffre. Rien n'a ete lu.",
    );
    return CODE_REFUS;
  }

  const bornes = analyserBornes(deps.argv, {
    etiquette: ETIQUETTE,
    // apply: false — le compteur attendu reste facultatif cote module de bornes ;
    // il est de toute facon refuse juste au-dessus.
    apply: false,
    ...(decision.clubId !== undefined ? { conteneur: decision.clubId } : {}),
    nomConteneur: "clubId",
  });

  if (!bornes.ok) {
    deps.erreur(bornes.message);
    return CODE_REFUS;
  }

  const repriseLisible = bornes.reprise
    ? `${bornes.reprise.conteneur}/${bornes.reprise.document}`
    : "DEBUT";

  deps.log(
    `${ETIQUETTE} LECTURE SEULE projet=${decision.projet} clubId=${decision.clubId ?? "TOUS"} ` +
      `limite=${bornes.limite} reprise=${repriseLisible} cible=${
        decision.emulateur
          ? "emulateur"
          : decision.production
            ? "PRODUCTION PRESUMEE"
            : "bac a sable"
      }`,
  );

  // Construction PARESSEUSE, ici et pas plus haut : tous les refus ci-dessus se
  // sont prononces sans qu'aucun objet capable de lire n'ait existe.
  const resultat = await runAncienSchemaPreflight(deps.creerStore(), {
    limite: bornes.limite,
    ...(decision.clubId !== undefined ? { clubId: decision.clubId } : {}),
    ...(bornes.reprise !== undefined ? { apres: refDepuisPoint(bornes.reprise) } : {}),
  });

  if (!resultat.ok) {
    deps.erreur(`${ETIQUETTE} REFUS : ${resultat.message}`);
    return CODE_REFUS;
  }

  const r = resultat.rapport;

  deps.log(`${ETIQUETTE} appartenances lues         : ${r.parcourues}`);
  deps.log(`${ETIQUETTE} ANCIEN schema (champ role) : ${r.ancienSchema}`);
  deps.log(`${ETIQUETTE} dont valeurs               : ${JSON.stringify(r.parValeurAncienne)}`);
  deps.log(`${ETIQUETTE} dont mixtes (ancien+neuf)  : ${r.mixtes}`);
  deps.log(`${ETIQUETTE} schema actuel              : ${r.nouveauSchema}`);
  deps.log(`${ETIQUETTE} muettes (aucun des deux)   : ${r.muettes}`);
  deps.log(`${ETIQUETTE} documents illisibles       : ${r.illisibles}`);
  deps.log(
    `${ETIQUETTE} controle de somme : ${r.ancienSchema}+${r.nouveauSchema}+${r.muettes}+` +
      `${r.illisibles}=${r.ancienSchema + r.nouveauSchema + r.muettes + r.illisibles} ` +
      `doit valoir parcourues=${r.parcourues}`,
  );
  deps.log(`${ETIQUETTE} VERDICT : ${r.verdict}`);

  // LE PLAFOND A ETE ATTEINT. On le dit avant tout le reste, et fort : c'est le
  // seul cas ou les compteurs ci-dessus ne decrivent PAS toute la base.
  if (r.limiteAtteinte) {
    deps.log(
      `${ETIQUETTE} ARRET SUR PLAFOND : ${r.parcourues} appartenance(s) lue(s), et il en ` +
        "RESTE. Rien n'a ete tronque en silence — ce compte-la est INCOMPLET, et un " +
        "zero lu ici ne veut PAS dire que la base est propre.",
    );
    deps.log(
      `${ETIQUETTE} pour continuer : relance la meme commande en ajoutant ` +
        `--reprendre-apres=${r.curseur}` +
        (decision.clubId ? ` --clubId=${decision.clubId}` : "") +
        " (et remonte --limite si tu veux tout couvrir d'un coup). Le verdict du " +
        "deploiement est PROPRE seulement si TOUTES les tranches le sont.",
    );
  }

  if (r.verdict === "RESIDU") {
    deps.log(
      `${ETIQUETTE} NE DEPLOIE PAS. ${r.ancienSchema} appartenance(s) portent encore ` +
        "l'ancien champ `role`. Le nouveau code les lira comme « aucune permission, " +
        "aucun suivi » : un coach pilote perdrait son club sans qu'aucun message ne le dise.",
    );
    deps.log(
      `${ETIQUETTE} ET IL N'Y A AUCUNE COMMANDE DE MIGRATION A LANCER : elle n'existe ` +
        "pas, elle reste A ECRIRE (voir docs/coach-pilote-2026-07/INTEGRATION_BOUCLE.md §5). " +
        "Ne deploie pas en attendant, et ne bricole pas les documents a la main.",
    );
    return CODE_RESIDU;
  }

  if (r.verdict === "INCERTAIN") {
    deps.log(
      `${ETIQUETTE} NE DEPLOIE PAS. Aucune appartenance a l'ancien schema dans ce qui a ` +
        `ete lu, mais la lecture est INCOMPLETE (plafond atteint=${
          r.limiteAtteinte ? "oui" : "non"
        }, documents illisibles=${r.illisibles}) : « rien trouve » n'est pas « rien a ` +
        "trouver ». Termine le parcours, ou repare ce qui n'a pas pu etre lu, puis relance.",
    );
    return CODE_INCERTAIN;
  }

  deps.log(
    `${ETIQUETTE} Aucune appartenance a l'ancien schema, et TOUT a ete lu. L'hypothese ` +
      "« base sans document a migrer » est verifiee a l'instant : le deploiement peut " +
      "continuer (Functions, puis front, puis regles).",
  );
  return CODE_PROPRE;
}

if (require.main === module) {
  executerPreflightCli({
    argv: process.argv.slice(2),
    env: process.env,
    // Fonction paresseuse : aucun acces Firestore n'existe tant que la cible et
    // les bornes n'ont pas ete acceptees.
    creerStore: () => createPreflightStore(getDb()),
    log: (m) => console.log(m),
    erreur: (m) => console.error(m),
  })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`${ETIQUETTE} echec`, err instanceof Error ? err.message : String(err));
      process.exitCode = CODE_REFUS;
    });
}
