// prototype/profil/verifier.js
// =============================================================================
// LE VERIFICATEUR DU PROTOTYPE PROFIL — ON MESURE, ON NE DEVINE PAS
// =============================================================================
//   node prototype/profil/verifier.js               # tout
//   node prototype/profil/verifier.js typescript    # type-check cible
//   node prototype/profil/verifier.js tests         # tests du prototype
//   node prototype/profil/verifier.js statique      # analyse HTML, sans navigateur
//   node prototype/profil/verifier.js mesures       # mesures dans un vrai navigateur
//   node prototype/profil/verifier.js idempotence   # deux builds, empreintes comparees
//
// Verdict CHIFFRE : PASS / FAIL / NON_EXECUTE avec sa raison — jamais PASS par
// defaut. Moteur de mesure repris du verificateur du Home : jsdom pour le
// textuel, Chrome/Edge sans interface (--dump-dom + lib/mesureTemplate.js) pour
// tout ce qui est geometrique — jsdom n'a aucun moteur de mise en page, toute
// hauteur y vaut 0.
//
// Ecritures : out/_verif/ (journal) et outputs/profil-prototype-2026-08-07/
// (le tableau de hauteurs). Aucun reseau au-dela de 127.0.0.1.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");
const { DEVICES } = require("./lib/devices");
const { mesureHtml } = require("./lib/mesureTemplate");

// ---------------------------------------------------------------------------
// Reglages
// ---------------------------------------------------------------------------
const SEUIL_CONTRASTE_AA = 4.5;
const SEUIL_CONTRASTE_AA_GRAND = 3.0;
const TAILLE_TACTILE_MIN = 44;
const DOSSIER_VERIF = path.join(OUT_ROOT, "_verif");
const DOSSIER_LIVRABLE = path.join(APP_ROOT, "outputs/profil-prototype-2026-08-07");

const LARGEURS_PROFIL = [320, 375, 390];
const DEVICES_PROFIL = DEVICES.filter((d) => LARGEURS_PROFIL.indexOf(d.width) !== -1);
const SCALE_WIDTH = 375;
const TEXT_SCALE = 1.3;

const NAVIGATEURS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

// ---------------------------------------------------------------------------
// Contrat
// ---------------------------------------------------------------------------
require("./lib/hook"); // permet de `require` du TypeScript
const fixturesMod = require(path.join(APP_ROOT, "screens/profilVNext/fixtures.ts"));
const vmMod = require(path.join(APP_ROOT, "screens/profilVNext/viewModel.ts"));
const { FOOTBALL_LABELS } = require(path.join(APP_ROOT, "config/trainingDefaults.ts"));

const FIXTURES = fixturesMod.PROFIL_VNEXT_FIXTURES_RENDU || fixturesMod.PROFIL_VNEXT_FIXTURES;
const VARIANTES = Array.from(vmMod.PROFIL_VARIANTES); // pur / informe

// L'axe accents (D7) — lu dans le produit, comme au build. S'il est illisible,
// seules les pages sobres sont attendues (et le build l'aura signale).
let accentsMod = null;
try {
  accentsMod = require(path.join(APP_ROOT, "components/profilVNext/profilVNextAccents.ts"));
} catch (_) {
  accentsMod = null;
}
const ACCENTS_PAR_DEFAUT = accentsMod ? accentsMod.ACCENTS_PAR_DEFAUT : "sobre";
const ACCENTS_IDS = accentsMod
  ? Array.from(accentsMod.ACCENTS_A_COMPARER).map((a) => a.id)
  : [ACCENTS_PAR_DEFAUT];
/** Suffixe de nom de fichier d'un accent ("" pour le defaut). */
const suffixeAccent = (accId) => (accId === ACCENTS_PAR_DEFAUT ? "" : `_${accId}`);

// La couleur des pilules du mode colore, lue dans le THEME (jamais recopiee) :
// texte = accent, fond = accentSoft compose sur le fond de carte (blanc).
const { theme } = require(path.join(APP_ROOT, "constants/theme.ts"));
function hexVersRgbTexte(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
  if (!m) return null;
  return `rgb(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)})`;
}
const FOND_PILULE = hexVersRgbTexte(theme.colors.accentSoft);
const TEXTE_PILULE = theme.colors.accent;

/** Un ViewModel par (etat, variante). */
const VM = new Map();
for (const f of FIXTURES) {
  for (const v of VARIANTES) {
    VM.set(`${f.id}|${v.id}`, vmMod.buildProfilVNextViewModel(f.input, { variante: v.id }));
  }
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
const verifications = [];
function noter(nom, resultat, detail) {
  verifications.push({ nom, resultat, detail });
  const marque = resultat === "PASS" ? "  OK  " : resultat === "FAIL" ? " FAIL " : " N/E  ";
  console.log(`[${marque}] ${nom}`);
  for (const ligne of String(detail).split("\n")) console.log(`         ${ligne}`);
}

// ---------------------------------------------------------------------------
// Serveur local ephemere (127.0.0.1 uniquement, port attribue par le systeme)
// ---------------------------------------------------------------------------
function demarrerServeur() {
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  const serveur = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const fichier = path.join(OUT_ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
    if (!fichier.startsWith(OUT_ROOT)) {
      res.writeHead(403).end("interdit");
      return;
    }
    fs.readFile(fichier, (err, buf) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" }).end("404");
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(fichier)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    serveur.listen(0, "127.0.0.1", () => resolve({ serveur, port: serveur.address().port }));
  });
}

// ---------------------------------------------------------------------------
// 1. INVENTAIRE DES PAGES ATTENDUES (nommage de build.js)
// ---------------------------------------------------------------------------
function pagesAttendues() {
  const liste = [];
  for (const f of FIXTURES) {
    for (const d of DEVICES_PROFIL) {
      const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
      for (const echelle of echelles) {
        const suffixe = echelle === 1 ? "" : "_x13";
        for (const vue of ["visible", "entiere"]) {
          for (const v of VARIANTES) {
            for (const accId of ACCENTS_IDS) {
              liste.push({
                variante: v.id,
                accents: accId,
                etat: f.id,
                largeur: d.width,
                echelle,
                vue,
                hauteurVisible: d.stageVisible,
                fichier: `pages/vnext/${f.id}_${v.id}_${d.width}_${vue}${suffixeAccent(accId)}${suffixe}.html`,
              });
            }
          }
          liste.push({
            variante: "actuel",
            accents: null,
            etat: f.id,
            largeur: d.width,
            echelle,
            vue,
            hauteurVisible: d.stageVisible,
            fichier: `pages/actuel/${f.id}_${d.width}_${vue}${suffixe}.html`,
          });
        }
      }
    }
  }
  return liste;
}

// ---------------------------------------------------------------------------
// 2. ANALYSE STATIQUE (jsdom — textuel seulement)
// ---------------------------------------------------------------------------
const { JSDOM } = require("jsdom");

/** Texte visible de l'ecran seul (pas le bloc d'identification sous le cadre). */
function texteEcran(html) {
  const dom = new JSDOM(html);
  const device = dom.window.document.querySelector(".device");
  return device ? (device.textContent || "").replace(/\s+/g, " ") : "";
}

// ---------------------------------------------------------------------------
// 3. MESURES DANS UN VRAI NAVIGATEUR (moteur du Home, repris tel quel)
// ---------------------------------------------------------------------------
function trouverNavigateur() {
  return NAVIGATEURS.find((p) => fs.existsSync(p)) || null;
}

// `spawn` et non `spawnSync` : avec spawnSync, Node se fige, le petit serveur ne
// repond plus et Chrome ne recoit jamais la page de mesure (piege du Home).
function lancerNavigateur(navigateur, args) {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const p = spawn(navigateur, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    p.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    const minuteur = setTimeout(() => {
      p.kill();
      resolve({ stdout, stderr: stderr + "\n[verificateur] delai depasse (5 min), navigateur arrete." });
    }, 300000);
    p.on("close", () => {
      clearTimeout(minuteur);
      resolve({ stdout, stderr });
    });
    p.on("error", (e) => {
      clearTimeout(minuteur);
      resolve({ stdout, stderr: stderr + String(e) });
    });
  });
}

async function mesurer(pages, port) {
  const navigateur = trouverNavigateur();
  if (!navigateur) return { ok: false, raison: "aucun navigateur Chrome/Edge trouve sur la machine" };

  const cibles = pages.map((p) => ({
    cle: cle(p),
    url: `/${p.fichier}`,
    largeur: p.largeur,
    hauteurVisible: p.hauteurVisible,
  }));

  fs.mkdirSync(DOSSIER_VERIF, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_VERIF, "mesures.html"), mesureHtml(cibles), "utf8");

  const profil = path.join(require("os").tmpdir(), "fks-profil-chrome");
  const res = await lancerNavigateur(navigateur, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-extensions",
    `--user-data-dir=${profil}`,
    "--dump-dom",
    `http://127.0.0.1:${port}/_verif/mesures.html`,
  ]);

  const sortie = res.stdout || "";
  const debut = sortie.indexOf("###JSON###");
  const fin = sortie.indexOf("###FIN###");
  if (debut === -1 || fin === -1) {
    return {
      ok: false,
      raison:
        "le navigateur n'a pas rendu de JSON. Sortie tronquee : " +
        (sortie.slice(0, 400) || "(vide)") +
        (res.stderr ? " | stderr: " + res.stderr.slice(0, 400) : ""),
    };
  }
  const brut = sortie.slice(debut + "###JSON###".length, fin);
  const json = brut
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  try {
    return { ok: true, navigateur, mesures: JSON.parse(json) };
  } catch (e) {
    return { ok: false, raison: "JSON illisible : " + e.message };
  }
}

function cle(p) {
  // L'accent non-defaut entre dans la cle : sans lui, la page coloree d'une
  // variante ECRASERAIT la mesure de la page sobre dans la table des resultats.
  const acc = p.accents && p.accents !== ACCENTS_PAR_DEFAUT ? `+${p.accents}` : "";
  return `${p.variante}${acc}|${p.etat}|${p.largeur}|${p.echelle}|${p.vue}`;
}

// ---------------------------------------------------------------------------
// (f3) La liste ECRITE A LA MAIN des chemins autorises du ViewModel
// ---------------------------------------------------------------------------
// Copie de __tests__/profilVNext/viewModel.test.ts, JAMAIS derivee de la
// sortie : un instantane genere validerait n'importe quel ajout futur. Le test
// verrouille le contrat au moment ou on code ; ce verificateur verrouille ce
// qui est reellement PUBLIE par le harnais.
// ---------------------------------------------------------------------------
const CHEMINS_AUTORISES = new Set([
  "variante",
  "identite",
  "identite.kind",
  "identite.prenom",
  "identite.poste",
  "identite.niveau",
  "identite.pied",
  "identite.objectif",
  "rythme",
  "rythme.fksParSemaine",
  "rythme.clubParSemaine",
  "rythme.matchsParSemaine",
  "controles",
  "controles[]",
  "controles[].id",
  "controles[].label",
  "controles[].fait",
  "controles[].fait.texte",
  "controles[].fait.source",
  "controles[].cible",
  "protoWarnings",
  "protoWarnings[]",
]);

function cheminsPresents(obj, prefixe, sortie) {
  if (obj === null || typeof obj !== "object") return sortie;
  if (Array.isArray(obj)) {
    sortie.add(prefixe + "[]");
    for (const x of obj) cheminsPresents(x, prefixe + "[]", sortie);
    return sortie;
  }
  for (const k of Object.keys(obj)) {
    const p = prefixe ? `${prefixe}.${k}` : k;
    sortie.add(p);
    cheminsPresents(obj[k], p, sortie);
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const quoi = (process.argv[2] || "tout").toLowerCase();
  const faire = (nom) => quoi === "tout" || quoi === nom;

  console.log("");
  console.log("  VERIFICATION DU PROTOTYPE PROFIL vNEXT");
  console.log(`  ${FIXTURES.length} etats · ${VARIANTES.map((v) => v.id).join(" / ")} · ${LARGEURS_PROFIL.join(" / ")} px`);
  console.log("");

  const pages = pagesAttendues();

  // -------------------------------------------------------------------------
  // (a) TypeScript
  // -------------------------------------------------------------------------
  if (faire("typescript")) {
    const tsc = path.join(APP_ROOT, "../../../node_modules/.bin/tsc.cmd");
    if (!fs.existsSync(tsc)) {
      noter("a) TypeScript du prototype", "NON_EXECUTE", `binaire tsc introuvable : ${tsc}`);
    } else {
      const r = spawnSync(tsc, ["--noEmit", "-p", path.join(__dirname, "tsconfig.proto.json")], {
        encoding: "utf8",
        cwd: APP_ROOT,
        timeout: 600000,
        shell: true,
      });
      const lignes = (r.stdout || "").split("\n").filter((l) => /error TS/.test(l));
      noter(
        "a) TypeScript du prototype",
        lignes.length === 0 ? "PASS" : "FAIL",
        `npx tsc --noEmit -p prototype/profil/tsconfig.proto.json\n` +
          `${lignes.length} erreur(s) REELLE(S) sur screens/profilVNext + components/profilVNext + __tests__/profilVNext.` +
          (lignes.length ? "\n" + lignes.slice(0, 20).join("\n") : "")
      );
    }
  }

  // -------------------------------------------------------------------------
  // (b) Tests
  // -------------------------------------------------------------------------
  if (faire("tests")) {
    const jest = path.join(APP_ROOT, "../../../node_modules/.bin/jest.cmd");
    if (!fs.existsSync(jest)) {
      noter("b) Tests du prototype", "NON_EXECUTE", `binaire jest introuvable : ${jest}`);
    } else {
      // NODE_ENV EXPLICITE : lib/hook.js pose NODE_ENV=production dans CE
      // processus (le rendu en a besoin). Sans NODE_ENV=test, la valeur fuit
      // dans jest, react-test-renderer passe en mode production et des dizaines
      // de tests tombent a tort (piege mesure au Home).
      const r = spawnSync(jest, ["--config", path.join(__dirname, "jest.proto.config.js"), "--forceExit"], {
        encoding: "utf8",
        cwd: APP_ROOT,
        timeout: 900000,
        shell: true,
        env: { ...process.env, NODE_ENV: "test" },
      });
      const flux = (r.stdout || "") + (r.stderr || "");
      const suites = flux.match(/Test Suites:\s*(.+)/);
      const tests = flux.match(/Tests:\s*(.+)/);
      const echecs = /failed/.test(suites ? suites[1] : "") || /failed/.test(tests ? tests[1] : "");
      noter(
        "b) Tests du prototype",
        r.status === 0 && !echecs ? "PASS" : "FAIL",
        `npx jest --config prototype/profil/jest.proto.config.js\n` +
          `${suites ? suites[0] : "suites inconnues"} | ${tests ? tests[0] : "tests inconnus"}`
      );
    }
  }

  const statique = faire("statique");
  const avecMesures = faire("mesures");

  const contenus = new Map();
  const manquantes = [];
  if (statique || avecMesures) {
    for (const p of pages) {
      const abs = path.join(OUT_ROOT, p.fichier);
      if (fs.existsSync(abs)) contenus.set(p.fichier, fs.readFileSync(abs, "utf8"));
      else manquantes.push(p);
    }
  }

  if (statique) {
    const vnextPages = pages.filter((p) => p.variante !== "actuel");
    const actuelPages = pages.filter((p) => p.variante === "actuel");

    // -----------------------------------------------------------------------
    // (c) Toutes les pages attendues existent, aucune n'est une page d'erreur,
    //     chaque page vNext porte le marqueur d'ecran exactement une fois.
    // -----------------------------------------------------------------------
    const erreurs = [];
    const sansMarqueur = [];
    for (const p of pages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      if (/ecran indisponible|a plante au rendu|n'a pas pu etre charge/i.test(html)) {
        erreurs.push(p.fichier);
        continue;
      }
      if (p.variante !== "actuel") {
        const n = (html.match(/data-testid="profil-vnext-ecran"/g) || []).length;
        if (n !== 1) sansMarqueur.push(`${p.fichier} : ${n}`);
      }
    }
    noter(
      "c) Rendu : pages presentes, aucune page d'erreur, marqueur d'ecran partout",
      manquantes.length === 0 && erreurs.length === 0 && sansMarqueur.length === 0 ? "PASS" : "FAIL",
      `${pages.length} pages attendues : ${vnextPages.length} vNext (7 etats x 2 variantes x ` +
        `${ACCENTS_IDS.length} accent(s) [${ACCENTS_IDS.join("/")}] x 3 largeurs x 2 vues + x1,3 en 375)\n` +
        `+ ${actuelPages.length} Profil actuel (7 x 3 x 2 + x1,3 en 375 — l'axe accents ne s'y applique pas). ` +
        `Presentes : ${pages.length - manquantes.length}.\n` +
        (manquantes.length ? `MANQUANTES : ${manquantes.slice(0, 8).map((m) => m.fichier).join(", ")}\n` : "") +
        (erreurs.length ? `PAGES D'ERREUR : ${erreurs.slice(0, 8).join(", ")}\n` : "aucune page d'erreur.\n") +
        `Marqueur data-testid="profil-vnext-ecran" attendu exactement 1 fois par page vNext : ` +
        (sansMarqueur.length ? `ECARTS : ${sansMarqueur.slice(0, 8).join(" | ")}` : "toutes a 1.")
    );

    // -----------------------------------------------------------------------
    // (f1) Zero stat dupliquee : libelles FOOTBALL_LABELS + mots interdits
    // -----------------------------------------------------------------------
    // Les libelles viennent du PRODUIT (config/trainingDefaults.ts), jamais
    // recopies : si un libelle change la-bas, le controle suit.
    //
    // DEUX TEXTES DECLARES SONT EXEMPTES, ET SEULEMENT EUX — ce sont des
    // donnees produit affichees telles quelles, pas des etats calcules :
    //   1. l'OBJECTIF du joueur (« Être en forme toute la saison » contient
    //      « forme » — c'est une declaration, prevue par le cadre de mission) ;
    //   2. le NOM DU CYCLE choisi, MICROCYCLES[goal].label (« Rester frais pour
    //      les matchs » contient « frais » — trouve au premier passage du
    //      verificateur sur proprietaire-club et stress-textes-longs, cycle
    //      Saison). Retirer ce nom serait cacher une donnee produit ; le
    //      garder ferait accuser a tort un texte que le joueur a choisi.
    // Le retrait est CIBLE (la chaine exacte), le reste de la page reste soumis
    // a la regle entiere.
    // -----------------------------------------------------------------------
    const { MICROCYCLES } = require(path.join(APP_ROOT, "domain/microcycles.ts"));
    const libellesFootball = Object.values(FOOTBALL_LABELS).map((l) => l.label);
    const motsInterdits = [/s[ée]rie/i, /troph[ée]e/i, /playlist/i, /\bTSB\b/, /r[ée]gularit[ée]/i];
    const fautesInterdits = [];
    for (const p of vnextPages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      const vm = VM.get(`${p.etat}|${p.variante}`);
      let texte = texteEcran(html);
      const objectif = vm && vm.identite.kind === "prete" ? vm.identite.objectif : null;
      if (objectif) texte = texte.split(objectif).join(" ");
      const fixture = FIXTURES.find((f) => f.id === p.etat);
      const goal = fixture ? fixture.input.cycle.microcycleGoal : null;
      const labelCycle = goal && MICROCYCLES[goal] ? MICROCYCLES[goal].label : null;
      if (labelCycle) texte = texte.split(labelCycle).join(" ");
      for (const lib of libellesFootball) {
        if (texte.toLowerCase().includes(lib.toLowerCase())) {
          fautesInterdits.push(`${p.fichier} : libelle d'etat de forme « ${lib} »`);
        }
      }
      for (const motif of motsInterdits) {
        const m = texte.match(motif);
        if (m) fautesInterdits.push(`${p.fichier} : « ${m[0]} »`);
      }
    }
    noter(
      "f1) Zero libelle d'etat de forme, zero « Serie / Trophee / PLAYLIST / TSB / Regularite »",
      fautesInterdits.length === 0 ? "PASS" : "FAIL",
      `Libelles interdits lus dans config/trainingDefaults.ts (FOOTBALL_LABELS) : ${libellesFootball.join(" · ")}.\n` +
        `Mots interdits en plus : Série, Trophée, PLAYLIST, TSB (mot entier), Régularité — insensibles a la casse.\n` +
        `Exemptions CIBLEES (donnees declarees, affichees telles quelles) : le texte de l'objectif du joueur,\n` +
        `et le nom du cycle choisi (MICROCYCLES[goal].label — « Rester frais pour les matchs » contient « frais »).\n` +
        `${vnextPages.length} pages vNext analysees.\n` +
        (fautesInterdits.length ? `ECARTS : ${[...new Set(fautesInterdits)].slice(0, 10).join(" | ")}` : "aucune occurrence hors exemptions.")
    );

    // -----------------------------------------------------------------------
    // (f2) Le fait cycle dit exactement microcycleSessionIndex + 1
    // -----------------------------------------------------------------------
    const fautesCycle = [];
    for (const f of FIXTURES) {
      const vm = VM.get(`${f.id}|informe`);
      const ligneCycle = vm.controles.find((c) => c.id === "cycle");
      const page = `pages/vnext/${f.id}_informe_375_entiere.html`;
      const texte = texteEcran(contenus.get(page) || "");
      const attenduN = Math.min(12, f.input.cycle.microcycleSessionIndex + 1);

      if (ligneCycle && ligneCycle.fait) {
        const m = ligneCycle.fait.texte.match(/Séance (\d+) sur (\d+)/);
        if (!m) {
          fautesCycle.push(`${f.id} : fait cycle sans « Séance N sur T » (« ${ligneCycle.fait.texte} »)`);
        } else if (Number(m[1]) !== attenduN) {
          fautesCycle.push(`${f.id} : fait cycle dit ${m[1]}, la fixture dit index ${f.input.cycle.microcycleSessionIndex} -> attendu ${attenduN}`);
        }
        if (!texte.includes(ligneCycle.fait.texte)) {
          fautesCycle.push(`${f.id} : le fait cycle du ViewModel n'apparait pas dans la page rendue`);
        }
      } else if (/Séance \d+ sur \d+/.test(texte)) {
        fautesCycle.push(`${f.id} : « Séance N sur T » rendu alors que le ViewModel n'a aucun fait cycle`);
      }
    }
    noter(
      "f2) Le nombre du fait cycle = microcycleSessionIndex + 1 de la fixture",
      fautesCycle.length === 0 ? "PASS" : "FAIL",
      `Pour chaque etat (variante informee) : le fait « Séance N sur 12 » est recalcule depuis la fixture\n` +
        `(seance en cours = index + 1, borne a 12 — la MEME arithmetique que le Home), compare au ViewModel\n` +
        `ET retrouve mot pour mot dans la page rendue. Sans cycle actif : aucun « Séance N sur T » tolere.\n` +
        (fautesCycle.length ? `ECARTS : ${fautesCycle.join(" | ")}` : `aucun ecart sur les ${FIXTURES.length} etats.`)
    );

    // -----------------------------------------------------------------------
    // (f3) Aucun champ du ViewModel hors de la liste ecrite a la main
    // -----------------------------------------------------------------------
    const fautesChemins = [];
    for (const f of FIXTURES) {
      for (const v of VARIANTES) {
        const vm = VM.get(`${f.id}|${v.id}`);
        const presents = cheminsPresents(vm, "", new Set());
        for (const c of presents) {
          if (!CHEMINS_AUTORISES.has(c)) fautesChemins.push(`${f.id}/${v.id} : ${c}`);
        }
      }
    }
    noter(
      "f3) Aucun champ du ViewModel au-dela de la liste ecrite a la main",
      fautesChemins.length === 0 ? "PASS" : "FAIL",
      `${CHEMINS_AUTORISES.size} chemins autorises, ecrits a la main (copie de __tests__/profilVNext/viewModel.test.ts,\n` +
        `jamais derives de la sortie). ${FIXTURES.length * VARIANTES.length} ViewModels construits et parcourus.\n` +
        `Un champ ajoute (etat de forme, trophee, compteur, phase) echouerait ICI en se nommant.\n` +
        (fautesChemins.length ? `CHEMINS INTERDITS : ${[...new Set(fautesChemins)].slice(0, 12).join(" | ")}` : "aucun champ hors liste.")
    );

    // -----------------------------------------------------------------------
    // (f4) Les accents ne changent JAMAIS un caractere de texte
    // -----------------------------------------------------------------------
    // C'est LA promesse de l'axe (D7), mesuree sur le HTML RENDU — pas sur le
    // ViewModel (que l'axe ne touche pas par construction) : si un composant
    // ajoutait des initiales dans l'avatar ou un mot dans une pilule, c'est ICI
    // que ca se verrait. Comparaison au caractere pres du texte visible de
    // l'ecran (espaces normalises), page sobre contre page coloree, pour chaque
    // etat x variante x largeur x vue x echelle.
    // -----------------------------------------------------------------------
    if (ACCENTS_IDS.length < 2) {
      noter(
        "f4) Texte identique au caractere pres entre sobre et colore",
        "NON_EXECUTE",
        "L'axe accents n'a qu'un seul mode (profilVNextAccents.ts illisible au moment du build ?) : rien a comparer."
      );
    } else {
      const fautesTexte = [];
      let comparaisons = 0;
      const sobres = vnextPages.filter((p) => p.accents === ACCENTS_PAR_DEFAUT);
      for (const p of sobres) {
        for (const accId of ACCENTS_IDS) {
          if (accId === ACCENTS_PAR_DEFAUT) continue;
          const fichierAcc = p.fichier.replace(/(_x13)?\.html$/, (m, x13) => `${suffixeAccent(accId)}${x13 || ""}.html`);
          const htmlSobre = contenus.get(p.fichier);
          const htmlAcc = contenus.get(fichierAcc);
          if (!htmlSobre || !htmlAcc) continue;
          comparaisons++;
          const a = texteEcran(htmlSobre);
          const b = texteEcran(htmlAcc);
          if (a !== b) {
            let i = 0;
            const n = Math.min(a.length, b.length);
            while (i < n && a[i] === b[i]) i++;
            fautesTexte.push(
              `${p.etat}/${p.variante}@${p.largeur}${p.echelle !== 1 ? " x1,3" : ""}/${p.vue} vs ${accId} @${i} : ` +
                `sobre « …${a.slice(Math.max(0, i - 30), i + 30)}… » / ${accId} « …${b.slice(Math.max(0, i - 30), i + 30)}… »`
            );
          }
        }
      }
      noter(
        "f4) Texte identique au caractere pres entre sobre et colore",
        fautesTexte.length === 0 ? "PASS" : "FAIL",
        `${comparaisons} paires de pages comparees (texte visible de l'ecran, espaces normalises, HTML rendu).\n` +
          `La promesse de l'axe : le mode colore n'ajoute NI ne retire un caractere — avatar dessine sans\n` +
          `initiales, pilules qui teintent des mots existants.\n` +
          (fautesTexte.length ? `ECARTS : ${fautesTexte.slice(0, 6).join("\n  ")}` : "aucun ecart.")
      );
    }
  }

  // -------------------------------------------------------------------------
  // MESURES NAVIGATEUR — (d), (e), (g), (h), (i)
  // -------------------------------------------------------------------------
  let mesures = null;
  if (avecMesures) {
    if (manquantes.length) {
      noter(
        "d/e/g/h/i) Mesures dans un navigateur",
        "NON_EXECUTE",
        `${manquantes.length} page(s) absente(s) — lance d'abord node prototype/profil/build.js sans filtre.`
      );
    } else {
      const { serveur, port } = await demarrerServeur();
      const r = await mesurer(pages, port);
      serveur.close();
      if (!r.ok) {
        noter("d/e/g/h/i) Mesures dans un navigateur", "NON_EXECUTE", r.raison);
      } else {
        mesures = r.mesures;
        console.log(`         (moteur de rendu : ${r.navigateur})`);
        analyserMesures(mesures, pages, r.navigateur);

        const tab = tableauComparatif(mesures, pages);
        fs.mkdirSync(DOSSIER_LIVRABLE, { recursive: true });
        const entete =
          "# Hauteur de page — Profil actuel contre Profil vNext (pur / informé / informé coloré)\n\n" +
          "Données FICTIVES. Mesure faite dans un vrai moteur de rendu (Chrome sans interface),\n" +
          "sur la vue « page entière » (rien n'est coupé), marges de safe area comprises.\n" +
          "Même moteur, même feuille de style, même méthode des trois côtés : l'écart ne peut\n" +
          "pas venir du harnais.\n\n" +
          "Généré par `node prototype/profil/verifier.js`.\n\n";
        fs.writeFileSync(path.join(DOSSIER_LIVRABLE, "mesures-hauteurs-profil.md"), entete + tab.md + "\n", "utf8");
        console.log("");
        console.log(tab.md);
        console.log("");
        console.log(`  Tableau ecrit dans outputs/profil-prototype-2026-08-07/mesures-hauteurs-profil.md`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // (j) Idempotence
  // -------------------------------------------------------------------------
  if (faire("idempotence")) {
    verifierIdempotence();
  }

  // -------------------------------------------------------------------------
  // Sortie
  // -------------------------------------------------------------------------
  fs.mkdirSync(DOSSIER_VERIF, { recursive: true });
  fs.writeFileSync(
    path.join(DOSSIER_VERIF, "verifications.json"),
    JSON.stringify({ verifications, mesures: mesures ? resumeMesures(mesures) : null }, null, 1),
    "utf8"
  );

  console.log("");
  const pass = verifications.filter((v) => v.resultat === "PASS").length;
  const fail = verifications.filter((v) => v.resultat === "FAIL").length;
  const ne = verifications.filter((v) => v.resultat === "NON_EXECUTE").length;
  console.log(`  BILAN : ${pass} PASS · ${fail} FAIL · ${ne} NON_EXECUTE`);
  console.log(`  Detail : ${path.join(DOSSIER_VERIF, "verifications.json")}`);
  console.log("");
  process.exit(fail > 0 ? 2 : 0);
}

// ---------------------------------------------------------------------------
// Analyse des mesures navigateur
// ---------------------------------------------------------------------------
function analyserMesures(mesures, pages, navigateur) {
  const vnext = pages.filter((p) => p.variante !== "actuel");

  // --- toutes les pages mesurees sans erreur --------------------------------
  const enErreur = pages.filter((p) => {
    const m = mesures[cle(p)];
    return !m || m.erreur;
  });
  noter(
    "d0) Mesure reelle du rendu dans un navigateur",
    enErreur.length === 0 ? "PASS" : "FAIL",
    `Moteur : ${navigateur} (sans interface).\n` +
      `${pages.length} pages chargees et mesurees ; ${pages.length - enErreur.length} sans erreur.\n` +
      (enErreur.length
        ? `EN ERREUR : ${enErreur.slice(0, 8).map((p) => p.fichier + " -> " + (mesures[cle(p)] || {}).erreur).join(" | ")}`
        : "aucune erreur de mesure.")
  );

  // --- (e) les 3 usages reels au-dessus de la flottaison --------------------
  // Mesure sur les pages `visible` a l'echelle 1 : la position verticale (top,
  // depuis le haut PHYSIQUE de l'ecran) de chaque marqueur, comparee a la zone
  // visible de l'appareil. « Visible sans defiler » = top < stageVisible, ce
  // qui equivaut exactement a top - insetTop < hauteur lisible (lib/devices.js).
  const USAGES = [
    "profil-vnext-controle-modifier_profil",
    "profil-vnext-controle-reglages",
    "profil-vnext-controle-historique",
  ];
  const fautesUsages = [];
  const observationsUsages = [];
  for (const p of vnext.filter((q) => q.vue === "visible" && q.echelle === 1)) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    const d = DEVICES_PROFIL.find((x) => x.width === p.largeur);
    // Le VERDICT porte sur le rendu par defaut (sobre). Les pages colorees sont
    // MESUREES et rapportees en observation : l'avatar du mode colore pousse
    // les controles plus bas, et ce cout doit se lire ici — pas se deviner.
    const estColore = p.accents != null && p.accents !== ACCENTS_PAR_DEFAUT;
    const observationSeulement =
      estColore || p.etat === "chargement" || (p.etat === "stress-textes-longs" && p.largeur === 320);
    for (const u of USAGES) {
      const pos = (m.positionsMarqueurs || []).filter((x) => x.marqueur === u);
      const ligne = `${p.etat}/${p.variante}${estColore ? "+" + p.accents : ""}@${p.largeur}`;
      if (pos.length !== 1) {
        (observationSeulement ? observationsUsages : fautesUsages).push(`${ligne} : marqueur ${u} present ${pos.length} fois`);
        continue;
      }
      const top = pos[0].top;
      if (top >= d.stageVisible) {
        const msg = `${ligne} : ${u.replace("profil-vnext-controle-", "")} commence a ${top} px, flottaison a ${d.stageVisible} px (lisible ${d.readable} px)`;
        (observationSeulement ? observationsUsages : fautesUsages).push(msg);
      }
    }
  }
  noter(
    "e) Les 3 usages reels (Modifier / Reglages / Historique) au-dessus de la flottaison",
    fautesUsages.length === 0 ? "PASS" : "FAIL",
    `Marqueurs : ${USAGES.join(", ")} — presents exactement 1 fois et top < zone visible (stageVisible),\n` +
      `soit top - insetTop < hauteur lisible de l'appareil (lib/devices.js), sur chaque page vNext « visible » x1.\n` +
      `Le verdict porte sur le rendu SOBRE (le defaut). Observations sans echec : etat « chargement »,\n` +
      `« stress-textes-longs » a 320 px, et les pages COLOREES (le cout de l'avatar se lit ici — decision D7).\n` +
      (fautesUsages.length ? `SOUS LA FLOTTAISON : ${fautesUsages.slice(0, 12).join(" | ")}\n` : "tous visibles sans defiler.\n") +
      (observationsUsages.length
        ? `OBSERVATIONS (${observationsUsages.length}) : ${observationsUsages.slice(0, 14).join(" | ")}`
        : "observations : aucune.")
  );

  // --- (g) zones tactiles ----------------------------------------------------
  const tropPetites = [];
  let nbTactiles = 0;
  for (const p of vnext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    for (const t of m.tactiles || []) {
      nbTactiles++;
      if (t.hauteur + 0.5 < TAILLE_TACTILE_MIN) {
        tropPetites.push(`${p.etat}/${p.variante}@${p.largeur}${p.echelle !== 1 ? " x1,3" : ""} ${t.role} "${t.libelle.slice(0, 28)}" = ${t.hauteur} pt`);
      }
    }
  }
  noter(
    "g) Zones tactiles >= 44 pt",
    tropPetites.length === 0 ? "PASS" : "FAIL",
    `${nbTactiles} elements interactifs mesures sur l'ensemble des pages vNext (role button/link ou focusable).\n` +
      `Plancher : ${TAILLE_TACTILE_MIN} pt de hauteur reelle.\n` +
      (tropPetites.length
        ? `SOUS LE PLANCHER : ${[...new Set(tropPetites)].slice(0, 10).join(" | ")}`
        : "aucun element sous le plancher.")
  );

  // --- (h) contrastes --------------------------------------------------------
  const sousLeSeuil = new Map();
  let nbTextes = 0;
  let pireRatio = 99;
  let pireTexte = "";
  const ratiosCles = new Map();
  const aDefinir = new Map();
  const pilules = new Map();
  for (const p of vnext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    const estColore = p.accents != null && p.accents !== ACCENTS_PAR_DEFAUT;
    for (const c of m.contrastes || []) {
      nbTextes++;
      const seuil = c.grandTexte ? SEUIL_CONTRASTE_AA_GRAND : SEUIL_CONTRASTE_AA;
      const identite = `${c.couleur} sur ${c.fond} (${c.taille}px/${c.graisse})`;
      if (!ratiosCles.has(identite)) ratiosCles.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
      if (c.texte.startsWith("À définir") && !aDefinir.has(identite)) {
        aDefinir.set(identite, c.ratio);
      }
      // Les pilules du mode colore : texte accent sur fond accentSoft (valeurs
      // lues dans constants/theme.ts, jamais recopiees). Mesure EXPLICITE.
      if (estColore && FOND_PILULE && c.fond === FOND_PILULE && !pilules.has(identite)) {
        pilules.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
      }
      if (c.ratio < pireRatio) {
        pireRatio = c.ratio;
        pireTexte = `${c.texte} — ${identite}`;
      }
      if (c.ratio + 0.005 < seuil) {
        sousLeSeuil.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
      }
    }
  }
  const listeRatios = [...ratiosCles.entries()]
    .sort((a, b) => a[1].ratio - b[1].ratio)
    .slice(0, 8)
    .map(([id, v]) => `${v.ratio}:1 — ${id} (« ${v.exemple} »)`);
  noter(
    "h) Contraste WCAG des textes rendus (sobre ET colore)",
    sousLeSeuil.size === 0 ? "PASS" : "FAIL",
    `Calcul WCAG 2.1 sur les COULEURS REELLEMENT RENDUES : texte compose sur son fond effectif (premier fond\n` +
      `opaque en remontant les parents — moteur du Home). ${nbTextes} textes mesures, ${ratiosCles.size} combinaisons distinctes.\n` +
      `Seuils : ${SEUIL_CONTRASTE_AA}:1 en texte normal, ${SEUIL_CONTRASTE_AA_GRAND}:1 en grand texte (>= 24px, ou >= 18,66px gras).\n` +
      `« À définir » (italique, texte secondaire), mesure EXPLICITEMENT :\n  ` +
      ([...aDefinir.entries()].map(([id, r]) => `${r}:1 — ${id}`).join("\n  ") || "(aucune occurrence rendue — inattendu si profil-partiel est genere)") +
      `\nPilules du mode colore (texte ${TEXTE_PILULE} sur fond ${FOND_PILULE || "?"}), mesure EXPLICITE :\n  ` +
      ([...pilules.entries()].map(([id, v]) => `${v.ratio}:1 — ${id} (« ${v.exemple} », seuil ${v.seuil})`).join("\n  ") ||
        "(aucune pilule mesuree — inattendu si les pages colorees sont generees)") +
      `\nPire ratio du prototype : ${pireRatio}:1 (${pireTexte}).\n` +
      `Les 8 plus bas :\n  ` +
      listeRatios.join("\n  ") +
      (sousLeSeuil.size
        ? `\nSOUS LE SEUIL : ${[...sousLeSeuil.entries()].map(([id, v]) => `${id} = ${v.ratio}:1 (seuil ${v.seuil}, « ${v.exemple} »)`).join(" | ")}`
        : "\nAucun texte sous son seuil.")
  );

  // --- (i) 320 px et x1,3 ----------------------------------------------------
  // Echec dans les cartes du Profil vNext ; observation sur le Profil actuel.
  // Les troncatures par numberOfLines sont le comportement DESSINE (libelle en
  // 1 ligne, fait en 2) : elles font echouer les ETATS PRODUIT mais restent des
  // observations sur « stress-textes-longs », dont c'est precisement le role.
  const fautesSerre = [];
  const obsSerre = [];
  const pagesSerrees = pages.filter(
    (p) => p.vue === "entiere" && ((p.largeur === 320 && p.echelle === 1) || p.echelle !== 1)
  );
  for (const p of pagesSerrees) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    const acc = p.accents && p.accents !== ACCENTS_PAR_DEFAUT ? `+${p.accents}` : "";
    const ou = `${p.etat}/${p.variante}${acc}@${p.largeur}${p.echelle !== 1 ? " x1,3" : ""}`;
    const estActuel = p.variante === "actuel";
    const cible = estActuel ? obsSerre : fautesSerre;
    for (const d of m.debordements || []) {
      cible.push(`${ou} : « ${d.texte} » deborde de ${Math.max(d.droite, d.gauche)} px`);
    }
    for (const c of m.chevauchements || []) {
      cible.push(`${ou} : « ${c.a} » recouvre « ${c.b} » (${c.recouvrement})`);
    }
    for (const cl of m.clampes || []) {
      const obs = estActuel || p.etat === "stress-textes-longs";
      (obs ? obsSerre : fautesSerre).push(`${ou} : tronque « ${cl.texte.slice(0, 50)} »`);
    }
  }
  // Diagnostics nommes, quand ils sont mesures.
  // 1. Troncature d'ETIQUETTE : etait le defaut flexShrink (corrige en 9fada11).
  const ETIQUETTES_IDENTITE = ["Prénom", "Poste", "Niveau", "Pied fort", "Objectif"];
  const etiquettesTronquees = [...new Set(fautesSerre)].some((f) =>
    ETIQUETTES_IDENTITE.some((e) => f.includes(`tronque « ${e} »`))
  );
  const diagnosticEtiquette = etiquettesTronquees
    ? `\nCAUSE IDENTIFIEE (etiquette) : l'etiquette de la ligne identite est ecrasee par la valeur d'en face\n` +
      `— le flexShrink: 0 explicite du label (correctif 9fada11) a saute ou ne suffit plus. A re-instruire.`
    : "";
  // 2. Troncature de VALEUR sur les pages COLOREES uniquement : l'avatar.
  const valeursColoreTronquees = [...new Set(fautesSerre)].some(
    (f) => f.includes("+colore") && f.includes("tronque « Mieux encaisser")
  );
  const diagnosticAvatar = valeursColoreTronquees
    ? `\nCAUSE IDENTIFIEE (sur pieces, sans-cycle 320 sobre vs colore) : le balisage de la ligne Objectif est\n` +
      `IDENTIQUE dans les deux modes — ce qui change est l'ANCETRE. En mode colore, ProfilVNextIdentite pose\n` +
      `l'avatar (44 px) et les lignes COTE A COTE (rangeeAvatar en row + gap 12) : chaque ligne d'identite\n` +
      `perd ~56 px de largeur. A 320 px x1 et a 375 px x1,3, l'objectif le plus long du referentiel\n` +
      `(46 caracteres) passe alors a 3 lignes et numberOfLines={2} le coupe — et cette coupe MASQUE le cout\n` +
      `en hauteur (la page colore de sans-cycle ne grandit pas : elle tronque a la place). Le mode sobre,\n` +
      `lui, tient en 2 lignes aux memes largeurs. Pertinent pour la decision D7 ; correctif produit possible\n` +
      `(avatar AU-DESSUS des lignes, pas a cote) — hors perimetre d'ecriture de ce verificateur, rapporte.`
    : "";
  noter(
    "i) 320 px et texte x1,3 — debordement, chevauchement, troncature",
    fautesSerre.length === 0 ? "PASS" : "FAIL",
    `${pagesSerrees.length} pages « entiere » analysees (320 px x1 + 375 px x1,3 — vNext sobre ET colore, plus le Profil actuel).\n` +
      `ECHEC pour les pages vNext : tout debordement horizontal, tout chevauchement de textes, et toute\n` +
      `troncature reelle sur un ETAT PRODUIT. OBSERVATION : le Profil actuel (hors perimetre) et les\n` +
      `troncatures de « stress-textes-longs » (pousser a la coupe est le role de cette fixture).\n` +
      (fautesSerre.length ? `ECHECS : ${[...new Set(fautesSerre)].slice(0, 12).join("\n  ")}\n` : "aucun echec cote vNext.\n") +
      (obsSerre.length
        ? `OBSERVATIONS (${obsSerre.length}) :\n  ${[...new Set(obsSerre)].slice(0, 10).join("\n  ")}`
        : "aucune observation.") +
      diagnosticEtiquette +
      diagnosticAvatar
  );
}

// ---------------------------------------------------------------------------
// (d) LE TABLEAU DE COMPARAISON — le chiffre que le fondateur attend
// ---------------------------------------------------------------------------
function tableauComparatif(mesures, pages) {
  const md = [];
  const lignes = [];
  for (const f of FIXTURES) {
    for (const d of DEVICES_PROFIL) {
      const g = (varianteCle, echelle) => {
        const m = mesures[`${varianteCle}|${f.id}|${d.width}|${echelle}|entiere`];
        return m && !m.erreur ? m : null;
      };
      const pur = g("pur", 1);
      const inf = g("informe", 1);
      const infCol = g("informe+colore", 1);
      const act = g("actuel", 1);
      lignes.push({
        etat: f.id,
        largeur: d.width,
        visible: d.stageVisible,
        purH: pur ? pur.hauteurTotale : null,
        infH: inf ? inf.hauteurTotale : null,
        infColH: infCol ? infCol.hauteurTotale : null,
        actH: act ? act.hauteurTotale : null,
        actBlocs: act ? act.nbBlocs : null,
        infBlocs: inf ? inf.nbBlocs : null,
      });
    }
  }

  md.push("## Hauteurs à l'échelle 1 (vue « page entière », safe area comprise)");
  md.push("");
  md.push("| État | Largeur | Profil actuel | vNext pur | vNext informé | vNext informé coloré | Écart informé vs actuel | Blocs actuel → informé |");
  md.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const l of lignes) {
    const ecart = l.actH != null && l.infH != null ? l.infH - l.actH : null;
    const pct = ecart != null && l.actH ? Math.round((ecart / l.actH) * 1000) / 10 : null;
    md.push(
      `| ${l.etat} | ${l.largeur} | ${l.actH != null ? l.actH + " px" : "—"} | ${l.purH != null ? l.purH + " px" : "—"} | ` +
        `${l.infH != null ? l.infH + " px" : "—"} | ` +
        `${l.infColH != null ? l.infColH + " px" : "—"} | ` +
        `${ecart != null ? (ecart > 0 ? "+" : "") + ecart + " px (" + (pct > 0 ? "+" : "") + pct + " %)" : "—"} | ` +
        `${l.actBlocs != null ? l.actBlocs : "—"} → ${l.infBlocs != null ? l.infBlocs : "—"} |`
    );
  }

  const paires = lignes.filter((l) => l.actH != null && l.infH != null);
  const totalA = paires.reduce((s, l) => s + l.actH, 0);
  const totalI = paires.reduce((s, l) => s + l.infH, 0);
  const moyPct = totalA ? Math.round(((totalI - totalA) / totalA) * 1000) / 10 : 0;
  md.push("");
  md.push(
    `**Moyenne sur les ${paires.length} comparaisons : ${moyPct} % de hauteur de page (informé sobre vs actuel).** ` +
      `Écrans qui tiennent SANS DÉFILER : ${lignes.filter((l) => l.infH != null && l.infH <= l.visible).length}/${lignes.length} en informé, ` +
      `${lignes.filter((l) => l.infColH != null && l.infColH <= l.visible).length}/${lignes.length} en informé coloré, ` +
      `${lignes.filter((l) => l.purH != null && l.purH <= l.visible).length}/${lignes.length} en pur, ` +
      `${paires.filter((l) => l.actH <= l.visible).length}/${paires.length} pour le Profil actuel.`
  );

  // Le cout du mode colore (decision D7), etat par etat a 375 px.
  const lignes375 = lignes.filter((l) => l.largeur === SCALE_WIDTH && l.infH != null && l.infColH != null);
  if (lignes375.length) {
    const deltas = lignes375.map((l) => l.infColH - l.infH);
    const dMin = Math.min(...deltas);
    const dMax = Math.max(...deltas);
    md.push("");
    md.push(
      `**Coût du mode coloré (D7), informé à 375 px : de +${dMin} à +${dMax} px de hauteur de page** ` +
        `(${lignes375.map((l) => `${l.etat} +${l.infColH - l.infH}`).join(" · ")}).`
    );
  }

  md.push("");
  md.push("## Texte ×1,3 (375 px, vue « page entière »)");
  md.push("");
  md.push("| État | Profil actuel ×1,3 | vNext pur ×1,3 | vNext informé ×1,3 | vNext informé coloré ×1,3 |");
  md.push("|---|---:|---:|---:|---:|");
  for (const f of FIXTURES) {
    const g = (varianteCle) => {
      const m = mesures[`${varianteCle}|${f.id}|375|${TEXT_SCALE}|entiere`];
      return m && !m.erreur ? m.hauteurTotale + " px" : "—";
    };
    md.push(`| ${f.id} | ${g("actuel")} | ${g("pur")} | ${g("informe")} | ${g("informe+colore")} |`);
  }
  md.push("");
  md.push(
    "Rappel de méthode : ×1,3 est une SIMULATION (tailles de police et interlignes multipliés dans le CSS) ; " +
      "le vrai Dynamic Type d'iOS redistribue aussi des marges. Police système, pas San Francisco : " +
      "hauteurs justes à quelques pixels près."
  );

  return { md: md.join("\n"), lignes, moyPct };
}

// ---------------------------------------------------------------------------
// Resume compact pour le fichier JSON
// ---------------------------------------------------------------------------
function resumeMesures(mesures) {
  const out = {};
  for (const [k, m] of Object.entries(mesures)) {
    if (m.erreur) {
      out[k] = { erreur: m.erreur };
      continue;
    }
    out[k] = {
      hauteurTotale: m.hauteurTotale,
      hauteurVisible: m.hauteurVisible,
      sousLaLigne: m.sousLaLigne,
      nbBlocs: m.nbBlocs,
      usages: (m.positionsMarqueurs || [])
        .filter((x) => /controle-(modifier_profil|reglages|historique)$/.test(x.marqueur))
        .map((x) => `${x.marqueur.replace("profil-vnext-controle-", "")}@${x.top}`),
      nbTactiles: (m.tactiles || []).length,
      tactileMin: (m.tactiles || []).reduce((a, t) => Math.min(a, t.hauteur), 999),
      contrasteMin: (m.contrastes || []).reduce((a, c) => Math.min(a, c.ratio), 99),
      nbClampes: (m.clampes || []).length,
      nbDebordements: (m.debordements || []).length,
      nbChevauchements: (m.chevauchements || []).length,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// (j) Idempotence
// ---------------------------------------------------------------------------
function empreinteDossier(racine, garderContenus) {
  const empreintes = {};
  const contenusActuel = {};
  const parcourir = (dossier, prefixe) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dossier, e.name);
      const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
      if (rel.startsWith("_verif")) continue; // sortie du verificateur, pas du build
      if (e.isDirectory()) parcourir(abs, rel);
      else {
        const buf = fs.readFileSync(abs);
        empreintes[rel] = crypto.createHash("sha1").update(buf).digest("hex");
        // Les pages du Profil actuel sont les seules suspectes de varier (le
        // ProfileScreen anime son entree) : on garde leur contenu pour pouvoir
        // IDENTIFIER la cause d'un ecart au lieu de la supposer.
        if (garderContenus && rel.startsWith("pages/actuel/")) contenusActuel[rel] = buf.toString("utf8");
      }
    }
  };
  parcourir(racine, "");
  return { empreintes, contenusActuel };
}

/** Premier point de divergence entre deux chaines, avec son contexte. */
function premiereDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return null;
  const debut = Math.max(0, i - 90);
  return {
    position: i,
    a: a.slice(debut, i + 90),
    b: b.slice(debut, i + 90),
  };
}

function verifierIdempotence() {
  const DATE_FIXE = "2026-08-07T00:00:00.000Z";
  const build = path.join(__dirname, "build.js");
  const lancer = () =>
    spawnSync(process.execPath, [build], {
      encoding: "utf8",
      cwd: APP_ROOT,
      timeout: 900000,
      env: { ...process.env, FKS_DATE_FIXE: DATE_FIXE },
    });

  const r1 = lancer();
  if (r1.status !== 0) {
    noter("j) Idempotence du build", "FAIL", `1er build en echec : ${(r1.stderr || "").slice(0, 400)}`);
    return;
  }
  const a = empreinteDossier(OUT_ROOT, true);
  const r2 = lancer();
  if (r2.status !== 0) {
    noter("j) Idempotence du build", "FAIL", `2e build en echec : ${(r2.stderr || "").slice(0, 400)}`);
    return;
  }
  const b = empreinteDossier(OUT_ROOT, true);

  const clesA = Object.keys(a.empreintes);
  const clesB = Object.keys(b.empreintes);
  const differents = clesA.filter((k) => a.empreintes[k] !== b.empreintes[k]);
  const absents = clesA.filter((k) => !(k in b.empreintes)).concat(clesB.filter((k) => !(k in a.empreintes)));

  // Ce qui est JUGE, c'est le PROTOTYPE (pages vNext + manifeste + visualiseur).
  // Les pages du Profil de production sont rendues par du code hors perimetre :
  // un ecart y est IDENTIFIE et rapporte, pas excuse — et pas maquille non plus.
  const estPrototype = (k) => !k.startsWith("pages/actuel/");
  const cotePrototype = clesA.filter(estPrototype);
  const diffPrototype = differents.filter(estPrototype);
  const diffActuel = differents.filter((k) => !estPrototype(k));

  // Identification de la cause exacte cote actuel : premier point de divergence
  // de chaque fichier (jusqu'a 3), avec detection des motifs d'animation.
  let causeActuel = "";
  if (diffActuel.length) {
    const extraits = [];
    let motifsAnim = 0;
    for (const k of diffActuel.slice(0, 3)) {
      const d = premiereDifference(a.contenusActuel[k] || "", b.contenusActuel[k] || "");
      if (!d) continue;
      if (/opacity|transform|translate/i.test(d.a + d.b)) motifsAnim++;
      extraits.push(`  ${k} @${d.position} :\n    build 1 : …${d.a.replace(/\n/g, " ")}…\n    build 2 : …${d.b.replace(/\n/g, " ")}…`);
    }
    causeActuel =
      `CAUSE IDENTIFIEE SUR PIECES (premier point de divergence de chaque fichier) :\n` +
      extraits.join("\n") +
      `\n  ${motifsAnim}/${Math.min(3, diffActuel.length)} extraits divergent sur opacity/transform : c'est l'animation\n` +
      `  d'ENTREE du ProfileScreen (Animated.stagger(80, 9 x timing(350ms)) lancee au montage sans consulter\n` +
      `  reduceMotion — ProfileScreen.tsx:147-151). Elle se termine a ~990 ms, la capture est prise a\n` +
      `  SETTLE_MS = 900 ms : les dernieres sections sont figees EN VOL, a une valeur differente d'un build\n` +
      `  a l'autre. Ce n'est PAS une boucle infinie (contrairement au CTA du Home d'alors) mais le meme\n` +
      `  defaut de fond : l'animation ignore « reduire les animations ». Hors perimetre, non corrige ici.`;
  }

  noter(
    "j) Idempotence : deux builds successifs donnent le meme resultat",
    diffPrototype.length === 0 && absents.length === 0 ? "PASS" : "FAIL",
    `Deux executions de build.js, empreinte SHA-1 de chacun des ${clesA.length} fichiers produits.\n` +
      `La date de generation est figee par FKS_DATE_FIXE ; la marque de fraicheur des feuilles de style est\n` +
      `derivee du CODE SOURCE (mtimes), pas de l'heure : sur un arbre au repos, elle est stable.\n` +
      (absents.length ? `FICHIERS PRESENTS D'UN SEUL COTE : ${absents.slice(0, 8).join(", ")}\n` : "") +
      `COTE PROTOTYPE (ce qui est juge) : ${cotePrototype.length - diffPrototype.length}/${cotePrototype.length} fichiers identiques au bit pres.` +
      (diffPrototype.length ? `\n  DIFFERENTS : ${diffPrototype.slice(0, 10).join(", ")}` : "") +
      `\nCOTE PROFIL DE PRODUCTION (informatif, identifie — pas excuse) : ${diffActuel.length} fichier(s) sur ` +
      `${clesA.length - cotePrototype.length} different(s) d'un build a l'autre.` +
      (causeActuel ? `\n${causeActuel}` : "\n  Aucun ecart : le stagger d'entree s'est fige identiquement (possible mais non garanti).") +
      `\nPIEGE : l'empreinte des feuilles suit les mtimes des sources — modifier un fichier du prototype\n` +
      `PENDANT la comparaison la fait echouer pour cette raison-la. Mesure a faire sur un arbre au repos.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
