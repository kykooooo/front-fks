// prototype/home-vnext/lib/devices.js
// =============================================================================
// LES QUATRE FORMATS, ET LE CALCUL DE LA ZONE VISIBLE
// =============================================================================
//
// Ce que l'utilisateur voit SANS DEFILER n'est pas la hauteur de l'ecran. Il
// faut retirer ce que le systeme et la navigation occupent :
//
//   hauteur disponible pour l'ecran = hauteur d'ecran - (tab bar + inset bas)
//   hauteur reellement LISIBLE      = hauteur disponible - inset haut
//
// Pourquoi cette distinction : l'ecran de l'app commence bien a y = 0 (le haut
// physique du telephone) — c'est lui qui dessine la marge d'encoche, via
// `components/ui/Screen.tsx` (`paddingTop: insets.top`). Le cadre du harnais
// represente donc TOUT l'ecran physique, et la premiere ligne de texte apparait
// `insetTop` px plus bas.
//
// La tab bar de React Navigation (`@react-navigation/bottom-tabs`) mesure 49 pt
// de contenu (constante UIKit) auxquels s'ajoute l'inset bas du telephone.
// Elle est dans le flux : l'ecran recoit donc `hauteur - (49 + insetBas)`.
//
// Valeurs d'insets : ce sont les valeurs iOS publiees par appareil. Elles ne
// sont pas mesurees sur le telephone de Kyllian — a verifier lors de la recette
// telephone, c'est note dans les limites du rapport.
// =============================================================================
"use strict";

/** Hauteur de contenu d'une tab bar iOS (constante UIKit reprise par React Navigation). */
const TAB_BAR_CONTENT = 49;

const RAW = [
  {
    width: 320,
    screenHeight: 568,
    insetTop: 20,
    insetBottom: 0,
    reference: "iPhone SE 1re generation / iPhone 5s — 320x568, pas d'encoche",
    note: "Le plus petit ecran encore utilise. C'est ici que les debordements se voient.",
  },
  {
    width: 375,
    screenHeight: 812,
    insetTop: 44,
    insetBottom: 34,
    reference: "iPhone X / XS / 11 Pro / 13 mini — 375x812",
    note: "Largeur de reference des captures et du mode cote a cote.",
  },
  {
    width: 390,
    screenHeight: 844,
    insetTop: 47,
    insetBottom: 34,
    reference: "iPhone 12 / 12 Pro / 13 / 14 — 390x844",
    note: "Le format le plus courant aujourd'hui.",
  },
  {
    width: 768,
    screenHeight: 1024,
    insetTop: 20,
    insetBottom: 0,
    reference: 'iPad 9,7" / 10,2" en portrait — 768x1024',
    note: "Verifie surtout qu'aucune carte ne s'etire de facon absurde en pleine largeur.",
  },
];

const DEVICES = RAW.map((d) => {
  const tabBarTotal = TAB_BAR_CONTENT + d.insetBottom;
  const stageVisible = d.screenHeight - tabBarTotal; // hauteur donnee a l'ecran
  const readable = stageVisible - d.insetTop; // hauteur reellement lisible
  return {
    ...d,
    tabBarContent: TAB_BAR_CONTENT,
    tabBarTotal,
    stageVisible,
    readable,
    /** Formule affichee telle quelle par le visualiseur. */
    calcul:
      `${d.screenHeight} (ecran) - ${TAB_BAR_CONTENT} (tab bar) - ${d.insetBottom} (inset bas) ` +
      `= ${stageVisible} px pour l'ecran, dont ${d.insetTop} px d'inset haut ` +
      `=> ${readable} px reellement lisibles sans defiler.`,
  };
});

const WIDTHS = DEVICES.map((d) => d.width);

/** Largeur a laquelle on genere aussi la variante texte agrandi. */
const SCALE_WIDTH = 375;
const TEXT_SCALE = 1.3;

function getDevice(width) {
  const found = DEVICES.find((d) => d.width === width);
  if (!found) throw new Error(`Largeur inconnue : ${width}`);
  return found;
}

module.exports = { DEVICES, WIDTHS, TAB_BAR_CONTENT, SCALE_WIDTH, TEXT_SCALE, getDevice };
