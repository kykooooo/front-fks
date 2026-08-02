// functions/src/ancienSchemaPreflight.ts
//
// PREFLIGHT DE DEPLOIEMENT : reste-t-il, quelque part, une appartenance ecrite
// avec l'ANCIEN schema (le champ unique `role`) ?
//
// ⚠️⚠️ JAMAIS EXECUTE sur une base reelle. Ce module est ecrit, relu et teste
// UNIQUEMENT sur des donnees inventees (functions/tests/ancienSchemaPreflight.test.ts).
//
// ─── LE PROBLEME QU'IL REGLE ────────────────────────────────────────────────
// Le modele d'appartenance a ete REMPLACE, pas double : l'ancien champ unique
// `role` (owner / coach / player / removed) a laisse la place a deux axes
// independants, `accessRole` et `playerStatus` (cf. clubAuthority.ts). Aucun
// chemin de compatibilite n'a ete ecrit, et cette absence repose sur UNE
// hypothese, ecrite noir sur blanc dans ESPACE_ET_ROLES.md : « la base de
// production a ete videe le 21 juillet, il n'existe aucun document a migrer ».
//
// Cette hypothese etait vraie LE 21 JUILLET. Elle ne l'est pas forcement le jour
// du deploiement : un club pilote cree entre-temps par l'ancienne version du
// code aurait ecrit des appartenances a l'ancien schema. Elles seraient alors
// lues comme « aucune permission, aucun suivi » — fail-closed, donc sans danger
// pour la securite, mais un coach pilote perdrait son club sans que rien ne le
// dise. « Sans danger » et « sans consequence » ne sont pas la meme chose.
//
// D'ou ce preflight : il RECOMPTE l'hypothese au lieu de la supposer, juste
// avant de deployer. Si le compte n'est pas zero, il BLOQUE.
//
// ─── CE QU'IL NE FAIT PAS, ET C'EST LE POINT ────────────────────────────────
// Il ne repare RIEN. Il n'ecrit RIEN. Il ne peut pas ecrire : le port de lecture
// (`PreflightStore`) n'expose AUCUNE methode d'ecriture — ce n'est pas un
// `if (apply)` qu'on pourrait oublier, c'est une absence de type. Il n'y a donc
// ni `--apply`, ni confirmation nominative a exiger : on ne confirme pas un
// regard.
//
// ET IL N'EXISTE AUCUNE MIGRATION A LANCER. Si le compte n'est pas zero, la
// suite est une migration QUI RESTE A ECRIRE. Le dire franchement vaut mieux que
// de laisser croire qu'une commande attend quelque part.
//
// ─── LE PIEGE CENTRAL : « rien trouve » N'EST PAS « rien a trouver » ────────
// Le parcours est BORNE (plafond obligatoire, cf. migrationBornes.ts). Un
// preflight qui s'arrete au plafond n'a pas tout lu : prononcer PROPRE sur une
// lecture tronquee serait exactement le mensonge que le plafond est cense
// eviter. D'ou un verdict a TROIS etats, sur le modele de l'audit des notes
// (weekContextNoteMigration.auditWeekContextNotes) :
//   PROPRE    : zero ancien schema, ET tout a ete lu ;
//   RESIDU    : au moins une appartenance a l'ancien schema ;
//   INCERTAIN : rien trouve, mais la lecture est incomplete (plafond atteint,
//               ou document illisible).
// INCERTAIN est un ECHEC de preflight, pas une reserve de style : il bloque
// comme RESIDU. Un doute sur l'etat de la base est une raison de ne pas
// deployer.
//
// ─── AUCUN IDENTIFIANT EN SORTIE ────────────────────────────────────────────
// Le rapport ne porte que des COMPTEURS et des noms de VALEURS DE SCHEMA
// (owner / coach / player / removed), jamais un uid, jamais un nom de personne,
// jamais le contenu d'un document. Une valeur `role` non reconnue est comptee
// dans un seau anonyme plutot que recopiee : ce qu'un ancien build a pu ecrire
// la n'est pas connu d'avance, et un journal ne doit pas devenir la fuite qu'on
// ferme ailleurs. Seule exception, la meme que pour les autres outils
// administrateur : le CURSEUR de reprise, un couple d'identifiants techniques
// sans lequel la reprise serait impossible — et il n'est affiche que lorsque le
// plafond a ete atteint.

import {
  ACCESS_ROLE_FIELD,
  PLAYER_STATUS_FIELD,
  normalizeAccessRole,
  normalizePlayerStatus,
} from "./clubAuthority";
import {
  encoderPointDeReprise,
  verifierOrdreStrict,
  type PointDeReprise,
} from "./migrationBornes";

/**
 * LE CHAMP DE L'ANCIEN MODELE. Ce module est le DERNIER endroit du code qui
 * connait encore ce vocabulaire : `clubAuthority.ts` l'a supprime, et c'est
 * voulu (un repli qui accepterait encore `role` rouvrirait la fusion des deux
 * axes). Le connaitre ICI ne le reintroduit nulle part : on le RECONNAIT pour
 * compter, on ne s'en sert jamais pour decider d'un droit.
 */
export const LEGACY_ROLE_FIELD = "role";

/** Les quatre valeurs que l'ancien champ unique pouvait porter. */
export const LEGACY_ROLE_VALUES = ["owner", "coach", "player", "removed"] as const;

/**
 * Seau ou sont comptees les valeurs `role` NON reconnues. On compte, on ne
 * recopie pas : un ancien build a pu ecrire n'importe quoi la, y compris du
 * texte saisi par un humain.
 */
export const VALEUR_ANCIENNE_NON_RECONNUE = "(valeur non reconnue)";

/** Une appartenance a examiner : un couple d'identifiants de documents. */
export type AppartenanceRef = { clubId: string; uid: string };

/**
 * Une appartenance LUE : la reference et les donnees, rendues ensemble.
 *
 * Volontairement different du backfill des acces coach, qui liste puis relit
 * document par document : ici il n'y a rien a ecrire, donc rien a relire au plus
 * pres de l'ecriture. Rendre les donnees avec la reference evite une seconde
 * lecture par document ET supprime la course « disparu entre l'inventaire et le
 * traitement » : ce qu'on classe est exactement ce qu'on a lu.
 */
export type AppartenanceLue = AppartenanceRef & {
  /** `null` = document illisible ou donnees inexploitables. */
  donnees: Record<string, unknown> | null;
};

/** Le couple (club, uid) vu comme point de reprise. Unique par construction. */
export function pointDeReprise(ref: AppartenanceRef): PointDeReprise {
  return { conteneur: ref.clubId, document: ref.uid };
}

/** L'inverse : un point de reprise redevient une reference d'appartenance. */
export function refDepuisPoint(point: PointDeReprise): AppartenanceRef {
  return { clubId: point.conteneur, uid: point.document };
}

/** Ordre du parcours, expose pour que les magasins ne le reecrivent pas a leur facon. */
export function comparerAppartenances(a: AppartenanceRef, b: AppartenanceRef): number {
  const pa = pointDeReprise(a);
  const pb = pointDeReprise(b);
  if (pa.conteneur !== pb.conteneur) return pa.conteneur < pb.conteneur ? -1 : 1;
  if (pa.document !== pb.document) return pa.document < pb.document ? -1 : 1;
  return 0;
}

/**
 * Ce que le coeur demande au magasin pour UNE tranche de parcours.
 *
 * CONTRAT, identique a celui du backfill (coachAccessBackfill.ParcoursMembres) :
 * ordre croissant (clubId puis uid), `apres` exclut son propre point, au plus
 * `max` references. Le coeur verifie l'ordre a la reception.
 */
export type ParcoursAppartenances = {
  /** Borne facultative a un seul club. */
  clubId?: string;
  /** Reprise : ne rend que ce qui vient STRICTEMENT apres ce point. */
  apres?: AppartenanceRef;
  /** Nombre MAXIMAL de documents rendus. Toujours fourni. */
  max: number;
};

/**
 * Port de lecture. AUCUNE methode d'ecriture, et c'est la garantie : un preflight
 * ne peut pas ecrire par accident, parce qu'il n'a physiquement pas de quoi.
 */
export type PreflightStore = {
  listAppartenances(parcours: ParcoursAppartenances): Promise<AppartenanceLue[]>;
};

/** Classe d'une appartenance. Etiquettes stables : les tests s'y appuient. */
export type ClasseAppartenance =
  | "ancien-schema"
  | "nouveau-schema"
  | "muette"
  | "illisible";

export type Classement = {
  classe: ClasseAppartenance;
  /**
   * Valeur de l'ancien champ, RAMENEE au vocabulaire connu ou au seau anonyme.
   * Presente uniquement pour "ancien-schema".
   */
  valeurAncienne?: string;
  /** Porte l'ancien champ ET au moins un des deux nouveaux axes. */
  mixte: boolean;
};

/**
 * CLASSE UNE APPARTENANCE. Fonction PURE : aucune lecture, aucune horloge.
 *
 * Fail-closed sur le doute : un champ `role` present avec une valeur inconnue
 * compte quand meme comme ancien schema. Le nouveau modele n'ecrit JAMAIS ce
 * champ ; sa presence est donc, a elle seule, la trace d'un ancien build — et
 * mieux vaut bloquer un deploiement pour un document exotique que le laisser
 * passer parce que sa valeur n'etait pas dans la liste.
 */
export function classerAppartenance(donnees: Record<string, unknown> | null): Classement {
  if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) {
    return { classe: "illisible", mixte: false };
  }

  const porteNouveau =
    normalizeAccessRole(donnees[ACCESS_ROLE_FIELD]) !== null ||
    normalizePlayerStatus(donnees[PLAYER_STATUS_FIELD]) !== null;

  const brut = Object.prototype.hasOwnProperty.call(donnees, LEGACY_ROLE_FIELD)
    ? donnees[LEGACY_ROLE_FIELD]
    : undefined;

  // `role: null` / `role: ""` : le champ a ete efface, pas rempli. Ce n'est pas
  // une appartenance a l'ancien schema, c'est un residu de forme sans contenu.
  const efface =
    brut === undefined || brut === null || (typeof brut === "string" && brut.trim() === "");

  if (!efface) {
    const texte = typeof brut === "string" ? brut.trim() : null;
    const reconnue =
      texte !== null && (LEGACY_ROLE_VALUES as readonly string[]).includes(texte) ? texte : null;
    return {
      classe: "ancien-schema",
      valeurAncienne: reconnue ?? VALEUR_ANCIENNE_NON_RECONNUE,
      mixte: porteNouveau,
    };
  }

  if (porteNouveau) return { classe: "nouveau-schema", mixte: false };

  // Ni l'un ni l'autre : ni ancien schema (rien a migrer), ni nouveau (rien a
  // lire). Deja fail-closed cote serveur et cote regles. On le COMPTE et on le
  // dit, mais on ne bloque pas un deploiement pour ca : ce n'est pas la question
  // posee, et confondre les deux rendrait le verdict illisible.
  return { classe: "muette", mixte: false };
}

export type PreflightRapport = {
  /** Documents effectivement examines par cette execution. */
  parcourues: number;
  /** LE COMPTEUR QUI BLOQUE : appartenances portant encore l'ancien champ. */
  ancienSchema: number;
  /** Repartition par valeur de l'ancien champ. Des valeurs de schema, jamais des uid. */
  parValeurAncienne: Record<string, number>;
  /** Parmi elles : celles qui portent AUSSI un des deux nouveaux axes. */
  mixtes: number;
  /** Appartenances au modele actuel. */
  nouveauSchema: number;
  /** Ni ancien champ, ni aucun des deux axes. Signalees, jamais bloquantes. */
  muettes: number;
  /** Documents dont les donnees n'ont pas pu etre exploitees. */
  illisibles: number;
  /** true = le plafond a ete atteint et il RESTE des documents non lus. */
  limiteAtteinte: boolean;
  /** Ou reprendre (`clubId/uid`), ou null si rien n'a ete parcouru. */
  curseur: string | null;
  /** PROPRE seulement si ancienSchema = 0 ET la lecture est complete. */
  verdict: "PROPRE" | "RESIDU" | "INCERTAIN";
};

/** Motifs de refus du parcours. Etiquettes stables. */
export type MotifRefusPreflight = "limite-invalide" | "ordre-instable";

export type RefusPreflight = { ok: false; motif: MotifRefusPreflight; message: string };

/**
 * Un refus ne porte AUCUN compteur : l'absence de rapport est la preuve qu'aucun
 * verdict n'a ete prononce.
 */
export type ResultatPreflight = RefusPreflight | { ok: true; rapport: PreflightRapport };

export type PreflightOptions = {
  clubId?: string;
  /** Plafond de documents PARCOURUS. OBLIGATOIRE (le type l'impose). */
  limite: number;
  /** On n'examine que ce qui vient STRICTEMENT APRES cette appartenance. */
  apres?: AppartenanceRef;
};

/**
 * Parcourt une tranche bornee et RECOMPTE. Ne modifie rien, nulle part.
 */
export async function runAncienSchemaPreflight(
  store: PreflightStore,
  opts: PreflightOptions,
): Promise<ResultatPreflight> {
  const limite = opts.limite;
  // Filet du coeur : la ligne de commande a deja refuse une limite absente ou
  // mal formee, mais ce module est aussi appele par des tests et pourrait l'etre
  // demain par un autre outil. Un refus ICI ne lit rien.
  if (!Number.isSafeInteger(limite) || limite < 1) {
    return {
      ok: false,
      motif: "limite-invalide",
      message:
        "Plafond de parcours absent ou invalide : le preflight ne parcourt jamais " +
        "sans limite. Rien n'a ete lu.",
    };
  }

  // UN DE PLUS que le plafond. Ce document supplementaire n'est jamais classe :
  // il sert uniquement a repondre « est-ce qu'il en reste ? ». Sans lui, on
  // confondrait « exactement le plafond » et « le plafond, et il en reste trois
  // mille » — c'est-a-dire qu'on prononcerait PROPRE sur une lecture tronquee.
  const page = await store.listAppartenances({
    ...(opts.clubId !== undefined ? { clubId: opts.clubId } : {}),
    ...(opts.apres !== undefined ? { apres: opts.apres } : {}),
    max: limite + 1,
  });

  const desordre = verifierOrdreStrict(
    page.map(pointDeReprise),
    opts.apres ? pointDeReprise(opts.apres) : undefined,
  );
  if (desordre) {
    return {
      ok: false,
      motif: "ordre-instable",
      message:
        `Inventaire incoherent : ${desordre}. La reprise par curseur suppose un ` +
        "ordre stable ; sans lui, une tranche sauterait ou repeterait des documents " +
        "sans que rien ne le dise, et le compte serait faux. Rien n'a ete conclu.",
    };
  }

  const limiteAtteinte = page.length > limite;
  const aClasser = limiteAtteinte ? page.slice(0, limite) : page;

  const rapport: PreflightRapport = {
    parcourues: 0,
    ancienSchema: 0,
    parValeurAncienne: {},
    mixtes: 0,
    nouveauSchema: 0,
    muettes: 0,
    illisibles: 0,
    limiteAtteinte,
    curseur: null,
    verdict: "PROPRE",
  };

  for (const lue of aClasser) {
    rapport.parcourues += 1;
    rapport.curseur = encoderPointDeReprise(pointDeReprise(lue));
    const { classe, valeurAncienne, mixte } = classerAppartenance(lue.donnees);
    if (classe === "ancien-schema") {
      rapport.ancienSchema += 1;
      const cle = valeurAncienne ?? VALEUR_ANCIENNE_NON_RECONNUE;
      rapport.parValeurAncienne[cle] = (rapport.parValeurAncienne[cle] ?? 0) + 1;
      if (mixte) rapport.mixtes += 1;
    } else if (classe === "nouveau-schema") {
      rapport.nouveauSchema += 1;
    } else if (classe === "muette") {
      rapport.muettes += 1;
    } else {
      rapport.illisibles += 1;
    }
  }

  // LE VERDICT. RESIDU l'emporte sur INCERTAIN : avoir DEJA trouve un document a
  // migrer est une information plus forte qu'un doute sur ce qui reste a lire —
  // et les deux bloquent de toute facon.
  const lectureIncomplete = rapport.limiteAtteinte || rapport.illisibles > 0;
  rapport.verdict =
    rapport.ancienSchema > 0 ? "RESIDU" : lectureIncomplete ? "INCERTAIN" : "PROPRE";

  return { ok: true, rapport };
}
