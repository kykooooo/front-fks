// prototype/home-vnext/verifier-variante2.js
// =============================================================================
// VERIFICATION DE LA VARIANTE 2 — LA CARTE « MA PROGRESSION »
// =============================================================================
//   node prototype/home-vnext/verifier-variante2.js
//
// `verifier.js` juge la variante 1 sur ses 150 pages. Il ne regarde PAS les 60
// pages de la variante 2 : elles n'existaient pas quand il a ete ecrit. Ce
// fichier fait le meme travail, avec les memes outils et les memes seuils, sur
// la variante 2 — plus les regles qui n'existent que pour elle (R1, R3, R4, R5,
// R6, R7, R8 du cadre de la mission).
//
// TROIS PRINCIPES, REPRIS DE verifier.js :
//   1. On mesure le RENDU, pas le code. Les couleurs, les hauteurs, les zones
//      tactiles et les contrastes sont lus dans un vrai moteur de rendu
//      (Chrome sans interface), jamais deduits d'une feuille de style.
//   2. L'ATTENDU vient du CONTRAT (`buildProgressionViewModel`), pas d'une
//      constante ecrite ici. Si une fixture bouge, l'attendu bouge avec elle et
//      la verification garde son sens.
//   3. Aucune verification n'est annoncee sans avoir tourne. Ce qui n'a pas pu
//      etre execute sort en NON_EXECUTE avec sa raison.
//
// AUCUN appel reseau vers l'exterieur, AUCUN Firestore, AUCUNE generation.
// Un serveur local ephemere sert `out/` sur 127.0.0.1, le temps de la mesure.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { JSDOM } = require("jsdom");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");
const { DEVICES, SCALE_WIDTH, TEXT_SCALE } = require("./lib/devices");
const { mesureHtml } = require("./lib/mesureTemplate");

// ---------------------------------------------------------------------------
// Reglages — identiques a verifier.js, volontairement.
// ---------------------------------------------------------------------------
const SEUIL_CONTRASTE_AA = 4.5;
const SEUIL_CONTRASTE_AA_GRAND = 3.0;
const TAILLE_TACTILE_MIN = 44;
const RESPIRATION_MIN = 24;
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
const progMod = require(path.join(APP_ROOT, "screens/homeVNext/progressionViewModel.ts"));
const { MARQUEURS } = require(path.join(APP_ROOT, "components/homeVNext/homeVNextMarqueurs.ts"));
const appariement = require("./lib/appariementVariante2");

const FIXTURES_HOME = fixturesMod.HOME_VNEXT_FIXTURES_RENDU || fixturesMod.HOME_VNEXT_FIXTURES;
const FIXTURES_PROG = fixturesMod.PROGRESSION_FIXTURES_RENDU || [];

/** Un cas de variante 2 : l'appariement, ses deux fixtures, ses deux ViewModels. */
const CAS = appariement.APPARIEMENTS.map((app) => {
  const fp = FIXTURES_PROG.find((f) => f.id === app.progression);
  const fh = FIXTURES_HOME.find((f) => f.id === app.hote);
  return {
    app,
    id: app.id,
    hote: app.hote,
    progVm: fp ? progMod.buildProgressionViewModel(fp.input) : null,
    // MEMES OPTIONS QUE LE RENDU (lib/render.js) : sans elles, l'attendu serait
    // calcule sur un ViewModel de variante 1 pendant qu'on mesure des pages de
    // variante 2. Un verificateur qui ne verifie pas la meme chose que ce qui
    // est rendu est pire que pas de verificateur.
    homeVm: fh ? vmMod.buildHomeVNextViewModel(fh.input, appariement.OPTIONS_VM_VARIANTE2) : null,
    // Le ViewModel de la VARIANTE 1 du meme ecran hote, garde exprès : c'est lui
    // qui dit ce que la colonne de gauche affiche, et donc ce que la variante 2
    // retire.
    homeVmV1: fh ? vmMod.buildHomeVNextViewModel(fh.input) : null,
    input: fp ? fp.input : null,
  };
});

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
// Serveur local ephemere
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

function lancerNavigateur(navigateur, args) {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const p = spawn(navigateur, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    p.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    const minuteur = setTimeout(() => {
      p.kill();
      resolve({ stdout, stderr: stderr + "\n[verificateur] delai depasse, navigateur arrete." });
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

// ---------------------------------------------------------------------------
// Inventaire des pages
// ---------------------------------------------------------------------------
function suffixe(echelle) {
  return echelle === 1 ? "" : `-x${String(echelle).replace(".", "")}`;
}

/** Les 60 pages de la variante 2, plus les pages d'ecran hote qu'elles remplacent. */
function pagesAttendues() {
  const liste = [];
  for (const cas of CAS) {
    for (const d of DEVICES) {
      const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
      for (const echelle of echelles) {
        for (const vue of ["visible", "entiere"]) {
          liste.push({
            variante: "vnext2",
            cas: cas.id,
            etat: cas.id,
            largeur: d.width,
            echelle,
            vue,
            hauteurVisible: d.stageVisible,
            fichier: `pages/vnext2/${cas.id}-${d.width}${suffixe(echelle)}-${vue}.html`,
          });
          liste.push({
            variante: "vnext",
            cas: cas.id,
            etat: cas.hote,
            largeur: d.width,
            echelle,
            vue,
            hauteurVisible: d.stageVisible,
            fichier: `pages/vnext/${cas.hote}-${d.width}${suffixe(echelle)}-${vue}.html`,
          });
        }
      }
    }
  }
  // Un meme ecran hote sert deux cas (tendance-indisponible) : on ne le mesure
  // qu'une fois, sinon Chrome refait le meme travail pour rien.
  const vues = new Set();
  return liste.filter((p) => {
    const cle = `${p.variante}|${p.fichier}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

// La cle d'une mesure est indexee sur l'ETAT RENDU, pas sur le cas de carte :
// deux cas de variante 2 partagent le meme ecran hote (tendance-indisponible
// sert v2-deux-seances ET v2-donnee-manquante). Indexer sur le cas ferait
// disparaitre la mesure de l'hote dedoublonne — et une ligne entiere du tableau
// de hauteurs avec elle. Defaut constate au premier passage.
const cle = (p) => `${p.variante}|${p.etat}|${p.largeur}|${p.echelle}|${p.vue}`;

async function mesurer(pages, port) {
  const navigateur = NAVIGATEURS.find((p) => fs.existsSync(p));
  if (!navigateur) return { ok: false, raison: "aucun navigateur Chrome/Edge sur la machine" };

  const cibles = pages.map((p) => ({
    cle: cle(p),
    url: `/${p.fichier}`,
    largeur: p.largeur,
    hauteurVisible: p.hauteurVisible,
  }));

  fs.mkdirSync(DOSSIER_VERIF, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_VERIF, "mesures-v2.html"), mesureHtml(cibles), "utf8");

  const profil = path.join(require("os").tmpdir(), "fks-home-vnext-chrome-v2");
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
    `http://127.0.0.1:${port}/_verif/mesures-v2.html`,
  ]);

  const sortie = res.stdout || "";
  const debut = sortie.indexOf("###JSON###");
  const fin = sortie.indexOf("###FIN###");
  if (debut === -1 || fin === -1) {
    return {
      ok: false,
      raison: "le navigateur n'a pas rendu de JSON. " + (sortie.slice(0, 300) || "(vide)"),
    };
  }
  const json = sortie
    .slice(debut + "###JSON###".length, fin)
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
// Lecture statique du HTML
// ---------------------------------------------------------------------------
const lire = (rel) => fs.readFileSync(path.join(OUT_ROOT, rel), "utf8");
const normaliserTexte = (s) => (s || "").replace(/\s+/g, " ").trim();

function docDe(html) {
  const dom = new JSDOM(html);
  return dom.window.document;
}

/** L'ecran seul (sans le bandeau d'identification du harnais). */
function ecranDe(html) {
  const d = docDe(html);
  return d.querySelector(".device");
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log("");
  console.log("  VERIFICATION DE LA VARIANTE 2 — CARTE « MA PROGRESSION »");
  console.log(`  ${CAS.length} cas · ${DEVICES.map((d) => d.width).join(" / ")} px`);
  console.log("");

  const pages = pagesAttendues();
  const pagesV2 = pages.filter((p) => p.variante === "vnext2");

  // -------------------------------------------------------------------------
  // 0. Les pages existent-elles toutes ?
  // -------------------------------------------------------------------------
  const manquantes = pages.filter((p) => !fs.existsSync(path.join(OUT_ROOT, p.fichier)));
  const pagesErreur = pages.filter((p) => {
    if (manquantes.includes(p)) return false;
    return /class="err"|La carte progression n'apparait pas/.test(lire(p.fichier));
  });
  noter(
    "0) Les 60 pages de la variante 2 sont generees et rendues",
    manquantes.length === 0 && pagesErreur.length === 0 ? "PASS" : "FAIL",
    `${pagesV2.length} pages de variante 2 attendues (6 cas x 4 largeurs x 2 vues + x1,3 a 375 px).\n` +
      `${pages.length} pages au total avec les ecrans hotes de la variante 1.\n` +
      (manquantes.length ? `MANQUANTES : ${manquantes.map((p) => p.fichier).join(", ")}\n` : "") +
      (pagesErreur.length
        ? `PAGES D'ERREUR (l'ecran n'a pas rendu la carte) : ${pagesErreur.map((p) => p.fichier).join(", ")}`
        : "aucune page d'erreur, aucune page manquante.")
  );

  // -------------------------------------------------------------------------
  // d) UN SEUL CTA PLEIN — le compte de marqueur, sur TOUTES les pages
  // -------------------------------------------------------------------------
  const compter = (html, id) => (html.match(new RegExp(`data-testid="${id}"`, "g")) || []).length;
  const compterId = (html, id) => (html.match(new RegExp(`id="${id}"`, "g")) || []).length;

  const toutesLesPages = []
    .concat(
      fs.readdirSync(path.join(OUT_ROOT, "pages/vnext")).map((f) => `pages/vnext/${f}`),
      fs.readdirSync(path.join(OUT_ROOT, "pages/vnext2")).map((f) => `pages/vnext2/${f}`)
    )
    .filter((f) => f.endsWith(".html"));
  const ctaHorsNorme = [];
  for (const rel of toutesLesPages) {
    const html = lire(rel);
    const n = compter(html, MARQUEURS.actionPrincipale);
    if (n !== 1) ctaHorsNorme.push(`${rel} : ${n}`);
  }
  noter(
    "d1) Exactement une action principale par ecran (variante 1 ET variante 2)",
    ctaHorsNorme.length === 0 ? "PASS" : "FAIL",
    `Marqueur compte : data-testid="${MARQUEURS.actionPrincipale}".\n` +
      `${toutesLesPages.length} pages analysees (${toutesLesPages.filter((f) => f.includes("/vnext/")).length} variante 1 + ` +
      `${toutesLesPages.filter((f) => f.includes("/vnext2/")).length} variante 2), attendu exactement 1 par page.\n` +
      (ctaHorsNorme.length ? `ECARTS : ${ctaHorsNorme.join(" | ")}` : "toutes a 1.")
  );

  // -------------------------------------------------------------------------
  // f) R4 — aucun libelle d'etat physique global DANS LA CARTE
  // -------------------------------------------------------------------------
  const interdits = appariement.ETATS_GLOBAUX_INTERDITS;
  const fautesR4 = [];
  for (const p of pagesV2) {
    const html = lire(p.fichier);
    const d = docDe(html);
    const carte = d.querySelector(`[data-testid="${MARQUEURS.progression}"]`);
    const texteCarte = appariement.normaliser(normaliserTexte(carte ? carte.textContent : ""));
    const trouvesCarte = interdits.filter((e) => texteCarte.includes(e));
    if (trouvesCarte.length) fautesR4.push(`${p.fichier} : ${trouvesCarte.join(", ")}`);
  }
  const chargesConnues = CAS.filter((c) => c.input && c.input.chargesClubCapturees);
  noter(
    "f) R4 — aucun etat physique global annonce par la carte",
    fautesR4.length === 0 ? "PASS" : "FAIL",
    `Libelles cherches dans le texte rendu de la CARTE (marqueur ${MARQUEURS.progression}) sur les ${pagesV2.length} pages :\n` +
      `  ${interdits.join(" · ")}\n` +
      `Les ${CAS.length} cas ont chargesClubCapturees = false (${chargesConnues.length} cas a true) : le contrat interdit\n` +
      `donc tout libelle d'etat, par le TYPE. On verifie ici le RENDU.\n` +
      (fautesR4.length ? `FAUTES : ${fautesR4.join(" | ")}` : "aucune occurrence dans la carte.")
  );

  // -------------------------------------------------------------------------
  // f2) R4 SUR L'ECRAN ENTIER — la pastille d'etat du jour
  // -------------------------------------------------------------------------
  // La ligne precedente ne juge que la CARTE. Le defaut, lui, se voyait sur
  // l'ECRAN : la pastille d'en-tete annoncait « En forme » ou « Un peu charge »
  // pendant que la carte ecrivait, 200 px plus bas, « tes entrainements club n'y
  // sont pas comptes ».
  //
  // Ce n'est plus une observation, c'est un VERDICT — et l'attendu ne depend
  // plus d'aucune donnee d'entree.
  //
  // AVANT, il etait derive de `progVm.etatGlobal.connu` : « la pastille n'a le
  // droit d'exister que si les charges club sont capturees ». Ce champ a ete
  // SUPPRIME du contrat (decision D1 du fondateur, 2026-07-28), l'expression
  // valait donc toujours 0 et le verdict etait trivialement vrai. D1 ne pose
  // pas une condition, elle pose une interdiction : aucun jugement global, quel
  // que soit l'etat des donnees. L'attendu est donc 0, ecrit en clair.
  //
  // Aucune liste de mots ici : on lit le marqueur, donc n'importe quel libelle
  // est attrape, y compris un libelle ajoute plus tard. Le controle par les
  // libelles eux-memes existe a cote (`etat_global_entete` de l'audit
  // d'appariement), pour le cas ou un etat reapparaitrait hors pastille.
  const fautesChip = [];
  const detailChip = [];
  for (const cas of CAS) {
    const attendu = 0;
    let luSurLaPage = null;
    for (const p of pagesV2.filter((x) => x.cas === cas.id)) {
      const d = docDe(lire(p.fichier));
      const chips = Array.from(d.querySelectorAll(`[data-testid="${MARQUEURS.etatDuJour}"]`));
      if (chips.length !== attendu) {
        fautesChip.push(
          `${p.fichier} : ${chips.length} pastille(s) d'etat « ${chips
            .map((c) => normaliserTexte(c.textContent))
            .join(", ")} », attendu ${attendu}`
        );
      }
      if (luSurLaPage === null && chips.length) luSurLaPage = normaliserTexte(chips[0].textContent);
    }
    const enV1 =
      cas.homeVmV1 && cas.homeVmV1.header && cas.homeVmV1.header.stateChip
        ? cas.homeVmV1.header.stateChip.label
        : null;
    detailChip.push(
      `${cas.id} : variante 1 affiche ${enV1 ? `« ${enV1} »` : "aucune pastille"} ; ` +
        `variante 2 affiche ${luSurLaPage ? `« ${luSurLaPage} »` : "aucune pastille"} ` +
        `(attendu ${attendu} — D1 : aucun jugement global, quelles que soient les donnees)`
    );
  }
  const retirees = CAS.filter(
    (c) => c.homeVmV1 && c.homeVmV1.header && c.homeVmV1.header.stateChip
  ).length;
  noter(
    "f2) D1 sur l'ECRAN — AUCUNE pastille d'etat du jour en variante 2, quelles que soient les donnees",
    fautesChip.length === 0 ? "PASS" : "FAIL",
    `Marqueur lu dans le rendu des ${pagesV2.length} pages : data-testid="${MARQUEURS.etatDuJour}".\n` +
      `Attendu 0 partout. Ce n'est plus une condition sur les donnees : le champ qui alimentait la\n` +
      `pastille (etatGlobal / libelleEtatGlobal) a ete SUPPRIME du contrat, et HomeVNextScreen retire\n` +
      `lui-meme le stateChip en variante 2. Decision D1 du fondateur (2026-07-28).\n` +
      `La variante 1 garde sa pastille : c'est l'ecart que le fondateur doit pouvoir comparer.\n  ` +
      detailChip.join("\n  ") +
      `\n` +
      `Pastilles presentes en variante 1 : ${retirees} cas sur ${CAS.length} — autant de retirees en variante 2.\n` +
      (fautesChip.length ? `ECARTS : ${fautesChip.join(" | ")}` : "aucun ecart sur les 60 pages.")
  );

  // -------------------------------------------------------------------------
  // g) R5 — aucune courbe sans vrais points
  // -------------------------------------------------------------------------
  const fautesR5 = [];
  const detailR5 = [];
  for (const cas of CAS) {
    const attendu = cas.progVm && cas.progVm.state === "ready" ? 1 : 0;
    detailR5.push(
      `${cas.id} : etat « ${cas.progVm.state} » -> ${attendu} courbe attendue` +
        (cas.progVm.state === "ready"
          ? ` (${cas.progVm.courbe.points.length} points fournis, ${cas.progVm.courbe.joursObserves} jours observes)`
          : ` (${cas.progVm.tendanceIndisponible ? cas.progVm.tendanceIndisponible.raison : "aucune tendance dans le type"})`)
    );
    for (const p of pagesV2.filter((x) => x.cas === cas.id)) {
      const html = lire(p.fichier);
      const n = compter(html, MARQUEURS.courbe);
      if (n !== attendu) fautesR5.push(`${p.fichier} : ${n} courbe(s), attendu ${attendu}`);
    }
  }
  noter(
    "g) R5 — la courbe n'existe que sur de vrais points observes",
    fautesR5.length === 0 ? "PASS" : "FAIL",
    `Marqueur compte : data-testid="${MARQUEURS.courbe}". L'attendu vient du ViewModel, pas d'une liste ecrite ici :\n  ` +
      detailR5.join("\n  ") +
      `\n` +
      (fautesR5.length ? `ECARTS : ${fautesR5.join(" | ")}` : "aucun ecart sur les 60 pages.")
  );

  // -------------------------------------------------------------------------
  // h) R6 — « serie » sous toutes ses formes
  // -------------------------------------------------------------------------
  const MOTIF = /s[ée]rie|streak|jours? d['’]affil[ée]e|flamme|🔥/i;
  const fautesRendu = [];
  for (const p of pagesV2) {
    const ecran = ecranDe(lire(p.fichier));
    const texte = normaliserTexte(ecran ? ecran.textContent : "");
    const m = texte.match(MOTIF);
    if (m) fautesRendu.push(`${p.fichier} : « ${m[0]} »`);
  }
  const sansCommentaires = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const fichiersSource = []
    .concat(
      fs
        .readdirSync(path.join(APP_ROOT, "screens/homeVNext"))
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => `screens/homeVNext/${f}`),
      fs
        .readdirSync(path.join(APP_ROOT, "components/homeVNext"))
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => `components/homeVNext/${f}`)
    );
  const fautesSource = [];
  for (const rel of fichiersSource) {
    const src = sansCommentaires(fs.readFileSync(path.join(APP_ROOT, rel), "utf8"));
    const m = src.match(MOTIF);
    if (m) fautesSource.push(`${rel} : « ${m[0].trim()} »`);
  }
  noter(
    "h) R6 — ni le mot « serie », ni la metrique, ni la flamme",
    fautesRendu.length === 0 && fautesSource.length === 0 ? "PASS" : "FAIL",
    `Motif : ${MOTIF}, insensible a la casse, sur le texte RENDU des ${pagesV2.length} pages de variante 2\n` +
      `et sur les ${fichiersSource.length} sources de screens/homeVNext + components/homeVNext\n` +
      `(commentaires retires : ils expliquent l'interdiction, ils ne l'enfreignent pas).\n` +
      `rendu : ${fautesRendu.length ? fautesRendu.join(" | ") : "aucune occurrence"}.\n` +
      `sources : ${fautesSource.length ? fautesSource.join(" | ") : "aucune occurrence"}.`
  );

  // -------------------------------------------------------------------------
  // i) R7 — le nombre de « Ma semaine » n'est pas repete par la carte
  // -------------------------------------------------------------------------
  // METHODE : on ne compare pas des ViewModels, on compare ce qui est ECRIT.
  // Dans le bloc « Ma semaine » on lit le premier entier rendu (c'est le compte
  // de seances faites) ; dans la carte on lit la valeur de chaque ligne de fait
  // dont le libelle parle de seances. Si un meme entier apparait des deux cotes,
  // le joueur lit deux fois le meme nombre : c'est la redite que R7 interdit.
  const premierEntier = (s) => {
    const m = String(s || "").match(/-?\d+/);
    return m ? Number(m[0]) : null;
  };
  const fautesR7 = [];
  const detailR7 = [];
  for (const cas of CAS) {
    const p = pagesV2.find((x) => x.cas === cas.id && x.largeur === 375 && x.echelle === 1 && x.vue === "entiere");
    const d = docDe(lire(p.fichier));
    const semaineEl = d.querySelector(`[data-testid="${MARQUEURS.semaine}"]`);
    const semaineTexte = normaliserTexte(semaineEl ? semaineEl.textContent : "");
    const nSemaine = premierEntier(semaineTexte);
    const faits = Array.from(d.querySelectorAll(`[data-testid="${MARQUEURS.progressionFait}"]`)).map((el) => {
      const t = Array.from(el.querySelectorAll("*"))
        .filter((n) => Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim()))
        .map((n) => normaliserTexte(n.textContent));
      return { libelle: t[0] || "", valeur: t[1] || "" };
    });
    const comptesDeSeances = faits.filter((f) => /s[ée]ance/i.test(f.libelle) && /^\d+$/.test(f.valeur));
    const collision = comptesDeSeances.filter((f) => premierEntier(f.valeur) === nSemaine);
    detailR7.push(
      `${cas.id} : « Ma semaine » ecrit ${nSemaine === null ? "aucun nombre" : nSemaine} (« ${semaineTexte.slice(0, 46)} »)` +
        ` ; la carte ecrit ` +
        (faits.length ? faits.map((f) => `${f.valeur} / ${f.libelle}`).join(" · ") : "aucune ligne de fait") +
        (collision.length ? "  <-- COLLISION" : "")
    );
    if (collision.length) fautesR7.push(`${cas.id} : ${collision.map((f) => f.valeur).join(", ")}`);
  }
  noter(
    "i) R7 — la carte ne repete pas le nombre de « Ma semaine »",
    fautesR7.length === 0 ? "PASS" : "FAIL",
    `Lu dans le HTML rendu a 375 px : le premier entier du bloc « Ma semaine » d'un cote, la valeur de chaque\n` +
      `ligne de fait dont le libelle parle de seances de l'autre. Un compte a rebours (« Encore 2 seances »)\n` +
      `n'est pas un compteur d'etat : sa valeur n'est pas un entier nu, il sort donc de la comparaison.\n  ` +
      detailR7.join("\n  ") +
      `\n` +
      (fautesR7.length ? `COLLISIONS : ${fautesR7.join(" | ")}` : "aucune collision.")
  );

  // -------------------------------------------------------------------------
  // j) R3 — la portee accompagne TOUJOURS la tendance
  // -------------------------------------------------------------------------
  const fautesR3 = [];
  const detailR3 = [];
  for (const cas of CAS) {
    const attendu = cas.progVm.state === "ready" ? 1 : 0;
    for (const p of pagesV2.filter((x) => x.cas === cas.id)) {
      const d = docDe(lire(p.fichier));
      const courbes = d.querySelectorAll(`[data-testid="${MARQUEURS.courbe}"]`).length;
      const portees = Array.from(d.querySelectorAll(`[data-testid="${MARQUEURS.progressionPortee}"]`));
      if (courbes > 0 && portees.length === 0) {
        fautesR3.push(`${p.fichier} : ${courbes} courbe(s) et AUCUNE portee`);
      }
      if (portees.length !== attendu) {
        fautesR3.push(`${p.fichier} : ${portees.length} portee(s), attendu ${attendu}`);
      }
      if (portees.length) {
        const texte = normaliserTexte(portees[0].textContent);
        if (texte !== normaliserTexte(cas.progVm.courbe.portee)) {
          fautesR3.push(`${p.fichier} : portee rendue « ${texte} » != contrat « ${cas.progVm.courbe.portee} »`);
        }
      }
    }
    if (attendu) detailR3.push(`${cas.id} : « ${cas.progVm.courbe.portee} »`);
  }
  noter(
    "j) R3 — toute tendance affichee porte sa portee exacte",
    fautesR3.length === 0 ? "PASS" : "FAIL",
    `Sur chacune des ${pagesV2.length} pages : si le marqueur ${MARQUEURS.courbe} est present, le marqueur\n` +
      `${MARQUEURS.progressionPortee} doit l'etre aussi, et son texte doit etre CELUI DU CONTRAT, mot pour mot.\n` +
      `Portees trouvees :\n  ` +
      (detailR3.length ? detailR3.join("\n  ") : "aucun etat a courbe") +
      `\n` +
      (fautesR3.length ? `ECARTS : ${fautesR3.join(" | ")}` : "aucun ecart.")
  );

  // -------------------------------------------------------------------------
  // k) Le sens d'une comparaison de test
  // -------------------------------------------------------------------------
  const fautesK = [];
  const detailK = [];
  for (const cas of CAS) {
    const p = pagesV2.find((x) => x.cas === cas.id && x.largeur === 375 && x.echelle === 1 && x.vue === "entiere");
    const d = docDe(lire(p.fichier));
    const blocs = Array.from(d.querySelectorAll(`[data-testid="${MARQUEURS.progressionTest}"]`));
    const attendu = cas.progVm.repereTest ? 1 : 0;
    if (blocs.length !== attendu) {
      fautesK.push(`${cas.id} : ${blocs.length} bloc(s) de comparaison, attendu ${attendu}`);
    }
    if (!blocs.length) {
      detailK.push(`${cas.id} : aucun repere de test affiche (contrat : ${attendu})`);
      continue;
    }
    if (!cas.progVm.repereTest) {
      // La faute est deja enregistree juste au-dessus (blocs.length !== attendu).
      // On ne lit pas un repere absent : un verificateur ne doit pas planter sur
      // l'ecart qu'il vient de relever.
      detailK.push(`${cas.id} : un bloc est rendu alors que le contrat n'a aucun repere.`);
      continue;
    }
    const c = cas.progVm.repereTest.comparaison;
    const libelle = normaliserTexte(blocs[0].getAttribute("aria-label") || "");
    const texte = normaliserTexte(blocs[0].textContent);
    // Le VERDICT AFFICHE doit correspondre au sens calcule sur lowerIsBetter.
    const attenduMot = { amelioration: "en progrès", regression: "en retrait", identique: "identique" }[c.sens];
    const sensCalcule =
      c.ecart === 0 ? "identique" : (c.plusPetitEstMieux ? c.ecart < 0 : c.ecart > 0) ? "amelioration" : "regression";
    if (sensCalcule !== c.sens) {
      fautesK.push(`${cas.id} : le contrat dit « ${c.sens} » alors que ${c.ecart} avec lowerIsBetter=${c.plusPetitEstMieux} donne « ${sensCalcule} »`);
    }
    if (!texte.includes(attenduMot)) {
      fautesK.push(`${cas.id} : le mot « ${attenduMot} » n'est pas rendu (texte : « ${texte.slice(0, 80)} »)`);
    }
    if (!texte.includes(c.ecartAffiche)) {
      fautesK.push(`${cas.id} : l'ecart « ${c.ecartAffiche} » n'est pas rendu`);
    }
    detailK.push(
      `${cas.id} : ${c.label} ${c.avantAffiche} -> ${c.apresAffiche}, ecart ${c.ecartAffiche}, ` +
        `plusPetitEstMieux=${c.plusPetitEstMieux} -> AFFICHE « ${attenduMot} » ; libelle vocal : « ${libelle} »`
    );
  }
  noter(
    "k) Sens d'une comparaison de test (piege lowerIsBetter)",
    fautesK.length === 0 ? "PASS" : "FAIL",
    `Le sens affiche est recalcule ici a partir de l'ecart signe ET de lowerIsBetter, puis compare a ce que la\n` +
      `carte ECRIT. Sur un sprint, mieux veut dire plus petit : un ecart negatif doit sortir « en progres ».\n  ` +
      detailK.join("\n  ") +
      `\n` +
      (fautesK.length ? `ECARTS : ${fautesK.join(" | ")}` : "aucun ecart.")
  );

  // -------------------------------------------------------------------------
  // d3) DEUX LIENS, LE MEME LIBELLE, DEUX DESTINATIONS
  // -------------------------------------------------------------------------
  // Trouve EN REGARDANT une capture, pas en lisant du code : sur l'ecran d'une
  // journee ordinaire, « Voir le detail » apparait DEUX fois — une fois sous
  // l'action du jour (lien secondaire de la variante 1, qui ouvre la seance),
  // une fois au pied de la carte (qui ouvre la progression). Meme mot, deux
  // destinations, a quelques centimetres. Aucune des regles R1-R8 ne l'interdit,
  // et aucun compteur ne le voyait : d'ou ce controle.
  const collisions = [];
  const detailCollision = [];
  /** Les cibles tactiles d'une page, avec leur texte VISIBLE et leur marqueur. */
  const ciblesTactiles = (fichier) => {
    const d = docDe(lire(fichier));
    const ecran = d.querySelector(".device");
    if (!ecran) return [];
    return Array.from(ecran.querySelectorAll('[role="link"],[role="button"],button')).map((el) => ({
      texte: normaliserTexte(el.textContent),
      marqueur: el.getAttribute("data-testid") || "(sans marqueur)",
      vocal: normaliserTexte(el.getAttribute("aria-label") || ""),
    }));
  };
  // TOUTES les pages de variante 2, pas seulement 375 px : un libelle qui ne
  // collisionnerait qu'a une largeur (texte tronque, bloc masque) serait un
  // defaut tout aussi reel, et le controle doit couvrir ce que le fondateur
  // regarde — c'est-a-dire n'importe laquelle des 60 pages.
  for (const p of pagesV2) {
    const tactiles = ciblesTactiles(p.fichier);
    const parTexte = new Map();
    for (const t of tactiles) {
      if (!t.texte) continue;
      parTexte.set(t.texte, (parTexte.get(t.texte) || []).concat(t.marqueur));
    }
    const doubles = [...parTexte.entries()].filter(([, mk]) => mk.length > 1);
    if (doubles.length) {
      collisions.push(
        `${p.fichier} : ${doubles.map(([t, mk]) => `« ${t} » x${mk.length} (${mk.join(" + ")})`).join(", ")}`
      );
    }
    if (p.largeur === 375 && p.echelle === 1 && p.vue === "entiere") {
      detailCollision.push(
        `${p.cas} : ${tactiles.length} lien(s)/bouton(s) — ` +
          tactiles.map((t) => `« ${t.texte.slice(0, 34)} » -> ${t.marqueur}`).join(", ")
      );
    }
  }
  noter(
    "d3) Deux elements tactiles ne portent pas le meme libelle sur un meme ecran",
    collisions.length === 0 ? "PASS" : "FAIL",
    `Lu dans le rendu des ${pagesV2.length} pages de variante 2 : le texte VISIBLE de chaque lien ou bouton de\n` +
      `l'ecran entier, groupe par texte. Deux destinations differentes sous les memes mots, ce n'est pas une\n` +
      `regle du cadre — c'est un ecran qui ment sur ce qu'il va ouvrir. Le libelle vocal ne suffit pas a\n` +
      `rattraper : un joueur qui LIT l'ecran n'entend rien.\n` +
      `Detail a 375 px (le texte est le meme aux autres largeurs) :\n  ` +
      detailCollision.join("\n  ") +
      `\n` +
      (collisions.length
        ? `COLLISIONS : ${collisions.join(" | ")}\n` +
          `A CORRIGER DANS LA VARIANTE 2 UNIQUEMENT : le libelle de la variante 1 ne bouge pas (le fondateur\n` +
          `l'a valide), donc c'est celui de la carte — LIBELLE_DETAIL dans screens/homeVNext/progressionViewModel.ts —\n` +
          `qui doit nommer sa destination.`
        : "aucune collision : chaque cible tactile porte un texte visible unique sur son ecran.")
  );

  // -------------------------------------------------------------------------
  // MESURES DANS UN NAVIGATEUR
  // -------------------------------------------------------------------------
  const { serveur, port } = await demarrerServeur();
  const r = await mesurer(pages, port);
  serveur.close();
  if (!r.ok) {
    noter("l/m/n/o + hauteurs) Mesures dans un navigateur", "NON_EXECUTE", r.raison);
    ecrire();
    return;
  }
  const M = r.mesures;
  const enErreur = pages.filter((p) => !M[cle(p)] || M[cle(p)].erreur);
  noter(
    "c bis) Mesure reelle du rendu dans un navigateur",
    enErreur.length === 0 ? "PASS" : "FAIL",
    `Moteur : ${r.navigateur} (sans interface).\n` +
      `${pages.length} pages chargees et mesurees (${pagesV2.length} de variante 2 + les ecrans hotes).\n` +
      (enErreur.length
        ? `EN ERREUR : ${enErreur.slice(0, 6).map((p) => p.fichier + " -> " + (M[cle(p)] || {}).erreur).join(" | ")}`
        : "aucune erreur de mesure.")
  );

  // --- d2) aplats colores REELLEMENT RENDUS ---------------------------------
  const fautesAplat = [];
  const detailAplat = [];
  for (const cas of CAS) {
    const attendu = cas.homeVm && cas.homeVm.action && cas.homeVm.action.emphasis === "aplat" ? 1 : 0;
    let vus = null;
    for (const p of pagesV2.filter((x) => x.cas === cas.id)) {
      const m = M[cle(p)];
      if (!m || m.erreur) continue;
      const aplats = m.aplats || [];
      if (aplats.length !== attendu) {
        fautesAplat.push(`${p.fichier} : ${aplats.length} aplat(s) (${aplats.map((a) => a.couleur).join(" + ")}), attendu ${attendu}`);
      }
      const dansCarte = aplats.filter((a) => a.dansCarte);
      if (dansCarte.length) {
        fautesAplat.push(`${p.fichier} : ${dansCarte.length} aplat(s) DANS LA CARTE (${dansCarte.map((a) => a.couleur).join(", ")})`);
      }
      if (vus === null) vus = aplats.map((a) => `${a.couleur} ${a.largeur}x${a.hauteur}`).join(", ") || "aucun";
    }
    detailAplat.push(
      `${cas.id} : action « ${cas.homeVm.action ? cas.homeVm.action.emphasis : "aucune"} » -> ${attendu} aplat attendu ; mesure : ${vus}`
    );
  }
  noter(
    "d2) R8 — un seul aplat colore par ecran, et AUCUN dans la carte",
    fautesAplat.length === 0 ? "PASS" : "FAIL",
    `Compte, dans le RENDU, les surfaces d'au moins 120x40 px au fond opaque et sombre (luminance < 0,5),\n` +
      `en tenant compte de l'opacite effective. Independant de tout marqueur : un second aplat pose par la\n` +
      `carte serait attrape meme sans testID. La colonne « dansCarte » vient du noeud ${MARQUEURS.progression}.\n  ` +
      detailAplat.join("\n  ") +
      `\n` +
      (fautesAplat.length ? `ECARTS : ${fautesAplat.join(" | ")}` : "aucun ecart sur les 60 pages.")
  );

  // --- l) accessibilite de la carte -----------------------------------------
  const fautesA11y = [];
  const detailA11y = [];
  for (const cas of CAS) {
    const attendu = cas.progVm.detail && cas.progVm.detail.affiche ? 1 : 0;
    for (const p of pagesV2.filter((x) => x.cas === cas.id)) {
      const m = M[cle(p)];
      if (!m || m.erreur) continue;
      const dansCarte = (m.tactiles || []).filter((t) => t.dansCarte);
      if (dansCarte.length !== attendu) {
        fautesA11y.push(`${p.fichier} : ${dansCarte.length} element(s) tactile(s) dans la carte, attendu ${attendu}`);
      }
      for (const t of dansCarte) {
        if (t.imbrique) fautesA11y.push(`${p.fichier} : tactile IMBRIQUE dans un autre (${t.marqueur})`);
        if (t.hauteur + 0.5 < TAILLE_TACTILE_MIN) {
          fautesA11y.push(`${p.fichier} : cible de ${t.hauteur} pt < ${TAILLE_TACTILE_MIN} pt (${t.marqueur})`);
        }
        if (!t.libelleExplicite || t.libelle.length < 8) {
          fautesA11y.push(`${p.fichier} : libelle non explicite (« ${t.libelle} »)`);
        }
      }
      if (p.largeur === 375 && p.echelle === 1 && p.vue === "entiere") {
        detailA11y.push(
          `${cas.id} : ${dansCarte.length} element tactile dans la carte (contrat : detail.affiche=${!!attendu})` +
            (dansCarte.length
              ? ` — role « ${dansCarte[0].role} », ${dansCarte[0].largeur}x${dansCarte[0].hauteur} pt, ` +
                `libelle « ${dansCarte[0].libelle} », imbrique=${dansCarte[0].imbrique}`
              : "")
        );
      }
    }
  }
  noter(
    "l) Accessibilite de la carte : un seul element focusable, libelle explicite, cible >= 44 pt",
    fautesA11y.length === 0 ? "PASS" : "FAIL",
    `Mesure dans le rendu : tout element de role button/link ou focusable CONTENU dans le noeud de la carte.\n` +
      `« imbrique » = ce tactile est lui-meme dans un autre tactile (cible ambigue, focus incoherent).\n` +
      `« libelle » = l'attribut aria-label reellement pose, pas le texte visible.\n  ` +
      detailA11y.join("\n  ") +
      `\n` +
      (fautesA11y.length ? `ECARTS : ${[...new Set(fautesA11y)].join(" | ")}` : "aucun ecart sur les 60 pages.")
  );

  // --- m) 320 px et texte x1,3 ----------------------------------------------
  const problemes = { 320: [], x13: [], autres: [] };
  const clampesCarte = [];
  for (const p of pagesV2) {
    const m = M[cle(p)];
    if (!m || m.erreur) continue;
    // Un debordement est un defaut PARTOUT. On range seulement le constat dans
    // le seau qui correspond aux deux conditions que le fondateur a demande de
    // regarder en priorite (320 px, texte x1,3) ; le troisieme seau existe pour
    // qu'un defaut a 390 ou 768 px ne soit jamais range dans le mauvais tiroir.
    const seau = p.largeur === 320 ? problemes[320] : p.echelle !== 1 ? problemes.x13 : problemes.autres;
    for (const d of m.debordements || []) {
      seau.push(`${p.cas}@${p.largeur}x${p.echelle} : « ${d.texte} » deborde de ${Math.max(d.droite, d.gauche)} px`);
    }
    for (const c of m.chevauchements || []) {
      seau.push(`${p.cas}@${p.largeur}x${p.echelle} : « ${c.a} » recouvre « ${c.b} » (${c.recouvrement})`);
    }
    for (const cl of (m.clampes || []).filter((x) => x.dansCarte)) {
      clampesCarte.push(`${p.cas}@${p.largeur}x${p.echelle} : « ${cl.texte} » (${cl.lignesMax} lignes, ${cl.cache} px caches)`);
    }
  }
  const totalProblemes = problemes[320].length + problemes.x13.length + problemes.autres.length;
  // Une TRONCATURE dans la carte est un echec, pas une observation : la carte ne
  // porte que des phrases du contrat, aucune n'est decorative. Une phrase coupee
  // est une information que le joueur ne lit pas.
  noter(
    "m) 320 px et texte x1,3 — debordement, chevauchement, troncature",
    totalProblemes === 0 && clampesCarte.length === 0 ? "PASS" : "FAIL",
    `Debordement = un element qui sort du cadre de l'appareil. Chevauchement = deux textes du flux dont les\n` +
      `boites se recouvrent (le decor en position absolue est exclu).\n` +
      `A 320 px : ${problemes[320].length} probleme(s).${problemes[320].length ? "\n  " + problemes[320].join("\n  ") : ""}\n` +
      `A x1,3 (375 px) : ${problemes.x13.length} probleme(s).${problemes.x13.length ? "\n  " + problemes.x13.join("\n  ") : ""}\n` +
      `Aux autres largeurs : ${problemes.autres.length} probleme(s).${problemes.autres.length ? "\n  " + problemes.autres.join("\n  ") : ""}\n` +
      `TRONCATURES REELLES DANS LA CARTE (numberOfLines qui coupe vraiment du texte) : ${clampesCarte.length}` +
      (clampesCarte.length ? `\n  ${[...new Set(clampesCarte)].join("\n  ")}` : " — aucune.")
  );

  // --- n) barre d'onglets ----------------------------------------------------
  const device375 = DEVICES.find((d) => d.width === 375);
  const respirationCourte = [];
  const aDefiler = [];
  for (const p of pagesV2.filter((x) => x.vue === "entiere" && x.echelle === 1)) {
    const m = M[cle(p)];
    if (!m || m.erreur) continue;
    const reste = m.hauteurVisible - m.hauteurTotale;
    if (reste < 0) aDefiler.push(`${p.cas}@${p.largeur} (+${-reste} px)`);
    if (m.respirationFinale !== null && m.respirationFinale < RESPIRATION_MIN) {
      respirationCourte.push(`${p.cas}@${p.largeur} = ${m.respirationFinale} px`);
    }
  }
  noter(
    "n) Rien de masque par la barre d'onglets",
    respirationCourte.length === 0 ? "PASS" : "FAIL",
    `HYPOTHESE D'INSET (elle conditionne le verdict, cf. AUDIT_HOME.md §7.3) : la barre d'onglets est un FRERE\n` +
      `de l'ecran dans une colonne flex — le contenu n'est JAMAIS derriere elle. L'ecran recoit\n` +
      `« hauteur d'ecran - (49 pt de barre + inset bas) » et <Screen> applique EN PLUS l'inset bas reel a\n` +
      `l'interieur. Le harnais ne bouchonne PAS insets.bottom a 0 (c'est ce bouchon qui avait fabrique un faux\n` +
      `chevauchement dans le premier harnais de l'audit).\n` +
      `  Exemple 375 px : ${device375.calcul}\n` +
      `Ecrans qui demandent un defilement (ce n'est PAS un masquage, le contenu reste atteignable) : ${aDefiler.length}` +
      (aDefiler.length ? `\n  ${aDefiler.join(", ")}` : "") +
      `\nCRITERE D'ECHEC : le vide reel sous le dernier element de contenu, plancher ${RESPIRATION_MIN} px.\n` +
      (respirationCourte.length ? `SOUS LE PLANCHER : ${respirationCourte.join(", ")}` : "aucun etat sous le plancher.")
  );

  // --- o) contrastes de la carte --------------------------------------------
  const combinaisons = new Map();
  const sousLeSeuil = new Map();
  let nbTextesCarte = 0;
  for (const p of pagesV2) {
    const m = M[cle(p)];
    if (!m || m.erreur) continue;
    for (const c of (m.contrastes || []).filter((x) => x.dansCarte)) {
      nbTextesCarte++;
      const seuil = c.grandTexte ? SEUIL_CONTRASTE_AA_GRAND : SEUIL_CONTRASTE_AA;
      const identite = `${c.couleur} sur ${c.fond} (${c.taille}px/${c.graisse})`;
      if (!combinaisons.has(identite)) combinaisons.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
      if (c.ratio + 0.005 < seuil) sousLeSeuil.set(identite, { ratio: c.ratio, exemple: c.texte, seuil });
    }
  }
  const liste = [...combinaisons.entries()]
    .sort((a, b) => a[1].ratio - b[1].ratio)
    .map(([id, v]) => `${v.ratio}:1 (seuil ${v.seuil}) — ${id} — « ${v.exemple} »`);
  noter(
    "o) Contraste WCAG des textes de la carte progression",
    sousLeSeuil.size === 0 ? "PASS" : "FAIL",
    `WCAG 2.1 sur les couleurs REELLEMENT RENDUES : couleur du texte composee sur son fond effectif.\n` +
      `${nbTextesCarte} textes de carte mesures, ${combinaisons.size} combinaisons distinctes.\n` +
      `Seuils : ${SEUIL_CONTRASTE_AA}:1 en texte normal, ${SEUIL_CONTRASTE_AA_GRAND}:1 en grand texte (>= 24px, ou >= 18,66px gras).\n  ` +
      liste.join("\n  ") +
      `\n` +
      (sousLeSeuil.size
        ? `SOUS LE SEUIL : ${[...sousLeSeuil.entries()].map(([id, v]) => `${id} = ${v.ratio}:1`).join(" | ")}`
        : "aucun texte sous son seuil.")
  );

  // --- hauteurs : variante 1 vs variante 2 -----------------------------------
  const lignes = [];
  for (const cas of CAS) {
    for (const d of DEVICES) {
      const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
      for (const echelle of echelles) {
        const p1 = { variante: "vnext", etat: cas.hote, largeur: d.width, echelle, vue: "entiere" };
        const p2 = { variante: "vnext2", etat: cas.id, largeur: d.width, echelle, vue: "entiere" };
        const m1 = M[cle(p1)];
        const m2 = M[cle(p2)];
        if (!m1 || !m2 || m1.erreur || m2.erreur) continue;
        lignes.push({
          cas: cas.id,
          hote: cas.hote,
          largeur: d.width,
          echelle,
          v1: m1.hauteurTotale,
          v2: m2.hauteurTotale,
          ecart: m2.hauteurTotale - m1.hauteurTotale,
          visible: m1.hauteurVisible,
          v1Tient: m1.hauteurTotale <= m1.hauteurVisible,
          v2Tient: m2.hauteurTotale <= m2.hauteurVisible,
          blocsV1: m1.nbBlocs,
          blocsV2: m2.nbBlocs,
        });
      }
    }
  }
  const md = [];
  md.push("# Hauteurs de page — variante 1 (lien flottant) vs variante 2 (carte integree)");
  md.push("");
  md.push("Mesure faite dans Chrome sans interface, sur les pages generees par `build.js`, en vue « page entiere »");
  md.push("(aucune hauteur imposee : c'est la hauteur reelle du contenu). Le nombre du haut de colonne est la");
  md.push("hauteur totale de l'ecran, marges de safe area comprises.");
  md.push("");
  md.push("La colonne « tient sans defiler » compare cette hauteur a la zone visible de l'appareil,");
  md.push("soit `hauteur d'ecran - (49 pt de barre d'onglets + inset bas)`.");
  md.push("");
  md.push("| Cas (carte) | Ecran hote | Largeur | Echelle | v1 | v2 | Ecart | Ecart % | Tient v1 | Tient v2 |");
  md.push("|---|---|---:|---:|---:|---:|---:|---:|:--:|:--:|");
  for (const l of lignes) {
    md.push(
      `| ${l.cas} | ${l.hote} | ${l.largeur} | x${l.echelle} | ${l.v1} px | ${l.v2} px | ` +
        `${l.ecart >= 0 ? "+" : ""}${l.ecart} px | ${l.v1 ? (Math.round((l.ecart / l.v1) * 1000) / 10) : 0} % | ` +
        `${l.v1Tient ? "oui" : "non"} | ${l.v2Tient ? "oui" : "non"} |`
    );
  }
  const moyenne = lignes.length
    ? Math.round((lignes.reduce((a, l) => a + l.ecart, 0) / lignes.length) * 10) / 10
    : 0;
  const moyennePct = lignes.length
    ? Math.round((lignes.reduce((a, l) => a + l.ecart / l.v1, 0) / lignes.length) * 1000) / 10
    : 0;
  md.push("");
  md.push(
    `**Moyenne sur ${lignes.length} comparaisons : ${moyenne >= 0 ? "+" : ""}${moyenne} px ` +
      `(${moyennePct >= 0 ? "+" : ""}${moyennePct} %).** ` +
      `Ecrans qui tiennent sans defiler : ${lignes.filter((l) => l.v1Tient).length} en variante 1, ` +
      `${lignes.filter((l) => l.v2Tient).length} en variante 2, sur ${lignes.length}.`
  );
  md.push("");
  const sortieMd = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs-variante2.md");
  fs.mkdirSync(path.dirname(sortieMd), { recursive: true });
  fs.writeFileSync(sortieMd, md.join("\n"), "utf8");
  console.log("");
  console.log(md.join("\n"));
  console.log("");
  console.log(`  Tableau ecrit dans outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs-variante2.md`);

  ecrire({ hauteurs: lignes });

  function ecrire(extra) {
    fs.mkdirSync(DOSSIER_VERIF, { recursive: true });
    fs.writeFileSync(
      path.join(DOSSIER_VERIF, "verifications-variante2.json"),
      JSON.stringify({ verifications, ...(extra || {}) }, null, 1),
      "utf8"
    );
    const pass = verifications.filter((v) => v.resultat === "PASS").length;
    const fail = verifications.filter((v) => v.resultat === "FAIL").length;
    const ne = verifications.filter((v) => v.resultat === "NON_EXECUTE").length;
    console.log("");
    console.log(`  BILAN VARIANTE 2 : ${pass} PASS · ${fail} FAIL · ${ne} NON_EXECUTE`);
    console.log("");
    process.exitCode = fail > 0 ? 2 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
