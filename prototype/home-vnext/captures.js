// prototype/home-vnext/captures.js
// =============================================================================
// CAPTURES PNG — POUR REGARDER SANS LANCER LE SERVEUR
// =============================================================================
//   node prototype/home-vnext/captures.js
//
// Ecrit des images dans outputs/home-vnext-prototype-2026-07-27/captures/ :
// un PNG par etat, en 375 px, vue « zone visible sans defilement » (la vue
// honnete : c'est ce que le joueur voit en ouvrant l'app), pour la proposition
// ET pour le Home actuel.
//
// Le visualiseur reste le livrable principal — il montre les deux cotes, les
// quatre largeurs, les seuils et les limites. Ces images servent quand on veut
// juste montrer l'ecran a quelqu'un, dans un message ou sur un telephone.
//
// Aucune dependance : Chrome (ou Edge) deja installe, en mode sans interface.
// =============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const { APP_ROOT, OUT_ROOT } = require("./lib/paths");
const { getDevice } = require("./lib/devices");

const LARGEUR = Number(process.env.FKS_LARGEUR || 375);
const DOSSIER = path.join(APP_ROOT, "outputs/home-vnext-prototype-2026-07-27/captures");

const NAVIGATEURS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

function serveur() {
  const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
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

function capturer(navigateur, url, sortie, device) {
  return new Promise((resolve) => {
    const p = spawn(
      navigateur,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--no-first-run",
        `--user-data-dir=${path.join(require("os").tmpdir(), "fks-home-vnext-chrome")}`,
        `--window-size=${device.width},${device.screenHeight}`,
        `--screenshot=${sortie}`,
        url,
      ],
      { windowsHide: true }
    );
    p.on("close", () => resolve());
    p.on("error", () => resolve());
  });
}

async function main() {
  const navigateur = NAVIGATEURS.find((p) => fs.existsSync(p));
  if (!navigateur) {
    console.error("Aucun navigateur Chrome/Edge trouve.");
    process.exit(1);
  }
  const device = getDevice(LARGEUR);
  fs.mkdirSync(DOSSIER, { recursive: true });

  const dossierPages = path.join(OUT_ROOT, "pages");
  if (!fs.existsSync(dossierPages)) {
    console.error("Rien a capturer. Lance d'abord : node prototype/home-vnext/build.js");
    process.exit(1);
  }

  const { s, port } = await serveur();
  const motif = new RegExp(`-${LARGEUR}-visible\\.html$`);
  let n = 0;
  for (const variante of ["vnext", "actuel"]) {
    const dir = path.join(dossierPages, variante);
    if (!fs.existsSync(dir)) continue;
    for (const nom of fs.readdirSync(dir).filter((f) => motif.test(f))) {
      const etat = nom.replace(motif, "");
      const sortie = path.join(DOSSIER, `${variante}-${etat}-${LARGEUR}.png`);
      await capturer(navigateur, `http://127.0.0.1:${port}/pages/${variante}/${nom}`, sortie, device);
      n++;
      process.stdout.write(".");
    }
  }
  s.close();
  console.log(`\n${n} captures ecrites dans ${DOSSIER}`);
  console.log(`Format : ${device.width} x ${device.screenHeight} — ${device.reference}`);
  console.log("Vue : zone visible sans defilement (ce que le joueur voit en ouvrant l'app).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
