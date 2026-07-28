// hooks/coach/useCoachClub.ts
//
// Résolution du CONTEXTE CLUB du coach : identité du club (nom, type d'équipe)
// + cadre de la semaine courante.
//
// Le CODE D'INVITATION n'est plus lu ici, et pour cause : il n'existe plus en
// base sous forme lisible (seule son empreinte est stockée, dans une collection
// fermée à tous les clients). Il est émis à la demande par la Cloud Function
// `issueClubInviteCode` et affiché une seule fois — voir hooks/coach/useClubInviteCode.
//
// POURQUOI un hook dédié : aujourd'hui CoachHomeScreen fait ces lectures à la
// main dans un gros `load()`, et surtout il n'a AUCUN état "coach sans club" —
// un coach non rattaché voit "Mon club" et un effectif vide, c'est-à-dire un
// écran qui MENT. Ici l'absence de club est un état de premier rang (`notInClub`),
// distinct d'une erreur de lecture (`error`).
//
// Le hook ne lit QUE des documents autorisés au coach :
//   users/{uid}                          → son propre doc (clubId)
//   clubs/{clubId}                       → nom, type d'équipe
//   clubs/{clubId}/weekContexts/{weekKey} → cadre de la semaine (écrit par le coach)
// Jamais users/{autre uid}, jamais sessions, jamais plannedSessions.
//
// SANS HORLOGE CÔTÉ SERVEUR : la weekKey est calculée ICI, avec l'horloge du
// coach (utils/dateHelpers.weekKeyOf). Aucun champ temporel relatif n'est lu.

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import {
  canCommitCoachData,
  currentCoachAuthorityToken,
} from "../../state/coachAuthorityGate";
import { useCoachDataPurge } from "./useCoachDataPurge";
import { auth, db } from "../../services/firebase";
import {
  getClubDirective,
  getClubWeekContext,
  getCoachPrivateNote,
  type ClubWeekContext,
} from "../../repositories/clubsRepo";
import { normalizeTeamGender, type ClubTeamGender } from "../../domain/types";
import {
  isClubOwnerAuthorityInconsistent,
  resolveClubOwnerAuthority,
  type ClubOwnerAuthority,
} from "../../domain/clubRoles";
import { resolveClubPointer } from "../../domain/coachAuthority";
import type { ClubCoachNote } from "../../domain/clubCoachNote";
import type { ClubTrainingDirective } from "../../domain/clubDirective";
import { weekKeyOf } from "../../utils/dateHelpers";

/**
 * États mutuellement exclusifs du contexte club.
 *  - "loading"   : première lecture en cours (aucune conclusion possible) ;
 *  - "ready"     : club résolu, on sait quoi afficher ;
 *  - "notInClub" : le coach n'est rattaché à AUCUN club existant (ou plus) —
 *                  ce n'est pas une erreur, c'est un état produit normal ;
 *  - "error"     : lecture refusée / réseau — on ne devine rien.
 *
 * Sur un REFRESH raté, on passe en "error" mais on CONSERVE le contexte club
 * déjà lu (clubId, nom) : perdre le club sous les pieds du coach parce
 * qu'une requête a échoué serait plus faux que d'annoncer "mise à jour impossible".
 * `fetchedAt` reste alors l'horodatage de la dernière lecture RÉUSSIE.
 */
export type CoachClubStatus = "loading" | "ready" | "notInClub" | "error";

export type CoachClubState = {
  status: CoachClubStatus;
  clubId: string | null;
  clubName: string | null;
  teamGender: ClubTeamGender | null;
  /**
   * Verdict d'autorité PROPRIÉTAIRE du compte connecté sur ce club, calculé avec
   * les deux mêmes sources que le serveur et que les règles : `ownerUid` du
   * document club, et le rôle porté par sa propre appartenance.
   *
   * Il ne sert JAMAIS à ouvrir un droit — l'application n'en accorde aucun. Il
   * sert à DIRE la vérité quand les deux sources se contredisent : sans lui, un
   * propriétaire dont l'appartenance a disparu verrait l'effectif, le cadre et
   * la note devenir illisibles un par un, sans explication. C'est exactement la
   * « disparition muette » que l'invariant refuse.
   */
  ownerAuthority: ClubOwnerAuthority;
  /** Raccourci : `ownerAuthority` décrit-il un état à réparer ? */
  ownershipInconsistent: boolean;
  /** Lundi de la semaine courante ("YYYY-MM-DD"), horloge du coach. */
  weekKey: string;
  /** Cadre de la semaine tel qu'enregistré, ou null s'il n'a pas été renseigné. */
  weekContext: ClubWeekContext | null;
  /** true si la lecture du cadre a échoué (le reste du contexte reste valide). */
  weekContextUnavailable: boolean;
  /**
   * Note PRIVÉE de la semaine (document coach-only). Lue séparément du cadre,
   * parce qu'elle vit dans une autre collection — c'est tout l'intérêt : aucun
   * joueur n'a le droit de la lire, et aucun chemin de génération ne la voit.
   */
  coachNote: ClubCoachNote | null;
  /** true si la lecture de la note privée a échoué (jamais confondu avec « pas de note »). */
  coachNoteUnavailable: boolean;
  /** Directive d'entraînement en cours (visible par le joueur), ou null. */
  directive: ClubTrainingDirective | null;
  /** true si la lecture de la directive a échoué. */
  directiveUnavailable: boolean;
  /** ms epoch de la dernière lecture aboutie, null tant qu'aucune n'a abouti. */
  fetchedAt: number | null;
  isRefreshing: boolean;
  refresh: () => void;
};

export type UseCoachClubOptions = {
  /** Horloge injectable (tests / horloge virtuelle dev). */
  now?: () => number;
};

type CoachClubSnapshot = Omit<CoachClubState, "isRefreshing" | "refresh">;

const EMPTY: Omit<CoachClubSnapshot, "weekKey"> = {
  status: "loading",
  clubId: null,
  clubName: null,
  teamGender: null,
  ownerAuthority: "not-owner",
  ownershipInconsistent: false,
  weekContext: null,
  weekContextUnavailable: false,
  coachNote: null,
  coachNoteUnavailable: false,
  directive: null,
  directiveUnavailable: false,
  fetchedAt: null,
};

export function useCoachClub(options?: UseCoachClubOptions): CoachClubState {
  const uid = auth.currentUser?.uid ?? null;

  // L'horloge est gardée dans une ref : un appelant qui passe `{ now: () => ... }`
  // en littéral change son identité à CHAQUE rendu ; si `now` entrait dans les
  // dépendances de `runFetch`, l'effet de montage relancerait une lecture en
  // boucle. La ref rend l'horloge stable sans la figer. Elle est réécrite dans un
  // effet, jamais pendant le rendu (une ref n'est pas une valeur de rendu).
  const nowRef = useRef<() => number>(options?.now ?? Date.now);
  useEffect(() => {
    nowRef.current = options?.now ?? Date.now;
  });
  const now = useCallback(() => nowRef.current(), []);

  // weekKey : le LUNDI de la semaine courante, horloge du coach. Initialisée au
  // montage, puis RECALCULÉE à chaque lecture (dans runFetch, hors rendu) — c'est
  // ce qui fait passer l'écran à la semaine suivante sans redémarrage de l'app.
  const [state, setState] = useState<CoachClubSnapshot>(() => ({
    ...EMPTY,
    weekKey: weekKeyOf(new Date((options?.now ?? Date.now)())),
    // Pas d'utilisateur authentifié → il n'y a rien à lire et rien à attendre :
    // on part directement de "notInClub" au lieu d'un `loading` qui ne finirait
    // jamais. (Une déconnexion démonte l'espace coach : RootNavigator bascule sur
    // la pile auth, ce hook ne survit pas à la transition uid → null.)
    status: uid ? "loading" : "notInClub",
  }));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Garde anti réponse tardive : même motif que la fiche joueuse. Un fetch
  // capture SON requestId ; sa réponse n'est appliquée que si elle est encore la
  // dernière émise et si le composant est monté.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(
    async (mode: "initial" | "refresh") => {
      // Sans utilisateur authentifié il n'y a rien à lire (l'état initial dit
      // déjà "notInClub"). Sortie SANS aucun setState : ce hook ne doit pas
      // déclencher de rendu en cascade depuis son effet de montage.
      if (!uid) return;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      // Jeton d'autorité capturé AU DÉPART, vérifié dans `accept()` — donc au
      // moment d'ÉCRIRE, à chacun des cinq points de sortie de cette lecture.
      const jetonAutorite = currentCoachAuthorityToken();
      // Semaine recalculée À CHAQUE lecture, avec l'horloge du coach : c'est le
      // seul endroit "hors rendu" où l'on peut le faire sans figer l'app sur la
      // semaine du démarrage.
      const weekKey = weekKeyOf(new Date(now()));

      const accept = () =>
        mountedRef.current &&
        requestId === requestIdRef.current &&
        canCommitCoachData(jetonAutorite);
      const finish = () => {
        if (mode === "refresh") setIsRefreshing(false);
      };

      let clubId: string | null = null;
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        const raw = userSnap.exists() ? (userSnap.data() as { clubId?: unknown })?.clubId : null;
        // Même lecture que la navigation (`domain/coachAuthority.resolveClubPointer`) :
        // un pointeur qui désignerait plusieurs clubs est REFUSÉ, jamais réduit
        // à son premier élément. Deux endroits qui lisent le même champ doivent
        // le lire de la même façon, sinon l'un ouvre ce que l'autre ferme.
        const pointeur = resolveClubPointer(raw);
        clubId = pointeur.statut === "unique" ? pointeur.clubId : null;
      } catch {
        if (!accept()) return;
        setState((prev) => ({ ...prev, status: "error" }));
        finish();
        return;
      }

      if (!clubId) {
        if (!accept()) return;
        // Coach sans club : état DÉDIÉ. On vide tout le reste pour ne jamais
        // laisser traîner le club précédent (changement de compte).
        setState({ ...EMPTY, weekKey, status: "notInClub", fetchedAt: now() });
        finish();
        return;
      }

      let clubName: string | null = null;
      let teamGender: ClubTeamGender | null = null;
      let ownerUid: unknown = null;
      try {
        const clubSnap = await getDoc(doc(db, "clubs", clubId));
        if (!clubSnap.exists()) {
          if (!accept()) return;
          // clubId qui pointe vers un club supprimé → il n'y a plus de club.
          setState({ ...EMPTY, weekKey, status: "notInClub", fetchedAt: now() });
          finish();
          return;
        }
        const data = clubSnap.data() as Record<string, unknown>;
        clubName = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null;
        teamGender = normalizeTeamGender(data?.teamGender);
        ownerUid = data?.ownerUid;
      } catch {
        if (!accept()) return;
        setState((prev) => ({ ...prev, status: "error" }));
        finish();
        return;
      }

      // ── Sa PROPRE appartenance : la seconde source du prédicat d'autorité ──
      // Une lecture de plus par chargement de club, et elle est assumée : sans
      // elle, l'application ne peut pas faire la différence entre « ce club ne
      // vous appartient pas » et « ce club vous désigne, mais votre appartenance
      // ne le confirme pas ». Le document est TOUJOURS lisible par son
      // propriétaire (`allow read: isOwner(memberId)`), donc un échec ici est un
      // vrai incident réseau, pas un refus.
      //
      // Un échec de LECTURE ne doit surtout pas se transformer en incohérence
      // affichée : « je n'ai pas pu lire mon appartenance » et « mon appartenance
      // ne dit pas ce qu'elle devrait » sont deux choses différentes, et accuser
      // la base sur un incident réseau serait exactement le genre de mensonge que
      // le reste de l'espace coach s'interdit. En cas d'échec, on retombe donc
      // sur « pas propriétaire », qui n'affirme rien et n'affiche aucun bandeau.
      let myRole: unknown = null;
      let membershipRead = true;
      try {
        const memberSnap = await getDoc(doc(db, "clubs", clubId, "members", uid));
        myRole = memberSnap.exists() ? (memberSnap.data() as Record<string, unknown>)?.role : null;
      } catch {
        membershipRead = false;
      }
      const ownerAuthority: ClubOwnerAuthority = membershipRead
        ? resolveClubOwnerAuthority({ ownerUid, myRole, uid })
        : "not-owner";

      // Cadre de la semaine : best-effort. Son échec ne casse PAS le contexte club
      // (le coach doit pouvoir voir son effectif même si le cadre est illisible),
      // mais il est signalé explicitement plutôt que présenté comme "non renseigné".
      let weekContext: ClubWeekContext | null = null;
      let weekContextUnavailable = false;
      try {
        weekContext = await getClubWeekContext(clubId, weekKey);
      } catch {
        weekContextUnavailable = true;
      }

      // Note privée et directive : DEUX documents distincts du cadre, lus à part
      // et en parallèle. Chaque échec est isolé — « pas de note » et « note
      // illisible » ne se confondent jamais, pas plus qu'ils ne cassent le reste
      // du contexte club.
      let coachNote: ClubCoachNote | null = null;
      let coachNoteUnavailable = false;
      let directive: ClubTrainingDirective | null = null;
      let directiveUnavailable = false;
      const [noteRes, directiveRes] = await Promise.all([
        getCoachPrivateNote(clubId, weekKey).catch(() => "unavailable" as const),
        getClubDirective(clubId).catch(() => "unavailable" as const),
      ]);
      if (noteRes === "unavailable") coachNoteUnavailable = true;
      else coachNote = noteRes;
      if (directiveRes === "unavailable") directiveUnavailable = true;
      else directive = directiveRes;

      if (!accept()) return;
      setState({
        status: "ready",
        clubId,
        clubName,
        teamGender,
        ownerAuthority,
        ownershipInconsistent: isClubOwnerAuthorityInconsistent(ownerAuthority),
        weekKey,
        weekContext,
        weekContextUnavailable,
        coachNote,
        coachNoteUnavailable,
        directive,
        directiveUnavailable,
        fetchedAt: now(),
      });
      finish();
    },
    [uid, now],
  );

  useEffect(() => {
    // FAUX POSITIF DE LINT, assumé et prouvé par un test.
    // `react-hooks/set-state-in-effect` voit les `setState` contenus dans
    // `runFetch` et conclut à un rendu en cascade au montage. Il ne modélise pas
    // la frontière `await` : dans `runFetch`, AUCUN `setState` n'est atteignable
    // avant le premier `await getDoc(...)` (le seul retour anticipé, `!uid`, sort
    // sans toucher à l'état). Le montage ne provoque donc jamais de second rendu
    // synchrone. L'invariant est verrouillé par le test « aucun rendu en cascade
    // au montage » (hooks/coach/__tests__/useCoachClub.test.tsx) : si quelqu'un
    // ajoute un jour un `setState` en tête de `runFetch`, ce test tombe — on ne
    // se repose pas sur ce commentaire.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runFetch("initial");
    return () => {
      // Changement d'uid / démontage : invalide toute réponse en vol.
      requestIdRef.current += 1;
    };
  }, [runFetch]);

  // PURGE À LA PERTE D'AUTORITÉ. Ce hook porte l'identité du club, le cadre de
  // la semaine, la DIRECTIVE et surtout la NOTE PRIVÉE du coach — le document
  // qu'aucun joueur n'a le droit de lire. Il repart entièrement à zéro.
  //
  // Le statut retenu est `error` et non `notInClub` : dire « tu n'es dans aucun
  // club » après une purge serait affirmer un fait qu'on ne connaît pas.
  // `error` dit la seule chose vraie — on n'a plus rien de lisible.
  //
  // EFFET EN CASCADE, ET IL EST VOULU : CoachWeekScreen hydrate ses brouillons
  // (cadre, note, directive) depuis ces champs. Les remettre à `null` vide donc
  // aussi les zones de saisie de l'écran, sans que celui-ci ait à s'abonner.
  useCoachDataPurge(
    useCallback(() => {
      requestIdRef.current += 1;
      setState((prev) => ({ ...EMPTY, weekKey: prev.weekKey, status: "error" }));
      setIsRefreshing(false);
    }, []),
  );

  const refresh = useCallback(() => {
    // Pas de spinner qu'on ne pourrait pas éteindre (sans uid, runFetch sort tout
    // de suite), et pas deux refresh concurrents.
    if (!uid || isRefreshing) return;
    setIsRefreshing(true);
    runFetch("refresh");
  }, [uid, isRefreshing, runFetch]);

  return { ...state, isRefreshing, refresh };
}
