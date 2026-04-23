// shared/SAFETY_PHRASES.ts
//
// ══════════════════════════════════════════════════════════════════════════
// ⚠️  FICHIER PARTAGÉ FRONT ↔ BACK — DOIT RESTER STRICTEMENT IDENTIQUE
// ══════════════════════════════════════════════════════════════════════════
//
// Les deux repos FKS ont leur propre copie de ce fichier :
//   • Frontend  : C:/Users/Gamer/front-fks/shared/SAFETY_PHRASES.ts
//   • Backend   : C:/Users/Gamer/fks/src/shared/SAFETY_PHRASES.ts
//
// Ces deux copies DOIVENT être identiques byte à byte.
// /sync-check point #7 : vérifier l'égalité avant tout déploiement.
//
// Phrases de sécurité utilisées à la fois côté UI joueur (bannières,
// cartes d'alerte, boutons) et côté backend (prompts agents A/B, charte
// comportementale IA — voir C:/Users/Gamer/fks/INJURY_IA_CHARTER.md).
//
// Modification d'une phrase :
//   1. Vérifier qu'aucun mot banni n'est introduit (diagnostic, pathologie,
//      symptôme, traiter, soigner, lésion, médical sauf disclaimer).
//   2. Synchroniser front + back (byte à byte).
//   3. Si la phrase apparaît aussi dans INJURY_IA_CHARTER.md (règles 5, 6,
//      7), synchroniser le markdown.
// ══════════════════════════════════════════════════════════════════════════

export const SAFETY_PHRASES = {
  GENERAL_DISCLAIMER: "FKS n'établit pas de diagnostic. En cas de doute ou de douleur qui persiste, consulte un professionnel de santé.",
  PAIN_SPIKE_ALERT: "Ta douleur a nettement augmenté. Prends le temps de vérifier l'état de ta zone sensible. Si la douleur persiste ou s'aggrave, consulte un professionnel de santé.",
  REST_VALIDATION: "Parfait, à demain. Le repos est un vrai travail quand le corps en a besoin.",
  SESSION_FOOTER_WARNING: "Si ta gêne augmente pendant ou après cette séance, arrête et consulte un professionnel de santé.",
  INJURY_PROGRESS_SUGGESTION: "Tu as noté une gêne en baisse ces derniers jours. Tu veux réévaluer ta zone sensible ?",
} as const;

export type SafetyPhraseKey = keyof typeof SAFETY_PHRASES;
