// functions/src/index.ts
// Point d'entrée des Cloud Functions FKS : triggers de projection coach-safe
// + callable de suppression de compte (exigence Apple/Google) + les deux
// callables du contrat d'invitation club (émission / rattachement). Le backfill
// (backfill.ts) est un script Admin one-shot, volontairement NON exporté ici
// (jamais déployé comme fonction).
//
// Même chose pour `coachAccessBackfillCli.ts` (mise à niveau des membership
// existants vers l'état d'autorisation d'accès) : script one-shot, JAMAIS
// exécuté à ce jour, JAMAIS déployé — procédure dans
// docs/coach-pilote-2026-07/AUTORISATION_ACCES.md.

export {
  onMemberWritten,
  onUserWritten,
  onSessionWritten,
  onPlannedSessionWritten,
} from "./triggers";

export { deleteAccount } from "./deleteAccount";

// Contrat d'invitation club : vérification 100 % serveur. Le front ne peut plus
// résoudre un code, ni écrire un membership "player" (cf. firestore.rules).
export { issueClubInviteCode, joinClubWithInviteCode } from "./clubInvites";
