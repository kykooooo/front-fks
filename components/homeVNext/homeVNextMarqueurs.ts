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

  // ---------------------------------------------------------------------------
  // VARIANTE 2 — la carte "Ma progression"
  // ---------------------------------------------------------------------------
  // Ajouts PUREMENT additifs : aucun composant de la variante 1 ne les porte,
  // donc aucun rendu existant n'est modifie.

  /**
   * La carte progression. Presente une seule fois en variante 2, JAMAIS en
   * variante 1 : c'est ce qui permet de prouver automatiquement que les deux
   * variantes sont bien distinctes.
   */
  progression: "home-vnext-progression",
  /**
   * Le pied "Voir ma progression". Il ne doit exister QUE si le ViewModel l'autorise
   * (`detail.affiche`), c'est-a-dire uniquement dans l'etat "ready".
   */
  progressionDetail: "home-vnext-progression-detail",
  /**
   * Une ligne de fait mesure. Le compter permet de verifier R1 : sur la fixture
   * "donnee-manquante", il doit y en avoir 2 et non 4.
   */
  progressionFait: "home-vnext-progression-fait",
  /** La comparaison de test terrain (le bloc, pas la ligne). */
  progressionTest: "home-vnext-progression-test",
  /** La ligne de portee de la courbe (R3). Doit exister des qu'une courbe existe. */
  progressionPortee: "home-vnext-progression-portee",
} as const;

export type MarqueurNom = keyof typeof MARQUEURS;
