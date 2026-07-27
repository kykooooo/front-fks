// prototype/home-vnext/lib/render.js
// =============================================================================
// MOTEUR DE RENDU — UN SEUL PIPELINE POUR LES DEUX VARIANTES
// =============================================================================
// `renderActuel` et `renderVNext` partagent exactement le meme montage :
// meme jsdom, meme react-native-web, memes stubs, meme temps de stabilisation,
// meme extraction. La seule difference est ce qu'on monte et comment on lui
// donne ses donnees (stores bouchonnes d'un cote, ViewModel de l'autre).
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
const scenariosActuel = require("./scenariosActuel");

// Determinisme : on force « mouvement reduit ». Le Home de production pose alors
// directement ses valeurs animees a 1 (etat stabilise) au lieu de jouer le
// fondu en cascade. Sans ca, une capture prise trop tot serait transparente.
RNW.AccessibilityInfo.isReduceMotionEnabled = async () => true;

/** Temps laisse aux effets pour se stabiliser (surchargeable : FKS_SETTLE). */
const SETTLE_MS = Number(process.env.FKS_SETTLE || 900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Chargement paresseux des ecrans
// ---------------------------------------------------------------------------
// L'ecran vNext est ecrit par un autre agent, en parallele. Il peut ne pas
// exister au moment ou le harnais tourne : on ne plante pas, on le signale.
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

let cacheHome = null;
function getHomeActuel() {
  if (!cacheHome) cacheHome = chargerModule("screens/HomeScreen.tsx");
  return cacheHome;
}

let cacheBanner = null;
function getOfflineBanner() {
  if (!cacheBanner) {
    try {
      cacheBanner = { ok: true, Comp: require(path.join(APP_ROOT, "components/OfflineBanner.tsx")).OfflineBanner };
    } catch (e) {
      cacheBanner = { ok: false, detail: String(e) };
    }
  }
  return cacheBanner;
}

let cacheVNext = null;
function getVNext() {
  if (!cacheVNext) cacheVNext = chargerModule("screens/homeVNext/HomeVNextScreen.tsx");
  return cacheVNext;
}

let cacheViewModel = null;
function getViewModelModule() {
  if (!cacheViewModel) {
    try {
      cacheViewModel = { ok: true, mod: require(path.join(APP_ROOT, "screens/homeVNext/viewModel.ts")) };
    } catch (err) {
      cacheViewModel = { ok: false, detail: (err && err.stack) || String(err) };
    }
  }
  return cacheViewModel;
}

// ---------------------------------------------------------------------------
// Reperage de la structure
// ---------------------------------------------------------------------------
// On descend tant qu'il n'y a qu'un seul enfant : ce sont les conteneurs de
// mise en page (racine react-native-web, safe area, zone de defilement). On les
// marque `data-fks="chain"` — c'est eux, et eux seuls, que la vue « page
// entiere » neutralise. Le premier noeud a plusieurs enfants est le CONTENU.
//
// Cas particulier : quand le bandeau hors-ligne est monte, la racine porte deux
// enfants. On identifie le bandeau par son texte et on continue dans l'autre.
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
// Variante A — la proposition
// ---------------------------------------------------------------------------
/**
 * L'ecran vNext est ecrit par un autre agent : sa signature exacte n'est pas
 * connue au moment ou ce harnais est ecrit. On lui passe donc un sac de props
 * couvrant les formes plausibles (`viewModel`, `vm`, `input`, `fixture`,
 * `fixtureId`) plus une navigation inerte. Un composant qui n'en lit qu'une
 * fonctionne ; les autres props sont ignorees.
 */
async function renderVNext(fixture, device) {
  const mod = getVNext();
  const vmMod = getViewModelModule();

  let viewModel = null;
  let erreurVm = null;
  if (vmMod.ok) {
    try {
      viewModel = vmMod.mod.buildHomeVNextViewModel(fixture.input);
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
            ? "L'ecran de la proposition n'existe pas encore"
            : "L'ecran de la proposition n'a pas pu etre charge",
        message:
          mod.raison === "fichier_absent"
            ? "Le fichier screens/homeVNext/HomeVNextScreen.tsx est ecrit par un autre agent, en parallele. " +
              "Relance `node prototype/home-vnext/build.js` quand il sera la : rien d'autre a faire."
            : "Le module existe mais son chargement a echoue. Detail ci-dessous.",
        detail: mod.detail,
      },
      viewModel,
      sonde: { erreurs: erreurVm ? [erreurVm] : [] },
    };
  }

  const nav = require("./stubs/navigation-native").__nav;
  const props = {
    viewModel,
    vm: viewModel,
    input: fixture.input,
    fixture,
    fixtureId: fixture.id,
    navigation: nav,
    onAction: () => {},
    route: { key: "harnais", name: "HomeVNext", params: { fixtureId: fixture.id } },
  };

  try {
    const { html, sonde } = await monter({
      cle: `vnext_${fixture.id}_${device.width}`,
      element: React.createElement(mod.Comp, props),
      device,
    });
    return { html, viewModel, sonde: { ...sonde, erreurs: [...sonde.erreurs, ...(erreurVm ? [erreurVm] : [])] } };
  } catch (err) {
    return {
      indisponible: {
        titre: "L'ecran de la proposition a plante au rendu",
        message:
          "Le composant existe mais lever une exception pendant le montage. Le harnais ne masque pas : " +
          "voici la trace.",
        detail: (err && err.stack) || String(err),
      },
      viewModel,
      sonde: { erreurs: [(err && err.stack) || String(err)] },
    };
  }
}

// ---------------------------------------------------------------------------
// Variante B — le Home de production
// ---------------------------------------------------------------------------
async function renderActuel(scenario, device) {
  const mod = getHomeActuel();
  if (!mod.ok) {
    return {
      indisponible: {
        titre: "Le Home de production n'a pas pu etre charge",
        message: "Le harnais lit screens/HomeScreen.tsx en lecture seule. Le chargement a echoue.",
        detail: mod.detail,
      },
      sonde: { erreurs: [mod.detail] },
    };
  }

  scenarioState.setState(scenariosActuel.toStorePatch(scenario));

  let element = React.createElement(mod.Comp, null);
  if (scenario.offline) {
    const banner = getOfflineBanner();
    if (banner.ok) {
      element = React.createElement(
        RNW.View,
        { style: { flex: 1 } },
        element,
        React.createElement(banner.Comp, null)
      );
    }
  }

  try {
    const { html, sonde } = await monter({
      cle: `actuel_${scenario.id}_${device.width}`,
      element,
      device,
    });
    return { html, sonde };
  } catch (err) {
    return {
      indisponible: {
        titre: "Le Home de production a plante au rendu",
        message: "Exception pendant le montage du Home actuel avec ce jeu de donnees fictives.",
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
  renderVNext,
  renderActuel,
  extractCss,
  scaleCss,
  getVNext,
  getViewModelModule,
  SETTLE_MS,
};
