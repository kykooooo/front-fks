// domain/joinAccessPolicy.ts
//
// LES MOTS DE LA POLITIQUE DE RATTACHEMENT — et rien d'autre.
//
// ⚠️ AUCUN ÉCRAN N'UTILISE ENCORE CE FICHIER, ET C'EST DIT ICI PLUTÔT QUE CACHÉ.
// La politique `clubs/{clubId}.joinAccessPolicy` est aujourd'hui posée à la main
// (console Firebase) ou à la création du club : il n'existe AUCUN réglage coach
// dans l'application. Fabriquer un écran uniquement pour y poser une phrase
// aurait produit une interface morte — un bouton de plus à maintenir, sans
// besoin derrière. On pose donc la phrase, testée, prête à l'emploi ; l'écran
// viendra le jour où le besoin existera.
//
// ─── POURQUOI CETTE PHRASE EST OBLIGATOIRE ──────────────────────────────────
// La politique ne décide QUE de l'état d'autorisation posé sur un joueur au
// moment où il REJOINT le club. Elle ne touche aucun membre déjà rattaché — ni
// pour ouvrir, ni pour fermer (functions/src/joinAccessPolicy.ts, et
// `resolveCoachAccess` qui conserve tout état déjà posé). Un coach qui bascule
// le réglage en croyant fermer l'accès de son effectif se tromperait
// gravement : le libellé ci-dessous existe pour rendre ce malentendu
// impossible, et il doit accompagner le réglage PARTOUT où il apparaîtra.
//
// Fermer un accès déjà ouvert reste une opération explicite, joueur par joueur
// (état "revoked"). Une action groupée sur les membres existants pourra être
// ajoutée plus tard ; elle n'existe pas aujourd'hui.
//
// Le vocabulaire des deux modes n'est PAS redéclaré ici : la liste des valeurs
// vit côté serveur, seule source de vérité (functions/src/joinAccessPolicy.ts).
// Ce fichier ne porte que des mots d'affichage.

/**
 * LA phrase, au mot près. Elle dit la portée du réglage, et elle est verrouillée
 * par un test d'égalité stricte : la reformuler « pour faire plus court » fait
 * échouer la suite.
 */
export const JOIN_ACCESS_POLICY_SCOPE_LABEL =
  "S'applique aux prochains joueurs qui rejoignent le club";

/** Titre du réglage, le jour où il sera affiché. */
export const JOIN_ACCESS_POLICY_TITLE = "Rattachement des joueurs";

/**
 * Ce que fait chaque mode, dit au coach. Deux phrases qui parlent d'ENTRÉE
 * (« qui rejoint »), jamais de l'effectif déjà en place.
 */
export const JOIN_ACCESS_POLICY_MODE_LABELS = {
  automatic_safe_projection:
    "Un joueur qui rejoint avec un code valide apparaît directement dans ton effectif.",
  approval_required:
    "Un joueur qui rejoint entre dans l'effectif, mais son suivi reste fermé tant qu'une décision n'a pas été prise.",
} as const;

/**
 * Rappel à afficher à côté du réglage : ce que le changer NE FAIT PAS. Le
 * libellé de portée dit à qui ça s'applique ; celui-ci dit à qui ça ne
 * s'applique pas. Les deux sont nécessaires.
 */
export const JOIN_ACCESS_POLICY_NO_RETROACTION =
  "Changer ce réglage ne modifie aucun joueur déjà rattaché. Pour fermer un accès existant, il faut le retirer joueur par joueur.";

/** Toutes les phrases affichables, pour les vérifications de ton et de portée. */
export function joinAccessPolicyTexts(): string[] {
  return [
    JOIN_ACCESS_POLICY_TITLE,
    JOIN_ACCESS_POLICY_SCOPE_LABEL,
    ...Object.values(JOIN_ACCESS_POLICY_MODE_LABELS),
    JOIN_ACCESS_POLICY_NO_RETROACTION,
  ];
}
