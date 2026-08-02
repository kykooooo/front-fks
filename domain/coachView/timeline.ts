// domain/coachView/timeline.ts
//
// « Que s'est-il passé pour ce joueur ? » — la suite des FAITS datés, du plus
// récent au plus ancien.
//
// Règles de la timeline :
//  - un événement = un fait réel (séance prévue, séance faite, séance prévue non
//    faite, écarts d'exécution, ajustement moteur). Jamais une supposition ;
//  - chaque événement dit d'où il vient (`source`), parce qu'un coach ne lit pas
//    de la même façon "le joueur a sauté 2 exos" et "FKS a allégé la séance" ;
//  - jamais de JSON brut, jamais de token moteur, jamais de détail interne.
//
// Module PUR : `todayKey` injecté.

import { formatDayFR } from "../../utils/dateHelpers";
import { compareDateKeysDesc } from "./dates";
import type { CoachPlayerView, CoachTimelineEvent, CoachTimelineEventType } from "./types";

// Ordre de lecture à date égale : ce qui a été FAIT d'abord, le contexte ensuite.
const TYPE_ORDER: CoachTimelineEventType[] = [
  "seance_prevue_non_faite",
  "seance_faite",
  "execution_ecarts",
  "seance_prevue",
  "ajustement_moteur",
];

/** "12 exercices faits, 2 adaptés, 1 sauté" — uniquement les compteurs connus. */
function ecartsContexte(view: CoachPlayerView): string | null {
  const exec = view.execution;
  if (!exec) return null;
  const morceaux: string[] = [];
  if (exec.fait !== null) morceaux.push(`${exec.fait} exercice${exec.fait > 1 ? "s" : ""} fait${exec.fait > 1 ? "s" : ""}`);
  if (exec.adapte !== null && exec.adapte > 0) morceaux.push(`${exec.adapte} adapté${exec.adapte > 1 ? "s" : ""}`);
  if (exec.saute !== null && exec.saute > 0) morceaux.push(`${exec.saute} sauté${exec.saute > 1 ? "s" : ""}`);
  if (exec.remplace !== null && exec.remplace > 0) morceaux.push(`${exec.remplace} remplacé${exec.remplace > 1 ? "s" : ""}`);
  if (exec.raisons.length > 0) morceaux.push(`raison${exec.raisons.length > 1 ? "s" : ""} : ${exec.raisons.join(", ")}`);
  return morceaux.length > 0 ? morceaux.join(", ") : null;
}

/** "Renfo / Force · 40 min · 4 blocs" — on n'écrit que ce qu'on sait. */
function seanceContexte(
  parts: { titre?: string | null; focus?: string | null; dureeMin?: number | null; nbBlocs?: number | null },
): string | null {
  const morceaux: string[] = [];
  if (parts.titre) morceaux.push(parts.titre);
  else if (parts.focus) morceaux.push(parts.focus);
  if (parts.dureeMin !== null && parts.dureeMin !== undefined) morceaux.push(`${parts.dureeMin} min`);
  if (parts.nbBlocs !== null && parts.nbBlocs !== undefined) {
    morceaux.push(`${parts.nbBlocs} bloc${parts.nbBlocs > 1 ? "s" : ""}`);
  }
  return morceaux.length > 0 ? morceaux.join(" · ") : null;
}

/**
 * Construit la timeline d'un joueur à partir de son modèle de lecture.
 *
 * @param view     modèle de lecture complet (statut/signaux déjà calculés).
 * @param todayKey clé du jour, horloge du coach — sert à dire si une séance
 *                 prévue est encore à venir ou déjà passée.
 */
export function buildPlayerTimeline(view: CoachPlayerView, todayKey: string): CoachTimelineEvent[] {
  const evenements: CoachTimelineEvent[] = [];

  // ── Séances FAITES : un événement par date connue ─────────────────────────
  const faiteKey = view.seanceFaite?.dateKey ?? null;
  for (const dateKey of view.datesSeancesFaites) {
    // Le détail (titre/durée/blocs) n'est connu que pour la dernière séance faite.
    const detail = dateKey === faiteKey ? view.seanceFaite : null;
    evenements.push({
      id: `faite-${dateKey}`,
      type: "seance_faite",
      dateKey,
      libelle: "Séance réalisée",
      contexte: detail
        ? seanceContexte({
            titre: detail.titre,
            focus: detail.focus,
            dureeMin: detail.dureeMin,
            nbBlocs: detail.nbBlocs,
          })
        : null,
      source: "execution",
    });
  }

  // ── Écarts d'exécution : rattachés à la séance faite correspondante ───────
  const exec = view.execution;
  if (exec) {
    const dateKey = faiteKey ?? view.derniereActivite?.dateKey ?? null;
    const libelle =
      exec.statut === "interrompue"
        ? "Séance interrompue"
        : exec.statut === "partielle"
          ? "Séance réalisée en partie"
          : "Séance suivie avec des écarts";
    const contexte = ecartsContexte(view);
    // Une séance complète et sans écart n'a rien à raconter : on ne l'invente pas.
    const muet = exec.statut === "complete" && !contexte;
    if (!muet) {
      evenements.push({
        id: `execution-${dateKey ?? "sans-date"}`,
        type: "execution_ecarts",
        dateKey,
        libelle,
        // Même vocabulaire prudent qu'ailleurs (attention.ts, fiche joueur) :
        // ce pourcentage compte des EXERCICES, il ne mesure pas un effort.
        contexte:
          exec.pourcentage !== null
            ? [`${exec.pourcentage} % des exercices réalisés`, contexte].filter(Boolean).join(" · ")
            : contexte,
        source: "execution",
      });
    }
  }

  // ── Séance PRÉVUE : à venir, ou restée sans réalisation ───────────────────
  const prevue = view.seancePrevue;
  if (prevue) {
    const dateKey = prevue.dateKey;
    const nonFaite = view.signaux.some((s) => s.code === "seance_prevue_non_faite");
    const aVenir = dateKey !== null && dateKey >= todayKey;
    evenements.push({
      id: `prevue-${dateKey ?? "sans-date"}`,
      type: nonFaite ? "seance_prevue_non_faite" : "seance_prevue",
      dateKey,
      libelle: nonFaite
        ? "Séance prévue non réalisée"
        : aVenir
          ? "Séance prévue"
          : "Séance prévue (date passée)",
      contexte: seanceContexte({
        titre: prevue.titre,
        focus: prevue.focus,
        dureeMin: prevue.dureeMin,
        nbBlocs: prevue.nbBlocs,
      }),
      source: "moteur",
    });
  }

  // ── Ajustement MOTEUR : c'est FKS qui a allégé, pas le joueur ─────────────
  if (view.ajustementsMoteur.length > 0) {
    const dateKey = prevue?.dateKey ?? faiteKey ?? null;
    evenements.push({
      id: `ajustement-${dateKey ?? "sans-date"}`,
      type: "ajustement_moteur",
      dateKey,
      libelle: "Séance ajustée par FKS",
      contexte: view.ajustementsMoteur.join(", "),
      source: "moteur",
    });
  }

  // Plus récent d'abord ; les faits sans date passent en dernier (on ne les
  // place pas arbitrairement "aujourd'hui").
  return evenements.sort((a, b) => {
    if (a.dateKey && b.dateKey && a.dateKey !== b.dateKey) return compareDateKeysDesc(a.dateKey, b.dateKey);
    if (a.dateKey && !b.dateKey) return -1;
    if (!a.dateKey && b.dateKey) return 1;
    return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
  });
}

/** Date lisible d'un événement ("samedi 4 juillet"), ou repli honnête. */
export function timelineEventDateLabel(event: CoachTimelineEvent): string {
  if (!event.dateKey) return "Date inconnue";
  return formatDayFR(event.dateKey) || event.dateKey;
}
