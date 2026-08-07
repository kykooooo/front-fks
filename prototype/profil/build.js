// prototype/profil/build.js
// =============================================================================
// GENERATION DE TOUTES LES PAGES DU PROTOTYPE PROFIL
// =============================================================================
//   node prototype/profil/build.js
//
// Produit dans prototype/profil/out/ :
//   index.html          le visualiseur
//   viewer.css / .js    son habillage et sa logique
//   manifest.js         tout ce que le visualiseur doit savoir
//   app.css             la feuille generee par react-native-web (echelle 1)
//   app-x13.css         la meme, tailles de texte multipliees par 1,3
//   pages/vnext/…       le Profil vNext, 7 etats x 2 variantes (pur / informe)
//                       x 2 accents (sobre / colore, suffixe _colore)
//                       x 3 largeurs x 2 vues, + les x1,3 en 375
//   pages/actuel/…      le Profil de production, 7 etats x 3 largeurs x 2 vues,
//                       + les x1,3 en 375
//   rapport.json        ce qui s'est passe pendant la generation
//
// AUCUN appel reseau, AUCUN acces Firestore : les services concernes sont
// remplaces par des stubs AVANT tout chargement (voir lib/hook.js et lib/stubs/).
//
// Filtres de mise au point (une generation partielle est SIGNALEE au manifeste) :
//   FKS_ETATS=joueur-complet,chargement   ne genere que ces etats
//   FKS_LARGEURS=375                      ne genere que ces largeurs
//   FKS_SETTLE=200                        temps de stabilisation, ms
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");

const { APP_ROOT, OUT_ROOT, ensureDirs } = require("./lib/paths");
const { DEVICES, SCALE_WIDTH, TEXT_SCALE } = require("./lib/devices");
const render = require("./lib/render");
const { pageEcran, pageErreur } = require("./lib/pageTemplate");
const scenariosProfil = require("./lib/scenariosProfil");
const { DECISIONS } = require("./lib/decisions");
const { LIMITES, STUBS_DECRITS } = require("./lib/limites");
const { viewerHtml, viewerCss, viewerJs } = require("./lib/viewerTemplate");

// ---------------------------------------------------------------------------
// Contrat : fixtures, variantes, seuils
// ---------------------------------------------------------------------------
const fixturesMod = require(path.join(APP_ROOT, "screens/profilVNext/fixtures.ts"));
const TOUTES_LES_FIXTURES =
  fixturesMod.PROFIL_VNEXT_FIXTURES_RENDU || fixturesMod.PROFIL_VNEXT_FIXTURES;

const vmMod = render.getViewModelModule();
const VARIANTES = vmMod.ok
  ? Array.from(vmMod.mod.PROFIL_VARIANTES)
  : [
      // Repli descriptif si le contrat est illisible : le build echouera de
      // toute facon sur chaque page (selecteur absent) et le dira.
      { id: "pur", libelle: "Controle pur", description: "" },
      { id: "informe", libelle: "Controle informe", description: "" },
    ];
const VARIANTE_PAR_DEFAUT = vmMod.ok ? vmMod.mod.PROFIL_VARIANTE_PAR_DEFAUT : "informe";
const SEUILS = vmMod.ok ? vmMod.mod.PROFIL_VNEXT_SEUILS : [];

// ---------------------------------------------------------------------------
// L'axe « accents » (decision D7) : sobre / colore.
// ---------------------------------------------------------------------------
// La liste vient du PRODUIT (`ACCENTS_A_COMPARER`), jamais recopiee ici. Si le
// module est illisible, seul le rendu par defaut est genere : la bascule perd
// l'axe, elle n'invente pas de reglages — et le manifeste le dit.
// ---------------------------------------------------------------------------
let accentsMod = null;
try {
  accentsMod = require(path.join(APP_ROOT, "components/profilVNext/profilVNextAccents.ts"));
} catch (err) {
  console.warn("[harnais] axe accents illisible :", err.message);
}
const ACCENTS = accentsMod ? Array.from(accentsMod.ACCENTS_A_COMPARER) : [];
const ACCENTS_PAR_DEFAUT = accentsMod ? accentsMod.ACCENTS_PAR_DEFAUT : "sobre";
/** Les accents NON par defaut : chacun produit un lot de pages suffixees. */
const ACCENTS_SUPPLEMENTAIRES = ACCENTS.filter((a) => a.id !== ACCENTS_PAR_DEFAUT);

// ---------------------------------------------------------------------------
// Largeurs : le 768 du Home est retire — le Profil se juge sur telephone.
// ---------------------------------------------------------------------------
const LARGEURS_PROFIL = [320, 375, 390];
const DEVICES_PROFIL = DEVICES.filter((d) => LARGEURS_PROFIL.indexOf(d.width) !== -1);

const FILTRE_ETATS = (process.env.FKS_ETATS || "").split(",").map((s) => s.trim()).filter(Boolean);
const FILTRE_LARGEURS = (process.env.FKS_LARGEURS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => LARGEURS_PROFIL.indexOf(n) !== -1);

const FIXTURES = FILTRE_ETATS.length
  ? TOUTES_LES_FIXTURES.filter((f) => FILTRE_ETATS.indexOf(f.id) !== -1)
  : TOUTES_LES_FIXTURES;
const DEVICES_ACTIFS = FILTRE_LARGEURS.length
  ? DEVICES_PROFIL.filter((d) => FILTRE_LARGEURS.indexOf(d.width) !== -1)
  : DEVICES_PROFIL;
const PARTIEL =
  FIXTURES.length !== TOUTES_LES_FIXTURES.length || DEVICES_ACTIFS.length !== DEVICES_PROFIL.length;

// ---------------------------------------------------------------------------
// Utilitaires de fichiers
// ---------------------------------------------------------------------------
function ecrire(rel, contenu) {
  const abs = path.join(OUT_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contenu, "utf8");
  return rel.replace(/\\/g, "/");
}

// Marque de fraicheur DERIVEE DU CODE SOURCE, pas de l'heure : meme code ->
// meme empreinte -> deux builds successifs comparables ; code modifie ->
// nouvelle empreinte -> cache navigateur correctement invalide.
function empreinteDesSources() {
  const dossiers = [
    path.join(APP_ROOT, "screens/profilVNext"),
    path.join(APP_ROOT, "components/profilVNext"),
    path.join(APP_ROOT, "prototype/profil/lib"),
    path.join(APP_ROOT, "prototype/profil"),
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
      if (!e.isFile() || !/\.(ts|tsx|js)$/.test(e.name)) continue;
      const st = fs.statSync(path.join(dossier, e.name));
      marques.push(`${e.name}:${st.size}:${Math.floor(st.mtimeMs)}`);
    }
  }
  return require("crypto").createHash("sha1").update(marques.join("|")).digest("hex").slice(0, 12);
}
const VERSION_RESSOURCES = empreinteDesSources();

/**
 * Ecrit les pages d'un rendu reussi : 2 vues a l'echelle 1, plus les 2 vues
 * x1,3 quand la largeur est celle de la comparaison de texte (375).
 * Nommage : <etat>_<variante>_<largeur>_<vue>[_colore][_x13].html — la variante
 * du Profil actuel est "actuel" et son dossier n'a pas de segment de variante.
 * `suffixeNom` (ex. "_colore") : VIDE pour l'accent par defaut — les pages deja
 * validees gardent EXACTEMENT leur nom, rien ne bouge.
 */
function ecrirePages({ dossier, variante, segments, etatId, etatTitre, etatResume, device, html, ecart, suffixeNom }) {
  const pages = {};
  const echelles = device.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
  for (const echelle of echelles) {
    for (const vue of ["visible", "entiere"]) {
      const suffixe = echelle === 1 ? "" : "_x13";
      const rel = `pages/${dossier}/${segments.join("_")}_${device.width}_${vue}${suffixeNom || ""}${suffixe}.html`;
      const contenu = pageEcran({
        variante,
        etatId,
        etatTitre,
        etatResume,
        device,
        vue,
        echelleTexte: echelle,
        html,
        cssHref: (echelle === 1 ? "../../app.css" : "../../app-x13.css") + "?v=" + VERSION_RESSOURCES,
        ecart,
      });
      pages[`${device.width}${echelle === 1 ? "" : "-x13"}-${vue}`] = ecrire(rel, contenu);
    }
  }
  return pages;
}

/** Ecrit les memes fichiers, mais en page d'explication : on ne sert jamais un ecran vide. */
function ecrirePagesErreur({ dossier, variante, segments, etatId, etatTitre, device, indisponible, viewModel, titreVm, noteVm, suffixeNom }) {
  const pages = {};
  const echelles = device.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
  for (const echelle of echelles) {
    for (const vue of ["visible", "entiere"]) {
      const suffixe = echelle === 1 ? "" : "_x13";
      const rel = `pages/${dossier}/${segments.join("_")}_${device.width}_${vue}${suffixeNom || ""}${suffixe}.html`;
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
        titreVm,
        noteVm,
      });
      pages[`${device.width}${echelle === 1 ? "" : "-x13"}-${vue}`] = ecrire(rel, contenu);
    }
  }
  return pages;
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

  ecrire(
    ".gitignore",
    "# Contenu genere par prototype/profil/build.js.\n" +
      "# Ne doit jamais etre commite : il se regenere en une commande.\n" +
      "*\n!.gitignore\n"
  );

  const rapport = {
    genereLe: process.env.FKS_DATE_FIXE || new Date().toISOString(),
    etats: [],
    alertes: [],
  };

  if (!vmMod.ok) {
    rapport.alertes.push(
      "screens/profilVNext/viewModel.ts illisible : " + String(vmMod.detail).slice(0, 300)
    );
  }
  if (!render.getProfilVNext().ok) {
    rapport.alertes.push(
      "screens/profilVNext/ProfilVNextScreen.tsx introuvable ou illisible : les pages vNext " +
        "seront des pages d'explication."
    );
  }
  if (!render.getMarqueurEcran().ok) {
    rapport.alertes.push(
      "components/profilVNext/profilVNextMarqueurs.ts illisible : le controle du marqueur " +
        "d'ecran utilise la valeur de repli « profil-vnext-ecran »."
    );
  }
  if (!accentsMod) {
    rapport.alertes.push(
      "AXE ACCENTS INDISPONIBLE — components/profilVNext/profilVNextAccents.ts n'a pas pu etre " +
        "lu. Seul le rendu par defaut (sobre) est genere : la bascule « Accents » n'aura qu'un " +
        "seul choix, et la decision D7 ne peut pas se juger a l'ecran."
    );
  }
  if (PARTIEL) {
    rapport.alertes.push(
      `GENERATION PARTIELLE — ${FIXTURES.length} etat(s) sur ${TOUTES_LES_FIXTURES.length}, ` +
        `largeur(s) ${DEVICES_ACTIFS.map((d) => d.width).join(" / ")}. ` +
        "Relance sans FKS_ETATS ni FKS_LARGEURS pour le lot complet."
    );
  }

  const etats = {};

  for (const fixture of FIXTURES) {
    const entree = {
      id: fixture.id,
      titre: fixture.titre,
      description: fixture.description,
      fictif: true,
      vnext: {},
      actuel: { pages: {} },
      // jsdom n'a aucun moteur de mise en page : la hauteur d'une page n'est
      // pas mesurable ici. Le visualiseur mesure la page REELLEMENT chargee
      // dans son cadre (meme origine) et affiche cette mesure-la.
      hauteurs: { valeur: 0, note: "non mesurable en jsdom — mesuree en direct par le visualiseur" },
    };
    for (const v of VARIANTES) {
      entree.vnext[v.id] = { disponible: true, pages: {} };
    }

    for (const device of DEVICES_ACTIFS) {
      // --- Profil vNext, une passe par variante -----------------------------
      // L'accent PAR DEFAUT (sobre) passe toujours EN PREMIER, sans prop
      // `accents` : les pages deja validees gardent leur nom ET leur chemin de
      // rendu exacts. Les accents supplementaires suivent, suffixes.
      for (const v of VARIANTES) {
        const bloc = entree.vnext[v.id];
        const rv = await render.renderProfilVNext(fixture, device, v.id);
        if (rv.viewModel && !bloc.viewModel) {
          bloc.viewModel = rv.viewModel;
          bloc.protoWarnings = rv.viewModel.protoWarnings || [];
        }
        if (rv.indisponible) {
          Object.assign(
            bloc.pages,
            ecrirePagesErreur({
              dossier: "vnext",
              variante: v.id,
              segments: [fixture.id, v.id],
              etatId: fixture.id,
              etatTitre: `${fixture.titre} — ${v.libelle}`,
              device,
              indisponible: rv.indisponible,
              viewModel: rv.viewModel,
              titreVm: "Ce que le contrat produit deja pour cet etat",
              noteVm:
                "Le selecteur (screens/profilVNext/viewModel.ts) fonctionne : voici son resultat " +
                "pour cette fixture. Il ne manque que l'ecran qui le dessine.",
            })
          );
          bloc.disponible = false;
          bloc.indisponible = rv.indisponible.titre;
        } else {
          Object.assign(
            bloc.pages,
            ecrirePages({
              dossier: "vnext",
              variante: v.id,
              segments: [fixture.id, v.id],
              etatId: fixture.id,
              etatTitre: `${fixture.titre} — ${v.libelle}`,
              etatResume: fixture.description,
              device,
              html: rv.html,
              ecart: null,
            })
          );
          if (device.width === SCALE_WIDTH) bloc.sonde = rv.sonde;
        }
        process.stdout.write(".");

        // --- les accents supplementaires (D7 : « colore ») ------------------
        for (const acc of ACCENTS_SUPPLEMENTAIRES) {
          bloc.pagesAccents = bloc.pagesAccents || {};
          bloc.pagesAccents[acc.id] = bloc.pagesAccents[acc.id] || {};
          const ra2 = await render.renderProfilVNext(fixture, device, v.id, acc.id);
          if (ra2.indisponible) {
            Object.assign(
              bloc.pagesAccents[acc.id],
              ecrirePagesErreur({
                dossier: "vnext",
                variante: v.id,
                segments: [fixture.id, v.id],
                etatId: fixture.id,
                etatTitre: `${fixture.titre} — ${v.libelle} — accents ${acc.libelle}`,
                device,
                indisponible: ra2.indisponible,
                viewModel: ra2.viewModel,
                suffixeNom: `_${acc.id}`,
              })
            );
            rapport.alertes.push(
              `${fixture.id}/${v.id}/${acc.id}@${device.width} : rendu accents indisponible — ${ra2.indisponible.titre}`
            );
          } else {
            Object.assign(
              bloc.pagesAccents[acc.id],
              ecrirePages({
                dossier: "vnext",
                variante: v.id,
                segments: [fixture.id, v.id],
                etatId: fixture.id,
                etatTitre: `${fixture.titre} — ${v.libelle} — accents ${acc.libelle}`,
                etatResume: fixture.description,
                device,
                html: ra2.html,
                ecart: null,
                suffixeNom: `_${acc.id}`,
              })
            );
          }
          process.stdout.write("+");
        }
      }

      // --- Profil actuel ----------------------------------------------------
      const scenario = scenariosProfil.getScenario(fixture.id);
      if (!scenario) {
        rapport.alertes.push(`Aucun scenario Profil actuel pour l'etat ${fixture.id}.`);
      } else {
        // Le semis AsyncStorage est refait DANS renderActuel a chaque rendu
        // (memoire partagee entre scenarios — voir lib/render.js).
        const ra = await render.renderActuel(scenario, device);
        if (ra.indisponible) {
          Object.assign(
            entree.actuel.pages,
            ecrirePagesErreur({
              dossier: "actuel",
              variante: "actuel",
              segments: [fixture.id],
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
              dossier: "actuel",
              variante: "actuel",
              segments: [fixture.id],
              etatId: fixture.id,
              etatTitre: `${fixture.titre} — vu par le Profil actuel`,
              etatResume: scenario.resume,
              device,
              html: ra.html,
              ecart: {
                titre: "Cote actuel : stores bouchonnes",
                qualite: "approximatif",
                texte:
                  "Donnees derivees de la meme fixture, versees dans des stores bouchonnes. " +
                  "Les approximations sont listees dans lib/scenariosProfil.js.",
              },
            })
          );
          if (device.width === SCALE_WIDTH) entree.actuel.sonde = ra.sonde;
        }
        process.stdout.write("o");
      }
    }

    etats[fixture.id] = entree;
    rapport.etats.push({
      id: fixture.id,
      vnext: Object.fromEntries(
        VARIANTES.map((v) => [v.id, entree.vnext[v.id].indisponible || "rendu"])
      ),
      actuel: entree.actuel.indisponible || "rendu",
      protoWarnings: Object.fromEntries(
        VARIANTES.map((v) => [v.id, (entree.vnext[v.id].protoWarnings || []).length])
      ),
    });
    process.stdout.write(` ${fixture.id}\n`);
  }

  // --- feuilles de style ----------------------------------------------------
  const css = render.extractCss();
  if (css.length < 3000) {
    rapport.alertes.push(
      `FEUILLE DE STYLE SUSPECTE : ${css.length} caracteres extraits de react-native-web. ` +
        "Les pages risquent d'etre sans style. Verifie l'ordre d'import dans lib/render.js " +
        "(jsdom AVANT react-native-web)."
    );
    console.error("\n[harnais] ALERTE : feuille de style suspecte (" + css.length + " caracteres).");
  }
  ecrire("app.css", css);
  ecrire("app-x13.css", render.scaleCss(css, TEXT_SCALE));

  // --- manifeste ------------------------------------------------------------
  const manifeste = {
    genereLe: rapport.genereLe,
    racineDepot: APP_ROOT,
    devices: DEVICES_ACTIFS,
    largeurs: DEVICES_PROFIL.map((d) => d.width),
    largeurEchelle: SCALE_WIDTH,
    echelleTexte: TEXT_SCALE,
    ordreEtats: FIXTURES.map((f) => f.id),
    etats,
    variantes: VARIANTES,
    varianteParDefaut: VARIANTE_PAR_DEFAUT,
    vues: ["visible", "entiere"],
    // L'axe accents (D7) : libelles et defaut lus dans le PRODUIT
    // (profilVNextAccents.ts) — jamais recopies ici.
    accents: ACCENTS,
    accentsLibelles: accentsMod ? accentsMod.ACCENTS_LIBELLES : {},
    accentsParDefaut: ACCENTS_PAR_DEFAUT,
    decisions: DECISIONS,
    seuils: SEUILS,
    seuilsNote:
      "Le Profil refondu n'a AUCUN seuil d'affichage, et c'est une propriete du design : un " +
      "ecran de controle n'affiche que des faits d'etat, aucun n'exige un volume minimal de " +
      "donnees pour etre honnete. Le tableau est publie vide pour que le jour ou un seuil " +
      "apparait, il soit nomme dans le contrat et nulle part ailleurs.",
    limites: LIMITES,
    stubs: STUBS_DECRITS,
    approximations: scenariosProfil.APPROXIMATIONS,
    horlogeFictive: {
      iso: fixturesMod.FIXTURE_NOW_ISO,
      jour: fixturesMod.FIXTURE_TODAY_KEY,
      texte: "mercredi 6 aout 2026, 18 h 30",
    },
    alertes: rapport.alertes,
    tempsDeStabilisationMs: render.SETTLE_MS,
  };

  ecrire("manifest.js", `window.__FKS_MANIFEST__ = ${JSON.stringify(manifeste, null, 1)};\n`);
  ecrire("viewer.css", viewerCss());
  ecrire("viewer.js", viewerJs());
  ecrire("index.html", viewerHtml(VERSION_RESSOURCES));
  ecrire("rapport.json", JSON.stringify(rapport, null, 2));

  const secondes = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nTermine en ${secondes} s.`);
  console.log(`Sortie : ${OUT_ROOT}`);
  if (rapport.alertes.length) {
    console.log("\nAlertes :");
    rapport.alertes.forEach((a) => console.log("  - " + a));
  }
  console.log("\nPour regarder : node prototype/profil/serve.js");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
