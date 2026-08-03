// hooks/home/homeVNextNavigation.ts
// =============================================================================
// OU MENE CHAQUE ACTION DU HOME VNEXT — FONCTION PURE
// =============================================================================
//
// `ActionTarget` (screens/homeVNext/viewModel.ts) est une union FERMEE de six
// intentions. Ce module fait la seule chose que le ViewModel s'interdit : dire
// vers quelle route de `AppStackParamList` chacune part, et avec quel payload.
//
// POURQUOI UNE FONCTION PURE PLUTOT QU'UN `switch` DANS LE CONTENEUR : parce que
// deux des six cibles ne peuvent PAS toujours aboutir. `SessionLive` et
// `SessionPreview` exigent le JSON `fks.next_session.v2` complet, et ce JSON
// n'est pas dans le ViewModel (il n'a rien a faire dans une couche de
// presentation). Il faut donc le rechercher dans le store au moment du tap, et
// il peut manquer : seance importee sans contenu, purge locale, compte restaure.
// Ecrit en ligne dans le composant, ce cas d'echec n'aurait ete verifie par
// aucun test — c'est exactement la faute que `screens/HomeScreen.tsx` evite en
// dupliquant le meme garde-fou a trois endroits (usePrimaryCta:81, :108, :161).
//
// Ce module ne navigue pas, n'affiche pas de toast, ne touche a aucun store : il
// rend une INSTRUCTION que le conteneur execute. C'est ce qui le rend testable
// sans monter React ni un NavigationContainer.
//
// CE QU'IL NE FAIT PAS NON PLUS : il ne re-decide RIEN. Le choix de la cible
// appartient au ViewModel (§5.4, `construireAction`) ; ici on ne fait que la
// traduire. Un `if` qui changerait de destination selon l'etat des seances
// remettrait une seconde regle de decision a un endroit ou personne ne la
// cherche — le defaut « etat calcule deux fois » que la refonte supprime.
// =============================================================================

import type { ActionTarget } from "../../screens/homeVNext/viewModel";
import type { Session } from "../../domain/types";
import { toDateKey } from "../../utils/dateHelpers";

/**
 * Ce que le conteneur doit faire. Union discriminee : il est impossible de
 * traiter un cas en oubliant l'autre, et impossible de naviguer sans route.
 */
export type InstructionHomeVNext =
  /** Aller sur cette route de `AppStackParamList`, avec ces parametres. */
  | { kind: "navigate"; route: string; params?: Record<string, unknown> }
  /** Ne rien faire : l'action etait un accuse de reception. */
  | { kind: "aucune" }
  /**
   * La destination existait, son contenu non. Le conteneur montre ce toast et
   * NE NAVIGUE PAS — donc ne consomme pas la garde anti-double-tap.
   */
  | { kind: "indisponible"; titre: string; message: string };

/** L'etat minimal a fournir pour resoudre une cible. Aucun hook, aucun store. */
export type ContexteNavigationHome = {
  /**
   * Identifiant de la seance en attente, TEL QUE LE VIEWMODEL L'A VU
   * (`vm`.pendingSession.id, issu de `selectPendingSession`). On repart de cet
   * id plutot que de re-selectionner la seance : entre le calcul du ViewModel et
   * le tap du joueur, un watcher Firestore peut avoir change la selection, et le
   * joueur partirait alors sur une seance qu'il n'a pas vue a l'ecran.
   */
  pendingSessionId: string | null;
  /** `useSessionsStore.sessions`. */
  sessions: readonly Session[];
  /** `useSessionsStore.lastAiSessionV2` — dernier repli connu du contenu v2. */
  lastAiSessionV2: { v2: Record<string, unknown> } | null;
};

const TOAST_SEANCE_INDISPONIBLE = {
  titre: "Séance indisponible",
  // Formulation reprise MOT POUR MOT de `usePrimaryCta` : le joueur qui a deja
  // rencontre ce cas sur l'ancien Home lit la meme phrase.
  message: "Le contenu de cette séance est introuvable. Relance une génération.",
} as const;

/**
 * Retrouve la seance en attente et son contenu `v2`.
 * `null` si l'un des deux manque — ce qui est une situation reelle, pas une
 * anomalie : une seance peut exister en base sans son JSON.
 */
function resoudreSeance(
  contexte: ContexteNavigationHome
): { v2: Record<string, unknown>; plannedDateISO: string; sessionId: string } | null {
  if (contexte.pendingSessionId === null) return null;
  const seance = contexte.sessions.find((s) => s.id === contexte.pendingSessionId);
  if (!seance) return null;

  // MEME ORDRE DE REPLI que `usePrimaryCta` (aiV2, puis ai, puis le dernier v2
  // genere). Le troisieme repli couvre les seances creees avant que le contenu
  // soit stocke sur la seance elle-meme.
  const v2 = seance.aiV2 ?? seance.ai ?? contexte.lastAiSessionV2?.v2;
  if (!v2) return null;

  const plannedDateISO = toDateKey(seance.dateISO ?? seance.date);
  if (!plannedDateISO) return null;

  return { v2, plannedDateISO, sessionId: seance.id };
}

/**
 * Traduit une cible du ViewModel en instruction de navigation.
 *
 * Exhaustive par construction : ajouter un membre a `ActionTarget` sans le
 * traiter ici casse la compilation (le `never` final).
 */
export function resoudreDestinationHome(
  cible: ActionTarget,
  contexte: ContexteNavigationHome
): InstructionHomeVNext {
  switch (cible) {
    case "session_live": {
      const seance = resoudreSeance(contexte);
      if (!seance) return { kind: "indisponible", ...TOAST_SEANCE_INDISPONIBLE };
      return { kind: "navigate", route: "SessionLive", params: { ...seance } };
    }

    case "session_preview": {
      const seance = resoudreSeance(contexte);
      if (!seance) return { kind: "indisponible", ...TOAST_SEANCE_INDISPONIBLE };
      return { kind: "navigate", route: "SessionPreview", params: { ...seance } };
    }

    case "generation":
      // L'onglet "Séance", pas l'ecran `GenerateSession` de la pile : c'est la
      // destination que l'ancien Home utilisait (`usePrimaryCta:186`), et elle
      // garde la tab bar visible — le joueur peut faire demi-tour sans "retour".
      return { kind: "navigate", route: "NewSession" };

    case "choix_cycle":
      // `mode: "select"` (choisir) et non "manage" (gerer) : cette cible n'est
      // produite par le ViewModel que lorsqu'AUCUN cycle n'est actif.
      return { kind: "navigate", route: "CycleModal", params: { mode: "select", origin: "home" } };

    case "feedback": {
      if (contexte.pendingSessionId === null) {
        // Le ViewModel n'emet "feedback" que s'il a vu une seance en attente ;
        // arriver ici sans id signifie que l'etat a change sous les doigts du
        // joueur. On ouvre quand meme l'ecran, qui sait selectionner la seance
        // lui-meme — c'est plus utile qu'un toast d'erreur.
        return { kind: "navigate", route: "Feedback" };
      }
      return { kind: "navigate", route: "Feedback", params: { sessionId: contexte.pendingSessionId } };
    }

    case "aucune":
      return { kind: "aucune" };

    default: {
      const jamais: never = cible;
      return jamais;
    }
  }
}
