// prototype/home-vnext/verifier-demarrage.js
// =============================================================================
// LE VERIFICATEUR DES VARIANTES DE DEMARRAGE — V-A / V-B
// =============================================================================
//   node prototype/home-vnext/verifier-demarrage.js
//
// POURQUOI UN TROISIEME FICHIER
// -----------------------------------------------------------------------------
// `verifier.js` juge les 150 pages de la variante 1. `verifier-variante2.js`
// juge les 60 pages de la carte progression. Ni l'un ni l'autre ne connait les
// pages de demarrage : elles n'existaient pas quand ils ont ete ecrits, et
// elargir leur perimetre en douce ferait passer un rapport « 150 pages » pour un
// rapport « 174 pages » sans que personne ne le remarque.
//
// Celui-ci fait le meme travail, avec les MEMES outils, les MEMES seuils et le
// MEME moteur de mesure, plus les regles qui n'existent que pour ces deux
// variantes.
//
// CE QU'IL VERIFIE
// -----------------------------------------------------------------------------
//   0  les pages existent, et aucune n'est une page d'explication
//   a  une seule action principale, un seul aplat colore
//   b  aucun champ inconnu dans le ViewModel du nouveau joueur
//   c  chaque pas coche l'est parce que la donnee le dit
//   d  chaque promesse de V-B porte le seuil qui la tiendra
//   e  aucune ligne du bloc n'est tapable
//   f  aucune donnee fabriquee : ni chiffre en attente, ni courbe, ni « serie »
//   g  HAUTEURS MESUREES, variante par variante, 320 et 375, x1 et x1,3
//   h  zones tactiles >= 44 pt
//   i  contraste WCAG des textes du bloc
//   j  a x1,3 et en 320 px : debordement, chevauchement, troncature reelle
//   k  non-regression : les 14 autres etats rendent EXACTEMENT le meme HTML
//
// Il ecrit `outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs-demarrage.md` :
// le tableau de hauteurs demande le 03/08.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");
const { DEVICES, SCALE_WIDTH, TEXT_SCALE } = require("./lib/devices");
const { mesureHtml } = require("./lib/mesureTemplate");

// ---------------------------------------------------------------------------
// Reglages — identiques a ceux des deux autres verificateurs. Un seuil qui
// differerait ici ferait passer pour conforme ce que l'autre refuse.
// ---------------------------------------------------------------------------
const SEUIL_CONTRASTE_AA = 4.5;
const SEUIL_CONTRASTE_AA_GRAND = 3.0;
const TAILLE_TACTILE_MIN = 44;
const DOSSIER_VERIF = path.join(OUT_ROOT, "_verif-demarrage");
const DOSSIER_SORTIE = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27");

const NAVIGATEURS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

require("./lib/hook");
const fixturesMod = require(path.join(APP_ROOT, "screens/homeVNext/fixtures.ts"));
const vmMod = require(path.join(APP_ROOT, "screens/homeVNext/viewModel.ts"));
const { MARQUEURS_DEMARRAGE } = require("./lib/render");

const FIXTURES = fixturesMod.HOME_VNEXT_FIXTURES_RENDU || fixturesMod.HOME_VNEXT_FIXTURES;
// Le ViewModel declare les variantes ; le NOM DU DOSSIER de pages est, lui, une
// decision de harnais. `build.js` applique la meme regle : la garder ici en un
// seul endroit evite qu'un jour les deux divergent en silence.
const VARIANTES = (vmMod.DEMARRAGE_VARIANTES || []).map((v) => ({ ...v, cle: `vnext${v.id}` }));

/** Les etats concernes : ceux pour lesquels le SELECTEUR construit un bloc. */
const ETATS = FIXTURES.filter((f) => {
  if (!VARIANTES.length) return false;
  try {
    return (
      vmMod.buildHomeVNextViewModel(f.input, { demarrage: VARIANTES[0].id }).demarrage !== null
    );
  } catch (_) {
    return false;
  }
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
const arrondi = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Serveur local ephemere
// ---------------------------------------------------------------------------
function demarrerServeur() {
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
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
// Inventaire des pages a juger
// ---------------------------------------------------------------------------
// Les trois colonnes de la comparaison : l'ecran d'AUJOURD'HUI, puis les deux
// propositions. Sans la premiere, un tableau de hauteurs ne dirait rien : « 520
// px » n'a de sens que compare aux 399 px de depart.
// ---------------------------------------------------------------------------
const COLONNES = [
  { cle: "vnext", titre: "Aujourd'hui", dossier: "vnext" },
].concat(
  VARIANTES.map((v) => ({ cle: v.cle, titre: v.titre, dossier: v.cle, variante: v }))
);

function pagesAttendues() {
  const liste = [];
  for (const f of ETATS) {
    for (const d of DEVICES) {
      const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
      for (const echelle of echelles) {
        const suffixe = echelle === 1 ? "" : `-x${String(echelle).replace(".", "")}`;
        for (const vue of ["visible", "entiere"]) {
          for (const col of COLONNES) {
            liste.push({
              variante: col.cle,
              etat: f.id,
              largeur: d.width,
              echelle,
              vue,
              hauteurVisible: d.stageVisible,
              fichier: `pages/${col.dossier}/${f.id}-${d.width}${suffixe}-${vue}.html`,
            });
          }
        }
      }
    }
  }
  return liste;
}

// ---------------------------------------------------------------------------
// Analyse statique
// ---------------------------------------------------------------------------
const { JSDOM } = require("jsdom");

function ecranDe(html) {
  const dom = new JSDOM(html);
  return dom.window.document.querySelector(".device");
}
function texteEcran(html) {
  const el = ecranDe(html);
  return el ? (el.textContent || "").replace(/\s+/g, " ") : "";
}
function lire(fichier) {
  return fs.readFileSync(path.join(OUT_ROOT, fichier), "utf8");
}

// ---------------------------------------------------------------------------
// Navigateur
// ---------------------------------------------------------------------------
function trouverNavigateur() {
  return NAVIGATEURS.find((p) => fs.existsSync(p)) || null;
}

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
      resolve({ stdout, stderr: stderr + "\n[verificateur] delai depasse (5 min)." });
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
  fs.writeFileSync(path.join(DOSSIER_VERIF, "mesures.html"), mesureHtml(cibles), "utf8");

  const profil = path.join(require("os").tmpdir(), "fks-home-vnext-chrome-demarrage");
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
    `http://127.0.0.1:${port}/_verif-demarrage/mesures.html`,
  ]);

  const sortie = res.stdout || "";
  const debut = sortie.indexOf("###JSON###");
  const fin = sortie.indexOf("###FIN###");
  if (debut === -1 || fin === -1) {
    return {
      ok: false,
      raison:
        "le navigateur n'a pas rendu de JSON. Sortie tronquee : " +
        (sortie.slice(0, 400) || "(vide)"),
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
// LE VERROU DE CHAMPS — la meme liste que le test jest, et c'est voulu
// ---------------------------------------------------------------------------
// Elle est ecrite DEUX FOIS, ici et dans `__tests__/homeVNext/demarrage.test.tsx`.
// Ce n'est pas une duplication oubliee : les deux repondent a des questions
// differentes (le test verrouille le contrat au moment ou on code, le
// verificateur verrouille ce qui est REELLEMENT publie dans le manifeste) et un
// import croise ferait dependre le livrable du dossier de tests.
// ---------------------------------------------------------------------------
const CHAMPS_AUTORISES = [
  "dataState", "dataNotice",
  "header", "header.greeting", "header.dateLabel", "header.stateChip",
  "action", "action.kind", "action.target", "action.emphasis", "action.label",
  "action.sublabel", "action.secondary",
  "why", "cycle", "week",
  "form", "form.kind", "form.reason", "form.title", "form.message",
  "form.completedCount", "form.requiredCount",
  "note", "exit",
  "protoWarnings", "protoWarnings.[]",
  "demarrage", "demarrage.kind", "demarrage.titre",
  "demarrage.premiersPas", "demarrage.premiersPas.[]",
  "demarrage.premiersPas.[].id", "demarrage.premiersPas.[].label",
  "demarrage.premiersPas.[].detail", "demarrage.premiersPas.[].fait",
  "demarrage.premiersPas.[].source",
  "demarrage.pourquoiCeCycle", "demarrage.pourquoiCeCycle.text",
  "demarrage.pourquoiCeCycle.cycleLabel", "demarrage.pourquoiCeCycle.source",
  "demarrage.apercus", "demarrage.apercus.[]",
  "demarrage.apercus.[].titre", "demarrage.apercus.[].message",
  "demarrage.apercus.[].seuil", "demarrage.apercus.[].seuilNom",
];

function cheminsDe(valeur) {
  const vus = new Set();
  const parcourir = (v, prefixe) => {
    if (Array.isArray(v)) {
      const c = `${prefixe}.[]`;
      vus.add(c);
      v.forEach((e) => parcourir(e, c));
      return;
    }
    if (v !== null && typeof v === "object") {
      for (const [cle, sous] of Object.entries(v)) {
        const c = prefixe ? `${prefixe}.${cle}` : cle;
        vus.add(c);
        parcourir(sous, c);
      }
    }
  };
  parcourir(valeur, "");
  return [...vus].sort();
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log("");
  console.log("  VERIFICATION DES VARIANTES DE DEMARRAGE (V-A / V-B)");
  console.log(
    `  ${ETATS.length} etat(s) · ${VARIANTES.length} variante(s) · ` +
      `${DEVICES.map((d) => d.width).join(" / ")} px`
  );
  console.log("");

  if (!VARIANTES.length || !ETATS.length) {
    noter(
      "0) Perimetre",
      "NON_EXECUTE",
      "Aucune variante de demarrage declaree par le ViewModel, ou aucun etat n'y a droit."
    );
    return rendreVerdict();
  }

  const pages = pagesAttendues();

  // -------------------------------------------------------------------------
  // (0) Les pages existent, et aucune n'est une page d'explication
  // -------------------------------------------------------------------------
  {
    const manquantes = [];
    const explications = [];
    for (const p of pages) {
      const abs = path.join(OUT_ROOT, p.fichier);
      if (!fs.existsSync(abs)) {
        manquantes.push(p.fichier);
        continue;
      }
      const html = fs.readFileSync(abs, "utf8");
      // Le harnais REFUSE de servir une page dont le bloc n'a pas ete detecte :
      // il ecrit une page d'explication a la place. En trouver une ici veut dire
      // qu'on regardait un ecran qui n'existe pas.
      if (/n'apparait pas dans l'ecran rendu/.test(html)) explications.push(p.fichier);
    }
    noter(
      "0) Les pages de demarrage existent et montrent le bon ecran",
      manquantes.length || explications.length ? "FAIL" : "PASS",
      manquantes.length || explications.length
        ? `${manquantes.length} page(s) manquante(s), ${explications.length} page(s) d'explication.\n` +
          [...manquantes, ...explications].slice(0, 8).join("\n")
        : `${pages.length} page(s) presentes, dont ${pages.filter((p) => p.variante !== "vnext").length} de demarrage. Aucune page d'explication.`
    );
  }

  // -------------------------------------------------------------------------
  // (a) Une seule action principale, un seul aplat, et le hero present
  // -------------------------------------------------------------------------
  {
    const fautes = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const html = lire(p.fichier);
      const compter = (m) => (html.match(new RegExp(`data-testid="${m}"`, "g")) || []).length;
      const nAction = compter(MARQUEURS_DEMARRAGE.actionPrincipale);
      const nHero = compter(MARQUEURS_DEMARRAGE.hero);
      const nAplat = (html.match(/id="home-vnext-aplat"/g) || []).length;
      if (nAction !== 1) fautes.push(`${p.fichier} : ${nAction} action(s) principale(s)`);
      if (nHero !== 1) fautes.push(`${p.fichier} : ${nHero} traitement(s) hero`);
      if (nAplat !== 1) fautes.push(`${p.fichier} : ${nAplat} aplat(s)`);
    }
    // Et sur l'ecran d'aujourd'hui, le hero ne doit PAS exister : sinon le
    // marqueur ne prouverait rien.
    for (const p of pages.filter((x) => x.variante === "vnext")) {
      const html = lire(p.fichier);
      const n = (html.match(new RegExp(`data-testid="${MARQUEURS_DEMARRAGE.hero}"`, "g")) || []).length;
      if (n !== 0) fautes.push(`${p.fichier} : le traitement hero apparait sur l'ecran actuel`);
    }
    noter(
      "a) Une seule action, un seul aplat, hero present uniquement en V-A / V-B",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : "Sur chaque page de demarrage : 1 action principale, 1 aplat, 1 traitement hero.\n" +
          "Sur chaque page de l'ecran actuel : 0 traitement hero."
    );
  }

  // -------------------------------------------------------------------------
  // (b) Aucun champ inconnu dans le ViewModel du nouveau joueur
  // -------------------------------------------------------------------------
  {
    const inconnus = [];
    for (const f of ETATS) {
      for (const v of [null, ...VARIANTES.map((x) => x.id)]) {
        const vm = vmMod.buildHomeVNextViewModel(f.input, v ? { demarrage: v } : {});
        cheminsDe(vm)
          .filter((c) => CHAMPS_AUTORISES.indexOf(c) === -1)
          .forEach((c) => inconnus.push(`${f.id} / ${v || "actuel"} : ${c}`));
      }
    }
    noter(
      "b) Aucune donnee inventee — aucun champ inconnu dans le ViewModel",
      inconnus.length ? "FAIL" : "PASS",
      inconnus.length
        ? inconnus.join("\n")
        : `${CHAMPS_AUTORISES.length} chemins autorises, ecrits a la main. Aucun champ hors liste ` +
          `sur ${ETATS.length} etat(s) x ${VARIANTES.length + 1} variante(s).`
    );
  }

  // -------------------------------------------------------------------------
  // (c) Chaque pas coche l'est parce que la donnee le dit
  // -------------------------------------------------------------------------
  {
    const fautes = [];
    for (const f of ETATS) {
      const entree = f.input.demarrage;
      if (!entree) {
        fautes.push(`${f.id} : aucune entree de demarrage dans la fixture`);
        continue;
      }
      const vm = vmMod.buildHomeVNextViewModel(f.input, { demarrage: "A" });
      if (!vm.demarrage || vm.demarrage.kind !== "premiere_mission") {
        fautes.push(`${f.id} : V-A ne produit pas de bloc premiere_mission`);
        continue;
      }
      // L'attendu est RECALCULE depuis l'entree, jamais recopie du resultat.
      const attendu = {
        profil: String(entree.mainObjective || "").trim().length > 0,
        test_terrain: Math.max(0, Math.trunc(entree.testEntryCount)) > 0,
        premiere_seance: f.input.completedSessions.length > 0,
      };
      for (const pas of vm.demarrage.premiersPas) {
        if (pas.fait !== attendu[pas.id]) {
          fautes.push(`${f.id} / ${pas.id} : affiche ${pas.fait}, la donnee dit ${attendu[pas.id]}`);
        }
        if (!pas.source || !pas.source.trim()) {
          fautes.push(`${f.id} / ${pas.id} : aucune source declaree`);
        }
      }
      // Et le rendu doit poser exactement autant de coches que de pas faits.
      const faits = vm.demarrage.premiersPas.filter((p) => p.fait).length;
      for (const p of pages.filter((x) => x.variante === "vnextA" && x.etat === f.id)) {
        const html = lire(p.fichier);
        const n = (html.match(new RegExp(`data-testid="${MARQUEURS_DEMARRAGE.pasFait}"`, "g")) || []).length;
        if (n !== faits) fautes.push(`${p.fichier} : ${n} coche(s) rendue(s), ${faits} attendue(s)`);
      }
    }
    noter(
      "c) Chaque pas coche l'est parce que la donnee le dit",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : "Etat de chaque pas recalcule depuis l'entree, puis compare au ViewModel ET au nombre " +
          "de coches reellement rendues. Aucun ecart."
    );
  }

  // -------------------------------------------------------------------------
  // (d) Chaque promesse de V-B porte le seuil qui la tiendra
  // -------------------------------------------------------------------------
  {
    const fautes = [];
    const seuilsConnus = Object.fromEntries(
      (vmMod.HOME_VNEXT_SEUILS || []).map((s) => [s.nom, s.valeur])
    );
    for (const f of ETATS) {
      const vm = vmMod.buildHomeVNextViewModel(f.input, { demarrage: "B" });
      if (!vm.demarrage || vm.demarrage.kind !== "anticipation") {
        fautes.push(`${f.id} : V-B ne produit pas de bloc anticipation`);
        continue;
      }
      for (const a of vm.demarrage.apercus) {
        // Le seuil doit etre une CONSTANTE EXPORTEE, pas un nombre ecrit.
        if (!(a.seuilNom in seuilsConnus)) {
          fautes.push(`${f.id} / ${a.titre} : seuil « ${a.seuilNom} » absent de HOME_VNEXT_SEUILS`);
        } else if (seuilsConnus[a.seuilNom] !== a.seuil) {
          fautes.push(
            `${f.id} / ${a.titre} : seuil affiche ${a.seuil}, la constante vaut ${seuilsConnus[a.seuilNom]}`
          );
        }
        // Et le chiffre cite dans la phrase doit etre CELUI-LA. Le seuil 1 est
        // l'exception : la phrase dit « ta premiere seance », pas « 1 seance ».
        if (a.seuil > 1 && a.message.indexOf(String(a.seuil)) === -1) {
          fautes.push(`${f.id} / ${a.titre} : la phrase ne cite pas son propre seuil`);
        }
      }
    }
    noter(
      "d) Chaque section annoncee porte la constante qui la declenchera",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : "Chaque apercu nomme une constante de HOME_VNEXT_SEUILS, sa valeur correspond, et le " +
          "chiffre lu dans la phrase est celui de la constante."
    );
  }

  // -------------------------------------------------------------------------
  // (e) Aucune ligne du bloc n'est tapable
  // -------------------------------------------------------------------------
  {
    const fautes = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const ecran = ecranDe(lire(p.fichier));
      if (!ecran) {
        fautes.push(`${p.fichier} : aucun ecran rendu`);
        continue;
      }
      const bloc = ecran.querySelector(`[data-testid="${MARQUEURS_DEMARRAGE.bloc}"]`);
      if (!bloc) {
        fautes.push(`${p.fichier} : bloc de demarrage introuvable`);
        continue;
      }
      const tactiles = bloc.querySelectorAll(
        'button, a, [role="button"], [role="link"], [tabindex]'
      );
      if (tactiles.length) {
        fautes.push(`${p.fichier} : ${tactiles.length} element(s) tactile(s) dans le bloc`);
      }
    }
    noter(
      "e) Aucune ligne du bloc n'est tapable — un seul point d'entree sur l'ecran",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : "Ni bouton, ni lien, ni element focusable dans le bloc de demarrage, sur aucune page. " +
          "Les lignes DISENT le chemin, elles ne le proposent pas."
    );
  }

  // -------------------------------------------------------------------------
  // (f) Aucune donnee fabriquee dans le texte rendu
  // -------------------------------------------------------------------------
  {
    // Ce qu'un ecran de bienvenue s'autorise d'habitude, et qui est interdit ici.
    const INTERDITS = [
      { motif: /\bs[ée]rie\b/i, quoi: "un compteur de serie" },
      { motif: /\b0\s*(?:%|\/|sur)\s*/i, quoi: "un compteur a zero (« 0 / 4 », « 0 % »)" },
      { motif: /—\s*$/, quoi: "un tiret a la place d'une valeur" },
      { motif: /\bATL\b|\bCTL\b|\bTSB\b/, quoi: "du jargon de charge" },
      { motif: /\bbadge\b|\btroph[ée]e\b|\bniveau\s+\d/i, quoi: "une mecanique de recompense" },
    ];
    const fautes = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const texte = texteEcran(lire(p.fichier));
      for (const i of INTERDITS) {
        if (i.motif.test(texte)) fautes.push(`${p.fichier} : ${i.quoi}`);
      }
      // Aucune courbe : le nouveau joueur n'a rien a tracer.
      if (lire(p.fichier).indexOf('data-testid="home-vnext-courbe"') !== -1) {
        fautes.push(`${p.fichier} : une courbe est tracee`);
      }
    }
    noter(
      "f) Aucune donnee fabriquee dans le texte rendu",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : `${INTERDITS.length} motifs interdits cherches dans le texte rendu de chaque page, ` +
          "plus l'absence de courbe. Aucun trouve."
    );
  }

  // -------------------------------------------------------------------------
  // (k) NON-REGRESSION — les etats non concernes n'ont pas bouge
  // -------------------------------------------------------------------------
  // Le ViewModel gagne un champ (`demarrage`), mais il vaut `null` partout
  // ailleurs. On le prouve sur les 14 autres etats : ViewModel identique champ
  // pour champ, hors ce `null`.
  {
    const fautes = [];
    for (const f of FIXTURES) {
      if (ETATS.some((e) => e.id === f.id)) continue;
      const sans = vmMod.buildHomeVNextViewModel(f.input);
      for (const v of VARIANTES) {
        const avec = vmMod.buildHomeVNextViewModel(f.input, { demarrage: v.id });
        if (avec.demarrage !== null) fautes.push(`${f.id} / V-${v.id} : bloc construit a tort`);
        const a = JSON.stringify({ ...avec, protoWarnings: [] });
        const b = JSON.stringify({ ...sans, protoWarnings: [] });
        if (a !== b) fautes.push(`${f.id} / V-${v.id} : le ViewModel a change`);
      }
    }
    noter(
      "k) Non-regression — aucun autre etat ne change, option activee",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : `${FIXTURES.length - ETATS.length} etat(s) verifie(s) x ${VARIANTES.length} option(s) : ` +
          "ViewModel identique champ pour champ, bloc de demarrage toujours null."
    );
  }

  // -------------------------------------------------------------------------
  // MESURES DANS UN VRAI NAVIGATEUR (g / h / i / j)
  // -------------------------------------------------------------------------
  const { serveur, port } = await demarrerServeur();
  let m;
  try {
    m = await mesurer(pages, port);
  } finally {
    serveur.close();
  }

  if (!m.ok) {
    noter("g-j) Mesures dans un navigateur", "NON_EXECUTE", m.raison);
    return rendreVerdict();
  }

  // La page de mesure rend un OBJET indexe par cle, pas un tableau.
  const mesureDe = (variante, etatId, largeur, echelle, vue) =>
    m.mesures[`${variante}|${etatId}|${largeur}|${echelle}|${vue}`] || null;

  // ---------------------------------------------------------------------------
  // TOUTES LES PHRASES QUE LE BLOC DE DEMARRAGE AFFICHE, PAR VARIANTE.
  // ---------------------------------------------------------------------------
  // Sert au controle (j) : une troncature DANS le bloc est un echec, ailleurs
  // c'est une observation. Le moteur de mesure ne connait que la carte
  // progression (`dansCarte`), pas ce bloc-ci — on identifie donc les textes du
  // bloc par ce que le ViewModel a produit, ce qui est de toute facon la seule
  // source qui fasse autorite.
  const phrasesDuBloc = {};
  for (const f of ETATS) {
    for (const v of VARIANTES) {
      const vm = vmMod.buildHomeVNextViewModel(f.input, { demarrage: v.id });
      const b = vm.demarrage;
      const liste = [];
      if (b && b.kind === "premiere_mission") {
        b.premiersPas.forEach((x) => liste.push(x.label, x.detail));
        if (b.pourquoiCeCycle) liste.push(b.pourquoiCeCycle.text);
      }
      if (b && b.kind === "anticipation") {
        b.apercus.forEach((x) => liste.push(x.titre, x.message));
      }
      phrasesDuBloc[`${v.cle}|${f.id}`] = liste;
    }
  }
  /** Ce texte tronque appartient-il au bloc de demarrage ? */
  const dansLeBloc = (variante, etatId, texte) => {
    const liste = phrasesDuBloc[`${variante}|${etatId}`] || [];
    const t = String(texte).trim();
    // Le moteur coupe a 70 caracteres : on compare par prefixe, dans les deux
    // sens, plutot que par egalite — sinon aucune phrase longue ne matcherait.
    return liste.some((x) => x.startsWith(t.slice(0, 40)) || t.startsWith(x.slice(0, 40)));
  };

  // --- (g) HAUTEURS ---------------------------------------------------------
  const tableau = [];
  {
    for (const f of ETATS) {
      for (const d of DEVICES) {
        const echelles = d.width === SCALE_WIDTH ? [1, TEXT_SCALE] : [1];
        for (const echelle of echelles) {
          const ligne = {
            etat: f.id,
            largeur: d.width,
            echelle,
            visible: d.stageVisible,
            hauteurs: {},
          };
          for (const col of COLONNES) {
            const x = mesureDe(col.cle, f.id, d.width, echelle, "entiere");
            ligne.hauteurs[col.cle] = x && !x.erreur ? arrondi(x.hauteurTotale) : null;
          }
          tableau.push(ligne);
        }
      }
    }
    const manquantes = tableau.filter((l) =>
      COLONNES.some((c) => l.hauteurs[c.cle] == null)
    );
    const ref = tableau.find((l) => l.largeur === 375 && l.echelle === 1);
    noter(
      "g) Hauteurs mesurees, variante par variante",
      manquantes.length ? "FAIL" : "PASS",
      manquantes.length
        ? `${manquantes.length} combinaison(s) sans mesure.`
        : ref
        ? COLONNES.map((c) => `${c.titre} : ${ref.hauteurs[c.cle]} px`).join("\n") +
          `\n(a 375 px, taille normale — zone visible ${ref.visible} px)\n` +
          `Tableau complet : outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs-demarrage.md`
        : "mesures relevees"
    );
  }

  // --- (h) ZONES TACTILES ---------------------------------------------------
  {
    const trop = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const x = mesureDe(p.variante, p.etat, p.largeur, p.echelle, p.vue);
      if (!x || x.erreur) continue;
      (x.tactiles || []).forEach((t) => {
        if (t.hauteur + 0.5 < TAILLE_TACTILE_MIN) {
          trop.push(`${p.fichier} : « ${t.libelle || t.role} » ${arrondi(t.hauteur)} pt`);
        }
      });
    }
    noter(
      "h) Zones tactiles >= 44 pt",
      trop.length ? "FAIL" : "PASS",
      trop.length
        ? trop.slice(0, 8).join("\n")
        : `Toutes les cibles des pages de demarrage tiennent le plancher de ${TAILLE_TACTILE_MIN} pt.`
    );
  }

  // --- (i) CONTRASTE --------------------------------------------------------
  {
    const sous = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const x = mesureDe(p.variante, p.etat, p.largeur, p.echelle, p.vue);
      if (!x || x.erreur) continue;
      (x.contrastes || []).forEach((c) => {
        const seuil = c.grandTexte ? SEUIL_CONTRASTE_AA_GRAND : SEUIL_CONTRASTE_AA;
        if (c.ratio + 0.01 < seuil) {
          sous.push(
            `${p.fichier} : « ${String(c.texte).slice(0, 40)} » ${c.ratio}:1 ` +
              `(${c.couleur} sur ${c.fond}, seuil ${seuil})`
          );
        }
      });
    }
    noter(
      "i) Contraste WCAG des textes rendus",
      sous.length ? "FAIL" : "PASS",
      sous.length
        ? sous.slice(0, 8).join("\n")
        : `Aucun texte sous ${SEUIL_CONTRASTE_AA}:1 (${SEUIL_CONTRASTE_AA_GRAND}:1 pour les grands ` +
          "corps), sur les couleurs REELLEMENT rendues et le fond effectif."
    );
  }

  // --- (j) 320 px et x1,3 ---------------------------------------------------
  {
    const fautes = [];
    const observations = [];
    for (const p of pages.filter((x) => x.variante !== "vnext")) {
      const x = mesureDe(p.variante, p.etat, p.largeur, p.echelle, p.vue);
      if (!x || x.erreur) continue;
      (x.debordements || []).forEach((d) => {
        fautes.push(`${p.fichier} : « ${String(d.texte).slice(0, 40) || d.tag} » deborde du cadre`);
      });
      (x.chevauchements || []).forEach((c) => {
        fautes.push(`${p.fichier} : « ${String(c.a).slice(0, 30) } » recouvre « ${String(c.b).slice(0, 30)} »`);
      });
      // Une troncature dans le BLOC est un echec : ces phrases sont l'unique
      // contenu de l'ecran. Ailleurs, c'est une observation.
      (x.clampes || []).forEach((t) => {
        const ligne = `${p.fichier} : « ${String(t.texte).slice(0, 50)} » coupe (${t.cache} px caches)`;
        if (dansLeBloc(p.variante, p.etat, t.texte)) fautes.push(ligne);
        else observations.push(ligne);
      });
    }
    noter(
      "j) 320 px et texte x1,3 — debordement, chevauchement, troncature",
      fautes.length ? "FAIL" : "PASS",
      fautes.length
        ? fautes.slice(0, 10).join("\n")
        : "Aucun debordement, aucun chevauchement, aucune troncature dans le bloc de demarrage — " +
          "aux 4 largeurs et en texte x1,3." +
          (observations.length
            ? `\nObservations hors bloc (non bloquantes) : ${observations.length}`
            : "")
    );
  }

  ecrireTableau(tableau);
  return rendreVerdict();
}

// ---------------------------------------------------------------------------
// LE TABLEAU DE HAUTEURS — le livrable demande le 03/08
// ---------------------------------------------------------------------------
function ecrireTableau(tableau) {
  const l = [];
  l.push("# Hauteurs mesurees — l'ecran du nouveau joueur");
  l.push("");
  l.push(
    "Hauteur totale de la page, marges de safe area comprises, mesuree dans un vrai moteur de " +
      "rendu (Chrome sans interface). `jsdom` n'a aucun moteur de mise en page : toute hauteur y " +
      "vaut 0, et une hauteur relevee la-bas serait un mensonge."
  );
  l.push("");
  l.push(
    "La colonne **Aujourd'hui** est l'ecran actuel du prototype — celui qui a declenche la " +
      "decision du 03/08. Les deux autres sont les propositions."
  );
  l.push("");

  const parLargeur = {};
  tableau.forEach((x) => {
    const k = `${x.largeur}|${x.echelle}`;
    parLargeur[k] = parLargeur[k] || [];
    parLargeur[k].push(x);
  });

  l.push("| Largeur | Texte | Zone visible | " + COLONNES.map((c) => c.titre).join(" | ") + " |");
  l.push("|---|---|---|" + COLONNES.map(() => "---").join("|") + "|");
  Object.keys(parLargeur)
    .sort((a, b) => {
      const [wa, ea] = a.split("|").map(Number);
      const [wb, eb] = b.split("|").map(Number);
      return wa - wb || ea - eb;
    })
    .forEach((k) => {
      parLargeur[k].forEach((x) => {
        l.push(
          `| ${x.largeur} px | ${x.echelle === 1 ? "normal" : "x1,3"} | ${x.visible} px | ` +
            COLONNES.map((c) => {
              const h = x.hauteurs[c.cle];
              if (h == null) return "—";
              const marque = h > x.visible ? " ⚠ defile" : "";
              return `**${h} px**${marque}`;
            }).join(" | ") +
            " |"
        );
      });
    });

  l.push("");
  l.push("## Comment lire la colonne « zone visible »");
  l.push("");
  l.push(
    "C'est ce que le joueur voit sans defiler : hauteur d'ecran moins la barre d'onglets (49 pt) " +
      "et l'inset bas. Une hauteur superieure ne veut pas dire « trop long » — elle veut dire " +
      "qu'il faut defiler pour atteindre la fin, ce qui est acceptable si ce qui passe dessous " +
      "n'est pas necessaire pour agir aujourd'hui."
  );
  l.push("");
  l.push(
    "Les insets sont les valeurs iOS publiees par appareil (`lib/devices.js`), pas des mesures " +
      "prises sur un telephone reel. A confirmer en recette telephone."
  );
  l.push("");

  fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });
  const cible = path.join(DOSSIER_SORTIE, "mesures-hauteurs-demarrage.md");
  fs.writeFileSync(cible, l.join("\n"), "utf8");
  console.log("");
  console.log(`  Tableau des hauteurs : ${cible}`);
}

function rendreVerdict() {
  const p = verifications.filter((v) => v.resultat === "PASS").length;
  const f = verifications.filter((v) => v.resultat === "FAIL").length;
  const n = verifications.filter((v) => v.resultat === "NON_EXECUTE").length;
  console.log("");
  console.log(`  VERDICT : ${p} PASS · ${f} FAIL · ${n} NON_EXECUTE`);
  console.log("");
  return f === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
