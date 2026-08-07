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

let cacheProgression = null;
function getProgressionModule() {
  if (!cacheProgression) {
    try {
      cacheProgression = {
        ok: true,
        mod: require(path.join(APP_ROOT, "screens/homeVNext/progressionViewModel.ts")),
      };
    } catch (err) {
      cacheProgression = { ok: false, detail: (err && err.stack) || String(err) };
    }
  }
  return cacheProgression;
}

/**
 * Le composant de la carte, ecrit par l'autre agent. On ne le monte JAMAIS
 * nous-memes — c'est l'ecran qui doit le poser, sinon on ne teste pas la
 * variante mais un montage du harnais. On l'interroge uniquement pour savoir
 * s'il existe, et le dire.
 */
let cacheCarte = null;
function getCarteProgression() {
  if (!cacheCarte) {
    try {
      const mod = require(path.join(APP_ROOT, "components/homeVNext/HomeVNextProgression.tsx"));
      const noms = Object.keys(mod || {});
      cacheCarte = { ok: true, exports: noms };
    } catch (err) {
      cacheCarte = {
        ok: false,
        raison: err && err.code === "MODULE_NOT_FOUND" ? "fichier_absent" : "erreur_chargement",
        detail: (err && (err.stack || err.message)) || String(err),
      };
    }
  }
  return cacheCarte;
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
async function renderVNext(fixture, device, presentation) {
  const mod = getVNext();
  const vmMod = getViewModelModule();
  const presentations = require("./presentations");

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
  // Pour la presentation PAR DEFAUT, `propsDePresentation` renvoie un objet vide :
  // l'ecran applique alors ses propres valeurs par defaut, exactement comme avant
  // l'ajout de cet axe. Les pages deja validees passent donc par le meme chemin,
  // pas par un chemin « equivalent ».
  const props = {
    viewModel,
    vm: viewModel,
    input: fixture.input,
    fixture,
    fixtureId: fixture.id,
    navigation: nav,
    onAction: () => {},
    route: { key: "harnais", name: "HomeVNext", params: { fixtureId: fixture.id } },
    ...presentations.propsDePresentation(presentation),
  };

  const suffixeCle = presentation && !presentation.parDefaut ? `_${presentation.id}` : "";

  try {
    const { html, sonde } = await monter({
      cle: `vnext_${fixture.id}_${device.width}${suffixeCle}`,
      element: React.createElement(mod.Comp, props),
      device,
    });
    return {
      html,
      viewModel,
      mouvement: presentations.mesurerMouvement(html),
      sonde: { ...sonde, erreurs: [...sonde.erreurs, ...(erreurVm ? [erreurVm] : [])] },
    };
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
// Variante A bis — la proposition AVEC la carte progression integree
// ---------------------------------------------------------------------------
// MEME pipeline, MEME ecran, MEMES stubs que la variante 1. La seule difference
// est le sac de props (voir lib/appariementVariante2.js).
//
// LE POINT CRITIQUE : si l'ecran ne connait pas encore la variante 2 — parce que
// la prop porte un autre nom, ou parce que le composant de carte n'est pas
// encore ecrit — il rendra la variante 1 SANS RIEN DIRE. Montrer ce rendu sous
// l'etiquette « Progression integree » serait le pire defaut possible de ce
// harnais : le fondateur validerait un ecran qu'il n'a jamais vu.
//
// On se protege par une mesure, pas par une convention : on cherche dans le
// rendu les phrases que le ViewModel de la carte a produites. Si le titre de la
// carte n'y est pas, on refuse de servir la page et on explique pourquoi.
// ---------------------------------------------------------------------------
async function renderVNext2({ fixtureHote, fixtureProgression, device, htmlVariante1, presentation }) {
  const mod = getVNext();
  const vmMod = getViewModelModule();
  const progMod = getProgressionModule();
  const appariement = require("./appariementVariante2");
  const presentations = require("./presentations");

  const erreurs = [];
  let homeVm = null;
  let progVm = null;

  if (vmMod.ok) {
    try {
      // Les options de la VARIANTE 2, pas celles par defaut : c'est ce qui
      // active le verrou de la pastille d'etat du jour dans le ViewModel.
      // La variante 1 (`renderVNext`, plus haut) appelle sans options et reste
      // donc rigoureusement identique a ce qui a deja ete valide.
      homeVm = vmMod.mod.buildHomeVNextViewModel(
        fixtureHote.input,
        appariement.OPTIONS_VM_VARIANTE2
      );
    } catch (err) {
      erreurs.push(`Selecteur du Home : ${(err && err.stack) || String(err)}`);
    }
  } else {
    erreurs.push(`Selecteur du Home illisible : ${vmMod.detail}`);
  }

  if (progMod.ok) {
    try {
      progVm = progMod.mod.buildProgressionViewModel(fixtureProgression.input);
    } catch (err) {
      erreurs.push(`Selecteur de la carte : ${(err && err.stack) || String(err)}`);
    }
  } else {
    erreurs.push(`Selecteur de la carte illisible : ${progMod.detail}`);
  }

  const carte = getCarteProgression();

  // --- l'ecran lui-meme est-il chargeable ? ---------------------------------
  if (!mod.ok) {
    return {
      indisponible: {
        titre: "L'ecran de la proposition n'existe pas encore",
        message:
          "La variante 2 se rend avec le MEME ecran que la variante 1, avec une prop en plus. " +
          "Cet ecran n'a pas pu etre charge.",
        detail: mod.detail,
      },
      homeVm,
      progVm,
      sonde: { erreurs },
    };
  }

  const nav = require("./stubs/navigation-native").__nav;
  const props = appariement.propsVariante2({
    homeVm,
    progVm,
    nav,
    presentation: presentations.propsDePresentation(presentation),
  });
  const suffixeCle = presentation && !presentation.parDefaut ? `_${presentation.id}` : "";

  let rendu;
  try {
    rendu = await monter({
      cle: `vnext2_${fixtureProgression.id}_${device.width}${suffixeCle}`,
      element: React.createElement(mod.Comp, props),
      device,
    });
  } catch (err) {
    return {
      indisponible: {
        titre: "L'ecran a plante en variante 2",
        message:
          "Le composant existe mais leve une exception quand on lui passe le sac de props de la " +
          "variante 2. Le harnais ne masque pas : voici la trace.",
        detail: (err && err.stack) || String(err),
      },
      homeVm,
      progVm,
      sonde: { erreurs: [...erreurs, (err && err.stack) || String(err)] },
    };
  }

  // --- la carte est-elle REELLEMENT a l'ecran ? -----------------------------
  // On isole son balisage : certaines regles portent sur la CARTE et pas sur
  // l'ecran. « En forme » lu dans la pastille d'en-tete du Home n'est pas la
  // carte qui annonce un etat global — accuser le mauvais bloc serait une mesure
  // fausse. On reutilise le jsdom deja monte : aucune dependance en plus.
  let htmlCarte = null;
  try {
    const bac = doc.createElement("div");
    bac.innerHTML = rendu.html;
    const el = bac.querySelector(`[data-testid="${appariement.MARQUEURS.progression}"]`);
    htmlCarte = el ? el.outerHTML : null;
  } catch (err) {
    erreurs.push(`Isolation de la carte impossible : ${String(err)}`);
  }

  const mesures = appariement.mesurerVariante2(rendu.html, homeVm, progVm, htmlCarte);
  const mouvement = presentations.mesurerMouvement(rendu.html);

  if (!mesures.carteDetectee) {
    const identique = htmlVariante1 != null && htmlVariante1 === rendu.html;
    const manquants = mesures.marqueurs.filter((m) => !m.trouve);
    return {
      indisponible: {
        titre: "La carte progression n'apparait pas dans l'ecran rendu",
        message:
          (identique
            ? "Le rendu est RIGOUREUSEMENT IDENTIQUE a celui de la variante 1 : la prop de " +
              "variante n'a eu aucun effet. L'ecran ne connait pas (ou plus) la valeur que le " +
              "harnais lui passe.\n\n"
            : "L'ecran a bien reagi (le rendu differe de la variante 1) mais le marqueur de la " +
              "carte n'y est pas.\n\n") +
          "Le harnais REFUSE de servir cette page. Afficher la variante 1 sous l'etiquette " +
          "« Progression integree » ferait valider un ecran qui n'existe pas.\n\n" +
          "Rien a corriger cote harnais : relance `node prototype/home-vnext/build.js` quand " +
          "l'ecran saura poser la carte.",
        detail:
          `Marqueur cherche : data-testid="${appariement.MARQUEURS.progression}" ` +
          `(pose par components/homeVNext/HomeVNextProgression.tsx via homeVNextMarqueurs.ts).\n` +
          `Trouve : ${mesures.controles.find((c) => c.cle === "carte").valeur} fois, attendu 1.\n` +
          `\n` +
          `Composant de carte : ` +
          `${carte.ok ? `present, exports = ${carte.exports.join(", ") || "(aucun)"}` : `ABSENT (${carte.raison})`}\n` +
          `\n` +
          `Props passees a l'ecran par le harnais :\n  ` +
          appariement.clesDuSac().join(", ") +
          `\n  variante = "${appariement.VALEUR_VARIANTE}"\n` +
          `\n` +
          `Contrat attendu par screens/homeVNext/HomeVNextScreen.tsx au moment ou ce harnais a ete\n` +
          `ecrit : union discriminee { variante: "v2"; progression: ProgressionViewModel }.\n` +
          `S'il a change, la seule ligne a corriger est VALEUR_VARIANTE dans\n` +
          `prototype/home-vnext/lib/appariementVariante2.js.\n` +
          `\n` +
          `Phrases du contrat retrouvees dans le rendu : ${mesures.marqueursTrouves} / ${mesures.marqueursTotal}.` +
          (manquants.length
            ? `\nIntrouvables :\n` + manquants.map((m) => `  - ${m.quoi} : « ${m.texte} »`).join("\n")
            : ""),
      },
      homeVm,
      progVm,
      mesures,
      sonde: { ...rendu.sonde, erreurs: [...rendu.sonde.erreurs, ...erreurs] },
    };
  }

  return {
    html: rendu.html,
    homeVm,
    progVm,
    mesures,
    mouvement,
    carte,
    sonde: { ...rendu.sonde, erreurs: [...rendu.sonde.erreurs, ...erreurs] },
  };
}

// ---------------------------------------------------------------------------
// Variantes de DEMARRAGE — l'ecran du nouveau joueur (V-A / V-B)
// ---------------------------------------------------------------------------
// MEME pipeline, MEME ecran, MEMES stubs, MEME ViewModel que la variante 1. La
// SEULE difference est une option passee au selecteur : `{ demarrage: "A" }` ou
// `{ demarrage: "B" }`. L'ecran, lui, ne recoit AUCUNE prop supplementaire — il
// lit `vm.demarrage` et en deduit tout, traitement hero compris.
//
// C'est ce qui rend la comparaison honnete : entre V-actuelle, V-A et V-B, la
// seule chose qui bouge est cette option. Pas un stub, pas une prop de harnais,
// pas un montage different.
//
// LE MEME PIEGE QU'EN VARIANTE 2, ET LA MEME PARADE
// -----------------------------------------------------------------------------
// Si le contrat changeait — option renommee, bloc retire, composant absent —
// l'ecran rendrait la variante actuelle SANS RIEN DIRE. Servir ce rendu sous
// l'etiquette « V-A » ferait valider un ecran qui n'existe pas. On se protege
// par une MESURE : on cherche le marqueur du bloc dans le HTML produit, et s'il
// n'y est pas, on refuse de servir la page.
// ---------------------------------------------------------------------------

/** Ce que le harnais cherche dans le rendu pour prouver qu'il regarde bien V-A / V-B. */
const MARQUEURS_DEMARRAGE = {
  bloc: "home-vnext-demarrage",
  pas: "home-vnext-demarrage-pas",
  pasFait: "home-vnext-demarrage-pas-fait",
  pourquoiCycle: "home-vnext-demarrage-pourquoi-cycle",
  apercu: "home-vnext-demarrage-apercu",
  hero: "home-vnext-action-hero",
  actionPrincipale: "home-vnext-action-principale",
  formeInsuffisante: "home-vnext-forme-insuffisante",
};

/** Compte les occurrences d'un `data-testid` dans un fragment de HTML. */
function compterMarqueur(html, marqueur) {
  const re = new RegExp('data-testid="' + marqueur + '"', "g");
  return (String(html || "").match(re) || []).length;
}

/**
 * Les controles chiffres d'une page de demarrage.
 *
 * Chaque attendu est DEDUIT DU VIEWMODEL, jamais ecrit a la main : c'est la
 * seule facon qu'un controle continue de mesurer quelque chose le jour ou le
 * contenu bouge. Un attendu recopie deviendrait faux en silence.
 */
function mesurerDemarrage(html, vm) {
  const bloc = vm && vm.demarrage ? vm.demarrage : null;
  const pasAttendus = bloc && bloc.kind === "premiere_mission" ? bloc.premiersPas.length : 0;
  const pasFaitsAttendus =
    bloc && bloc.kind === "premiere_mission"
      ? bloc.premiersPas.filter((p) => p.fait).length
      : 0;
  const pourquoiAttendu =
    bloc && bloc.kind === "premiere_mission" && bloc.pourquoiCeCycle ? 1 : 0;
  const apercusAttendus = bloc && bloc.kind === "anticipation" ? bloc.apercus.length : 0;

  const controles = [
    {
      cle: "bloc",
      quoi: "le bloc de demarrage",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.bloc),
      attendu: 1,
    },
    {
      cle: "hero",
      quoi: "l'action en traitement hero",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.hero),
      attendu: 1,
    },
    {
      cle: "action_unique",
      quoi: "une seule action principale",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.actionPrincipale),
      attendu: 1,
    },
    {
      cle: "pas",
      quoi: "les lignes de premier pas",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.pas),
      attendu: pasAttendus,
    },
    {
      cle: "pas_faits",
      quoi: "les pas COCHES (doivent egaler ceux dont fait=true)",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.pasFait),
      attendu: pasFaitsAttendus,
    },
    {
      cle: "pourquoi_cycle",
      quoi: "la ligne « pourquoi ce cycle »",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.pourquoiCycle),
      attendu: pourquoiAttendu,
    },
    {
      cle: "apercus",
      quoi: "les lignes d'apercu",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.apercu),
      attendu: apercusAttendus,
    },
    {
      cle: "forme_absorbee",
      quoi: "la carte MA FORME, absorbee par le bloc",
      valeur: compterMarqueur(html, MARQUEURS_DEMARRAGE.formeInsuffisante),
      attendu: 0,
    },
  ];

  return {
    blocDetecte: controles[0].valeur === 1,
    controles,
    clesEnEchec: controles.filter((c) => c.valeur !== c.attendu).map((c) => c.cle),
  };
}

/**
 * Rend l'ecran du nouveau joueur dans l'une des deux variantes de demarrage.
 *
 * @param {object} fixture             la fixture Home (« nouveau-joueur »)
 * @param {object} device              le format
 * @param {object} presentation        la combinaison typo x mouvement
 * @param {"A"|"B"} varianteDemarrage  laquelle des deux
 * @param {?string} htmlActuel         le rendu de la variante ACTUELLE du meme
 *   etat, a la meme largeur et dans la meme presentation. Sert a UNE chose :
 *   quand le bloc n'est pas detecte, savoir dire si l'ecran a reagi ou non.
 */
async function renderDemarrage(fixture, device, presentation, varianteDemarrage, htmlActuel) {
  const mod = getVNext();
  const vmMod = getViewModelModule();
  const presentations = require("./presentations");

  let viewModel = null;
  const erreurs = [];
  if (vmMod.ok) {
    try {
      viewModel = vmMod.mod.buildHomeVNextViewModel(fixture.input, {
        demarrage: varianteDemarrage,
      });
    } catch (err) {
      erreurs.push((err && err.stack) || String(err));
    }
  } else {
    erreurs.push(vmMod.detail);
  }

  if (!mod.ok) {
    return {
      indisponible: {
        titre: "L'ecran de la proposition n'a pas pu etre charge",
        message:
          "Les variantes de demarrage se rendent avec le MEME ecran que la variante actuelle : " +
          "seule une option du selecteur change. Cet ecran n'a pas pu etre charge.",
        detail: mod.detail,
      },
      viewModel,
      sonde: { erreurs },
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
    ...presentations.propsDePresentation(presentation),
  };

  const suffixeCle = presentation && !presentation.parDefaut ? `_${presentation.id}` : "";

  let rendu;
  try {
    rendu = await monter({
      cle: `vnext${varianteDemarrage}_${fixture.id}_${device.width}${suffixeCle}`,
      element: React.createElement(mod.Comp, props),
      device,
    });
  } catch (err) {
    return {
      indisponible: {
        titre: `L'ecran a plante en variante V-${varianteDemarrage}`,
        message:
          "Le composant existe mais leve une exception quand le ViewModel porte un bloc de " +
          "demarrage. Le harnais ne masque pas : voici la trace.",
        detail: (err && err.stack) || String(err),
      },
      viewModel,
      sonde: { erreurs: [...erreurs, (err && err.stack) || String(err)] },
    };
  }

  const mesures = mesurerDemarrage(rendu.html, viewModel);
  const mouvement = presentations.mesurerMouvement(rendu.html);

  if (!mesures.blocDetecte) {
    const identique = htmlActuel != null && htmlActuel === rendu.html;
    return {
      indisponible: {
        titre: `Le bloc de demarrage n'apparait pas dans l'ecran rendu (V-${varianteDemarrage})`,
        message:
          (identique
            ? "Le rendu est RIGOUREUSEMENT IDENTIQUE a celui de la variante actuelle : l'option " +
              "du selecteur n'a eu aucun effet. Le ViewModel ne connait pas (ou plus) la valeur " +
              "que le harnais lui passe.\n\n"
            : "Le selecteur a bien reagi (le rendu differe de la variante actuelle) mais le " +
              "marqueur du bloc n'y est pas.\n\n") +
          "Le harnais REFUSE de servir cette page. Afficher l'ecran actuel sous l'etiquette " +
          `« V-${varianteDemarrage} » ferait valider un ecran qui n'existe pas.\n\n` +
          "Rien a corriger cote harnais : relance `node prototype/home-vnext/build.js` quand " +
          "le selecteur saura construire le bloc.",
        detail:
          `Marqueur cherche : data-testid="${MARQUEURS_DEMARRAGE.bloc}" ` +
          `(pose par components/homeVNext/HomeVNextDemarrage.tsx via homeVNextMarqueurs.ts).\n` +
          `Trouve : ${mesures.controles[0].valeur} fois, attendu 1.\n\n` +
          `Option passee au selecteur : ` +
          `buildHomeVNextViewModel(input, { demarrage: "${varianteDemarrage}" }).\n` +
          `Bloc produit : ` +
          (viewModel && viewModel.demarrage
            ? `kind = "${viewModel.demarrage.kind}"`
            : "AUCUN (vm.demarrage === null)") +
          `\n\nAvertissements du selecteur :\n  ` +
          (((viewModel && viewModel.protoWarnings) || []).join("\n  ") || "(aucun)"),
      },
      viewModel,
      mesures,
      sonde: { ...rendu.sonde, erreurs: [...rendu.sonde.erreurs, ...erreurs] },
    };
  }

  return {
    html: rendu.html,
    viewModel,
    mesures,
    mouvement,
    sonde: { ...rendu.sonde, erreurs: [...rendu.sonde.erreurs, ...erreurs] },
  };
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
  renderVNext2,
  renderDemarrage,
  MARQUEURS_DEMARRAGE,
  renderActuel,
  extractCss,
  scaleCss,
  getVNext,
  getViewModelModule,
  getProgressionModule,
  getCarteProgression,
  SETTLE_MS,
};
