// prototype/home-vnext/lib/dom.js
// =============================================================================
// ENVIRONNEMENT DOM (jsdom) POUR MONTER L'ECRAN
// =============================================================================
// Pourquoi MONTER l'ecran et pas `renderToStaticMarkup` :
// le Home de production initialise ses `Animated.Value` a 0 et ne les passe a 1
// que dans un `useEffect`. Un rendu statique donnerait donc un ecran a
// `opacity: 0` — une page blanche. En montant vraiment, les effets tournent et
// on capture l'ETAT STABILISE.
//
// LIMITE ASSUMEE : jsdom n'a AUCUN moteur de layout. Toute mesure
// (`offsetWidth`, `ResizeObserver`) vaut 0. On fournit donc une mesure calculee
// a la main pour les seuls noeuds qui portent un `onLayout`. Le vrai layout,
// lui, est fait par le navigateur quand on ouvre la page generee : c'est la que
// les hauteurs sont reelles.
// =============================================================================
"use strict";

const { JSDOM } = require("jsdom");

const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  { pretendToBeVisual: true, url: "http://127.0.0.1:8140/" }
);

const win = dom.window;

// --- globals ---------------------------------------------------------------
const skip = new Set(["undefined", "NaN", "Infinity", "global", "globalThis"]);
for (const key of Object.getOwnPropertyNames(win)) {
  if (skip.has(key) || key.startsWith("_")) continue;
  if (key in global) continue;
  try {
    global[key] = win[key];
  } catch (_) {
    /* certaines proprietes sont en lecture seule */
  }
}
for (const key of ["window", "document", "navigator", "self", "location", "history"]) {
  try {
    Object.defineProperty(global, key, { value: win[key], configurable: true, writable: true });
  } catch (_) {}
}
global.window = win;
global.document = win.document;

// --- matchMedia (absent de jsdom, lu par Appearance / useColorScheme) ------
if (!win.matchMedia) {
  win.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
  global.matchMedia = win.matchMedia;
}

// ---------------------------------------------------------------------------
// numberOfLines : RATTRAPAGE D'UNE PERTE SILENCIEUSE DE jsdom
// ---------------------------------------------------------------------------
// SYMPTOME CONSTATE : sur la fixture a textes longs, le sous-titre de l'aplat
// s'affichait sur 5 lignes alors que le composant pose `numberOfLines={2}`.
//
// CAUSE : react-native-web traduit `numberOfLines` en `WebkitLineClamp` posee
// en style EN LIGNE (verifie dans
// node_modules/react-native-web/dist/exports/Text/index.js, ligne 113). Or le
// moteur CSS de jsdom n'implemente pas `-webkit-line-clamp` : il ignore la
// propriete SANS RIEN DIRE. Mesure : `d.style.WebkitLineClamp = 2` laisse
// l'attribut style inchange, et `setProperty("-webkit-line-clamp", "2")` aussi.
//
// CONSEQUENCE SI ON NE FAIT RIEN : toutes les pages generees — proposition ET
// Home de production — sortent avec des textes NON bornes. Les hauteurs sont
// alors surestimees des deux cotes, et un bloc qui se coupe proprement sur le
// telephone paraissait deborder ici. C'est exactement le genre d'artefact de
// harnais que l'audit a deja du demeler une fois (cf. AUDIT_HOME.md §7.3).
//
// RATTRAPAGE : on intercepte l'ecriture de la propriete pour retenir la valeur,
// puis on la re-injecte dans l'attribut `style` juste avant de capturer le
// balisage. L'attribut, lui, est conserve tel quel par jsdom — c'est le seul
// chemin qui survit. Le navigateur qui ouvre la page applique alors la coupe
// pour de vrai.
// ---------------------------------------------------------------------------
const clampParDeclaration = new WeakMap();

Object.defineProperty(win.CSSStyleDeclaration.prototype, "WebkitLineClamp", {
  configurable: true,
  get() {
    return clampParDeclaration.get(this) || "";
  },
  set(valeur) {
    if (valeur === null || valeur === undefined || valeur === "") {
      clampParDeclaration.delete(this);
      return;
    }
    clampParDeclaration.set(this, String(valeur));
  },
});

/**
 * Re-pose `-webkit-line-clamp` sur tous les elements concernes d'un sous-arbre.
 * A appeler APRES le rendu et AVANT la capture du balisage.
 * @returns {number} nombre d'elements rattrapes (affiche dans le rapport de build)
 */
function reinjecterLineClamp(racine) {
  let n = 0;
  const noeuds = [racine, ...racine.querySelectorAll("*")];
  for (const el of noeuds) {
    if (!el || !el.style) continue;
    const lignes = clampParDeclaration.get(el.style);
    if (!lignes) continue;
    const style = el.getAttribute("style") || "";
    if (/-webkit-line-clamp/.test(style)) continue;
    const prefixe = style.trim().length > 0 ? style.trim().replace(/;$/, "") + "; " : "";
    el.setAttribute("style", `${prefixe}-webkit-line-clamp: ${lignes}`);
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// onLayout : APPROXIMATION ASSUMEE ET DOCUMENTEE
// ---------------------------------------------------------------------------
// react-native-web mesure via ResizeObserver + node.offsetWidth/offsetHeight.
// jsdom renvoie 0 partout. On sert donc une mesure calculee : largeur d'ecran
// moins les paddings connus (marge d'ecran + padding de carte), hauteur fixee.
// `observedNodes` compte les noeuds effectivement mesures : le rapport de build
// l'affiche, ce qui permet de reperer un composant mesure auquel on n'aurait
// pas pense.
// ---------------------------------------------------------------------------
const assumed = { width: 311, height: 90 };
const observedNodes = new Set();

function setAssumedLayout(next) {
  Object.assign(assumed, next);
}

function resetObservedNodes() {
  observedNodes.clear();
}

const HANDLER = "__reactLayoutHandler";
const isMeasured = (node) => node && typeof node[HANDLER] === "function";

for (const [prop, pick] of [
  ["offsetWidth", () => assumed.width],
  ["offsetHeight", () => assumed.height],
]) {
  Object.defineProperty(win.HTMLElement.prototype, prop, {
    configurable: true,
    get() {
      return isMeasured(this) ? pick() : 0;
    },
  });
}
for (const prop of ["offsetLeft", "offsetTop", "clientLeft", "clientTop"]) {
  Object.defineProperty(win.HTMLElement.prototype, prop, {
    configurable: true,
    get() {
      return 0;
    },
  });
}
Object.defineProperty(win.HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return null;
  },
});

class HarnessResizeObserver {
  constructor(cb) {
    this._cb = cb;
    this._nodes = new Set();
  }
  observe(node) {
    if (this._nodes.has(node)) return;
    this._nodes.add(node);
    observedNodes.add(node);
    setTimeout(() => {
      if (!this._nodes.has(node)) return;
      this._cb(
        [
          {
            target: node,
            contentRect: {
              x: 0,
              y: 0,
              width: assumed.width,
              height: assumed.height,
              top: 0,
              left: 0,
              right: assumed.width,
              bottom: assumed.height,
            },
          },
        ],
        this
      );
    }, 0);
  }
  unobserve(node) {
    this._nodes.delete(node);
  }
  disconnect() {
    this._nodes.clear();
  }
}
win.ResizeObserver = HarnessResizeObserver;
global.ResizeObserver = HarnessResizeObserver;

if (!win.IntersectionObserver) {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  win.IntersectionObserver = IO;
  global.IntersectionObserver = IO;
}

module.exports = {
  dom,
  window: win,
  document: win.document,
  setAssumedLayout,
  observedNodes,
  resetObservedNodes,
  reinjecterLineClamp,
};
