// state/orchestrators/markSessionNotDone.ts
//
// « JE NE L'AI PAS FAITE » — décision Kyllian 15/08 (P1-08 inventaire clubs).
//
// Un joueur qui saute une séance est un fait normal du foot. Avant cette
// issue, une séance générée mais jamais ouverte exigeait un ressenti le
// lendemain (« attend ton retour ») : le joueur honnête devait MENTIR au
// feedback (fabriquer un RPE → fausse charge dans ATL/CTL) ou attendre ~2
// jours que la fenêtre se referme.
//
// La règle actée, dans l'ordre où elle compte :
//  1. AUCUNE charge : on ne touche NI useLoadStore NI applyFeedback — pas de
//     RPE inventé, ATL/CTL/TSB strictement intacts (verrouillé par test).
//  2. La séance est archivée localement (notDone + notDoneAt) : elle reste
//     visible dans l'historique (« Pas faite »), elle ne disparaît pas.
//  3. Elle ne bloque plus rien : selectPendingSession l'écarte → le CTA du
//     Home et la génération se libèrent immédiatement.
//  4. Côté serveur, le doc planifié est marqué `status: 'not_done'` (même
//     mécanique fire-and-forget que le marqueur `completed` du feedback) ;
//     tant que le marqueur n'a pas atterri, mergePlannedIntoLocalSessions
//     protège la copie locale (invariant « une séance réglée n'est jamais
//     écartée »).

import { useSessionsStore } from "../stores/useSessionsStore";
import { markPlannedSessionNotDone } from "../../services/plannedSessionsRepo";
import { retryWithBackoff } from "../../utils/errorHandler";

export function markSessionNotDone(sessionId: string): boolean {
  const { sessions } = useSessionsStore.getState();
  const session = sessions.find((s) => s.id === sessionId);

  // Refus honnêtes : séance inconnue, déjà complétée (le feedback a gagné),
  // ou déjà archivée (idempotence — un double tap ne fait rien de plus).
  if (!session || session.completed || session.notDone) return false;

  const notDoneAt = new Date().toISOString();
  useSessionsStore.setState((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId ? { ...s, notDone: true, notDoneAt } : s
    ),
  }));

  // Marqueur serveur, fire-and-forget : ne bloque ni ne fait échouer
  // l'archivage local (hors-ligne, le flag local + la protection du merge
  // suffisent sur cet appareil ; le marqueur repartira à la prochaine action
  // en ligne via la latency compensation Firestore).
  retryWithBackoff(
    () => markPlannedSessionNotDone(sessionId),
    { maxRetries: 3, baseDelayMs: 500, context: "markPlannedSessionNotDone" }
  ).catch((err) => {
    if (__DEV__) {
      console.warn("[markSessionNotDone] marqueur serveur en échec après retries:", err);
    }
  });

  return true;
}
