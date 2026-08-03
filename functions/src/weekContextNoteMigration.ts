// functions/src/weekContextNoteMigration.ts
//
// MIGRATION DES ANCIENNES NOTES DE COACH HORS DU DOCUMENT LU PAR LES JOUEURS.
//
// ⚠️⚠️ JAMAIS EXECUTE. Aucune base reelle n'a ete lue ni ecrite par ce module.
// Il est ecrit, relu et teste UNIQUEMENT sur des donnees inventees
// (functions/tests/weekContextNoteMigration.test.ts). Son execution est une
// decision humaine, decrite pas a pas dans
// docs/coach-pilote-2026-07/MIGRATION_NOTES.md.
//
// ─── LE PROBLEME, EN UNE PHRASE ─────────────────────────────────────────────
// La note du coach vivait dans `clubs/{clubId}/weekContexts/{weekKey}.note`, un
// document que TOUT membre du club peut lire. Les regles Firestore refusent
// desormais toute NOUVELLE ecriture qui laisserait ce champ, et l'ecran coach
// deplace la note vers le stockage coach-only quand il reenregistre la semaine.
// Mais un document ANCIEN, jamais rouvert, porte toujours sa note — et reste
// lisible par les joueurs. Rouvrir chaque semaine a la main n'est pas une
// protection : c'est un espoir. D'ou cet outil.
//
// ─── "TOUS LES ANCIENS CHAMPS", ET PAS SEULEMENT `note` ─────────────────────
// Un build anterieur a pu ecrire une variante (`notes`, `coachNote`,
// `commentaire`, un objet imbrique...). Chercher une LISTE NOIRE de noms
// laisserait passer celui auquel personne n'a pense. On fait donc l'inverse :
// on connait le CONTRAT du cadre de semaine (`WEEK_CONTEXT_CONTRACT_FIELDS`), et
// TOUT champ hors contrat qui porte du texte est traite comme une note. Une
// liste blanche se trompe du bon cote : au pire on deplace un champ qui n'etait
// pas une note — vers un document coach-only, sans rien perdre.
//
// ─── CE QU'IL FAIT, DANS L'ORDRE ────────────────────────────────────────────
//  1. il LIT le cadre de semaine et la note privee de la meme semaine ;
//  2. il COPIE les textes hors contrat dans `coachNotes/{weekKey}`, sous
//     `legacyImport`, avec leurs metadonnees (champ d'origine, auteur, date) ;
//  3. il SUPPRIME les champs d'origine du cadre de semaine ;
//  4. les etapes 2 et 3 sont dans LA MEME TRANSACTION : soit la note est a
//     l'abri ET effacee du document public, soit rien n'a bouge.
//
// ─── CE QU'IL NE FAIT JAMAIS ────────────────────────────────────────────────
//  - il n'ECRASE JAMAIS une note privee existante. Si la semaine porte deja une
//    note coach differente, l'ancienne est conservee A COTE (`legacyImport`) et
//    le cas est compte comme un conflit. Perdre du texte pour "faire propre"
//    serait le pire resultat possible ;
//  - il ne CONVERTIT JAMAIS une note en directive : une note privee reste une
//    note privee, c'est le coach qui decide (cf. domain/clubCoachNote.ts) ;
//  - il n'ECRIT RIEN en simulation (le magasin d'ecriture est REMPLACE, pas
//    conditionne par un `if` qu'on pourrait oublier) ;
//  - il ne JOURNALISE AUCUN CONTENU. Les compteurs disent COMBIEN et DANS QUEL
//    CHAMP ; jamais ce qui etait ecrit, jamais qui l'a ecrit.

/**
 * LE CONTRAT du cadre de semaine : tout ce qu'un document `weekContexts/{k}`
 * a le droit de porter. Recopie de repositories/clubsRepo.saveClubWeekContext
 * (front) — les deux doivent rester d'accord.
 *
 * Verrouille MECANIQUEMENT (functions/tests/weekContextNoteMigration.test.ts,
 * section VERROU) : un test lit le source de clubsRepo.ts, extrait les cles
 * reellement ecrites par saveClubWeekContext et les compare a cette liste
 * champ par champ. Ne JAMAIS ajouter un champ ici sans l'ajouter aussi au
 * payload de saveClubWeekContext (et inversement) : le test rougit sinon.
 * `createdAt` a ete retire le 2026-07-31 — le champ n'a jamais ete ecrit par
 * saveClubWeekContext, il n'aurait donc jamais du figurer dans ce contrat.
 *
 * `note` n'y est PAS : c'est precisement le champ qu'on chasse.
 */
export const WEEK_CONTEXT_CONTRACT_FIELDS: readonly string[] = [
  "weekKey",
  "clubId",
  "createdBy",
  "trainingIntensity",
  "weekGoal",
  "matchThisWeekend",
  "updatedAt",
];

/**
 * Champs HERITES CONNUS : jamais ecrits par `saveClubWeekContext`, mais un
 * document ANCIEN peut les porter depuis une autre origine (ex: un `createdAt`
 * pose par l'Admin SDK avant que ce champ soit retire du contrat le 2026-07-31,
 * cf. WEEK_CONTEXT_CONTRACT_FIELDS ci-dessus). Ce ne sont PAS des variantes de
 * note comme `notes`/`coachNote` : ce sont des champs SYSTEME dont on connait
 * le sens, et ce sens n'est jamais « texte ecrit par un coach ».
 *
 * Traitement : archives comme le reste (dans `legacyImport.champs`, retires du
 * document public) mais JAMAIS choisis comme note VISIBLE — une date ISO
 * affichee comme note serait pire que la fuite qu'on repare. Voir
 * `migrerUnCadre` : `principale` exclut ces champs de la selection.
 */
export const CHAMPS_HERITES_CONNUS: readonly string[] = ["createdAt"];

/** Un texte trouve hors contrat. `chemin` = champ d'origine (jamais le contenu). */
export type TexteHorsContrat = { chemin: string; texte: string };

/** Profondeur maximale d'exploration d'un champ hors contrat imbrique. */
const PROFONDEUR_MAX = 4;

/**
 * Tous les textes portes par des champs HORS CONTRAT.
 *
 * Explore les chaines, les tableaux et les objets imbriques : une note rangee
 * dans `{ staff: { note: "..." } }` est trouvee elle aussi. Les valeurs vides ou
 * blanches sont ignorees (un champ vide n'expose rien).
 */
export function detecterTextesHorsContrat(
  doc: Record<string, unknown> | null | undefined,
): TexteHorsContrat[] {
  if (!doc || typeof doc !== "object") return [];
  const out: TexteHorsContrat[] = [];

  const explorer = (valeur: unknown, chemin: string, profondeur: number): void => {
    if (profondeur > PROFONDEUR_MAX) return;
    if (typeof valeur === "string") {
      const t = valeur.trim();
      if (t) out.push({ chemin, texte: t });
      return;
    }
    if (Array.isArray(valeur)) {
      valeur.forEach((v, i) => explorer(v, `${chemin}[${i}]`, profondeur + 1));
      return;
    }
    if (valeur && typeof valeur === "object") {
      // Un horodatage Firestore est un objet a `toDate` : ce n'est pas du texte.
      if (typeof (valeur as { toDate?: unknown }).toDate === "function") return;
      for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
        explorer(v, `${chemin}.${k}`, profondeur + 1);
      }
    }
  };

  for (const [cle, valeur] of Object.entries(doc)) {
    if (WEEK_CONTEXT_CONTRACT_FIELDS.includes(cle)) continue;
    explorer(valeur, cle, 0);
  }
  // Ordre stable : deux passages produisent le meme resultat, donc le meme
  // choix de note principale.
  return out.sort((a, b) => a.chemin.localeCompare(b.chemin));
}

/** Champs hors contrat NE portant aucun texte (comptes, jamais deplaces). */
export function champsHorsContratNonTextuels(
  doc: Record<string, unknown> | null | undefined,
): string[] {
  if (!doc || typeof doc !== "object") return [];
  const avecTexte = new Set(detecterTextesHorsContrat(doc).map((t) => t.chemin.split(/[.[]/)[0]));
  return Object.keys(doc)
    .filter((k) => !WEEK_CONTEXT_CONTRACT_FIELDS.includes(k) && !avecTexte.has(k))
    .sort();
}

/** Clef de premier niveau d'un chemin ("staff.note" -> "staff"). */
export function champRacine(chemin: string): string {
  return chemin.split(/[.[]/)[0];
}

// ─── Ports (aucun firebase-admin ici : testable sans emulateur) ─────────────

export type WeekContextRef = { clubId: string; weekKey: string };

export type NoteMigrationTx = {
  /** Lecture d'un document. `null` s'il n'existe pas. */
  read(path: string): Promise<Record<string, unknown> | null>;
  /** Ecriture en fusion. */
  merge(path: string, data: Record<string, unknown>): void;
  /** Suppression CIBLEE de champs de premier niveau. */
  deleteFields(path: string, champs: string[]): void;
};

export type NoteMigrationStore = {
  /** Inventaire des cadres de semaine, eventuellement borne a un club. */
  listWeekContexts(clubId?: string): Promise<WeekContextRef[]>;
  /** Chemins Firestore (le module ne les fabrique pas lui-meme). */
  weekContextPath(ref: WeekContextRef): string;
  coachNotePath(ref: WeekContextRef): string;
  /**
   * Transaction : tout ou rien. C'est ce qui garantit qu'une note n'est jamais
   * effacee sans avoir ete mise a l'abri, ni mise a l'abri sans etre effacee.
   */
  runTransaction<T>(fn: (tx: NoteMigrationTx) => Promise<T>): Promise<T>;
};

export type MigrationStats = {
  /** Documents parcourus. */
  scannes: number;
  /** Documents portant au moins un texte hors contrat. */
  detectes: number;
  /** Documents effectivement traites (en simulation : qui LE SERAIENT). */
  migres: number;
  /** Documents deja passes (aucun texte hors contrat, import deja present). */
  dejaMigres: number;
  /** Documents propres, jamais concernes. */
  sansNote: number;
  /** Documents disparus entre l'inventaire et le traitement. */
  disparus: number;
  /** Notes privees deja presentes ET differentes : les deux textes conserves. */
  conflits: number;
  /** Echecs (rien n'a ete ecrit pour ces documents-la). */
  erreurs: number;
  /** Repartition CHAMP PAR CHAMP des textes trouves. Des noms, jamais du contenu. */
  champsDetectes: Record<string, number>;
};

export type MigrationOptions = {
  /** false (defaut) = SIMULATION : aucune ecriture. */
  apply?: boolean;
  clubId?: string;
  /** Horodatage injecte (ISO). Injectable pour rendre les tests deterministes. */
  now?: () => string;
};

/**
 * En simulation, on REMPLACE le magasin par un magasin dont les ecritures sont
 * physiquement absentes. Meme discipline que coachAccessBackfill.readOnly et
 * clubOwnershipCli.createDryRunStore : on ne peut pas oublier un `if`.
 */
function lectureSeule(store: NoteMigrationStore): NoteMigrationStore {
  return {
    listWeekContexts: (clubId) => store.listWeekContexts(clubId),
    weekContextPath: (ref) => store.weekContextPath(ref),
    coachNotePath: (ref) => store.coachNotePath(ref),
    runTransaction: (fn) =>
      store.runTransaction((tx) =>
        fn({
          read: (path) => tx.read(path),
          merge: () => {
            /* simulation : aucune ecriture, jamais */
          },
          deleteFields: () => {
            /* simulation : aucune suppression, jamais */
          },
        }),
      ),
  };
}

type ResultatDocument =
  | { action: "disparu" }
  | { action: "sans-note" }
  | { action: "deja-migre" }
  | { action: "migre"; champs: string[]; conflit: boolean };

/**
 * Traite UN cadre de semaine, dans une seule transaction.
 *
 * Exporte pour etre testable seul — c'est la brique ou vivent toutes les
 * decisions delicates (conflit, idempotence, choix de la note principale).
 */
export async function migrerUnCadre(
  store: NoteMigrationStore,
  ref: WeekContextRef,
  now: () => string,
): Promise<ResultatDocument> {
  const cheminCadre = store.weekContextPath(ref);
  const cheminNote = store.coachNotePath(ref);

  return store.runTransaction(async (tx) => {
    // TOUTES les lectures d'abord : Firestore l'exige dans une transaction.
    const cadre = await tx.read(cheminCadre);
    if (!cadre) return { action: "disparu" } as ResultatDocument;

    const textes = detecterTextesHorsContrat(cadre);
    const notePrivee = await tx.read(cheminNote);

    if (textes.length === 0) {
      const dejaImporte = Boolean(
        notePrivee && typeof notePrivee === "object" && notePrivee.legacyImport,
      );
      return { action: dejaImporte ? "deja-migre" : "sans-note" } as ResultatDocument;
    }

    // Note principale : celle du champ `note` si elle existe, sinon la premiere
    // dans l'ordre stable des chemins — mais JAMAIS un champ HERITE CONNU
    // (`createdAt`) : ce n'est pas une note ecrite par un coach, c'est une date
    // systeme. Sans cette exclusion, un vieux document qui ne porte QUE ce champ
    // (aucune vraie note) verrait sa date affichee comme note visible du coach.
    // `null` si tout ce qui a ete trouve est un champ herite connu : le champ
    // est quand meme archive plus bas (`champsImportes`), simplement jamais
    // promu.
    const eligiblesPourNoteVisible = textes.filter(
      (t) => !CHAMPS_HERITES_CONNUS.includes(champRacine(t.chemin)),
    );
    const principale =
      eligiblesPourNoteVisible.find((t) => t.chemin === "note") ??
      eligiblesPourNoteVisible[0] ??
      null;
    const noteExistante =
      typeof notePrivee?.note === "string" ? (notePrivee.note as string).trim() : "";
    const conflit = principale !== null && noteExistante !== "" && noteExistante !== principale.texte;

    // Les textes importes sont ranges PAR CHAMP D'ORIGINE. Un second passage
    // ecrirait les memes clefs avec les memes valeurs : l'operation est
    // idempotente meme si elle est rejouee.
    const champsImportes: Record<string, string> = {};
    for (const t of textes) champsImportes[t.chemin] = t.texte;

    const importe: Record<string, unknown> = {
      champs: champsImportes,
      // Metadonnees UTILES, et rien de plus : d'ou ca vient, qui l'avait ecrit,
      // quand on l'a deplace. `createdBy` est un identifiant technique, pas un
      // nom — il sert a savoir quel compte coach avait posé la note.
      source: "weekContexts",
      weekKey: ref.weekKey,
      migratedAt: now(),
      ...(typeof cadre.createdBy === "string" ? { sourceCreatedBy: cadre.createdBy } : {}),
    };

    const payload: Record<string, unknown> = {
      weekKey: ref.weekKey,
      clubId: ref.clubId,
      legacyImport: importe,
      // On ne pose la note visible QUE si la semaine n'en a pas deja une (le
      // coach a pu ecrire depuis, et sa version recente fait foi) ET qu'il y a
      // effectivement une note eligible (`principale` non nul) : un document qui
      // ne porte qu'un champ herite connu n'obtient AUCUNE note visible.
      ...(principale !== null && noteExistante === "" ? { note: principale.texte } : {}),
    };

    tx.merge(cheminNote, payload);
    // Suppression au NIVEAU RACINE : un champ hors contrat n'a rien a faire
    // dans ce document, meme partiellement.
    const racines = [...new Set(textes.map((t) => champRacine(t.chemin)))].sort();
    tx.deleteFields(cheminCadre, racines);

    return {
      action: "migre",
      champs: textes.map((t) => t.chemin),
      conflit,
    } as ResultatDocument;
  });
}

/**
 * Passe sur tout l'inventaire. Un document en echec n'arrete pas les autres :
 * l'outil doit pouvoir etre relance, et il l'est sans risque (idempotent).
 */
export async function runWeekContextNoteMigration(
  store: NoteMigrationStore,
  opts: MigrationOptions = {},
): Promise<MigrationStats> {
  const apply = opts.apply === true;
  const cible = apply ? store : lectureSeule(store);
  const now = opts.now ?? (() => new Date().toISOString());

  const stats: MigrationStats = {
    scannes: 0,
    detectes: 0,
    migres: 0,
    dejaMigres: 0,
    sansNote: 0,
    disparus: 0,
    conflits: 0,
    erreurs: 0,
    champsDetectes: {},
  };

  const refs = await store.listWeekContexts(opts.clubId);
  for (const ref of refs) {
    stats.scannes += 1;
    try {
      const res = await migrerUnCadre(cible, ref, now);
      if (res.action === "migre") {
        stats.detectes += 1;
        stats.migres += 1;
        if (res.conflit) stats.conflits += 1;
        for (const chemin of res.champs) {
          stats.champsDetectes[chemin] = (stats.champsDetectes[chemin] ?? 0) + 1;
        }
      } else if (res.action === "deja-migre") {
        stats.dejaMigres += 1;
      } else if (res.action === "sans-note") {
        stats.sansNote += 1;
      } else {
        stats.disparus += 1;
      }
    } catch {
      // AUCUNE donnee journalisee : un journal de migration contenant des notes
      // de coach serait exactement ce qu'on est en train de proteger.
      stats.erreurs += 1;
    }
  }

  return stats;
}

// ─── AUDIT : la verification finale, lisible ────────────────────────────────

export type AuditRapport = {
  scannes: number;
  /** Documents portant encore un texte hors contrat. */
  documentsAvecTexte: number;
  /** Combien de fois chaque champ hors contrat porte du texte. */
  champsDetectes: Record<string, number>;
  /** Champs hors contrat sans texte : signales, jamais deplaces. */
  champsNonTextuels: Record<string, number>;
  /** Documents illisibles pendant l'audit (un audit qui echoue le DIT). */
  erreurs: number;
  /** PROPRE seulement si documentsAvecTexte = 0 ET erreurs = 0. */
  verdict: "PROPRE" | "RESIDU" | "INCERTAIN";
};

/**
 * Repasse sur l'inventaire et REGARDE, sans rien ecrire.
 *
 * C'est une commande a part entiere (functions/src/weekContextNoteAuditCli.ts) :
 * Kyllian doit pouvoir la lancer apres coup, seul, et lire le resultat. Une
 * assertion cachee dans une suite de tests ne repond pas a la question « est-ce
 * que MA base est propre ? ».
 *
 * `INCERTAIN` existe pour ne pas confondre « rien trouve » et « pas tout lu » :
 * un audit qui n'a pas pu lire un document ne peut pas prononcer PROPRE.
 */
export async function auditWeekContextNotes(
  store: NoteMigrationStore,
  opts: { clubId?: string } = {},
): Promise<AuditRapport> {
  const rapport: AuditRapport = {
    scannes: 0,
    documentsAvecTexte: 0,
    champsDetectes: {},
    champsNonTextuels: {},
    erreurs: 0,
    verdict: "PROPRE",
  };

  const refs = await store.listWeekContexts(opts.clubId);
  for (const ref of refs) {
    rapport.scannes += 1;
    try {
      const cadre = await store.runTransaction((tx) => tx.read(store.weekContextPath(ref)));
      if (!cadre) continue;
      const textes = detecterTextesHorsContrat(cadre);
      if (textes.length > 0) {
        rapport.documentsAvecTexte += 1;
        for (const t of textes) {
          rapport.champsDetectes[t.chemin] = (rapport.champsDetectes[t.chemin] ?? 0) + 1;
        }
      }
      for (const c of champsHorsContratNonTextuels(cadre)) {
        rapport.champsNonTextuels[c] = (rapport.champsNonTextuels[c] ?? 0) + 1;
      }
    } catch {
      rapport.erreurs += 1;
    }
  }

  rapport.verdict =
    rapport.documentsAvecTexte > 0 ? "RESIDU" : rapport.erreurs > 0 ? "INCERTAIN" : "PROPRE";
  return rapport;
}
