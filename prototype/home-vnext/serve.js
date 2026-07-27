// prototype/home-vnext/serve.js
// =============================================================================
// SERVEUR LOCAL DU VISUALISEUR
// =============================================================================
//   node prototype/home-vnext/serve.js
//
// Sert prototype/home-vnext/out/ sur http://127.0.0.1:8140/ .
// Si 8140 est occupe, prend le port libre suivant et AFFICHE l'URL reelle.
//
// Ecoute sur 127.0.0.1 uniquement : rien n'est expose sur le reseau.
// Aucune dependance : uniquement les modules livres avec Node.
// =============================================================================
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const { OUT_ROOT } = require("./lib/paths");

const HOTE = "127.0.0.1";
const PORT_DEPART = Number(process.env.PORT || 8140);
const PORTS_A_ESSAYER = 20;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

if (!fs.existsSync(path.join(OUT_ROOT, "index.html"))) {
  console.error("Rien a servir : prototype/home-vnext/out/index.html est absent.");
  console.error("Lance d'abord :  node prototype/home-vnext/build.js");
  process.exit(1);
}

const serveur = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p === "/") p = "/index.html";
  const fichier = path.join(OUT_ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
  if (!fichier.startsWith(OUT_ROOT)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("interdit");
    return;
  }
  fs.readFile(fichier, (err, buf) => {
    if (err) {
      res
        .writeHead(404, { "content-type": "text/plain; charset=utf-8" })
        .end(`404 — introuvable : ${p}`);
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(fichier)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(buf);
  });
});

function ecouter(port, restants) {
  // Les deux ecouteurs sont retires l'un par l'autre : sans ca, le rappel de
  // succes de la premiere tentative reste accroche au serveur et se declenche
  // quand un port SUIVANT finit par repondre — on annoncerait alors la mauvaise
  // adresse (bug constate au premier essai).
  const surErreur = (err) => {
    serveur.removeListener("listening", surEcoute);
    if (err.code === "EADDRINUSE" && restants > 0) {
      console.log(`port ${port} occupe, essai sur ${port + 1}…`);
      ecouter(port + 1, restants - 1);
      return;
    }
    console.error(err);
    process.exit(1);
  };

  const surEcoute = () => {
    serveur.removeListener("error", surErreur);
    const url = `http://${HOTE}:${port}/`;
    console.log("");
    console.log("  PROTOTYPE HOME vNEXT — DONNEES FICTIVES, NON CONNECTE");
    console.log("");
    console.log(`  Visualiseur : ${url}`);
    console.log(`  Racine servie : ${OUT_ROOT}`);
    console.log("");
    console.log("  Ctrl+C pour arreter.");
    console.log("");
  };

  serveur.once("error", surErreur);
  serveur.once("listening", surEcoute);
  serveur.listen(port, HOTE);
}

ecouter(PORT_DEPART, PORTS_A_ESSAYER);
