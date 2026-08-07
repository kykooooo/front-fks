// prototype/profil/lib/limites.js
// =============================================================================
// CE QUE LE HARNAIS NE REPRODUIT PAS — A DIRE, PAS A CACHER
// =============================================================================
// Ce fichier est affiche tel quel dans l'onglet « Limites » du visualiseur.
// Regarder un ecran sans savoir ce qui est faux dedans, c'est valider une
// illusion.
// =============================================================================
"use strict";

const LIMITES = [
  {
    quoi: "Le cote a cote",
    detail:
      "Le cote a cote alimente le Profil actuel par des STORES BOUCHONNES — les approximations " +
      "sont listees dans lib/scenariosProfil.js (et reprises plus bas dans ce panneau). Les deux " +
      "colonnes racontent la meme histoire de joueur, mais la production lit ses stores et " +
      "AsyncStorage, pas un ViewModel : l'equivalence est construite, pas mesuree.",
  },
  {
    quoi: "Les icones",
    detail:
      "La police d'icones n'est pas chargeable ici. Chaque icone est remplacee par un carre " +
      "arrondi de la TAILLE et de la COULEUR exactes demandees. La place occupee est donc juste ; " +
      "le dessin, non. Ne juge pas le choix des pictogrammes sur ces pages.",
  },
  {
    quoi: "Les polices",
    detail:
      "La police systeme de la machine remplace San Francisco. Les largeurs de mots peuvent donc " +
      "varier de quelques pourcents : un texte tout juste a la limite ici peut passer sur " +
      "telephone, et l'inverse est vrai aussi.",
  },
  {
    quoi: "Le texte x1,3",
    detail:
      "Le texte x1,3 est une SIMULATION : on multiplie les tailles de police et les interlignes " +
      "du CSS. Le vrai Dynamic Type d'iOS fait davantage — il redistribue aussi certaines marges " +
      "et peut basculer des mises en page. Un ecran qui tient ici peut encore casser sur telephone.",
  },
  {
    quoi: "Le mouvement",
    detail:
      "Toutes les animations sont figees a leur etat d'arrivee (le harnais force « mouvement " +
      "reduit » et rend le Profil vNext avec reduceMotion actif). Le stagger d'entree du Profil " +
      "de production, lui, tourne quand meme — il ne consulte pas le reglage, c'est un fait du " +
      "produit : une capture prise pendant son fondu peut etre legerement translucide. Ce harnais " +
      "sert a juger la mise en page et la hierarchie, pas le mouvement.",
  },
  {
    quoi: "Le defilement",
    detail:
      "En vue « zone visible », la coupe est reelle : la zone de defilement coupe toute seule, " +
      "comme sur le telephone. En vue « page entiere », les conteneurs de mise en page sont " +
      "neutralises pour tout voir d'un coup — c'est une vue d'exploration, pas ce que voit le joueur.",
  },
  {
    quoi: "Les insets d'ecran",
    detail:
      "Les marges d'encoche et de barre d'accueil sont les valeurs iOS publiees par appareil " +
      "(20 / 44 / 47 en haut, 0 / 34 en bas). Elles ne sont pas mesurees sur un telephone reel. " +
      "A confirmer lors de la recette telephone.",
  },
  {
    quoi: "Les hauteurs",
    detail:
      "Le moteur de rendu hors navigateur (jsdom) n'a AUCUN calcul de mise en page : le manifeste " +
      "publie donc hauteur = 0 pour chaque page, avec cette raison. Le visualiseur, lui, mesure " +
      "la hauteur REELLE de la page chargee dans son cadre (meme origine) et l'affiche dans " +
      "l'onglet « Cet etat » — c'est cette mesure-la qu'il faut lire.",
  },
  {
    quoi: "Les mesures a l'ecran (onLayout)",
    detail:
      "Toute mesure onLayout vaut zero en jsdom. On sert donc une largeur calculee a la main " +
      "(largeur d'ecran moins 64 px de marges) aux composants qui se mesurent. Si un composant " +
      "se mesure autrement, sa largeur sera fausse ici.",
  },
  {
    quoi: "Les donnees",
    detail:
      "Tout est invente. Aucun compte reel, aucun acces Firestore, aucun appel au backend. Les " +
      "7 etats viennent de screens/profilVNext/fixtures.ts ; les scenarios du Profil actuel en " +
      "sont DERIVES (lib/scenariosProfil.js) pour que le cote a cote compare la meme histoire.",
  },
  {
    quoi: "La barre d'onglets",
    detail:
      "Le rectangle du bas est un dessin du harnais, pas la vraie barre de l'app. Il est a la " +
      "bonne hauteur (49 px de contenu + l'inset bas du telephone) et sert uniquement a montrer " +
      "ce qu'elle recouvre. L'onglet actif dessine est « Profil ».",
  },
];

/**
 * Ce qui a ete remplace, et si le remplacement est fidele ou non.
 * `fidele: true`  -> la mise en page reste juste, on peut juger dessus.
 * `fidele: false` -> l'apparence differe, ne pas juger cet aspect ici.
 */
const STUBS_DECRITS = [
  { module: "react-native", remplace: "react-native-web", fidele: true, note: "C'est le principe meme du rendu web : memes composants, meme modele de mise en page." },
  { module: "@expo/vector-icons", remplace: "carre arrondi a la taille exacte", fidele: false, note: "Metrique juste, dessin faux." },
  { module: "react-native-safe-area-context", remplace: "insets pilotes par le format choisi", fidele: true, note: "20/44/47 en haut, 0/34 en bas selon l'appareil simule." },
  { module: "@react-navigation/native", remplace: "navigation inerte", fidele: true, note: "Aucun ecran ne s'ouvre ; les appels sont enregistres." },
  { module: "react-native-reanimated", remplace: "vues simples, valeurs a l'arrivee", fidele: false, note: "Aucun mouvement." },
  { module: "react-native-gesture-handler", remplace: "vues simples", fidele: false, note: "Aucun geste." },
  { module: "expo-blur", remplace: "vue transparente", fidele: false, note: "Aucun flou." },
  { module: "expo-linear-gradient", remplace: "aplat de la premiere couleur", fidele: false, note: "Degrade non reproduit." },
  { module: "expo-haptics", remplace: "rien", fidele: false, note: "Aucun retour haptique dans un navigateur." },
  { module: "services/firebase", remplace: "objet inerte (uid harnais-uid)", fidele: true, note: "GARANTIE : aucun acces production possible." },
  { module: "services/analytics · monitoring · notifications", remplace: "fonctions inertes", fidele: true, note: "Aucun evenement envoye." },
  { module: "state/stores/* et state/settingsStore", remplace: "etat fictif du scenario", fidele: true, note: "Les hooks a selecteur se comportent comme les vrais — lib/scenariosProfil.js liste ce qu'on y met." },
  { module: "@react-native-async-storage/async-storage", remplace: "memoire volatile, re-semee a chaque rendu", fidele: true, note: "Rien n'est ecrit sur le disque ; les tests terrain y sont semes sous la cle exacte que readTestsRaw lit." },
];

module.exports = { LIMITES, STUBS_DECRITS };
