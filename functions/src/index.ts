// functions/src/index.ts
// Point d'entrée des Cloud Functions FKS : triggers de projection coach-safe
// + callable de suppression de compte (exigence Apple/Google) + les deux
// callables du contrat d'invitation club (émission / rattachement). Le backfill
// (backfill.ts) est un script Admin one-shot, volontairement NON exporté ici
// (jamais déployé comme fonction).

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
