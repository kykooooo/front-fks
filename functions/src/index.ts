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
//
// Et même chose, une troisième fois, pour la MIGRATION DES ANCIENNES NOTES de
// coach hors du document lu par les joueurs, ainsi que pour sa commande de
// vérification. Deux scripts one-shot, JAMAIS exécutés, JAMAIS déployés —
// procédure dans docs/coach-pilote-2026-07/MIGRATION_NOTES.md. Une écriture en
// masse ne doit avoir aucune route réseau : pas de callable, pas de drapeau
// dans une charge utile.

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

// Retrait d'un membre du club : 100 % serveur également. Révoquer un code
// n'expulse personne — l'accès repose sur l'EXISTENCE du document de membre, et
// seule cette callable sait le désactiver, supprimer la projection déjà produite
// et nettoyer la référence du joueur vers son club, le tout en une transaction.
export { removeClubMember } from "./clubMembersApi";

// Transfert de propriété du club : 100 % serveur, une seule transaction pour la
// désignation (`ownerUid`), le rôle du nouveau propriétaire et celui de l'ancien.
// Les règles refusent volontairement de promouvoir quelqu'un d'autre depuis un
// client — il n'existe aucune autre porte que celle-ci.
//
// L'OUTIL ADMINISTRATEUR (`clubOwnershipCli.ts`) n'est PAS exporté ici, et ne
// doit jamais l'être : il saute la vérification d'autorité de l'appelant, parce
// qu'il sert précisément les clubs où PERSONNE n'est autorisé (autorité
// incohérente). Un tel chemin ne doit avoir aucune route réseau. Procédure dans
// docs/coach-pilote-2026-07/TRANSFERT_PROPRIETE.md.
export { transferClubOwnership } from "./clubOwnershipApi";
