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
  /**
   * Le conteneur anime de l'action du jour — le SEUL endroit du prototype ou un
   * mouvement peut apparaitre.
   *
   * Il porte un `transform` quand le joueur n'a pas demande moins d'animations,
   * et RIEN du tout quand il l'a demande. C'est ce que le test de non-regression
   * lit : sans marqueur, il faudrait deviner quel noeud de l'arbre inspecter, et
   * une boucle reintroduite ailleurs passerait inapercue.
   */
  mouvementAction: "home-vnext-mouvement-action",
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

  // ---------------------------------------------------------------------------
  // VARIANTES DE DEMARRAGE — l'ecran du nouveau joueur (V-A / V-B)
  // ---------------------------------------------------------------------------
  // Ajouts PUREMENT additifs, comme ceux de la variante 2 : aucun composant
  // deja valide ne les porte, donc aucun rendu existant ne bouge.

  /**
   * Le bloc de demarrage, quelle que soit sa variante. Present une seule fois
   * en V-A et en V-B, JAMAIS sur l'ecran actuel : c'est ce qui permet de
   * prouver que la bascule du visualiseur montre bien autre chose, au lieu de
   * reservir l'ecran d'origine sous une nouvelle etiquette.
   */
  demarrage: "home-vnext-demarrage",
  /**
   * Une ligne de premier pas (V-A). Il doit y en avoir EXACTEMENT autant que
   * `demarrage.premiersPas` en contient : une ligne de plus serait un pas que
   * le ViewModel n'a pas autorise.
   */
  demarragePas: "home-vnext-demarrage-pas",
  /**
   * La marque « fait » d'un premier pas. Son compte doit egaler le nombre de
   * pas dont `fait === true` — c'est ce qui interdit a la vue de cocher toute
   * seule une case que la donnee ne coche pas.
   */
  demarragePasFait: "home-vnext-demarrage-pas-fait",
  /** La ligne « pourquoi ce cycle » (V-A). Absente quand le ViewModel la met a `null`. */
  demarragePourquoiCycle: "home-vnext-demarrage-pourquoi-cycle",
  /**
   * Une ligne d'apercu (V-B). Meme regle de comptage que les premiers pas, et
   * meme raison : une section annoncee de plus serait une promesse inventee.
   */
  demarrageApercu: "home-vnext-demarrage-apercu",
  /**
   * L'action du jour EN TRAITEMENT HERO. N'existe que dans les variantes de
   * demarrage. Sans lui, un harnais qui rendrait l'ecran d'origine sous
   * l'etiquette « V-A » ne serait demasque que par la carte : ici, le
   * traitement typographique lui-meme est prouve.
   */
  actionHero: "home-vnext-action-hero",
  /**
   * Un intervalle de respiration variable de l'ecran de demarrage. Vide par
   * definition — il ne porte aucun texte et n'annonce rien.
   *
   * Il est marque pour une seule raison : c'est la seule facon de prouver qu'il
   * reste PLAFONNE. Un intervalle extensible sans plafond etalerait trois blocs
   * sur toute la hauteur d'une tablette, et un diff ne le montre pas.
   */
  respirationDemarrage: "home-vnext-respiration-demarrage",
} as const;

export type MarqueurNom = keyof typeof MARQUEURS;
