// prototype/home-vnext/captures-livrables.js
// =============================================================================
// CAPTURES POUR LA REVUE DU FONDATEUR
// =============================================================================
//   node prototype/home-vnext/captures-livrables.js
//
// Produit le jeu d'images que Kyllian regarde, dans
// outputs/home-vnext-prototype-2026-07-27/captures/ :
//
//   1. les 14 etats produit de la proposition, en 375 px, VUE PAGE ENTIERE
//      (rien n'est coupe : on voit tout l'ecran, meme ce qui demande a defiler)
//   2. 4 comparaisons cote a cote Home actuel / proposition
//   3. l'etat « seance prevue » en 320 / 390 / 768 px
//   4. un texte agrandi x1,3
//   5. le visualiseur lui-meme, pour montrer l'outil
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
const DOSSIER = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27/captures");
const VISUALISEUR = process.env.FKS_VISUALISEUR || "http://127.0.0.1:8140/";

// --- les 14 etats PRODUIT, dans l'ordre de lecture du visualiseur -----------
// stress-textes-longs n'en fait pas partie : ce n'est pas un etat produit,
// c'est un test de resistance de la mise en page.
const ETATS = [
  ["nouveau-joueur", "nouveau-joueur"],
  ["seance-prevue-aujourdhui", "seance-prevue-aujourdhui"],
  ["seance-a-reprendre", "seance-a-reprendre"],
  ["seance-terminee", "seance-terminee"],
  ["jour-recuperation", "jour-recuperation"],
  ["jour-sans-seance", "jour-sans-seance"],
  ["reprise-longue-interruption", "reprise-longue-interruption"],
  ["tendance-indisponible", "tendance-indisponible"],
  ["tendance-disponible", "tendance-disponible"],
  ["erreur-generation", "erreur-generation"],
  ["hors-ligne", "hors-ligne"],
  ["directive-club-absente", "directive-club-absente"],
  ["directive-club-non-appliquee", "directive-club-non-appliquee"],
  ["joueur-autonome-sans-club", "joueur-autonome-sans-club"],
];

const COMPARAISONS = [
  ["nouveau-joueur", "Nouveau joueur"],
  ["seance-prevue-aujourdhui", "Seance prevue aujourd'hui"],
  ["seance-terminee", "Seance terminee"],
  ["reprise-longue-interruption", "Reprise apres interruption longue"],
];

const rapport = { ok: [], echecs: [] };

// --- serveur local ephemere (les pages, pas le visualiseur) -----------------
function serveur() {
  const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
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

// --- une capture d'une page d'ecran ----------------------------------------
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
    rapport.ok.push(nom);
    return true;
  } catch (e) {
    rapport.echecs.push({ nom, url, raison: String(e && e.message ? e.message : e) });
    return false;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- hauteur d'une page (pour dimensionner les cadres cote a cote) ----------
async function hauteurDe(nav, url) {
  const page = await nav.newPage();
  try {
    await page.setViewport({ width: 375, height: 900, deviceScaleFactor: 1 });
    const rep = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!rep || !rep.ok()) throw new Error("page introuvable");
    await dodo(200);
    // `.stage` porte un `min-height: 812px` : le mesurer surestimerait tout ecran
    // plus court que l'appareil. La hauteur REELLE du contenu est celle de
    // `.device`, l'ecran de l'application. C'est aussi celle du tableau de mesures.
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

// --- comparaison cote a cote ------------------------------------------------
function pageComparaison(titre, urlA, hA, contenuA, urlB, hB, contenuB) {
  const h = Math.max(hA, hB);
  const ecart = Math.round(((contenuB - contenuA) / contenuA) * 100);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#EDF1F6;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .bandeau{padding:14px 18px 12px;}
  .bandeau h1{margin:0;font-size:17px;font-weight:800;color:#0F1A2B;letter-spacing:-.2px;}
  .bandeau p{margin:4px 0 0;font-size:12px;font-weight:600;color:#5A6779;}
  .grille{display:flex;gap:18px;padding:0 18px 18px;align-items:flex-start;}
  .col{width:375px;}
  .etiquette{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;padding:6px 10px;
    border-radius:8px;font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;}
  .gauche{background:#5A6779;color:#fff;}
  .droite{background:#B4530C;color:#fff;}
  .etiquette span{font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;opacity:.9;}
  .cadre{width:375px;height:${h}px;border:1px solid #C9D2DE;border-radius:6px;overflow:hidden;background:#F5F7FA;}
  iframe{width:375px;height:${h}px;border:0;display:block;}
  .pied{padding:0 18px 16px;font-size:11px;font-weight:600;color:#7A8699;}
</style></head><body>
<div class="bandeau"><h1>${titre}</h1>
<p>Vue « page entiere » — 375 px — rien n'est coupe. Donnees fictives.
Hauteur de contenu : <b>${contenuA} px</b> aujourd'hui contre <b>${contenuB} px</b> propose, soit <b>${ecart} %</b>.</p></div>
<div class="grille">
  <div class="col"><div class="etiquette gauche">Home actuel <span>contenu ${contenuA} px</span></div>
    <div class="cadre"><iframe src="${urlA}" scrolling="no"></iframe></div></div>
  <div class="col"><div class="etiquette droite">Proposition vNext <span>contenu ${contenuB} px</span></div>
    <div class="cadre"><iframe src="${urlB}" scrolling="no"></iframe></div></div>
</div>
<div class="pied">Les deux colonnes sont rendues par le meme moteur, avec les memes reglages. Le trait rouge est la ligne de flottaison (bas de la zone visible sur un iPhone 375 x 812).</div>
</body></html>`;
}

async function capturerComparaison(nav, port, etat, titre) {
  const nom = "comparaison-" + etat;
  const sortie = path.join(DOSSIER, "comparaison-" + etat + "-actuel-vs-vnext-375.png");
  let page;
  try {
    const urlA = `http://127.0.0.1:${port}/pages/actuel/${etat}-375-entiere.html`;
    const urlB = `http://127.0.0.1:${port}/pages/vnext/${etat}-375-entiere.html`;
    const mA = await hauteurDe(nav, urlA);
    const mB = await hauteurDe(nav, urlB);
    // Le cadre doit contenir la scene entiere (reperes et barre d'onglets compris) ;
    // l'etiquette, elle, annonce la hauteur reelle du contenu de l'ecran.
    const hA = Math.max(mA.scene, mA.contenu);
    const hB = Math.max(mB.scene, mB.contenu);
    const html = pageComparaison(titre, urlA, hA, mA.contenu, urlB, hB, mB.contenu);
    const fichier = path.join(OUT_ROOT, "_cmp-" + etat + ".html");
    fs.writeFileSync(fichier, html, "utf8");

    page = await nav.newPage();
    await page.setViewport({ width: 810, height: Math.max(hA, hB) + 160, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${port}/_cmp-${etat}.html`, { waitUntil: "networkidle0", timeout: 40000 });
    await dodo(500);
    await page.screenshot({ path: sortie, fullPage: true });
    fs.unlinkSync(fichier);
    rapport.ok.push(nom);
  } catch (e) {
    rapport.echecs.push({ nom, raison: String(e && e.message ? e.message : e) });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- le visualiseur lui-meme ------------------------------------------------
async function capturerVisualiseur(nav) {
  const nom = "visualiseur";
  const sortie = path.join(DOSSIER, "outil-visualiseur-vue-cote-a-cote.png");
  let page;
  try {
    page = await nav.newPage();
    await page.setViewport({ width: 1600, height: 1180, deviceScaleFactor: 1.5 });
    const rep = await page.goto(VISUALISEUR + "#etat=seance-prevue-aujourdhui&var=duo&w=375&vue=visible", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    if (!rep || !rep.ok()) throw new Error("visualiseur injoignable sur " + VISUALISEUR + " — lance `node prototype/home-vnext/serve.js`");
    await dodo(1500);
    await page.screenshot({ path: sortie });
    rapport.ok.push(nom);
  } catch (e) {
    rapport.echecs.push({ nom, raison: String(e && e.message ? e.message : e) });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

(async () => {
  if (!fs.existsSync(DOSSIER)) fs.mkdirSync(DOSSIER, { recursive: true });
  const puppeteer = require(PUPPETEER);
  const { s, port } = await serveur();
  const nav = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--force-prefers-reduced-motion", "--hide-scrollbars"],
  });

  console.log("Pages servies sur http://127.0.0.1:" + port);

  // 1. les 14 etats produit, page entiere, 375 px
  let i = 0;
  for (const [etat] of ETATS) {
    i += 1;
    const num = String(i).padStart(2, "0");
    const sortie = path.join(DOSSIER, `etat-${num}-${etat}-vnext-375-page-entiere.png`);
    await capturerPage(nav, `http://127.0.0.1:${port}/pages/vnext/${etat}-375-entiere.html`, sortie, 375, `etat-${num}-${etat}`);
    console.log("  etat", num, etat);
  }

  // 2. les 4 comparaisons
  for (const [etat, titre] of COMPARAISONS) {
    await capturerComparaison(nav, port, etat, titre);
    console.log("  comparaison", etat);
  }

  // 3. seance prevue en 320 / 390 / 768
  for (const [l, suffixe] of [[320, "320px-iphone-se"], [390, "390px-iphone-recent"], [768, "768px-tablette"]]) {
    const sortie = path.join(DOSSIER, `largeur-seance-prevue-vnext-${suffixe}.png`);
    await capturerPage(nav, `http://127.0.0.1:${port}/pages/vnext/seance-prevue-aujourdhui-${l}-entiere.html`, sortie, l, `largeur-${l}`);
    console.log("  largeur", l);
  }

  // 4. texte agrandi x1,3
  await capturerPage(
    nav,
    `http://127.0.0.1:${port}/pages/vnext/seance-prevue-aujourdhui-375-x13-entiere.html`,
    path.join(DOSSIER, "texte-agrandi-x1-3-seance-prevue-vnext-375.png"),
    375,
    "texte-x1.3-seance-prevue"
  );
  await capturerPage(
    nav,
    `http://127.0.0.1:${port}/pages/vnext/stress-textes-longs-375-x13-entiere.html`,
    path.join(DOSSIER, "texte-agrandi-x1-3-stress-textes-longs-vnext-375.png"),
    375,
    "texte-x1.3-stress"
  );
  console.log("  texte x1,3");

  // 5. le visualiseur
  await capturerVisualiseur(nav);
  console.log("  visualiseur");

  await nav.close();
  s.close();

  console.log("\n=== RAPPORT DE CAPTURE ===");
  console.log("Reussies : " + rapport.ok.length);
  console.log("Echouees : " + rapport.echecs.length);
  for (const e of rapport.echecs) console.log("  ECHEC " + e.nom + " -> " + e.raison);
  fs.writeFileSync(path.join(DOSSIER, "_rapport-captures.json"), JSON.stringify(rapport, null, 2), "utf8");
  process.exit(rapport.echecs.length ? 1 : 0);
})();
