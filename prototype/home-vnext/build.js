// prototype/home-vnext/build.js
// =============================================================================
// GENERATION DE TOUTES LES PAGES DU PROTOTYPE
// =============================================================================
//   node prototype/home-vnext/build.js
//
// Produit dans prototype/home-vnext/out/ :
//   index.html          le visualiseur
//   viewer.css / .js    son habillage et sa logique
//   manifest.js         tout ce que le visualiseur doit savoir
//   app.css             la feuille generee par react-native-web (echelle 1)
//   app-x13.css         la meme, tailles de texte multipliees par 1,3
//   pages/vnext/…       la proposition, un fichier par etat/largeur/vue
//   pages/actuel/…      le Home de production, meme decoupage
//   rapport.json        ce qui s'est passe pendant la generation
//
// AUCUN appel reseau, AUCUN acces Firestore, AUCUNE generation de seance :
// les services concernes sont remplaces par des stubs AVANT tout chargement
// (voir lib/hook.js et lib/stubs/).
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");

const { APP_ROOT, OUT_ROOT, ensureDirs } = require("./lib/paths");
const { DEVICES, WIDTHS, SCALE_WIDTH, TEXT_SCALE, getDevice } = require("./lib/devices");
const render = require("./lib/render");
const { pageEcran, pageErreur } = require("./lib/pageTemplate");
const scenariosActuel = require("./lib/scenariosActuel");
const { MAPPING, EXTRAS_ACTUEL, byFixture } = require("./lib/mapping");
const { POINTS } = require("./lib/pointsAValider");
const { viewerHtml, viewerCss, viewerJs } = require("./lib/viewerTemplate");
const { LIMITES, STUBS_DECRITS } = require("./lib/limites");

// ---------------------------------------------------------------------------
// Contrat : fixtures, seuils, jetons visuels
// ---------------------------------------------------------------------------
const fixturesMod = require(path.join(APP_ROOT, "screens/homeVNext/fixtures.ts"));
const vmMod = render.getViewModelModule();
let tokens = null;
try {
  tokens = require(path.join(APP_ROOT, "components/homeVNext/homeVNextTokens.ts"));
} catch (err) {
  console.warn("[harnais] jetons visuels illisibles :", err.message);
}

// Les 14 etats produit PLUS le cas de resistance aux textes longs
// (`stress-textes-longs`). Ce dernier n'est pas un etat du produit : il est
// expose separement par `fixtures.ts` pour que le contrat continue de compter
// 14 etats, et le harnais le rend en plus pour qu'on puisse le regarder.
const TOUTES_LES_FIXTURES = fixturesMod.HOME_VNEXT_FIXTURES_RENDU || fixturesMod.HOME_VNEXT_FIXTURES;

// ---------------------------------------------------------------------------
// Filtres de mise au point (facultatifs) — pour iterer vite pendant le travail.
// Une generation partielle est SIGNALEE dans le manifeste : le visualiseur
// affiche alors un avertissement, on ne peut pas croire par erreur qu'on
// regarde le lot complet.
//   FKS_ETATS=seance-prevue-aujourdhui,hors-ligne  node prototype/home-vnext/build.js
//   FKS_LARGEURS=375                               node prototype/home-vnext/build.js
//   FKS_SETTLE=200                                 (temps de stabilisation, ms)
// ---------------------------------------------------------------------------
const FILTRE_ETATS = (process.env.FKS_ETATS || "").split(",").map((s) => s.trim()).filter(Boolean);
const FILTRE_LARGEURS = (process.env.FKS_LARGEURS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => WIDTHS.indexOf(n) !== -1);

const FIXTURES = FILTRE_ETATS.length
  ? TOUTES_LES_FIXTURES.filter((f) => FILTRE_ETATS.indexOf(f.id) !== -1)
  : TOUTES_LES_FIXTURES;
const DEVICES_ACTIFS = FILTRE_LARGEURS.length
  ? DEVICES.filter((d) => FILTRE_LARGEURS.indexOf(d.width) !== -1)
  : DEVICES;
const PARTIEL = FIXTURES.length !== TOUTES_LES_FIXTURES.length || DEVICES_ACTIFS.length !== DEVICES.length;

// ---------------------------------------------------------------------------
// Regroupement des etats pour la liste laterale
// ---------------------------------------------------------------------------
const GROUPES = [
  {
    titre: "Le quotidien",
    aide: "Les journees ordinaires. C'est 90 % de l'usage reel.",
    etats: [
      "seance-prevue-aujourdhui",
      "seance-a-reprendre",
      "seance-terminee",
      "jour-recuperation",
      "jour-sans-seance",
    ],
  },
  {
    titre: "Premiers pas et retour",
    aide: "Le compte tout neuf, et le joueur qui revient apres une coupure.",
    etats: ["nouveau-joueur", "reprise-longue-interruption"],
  },
  {
    titre: "Ce que l'app sait mesurer",
    aide: "Avec ou sans assez de donnees pour parler de forme.",
    etats: ["tendance-indisponible", "tendance-disponible"],
  },
  {
    titre: "Quand ca casse",
    aide: "Echec de preparation, absence de reseau.",
    etats: ["erreur-generation", "hors-ligne"],
  },
  {
    titre: "Avec ou sans club",
    aide: "Le Home ne doit jamais dependre d'un suivi club.",
    etats: [
      "directive-club-absente",
      "directive-club-non-appliquee",
      "joueur-autonome-sans-club",
    ],
  },
  {
    titre: "Resistance de la mise en page",
    aide: "Pas un etat produit : des textes pousses a la limite, pour voir ce qui casse.",
    etats: ["stress-textes-longs"],
  },
];

// ---------------------------------------------------------------------------
// Utilitaires de fichiers
// ---------------------------------------------------------------------------
function ecrire(rel, contenu) {
  const abs = path.join(OUT_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contenu, "utf8");
  return rel.replace(/\\/g, "/");
}

function nomPage(etatId, width, vue, scale) {
  const suffixe = scale === 1 ? "" : `-x${String(scale).replace(".", "")}`;
  return `${etatId}-${width}${suffixe}-${vue}.html`;
}

// ---------------------------------------------------------------------------
// Marque de fraicheur ajoutee aux feuilles de style : sans elle, un navigateur
// qui a deja ouvert le prototype ressert l'ancien CSS apres un nouveau build.
//
// Elle est DERIVEE DU CODE SOURCE, pas de l'heure. Deux raisons :
//   1. `Date.now()` changeait a chaque build, donc deux builds successifs sans
//      la moindre modification produisaient 310 fichiers differents. Impossible
//      de verifier qu'une generation est reproductible.
//   2. Elle changeait aussi quand rien n'avait bouge, ce qui vidait le cache du
//      navigateur pour rien.
// Ici : empreinte des dates de modification des sources qui influencent le
// rendu. Meme code -> meme empreinte -> meme sortie. Code modifie -> nouvelle
// empreinte -> cache correctement invalide.
// ---------------------------------------------------------------------------
function empreinteDesSources() {
  const dossiers = [
    path.join(APP_ROOT, "screens/homeVNext"),
    path.join(APP_ROOT, "components/homeVNext"),
    path.join(APP_ROOT, "prototype/home-vnext/lib"),
    path.join(APP_ROOT, "prototype/home-vnext"),
  ];
  const marques = [];
  for (const dossier of dossiers) {
    let entrees = [];
    try {
      entrees = fs.readdirSync(dossier, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entrees.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isFile()) continue;
      if (!/\.(ts|tsx|js)$/.test(e.name)) continue;
      const st = fs.statSync(path.join(dossier, e.name));
      marques.push(`${e.name}:${st.size}:${Math.floor(st.mtimeMs)}`);
    }
  }
  return require("crypto").createHash("sha1").update(marques.join("|")).digest("hex").slice(0, 12);
}

const VERSION_RESSOURCES = empreinteDesSources();

// ---------------------------------------------------------------------------
// Ecriture des 4 fichiers (2 vues x 2 echelles) d'un rendu
// ---------------------------------------------------------------------------
function ecrirePages({ variante, etatId, etatTitre, etatResume, device, html, ecart }) {
  const pages = {};
  const echelles = device.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
  for (const echelle of echelles) {
    for (const vue of ["visible", "entiere"]) {
      const rel = `pages/${variante}/${nomPage(etatId, device.width, vue, echelle)}`;
      const contenu = pageEcran({
        variante,
        etatId,
        etatTitre,
        etatResume,
        device,
        vue,
        echelleTexte: echelle,
        html,
        cssHref:
          (echelle === 1 ? "../../app.css" : "../../app-x13.css") + "?v=" + VERSION_RESSOURCES,
        ecart,
      });
      pages[`${device.width}${echelle === 1 ? "" : "-x13"}-${vue}`] = ecrire(rel, contenu);
    }
  }
  return pages;
}

function ecrirePagesErreur({ variante, etatId, etatTitre, device, indisponible, viewModel }) {
  const pages = {};
  const echelles = device.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
  for (const echelle of echelles) {
    for (const vue of ["visible", "entiere"]) {
      const rel = `pages/${variante}/${nomPage(etatId, device.width, vue, echelle)}`;
      const contenu = pageErreur({
        variante,
        etatId,
        etatTitre,
        device,
        vue,
        titre: indisponible.titre,
        message: indisponible.message,
        detail: indisponible.detail,
        viewModel,
      });
      pages[`${device.width}${echelle === 1 ? "" : "-x13"}-${vue}`] = ecrire(rel, contenu);
    }
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Resume lisible d'un ViewModel (panneau du visualiseur)
// ---------------------------------------------------------------------------
function resumerViewModel(vm) {
  if (!vm) return null;
  return {
    etatDesDonnees: vm.dataState,
    avisDonnees: vm.dataNotice,
    salutation: vm.header && vm.header.greeting,
    pastilleEtat: vm.header && vm.header.stateChip ? vm.header.stateChip.label : null,
    action: vm.action
      ? {
          libelle: vm.action.label,
          sousLibelle: vm.action.sublabel,
          nature: vm.action.kind,
          emphase: vm.action.emphasis,
          secondaire: vm.action.secondary ? vm.action.secondary.label : null,
        }
      : null,
    pourquoi: vm.why ? { texte: vm.why.text, source: vm.why.source } : null,
    cycle: vm.cycle ? { nature: vm.cycle.kind, libelle: vm.cycle.cycleLabel } : null,
    semaine: vm.week ? `${vm.week.doneCount} / ${vm.week.goalCount} — ${vm.week.message}` : null,
    forme: vm.form
      ? vm.form.kind === "available"
        ? `courbe affichee (${vm.form.points.length} points) — ${vm.form.scope}`
        : `pas de courbe — ${vm.form.title} (${vm.form.reason})`
      : "aucun bloc forme",
    conseil: vm.note ? `${vm.note.title} — ${vm.note.message}` : null,
    sortie: vm.exit ? vm.exit.label : null,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  ensureDirs();

  // On repart d'un dossier propre : sinon une page d'un ancien build survit et
  // le fondateur regarde un ecran perime sans le savoir.
  const pagesDir = path.join(OUT_ROOT, "pages");
  if (fs.existsSync(pagesDir)) fs.rmSync(pagesDir, { recursive: true, force: true });

  // Le contenu genere ne doit jamais partir dans un commit. On pose un
  // .gitignore LOCAL au dossier de sortie : le .gitignore de la racine du depot
  // n'est pas touche.
  ecrire(
    ".gitignore",
    "# Contenu genere par prototype/home-vnext/build.js.\n" +
      "# Ne doit jamais etre commite : il se regenere en une commande.\n" +
      "*\n!.gitignore\n"
  );

  const scenarios = scenariosActuel.build();
  const scenarioById = new Map(scenarios.map((s) => [s.id, s]));

  const etats = {};
  // La date de generation est la SEULE valeur volatile de la sortie. Elle est
  // utile au fondateur (« ce que je regarde date de quand ? ») mais elle rend
  // deux builds successifs non comparables au bit pres. `FKS_DATE_FIXE` la fige
  // le temps d'une verification de reproductibilite. Voir verifier.js.
  const rapport = {
    genereLe: process.env.FKS_DATE_FIXE || new Date().toISOString(),
    etats: [],
    alertes: [],
  };

  const groupeDe = (id) => {
    const g = GROUPES.find((x) => x.etats.includes(id));
    return g ? g.titre : "Autres";
  };

  const vnextDispo = render.getVNext().ok;
  if (!vnextDispo) {
    rapport.alertes.push(
      "screens/homeVNext/HomeVNextScreen.tsx introuvable ou illisible : la variante « Proposition vNext » " +
        "affiche des pages d'explication a la place de l'ecran."
    );
  }
  if (PARTIEL) {
    rapport.alertes.push(
      `GENERATION PARTIELLE — ${FIXTURES.length} etat(s) sur ${TOUTES_LES_FIXTURES.length}, ` +
        `largeur(s) ${DEVICES_ACTIFS.map((d) => d.width).join(" / ")}. ` +
        "Relance sans FKS_ETATS ni FKS_LARGEURS pour le lot complet."
    );
  }

  // --- les 14 etats ---------------------------------------------------------
  for (const fixture of FIXTURES) {
    const corr = byFixture(fixture.id);
    const scenario = corr ? scenarioById.get(corr.scenario) : null;
    if (corr && !scenario) {
      rapport.alertes.push(`Scenario « ${corr.scenario} » introuvable pour l'etat ${fixture.id}.`);
    }

    const entree = {
      id: fixture.id,
      titre: fixture.titre,
      resume: fixture.resume,
      groupe: groupeDe(fixture.id),
      fictif: true,
      vnext: { disponible: vnextDispo, pages: {} },
      actuel: {
        scenarioId: corr ? corr.scenario : null,
        scenarioTitre: scenario ? scenario.titre : null,
        scenarioResume: scenario ? scenario.resume : null,
        qualite: corr ? corr.qualite : "inexistant",
        ecart: corr ? corr.ecart : "Aucune correspondance definie.",
        derive: scenario && scenario.derive ? scenario.derive : null,
        pages: {},
      },
    };

    for (const device of DEVICES_ACTIFS) {
      // --- proposition ---
      const rv = await render.renderVNext(fixture, device);
      if (rv.viewModel && !entree.vnext.viewModel) {
        entree.vnext.viewModel = resumerViewModel(rv.viewModel);
        entree.vnext.protoWarnings = rv.viewModel.protoWarnings || [];
      }
      if (rv.indisponible) {
        Object.assign(
          entree.vnext.pages,
          ecrirePagesErreur({
            variante: "vnext",
            etatId: fixture.id,
            etatTitre: fixture.titre,
            device,
            indisponible: rv.indisponible,
            viewModel: rv.viewModel,
          })
        );
        entree.vnext.disponible = false;
        entree.vnext.indisponible = rv.indisponible.titre;
      } else {
        Object.assign(
          entree.vnext.pages,
          ecrirePages({
            variante: "vnext",
            etatId: fixture.id,
            etatTitre: fixture.titre,
            etatResume: fixture.resume,
            device,
            html: rv.html,
            ecart: null,
          })
        );
        if (device.width === SCALE_WIDTH) entree.vnext.sonde = rv.sonde;
      }

      // --- home actuel ---
      if (scenario) {
        const ra = await render.renderActuel(scenario, device);
        const ecart =
          corr.qualite === "exact" ? null : { qualite: corr.qualite, texte: corr.ecart };
        if (ra.indisponible) {
          Object.assign(
            entree.actuel.pages,
            ecrirePagesErreur({
              variante: "actuel",
              etatId: fixture.id,
              etatTitre: fixture.titre,
              device,
              indisponible: ra.indisponible,
              viewModel: null,
            })
          );
          entree.actuel.indisponible = ra.indisponible.titre;
        } else {
          Object.assign(
            entree.actuel.pages,
            ecrirePages({
              variante: "actuel",
              etatId: fixture.id,
              etatTitre: `${fixture.titre} — vu par le Home actuel`,
              etatResume: scenario.resume,
              device,
              html: ra.html,
              ecart,
            })
          );
          if (device.width === SCALE_WIDTH) entree.actuel.sonde = ra.sonde;
        }
      }
      process.stdout.write(".");
    }

    etats[fixture.id] = entree;
    rapport.etats.push({
      id: fixture.id,
      vnext: entree.vnext.indisponible || "rendu",
      actuel: entree.actuel.indisponible || "rendu",
      blocsVNext: entree.vnext.sonde ? entree.vnext.sonde.blocs.length : 0,
      chaineVNext: entree.vnext.sonde ? entree.vnext.sonde.chainLength : null,
      blocsActuel: entree.actuel.sonde ? entree.actuel.sonde.blocs.length : 0,
      chaineActuel: entree.actuel.sonde ? entree.actuel.sonde.chainLength : null,
      protoWarnings: entree.vnext.protoWarnings ? entree.vnext.protoWarnings.length : 0,
    });
    process.stdout.write(` ${fixture.id}\n`);
  }

  // --- extras : etats du Home actuel sans contrepartie vNext -----------------
  const extras = [];
  for (const extra of EXTRAS_ACTUEL) {
    const scenario = scenarioById.get(extra.scenario);
    if (!scenario) continue;
    const entree = {
      id: `extra-${scenario.id}`,
      titre: scenario.titre,
      resume: scenario.resume,
      pourquoi: extra.pourquoi,
      actuel: { pages: {} },
    };
    for (const device of DEVICES_ACTIFS) {
      const ra = await render.renderActuel(scenario, device);
      if (ra.indisponible) {
        Object.assign(
          entree.actuel.pages,
          ecrirePagesErreur({
            variante: "actuel",
            etatId: entree.id,
            etatTitre: scenario.titre,
            device,
            indisponible: ra.indisponible,
            viewModel: null,
          })
        );
      } else {
        Object.assign(
          entree.actuel.pages,
          ecrirePages({
            variante: "actuel",
            etatId: entree.id,
            etatTitre: scenario.titre,
            etatResume: scenario.resume,
            device,
            html: ra.html,
            ecart: {
              qualite: "inexistant",
              texte:
                "Etat du Home actuel sans contrepartie dans les 14 fixtures du prototype. " +
                extra.pourquoi,
            },
          })
        );
      }
      process.stdout.write(".");
    }
    extras.push(entree);
    process.stdout.write(` ${entree.id}\n`);
  }

  // --- feuilles de style ----------------------------------------------------
  const css = render.extractCss();
  // Garde-fou : sans feuille de style, les pages s'affichent en texte brut et
  // le fondateur regarde n'importe quoi. On refuse de laisser passer ca en
  // silence.
  if (css.length < 3000) {
    rapport.alertes.push(
      `Feuille de style suspecte : ${css.length} caracteres extraits de react-native-web. ` +
        "Les pages risquent d'etre sans style. Verifie l'ordre d'import dans lib/render.js."
    );
  }
  ecrire("app.css", css);
  ecrire("app-x13.css", render.scaleCss(css, TEXT_SCALE));

  // --- manifeste ------------------------------------------------------------
  const manifeste = {
    genereLe: rapport.genereLe,
    racineDepot: APP_ROOT,
    devices: DEVICES_ACTIFS,
    largeurs: WIDTHS,
    largeurEchelle: SCALE_WIDTH,
    echelleTexte: TEXT_SCALE,
    groupes: GROUPES,
    ordreEtats: FIXTURES.map((f) => f.id),
    etats,
    extras,
    seuils: vmMod.ok ? vmMod.mod.HOME_VNEXT_SEUILS : [],
    ordreSections: vmMod.ok ? vmMod.mod.HOME_VNEXT_SECTION_ORDER : [],
    reglesDeRendu: tokens ? tokens.REGLES_DE_RENDU : [],
    contrastes: tokens ? tokens.CONTRASTES_MESURES : [],
    seuilContrasteAA: tokens ? tokens.SEUIL_CONTRASTE_AA : 4.5,
    tailleTactileMin: tokens ? tokens.TAILLE_TACTILE_MIN : 44,
    couleurAction: tokens ? tokens.couleurs.action : null,
    points: POINTS,
    limites: LIMITES,
    stubs: STUBS_DECRITS,
    horlogeFictive: {
      iso: fixturesMod.FIXTURE_NOW_ISO,
      jour: fixturesMod.FIXTURE_TODAY_KEY,
      texte: "jeudi 30 juillet 2026, 9 h 15",
    },
    alertes: rapport.alertes,
    tempsDeStabilisationMs: render.SETTLE_MS,
  };

  ecrire("manifest.js", `window.__FKS_MANIFEST__ = ${JSON.stringify(manifeste, null, 1)};\n`);
  ecrire("viewer.css", viewerCss());
  ecrire("viewer.js", viewerJs());
  ecrire("index.html", viewerHtml(rapport.genereLe));
  ecrire("rapport.json", JSON.stringify(rapport, null, 2));

  const secondes = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nTermine en ${secondes} s.`);
  console.log(`Sortie : ${OUT_ROOT}`);
  if (rapport.alertes.length) {
    console.log("\nAlertes :");
    rapport.alertes.forEach((a) => console.log("  - " + a));
  }
  console.log("\nPour regarder : node prototype/home-vnext/serve.js");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
