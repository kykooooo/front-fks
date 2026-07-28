// prototype/home-vnext/captures-variante2.js
// =============================================================================
// CAPTURES DE LA VARIANTE 2 — LA CARTE "MA PROGRESSION"
// =============================================================================
//   node prototype/home-vnext/captures-variante2.js
//
// Produit le jeu d'images que Kyllian regarde pour trancher entre :
//   - variante 1 : un lien flottant "Voir ma progression" sous les cartes ;
//   - variante 2 : une vraie carte de contenu integree.
//
// Ce que ce script ecrit dans
// outputs/home-vnext-prototype-2026-07-27/captures-v2/ :
//
//   1. les 6 cas de la carte + la preuve R1, en 375 px, VUE PAGE ENTIERE
//      (rien n'est coupe : on voit tout l'ecran, meme ce qui demande a defiler)
//   2. 3 comparaisons cote a cote VARIANTE 1 vs VARIANTE 2
//      (nouveau joueur / deux seances / tendance disponible)
//   3. "deux seances" et "tendance disponible" en 320 px (le petit iPhone)
//   4. un texte agrandi x1,3
//   5. le visualiseur, avec le nouveau selecteur de variante bien visible
//
// Chaque capture qui echoue est ECRITE dans le rapport, jamais remplacee en
// silence par autre chose.
//
// Aucune installation : puppeteer est deja present dans le cache npx.
// Aucun appel reseau sortant, aucun backend, aucune donnee reelle.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");

const PUPPETEER = "C:/Users/Gamer/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer";
const DOSSIER = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27/captures-v2");

// Le port 8140 est deja pris par un autre serveur : serve.js bascule tout seul
// sur 8141. On tente les deux, et on DIT lequel a repondu.
const VISUALISEURS = process.env.FKS_VISUALISEUR
  ? [process.env.FKS_VISUALISEUR]
  : ["http://127.0.0.1:8141/", "http://127.0.0.1:8140/", "http://127.0.0.1:8142/"];

// --- les 7 cas de la carte, dans l'ordre du contrat --------------------------
// Les 6 cas de demonstration, puis la preuve de R1 (hors serie).
// `hote` = l'ecran Home sur lequel la carte est posee : c'est aussi la page de
// variante 1 a laquelle on la compare.
const CAS = [
  { num: "01", id: "v2-nouveau-joueur", hote: "nouveau-joueur", titre: "Nouveau joueur", etat: "empty" },
  { num: "02", id: "v2-deux-seances-tendance-indisponible", hote: "tendance-indisponible", titre: "Deux seances, tendance indisponible", etat: "collecting" },
  { num: "03", id: "v2-tendance-disponible", hote: "tendance-disponible", titre: "Tendance disponible", etat: "ready" },
  { num: "04", id: "v2-test-physique-ameliore", hote: "seance-terminee", titre: "Test physique ameliore", etat: "ready" },
  { num: "05", id: "v2-test-physique-en-recul", hote: "tendance-indisponible", titre: "Test physique en recul", etat: "collecting" },
  { num: "06", id: "v2-aucune-comparaison-de-test", hote: "seance-prevue-aujourdhui", titre: "Aucune comparaison de test", etat: "ready" },
  { num: "R1", id: "v2-donnee-manquante", hote: "tendance-indisponible", titre: "Donnee manquante (preuve R1)", etat: "collecting" },
];

// --- les 3 comparaisons que le fondateur a demandees -------------------------
const COMPARAISONS = [
  {
    cas: "v2-nouveau-joueur",
    hote: "nouveau-joueur",
    fichier: "comparaison-v1-vs-v2-nouveau-joueur-375.png",
    titre: "Nouveau joueur — lien flottant contre carte integree",
    note: "Etat « empty » : la carte pose trois reperes et une mention honnete. Aucun graphique, aucun bouton.",
  },
  {
    cas: "v2-deux-seances-tendance-indisponible",
    hote: "tendance-indisponible",
    fichier: "comparaison-v1-vs-v2-deux-seances-375.png",
    titre: "Deux seances — lien flottant contre carte integree",
    note: "Etat « collecting » : quatre faits reellement mesures, et la phrase qui dit ce qui manque avant une tendance.",
  },
  {
    cas: "v2-tendance-disponible",
    hote: "tendance-disponible",
    fichier: "comparaison-v1-vs-v2-tendance-disponible-375.png",
    titre: "Tendance disponible — lien flottant contre carte integree",
    note:
      "Etat « ready » : la courbe s'affiche avec sa portee exacte, le lien devient le pied de la " +
      "carte (memes mots, meme destination), et un test refait donne un ecart reellement mesure " +
      "(+9 cm). Regarde aussi le HAUT des deux colonnes : la pastille « En forme » n'existe plus " +
      "a droite.",
  },
];

const rapport = { genereLe: new Date().toISOString(), ok: [], echecs: [] };

// --- serveur local ephemere pour les pages generees --------------------------
function serveur() {
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  const s = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const f = path.join(OUT_ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
    if (!f.startsWith(OUT_ROOT)) return res.writeHead(403).end();
    fs.readFile(f, (err, buf) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise((r) => s.listen(0, "127.0.0.1", () => r({ s, port: s.address().port })));
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

// --- une capture d'une page d'ecran -----------------------------------------
async function capturerPage(nav, url, sortie, largeur, nom) {
  let page;
  try {
    page = await nav.newPage();
    await page.setViewport({ width: largeur, height: 900, deviceScaleFactor: 2 });
    const rep = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!rep || !rep.ok()) throw new Error("page introuvable (" + (rep ? rep.status() : "aucune reponse") + ")");
    await dodo(220);
    // La page mesure la scene : on capture la scene, pas la fenetre.
    const boite = await page.evaluate(() => {
      const el = document.querySelector(".stage") || document.body;
      const r = el.getBoundingClientRect();
      return { x: 0, y: 0, w: Math.ceil(r.width), h: Math.ceil(Math.max(r.height, el.scrollHeight)) };
    });
    await page.setViewport({ width: largeur, height: Math.max(200, boite.h), deviceScaleFactor: 2 });
    await dodo(120);
    await page.screenshot({ path: sortie, clip: { x: 0, y: 0, width: boite.w, height: boite.h } });
    rapport.ok.push({ nom, fichier: path.basename(sortie) });
    return true;
  } catch (e) {
    rapport.echecs.push({ nom, url, raison: String(e && e.message ? e.message : e) });
    return false;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- hauteur d'une page ------------------------------------------------------
async function hauteurDe(nav, url) {
  const page = await nav.newPage();
  try {
    await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 1 });
    const rep = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!rep || !rep.ok()) throw new Error("page introuvable : " + url);
    await dodo(200);
    // `.stage` porte un `min-height` : le mesurer surestimerait tout ecran plus
    // court que l'appareil. La hauteur REELLE du contenu est celle de `.device`.
    return await page.evaluate(() => {
      const app = document.querySelector(".device");
      const scene = document.querySelector(".stage") || document.body;
      const h = (el) => Math.ceil(Math.max(el.getBoundingClientRect().height, el.scrollHeight));
      return { contenu: app ? h(app) : h(scene), scene: h(scene) };
    });
  } finally {
    await page.close().catch(() => {});
  }
}

// --- la page de comparaison cote a cote --------------------------------------
function pageComparaison(c, urlA, hA, contenuA, urlB, hB, contenuB) {
  const h = Math.max(hA, hB);
  const ecartPx = contenuB - contenuA;
  const ecartPc = Math.round((ecartPx / contenuA) * 1000) / 10;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#EDF1F6;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .bandeau{padding:14px 18px 12px;}
  .bandeau h1{margin:0;font-size:17px;font-weight:800;color:#0F1A2B;letter-spacing:-.2px;}
  .bandeau p{margin:5px 0 0;font-size:12px;font-weight:600;color:#5A6779;line-height:1.45;}
  .grille{display:flex;gap:18px;padding:0 18px 16px;align-items:flex-start;}
  .col{width:375px;}
  .etiquette{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;padding:6px 10px;
    border-radius:8px;font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;}
  .gauche{background:#5A6779;color:#fff;}
  .droite{background:#0F7A4A;color:#fff;}
  .etiquette span{font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;opacity:.92;}
  .cadre{width:375px;height:${h}px;border:1px solid #C9D2DE;border-radius:6px;overflow:hidden;background:#F5F7FA;}
  iframe{width:375px;height:${h}px;border:0;display:block;}
  .pied{padding:0 18px 16px;font-size:11px;font-weight:600;color:#7A8699;line-height:1.5;}
</style></head><body>
<div class="bandeau"><h1>${c.titre}</h1>
<p>${c.note}<br>
Vue « page entiere » — 375 px — rien n'est coupe. Donnees fictives.
Hauteur de contenu : <b>${contenuA} px</b> en variante 1 contre <b>${contenuB} px</b> en variante 2,
soit <b>${ecartPx >= 0 ? "+" : ""}${ecartPx} px</b> (${ecartPc >= 0 ? "+" : ""}${ecartPc} %).</p></div>
<div class="grille">
  <div class="col"><div class="etiquette gauche">Variante 1 — lien flottant <span>contenu ${contenuA} px</span></div>
    <div class="cadre"><iframe src="${urlA}" scrolling="no"></iframe></div></div>
  <div class="col"><div class="etiquette droite">Variante 2 — carte integree <span>contenu ${contenuB} px</span></div>
    <div class="cadre"><iframe src="${urlB}" scrolling="no"></iframe></div></div>
</div>
<div class="pied">Les deux colonnes sont rendues par le meme moteur, avec les memes reglages.
Le trait rouge horizontal est la ligne de flottaison : le bas de la zone visible sur un iPhone 375 x 812.
Ce qui est sous ce trait demande de faire defiler.</div>
</body></html>`;
}

async function capturerComparaison(nav, port, c) {
  const nom = "comparaison-" + c.cas;
  const sortie = path.join(DOSSIER, c.fichier);
  let page;
  try {
    const urlA = `http://127.0.0.1:${port}/pages/vnext/${c.hote}-375-entiere.html`;
    const urlB = `http://127.0.0.1:${port}/pages/vnext2/${c.cas}-375-entiere.html`;
    const mA = await hauteurDe(nav, urlA);
    const mB = await hauteurDe(nav, urlB);
    // Le cadre doit contenir la scene entiere (reperes et barre d'onglets compris) ;
    // l'etiquette, elle, annonce la hauteur reelle du contenu de l'ecran.
    const hA = Math.max(mA.scene, mA.contenu);
    const hB = Math.max(mB.scene, mB.contenu);
    const html = pageComparaison(c, urlA, hA, mA.contenu, urlB, hB, mB.contenu);
    const fichier = path.join(OUT_ROOT, "_cmpv2-" + c.cas + ".html");
    fs.writeFileSync(fichier, html, "utf8");

    page = await nav.newPage();
    await page.setViewport({ width: 810, height: Math.max(hA, hB) + 180, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${port}/_cmpv2-${c.cas}.html`, { waitUntil: "networkidle0", timeout: 40000 });
    await dodo(500);
    await page.screenshot({ path: sortie, fullPage: true });
    fs.unlinkSync(fichier);
    rapport.ok.push({ nom, fichier: c.fichier, v1: mA.contenu, v2: mB.contenu });
  } catch (e) {
    rapport.echecs.push({ nom, raison: String(e && e.message ? e.message : e) });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- le visualiseur, avec le selecteur de variante ---------------------------
async function capturerVisualiseur(nav) {
  const nom = "visualiseur-selecteur-variante";
  const sortie = path.join(DOSSIER, "outil-visualiseur-selecteur-variante2.png");
  const essais = [];
  for (const base of VISUALISEURS) {
    let page;
    try {
      page = await nav.newPage();
      await page.setViewport({ width: 1600, height: 1180, deviceScaleFactor: 1.5 });
      const rep = await page.goto(base + "#etat=v2-tendance-disponible&var=vnext2&w=375&vue=entiere", {
        waitUntil: "networkidle0",
        timeout: 15000,
      });
      if (!rep || !rep.ok()) throw new Error("reponse " + (rep ? rep.status() : "aucune"));
      await dodo(1800);
      await page.screenshot({ path: sortie });
      rapport.ok.push({ nom, fichier: path.basename(sortie), visualiseur: base });
      await page.close().catch(() => {});
      return base;
    } catch (e) {
      essais.push(base + " -> " + String(e && e.message ? e.message : e));
      if (page) await page.close().catch(() => {});
    }
  }
  rapport.echecs.push({
    nom,
    raison:
      "visualiseur injoignable. Essais : " +
      essais.join(" | ") +
      ". Lance `node prototype/home-vnext/serve.js` dans un autre terminal.",
  });
  return null;
}

(async () => {
  if (!fs.existsSync(DOSSIER)) fs.mkdirSync(DOSSIER, { recursive: true });
  if (!fs.existsSync(path.join(OUT_ROOT, "pages/vnext2"))) {
    console.error("Les pages de variante 2 sont absentes. Lance d'abord : node prototype/home-vnext/build.js");
    process.exit(1);
  }

  const puppeteer = require(PUPPETEER);
  const { s, port } = await serveur();
  const nav = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--force-prefers-reduced-motion", "--hide-scrollbars"],
  });

  console.log("Pages servies sur http://127.0.0.1:" + port);

  // 1. les 6 cas de la carte, page entiere, 375 px
  for (const c of CAS) {
    const suffixe = c.num === "R1" ? "preuve-r1-donnee-manquante" : `${c.num}-${c.id.replace(/^v2-/, "")}`;
    const sortie = path.join(DOSSIER, `v2-${suffixe}-375-page-entiere.png`);
    await capturerPage(nav, `http://127.0.0.1:${port}/pages/vnext2/${c.id}-375-entiere.html`, sortie, 375, "cas-" + c.id);
    console.log("  cas", c.num, c.id);
  }

  // 2. les 3 comparaisons variante 1 vs variante 2
  for (const c of COMPARAISONS) {
    await capturerComparaison(nav, port, c);
    console.log("  comparaison", c.cas);
  }

  // 3. le petit iPhone (320 px)
  for (const id of ["v2-deux-seances-tendance-indisponible", "v2-tendance-disponible"]) {
    const court = id.replace(/^v2-/, "");
    const sortie = path.join(DOSSIER, `largeur-320px-iphone-se-${court}-v2.png`);
    await capturerPage(nav, `http://127.0.0.1:${port}/pages/vnext2/${id}-320-entiere.html`, sortie, 320, "largeur-320-" + id);
    console.log("  320 px", id);
  }

  // 4. texte agrandi x1,3 — sur le cas qui bascule sous la ligne de flottaison
  await capturerPage(
    nav,
    `http://127.0.0.1:${port}/pages/vnext2/v2-tendance-disponible-375-x13-entiere.html`,
    path.join(DOSSIER, "texte-agrandi-x1-3-tendance-disponible-v2-375.png"),
    375,
    "texte-x1.3-tendance-disponible"
  );
  console.log("  texte x1,3");

  // 5. le visualiseur avec son selecteur de variante
  const base = await capturerVisualiseur(nav);
  console.log("  visualiseur" + (base ? " (" + base + ")" : " — ECHEC"));

  await nav.close();
  s.close();

  console.log("\n=== RAPPORT DE CAPTURE — VARIANTE 2 ===");
  console.log("Reussies : " + rapport.ok.length);
  console.log("Echouees : " + rapport.echecs.length);
  for (const e of rapport.echecs) console.log("  ECHEC " + e.nom + " -> " + e.raison);
  fs.writeFileSync(path.join(DOSSIER, "_rapport-captures.json"), JSON.stringify(rapport, null, 2), "utf8");
  process.exit(rapport.echecs.length ? 1 : 0);
})();
