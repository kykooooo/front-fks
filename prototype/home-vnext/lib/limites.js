// prototype/home-vnext/lib/limites.js
// =============================================================================
// CE QUE LE HARNAIS NE REPRODUIT PAS — A DIRE, PAS A CACHER
// =============================================================================
// Ce fichier est affiche tel quel dans le panneau « Seuils et limites » du
// visualiseur. Regarder un ecran sans savoir ce qui est faux dedans, c'est
// valider une illusion.
// =============================================================================
"use strict";

const LIMITES = [
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
      "iOS utilise San Francisco, le navigateur utilise la police systeme de la machine. Les " +
      "largeurs de mots peuvent donc varier de quelques pourcents. Un texte tout juste a la limite " +
      "ici peut passer sur telephone, et l'inverse est vrai aussi.",
  },
  {
    quoi: "Le mouvement",
    detail:
      "Toutes les animations sont figees a leur etat d'arrivee (le harnais force « mouvement " +
      "reduit »). Les fondus d'entree, la pulsation du bouton, le glissement des modales ne se " +
      "voient pas. Ce harnais sert a juger la mise en page et la hierarchie, pas le mouvement.",
  },
  {
    quoi: "Le reglage « reduire les animations »",
    detail:
      "Il ne SE VOIT PAS, et c'est exactement le resultat voulu : au repos, un ecran sans " +
      "animation est identique a un ecran avec animation. Une capture ne peut donc pas en rendre " +
      "compte. Ce qui se prouve est dans le balisage, et le visualiseur le compte pour toi " +
      "(onglet « Cet etat ») : le bouton du jour porte une consigne de mouvement dans un cas, " +
      "aucune dans l'autre. Ne cherche pas la difference a l'oeil, elle n'y est pas.",
  },
  {
    quoi: "Les plafonds d'agrandissement du texte",
    detail:
      "Sur telephone, trois textes d'affichage cessent de grandir a un moment (la salutation, le " +
      "libelle du bouton du jour, les titres de section) : ce sont les seuls, tout le reste " +
      "grandit sans limite. Le moteur de rendu web ne transmet PAS ces plafonds. Les pages " +
      "« x1,3 » de ce visualiseur montrent donc le PIRE CAS, sans aucun plafond : la vraie page " +
      "sera moins etiree que celle-ci, jamais plus. Si la mise en page tient ici, elle tient sur " +
      "telephone.",
  },
  {
    quoi: "La comparaison avant / apres de la carte progression",
    detail:
      "Cinq choses ont change depuis la version validee. UNE SEULE est rejouable par une bascule : " +
      "la typographie, parce que l'ancienne echelle a ete conservee expres. Les quatre autres ont " +
      "REMPLACE ce qui existait — l'ancien selecteur de test a ete supprime, les anciennes dates " +
      "de fixture aussi. Le harnais ne les rejoue donc pas : il les CHIFFRE a cote (onglet " +
      "« Valider », section avant / apres, et onglet « La regle » pour le test mis en avant). " +
      "Fabriquer une fausse page « avant » en recopiant a la main le comportement suppose de " +
      "l'ancien code serait exactement l'erreur que cette iteration corrige.",
  },
  {
    quoi: "Deux generations ne donnent pas EXACTEMENT le meme resultat — et on sait pourquoi",
    detail:
      "Verifie : deux generations successives produisent des fichiers rigoureusement identiques " +
      "pour la proposition et pour la carte progression. Les seules pages qui different sont " +
      "celles du Home de PRODUCTION, et toujours au meme endroit : la valeur d'echelle de son " +
      "bouton principal, qui joue une pulsation en boucle sans consulter le reglage « reduire les " +
      "animations ». La capture l'attrape a un endroit different a chaque fois. Ce n'est donc pas " +
      "un defaut du harnais mais un defaut du produit, mis au jour par la verification — il est " +
      "chiffre dans ce meme panneau. Hors perimetre, non corrige ici.",
  },
  {
    quoi: "Le Home de production et l'axe typographie",
    detail:
      "L'ecran de production n'a ni reglage d'echelle ni prise en compte de « reduire les " +
      "animations » : il n'a qu'une typographie, la sienne. Sa colonne reste donc sur la " +
      "presentation par defaut quel que soit le reglage choisi, et le cadre le dit. Ce n'est pas " +
      "un manque du harnais, c'est un fait du produit.",
  },
  {
    quoi: "Le flou",
    detail:
      "Les fonds floutes (expo-blur) sont rendus transparents. Aucun effet de verre depoli.",
  },
  {
    quoi: "Le defilement",
    detail:
      "En vue « zone visible », la coupe est reelle : la zone de defilement coupe toute seule, " +
      "comme sur le telephone. En vue « page entiere », les conteneurs de mise en page sont " +
      "neutralises pour tout voir d'un coup — c'est une vue d'exploration, pas ce que voit le joueur.",
  },
  {
    quoi: "Le texte agrandi x1,3",
    detail:
      "SIMULATION. On multiplie les tailles de police et les interlignes du CSS. Le vrai Dynamic " +
      "Type d'iOS fait davantage : il redistribue aussi certaines marges et peut basculer des " +
      "mises en page. Un ecran qui tient ici peut encore casser sur telephone.",
  },
  {
    quoi: "Les insets d'ecran",
    detail:
      "Les marges d'encoche et de barre d'accueil sont les valeurs iOS publiees par appareil " +
      "(20 / 44 / 47 en haut, 0 / 34 en bas). Elles ne sont pas mesurees sur un telephone reel. " +
      "A confirmer lors de la recette telephone.",
  },
  {
    quoi: "Les mesures a l'ecran (onLayout)",
    detail:
      "Le moteur de rendu hors navigateur n'a aucun calcul de mise en page : toute mesure vaut " +
      "zero. On sert donc une largeur calculee a la main (largeur d'ecran moins 64 px de marges) " +
      "aux composants qui se mesurent, typiquement une courbe. Si un composant se mesure autrement, " +
      "sa largeur sera fausse ici.",
  },
  {
    quoi: "Les donnees",
    detail:
      "Tout est invente. Aucun compte reel, aucun acces Firestore, aucun appel au backend, aucune " +
      "generation de seance. Les 14 etats viennent de screens/homeVNext/fixtures.ts, les etats du " +
      "Home actuel de scenarios ecrits pour l'audit.",
  },
  {
    quoi: "L'assemblage de la variante 2",
    detail:
      "La carte progression a ete ecrite avec ses propres jeux de donnees, sans ecran d'accueil " +
      "autour. Pour la regarder en place, le harnais la pose sur un ecran existant. Le choix de " +
      "l'ecran garantit toujours une chose : le nombre affiche par « Ma semaine » est exactement " +
      "celui contre lequel la carte s'est protegee. Sur trois des sept cas, quelque chose d'autre " +
      "ne concorde pas (deux courbes qui ne tracent pas la meme serie, ou deux comptes de seances " +
      "differents) : c'est ecrit en rouge sur l'etat concerne et detaille dans « Cet etat ». " +
      "Un ecart ainsi signale vient de l'assemblage du prototype, pas d'une proposition de produit.",
  },
  {
    quoi: "La barre d'onglets",
    detail:
      "Le rectangle du bas est un dessin du harnais, pas la vraie barre de l'app. Il est a la " +
      "bonne hauteur (49 px de contenu + l'inset bas du telephone) et sert uniquement a montrer ce " +
      "qu'elle recouvre.",
  },
];

/**
 * Ce qui a ete remplace, et si le remplacement est fidele ou non.
 * `fidele: true`  -> la mise en page reste juste, on peut juger dessus.
 * `fidele: false` -> l'apparence differe, ne pas juger cet aspect ici.
 */
const STUBS_DECRITS = [
  { module: "react-native", remplace: "react-native-web", fidele: true, note: "C'est le principe meme du rendu web : memes composants, meme modele de mise en page." },
  { module: "react-native-svg", remplace: "elements SVG du navigateur", fidele: true, note: "La geometrie est calculee par le code du produit : la courbe affichee est la vraie." },
  { module: "@expo/vector-icons", remplace: "carre arrondi a la taille exacte", fidele: false, note: "Metrique juste, dessin faux." },
  { module: "react-native-safe-area-context", remplace: "insets pilotes par le format choisi", fidele: true, note: "20/44/47 en haut, 0/34 en bas selon l'appareil simule." },
  { module: "@react-navigation/native", remplace: "navigation inerte", fidele: true, note: "Aucun ecran ne s'ouvre ; les appels sont enregistres." },
  { module: "@react-navigation/elements", remplace: "contexte de header a undefined", fidele: true, note: "Reproduit le cas reel : le Home vit dans un onglet sans header." },
  { module: "react-native-reanimated", remplace: "vues simples, valeurs a l'arrivee", fidele: false, note: "Aucun mouvement." },
  { module: "react-native-gesture-handler", remplace: "vues simples", fidele: false, note: "Aucun geste." },
  { module: "expo-blur", remplace: "vue transparente", fidele: false, note: "Aucun flou." },
  { module: "expo-linear-gradient", remplace: "aplat de la premiere couleur", fidele: false, note: "Degrade non reproduit." },
  { module: "expo-image", remplace: "rectangle gris", fidele: false, note: "Aucune image chargee (aucun acces reseau)." },
  { module: "expo-haptics", remplace: "rien", fidele: false, note: "Aucun retour haptique dans un navigateur." },
  { module: "services/firebase", remplace: "objet inerte", fidele: true, note: "GARANTIE : aucun acces production possible." },
  { module: "services/analytics · monitoring · notifications", remplace: "fonctions inertes", fidele: true, note: "Aucun evenement envoye." },
  { module: "state/stores/* et state/settingsStore", remplace: "etat fictif du scenario", fidele: true, note: "Les hooks a selecteur se comportent comme les vrais." },
  { module: "@react-native-async-storage/async-storage", remplace: "memoire volatile", fidele: true, note: "Rien n'est ecrit sur le disque." },
];

module.exports = { LIMITES, STUBS_DECRITS };
