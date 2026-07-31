// functions/src/index.ts
// Point d'entrée des Cloud Functions FKS : triggers de projection coach-safe
// + callable de suppression de compte (exigence Apple/Google). Le backfill
// (backfill.ts) est un script Admin one-shot, volontairement NON exporté ici
// (jamais déployé comme fonction).

export {
  onMemberWritten,
  onUserWritten,
  onSessionWritten,
  onPlannedSessionWritten,
} from "./triggers";

export { deleteAccount } from "./deleteAccount";
