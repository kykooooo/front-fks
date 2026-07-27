// components/homeVNext/homeVNextMarqueurs.ts
// =============================================================================
// MARQUEURS STABLES POUR LA VERIFICATION AUTOMATIQUE
// =============================================================================
//
// Pourquoi ce fichier existe : la doctrine du prototype contient des regles qui
// ne se verifient pas a l'oeil. « Une seule action principale par ecran » se
// verifie en COMPTANT, sur les 14 etats et les 4 largeurs — soit 56 ecrans.
// L'oeil se trompe, le compteur non.
//
// Chaque marqueur est pose par un composant via la prop `testID` :
//   - dans l'app et dans les tests, c'est `testID` (React Native) ;
//   - dans le HTML genere par le harnais, react-native-web le traduit en
//     `data-testid`.
// Le meme nom sert donc aux deux, et il n'existe qu'ici.
//
// REGLE : ces marqueurs ne portent AUCUN style et ne changent AUCUN rendu. Les
// retirer ne modifierait pas un pixel — ils ne servent qu'a prouver.
// =============================================================================

export const MARQUEURS = {
  /**
   * L'emplacement de l'action du jour, quelle que soit sa forme (aplat colore
   * ou accuse de reception). Il doit y en avoir EXACTEMENT UN par ecran :
   * c'est la doctrine 1, et c'est ce que compte le verificateur.
   */
  actionPrincipale: "home-vnext-action-principale",
  /** L'aplat colore. Il ne peut y en avoir qu'un sur tout l'ecran. */
  aplat: "home-vnext-aplat",
  /** L'accuse de reception (journee faite) : pas un bouton, pas tapable. */
  accuseReception: "home-vnext-accuse-reception",
  /** Le lien secondaire sous l'action. Toujours un lien, jamais un aplat. */
  lienSecondaire: "home-vnext-lien-secondaire",
  /** Le lien de sortie en bas d'ecran. */
  lienSortie: "home-vnext-lien-sortie",
  /** La pastille d'etat du jour — SEULE mention de l'etat sur tout l'ecran. */
  etatDuJour: "home-vnext-etat-du-jour",
  /** Le trace de tendance. Ne doit exister QUE si `form.kind === "available"`. */
  courbe: "home-vnext-courbe",
  /** Le bloc "pas assez de donnees pour une tendance". */
  formeInsuffisante: "home-vnext-forme-insuffisante",
  /** Le bloc "Ma semaine". */
  semaine: "home-vnext-semaine",
  /** Le conseil. */
  conseil: "home-vnext-conseil",
  /** L'avis hors-ligne. */
  avisDonnees: "home-vnext-avis-donnees",
  /** Le squelette d'hydratation. */
  squelette: "home-vnext-squelette",
} as const;

export type MarqueurNom = keyof typeof MARQUEURS;
