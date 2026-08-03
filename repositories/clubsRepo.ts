import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  normalizeClubTrainingIntensity,
  normalizeClubWeekGoal,
  normalizeTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import { parseCoachPlayerSummary, type CoachPlayerSummary } from "../domain/coachSummary";
import { isCoachAccessGranted } from "../domain/coachAccess";
import { isActivePlayerStatus, type ClubAccessRole } from "../domain/clubRoles";
import {
  COACH_NOTES_COLLECTION,
  clampCoachPrivateNote,
  parseCoachPrivateNote,
  type ClubCoachNote,
} from "../domain/clubCoachNote";
import {
  CLUB_DIRECTIVES_COLLECTION,
  CLUB_DIRECTIVE_CURRENT_ID,
  clampDirectiveInstruction,
  parseClubDirective,
  type ClubDirectiveObjective,
  type ClubTrainingDirective,
} from "../domain/clubDirective";

export type ClubDoc = {
  id: string;
  name: string;
  ownerUid: string;
};

/**
 * Crée le club. Il ne porte PLUS de code d'invitation.
 *
 * POURQUOI : dans l'ancien contrat, `clubs/{id}.inviteCode` contenait le code
 * en clair, lisible par n'importe quel membre — donc rediffusable par
 * n'importe quel joueur — et servait de preuve d'entrée aux règles Firestore.
 * Le code est désormais émis à la demande par la Cloud Function
 * `issueClubInviteCode` (services/clubInvites.ts), qui n'en stocke que
 * l'empreinte. Il n'y a plus rien à générer, ni à vérifier, ici.
 */
export async function createClub(opts: { name: string; ownerUid: string }): Promise<ClubDoc> {
  const name = String(opts.name ?? "").trim();
  if (!name) throw new Error("CLUB_NAME_REQUIRED");

  const clubRef = doc(collection(db, "clubs"));
  await setDoc(
    clubRef,
    {
      name,
      ownerUid: opts.ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { id: clubRef.id, name, ownerUid: opts.ownerUid };
}

/**
 * Écrit un membership depuis le client. SEUL le rôle "owner", écrit par celui
 * que le club désigne déjà comme `ownerUid`, passe les règles Firestore
 * (cf. firestore.rules, match /members/{memberId} — l'amorçage).
 *
 * POURQUOI "owner" ET PLUS "coach" (juillet 2026). Le prédicat d'autorité exige
 * désormais que le propriétaire porte une appartenance de rôle propriétaire :
 * `ownerUid` seul n'accorde plus rien. Le créateur du club qui s'écrivait en
 * "coach" fabriquait donc, dès la première seconde, l'état incohérent que
 * l'invariant refuse. Il s'écrit "owner", et `isClubStaff` (règles) comme
 * `CLUB_STAFF_ROLES` (serveur) font du propriétaire un encadrant à part entière :
 * il garde l'écriture du cadre de semaine, de la note privée et de la directive.
 *
 * CE CHEMIN N'ÉCRIT QUE L'AXE ENCADREMENT (`accessRole`). Le STATUT DE JOUEUR
 * (`playerStatus`) est interdit à tout client par les règles Firestore, au même
 * titre que `coachAccess` : il est posé par la Cloud Function
 * `joinClubWithInviteCode`, après vérification serveur du code (expiration,
 * révocation, quota d'usages, limitation de tentatives). Un client qui pourrait
 * l'écrire contournerait ces quatre garde-fous et s'inscrirait tout seul dans
 * l'effectif suivi d'un club.
 *
 * Conséquence côté produit, assumée : le fondateur d'un club n'a PAS de suivi
 * sportif dans son propre club à la création. S'il veut en avoir un (le cas de
 * l'entraîneur-joueur), il saisit un code d'invitation de son club comme
 * n'importe qui — un geste explicite, qui ajoute le suivi sans rien retirer à
 * ses permissions.
 */
export async function setClubMembership(opts: {
  clubId: string;
  uid: string;
  accessRole: ClubAccessRole;
}) {
  const memberRef = doc(db, "clubs", opts.clubId, "members", opts.uid);
  await setDoc(
    memberRef,
    {
      uid: opts.uid,
      accessRole: opts.accessRole,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Rattache un compte à un club côté `users/{uid}`.
 *
 * AUCUN APPELANT AUJOURD'HUI (juillet 2026) : le rattachement d'un joueur est
 * écrit par la Cloud Function `joinClubWithInviteCode`, et la création de club
 * passe par `createClubAsCoach`. La fonction est conservée telle quelle, mais
 * son ancien paramètre `role` a disparu : il écrivait `users/{uid}.role`, un
 * champ qui ne décide plus de rien depuis que l'espace affiché est dérivé de
 * l'appartenance (cf. domain/appSpace.ts). Le garder aurait rouvert, pour un
 * futur appelant, exactement le piège que ce lot ferme.
 */
export async function attachUserToClub(opts: { uid: string; clubId: string }) {
  const userRef = doc(db, "users", opts.uid);
  await setDoc(
    userRef,
    {
      uid: opts.uid,
      clubId: opts.clubId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Départ VOLONTAIRE d'un membre : il supprime sa propre appartenance.
 *
 * Ce chemin ne sert QU'À CELA. Retirer QUELQU'UN D'AUTRE passe par la Cloud
 * Function `removeClubMember` (services/clubMembers.ts) : une suppression
 * cliente ne saurait ni supprimer la projection déjà produite, ni révoquer
 * l'accès coach, ni nettoyer la référence du joueur — elle n'en ferait que le
 * premier quart, et laisserait la projection derrière elle.
 *
 * Le PROPRIÉTAIRE ne peut pas se retirer ainsi : les règles le refusent, parce
 * que sa disparition fabriquerait exactement l'incohérence que le prédicat
 * d'autorité proscrit (un `ownerUid` qui désigne un non-membre).
 */
export async function removeClubMembership(opts: { clubId: string; uid: string }) {
  const memberRef = doc(db, "clubs", opts.clubId, "members", opts.uid);
  await deleteDoc(memberRef);
}

/**
 * Crée un club et rattache l'utilisateur comme PROPRIÉTAIRE en une seule
 * opération :
 *  - clubs/{clubId}                  { ownerUid }
 *  - clubs/{clubId}/members/{uid}    (accessRole: "owner")  ← les DEUX sources posées
 *  - users/{uid} { clubId, profileCompleted: true }
 *
 * Les deux sources du prédicat d'autorité sont écrites dans le même mouvement :
 * c'est la seule façon de ne pas créer un club incohérent à sa naissance.
 *
 * `users/{uid}.role` N'EST PLUS ÉCRIT (juillet 2026, lot « espace du nouveau
 * propriétaire »). Ce champ servait à router l'application vers l'espace coach ;
 * or il est écrivable par l'utilisateur lui-même (firestore.rules autorise
 * chacun à écrire tout son document `users/{uid}`), et le transfert de propriété
 * ne le touchait jamais. L'espace affiché est désormais DÉRIVÉ de l'appartenance
 * ci-dessus — la seule source que le serveur contrôle (cf. domain/appSpace.ts).
 * Continuer à écrire un champ qui ne décide plus rien aurait laissé un piège :
 * il ressemblait à une autorité.
 *
 * `clubId` reste écrit : il dit OÙ lire l'appartenance, pas QUI est encadrant.
 *
 * Le coach n'a pas besoin du questionnaire joueur : on marque profileCompleted
 * pour qu'il atterrisse directement sur son espace coach.
 */
export async function createClubAsCoach(opts: {
  name: string;
  uid: string;
  coachName?: string | null;
}): Promise<ClubDoc> {
  const club = await createClub({ name: opts.name, ownerUid: opts.uid });
  await setClubMembership({ clubId: club.id, uid: opts.uid, accessRole: "owner" });

  const coachName = String(opts.coachName ?? "").trim();
  await setDoc(
    doc(db, "users", opts.uid),
    {
      uid: opts.uid,
      clubId: club.id,
      ...(coachName ? { firstName: coachName } : {}),
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return club;
}

// ─── Vue coach : projection coach-safe (lecture SEULE) ──────────────────────
// Le coach ne lit QUE clubs/{clubId}/members (pour connaître l'effectif player)
// et clubs/{clubId}/playerSummaries/{memberId} — jamais users/{uid}, jamais
// users/{uid}/sessions ni /plannedSessions. La projection est produite serveur
// (Cloud Function, PR-2) : labels déjà traduits, aucune donnée médicale / RPE /
// TSB / token brut. Un doc malformé/absent → "projection non prête" (pending),
// jamais dropé en silence ; une lecture refusée (permissions/réseau) → comptée
// dans `unreadableCount` et annoncée telle quelle, sans crash ni fallback vers
// les lectures brutes. Trois compteurs DISTINCTS, jamais confondus :
//   prêt (summaries) · pas encore projeté (pendingCount) · non lu (unreadableCount).
//
// POURQUOI members → summaries (et pas un getDocs de collection) : la règle
// Firestore de playerSummaries exige que la JOUEUSE ciblée soit ENCORE membre
// player (anti-projection stale). Cette contrainte porte sur l'ID du document,
// donc une lecture de COLLECTION (list) est refusée en bloc par les rules
// (impossible à évaluer par doc). On lit donc l'effectif via members, puis
// CHAQUE summary directement par son ID.
//
// Coût Firestore (à assumer) : 1 requête members (facturée ~1 lecture par doc
// member) + 1 getDoc par joueuse active. Pour 15 joueuses + 1 coach ≈ 16 + 15 =
// ~31 lectures/refresh (vs ~15 pour l'ancien getDocs de collection). C'est le
// prix du garde-fou anti-stale. Bornes : MEMBERS_FETCH_LIMIT plafonne l'effectif
// lu ; SUMMARY_READ_CONCURRENCY borne le parallélisme (pas de rafale simultanée).

// Garde-fou anti-scan : un effectif club reste raisonnable. Borne haute large.
//
// EXPORTÉE parce que l'écran Effectif ANNONCE ce plafond en pied de liste
// ("seuls les 200 premiers membres sont lus"). Recopié à la main, ce nombre
// mentirait au premier changement de valeur ici : le plafond affiché doit être
// le plafond réellement appliqué, jamais un jumeau.
export const MEMBERS_FETCH_LIMIT = 200;
// Parallélisme borné des lectures de summary (évite N getDoc simultanés).
const SUMMARY_READ_CONCURRENCY = 8;

export type CoachSummariesResult = {
  summaries: CoachPlayerSummary[]; // projections prêtes & valides (playerUid === memberId)
  // Nombre de membres player dont l'ACCÈS AUX DONNÉES DE SUIVI n'est pas autorisé
  // côté serveur (clubs/{clubId}/members/{uid}.coachAccess ∉ {approved, not_required},
  // champ absent inclus). SÉMANTIQUE ENCORE DIFFÉRENTE des deux compteurs
  // ci-dessous : "le serveur refuse d'ouvrir" ≠ "le serveur n'a pas fini de
  // préparer" ≠ "je n'ai pas réussi à lire". Leur projection n'est même PAS
  // demandée : la lecture serait refusée par les règles, et un refus attendu
  // n'est pas une erreur à compter comme telle.
  restrictedCount: number;
  // Nombre de membres player actifs SANS summary prêt (projection non prête). On
  // expose un COMPTEUR, jamais les UIDs : aucun identifiant technique côté UI.
  pendingCount: number;
  // Nombre de membres player actifs dont la LECTURE a échoué (permissions/réseau,
  // ou départ du club pendant le refresh). SÉMANTIQUE DISTINCTE de pendingCount :
  // "pas encore préparé par le serveur" ≠ "je n'ai pas réussi à lire". L'écran
  // annonce explicitement "N profils non lus" → l'honnêteté est préservée sans
  // vider tout l'effectif pour un seul échec.
  unreadableCount: number;
  // true UNIQUEMENT si l'effectif est globalement illisible : échec de la lecture
  // de `members` (on ne connaît même pas le roster), ou échec de TOUTES les
  // lectures de summary. Un échec PARTIEL ne bascule plus l'écran en vide.
  unavailable: boolean;
  // Horodatage (ms epoch) de fin de lecture — sert l'affichage de fraîcheur et
  // l'anti-rebond côté hook. Injectable (`opts.now`) pour rester testable.
  fetchedAt: number;
};

export type CoachSummaryResult = {
  summary: CoachPlayerSummary | null; // null = absent, malformé, OU doc-id/playerUid incohérent
  unavailable: boolean; // true si la lecture du doc a échoué (permissions/réseau)
  // true si le SERVEUR n'autorise pas l'accès au suivi de ce joueur. Distinct de
  // `unavailable` : ce n'est pas un échec, c'est une décision. Toujours false
  // quand l'appelant ne fournit pas l'état (lecture d'un summary seul).
  restricted?: boolean;
};

/**
 * map bornée en concurrence : au plus `limit` promesses actives à la fois.
 * (Évite un Promise.all de 200 lectures simultanées.)
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Effectif → résumés joueurs, aligné sur la règle stricte playerSummaries.
 *  1. lit clubs/{clubId}/members (borné) ;
 *  2. ne garde que playerStatus === "active" (suivi sportif réel) ;
 *  3. lit CHAQUE clubs/{clubId}/playerSummaries/{memberId} directement (concurrence bornée),
 *     via le lecteur doc unique (intégrité playerUid === memberId, parse défensif, zéro fallback) ;
 *  4. membre sans summary / payload malformé → compté dans `pendingCount` (projection non prête, jamais dropé) ;
 *  5. lecture d'un summary refusée → compté dans `unreadableCount`, les AUTRES sont conservés ;
 *  6. `unavailable` (roster globalement illisible) UNIQUEMENT si `members` échoue,
 *     ou si TOUTES les lectures de summary échouent.
 *
 * POURQUOI on ne vide plus tout au premier échec : avec N+1 requêtes sur un réseau
 * de stade, et le cas NORMAL d'un joueur qui quitte le club pendant le refresh
 * (la rule refuse alors son summary), la règle "un échec = roster vide" transformait
 * 29 projections lisibles sur 30 en écran vide. L'honnêteté n'est pas sacrifiée :
 * elle est déplacée dans un compteur explicite (`unreadableCount`) que l'écran
 * annonce ("N profils non lus"), au lieu d'un silence total.
 */
export async function fetchClubPlayerSummaries(
  clubId: string,
  opts?: { now?: () => number },
): Promise<CoachSummariesResult> {
  // Horloge injectable : le repository ne décide de rien de temporel, il HORODATE
  // seulement sa lecture (le calcul de fraîcheur reste côté front, avec l'horloge du coach).
  const now = opts?.now ?? Date.now;

  // 1–2. Effectif player actif (source de vérité du roster). Échec → indisponible global :
  //      sans `members`, on ne connaît même pas la liste des joueurs à lire.
  //
  //      Le document member porte AUSSI l'état serveur d'autorisation
  //      (`coachAccess`). On le lit ici, dans la requête qu'on faisait déjà :
  //      zéro lecture supplémentaire, et la décision d'accès arrive en même temps
  //      que l'effectif.
  let playerMemberIds: string[];
  let restrictedCount = 0;
  try {
    const snap = await getDocs(
      query(collection(db, "clubs", clubId, "members"), limit(MEMBERS_FETCH_LIMIT)),
    );
        // EFFECTIF SUIVI = statut de joueur actif, jamais les permissions
    // d'encadrement. Un entraîneur-joueur (accessRole "coach" + playerStatus
    // "active") est donc dans cette liste, exactement comme les autres joueurs —
    // et sa fiche reste soumise à coachAccess, juste en dessous.
    const players = snap.docs.filter((d) =>
      isActivePlayerStatus((d.data() as { playerStatus?: unknown })?.playerStatus),
    );
    // Partition SERVEUR : autorisé / non autorisé. On ne demande la projection
    // que des joueurs autorisés — demander les autres produirait un refus des
    // règles, qu'on compterait à tort comme une erreur de lecture.
    playerMemberIds = [];
    for (const d of players) {
      const access = (d.data() as { coachAccess?: unknown })?.coachAccess;
      if (isCoachAccessGranted(access)) playerMemberIds.push(d.id);
      else restrictedCount += 1;
    }
  } catch {
    return {
      summaries: [],
      restrictedCount: 0,
      pendingCount: 0,
      unreadableCount: 0,
      unavailable: true,
      fetchedAt: now(),
    };
  }

  // 3. Une lecture directe de summary par membre actif AUTORISÉ (parallélisme borné).
  //    `fetchClubPlayerSummaryDoc` lit le seul document de projection : l'état
  //    d'autorisation est déjà tranché ci-dessus, inutile de relire le membership.
  const reads = await mapWithConcurrency(playerMemberIds, SUMMARY_READ_CONCURRENCY, (memberId) =>
    fetchClubPlayerSummaryDoc(clubId, memberId).then((res) => ({ memberId, ...res })),
  );

  const summaries: CoachPlayerSummary[] = [];
  let pendingCount = 0;
  let unreadableCount = 0;
  for (const r of reads) {
    // 5. Lecture refusée (permissions/réseau, ex: départ entre members et get) :
    //    on la COMPTE et on continue — les autres projections restent affichables.
    if (r.unavailable) {
      unreadableCount += 1;
      continue;
    }
    // 4. Prêt & valide vs projection non prête (absent/malformé/mismatch → null).
    //    On ne garde que le COMPTEUR (jamais l'UID) → rien de technique à l'écran.
    if (r.summary) summaries.push(r.summary);
    else pendingCount += 1;
  }

  // 6. Tout l'effectif illisible = état global honnête. Un effectif VIDE (0 membre
  //    player) n'est pas une indisponibilité : c'est un vrai club sans joueur.
  //    Les joueurs NON AUTORISÉS ne comptent pas ici : leur absence de données
  //    est une décision serveur assumée, jamais un symptôme de panne.
  const unavailable = playerMemberIds.length > 0 && unreadableCount === playerMemberIds.length;

  return { summaries, restrictedCount, pendingCount, unreadableCount, unavailable, fetchedAt: now() };
}

/**
 * Lit le document de projection d'un joueur, SANS vérifier l'autorisation.
 * Réservé à l'appelant qui l'a déjà tranchée (le roster ci-dessus).
 * Le chemin public reste `fetchClubPlayerSummary`.
 */
async function fetchClubPlayerSummaryDoc(
  clubId: string,
  playerUid: string,
): Promise<CoachSummaryResult> {
  try {
    const snap = await getDoc(doc(db, "clubs", clubId, "playerSummaries", playerUid));
    if (!snap.exists()) return { summary: null, unavailable: false };
    const parsed = parseCoachPlayerSummary(snap.data());
    // Intégrité : le payload doit décrire EXACTEMENT le joueur demandé. Sinon on
    // renvoie null (jamais afficher/ouvrir un autre UID que celui de la route).
    if (!parsed || parsed.playerUid !== playerUid) return { summary: null, unavailable: false };
    return { summary: parsed, unavailable: false };
  } catch {
    return { summary: null, unavailable: true };
  }
}

/**
 * Lit le résumé d'UN joueur (fiche joueur).
 *
 * DEUX lectures, dans cet ordre, et c'est volontaire :
 *  1. le membership `clubs/{clubId}/members/{playerUid}` — il porte l'état
 *     serveur d'autorisation, et il est lisible par le coach (c'est l'effectif,
 *     pas de la donnée de suivi) ;
 *  2. la projection, UNIQUEMENT si l'état autorise.
 *
 * POURQUOI ne pas se contenter de tenter la lecture : un refus des règles
 * remonte en `permission-denied`, strictement indiscernable d'une coupure
 * réseau. L'écran afficherait "on n'arrive pas à lire" là où la vérité est
 * "ce joueur n'est pas consultable". Ce sont trois états distincts — non
 * autorisé / pas encore préparé / erreur de lecture — et l'écran les dit
 * différemment.
 *
 * Membership ABSENT → non consultable : sans rattachement, il n'y a aucune
 * autorisation à invoquer (default-deny, même raisonnement que le serveur).
 */
export async function fetchClubPlayerSummary(
  clubId: string,
  playerUid: string,
): Promise<CoachSummaryResult> {
  let access: unknown;
  try {
    const memberSnap = await getDoc(doc(db, "clubs", clubId, "members", playerUid));
    if (!memberSnap.exists()) return { summary: null, unavailable: false, restricted: true };
    access = (memberSnap.data() as { coachAccess?: unknown })?.coachAccess;
  } catch {
    // Échec de lecture de l'effectif : on ne SAIT pas, donc on ne prétend pas.
    return { summary: null, unavailable: true, restricted: false };
  }

  if (!isCoachAccessGranted(access)) {
    return { summary: null, unavailable: false, restricted: true };
  }

  const res = await fetchClubPlayerSummaryDoc(clubId, playerUid);
  return { ...res, restricted: false };
}

// ─── Contexte de semaine club ──────────────────────────────────────────────
// "Le coach donne le terrain. FKS construit la prépa." Le coach renseigne
// l'intensité de la semaine + l'objectif ; il n'écrit jamais de séance.

export type ClubWeekContext = {
  weekKey: string;
  clubId: string;
  createdBy: string;
  trainingIntensity: ClubTrainingIntensity;
  weekGoal: ClubWeekGoal;
  /** Match prévu ce week-end (info coach). null = non renseigné. */
  matchThisWeekend?: boolean | null;
  /**
   * NOTE HISTORIQUE encore présente dans le document, écrite AVANT la séparation
   * note privée / directive. Elle n'existe QUE pour être récupérée par l'écran
   * coach et déplacée vers la note privée : elle n'est jamais renvoyée au
   * backend de génération, jamais affichée à un joueur, jamais convertie en
   * directive.
   *
   * Le nom est volontairement différent de `note` : personne ne peut le lire
   * par distraction en croyant manipuler le champ d'origine.
   */
  legacyNote?: string | null;
};

/** Type d'équipe (genre) — attribut club stable, posé par le coach. Pas de donnée individuelle. */
export async function setClubTeamGender(clubId: string, gender: ClubTeamGender): Promise<void> {
  await setDoc(doc(db, "clubs", clubId), { teamGender: gender, updatedAt: serverTimestamp() }, { merge: true });
}

/** Lit le type d'équipe du club (null si absent/invalide). */
export async function getClubTeamGender(clubId: string): Promise<ClubTeamGender | null> {
  const snap = await getDoc(doc(db, "clubs", clubId));
  return snap.exists() ? normalizeTeamGender((snap.data() as any)?.teamGender) : null;
}

/**
 * Sauvegarde (merge) le contexte de la semaine. Coach uniquement (cf. règles).
 *
 * PLUS AUCUNE NOTE ICI. Ce document est lisible par TOUT membre du club — une
 * règle Firestore autorise un document, elle ne masque pas un champ. Le champ
 * `note` est donc explicitement SUPPRIMÉ à chaque écriture (`deleteField()`),
 * et les règles refusent désormais toute écriture qui le laisserait présent.
 *
 * Pourquoi une suppression et pas simplement une omission : avec `{merge: true}`,
 * omettre un champ le CONSERVE. Un cadre enregistré sur une semaine ancienne
 * aurait laissé la note d'origine en place, donc toujours lisible par les
 * joueurs — et la règle aurait rejeté l'écriture. La note historique n'est pas
 * perdue pour autant : l'écran coach la déplace vers la note privée AVANT
 * d'appeler cette fonction (cf. CoachWeekScreen.handleSaveContext).
 */
export async function saveClubWeekContext(opts: {
  clubId: string;
  weekKey: string;
  uid: string;
  trainingIntensity: ClubTrainingIntensity;
  weekGoal: ClubWeekGoal;
  matchThisWeekend?: boolean | null;
}): Promise<void> {
  const ref = doc(db, "clubs", opts.clubId, "weekContexts", opts.weekKey);
  await setDoc(
    ref,
    {
      weekKey: opts.weekKey,
      clubId: opts.clubId,
      createdBy: opts.uid,
      trainingIntensity: opts.trainingIntensity,
      weekGoal: opts.weekGoal,
      matchThisWeekend: typeof opts.matchThisWeekend === "boolean" ? opts.matchThisWeekend : null,
      note: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Lit le contexte de semaine d'un club pour une weekKey. Null si absent/invalide. */
export async function getClubWeekContext(clubId: string, weekKey: string): Promise<ClubWeekContext | null> {
  const snap = await getDoc(doc(db, "clubs", clubId, "weekContexts", weekKey));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const trainingIntensity = normalizeClubTrainingIntensity(data?.trainingIntensity);
  const weekGoal = normalizeClubWeekGoal(data?.weekGoal);
  if (!trainingIntensity && !weekGoal) return null;
  return {
    weekKey,
    clubId,
    createdBy: typeof data?.createdBy === "string" ? data.createdBy : "",
    trainingIntensity: trainingIntensity ?? "normal",
    weekGoal: weekGoal ?? "freshness",
    matchThisWeekend: typeof data?.matchThisWeekend === "boolean" ? data.matchThisWeekend : null,
    // Résidu à récupérer, jamais à réutiliser tel quel (cf. ClubWeekContext).
    legacyNote: clampCoachPrivateNote(data?.note) || null,
  };
}

// ─── Note privée du coach (clubs/{clubId}/coachNotes/{weekKey}) ─────────────
// Collection COACH-ONLY. Les règles Firestore y refusent get ET list à tout
// joueur : la séparation est prononcée par la base, pas par un écran qui
// s'abstient d'afficher. Ce document n'est lu par AUCUN chemin de génération.

/**
 * Écrit (ou efface) la note privée de la semaine.
 *
 * Une note vidée est SUPPRIMÉE plutôt que remplacée par une chaîne vide :
 * « pas de note » ne doit pas laisser derrière lui un document résiduel dont
 * on se demanderait s'il contient encore quelque chose.
 */
export async function saveCoachPrivateNote(opts: {
  clubId: string;
  weekKey: string;
  uid: string;
  note: string;
}): Promise<void> {
  const note = clampCoachPrivateNote(opts.note);
  const ref = doc(db, "clubs", opts.clubId, COACH_NOTES_COLLECTION, opts.weekKey);
  await setDoc(
    ref,
    {
      weekKey: opts.weekKey,
      clubId: opts.clubId,
      createdBy: opts.uid,
      note: note ? note : deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Lit la note privée d'une semaine. Null si absente/vide. */
export async function getCoachPrivateNote(
  clubId: string,
  weekKey: string,
): Promise<ClubCoachNote | null> {
  const snap = await getDoc(doc(db, "clubs", clubId, COACH_NOTES_COLLECTION, weekKey));
  if (!snap.exists()) return null;
  return parseCoachPrivateNote(snap.data() as Record<string, unknown>, weekKey);
}

// ─── Directive d'entraînement (clubs/{clubId}/directives/current) ───────────
// VISIBLE PAR LE JOUEUR (get autorisé aux membres du club), écrite par le coach
// seul. Une seule directive à la fois, à une clé connue : le joueur la lit sans
// jamais énumérer la collection (list reste fermée à tous).

/**
 * Enregistre LA directive en cours.
 *
 * `objective` est validée contre l'allowlist avant écriture : une catégorie
 * inconnue est refusée ici, en plus de l'être à la lecture. `instruction` est
 * bornée. Rien n'est deviné : ni la fenêtre de validité, ni le statut.
 */
export async function saveClubDirective(opts: {
  clubId: string;
  uid: string;
  objective: ClubDirectiveObjective;
  instruction: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
}): Promise<void> {
  const instruction = clampDirectiveInstruction(opts.instruction);
  if (!instruction) throw new Error("DIRECTIVE_INSTRUCTION_REQUIRED");

  const ref = doc(db, "clubs", opts.clubId, CLUB_DIRECTIVES_COLLECTION, CLUB_DIRECTIVE_CURRENT_ID);

  // `createdAt` doit rester la date de CRÉATION. Avec un merge, le réécrire à
  // chaque enregistrement le ferait suivre la dernière édition — le champ
  // mentirait sur son propre nom. On ne le pose donc que si le document n'existe
  // pas encore. Une lecture refusée/en échec ne bloque pas l'écriture : on
  // considère alors le document comme existant (on n'écrase pas un `createdAt`
  // qu'on n'a pas pu lire).
  let alreadyExists = true;
  try {
    alreadyExists = (await getDoc(ref)).exists();
  } catch {
    alreadyExists = true;
  }

  await setDoc(
    ref,
    {
      clubId: opts.clubId,
      objective: opts.objective,
      instruction,
      validFrom: opts.validFrom,
      validUntil: opts.validUntil,
      active: opts.active,
      createdBy: opts.uid,
      ...(alreadyExists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Lit la directive en cours. Null si absente ou incomplète (fail-closed). */
export async function getClubDirective(clubId: string): Promise<ClubTrainingDirective | null> {
  const snap = await getDoc(
    doc(db, "clubs", clubId, CLUB_DIRECTIVES_COLLECTION, CLUB_DIRECTIVE_CURRENT_ID),
  );
  if (!snap.exists()) return null;
  return parseClubDirective(snap.data() as Record<string, unknown>);
}
