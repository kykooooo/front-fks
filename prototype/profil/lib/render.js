// prototype/profil/lib/render.js
// =============================================================================
// MOTEUR DE RENDU — UN SEUL PIPELINE POUR LES DEUX ECRANS
// =============================================================================
// `renderActuel` (le Profil de production) et `renderProfilVNext` (la
// proposition) partagent exactement le meme montage : meme jsdom, meme
// react-native-web, memes stubs, meme temps de stabilisation, meme extraction.
// La seule difference est ce qu'on monte et comment on lui donne ses donnees
// (stores bouchonnes d'un cote, ViewModel de l'autre).
//
// C'est la condition pour que la comparaison veuille dire quelque chose : si les
// deux ecrans passaient par des chaines differentes, un ecart pourrait venir du
// harnais et non du produit.
// =============================================================================
"use strict";

require("./hook");

// ORDRE CRITIQUE : le DOM (jsdom) doit exister AVANT le premier chargement de
// react-native-web. Sa feuille de style s'initialise a l'import : sans document,
// elle bascule en mode « serveur » et n'injecte plus jamais ses regles dans la
// page — on se retrouve alors avec des captures sans aucun style.
const {
  document: doc,
  setAssumedLayout,
  observedNodes,
  resetObservedNodes,
  reinjecterLineClamp,
} = require("./dom");

const path = require("path");
const React = require("react");
const RNW = require("react-native-web");

const { APP_ROOT } = require("./paths");
const safeArea = require("./stubs/safe-area-context");
const scenarioState = require("./stubs/scenarioState");
const scenariosProfil = require("./scenariosProfil");

// Determinisme : on force « mouvement reduit ». Le Profil de production joue
// quand meme son stagger d'entree (il ne consulte pas le reglage — c'est un fait
// du produit, pas du harnais) mais tout ce qui le consulte reste immobile.
RNW.AccessibilityInfo.isReduceMotionEnabled = async () => true;

/** Temps laisse aux effets pour se stabiliser (surchargeable : FKS_SETTLE). */
const SETTLE_MS = Number(process.env.FKS_SETTLE || 900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Chargement paresseux des ecrans
// ---------------------------------------------------------------------------
function chargerModule(relatif) {
  try {
    const mod = require(path.join(APP_ROOT, relatif));
    const Comp = mod && (mod.default || mod[Object.keys(mod).find((k) => /Screen$/.test(k))]);
    if (typeof Comp !== "function") {
      return { ok: false, raison: "export_absent", detail: `Exports trouves : ${Object.keys(mod || {}).join(", ") || "(aucun)"}` };
    }
    return { ok: true, Comp };
  } catch (err) {
    return {
      ok: false,
      raison: err && err.code === "MODULE_NOT_FOUND" && String(err.message).includes(relatif.split("/").pop())
        ? "fichier_absent"
        : "erreur_chargement",
      detail: (err && (err.stack || err.message)) || String(err),
    };
  }
}

let cacheActuel = null;
function getProfilActuel() {
  if (!cacheActuel) cacheActuel = chargerModule("screens/ProfileScreen.tsx");
  return cacheActuel;
}

let cacheVNext = null;
function getProfilVNext() {
  if (!cacheVNext) cacheVNext = chargerModule("screens/profilVNext/ProfilVNextScreen.tsx");
  return cacheVNext;
}

let cacheViewModel = null;
function getViewModelModule() {
  if (!cacheViewModel) {
    try {
      cacheViewModel = { ok: true, mod: require(path.join(APP_ROOT, "screens/profilVNext/viewModel.ts")) };
    } catch (err) {
      cacheViewModel = { ok: false, detail: (err && err.stack) || String(err) };
    }
  }
  return cacheViewModel;
}

/**
 * Le marqueur qui prouve que la page servie est bien le Profil vNext. Il vient
 * du PRODUIT (`profilVNextMarqueurs.ts`), jamais d'une chaine recopiee : si le
 * marqueur change la-bas, le harnais suit — ou echoue en le disant.
 */
let cacheMarqueurs = null;
function getMarqueurEcran() {
  if (!cacheMarqueurs) {
    try {
      const mod = require(path.join(APP_ROOT, "components/profilVNext/profilVNextMarqueurs.ts"));
      cacheMarqueurs = { ok: true, ecran: mod.PROFIL_MARQUEURS.ecran };
    } catch (err) {
      cacheMarqueurs = {
        ok: false,
        // Repli DOCUMENTE : la valeur du contrat au moment ou ce harnais a ete
        // ecrit. Si le module est illisible, le controle mesure encore quelque
        // chose — et le detail de l'erreur est conserve.
        ecran: "profil-vnext-ecran",
        detail: (err && (err.stack || err.message)) || String(err),
      };
    }
  }
  return cacheMarqueurs;
}

/** Compte les occurrences d'un `data-testid` dans un fragment de HTML. */
function compterMarqueur(html, marqueur) {
  const re = new RegExp('data-testid="' + marqueur + '"', "g");
  return (String(html || "").match(re) || []).length;
}

// ---------------------------------------------------------------------------
// Reperage de la structure
// ---------------------------------------------------------------------------
// On descend tant qu'il n'y a qu'un seul enfant : ce sont les conteneurs de
// mise en page (racine react-native-web, safe area, zone de defilement). On les
// marque `data-fks="chain"` — c'est eux, et eux seuls, que la vue « page
// entiere » neutralise. Le premier noeud a plusieurs enfants est le CONTENU.
// ---------------------------------------------------------------------------
function tagStructure(root) {
  const chain = [];
  let node = root;
  for (let i = 0; i < 14; i += 1) {
    const kids = Array.from(node.children);
    if (kids.length === 1) {
      node = kids[0];
      chain.push(node);
      continue;
    }
    if (kids.length === 2) {
      const idx = kids.findIndex((k) => (k.textContent || "").includes("Hors-ligne"));
      if (idx !== -1) {
        kids[idx].setAttribute("data-fks", "bandeau-hors-ligne");
        node = kids[1 - idx];
        chain.push(node);
        continue;
      }
    }
    break;
  }
  chain.forEach((el) => el.setAttribute("data-fks", "chain"));
  node.setAttribute("data-fks", "content");
  const blocs = Array.from(node.children);
  blocs.forEach((el, i) => el.setAttribute("data-fks-bloc", String(i + 1)));
  return {
    chainLength: chain.length,
    blocs: blocs.map((el, i) => ({
      i: i + 1,
      texte: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
    })),
  };
}

// ---------------------------------------------------------------------------
// Montage
// ---------------------------------------------------------------------------
async function monter({ cle, element, device }) {
  safeArea.setInsets({
    top: device.insetTop,
    bottom: device.insetBottom,
    width: device.width,
    height: device.screenHeight,
  });
  // Mesure servie aux `onLayout` : largeur d'ecran moins la marge d'ecran (2x16)
  // et le padding de carte (2x16). Approximation documentee dans dom.js.
  setAssumedLayout({ width: Math.max(120, device.width - 64), height: 90 });
  resetObservedNodes();

  const container = doc.createElement("div");
  container.id = `root_${cle}`;
  doc.body.appendChild(container);

  const erreurs = [];
  const Root = () => element;

  RNW.AppRegistry.registerComponent(cle, () => Root);
  try {
    RNW.AppRegistry.runApplication(cle, { rootTag: container, initialProps: {} });
  } catch (err) {
    erreurs.push((err && err.stack) || String(err));
  }

  await sleep(SETTLE_MS);

  let structure = { chainLength: 0, blocs: [] };
  try {
    structure = tagStructure(container);
  } catch (err) {
    erreurs.push(`Reperage de structure impossible : ${String(err)}`);
  }

  // `numberOfLines` doit exister dans le balisage capture. jsdom perd la
  // propriete en silence : on la repose avant de figer le HTML. Sans cette
  // ligne, tous les textes bornes s'affichent en entier et les hauteurs
  // mesurees sont fausses. Voir l'explication complete dans lib/dom.js.
  let textesBornes = 0;
  try {
    textesBornes = reinjecterLineClamp(container);
  } catch (err) {
    erreurs.push(`Re-injection de numberOfLines impossible : ${String(err)}`);
  }

  const html = container.innerHTML;

  try {
    RNW.AppRegistry.unmountApplicationComponentAtRootTag(container);
  } catch (_) {
    /* sans consequence : le conteneur est retire juste apres */
  }
  container.remove();

  return {
    html,
    sonde: {
      ...structure,
      noeudsMesures: observedNodes.size,
      textesBornes,
      longueurTexte: html.replace(/<[^>]*>/g, "").trim().length,
      erreurs,
    },
  };
}

// ---------------------------------------------------------------------------
// Variante A — le Profil vNext (controle pur / controle informe)
// ---------------------------------------------------------------------------
// L'ecran a un contrat CONNU (il est deja ecrit et teste) : il prend `vm`, le
// ViewModel deja construit — jamais l'input. La variante est decidee PAR LE
// SELECTEUR (`{ variante }`), pas par une prop d'ecran : l'ecran a une seule
// forme, une ligne sans fait est simplement plus courte.
//
// LE PIEGE, ET LA PARADE
// -----------------------------------------------------------------------------
// Si l'ecran cassait — export renomme, marqueur retire, exception avalee par un
// boundary — le harnais pourrait servir une page vide ou un autre ecran sous
// l'etiquette « Profil vNext ». On se protege par une MESURE : apres le rendu,
// on cherche le marqueur de racine (`profil-vnext-ecran`) dans le HTML produit.
// Absent, la page n'est PAS servie : elle est remplacee par une explication.
// ---------------------------------------------------------------------------
/**
 * @param {?string} accentsId  l'axe « accents » (D7). `null`/`undefined` = ne
 *   PAS passer la prop : l'ecran applique son defaut (« sobre ») et les pages
 *   deja validees restent rendues par un sac de props RIGOUREUSEMENT identique
 *   a celui d'avant l'ajout de cet axe — pas un chemin « equivalent ».
 */
async function renderProfilVNext(fixture, device, varianteId, accentsId) {
  const mod = getProfilVNext();
  const vmMod = getViewModelModule();
  const marqueur = getMarqueurEcran();

  let viewModel = null;
  let erreurVm = null;
  if (vmMod.ok) {
    try {
      viewModel = vmMod.mod.buildProfilVNextViewModel(fixture.input, { variante: varianteId });
    } catch (err) {
      erreurVm = (err && err.stack) || String(err);
    }
  } else {
    erreurVm = vmMod.detail;
  }

  if (!mod.ok) {
    return {
      indisponible: {
        titre:
          mod.raison === "fichier_absent"
            ? "L'ecran du Profil vNext n'existe pas"
            : "L'ecran du Profil vNext n'a pas pu etre charge",
        message:
          mod.raison === "fichier_absent"
            ? "Le fichier screens/profilVNext/ProfilVNextScreen.tsx est introuvable. " +
              "Relance `node prototype/profil/build.js` quand il sera la : rien d'autre a faire."
            : "Le module existe mais son chargement a echoue. Detail ci-dessous.",
        detail: mod.detail,
      },
      viewModel,
      sonde: { erreurs: erreurVm ? [erreurVm] : [] },
    };
  }

  if (!viewModel) {
    return {
      indisponible: {
        titre: "Le selecteur du Profil vNext a echoue",
        message:
          "buildProfilVNextViewModel a leve une exception (ou le module est illisible). " +
          "Sans ViewModel, l'ecran n'a rien a rendre : le harnais ne fabrique pas de donnees a sa place.",
        detail: erreurVm,
      },
      viewModel: null,
      sonde: { erreurs: erreurVm ? [erreurVm] : [] },
    };
  }

  // Les props EXACTES du contrat, rien de plus : `vm` (le ViewModel construit),
  // `echelle` laisse a undefined (l'ecran applique son defaut, celui du Home),
  // `reduceMotion: true` pour le determinisme de la capture, et `accents`
  // UNIQUEMENT quand un accent non-defaut est demande.
  const props = { vm: viewModel, echelle: undefined, reduceMotion: true };
  if (accentsId != null) props.accents = accentsId;

  let rendu;
  try {
    rendu = await monter({
      cle: `vnext_${varianteId}_${fixture.id}_${device.width}${accentsId ? `_${accentsId}` : ""}`,
      element: React.createElement(mod.Comp, props),
      device,
    });
  } catch (err) {
    return {
      indisponible: {
        titre: "L'ecran du Profil vNext a plante au rendu",
        message:
          "Le composant existe mais leve une exception pendant le montage. Le harnais ne masque " +
          "pas : voici la trace.",
        detail: (err && err.stack) || String(err),
      },
      viewModel,
      sonde: { erreurs: [(err && err.stack) || String(err)] },
    };
  }

  // --- l'ecran est-il REELLEMENT celui du Profil vNext ? --------------------
  const trouves = compterMarqueur(rendu.html, marqueur.ecran);
  if (trouves !== 1) {
    return {
      indisponible: {
        titre: "Le marqueur du Profil vNext n'apparait pas dans l'ecran rendu",
        message:
          "Le composant a monte quelque chose, mais le marqueur de racine de l'ecran n'y est pas " +
          "(ou y est plusieurs fois).\n\n" +
          "Le harnais REFUSE de servir cette page. Afficher un autre rendu sous l'etiquette " +
          "« Profil vNext » ferait valider un ecran qui n'existe pas.\n\n" +
          "Rien a corriger cote harnais : relance `node prototype/profil/build.js` quand l'ecran " +
          "posera son marqueur.",
        detail:
          `Marqueur cherche : data-testid="${marqueur.ecran}" ` +
          `(pose par screens/profilVNext/ProfilVNextScreen.tsx via ` +
          `components/profilVNext/profilVNextMarqueurs.ts, champ PROFIL_MARQUEURS.ecran).\n` +
          `Trouve : ${trouves} fois, attendu 1.\n` +
          (marqueur.ok
            ? ""
            : `\nATTENTION : profilVNextMarqueurs.ts est illisible (${String(marqueur.detail).split("\n")[0]}) — ` +
              `le harnais a compare contre la valeur de repli « profil-vnext-ecran ».\n`) +
          `\nProps passees a l'ecran par le harnais : vm (ViewModel construit par ` +
          `buildProfilVNextViewModel(input, { variante: "${varianteId}" })), echelle: undefined, ` +
          `reduceMotion: true.\n` +
          `\nAvertissements du selecteur :\n  ` +
          ((viewModel.protoWarnings || []).join("\n  ") || "(aucun)"),
      },
      viewModel,
      sonde: rendu.sonde,
    };
  }

  return { html: rendu.html, viewModel, sonde: rendu.sonde };
}

// ---------------------------------------------------------------------------
// Variante B — le Profil de production
// ---------------------------------------------------------------------------
// `screens/ProfileScreen.tsx` est lu en LECTURE SEULE et alimente par des stores
// bouchonnes (lib/scenariosProfil.js — les approximations y sont listees).
//
// Il fait aussi une lecture ASYNCHRONE hors store : `readTestsRaw()` lit
// AsyncStorage (`fks_tests_v1_<uid>`, uid du stub = "harnais-uid"). Le stub
// AsyncStorage est une memoire PARTAGEE entre tous les rendus : on re-seme donc
// les tests A CHAQUE rendu, sinon les entrees d'un etat fuiraient dans le
// suivant. Le `SETTLE_MS` laisse largement le temps a la lecture de se resoudre.
// ---------------------------------------------------------------------------
async function renderActuel(scenario, device) {
  const mod = getProfilActuel();
  if (!mod.ok) {
    return {
      indisponible: {
        titre: "Le Profil de production n'a pas pu etre charge",
        message: "Le harnais lit screens/ProfileScreen.tsx en lecture seule. Le chargement a echoue.",
        detail: mod.detail,
      },
      sonde: { erreurs: [mod.detail] },
    };
  }

  scenarioState.setState(scenariosProfil.toStorePatch(scenario));
  // AVANT le montage, a CHAQUE rendu : voir le commentaire de tete.
  await scenariosProfil.seedAsyncStorage(scenario);

  try {
    const { html, sonde } = await monter({
      cle: `actuel_${scenario.id}_${device.width}`,
      element: React.createElement(mod.Comp, null),
      device,
    });
    return { html, sonde };
  } catch (err) {
    return {
      indisponible: {
        titre: "Le Profil de production a plante au rendu",
        message: "Exception pendant le montage du Profil actuel avec ce jeu de donnees fictives.",
        detail: (err && err.stack) || String(err),
      },
      sonde: { erreurs: [(err && err.stack) || String(err)] },
    };
  }
}

// ---------------------------------------------------------------------------
// Feuille de style generee par react-native-web
// ---------------------------------------------------------------------------
// react-native-web injecte ses regles dans le <head> du document au fil des
// rendus. On extrait TOUT a la fin : une seule feuille couvre les deux
// variantes, tous les etats et toutes les largeurs.
// ---------------------------------------------------------------------------
function extractCss() {
  const depuisLeDocument = Array.from(doc.head.querySelectorAll("style"))
    .map((s) => {
      try {
        return Array.from(s.sheet.cssRules)
          .map((r) => r.cssText)
          .join("\n");
      } catch (_) {
        return s.textContent || "";
      }
    })
    .join("\n");
  if (depuisLeDocument.trim().length > 0) return depuisLeDocument;

  // Filet de securite : si la feuille n'a pas ete injectee dans le document, on
  // la demande directement a react-native-web. Sans ce filet, un changement
  // d'ordre d'import produirait des pages sans style — et personne ne le verrait
  // avant d'ouvrir le visualiseur.
  try {
    const ReactDOMServer = require("react-dom/server");
    RNW.AppRegistry.registerComponent("__extraction_css__", () => () =>
      React.createElement(RNW.View, null)
    );
    const app = RNW.AppRegistry.getApplication("__extraction_css__", {});
    const markup = ReactDOMServer.renderToStaticMarkup(app.getStyleElement());
    return markup.replace(/^<style[^>]*>/, "").replace(/<\/style>$/, "");
  } catch (err) {
    console.warn("[harnais] feuille de style introuvable :", err.message);
    return "";
  }
}

/** Multiplie les tailles de texte de la feuille (variante texte agrandi). */
function scaleCss(css, factor) {
  if (factor === 1) return css;
  return css.replace(
    /(font-size|line-height)\s*:\s*([\d.]+)px/g,
    (m, prop, val) => `${prop}: ${(parseFloat(val) * factor).toFixed(2)}px`
  );
}

module.exports = {
  renderProfilVNext,
  renderActuel,
  extractCss,
  scaleCss,
  getProfilVNext,
  getProfilActuel,
  getViewModelModule,
  getMarqueurEcran,
  SETTLE_MS,
};
