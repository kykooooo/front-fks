// functions/src/index.ts
// Point d'entrée des Cloud Functions FKS. N'exporte QUE les triggers de
// projection coach-safe. Le backfill (backfill.ts) est un script Admin one-shot,
// volontairement NON exporté ici (jamais déployé comme fonction).

export {
  onMemberWritten,
  onUserWritten,
  onSessionWritten,
  onPlannedSessionWritten,
} from "./triggers";
