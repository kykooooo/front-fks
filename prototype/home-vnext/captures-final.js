// prototype/home-vnext/captures-final.js
// =============================================================================
// CAPTURES DE L'ITERATION FINALE — « PROGRESSION INTEGREE », TYPO ALLEGEE
// =============================================================================
//   node prototype/home-vnext/captures-final.js
//
// Ecrit dans outputs/home-vnext-prototype-2026-07-27/captures-final/ :
//
//   1. TOUS les etats de la variante 2, en 375 px, vue PAGE ENTIERE
//   2. TYPO ACTUELLE contre TYPO ALLEGEE, cote a cote (la question du moment)
//   3. PROGRESSION AVANT / APRES : lien flottant (variante 1) contre carte (variante 2)
//   4. 320 px : « tendance disponible » et « deux seances »
//   5. deux rendus en texte x1,3
//   6. l'etat « mouvement reduit », avec la PREUVE dans le balisage
//   7. le visualiseur, bascules visibles
//
// Une capture qui echoue est ECRITE dans le rapport. Jamais remplacee en douce
// par une autre image.
//
// Aucun appel reseau sortant, aucun backend, aucune donnee reelle.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");

const PUPPETEER =
  process.env.FKS_PUPPETEER ||
  "C:/Users/Gamer/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer";
const DOSSIER = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27/captures-final");

const VISUALISEURS = process.env.FKS_VISUALISEUR
  ? [process.env.FKS_VISUALISEUR]
  : ["http://127.0.0.1:8141/", "http://127.0.0.1:8140/", "http://127.0.0.1:8142/"];

// --- les cas de la carte, dans l'ordre du contrat ----------------------------
// `hote` = l'ecran Home sur lequel la carte est posee. C'est aussi la page de
// variante 1 a laquelle la comparer.
const CAS = [
  { num: "01", id: "v2-nouveau-joueur", hote: "nouveau-joueur", titre: "Nouveau joueur (etat empty)" },
  { num: "02", id: "v2-deux-seances-tendance-indisponible", hote: "tendance-indisponible", titre: "Deux seances, tendance indisponible (collecting)" },
  { num: "03", id: "v2-tendance-disponible", hote: "tendance-disponible", titre: "Tendance disponible — repere designe par la regle 1 (cycle Force)" },
  { num: "04", id: "v2-test-physique-ameliore", hote: "seance-terminee", titre: "Test ameliore — repere designe par la regle 1 (cycle Explosivite)" },
  { num: "05", id: "v2-test-physique-en-recul", hote: "tendance-indisponible", titre: "Test EN RECUL — repere designe par les regles 2 puis 3" },
  { num: "06", id: "v2-aucune-comparaison-de-test", hote: "seance-prevue-aujourdhui", titre: "Aucune comparaison possible" },
  { num: "R1", id: "v2-donnee-manquante", hote: "tendance-indisponible", titre: "Donnee manquante (preuve R1)" },
];

const rapport = { genereLe: new Date().toISOString(), ok: [], echecs: [] };

// --- serveur local ephemere --------------------------------------------------
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
const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- capture d'une page d'ecran ---------------------------------------------
async function capturerPage(nav, url, sortie, largeur, nom) {
  let page;
  try {
    page = await nav.newPage();
    await page.setViewport({ width: largeur, height: 900, deviceScaleFactor: 2 });
    const rep = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!rep || !rep.ok())
      throw new Error("page introuvable (" + (rep ? rep.status() : "aucune reponse") + ")");
    await dodo(220);
    const boite = await page.evaluate(() => {
      const el = document.querySelector(".stage") || document.body;
      const r = el.getBoundingClientRect();
      return { w: Math.ceil(r.width), h: Math.ceil(Math.max(r.height, el.scrollHeight)) };
    });
    await page.setViewport({ width: largeur, height: Math.max(200, boite.h), deviceScaleFactor: 2 });
    await dodo(120);
    await page.screenshot({ path: sortie, clip: { x: 0, y: 0, width: boite.w, height: boite.h } });
    rapport.ok.push({ nom, fichier: path.basename(sortie) });
    return true;
  } catch (e) {
    rapport.echecs.push({ nom, url, raison: String((e && e.message) || e) });
    return false;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- mesures d'une page ------------------------------------------------------
async function mesurerPage(nav, url, largeur) {
  const page = await nav.newPage();
  try {
    await page.setViewport({ width: largeur, height: 900, deviceScaleFactor: 1 });
    const rep = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!rep || !rep.ok()) throw new Error("page introuvable : " + url);
    await dodo(200);
    return await page.evaluate(() => {
      const app = document.querySelector(".device");
      const scene = document.querySelector(".stage") || document.body;
      const h = (el) => Math.ceil(Math.max(el.getBoundingClientRect().height, el.scrollHeight));
      const mvt = document.querySelector('[data-testid="home-vnext-mouvement-action"]');
      let balise = null;
      if (mvt) {
        const brut = mvt.outerHTML;
        balise = brut.slice(0, brut.indexOf(">") + 1);
      }
      return { contenu: app ? h(app) : h(scene), scene: h(scene), baliseMouvement: balise };
    });
  } finally {
    await page.close().catch(() => {});
  }
}

// --- gabarit generique de comparaison cote a cote ----------------------------
function pageDuo(o) {
  const h = Math.max(o.hauteurCadreA, o.hauteurCadreB);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#EDF1F6;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .bandeau{padding:14px 18px 12px;}
  .bandeau h1{margin:0;font-size:17px;font-weight:800;color:#0F1A2B;letter-spacing:-.2px;}
  .bandeau p{margin:6px 0 0;font-size:12px;font-weight:600;color:#5A6779;line-height:1.55;}
  .grille{display:flex;gap:18px;padding:0 18px 16px;align-items:flex-start;}
  .col{width:${o.largeur}px;}
  .etiquette{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;padding:6px 10px;
    border-radius:8px;font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
    white-space:nowrap;overflow:hidden;height:29px;box-sizing:border-box;}
  .gauche{background:#5A6779;color:#fff;}
  .droite{background:#0F7A4A;color:#fff;}
  .etiquette span{font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;opacity:.92;}
  .cadre{width:${o.largeur}px;height:${h}px;border:1px solid #C9D2DE;border-radius:6px;
    overflow:hidden;background:#F5F7FA;}
  iframe{width:${o.largeur}px;height:${h}px;border:0;display:block;}
  .code{margin:8px 0 0;padding:8px 10px;border-radius:6px;background:#101828;color:#D7E3F4;
    font-family:Consolas,"SF Mono",Menlo,monospace;font-size:10.5px;line-height:1.55;
    white-space:pre-wrap;word-break:break-all;}
  .pied{padding:0 18px 18px;font-size:11px;font-weight:600;color:#7A8699;line-height:1.6;}
</style></head><body>
<div class="bandeau"><h1>${o.titre}</h1><p>${o.note}</p></div>
<div class="grille">
  <div class="col">
    <div class="etiquette gauche">${o.etiquetteA}<span>${o.detailA}</span></div>
    <div class="cadre"><iframe src="${o.urlA}" scrolling="no"></iframe></div>
    ${o.codeA ? `<div class="code">${echapper(o.codeA)}</div>` : ""}
  </div>
  <div class="col">
    <div class="etiquette droite">${o.etiquetteB}<span>${o.detailB}</span></div>
    <div class="cadre"><iframe src="${o.urlB}" scrolling="no"></iframe></div>
    ${o.codeB ? `<div class="code">${echapper(o.codeB)}</div>` : ""}
  </div>
</div>
<div class="pied">${o.pied}</div>
</body></html>`;
}

async function capturerDuo(nav, port, o) {
  let page;
  try {
    const mA = await mesurerPage(nav, o.urlA, o.largeur);
    const mB = await mesurerPage(nav, o.urlB, o.largeur);
    const html = pageDuo({
      largeur: o.largeur,
      titre: o.titre,
      note: typeof o.note === "function" ? o.note(mA, mB) : o.note,
      etiquetteA: o.etiquetteA,
      etiquetteB: o.etiquetteB,
      urlA: o.urlA,
      urlB: o.urlB,
      detailA: o.detail ? o.detail(mA) : "contenu " + mA.contenu + " px",
      detailB: o.detail ? o.detail(mB) : "contenu " + mB.contenu + " px",
      codeA: o.codeDe ? o.codeDe(mA) : null,
      codeB: o.codeDe ? o.codeDe(mB) : null,
      hauteurCadreA: Math.max(mA.scene, mA.contenu),
      hauteurCadreB: Math.max(mB.scene, mB.contenu),
      pied: o.pied,
    });
    const tmp = path.join(OUT_ROOT, "_final-" + o.slug + ".html");
    fs.writeFileSync(tmp, html, "utf8");

    page = await nav.newPage();
    const hMax = Math.max(mA.scene, mA.contenu, mB.scene, mB.contenu);
    await page.setViewport({
      width: o.largeur * 2 + 60,
      height: hMax + 300,
      deviceScaleFactor: 2,
    });
    await page.goto(`http://127.0.0.1:${port}/_final-${o.slug}.html`, {
      waitUntil: "networkidle0",
      timeout: 40000,
    });
    // Un `networkidle0` sur la page parente ne garantit PAS que les deux cadres
    // ont fini de peindre. On attend que chacun porte reellement un ecran rendu
    // (le noeud `.device`), et on ECHOUE si ce n'est pas le cas — plutot que de
    // livrer une capture avec deux cadres vides.
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("iframe")).every((f) => {
          const d = f.contentDocument;
          return !!(d && d.querySelector(".device"));
        }),
      { timeout: 20000, polling: 150 }
    );
    await dodo(600);
    const cadresPeints = await page.evaluate(() =>
      Array.from(document.querySelectorAll("iframe")).map((f) => {
        const el = f.contentDocument && f.contentDocument.querySelector(".device");
        return el ? Math.round(el.getBoundingClientRect().height) : 0;
      })
    );
    if (cadresPeints.some((h) => h < 50)) {
      throw new Error("un cadre est reste vide (hauteurs mesurees : " + cadresPeints.join(", ") + ")");
    }
    await page.screenshot({ path: path.join(DOSSIER, o.fichier), fullPage: true });
    fs.unlinkSync(tmp);
    rapport.ok.push({
      nom: o.slug,
      fichier: o.fichier,
      gauche: mA.contenu,
      droite: mB.contenu,
      ecartPx: mB.contenu - mA.contenu,
    });
  } catch (e) {
    rapport.echecs.push({ nom: o.slug, raison: String((e && e.message) || e) });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// --- le visualiseur ----------------------------------------------------------
async function capturerVisualiseur(nav, fragment, fichier, nom) {
  const essais = [];
  for (const base of VISUALISEURS) {
    let page;
    try {
      page = await nav.newPage();
      await page.setViewport({ width: 1680, height: 1200, deviceScaleFactor: 1.5 });
      const rep = await page.goto(base + fragment, { waitUntil: "networkidle0", timeout: 15000 });
      if (!rep || !rep.ok()) throw new Error("reponse " + (rep ? rep.status() : "aucune"));
      await dodo(2000);
      await page.screenshot({ path: path.join(DOSSIER, fichier) });
      rapport.ok.push({ nom, fichier, visualiseur: base });
      await page.close().catch(() => {});
      return base;
    } catch (e) {
      essais.push(base + " -> " + String((e && e.message) || e));
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

const pg = (port, dossier, nom) => `http://127.0.0.1:${port}/pages/${dossier}/${nom}.html`;

(async () => {
  if (!fs.existsSync(DOSSIER)) fs.mkdirSync(DOSSIER, { recursive: true });
  if (!fs.existsSync(path.join(OUT_ROOT, "pages/vnext2"))) {
    console.error("Pages de variante 2 absentes. Lance d'abord : node prototype/home-vnext/build.js");
    process.exit(1);
  }

  const puppeteer = require(PUPPETEER);
  const { s, port } = await serveur();
  const nav = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--force-prefers-reduced-motion", "--hide-scrollbars"],
  });
  console.log("Pages servies sur http://127.0.0.1:" + port);

  // 1. tous les etats, 375 px, page entiere -----------------------------------
  for (const c of CAS) {
    const suffixe = c.num === "R1" ? "R1-preuve-donnee-manquante" : `${c.num}-${c.id.replace(/^v2-/, "")}`;
    await capturerPage(
      nav,
      pg(port, "vnext2", `${c.id}-375-entiere`),
      path.join(DOSSIER, `etat-${suffixe}-375-page-entiere.png`),
      375,
      "etat-" + c.id
    );
    console.log("  etat", c.num, c.id);
  }

  // 2. TYPO ACTUELLE contre TYPO ALLEGEE --------------------------------------
  const CAS_TYPO = [
    {
      id: "v2-tendance-disponible",
      court: "tendance-disponible",
      largeur: 375,
      note: "L'ecran de reference. Memes mots, memes chiffres, meme mise en page : SEULE la typographie change.",
    },
    {
      id: "v2-test-physique-en-recul",
      court: "test-physique-en-recul",
      largeur: 375,
      note: "Le cas le plus dense de la serie (un repere de test en retrait + une semaine remplie).",
    },
    {
      id: "v2-tendance-disponible",
      court: "tendance-disponible",
      largeur: 320,
      note: "Le petit iPhone SE, la largeur ou le poids typographique se voit le plus.",
    },
  ];
  for (const t of CAS_TYPO) {
    await capturerDuo(nav, port, {
      slug: `typo-${t.court}-${t.largeur}`,
      fichier: `comparaison-typo-actuelle-vs-allegee-${t.court}-${t.largeur}.png`,
      largeur: t.largeur,
      titre: `Typographie : ACTUELLE contre ALLEGEE — ${t.court} — ${t.largeur} px`,
      note: (a, b) =>
        `${t.note}<br>Ce qui change : salutation 22 -&gt; 20 px, titre d'action 17 -&gt; 16 px, ` +
        `intitules de section 13 -&gt; 12 px, et surtout <b>plus AUCUN texte en graisse 800</b> ` +
        `(il y en avait 32 par ecran). Le texte lu, lui, GRANDIT : corps et liens passent de 13 a 14 px, ` +
        `interligne de 18 a 20. Hauteur de contenu : <b>${a.contenu} px</b> contre <b>${b.contenu} px</b>, ` +
        `soit ${b.contenu - a.contenu >= 0 ? "+" : ""}${b.contenu - a.contenu} px.`,
      etiquetteA: "Avant — echelle actuelle",
      etiquetteB: "Apres — echelle allegee (defaut)",
      urlA: pg(port, "vnext2", `${t.id}-${t.largeur}-entiere-typo-actuelle`),
      urlB: pg(port, "vnext2", `${t.id}-${t.largeur}-entiere`),
      pied:
        "Aucune valeur n'a ete reduite pour gagner de la hauteur (decision D2). Les metadonnees (12 px) et " +
        "les valeurs chiffrees (16 px) ne perdent pas un pixel. Le trait rouge est la ligne de flottaison. " +
        "Donnees fictives.",
    });
    console.log("  typo", t.court, t.largeur);
  }

  // 3. PROGRESSION AVANT / APRES ----------------------------------------------
  const CAS_PROG = [
    {
      id: "v2-nouveau-joueur",
      hote: "nouveau-joueur",
      court: "nouveau-joueur",
      note:
        "Compte tout neuf. A gauche, le lien flottant n'apprend rien tant qu'on ne l'a pas ouvert. A droite, la carte " +
        "pose trois reperes honnetes et dit ce qui manque. Aucun graphique, aucun chiffre invente.",
    },
    {
      id: "v2-tendance-disponible",
      hote: "tendance-disponible",
      court: "tendance-disponible",
      note:
        "Etat complet. La courbe s'affiche avec sa portee ecrite mot pour mot, le lien devient le pied de la carte " +
        "(memes mots, meme destination), et un test refait donne un ecart reellement mesure (+9 cm au saut). " +
        "Regarde aussi le HAUT des deux colonnes : la pastille d'etat global a DISPARU a droite (decision D1).",
    },
    {
      id: "v2-test-physique-en-recul",
      hote: "tendance-indisponible",
      court: "test-physique-en-recul",
      note:
        "La preuve que la selection du repere est aveugle au resultat : deux ameliorations etaient disponibles dans " +
        "la meme batterie (+3 cm au saut, +25 m au 6 min) et c'est le SPRINT EN RETRAIT (+0,07 s) qui s'affiche, " +
        "parce que c'est lui que la regle designe.",
    },
  ];
  for (const c of CAS_PROG) {
    await capturerDuo(nav, port, {
      slug: `prog-${c.court}`,
      fichier: `comparaison-progression-avant-apres-${c.court}-375.png`,
      largeur: 375,
      titre: `Progression : AVANT (lien flottant) / APRES (carte integree) — ${c.court}`,
      note: (a, b) =>
        `${c.note}<br>Hauteur de contenu : <b>${a.contenu} px</b> avant contre <b>${b.contenu} px</b> apres, ` +
        `soit <b>${b.contenu - a.contenu >= 0 ? "+" : ""}${b.contenu - a.contenu} px</b> ` +
        `(${Math.round(((b.contenu - a.contenu) / a.contenu) * 1000) / 10} %). Vue « page entiere » : rien n'est coupe.`,
      etiquetteA: "Avant — lien flottant",
      etiquetteB: "Apres — carte integree",
      urlA: pg(port, "vnext", `${c.hote}-375-entiere`),
      urlB: pg(port, "vnext2", `${c.id}-375-entiere`),
      pied:
        "Les deux colonnes sont rendues par le meme moteur, avec les memes reglages et la meme typographie allegee. " +
        "Ce qui est sous le trait rouge demande de faire defiler — le defilement est accepte (decision D2). " +
        "Donnees fictives.",
    });
    console.log("  progression", c.court);
  }

  // 4. 320 px -----------------------------------------------------------------
  for (const id of ["v2-tendance-disponible", "v2-deux-seances-tendance-indisponible"]) {
    const court = id.replace(/^v2-/, "");
    await capturerPage(
      nav,
      pg(port, "vnext2", `${id}-320-entiere`),
      path.join(DOSSIER, `largeur-320px-iphone-se-${court}.png`),
      320,
      "largeur-320-" + id
    );
    console.log("  320 px", court);
  }

  // 5. texte x1,3 -------------------------------------------------------------
  for (const id of ["v2-tendance-disponible", "v2-test-physique-en-recul"]) {
    const court = id.replace(/^v2-/, "");
    await capturerPage(
      nav,
      pg(port, "vnext2", `${id}-375-x13-entiere`),
      path.join(DOSSIER, `texte-agrandi-x1-3-${court}-375.png`),
      375,
      "x13-" + id
    );
    console.log("  x1,3", court);
  }

  // 6. mouvement reduit -------------------------------------------------------
  await capturerDuo(nav, port, {
    slug: "mouvement-reduit",
    fichier: "mouvement-reduit-vs-normal-tendance-disponible-375.png",
    largeur: 375,
    titre: "Reglage « Reduire les animations » — la preuve est dans le balisage",
    note:
      "Au repos, les deux ecrans sont RIGOUREUSEMENT identiques a l'oeil, et c'est le resultat voulu : aucune " +
      "information n'est portee par un mouvement. Le prototype n'a AUCUNE animation en boucle — la seule animation " +
      "existante est l'enfoncement du bouton sous le doigt. Ce qui change se lit sous chaque colonne : la ligne de " +
      "code du conteneur du bouton du jour. A gauche il porte une consigne de mouvement, a droite il n'en porte " +
      "AUCUNE (pas meme une consigne neutre).",
    etiquetteA: "Mouvement autorise",
    etiquetteB: "Mouvement reduit",
    urlA: pg(port, "vnext2", "v2-tendance-disponible-375-entiere"),
    urlB: pg(port, "vnext2", "v2-tendance-disponible-375-entiere-anim-reduites"),
    detail: (m) => (m.baliseMouvement && /transform/.test(m.baliseMouvement) ? "avec transform" : "sans transform"),
    codeDe: (m) => m.baliseMouvement || "(marqueur home-vnext-mouvement-action absent)",
    pied:
      "A comparer avec la PRODUCTION : components/home/HomePrimaryCTA.tsx joue une pulsation en boucle infinie sans " +
      "jamais consulter le reglage d'accessibilite. Hors perimetre, non corrigee ici, mais mesuree. Donnees fictives.",
  });
  console.log("  mouvement reduit");

  // 7. le visualiseur ---------------------------------------------------------
  await capturerVisualiseur(
    nav,
    "#etat=v2-test-physique-en-recul&var=duo&paire=v1v2&w=375&vue=entiere&x13=0&typo=allegee&anim=0&onglet=regle",
    "outil-visualiseur-bascules-et-regle.png",
    "visualiseur-regle"
  );
  await capturerVisualiseur(
    nav,
    "#etat=v2-tendance-disponible&var=vnext2&w=375&vue=visible&x13=0&typo=allegee&anim=0&onglet=axes",
    "outil-visualiseur-axes-a-trancher.png",
    "visualiseur-axes"
  );
  console.log("  visualiseur");

  await nav.close();
  s.close();

  console.log("\n=== RAPPORT DE CAPTURE — ITERATION FINALE ===");
  console.log("Reussies : " + rapport.ok.length);
  console.log("Echouees : " + rapport.echecs.length);
  for (const e of rapport.echecs) console.log("  ECHEC " + e.nom + " -> " + e.raison);
  fs.writeFileSync(path.join(DOSSIER, "_rapport-captures.json"), JSON.stringify(rapport, null, 2), "utf8");
  process.exit(rapport.echecs.length ? 1 : 0);
})();
