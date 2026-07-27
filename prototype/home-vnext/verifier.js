// prototype/home-vnext/verifier.js
// =============================================================================
// LE VERIFICATEUR — ON MESURE, ON NE DEVINE PAS
// =============================================================================
//   node prototype/home-vnext/verifier.js            # tout
//   node prototype/home-vnext/verifier.js mesures    # seulement le navigateur
//   node prototype/home-vnext/verifier.js statique   # seulement l'analyse HTML
//
// Ce fichier execute REELLEMENT les verifications du cadre de mission et rend
// un verdict chiffre. Il ne maquille rien : une verification qui n'a pas pu
// tourner est marquee NON_EXECUTE avec sa raison, jamais PASS par defaut.
//
// TROIS SOURCES DE VERITE, DANS CET ORDRE :
//   1. le HTML genere (analyse sans navigateur, avec jsdom) — pour tout ce qui
//      est textuel : mots interdits, marqueurs, structure ;
//   2. un VRAI navigateur (Chrome sans interface) — pour tout ce qui est
//      geometrique : hauteurs, zones tactiles, contrastes, debordements.
//      jsdom n'a aucun moteur de mise en page : toute hauteur y vaut 0, et
//      croire une hauteur mesuree dans jsdom serait se mentir ;
//   3. les fixtures et le ViewModel — pour savoir ce que chaque etat DEVAIT
//      afficher, et donc juger l'ecart.
//
// HYPOTHESE D'INSET, ET POURQUOI ELLE COMPTE (verification « i ») :
// l'audit (§7.3) raconte qu'un premier harnais bouchonnait `insets.bottom = 0`
// et fabriquait ainsi un faux chevauchement avec la barre d'onglets. Ici :
//   - `<Screen>` recoit les insets REELS de l'appareil (44/34 sur un iPhone X) ;
//   - la barre d'onglets est un FRERE de l'ecran dans une colonne flex, donc
//     l'ecran recoit `hauteur - (49 + insetBas)` et rien ne passe dessous.
// Cette hypothese est celle de `lib/devices.js`, elle est rappelee dans le
// rapport, et le verdict de la verification « i » n'a de sens qu'avec elle.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");
const { DEVICES, SCALE_WIDTH, TEXT_SCALE } = require("./lib/devices");
const { mesureHtml } = require("./lib/mesureTemplate");
const { byFixture } = require("./lib/mapping");

// ---------------------------------------------------------------------------
// Reglages
// ---------------------------------------------------------------------------
const SEUIL_CONTRASTE_AA = 4.5;
const SEUIL_CONTRASTE_AA_GRAND = 3.0;
const TAILLE_TACTILE_MIN = 44;
const DOSSIER_VERIF = path.join(OUT_ROOT, "_verif");

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
const fixturesMod = require(path.join(APP_ROOT, "screens/homeVNext/fixtures.ts"));
const vmMod = require(path.join(APP_ROOT, "screens/homeVNext/viewModel.ts"));

const FIXTURES = fixturesMod.HOME_VNEXT_FIXTURES_RENDU || fixturesMod.HOME_VNEXT_FIXTURES;
const VM_PAR_ETAT = new Map(
  FIXTURES.map((f) => [f.id, vmMod.buildHomeVNextViewModel(f.input)])
);

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

const arrondi = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Serveur local ephemere (le verificateur ne depend pas de serve.js)
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
    // Port 0 : le systeme en attribue un libre. Ecoute sur 127.0.0.1 seulement.
    serveur.listen(0, "127.0.0.1", () => resolve({ serveur, port: serveur.address().port }));
  });
}

// ---------------------------------------------------------------------------
// 1. INVENTAIRE DES PAGES ATTENDUES
// ---------------------------------------------------------------------------
function pagesAttendues() {
  const liste = [];
  for (const f of FIXTURES) {
    const aUnActuel = byFixture(f.id) !== null;
    for (const d of DEVICES) {
      const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
      for (const echelle of echelles) {
        const suffixe = echelle === 1 ? "" : `-x${String(echelle).replace(".", "")}`;
        for (const vue of ["visible", "entiere"]) {
          liste.push({
            variante: "vnext",
            etat: f.id,
            largeur: d.width,
            echelle,
            vue,
            hauteurVisible: d.stageVisible,
            fichier: `pages/vnext/${f.id}-${d.width}${suffixe}-${vue}.html`,
          });
          if (aUnActuel) {
            liste.push({
              variante: "actuel",
              etat: f.id,
              largeur: d.width,
              echelle,
              vue,
              hauteurVisible: d.stageVisible,
              fichier: `pages/actuel/${f.id}-${d.width}${suffixe}-${vue}.html`,
            });
          }
        }
      }
    }
  }
  return liste;
}

// ---------------------------------------------------------------------------
// 2. ANALYSE STATIQUE DU HTML (sans navigateur)
// ---------------------------------------------------------------------------
const { JSDOM } = require("jsdom");

/** Texte visible d'une page (uniquement l'ecran, pas le bloc d'identification). */
function texteEcran(html) {
  const dom = new JSDOM(html);
  const device = dom.window.document.querySelector(".device");
  return device ? (device.textContent || "").replace(/\s+/g, " ") : "";
}

function documentEcran(html) {
  const dom = new JSDOM(html);
  return dom.window.document.querySelector(".device");
}

// ---------------------------------------------------------------------------
// 3. MESURES DANS UN VRAI NAVIGATEUR
// ---------------------------------------------------------------------------
function trouverNavigateur() {
  return NAVIGATEURS.find((p) => fs.existsSync(p)) || null;
}

/**
 * Lance le navigateur SANS bloquer la boucle d'evenements de Node.
 *
 * PIEGE MESURE ICI : avec `spawnSync`, Node se fige pendant toute la duree du
 * navigateur — donc le petit serveur qui sert les pages ne repond plus, et
 * Chrome ne recoit meme pas la page de mesure. Symptome : une sortie vide, sans
 * la moindre erreur. D'ou `spawn` + promesse.
 */
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
    cle: `${p.variante}|${p.etat}|${p.largeur}|${p.echelle}|${p.vue}`,
    url: `/${p.fichier}`,
    largeur: p.largeur,
    hauteurVisible: p.hauteurVisible,
  }));

  fs.mkdirSync(DOSSIER_VERIF, { recursive: true });
  const cheminPage = path.join(DOSSIER_VERIF, "mesures.html");
  fs.writeFileSync(cheminPage, mesureHtml(cibles), "utf8");

  // Profil jetable HORS du dossier de sortie : `out/` est le livrable, il ne
  // doit pas se remplir de fichiers de navigateur.
  const profil = path.join(require("os").tmpdir(), "fks-home-vnext-chrome");
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
  // Le DOM ressort avec les entites HTML echappees.
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

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const quoi = (process.argv[2] || "tout").toLowerCase();
  const faire = (nom) => quoi === "tout" || quoi === nom;

  console.log("");
  console.log("  VERIFICATION DU PROTOTYPE HOME vNEXT");
  console.log(`  ${FIXTURES.length} etats · ${DEVICES.map((d) => d.width).join(" / ")} px`);
  console.log("");

  const pages = pagesAttendues();

  // ---------------------------------------------------------------------------
  // (a) TypeScript
  // ---------------------------------------------------------------------------
  if (faire("typescript")) {
    const tsc = path.join(APP_ROOT, "../../../node_modules/.bin/tsc.cmd");
    const existe = fs.existsSync(tsc);
    if (!existe) {
      noter("a) TypeScript du prototype", "NON_EXECUTE", `binaire tsc introuvable : ${tsc}`);
    } else {
      const r = spawnSync(
        tsc,
        ["--noEmit", "-p", path.join(__dirname, "tsconfig.proto.json")],
        { encoding: "utf8", cwd: APP_ROOT, timeout: 600000, shell: true }
      );
      const lignes = (r.stdout || "").split("\n").filter((l) => /error TS/.test(l));
      noter(
        "a) TypeScript du prototype",
        lignes.length === 0 ? "PASS" : "FAIL",
        `npx tsc --noEmit -p prototype/home-vnext/tsconfig.proto.json\n` +
          `${lignes.length} erreur(s) REELLE(S) sur screens/homeVNext + components/homeVNext + __tests__/homeVNext.` +
          (lignes.length ? "\n" + lignes.slice(0, 20).join("\n") : "")
      );
    }
  }

  // ---------------------------------------------------------------------------
  // (b) Tests
  // ---------------------------------------------------------------------------
  if (faire("tests")) {
    const jest = path.join(APP_ROOT, "../../../node_modules/.bin/jest.cmd");
    if (!fs.existsSync(jest)) {
      noter("b) Tests cibles", "NON_EXECUTE", `binaire jest introuvable : ${jest}`);
    } else {
      // NODE_ENV EXPLICITE, ET C'EST INDISPENSABLE.
      // `lib/hook.js` pose `NODE_ENV=production` dans le processus courant (le
      // harnais de rendu en a besoin). Sans cette ligne, cette valeur fuit dans
      // le processus jest : react-test-renderer bascule alors en mode
      // production et 99 tests sur 224 tombent — alors que les memes tests
      // passent quand on lance jest a la main. Symptome mesure au premier
      // passage du verificateur, et parfaitement trompeur.
      const r = spawnSync(
        jest,
        ["--config", path.join(__dirname, "jest.proto.config.js"), "--forceExit"],
        {
          encoding: "utf8",
          cwd: APP_ROOT,
          timeout: 900000,
          shell: true,
          env: { ...process.env, NODE_ENV: "test" },
        }
      );
      const flux = (r.stdout || "") + (r.stderr || "");
      const suites = flux.match(/Test Suites:\s*(.+)/);
      const tests = flux.match(/Tests:\s*(.+)/);
      const echecs = /failed/.test(suites ? suites[1] : "") || /failed/.test(tests ? tests[1] : "");
      noter(
        "b) Tests cibles",
        r.status === 0 && !echecs ? "PASS" : "FAIL",
        `npx jest --config prototype/home-vnext/jest.proto.config.js\n` +
          `${suites ? suites[0] : "suites inconnues"} | ${tests ? tests[0] : "tests inconnus"}`
      );
    }
  }

  const statique = faire("statique") || faire("tout");
  const avecMesures = faire("mesures") || faire("tout");

  // ---------------------------------------------------------------------------
  // Pages presentes ?
  // ---------------------------------------------------------------------------
  const manquantes = pages.filter((p) => !fs.existsSync(path.join(OUT_ROOT, p.fichier)));
  const contenus = new Map();
  for (const p of pages) {
    const abs = path.join(OUT_ROOT, p.fichier);
    if (fs.existsSync(abs)) contenus.set(p.fichier, fs.readFileSync(abs, "utf8"));
  }

  if (statique) {
    // -------------------------------------------------------------------------
    // (c) Rendu sans crash
    // -------------------------------------------------------------------------
    const plantees = [];
    for (const p of pages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      if (/ecran indisponible|a plante au rendu|n'a pas pu etre charge/i.test(html)) {
        plantees.push(p.fichier);
      } else if (p.variante === "vnext" && !/data-fks="content"/.test(html)) {
        plantees.push(p.fichier + " (aucun contenu repere)");
      }
    }
    const vnextPages = pages.filter((p) => p.variante === "vnext");
    noter(
      "c) Rendu des fixtures aux 4 largeurs, sans crash",
      manquantes.length === 0 && plantees.length === 0 ? "PASS" : "FAIL",
      `${pages.length} pages attendues (${vnextPages.length} vNext + ${pages.length - vnextPages.length} Home actuel), ` +
        `${pages.length - manquantes.length} presentes.\n` +
        `${FIXTURES.length} etats x ${DEVICES.length} largeurs x 2 vues, + la variante texte x1,3 a 375 px.\n` +
        (manquantes.length ? `MANQUANTES : ${manquantes.map((m) => m.fichier).join(", ")}\n` : "") +
        (plantees.length ? `PAGES D'ERREUR : ${plantees.join(", ")}` : "aucune page d'erreur.")
    );

    // -------------------------------------------------------------------------
    // (e) Une seule action principale
    // -------------------------------------------------------------------------
    const fautesCta = [];
    for (const p of vnextPages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      const n = (html.match(/data-testid="home-vnext-action-principale"/g) || []).length;
      if (n !== 1) fautesCta.push(`${p.fichier} : ${n}`);
    }
    noter(
      "e) Absence de double CTA (compte automatique)",
      fautesCta.length === 0 ? "PASS" : "FAIL",
      `Marqueur compte : data-testid="home-vnext-action-principale" (pose par components/homeVNext/HomeVNextAction.tsx,\n` +
        `sur l'aplat ET sur l'accuse de reception : c'est l'EMPLACEMENT d'action qui est compte, pas sa forme).\n` +
        `${vnextPages.length} pages vNext analysees, attendu exactement 1 par page.\n` +
        (fautesCta.length ? `ECARTS : ${fautesCta.join(" | ")}` : "toutes a 1.")
    );

    // -------------------------------------------------------------------------
    // (f) Absence de faux etat de forme
    // -------------------------------------------------------------------------
    const fautesForme = [];
    for (const p of vnextPages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      const vm = VM_PAR_ETAT.get(p.etat);
      const texte = texteEcran(html);
      const aCourbe = /data-testid="home-vnext-courbe"/.test(html);
      const formeDispo = vm && vm.form && vm.form.kind === "available";

      if (!formeDispo && aCourbe) fautesForme.push(`${p.fichier} : courbe sur un etat sans tendance`);
      if (formeDispo && !aCourbe) fautesForme.push(`${p.fichier} : tendance disponible mais aucune courbe`);

      // Un libelle d'etat ne peut apparaitre que si le ViewModel l'autorise.
      for (const interdit of ["En forme", "Prêt à performer", "Pret a performer"]) {
        const attendu = vm && vm.header.stateChip && vm.header.stateChip.label === interdit;
        if (!attendu && texte.includes(interdit)) {
          fautesForme.push(`${p.fichier} : "${interdit}" affiche sans autorisation du ViewModel`);
        }
      }
      // Jargon de charge : jamais, nulle part.
      for (const jargon of ["ATL", "CTL", "TSB"]) {
        if (new RegExp(`\\b${jargon}\\b`).test(texte)) {
          fautesForme.push(`${p.fichier} : jargon "${jargon}"`);
        }
      }
      // Aucun repere numerique brut dans le trace.
      const doc = documentEcran(html);
      if (doc) {
        const courbe = doc.querySelector('[data-testid="home-vnext-courbe"]');
        if (courbe && (courbe.textContent || "").trim().length > 0) {
          fautesForme.push(`${p.fichier} : du texte dans le trace ("${courbe.textContent.trim().slice(0, 30)}")`);
        }
      }
    }
    const etatsSansTendance = FIXTURES.filter((f) => {
      const vm = VM_PAR_ETAT.get(f.id);
      return vm && vm.form && vm.form.kind === "insufficient";
    }).map((f) => f.id);
    noter(
      "f) Absence de faux etat de forme et de courbe fabriquee",
      fautesForme.length === 0 ? "PASS" : "FAIL",
      `Verifie sur les ${vnextPages.length} pages vNext : (1) aucune courbe sur un etat a donnees insuffisantes,\n` +
        `(2) aucun libelle d'etat que le ViewModel n'ait autorise, (3) aucun ATL/CTL/TSB, (4) aucun chiffre dans le trace.\n` +
        `Etats sans tendance (donc sans courbe attendue) : ${etatsSansTendance.join(", ")}.\n` +
        (fautesForme.length ? `ECARTS : ${fautesForme.slice(0, 10).join(" | ")}` : "aucun ecart.")
    );

    // -------------------------------------------------------------------------
    // (g) Absence de "serie"
    // -------------------------------------------------------------------------
    const motifSerie = /s[ée]rie|streak|jours? d['’]affil[ée]e|flamme|🔥/i;
    const fautesSerie = [];
    for (const p of vnextPages) {
      const html = contenus.get(p.fichier);
      if (!html) continue;
      const texte = texteEcran(html);
      const m = texte.match(motifSerie);
      if (m) fautesSerie.push(`${p.fichier} : "${m[0]}"`);
    }
    // Les sources aussi : un mot present dans le code finira un jour a l'ecran.
    const dossiersSources = [
      path.join(APP_ROOT, "screens/homeVNext"),
      path.join(APP_ROOT, "components/homeVNext"),
    ];
    const fautesSources = [];
    for (const dossier of dossiersSources) {
      for (const nom of fs.readdirSync(dossier)) {
        if (!/\.tsx?$/.test(nom)) continue;
        const src = fs.readFileSync(path.join(dossier, nom), "utf8");
        src.split("\n").forEach((ligne, i) => {
          const m = ligne.match(motifSerie);
          if (!m) return;
          // Un commentaire qui EXPLIQUE l'interdiction n'est pas une infraction.
          const estCommentaire = /^\s*(\/\/|\*|\/\*)/.test(ligne);
          if (estCommentaire) return;
          fautesSources.push(`${nom}:${i + 1} "${m[0]}" -> ${ligne.trim().slice(0, 60)}`);
        });
      }
    }
    noter(
      "g) Absence de « Serie » (mot, metrique, flamme)",
      fautesSerie.length === 0 && fautesSources.length === 0 ? "PASS" : "FAIL",
      `Motif : /s[ée]rie|streak|jours d'affilee|flamme|emoji flamme/i, insensible a la casse.\n` +
        `Cherche dans le HTML rendu des ${vnextPages.length} pages vNext ET dans les sources de\n` +
        `screens/homeVNext + components/homeVNext (hors commentaires, qui expliquent l'interdiction).\n` +
        (fautesSerie.length ? `RENDU : ${fautesSerie.slice(0, 6).join(" | ")}\n` : "rendu : aucune occurrence.\n") +
        (fautesSources.length ? `SOURCES : ${fautesSources.slice(0, 6).join(" | ")}` : "sources : aucune occurrence.")
    );

    // -------------------------------------------------------------------------
    // (h) Aucune metrique supposee
    // -------------------------------------------------------------------------
    const fautesSupposees = [];
    for (const f of FIXTURES) {
      const vm = VM_PAR_ETAT.get(f.id);
      if (!vm) continue;
      const exclus = f.input.formTrend ? f.input.formTrend.autoClubDaysExcluded : 0;
      const page = vnextPages.find((p) => p.etat === f.id && p.largeur === 375 && p.echelle === 1 && p.vue === "entiere");
      const texte = page ? texteEcran(contenus.get(page.fichier) || "") : "";
      if (vm.form && vm.form.kind === "available") {
        // La portee est OBLIGATOIRE et doit etre affichee.
        if (!texte.includes("Calculé sur tes séances FKS uniquement")) {
          fautesSupposees.push(`${f.id} : la portee de la mesure n'est pas affichee`);
        }
        if (exclus > 0 && !texte.includes("entraînements club n'y sont pas comptés")) {
          fautesSupposees.push(
            `${f.id} : ${exclus} jours de charge club auto ecartes, mais l'ecran ne le dit pas`
          );
        }
      }
      // Le compteur de semaine ne doit compter que des seances FKS terminees.
      if (vm.week && vm.week.doneCount !== f.input.fksSessionsCompletedThisWeek) {
        fautesSupposees.push(
          `${f.id} : semaine affichee ${vm.week.doneCount} != seances FKS reelles ${f.input.fksSessionsCompletedThisWeek}`
        );
      }
    }
    noter(
      "h) Aucune charge club supposee presentee comme realisee",
      fautesSupposees.length === 0 ? "PASS" : "FAIL",
      `Pour chaque etat a tendance disponible : la portee de la mesure doit etre ecrite, et quand des jours\n` +
        `de charge club auto ont ete ecartes (autoClubDaysExcluded > 0), l'ecran doit le dire noir sur blanc.\n` +
        `Le compteur de semaine est recoupe avec le nombre de seances FKS reellement terminees.\n` +
        (fautesSupposees.length ? `ECARTS : ${fautesSupposees.join(" | ")}` : "aucun ecart sur les 15 etats.")
    );
  }

  // ---------------------------------------------------------------------------
  // MESURES NAVIGATEUR — (c bis), (d), (i), (j), (k), (l) et le tableau
  // ---------------------------------------------------------------------------
  let mesures = null;
  if (avecMesures) {
    const { serveur, port } = await demarrerServeur();
    const r = await mesurer(pages, port);
    serveur.close();
    if (!r.ok) {
      noter("d/i/j/k) Mesures dans un navigateur", "NON_EXECUTE", r.raison);
    } else {
      mesures = r.mesures;
      console.log(`         (moteur de rendu : ${r.navigateur})`);
      analyserMesures(mesures, pages, r.navigateur);

      // Le tableau de comparaison des hauteurs.
      const tab = tableauComparatif(mesures, pages);
      const dossierLivrable = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27");
      fs.mkdirSync(dossierLivrable, { recursive: true });
      const entete =
        "# Hauteur de page — Home actuel contre proposition vNext\n\n" +
        "Donnees FICTIVES. Mesure faite dans un vrai moteur de rendu (Chrome sans interface),\n" +
        "sur la vue « page entiere » (rien n'est coupe), marges de safe area comprises.\n" +
        "Meme moteur, meme feuille de style, meme methode des deux cotes.\n\n" +
        "Genere par `node prototype/home-vnext/verifier.js`.\n\n";
      fs.writeFileSync(path.join(dossierLivrable, "mesures-hauteurs.md"), entete + tab.md + "\n", "utf8");
      console.log("");
      console.log(tab.md);
      console.log("");
      console.log(`  Tableau ecrit dans outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs.md`);
    }
  }

  // ---------------------------------------------------------------------------
  // (m) Idempotence
  // ---------------------------------------------------------------------------
  if (faire("idempotence")) {
    verifierIdempotence();
  }

  // ---------------------------------------------------------------------------
  // Sortie
  // ---------------------------------------------------------------------------
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
// Analyse des mesures
// ---------------------------------------------------------------------------
function cle(p) {
  return `${p.variante}|${p.etat}|${p.largeur}|${p.echelle}|${p.vue}`;
}

function analyserMesures(mesures, pages, navigateur) {
  const vnext = pages.filter((p) => p.variante === "vnext");
  const entieresVNext = vnext.filter((p) => p.vue === "entiere" && p.echelle === 1);
  const x13 = vnext.filter((p) => p.echelle !== 1 && p.vue === "entiere");

  // --- erreurs de mesure -----------------------------------------------------
  const enErreur = pages.filter((p) => {
    const m = mesures[cle(p)];
    return !m || m.erreur;
  });
  noter(
    "c bis) Mesure reelle du rendu dans un navigateur",
    enErreur.length === 0 ? "PASS" : "FAIL",
    `Moteur : ${navigateur} (sans interface).\n` +
      `${pages.length} pages chargees et mesurees ; ${pages.length - enErreur.length} sans erreur.\n` +
      (enErreur.length
        ? `EN ERREUR : ${enErreur.slice(0, 8).map((p) => p.fichier + " -> " + (mesures[cle(p)] || {}).erreur).join(" | ")}`
        : "aucune erreur de mesure.")
  );

  // --- (e bis) un seul aplat colore -----------------------------------------
  const tropDAplats = [];
  for (const p of vnext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    if ((m.aplats || []).length > 1) {
      tropDAplats.push(`${p.fichier} : ${m.aplats.map((a) => a.couleur).join(" + ")}`);
    }
    if ((m.marqueurs || {}).actionPrincipale !== 1) {
      tropDAplats.push(`${p.fichier} : ${m.marqueurs.actionPrincipale} emplacements d'action`);
    }
  }
  noter(
    "e bis) Un seul aplat colore par ecran (mesure des couleurs rendues)",
    tropDAplats.length === 0 ? "PASS" : "FAIL",
    `Compte, dans le rendu, les surfaces d'au moins 120x40 px au fond opaque et sombre (luminance < 0,5).\n` +
      `Ce compte est independant du marqueur : il attraperait un second aplat pose par un autre composant.\n` +
      (tropDAplats.length ? `ECARTS : ${tropDAplats.join(" | ")}` : "au plus un aplat par ecran, sur toutes les pages vNext.")
  );

  // --- (j) zones tactiles ----------------------------------------------------
  const tropPetites = [];
  let nbTactiles = 0;
  for (const p of vnext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    for (const t of m.tactiles || []) {
      nbTactiles++;
      if (t.hauteur + 0.5 < TAILLE_TACTILE_MIN) {
        tropPetites.push(`${p.etat} ${p.largeur}px ${t.role} "${t.libelle.slice(0, 24)}" = ${t.hauteur} pt`);
      }
    }
  }
  noter(
    "j) Zones tactiles >= 44 pt",
    tropPetites.length === 0 ? "PASS" : "FAIL",
    `${nbTactiles} elements interactifs mesures sur l'ensemble des pages vNext (role button/link ou focusable).\n` +
      `Plancher : ${TAILLE_TACTILE_MIN} pt de hauteur reelle.\n` +
      (tropPetites.length
        ? `SOUS LE PLANCHER : ${[...new Set(tropPetites)].slice(0, 10).join(" | ")}`
        : "aucun element sous le plancher.")
  );

  // --- (k) contrastes --------------------------------------------------------
  const sousLeSeuil = new Map();
  let nbTextes = 0;
  let pireRatio = 99;
  let pireTexte = "";
  const ratiosCles = new Map();
  for (const p of vnext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    for (const c of m.contrastes || []) {
      nbTextes++;
      const seuil = c.grandTexte ? SEUIL_CONTRASTE_AA_GRAND : SEUIL_CONTRASTE_AA;
      const identite = `${c.couleur} sur ${c.fond} (${c.taille}px/${c.graisse})`;
      if (!ratiosCles.has(identite)) ratiosCles.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
      if (c.ratio < pireRatio) {
        pireRatio = c.ratio;
        pireTexte = `${c.texte} — ${identite}`;
      }
      if (c.ratio + 0.005 < seuil) {
        sousLeSeuil.set(identite, { ratio: c.ratio, exemple: c.texte, seuil, etat: p.etat });
      }
    }
  }
  const listeRatios = [...ratiosCles.entries()]
    .sort((a, b) => a[1].ratio - b[1].ratio)
    .slice(0, 8)
    .map(([id, v]) => `${v.ratio}:1 — ${id} (« ${v.exemple} »)`);
  noter(
    "k) Contraste WCAG des textes rendus",
    sousLeSeuil.size === 0 ? "PASS" : "FAIL",
    `Calcul WCAG 2.1 sur les COULEURS REELLEMENT RENDUES : couleur du texte composee sur son fond effectif\n` +
      `(premier fond opaque trouve en remontant les parents). ${nbTextes} textes mesures, ` +
      `${ratiosCles.size} combinaisons distinctes.\n` +
      `Seuils : ${SEUIL_CONTRASTE_AA}:1 en texte normal, ${SEUIL_CONTRASTE_AA_GRAND}:1 en grand texte (>= 24px, ou >= 18,66px gras).\n` +
      `Pire ratio de tout le prototype : ${pireRatio}:1 (${pireTexte}).\n` +
      `Les 8 plus bas :\n  ` +
      listeRatios.join("\n  ") +
      (sousLeSeuil.size
        ? `\nSOUS LE SEUIL : ${[...sousLeSeuil.entries()].map(([id, v]) => `${id} = ${v.ratio}:1 (seuil ${v.seuil})`).join(" | ")}`
        : "\nAucun texte sous son seuil.")
  );

  // --- (d) texte agrandi x1,3 ------------------------------------------------
  const problemesX13 = [];
  const clampesX13 = [];
  for (const p of x13) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    for (const c of m.chevauchements || []) {
      problemesX13.push(`${p.etat} : « ${c.a} » recouvre « ${c.b} » (${c.recouvrement} px)`);
    }
    for (const d of m.debordements || []) {
      problemesX13.push(`${p.etat} : « ${d.texte} » deborde de ${Math.max(d.droite, d.gauche)} px`);
    }
    for (const cl of m.clampes || []) clampesX13.push(`${p.etat} : « ${cl.texte} »`);
  }
  const clampesX1 = [];
  for (const p of entieresVNext.filter((q) => q.largeur === SCALE_WIDTH)) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    for (const cl of m.clampes || []) clampesX1.push(`${p.etat} : « ${cl.texte} »`);
  }
  noter(
    "d) Texte agrandi x1,3 — chevauchement et troncature",
    problemesX13.length === 0 ? "PASS" : "FAIL",
    `${x13.length} pages a 375 px en texte x1,3.\n` +
      `Chevauchement = deux textes du flux dont les boites se recouvrent (le decor absolu est exclu).\n` +
      `Debordement = un element qui sort du cadre de l'appareil.\n` +
      `${problemesX13.length} probleme(s).` +
      (problemesX13.length ? `\n${problemesX13.slice(0, 10).join("\n")}` : "") +
      `\nTextes reellement coupes par numberOfLines : ${clampesX1.length} a l'echelle 1, ` +
      `${clampesX13.length} a x1,3.` +
      (clampesX13.length ? `\n  ${[...new Set(clampesX13)].slice(0, 8).join("\n  ")}` : "")
  );

  // --- (l) textes longs ------------------------------------------------------
  const stress = vnext.filter((p) => p.etat === "stress-textes-longs" && p.vue === "entiere");
  const problemesStress = [];
  for (const p of stress) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) {
      problemesStress.push(`${p.largeur}px x${p.echelle} : non mesure`);
      continue;
    }
    for (const d of m.debordements || []) {
      problemesStress.push(`${p.largeur}px x${p.echelle} : « ${d.texte} » deborde de ${Math.max(d.droite, d.gauche)} px`);
    }
    for (const c of m.chevauchements || []) {
      problemesStress.push(`${p.largeur}px x${p.echelle} : « ${c.a} » recouvre « ${c.b} »`);
    }
  }
  const stressClampes = stress
    .map((p) => {
      const m = mesures[cle(p)];
      return m && !m.erreur ? `${p.largeur}px x${p.echelle} : ${(m.clampes || []).length} texte(s) coupe(s)` : null;
    })
    .filter(Boolean);
  noter(
    "l) Textes longs (fixture de stress)",
    problemesStress.length === 0 ? "PASS" : "FAIL",
    `Fixture « stress-textes-longs » : prenom de 25 caracteres, titre de seance de 108, raison de 250,\n` +
      `conseil de 200, objectif hebdo de 9 seances. Rendue aux ${DEVICES.length} largeurs + texte x1,3.\n` +
      `Debordements : ${problemesStress.length}.` +
      (problemesStress.length ? `\n${problemesStress.join("\n")}` : " Aucun.") +
      `\nTroncatures (comportement ATTENDU de numberOfLines, pas un defaut) :\n  ${stressClampes.join("\n  ")}`
  );

  // --- (i) rien sous la barre d'onglets --------------------------------------
  const lignes = [];
  let pire = null;
  const respirationTropCourte = [];
  const RESPIRATION_MIN = 24; // espacement.finDEcran
  for (const p of entieresVNext) {
    const m = mesures[cle(p)];
    if (!m || m.erreur) continue;
    const reste = m.hauteurVisible - m.hauteurTotale;
    lignes.push({
      etat: p.etat,
      largeur: p.largeur,
      hauteur: m.hauteurTotale,
      visible: m.hauteurVisible,
      reste,
      respiration: m.respirationFinale,
    });
    if (m.respirationFinale !== null && m.respirationFinale < RESPIRATION_MIN) {
      respirationTropCourte.push(`${p.etat}@${p.largeur} = ${m.respirationFinale} px`);
    }
    if (!pire || reste < pire.reste) pire = { etat: p.etat, largeur: p.largeur, reste, hauteur: m.hauteurTotale };
  }
  const quiDepassent = lignes.filter((l) => l.reste < 0);
  const respirations = lignes.map((l) => l.respiration).filter((r) => r !== null);
  const respirationMin = respirations.length ? Math.min(...respirations) : null;
  const respirationMax = respirations.length ? Math.max(...respirations) : null;
  const device375 = DEVICES.find((d) => d.width === 375);
  noter(
    "i) Aucun contenu masque par la barre d'onglets",
    respirationTropCourte.length === 0 ? "PASS" : "FAIL",
    `HYPOTHESE D'INSET UTILISEE (elle conditionne ce verdict, cf. AUDIT_HOME.md §7.3) :\n` +
      `  la barre d'onglets est un FRERE de l'ecran dans une colonne flex — le contenu n'est JAMAIS derriere.\n` +
      `  L'ecran recoit donc « hauteur d'ecran - (49 pt de barre + inset bas) », et <Screen> applique\n` +
      `  en plus l'inset bas REEL a l'interieur (34 px sur un iPhone X). Le harnais ne bouchonne PAS\n` +
      `  insets.bottom a 0 : c'est ce bouchon-la qui avait fabrique un faux chevauchement dans le\n` +
      `  premier harnais de l'audit.\n` +
      `  Exemple 375 px : ${device375.calcul}\n` +
      `MESURE : sur ${lignes.length} couples etat x largeur, ${quiDepassent.length} ecran(s) depassent la zone\n` +
      `visible et demandent donc un defilement — ce qui n'est PAS un masquage : le contenu reste atteignable.\n` +
      (quiDepassent.length
        ? `  Concernes : ${quiDepassent.map((l) => `${l.etat}@${l.largeur} (+${-l.reste} px a faire defiler)`).join(", ")}\n`
        : `  Aucun : tous les ecrans tiennent sans defiler.\n`) +
      `  Marge la plus faible : ${pire.etat} a ${pire.largeur} px — ${pire.hauteur} px de contenu, ` +
      `${pire.reste >= 0 ? pire.reste + " px de marge restante" : -pire.reste + " px a defiler"}.\n` +
      `CRITERE QUI FAIT ECHOUER CETTE VERIFICATION : le VIDE reel en bas d'ecran, mesure entre le bas du\n` +
      `dernier element de contenu et le bas de la page. Sous ${RESPIRATION_MIN} px le dernier element serait colle a la\n` +
      `barre d'onglets ; a l'inverse, l'audit mesure 70 px de vide sur le Home actuel (defaut a corriger).\n` +
      `Attendu ici : 24 px de respiration + l'inset bas applique par <Screen> (34 px sur appareil a encoche,\n` +
      `0 sur iPhone SE et iPad). Mesure : de ${respirationMin} a ${respirationMax} px selon l'appareil.\n` +
      (respirationTropCourte.length
        ? `  TROP COURTE : ${respirationTropCourte.join(", ")}\n`
        : `  Aucun etat sous le plancher.\n`) +
      `LIMITE : mesure dans Chrome avec la police du systeme, pas sur l'iPhone de Kyllian (SF Pro). ` +
      `Les hauteurs sont justes a quelques pixels, pas au pixel. Et la hauteur reelle de la barre d'onglets ` +
      `(49 + inset) reste a confirmer sur telephone.`
  );
}

// ---------------------------------------------------------------------------
// LE TABLEAU DE COMPARAISON — le chiffre que le fondateur regarde en premier
// ---------------------------------------------------------------------------
// Ce qui est compare : la HAUTEUR TOTALE DE PAGE de l'ecran, marges de safe
// area comprises, mesuree dans la vue « page entiere » (celle ou rien n'est
// coupe). Meme moteur de rendu, meme feuille de style, meme methode des deux
// cotes : l'ecart ne peut donc pas venir du harnais.
//
// « Blocs » = nombre de blocs de premier niveau dans le conteneur de contenu.
// C'est le nombre de choses que l'oeil doit trier en ouvrant l'ecran.
// ---------------------------------------------------------------------------
function tableauComparatif(mesures, pages) {
  const lignes = [];
  const etats = [...new Set(pages.map((p) => p.etat))];
  const largeurs = DEVICES.map((d) => d.width);

  for (const etat of etats) {
    for (const largeur of largeurs) {
      const kv = `vnext|${etat}|${largeur}|1|entiere`;
      const ka = `actuel|${etat}|${largeur}|1|entiere`;
      const v = mesures[kv];
      const a = mesures[ka];
      if (!v || v.erreur) continue;
      const device = DEVICES.find((d) => d.width === largeur);
      lignes.push({
        etat,
        largeur,
        visible: device.stageVisible,
        vnextH: v.hauteurTotale,
        vnextBlocs: v.nbBlocs,
        actuelH: a && !a.erreur ? a.hauteurTotale : null,
        actuelBlocs: a && !a.erreur ? a.nbBlocs : null,
      });
    }
  }

  const md = [];
  md.push("| Etat | Largeur | Home actuel | vNext | Ecart px | Ecart % | Blocs actuel -> vNext |");
  md.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const l of lignes) {
    const ecart = l.actuelH !== null ? l.vnextH - l.actuelH : null;
    const pct = l.actuelH ? Math.round((ecart / l.actuelH) * 1000) / 10 : null;
    md.push(
      `| ${l.etat} | ${l.largeur} | ${l.actuelH !== null ? l.actuelH + " px" : "—"} | ${l.vnextH} px | ` +
        `${ecart !== null ? (ecart > 0 ? "+" : "") + ecart : "—"} | ` +
        `${pct !== null ? (pct > 0 ? "+" : "") + pct + " %" : "—"} | ` +
        `${l.actuelBlocs !== null ? l.actuelBlocs : "—"} -> ${l.vnextBlocs} |`
    );
  }

  const avecPaire = lignes.filter((l) => l.actuelH !== null);
  const totalA = avecPaire.reduce((s, l) => s + l.actuelH, 0);
  const totalV = avecPaire.reduce((s, l) => s + l.vnextH, 0);
  const moyPct = totalA ? Math.round(((totalV - totalA) / totalA) * 1000) / 10 : 0;
  const blocsA = avecPaire.reduce((s, l) => s + l.actuelBlocs, 0) / (avecPaire.length || 1);
  const blocsV = avecPaire.reduce((s, l) => s + l.vnextBlocs, 0) / (avecPaire.length || 1);

  md.push("");
  md.push(
    `**Moyenne sur les ${avecPaire.length} comparaisons possibles : ${moyPct} % de hauteur de page.** ` +
      `Blocs de premier niveau : ${arrondi(blocsA)} en moyenne aujourd'hui, ${arrondi(blocsV)} dans la proposition.`
  );
  const sansDefiler = lignes.filter((l) => l.vnextH <= l.visible).length;
  const sansDefilerA = avecPaire.filter((l) => l.actuelH <= l.visible).length;
  md.push("");
  md.push(
    `Ecrans qui tiennent SANS DEFILER : ${sansDefiler} sur ${lignes.length} pour la proposition, ` +
      `${sansDefilerA} sur ${avecPaire.length} pour le Home actuel.`
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
      marqueurs: m.marqueurs,
      nbTactiles: (m.tactiles || []).length,
      tactileMin: (m.tactiles || []).reduce((a, t) => Math.min(a, t.hauteur), 999),
      nbAplats: (m.aplats || []).length,
      contrasteMin: (m.contrastes || []).reduce((a, c) => Math.min(a, c.ratio), 99),
      nbClampes: (m.clampes || []).length,
      nbDebordements: (m.debordements || []).length,
      nbChevauchements: (m.chevauchements || []).length,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// (m) Idempotence
// ---------------------------------------------------------------------------
function empreinteDossier(racine) {
  const empreintes = {};
  const parcourir = (dossier, prefixe) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dossier, e.name);
      const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
      if (rel.startsWith("_verif")) continue; // sortie du verificateur, pas du build
      if (e.isDirectory()) parcourir(abs, rel);
      else empreintes[rel] = crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex");
    }
  };
  parcourir(racine, "");
  return empreintes;
}

function verifierIdempotence() {
  const DATE_FIXE = "2026-07-27T00:00:00.000Z";
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
    noter("m) Idempotence du build", "FAIL", `1er build en echec : ${(r1.stderr || "").slice(0, 400)}`);
    return;
  }
  const a = empreinteDossier(OUT_ROOT);
  const r2 = lancer();
  if (r2.status !== 0) {
    noter("m) Idempotence du build", "FAIL", `2e build en echec : ${(r2.stderr || "").slice(0, 400)}`);
    return;
  }
  const b = empreinteDossier(OUT_ROOT);

  const clesA = Object.keys(a);
  const clesB = Object.keys(b);
  const differents = clesA.filter((k) => a[k] !== b[k]);
  const absents = clesA.filter((k) => !(k in b)).concat(clesB.filter((k) => !(k in a)));

  // On separe les deux variantes : elles n'ont pas le meme droit a l'erreur.
  // Ce qui est juge, c'est le PROTOTYPE. Les pages du Home de production sont
  // rendues par du code qu'on n'a pas le droit de toucher.
  const estVNext = (k) => !k.startsWith("pages/actuel/");
  const cotePrototype = clesA.filter(estVNext);
  const cotePrototypeDifferents = differents.filter(estVNext);
  const coteActuelDifferents = differents.filter((k) => !estVNext(k));

  noter(
    "m) Idempotence : deux builds successifs donnent le meme resultat",
    cotePrototypeDifferents.length === 0 && absents.length === 0 ? "PASS" : "FAIL",
    `Deux executions consecutives de build.js, empreinte SHA-1 de chacun des ${clesA.length} fichiers produits.\n` +
      `La date de generation est figee par FKS_DATE_FIXE le temps de la comparaison : c'est la seule valeur\n` +
      `volontairement variable de la sortie (elle est affichee au fondateur pour qu'il sache de quand date ce\n` +
      `qu'il regarde). Le numero de version des feuilles de style, lui, est desormais derive du CODE SOURCE et\n` +
      `non de l'heure — correction apportee a build.js, qui utilisait Date.now() et rendait toute comparaison\n` +
      `impossible.\n` +
      `\n` +
      `COTE PROTOTYPE (ce qui est juge) : ${cotePrototype.length - cotePrototypeDifferents.length}/${cotePrototype.length} fichiers identiques au bit pres.` +
      (cotePrototypeDifferents.length
        ? `\n  DIFFERENTS : ${cotePrototypeDifferents.slice(0, 10).join(", ")}`
        : "") +
      `\n` +
      `\n` +
      `COTE HOME DE PRODUCTION (informatif) : ${coteActuelDifferents.length} page(s) different(s) d'un build a l'autre.\n` +
      (coteActuelDifferents.length
        ? `  CAUSE TROUVEE, ET CE N'EST PAS LE HARNAIS : components/home/HomePrimaryCTA.tsx lance un\n` +
          `  Animated.loop INFINI (pulsation d'echelle 1 -> 1,015, 900 ms dans chaque sens) qui ne consulte\n` +
          `  PAS reduceMotion — contrairement au fondu d'entree du meme ecran, qui le respecte. Le harnais\n` +
          `  capture donc le bouton a un instant quelconque de sa pulsation : la seule difference entre deux\n` +
          `  builds est la valeur de scale, par exemple 1.0146411 contre 1.0147588.\n` +
          `  Deux consequences, toutes deux reelles : (1) aucune comparaison visuelle automatique du Home\n` +
          `  actuel n'est possible tant que cette boucle tourne ; (2) un joueur qui a active « reduire les\n` +
          `  animations » voit quand meme le bouton pulser en permanence.\n` +
          `  NON CORRIGE : components/home/ est hors du perimetre autorise de ce prototype.\n`
        : "") +
      `PIEGE A CONNAITRE : l'empreinte des feuilles de style suit les dates de modification des sources.\n` +
      `Modifier un fichier du prototype PENDANT la comparaison la fait echouer pour cette raison-la, et pas\n` +
      `pour une autre. Mesure a faire sur un arbre au repos.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
