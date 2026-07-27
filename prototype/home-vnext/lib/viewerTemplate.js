// prototype/home-vnext/lib/viewerTemplate.js
// =============================================================================
// LE VISUALISEUR
// =============================================================================
// C'est la page que le fondateur ouvre. Trois principes :
//
//   1. L'OUTIL NE RESSEMBLE PAS AU PRODUIT. Fond sombre, police differente,
//      libelles en petites capitales. On ne doit jamais confondre le harnais et
//      l'application.
//   2. L'ECRAN PRODUIT VIT DANS UNE IFRAME, a la largeur exacte demandee, avec
//      ses reperes (ligne de flottaison, barre d'onglets, zone systeme).
//   3. TOUT CE QUI EST DU COMMENTAIRE (points a valider, seuils, limites,
//      avertissements du prototype) VIT HORS DE L'ECRAN, dans un panneau.
//      Les `protoWarnings` ne doivent JAMAIS apparaitre dans l'ecran produit.
//
// Le visualiseur utilise du JavaScript : il est servi en HTTP, meme origine,
// donc il peut mesurer la hauteur reelle du contenu dans l'iframe. Les pages
// d'ecran, elles, restent du HTML statique sans JavaScript.
// =============================================================================
"use strict";

/**
 * @param {string} version marque de fraicheur ajoutee aux ressources.
 * Sans elle, un navigateur qui a deja ouvert le visualiseur garde l'ancien
 * `viewer.js` en cache apres un nouveau build, et on regarde une version
 * perimee sans s'en rendre compte (constate).
 */
function viewerHtml(version) {
  const v = encodeURIComponent(version || String(Date.now()));
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FKS — prototype Home vNext — visualiseur</title>
<link rel="stylesheet" href="viewer.css?v=${v}">
</head><body>

<div id="bandeau">
  <span class="pastille">Donnees fictives</span>
  <b>PROTOTYPE, NON CONNECTE</b>
  <span class="sep">·</span>
  <span class="etat-courant" id="bandeau-etat">—</span>
  <span class="droite" id="bandeau-meta"></span>
</div>

<div id="barre">
  <div class="grp">
    <span class="lab">Variante</span>
    <div class="seg" id="seg-variante"></div>
  </div>
  <div class="grp">
    <span class="lab">Largeur</span>
    <div class="seg" id="seg-largeur"></div>
  </div>
  <div class="grp">
    <span class="lab">Vue</span>
    <div class="seg" id="seg-vue"></div>
  </div>
  <div class="grp">
    <span class="lab">Texte</span>
    <div class="seg" id="seg-echelle"></div>
  </div>
  <div class="grp droite">
    <button class="btn-panneau" id="btn-panneau">Masquer les panneaux</button>
  </div>
</div>

<div id="corps">
  <nav id="rail" aria-label="Etats"></nav>
  <main id="scene">
    <div id="scene-tete">
      <div id="scene-titre">—</div>
      <div id="scene-resume"></div>
      <div id="scene-alerte"></div>
    </div>
    <div id="cadres"></div>
    <div id="scene-pied"></div>
  </main>
  <aside id="panneaux">
    <div class="onglets" id="onglets"></div>
    <div class="contenu" id="panneau-contenu"></div>
  </aside>
</div>

<iframe id="mesureur" title="mesure (invisible)"></iframe>

<script src="manifest.js?v=${v}"></script>
<script src="viewer.js?v=${v}"></script>
</body></html>`;
}

function viewerCss() {
  return `/* ===========================================================================
   HABILLAGE DU VISUALISEUR
   Volontairement TRES different du produit : fond sombre, police differente,
   libelles en capitales espacees. On ne confond pas l'outil et l'app.
   =========================================================================== */
:root {
  --fond: #0C1119;
  --fond-2: #131B27;
  --fond-3: #1A2432;
  --bord: #26344A;
  --texte: #DCE6F4;
  --texte-2: #8DA0BC;
  --actif: #4C8DFF;
  --alerte: #7A1F1F;
  --avert: #B4530C;
  --ok: #2E7D5B;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--fond); color: var(--texte); font-family: var(--sans); }
body { display: flex; flex-direction: column; overflow: hidden; }

/* --- bandeau permanent --------------------------------------------------- */
#bandeau {
  flex: 0 0 auto; background: var(--alerte); color: #fff;
  padding: 7px 14px; font-family: var(--mono); font-size: 11.5px; letter-spacing: .4px;
  display: flex; align-items: center; gap: 9px;
}
#bandeau .pastille {
  background: #fff; color: var(--alerte); font-weight: 800; text-transform: uppercase;
  padding: 2px 6px; border-radius: 3px; font-size: 10px;
}
#bandeau .sep { opacity: .5; }
#bandeau .etat-courant { font-weight: 700; }
#bandeau .droite { margin-left: auto; opacity: .8; font-size: 10.5px; }

/* --- barre d'outils ------------------------------------------------------ */
#barre {
  flex: 0 0 auto; background: var(--fond-2); border-bottom: 1px solid var(--bord);
  padding: 8px 14px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
}
#barre .grp { display: flex; align-items: center; gap: 8px; }
#barre .grp.droite { margin-left: auto; }
#barre .lab {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1.1px; text-transform: uppercase;
  color: var(--texte-2);
}
.seg { display: flex; border: 1px solid var(--bord); border-radius: 6px; overflow: hidden; }
.seg button {
  background: var(--fond-3); color: var(--texte-2); border: 0; border-right: 1px solid var(--bord);
  padding: 6px 11px; font-family: var(--mono); font-size: 11px; cursor: pointer; white-space: nowrap;
}
.seg button:last-child { border-right: 0; }
.seg button:hover:not(:disabled) { background: #223047; color: var(--texte); }
.seg button.on { background: var(--actif); color: #06101F; font-weight: 700; }
.seg button:disabled { opacity: .35; cursor: not-allowed; }
.btn-panneau {
  background: var(--fond-3); color: var(--texte-2); border: 1px solid var(--bord);
  border-radius: 6px; padding: 6px 11px; font-family: var(--mono); font-size: 11px; cursor: pointer;
}
.btn-panneau:hover { color: var(--texte); }

/* --- corps --------------------------------------------------------------- */
#corps { flex: 1 1 auto; display: flex; min-height: 0; }

/* --- liste des etats ----------------------------------------------------- */
#rail {
  flex: 0 0 268px; background: var(--fond-2); border-right: 1px solid var(--bord);
  overflow-y: auto; padding: 12px 0 40px;
}
#rail .groupe { padding: 14px 14px 4px; }
#rail .groupe .t {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--actif);
}
#rail .groupe .a { font-size: 11px; color: var(--texte-2); margin-top: 3px; line-height: 1.45; }
#rail button.etat {
  display: block; width: 100%; text-align: left; background: transparent; border: 0;
  border-left: 3px solid transparent; color: var(--texte); padding: 8px 14px 8px 11px;
  cursor: pointer; font-size: 12.5px; line-height: 1.35;
}
#rail button.etat:hover { background: var(--fond-3); }
#rail button.etat.on { background: var(--fond-3); border-left-color: var(--actif); font-weight: 700; }
#rail button.etat .sous { display: block; font-family: var(--mono); font-size: 10px; color: var(--texte-2); margin-top: 2px; }
#rail button.etat .marque {
  display: inline-block; font-family: var(--mono); font-size: 9px; padding: 1px 4px;
  border-radius: 3px; margin-left: 5px; vertical-align: 1px;
}
.marque-inexistant { background: #4A1D1D; color: #FFB4A6; }
.marque-approximatif { background: #4A3410; color: #FFD79B; }

/* --- scene --------------------------------------------------------------- */
#scene { flex: 1 1 auto; overflow: auto; padding: 16px 20px 60px; min-width: 0; }
#scene-tete { margin-bottom: 12px; }
#scene-titre { font-size: 17px; font-weight: 700; }
#scene-resume { font-size: 12.5px; color: var(--texte-2); margin-top: 3px; line-height: 1.5; max-width: 900px; }
#scene-alerte { margin-top: 9px; max-width: 900px; }
.alerte {
  border-radius: 6px; padding: 9px 11px; font-size: 12px; line-height: 1.55;
  border: 1px solid; margin-bottom: 7px;
}
.alerte-rouge { background: #2A1210; border-color: #6B2B22; color: #FFC8BC; }
.alerte-orange { background: #2A1F0E; border-color: #6B4C18; color: #FFE0B0; }
.alerte .t { font-weight: 800; display: block; margin-bottom: 3px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .8px; text-transform: uppercase; }

#cadres { display: flex; gap: 26px; align-items: flex-start; flex-wrap: wrap; }
.cadre { flex: 0 0 auto; }
.cadre .tete {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase;
  color: var(--texte-2); margin-bottom: 6px; display: flex; align-items: center; gap: 7px;
}
.cadre .tete .puce { width: 8px; height: 8px; border-radius: 2px; }
.puce-vnext { background: var(--actif); }
.puce-actuel { background: #7E8CA3; }
.porte {
  position: relative; background: #F5F7FA; overflow: hidden;
  box-shadow: 0 0 0 1px #2B3A50, 0 16px 40px rgba(0,0,0,.45);
}
.porte iframe { display: block; border: 0; background: #F5F7FA; }
.porte .fictif-coin {
  position: absolute; right: 0; top: 0; z-index: 60; pointer-events: none;
  background: rgba(122,31,31,.92); color: #fff; font-family: var(--mono); font-size: 8.5px;
  letter-spacing: .6px; padding: 2px 6px; border-bottom-left-radius: 4px;
}
/* La legende de mesure ne doit JAMAIS elargir le cadre : sinon les deux
   colonnes du mode cote a cote passent l'une sous l'autre. */
.mesure {
  margin-top: 7px; font-family: var(--mono); font-size: 10.5px; color: var(--texte-2);
  line-height: 1.6; width: 100%;
}
.mesure b { color: var(--texte); }
.mesure .reste-plus { color: #FFB46B; }
.mesure .reste-moins { color: #7BD6A6; }
#scene-pied { margin-top: 20px; font-size: 11.5px; color: var(--texte-2); line-height: 1.6; max-width: 900px; }
#scene-pied a { color: var(--actif); }

/* --- panneaux ------------------------------------------------------------ */
#panneaux {
  flex: 0 0 400px; background: var(--fond-2); border-left: 1px solid var(--bord);
  display: flex; flex-direction: column; min-height: 0;
}
body.sans-panneaux #panneaux { display: none; }
#onglets { flex: 0 0 auto; display: flex; border-bottom: 1px solid var(--bord); }
#onglets button {
  flex: 1 1 auto; background: transparent; border: 0; border-bottom: 2px solid transparent;
  color: var(--texte-2); padding: 10px 6px; font-family: var(--mono); font-size: 10px;
  letter-spacing: .8px; text-transform: uppercase; cursor: pointer;
}
#onglets button:hover { color: var(--texte); }
#onglets button.on { color: var(--texte); border-bottom-color: var(--actif); background: var(--fond-3); }
#panneau-contenu { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px 60px; }

.point { border: 1px solid var(--bord); border-radius: 7px; margin-bottom: 10px; overflow: hidden; background: var(--fond-3); }
.point > summary {
  cursor: pointer; padding: 9px 11px; font-size: 12.5px; font-weight: 700; list-style: none;
  display: flex; align-items: center; gap: 7px;
}
.point > summary::-webkit-details-marker { display: none; }
.point > summary::before { content: "▸"; color: var(--texte-2); font-size: 11px; }
.point[open] > summary::before { content: "▾"; }
.point .corps { padding: 0 11px 11px; font-size: 12px; line-height: 1.6; color: var(--texte); }
.point .corps .bloc { margin-bottom: 9px; }
.point .corps .cle {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase;
  color: var(--texte-2); display: block; margin-bottom: 2px;
}
.point .corps .liens { display: flex; flex-wrap: wrap; gap: 5px; }
.point .corps .liens button {
  background: #223047; border: 1px solid var(--bord); border-radius: 999px; color: #CFE0FA;
  font-size: 10.5px; padding: 3px 9px; cursor: pointer; font-family: var(--mono);
}
.point .corps .liens button:hover { background: #2E415F; }

.bloc-panneau { margin-bottom: 18px; }
.bloc-panneau > h3 {
  font-family: var(--mono); font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--actif); margin: 0 0 8px;
}
.bloc-panneau p { font-size: 12px; line-height: 1.6; margin: 0 0 8px; color: var(--texte); }
.bloc-panneau .fin { font-size: 11.5px; color: var(--texte-2); line-height: 1.55; }
table.tbl { width: 100%; border-collapse: collapse; font-size: 11.5px; }
table.tbl th, table.tbl td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--bord); vertical-align: top; line-height: 1.5; }
table.tbl th { font-family: var(--mono); font-size: 9.5px; letter-spacing: .8px; text-transform: uppercase; color: var(--texte-2); font-weight: 400; }
table.tbl td.num { font-family: var(--mono); white-space: nowrap; }
.badge { display: inline-block; font-family: var(--mono); font-size: 9.5px; padding: 1px 5px; border-radius: 3px; }
.badge-ok { background: #14361F; color: #8FE3B0; }
.badge-ko { background: #3A1512; color: #FFAE9E; }
.avertissement {
  background: #2A1F0E; border: 1px solid #6B4C18; color: #FFE0B0; border-radius: 6px;
  padding: 8px 10px; font-size: 11.5px; line-height: 1.55; margin-bottom: 7px;
}
.avertissement .t { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; display: block; margin-bottom: 3px; color: #FFC97A; }
.vide { font-size: 12px; color: var(--texte-2); font-style: italic; }
dl.kv { margin: 0; font-size: 12px; }
dl.kv dt { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; color: var(--texte-2); margin-top: 9px; }
dl.kv dd { margin: 2px 0 0; line-height: 1.55; }

#mesureur { position: absolute; left: -20000px; top: 0; width: 800px; height: 12000px; border: 0; visibility: hidden; }

@media (max-width: 1400px) {
  #panneaux { flex-basis: 330px; }
  #rail { flex-basis: 228px; }
}
`;
}

function viewerJs() {
  return `/* ===========================================================================
   LOGIQUE DU VISUALISEUR — vanilla, aucune dependance.
   =========================================================================== */
(function () {
  "use strict";

  var M = window.__FKS_MANIFEST__;
  if (!M) {
    document.body.innerHTML = '<p style="padding:20px;font:14px sans-serif;color:#fff">' +
      'manifest.js absent. Lance d abord : node prototype/home-vnext/build.js</p>';
    return;
  }

  var VARIANTES = [
    { id: "vnext", libelle: "Proposition vNext" },
    { id: "actuel", libelle: "Home actuel" },
    { id: "duo", libelle: "Cote a cote 375" }
  ];
  var VUES = [
    { id: "visible", libelle: "Zone visible sans defilement" },
    { id: "entiere", libelle: "Page entiere" }
  ];

  var etat = {
    etatId: M.ordreEtats[1] || M.ordreEtats[0],
    variante: "vnext",
    largeur: 375,
    vue: "visible",
    x13: false,
    onglet: "points",
    panneaux: true
  };

  // --- persistance dans l'URL ---------------------------------------------
  function lireHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (p) {
      var kv = p.split("=");
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1] || "");
      if (k === "etat" && (M.etats[v] || trouverExtra(v))) etat.etatId = v;
      if (k === "var" && ["vnext", "actuel", "duo"].indexOf(v) !== -1) etat.variante = v;
      if (k === "w") { var w = Number(v); if (M.largeurs.indexOf(w) !== -1) etat.largeur = w; }
      if (k === "vue" && ["visible", "entiere"].indexOf(v) !== -1) etat.vue = v;
      if (k === "x13") etat.x13 = v === "1";
      if (k === "onglet") etat.onglet = v;
    });
  }
  function ecrireHash() {
    var h = "etat=" + etat.etatId + "&var=" + etat.variante + "&w=" + etat.largeur +
      "&vue=" + etat.vue + "&x13=" + (etat.x13 ? 1 : 0) + "&onglet=" + etat.onglet;
    if (("#" + h) !== location.hash) history.replaceState(null, "", "#" + h);
  }

  function trouverExtra(id) {
    for (var i = 0; i < M.extras.length; i++) if (M.extras[i].id === id) return M.extras[i];
    return null;
  }
  function courant() {
    return M.etats[etat.etatId] || trouverExtra(etat.etatId);
  }
  function estExtra() { return !M.etats[etat.etatId]; }
  function device(w) {
    for (var i = 0; i < M.devices.length; i++) if (M.devices[i].width === w) return M.devices[i];
    return M.devices[1];
  }
  function cle(w) { return w + (etat.x13 && w === M.largeurEchelle ? "-x13" : "") + "-" + etat.vue; }
  function pageDe(variante, w) {
    var e = courant();
    if (!e) return null;
    var bloc = variante === "vnext" ? e.vnext : e.actuel;
    if (!bloc || !bloc.pages) return null;
    return bloc.pages[cle(w)] || null;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // -----------------------------------------------------------------------
  // Barre d'outils
  // -----------------------------------------------------------------------
  function segments(hote, options, actifId, onChoix, estDesactive) {
    hote.innerHTML = "";
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.textContent = o.libelle;
      b.className = o.id === actifId ? "on" : "";
      if (estDesactive && estDesactive(o)) { b.disabled = true; b.title = estDesactive(o); }
      b.onclick = function () { onChoix(o.id); };
      hote.appendChild(b);
    });
  }

  function rendreBarre() {
    segments(document.getElementById("seg-variante"), VARIANTES, etat.variante, function (v) {
      etat.variante = v; if (v === "duo") etat.largeur = 375; rendre();
    }, function (o) {
      if (estExtra() && o.id !== "actuel") return "Cet etat n'existe que cote Home actuel.";
      return null;
    });

    segments(document.getElementById("seg-largeur"),
      M.largeurs.map(function (w) { return { id: String(w), libelle: w + " px" }; }),
      String(etat.largeur),
      function (v) { etat.largeur = Number(v); if (etat.largeur !== M.largeurEchelle) etat.x13 = false; rendre(); },
      function (o) {
        if (etat.variante === "duo" && Number(o.id) !== 375) return "Le cote a cote est fige a 375 px.";
        return null;
      });

    segments(document.getElementById("seg-vue"), VUES, etat.vue, function (v) { etat.vue = v; rendre(); });

    segments(document.getElementById("seg-echelle"),
      [{ id: "1", libelle: "x1" }, { id: "13", libelle: "x" + M.echelleTexte }],
      etat.x13 ? "13" : "1",
      function (v) { etat.x13 = v === "13"; rendre(); },
      function (o) {
        if (o.id === "13" && etat.largeur !== M.largeurEchelle) {
          return "La variante texte agrandi n'est generee qu'en " + M.largeurEchelle + " px.";
        }
        return null;
      });

    var btn = document.getElementById("btn-panneau");
    btn.textContent = etat.panneaux ? "Masquer les panneaux" : "Afficher les panneaux";
    btn.onclick = function () {
      etat.panneaux = !etat.panneaux;
      document.body.classList.toggle("sans-panneaux", !etat.panneaux);
      btn.textContent = etat.panneaux ? "Masquer les panneaux" : "Afficher les panneaux";
    };
  }

  // -----------------------------------------------------------------------
  // Liste laterale
  // -----------------------------------------------------------------------
  function rendreRail() {
    var rail = document.getElementById("rail");
    rail.innerHTML = "";
    M.groupes.forEach(function (g) {
      var h = document.createElement("div");
      h.className = "groupe";
      h.innerHTML = '<div class="t">' + esc(g.titre) + '</div><div class="a">' + esc(g.aide) + "</div>";
      rail.appendChild(h);
      g.etats.forEach(function (id) {
        var e = M.etats[id];
        if (!e) return;
        var b = document.createElement("button");
        b.className = "etat" + (id === etat.etatId ? " on" : "");
        var marque = "";
        if (e.actuel && e.actuel.qualite === "inexistant") {
          marque = '<span class="marque marque-inexistant">sans equivalent</span>';
        } else if (e.actuel && e.actuel.qualite === "approximatif") {
          marque = '<span class="marque marque-approximatif">approx.</span>';
        }
        b.innerHTML = esc(e.titre) + marque + '<span class="sous">' + esc(e.id) + "</span>";
        b.onclick = function () { etat.etatId = id; rendre(); };
        rail.appendChild(b);
      });
    });

    if (M.extras && M.extras.length) {
      var h2 = document.createElement("div");
      h2.className = "groupe";
      h2.innerHTML = '<div class="t">Home actuel seulement</div>' +
        '<div class="a">Etats du Home de production qui n\\'ont aucune contrepartie cote proposition.</div>';
      rail.appendChild(h2);
      M.extras.forEach(function (x) {
        var b = document.createElement("button");
        b.className = "etat" + (x.id === etat.etatId ? " on" : "");
        b.innerHTML = esc(x.titre) + '<span class="sous">' + esc(x.id) + "</span>";
        b.onclick = function () { etat.etatId = x.id; etat.variante = "actuel"; rendre(); };
        rail.appendChild(b);
      });
    }
  }

  // -----------------------------------------------------------------------
  // Scene
  // -----------------------------------------------------------------------
  function cadre(variante, w, hote) {
    var d = device(w);
    var src = pageDe(variante, w);
    var wrap = document.createElement("div");
    wrap.className = "cadre";
    wrap.style.width = w + "px";

    var titre = variante === "vnext" ? "Proposition vNext" : "Home actuel (production)";
    var tete = document.createElement("div");
    tete.className = "tete";
    tete.innerHTML = '<span class="puce puce-' + variante + '"></span>' + esc(titre) + " — " + w + " px" +
      (etat.x13 && w === M.largeurEchelle ? " — texte x" + M.echelleTexte : "");
    wrap.appendChild(tete);

    var porte = document.createElement("div");
    porte.className = "porte";
    porte.style.width = w + "px";
    porte.style.height = (etat.vue === "visible" ? d.screenHeight : 1) + "px";

    if (!src) {
      porte.style.height = "160px";
      porte.innerHTML = '<div style="padding:14px;font:12px/1.6 sans-serif;color:#5A1F1F">' +
        "Aucune page generee pour cette combinaison.</div>";
    } else {
      var f = document.createElement("iframe");
      f.src = src;
      f.style.width = w + "px";
      f.scrolling = "no";
      f.style.height = (etat.vue === "visible" ? d.screenHeight : 200) + "px";
      f.onload = function () {
        try {
          var doc = f.contentDocument;
          var stage = doc.querySelector(".stage");
          var dev = doc.querySelector(".device");
          var hStage = stage ? stage.offsetHeight : 0;
          if (etat.vue === "entiere") {
            f.style.height = (hStage + 4) + "px";
            porte.style.height = (hStage + 4) + "px";
          }
          mesurer(variante, w, dev ? dev.offsetHeight : 0, mesure);
        } catch (err) { /* meme origine attendue ; sinon on n'affiche pas de mesure */ }
      };
      porte.appendChild(f);
    }

    var coin = document.createElement("div");
    coin.className = "fictif-coin";
    coin.textContent = "FICTIF";
    porte.appendChild(coin);
    wrap.appendChild(porte);

    var mesure = document.createElement("div");
    mesure.className = "mesure";
    mesure.textContent = "mesure en cours…";
    wrap.appendChild(mesure);

    hote.appendChild(wrap);
  }

  // Mesure de la hauteur reelle du contenu. En vue « zone visible » le contenu
  // est coupe : on charge donc la page « entiere » dans une iframe cachee pour
  // savoir ce qui se trouve sous la ligne.
  var cacheMesures = {};
  function mesurer(variante, w, hauteurVue, sortie) {
    var d = device(w);
    var kEnt = variante + "|" + etat.etatId + "|" + w + "|" + (etat.x13 ? 1 : 0);
    function afficher(hContenu) {
      var reste = hContenu - d.stageVisible;
      var txt = "hauteur d'ecran <b>" + d.screenHeight + "</b> px · disponible pour l'ecran <b>" +
        d.stageVisible + "</b> px · lisible <b>" + d.readable + "</b> px<br>contenu mesure <b>" +
        hContenu + "</b> px — ";
      if (reste > 2) {
        txt += '<span class="reste-plus">il reste ' + reste + " px sous la ligne de flottaison (il faut defiler)</span>";
      } else if (reste < -2) {
        txt += '<span class="reste-moins">l\\'ecran s\\'arrete ' + (-reste) + " px AVANT la ligne : tout tient sans defiler</span>";
      } else {
        txt += '<span class="reste-moins">l\\'ecran finit pile a la ligne de flottaison</span>';
      }
      sortie.innerHTML = txt;
    }
    if (cacheMesures[kEnt] != null) { afficher(cacheMesures[kEnt]); return; }
    if (etat.vue === "entiere") { cacheMesures[kEnt] = hauteurVue; afficher(hauteurVue); return; }

    var e = courant();
    var bloc = variante === "vnext" ? e.vnext : e.actuel;
    var src = bloc && bloc.pages ? bloc.pages[w + (etat.x13 && w === M.largeurEchelle ? "-x13" : "") + "-entiere"] : null;
    if (!src) { sortie.textContent = "mesure indisponible"; return; }
    var m = document.getElementById("mesureur");
    m.onload = function () {
      try {
        var dev = m.contentDocument.querySelector(".device");
        var h = dev ? dev.offsetHeight : 0;
        cacheMesures[kEnt] = h;
        afficher(h);
      } catch (err) { sortie.textContent = "mesure impossible"; }
    };
    m.src = src;
  }

  function rendreScene() {
    var e = courant();
    document.getElementById("scene-titre").textContent = e ? e.titre : "—";
    document.getElementById("scene-resume").textContent = e ? e.resume : "";
    document.getElementById("bandeau-etat").textContent = e ? (e.titre + "  [" + e.id + "]") : "—";
    document.getElementById("bandeau-meta").textContent =
      "genere le " + (M.genereLe || "").slice(0, 16).replace("T", " ") +
      " · horloge fictive : " + M.horlogeFictive.texte;

    var alerte = document.getElementById("scene-alerte");
    alerte.innerHTML = "";

    // Alertes de generation : elles concernent TOUTE la planche, on les met en
    // premier et on ne les cache jamais derriere un onglet.
    (M.alertes || []).forEach(function (a) {
      alerte.innerHTML += '<div class="alerte alerte-orange"><span class="t">Alerte de generation</span>' +
        esc(a) + "</div>";
    });

    if (estExtra()) {
      alerte.innerHTML = '<div class="alerte alerte-orange"><span class="t">Etat du Home actuel uniquement</span>' +
        esc(e.pourquoi) + "</div>";
    } else {
      if (e.vnext && e.vnext.indisponible) {
        alerte.innerHTML += '<div class="alerte alerte-rouge"><span class="t">Proposition indisponible</span>' +
          esc(e.vnext.indisponible) + " — la colonne vNext affiche une page d'explication.</div>";
      }
      if ((etat.variante === "actuel" || etat.variante === "duo") && e.actuel && e.actuel.qualite !== "exact") {
        var cls = e.actuel.qualite === "inexistant" ? "alerte-rouge" : "alerte-orange";
        var t = e.actuel.qualite === "inexistant"
          ? "Le Home actuel n'a pas cet etat"
          : "Correspondance approximative";
        alerte.innerHTML += '<div class="alerte ' + cls + '"><span class="t">' + t + "</span>" +
          esc(e.actuel.ecart) + "</div>";
      }
    }

    var hote = document.getElementById("cadres");
    hote.innerHTML = "";
    if (etat.variante === "duo") {
      cadre("vnext", 375, hote);
      cadre("actuel", 375, hote);
    } else {
      cadre(etat.variante, etat.largeur, hote);
    }

    var d = device(etat.largeur);
    document.getElementById("scene-pied").innerHTML =
      "<b>Les reperes.</b> Le haut du cadre est le haut physique de l'ecran. Le trait gris pointille " +
      "marque la fin de la zone systeme (" + d.insetTop + " px). Le trait rouge est la ligne de flottaison : " +
      "en dessous, il faut defiler. Le rectangle du bas represente la barre d'onglets (" +
      d.tabBarContent + " px + " + d.insetBottom + " px d'inset). Calcul : " + esc(d.calcul) +
      "<br><b>Raccourcis.</b> Fleches haut / bas : changer d'etat. <code>v</code> : variante. " +
      "<code>e</code> : vue. <code>p</code> : panneaux.";
  }

  // -----------------------------------------------------------------------
  // Panneaux
  // -----------------------------------------------------------------------
  var ONGLETS = [
    { id: "points", libelle: "Points a valider" },
    { id: "seuils", libelle: "Seuils et limites" },
    { id: "etat", libelle: "Cet etat" },
    { id: "hauteurs", libelle: "Hauteurs" }
  ];

  function rendrePanneaux() {
    var o = document.getElementById("onglets");
    o.innerHTML = "";
    ONGLETS.forEach(function (t) {
      var b = document.createElement("button");
      b.textContent = t.libelle;
      b.className = t.id === etat.onglet ? "on" : "";
      b.onclick = function () { etat.onglet = t.id; rendre(); };
      o.appendChild(b);
    });

    var c = document.getElementById("panneau-contenu");
    if (etat.onglet === "points") c.innerHTML = htmlPoints();
    else if (etat.onglet === "seuils") c.innerHTML = htmlSeuils();
    else if (etat.onglet === "hauteurs") { c.innerHTML = htmlHauteursSquelette(); balayerHauteurs(); }
    else c.innerHTML = htmlEtat();

    Array.prototype.forEach.call(c.querySelectorAll("button[data-etat]"), function (b) {
      b.onclick = function () {
        etat.etatId = b.getAttribute("data-etat");
        rendre();
      };
    });
  }

  // -----------------------------------------------------------------------
  // Panneau « Hauteurs » : mesure TOUS les etats a la largeur courante, dans
  // le navigateur, et compare a la ligne de flottaison. C'est la reponse
  // chiffree aux points 3, 9 et 10 (ce qui tient sans defiler, la moitie basse,
  // la fin d'ecran).
  // -----------------------------------------------------------------------
  function htmlHauteursSquelette() {
    var d = device(etat.largeur);
    return '<div class="bloc-panneau"><h3>Hauteur de contenu — ' + etat.largeur + " px" +
      (etat.x13 ? " · texte x" + M.echelleTexte : "") + "</h3>" +
      '<p class="fin">Mesure faite dans le navigateur sur la vue « page entiere ». ' +
      "Ligne de flottaison a <b>" + d.stageVisible + " px</b> : au-dela, il faut defiler.</p>" +
      '<table class="tbl" id="tbl-hauteurs"><tr><th>Etat</th><th>vNext</th><th>Actuel</th></tr>' +
      '<tr><td colspan="3" class="vide">mesure en cours…</td></tr></table></div>';
  }

  var jetonBalayage = 0;
  function balayerHauteurs() {
    var monJeton = ++jetonBalayage;
    var d = device(etat.largeur);
    var suffixe = (etat.x13 && etat.largeur === M.largeurEchelle ? "-x13" : "") + "-entiere";
    var cadre = document.createElement("iframe");
    cadre.style.cssText = "position:absolute;left:-20000px;top:0;width:" + (etat.largeur + 40) +
      "px;height:12000px;border:0;visibility:hidden";
    document.body.appendChild(cadre);

    var lignes = [];
    var i = 0;
    var liste = M.ordreEtats.slice();

    function cellule(h) {
      if (h == null) return '<td class="num">—</td>';
      var reste = h - d.stageVisible;
      var couleur = reste > 2 ? "#FFB46B" : "#7BD6A6";
      return '<td class="num" style="color:' + couleur + '">' + h + " px<br><span style=\\"font-size:10px\\">" +
        (reste > 2 ? "+" + reste : reste < -2 ? reste : "pile") + "</span></td>";
    }

    function peindre() {
      if (monJeton !== jetonBalayage) return;
      var t = document.getElementById("tbl-hauteurs");
      if (!t) return;
      t.innerHTML = "<tr><th>Etat</th><th>vNext</th><th>Actuel</th></tr>" + lignes.join("");
    }

    function mesurerUn(src, apres) {
      if (!src) { apres(null); return; }
      cadre.onload = function () {
        try {
          var dev = cadre.contentDocument.querySelector(".device");
          apres(dev ? dev.offsetHeight : null);
        } catch (e) { apres(null); }
      };
      cadre.src = src;
    }

    function suivant() {
      if (monJeton !== jetonBalayage) { cadre.remove(); return; }
      if (i >= liste.length) { cadre.remove(); peindre(); return; }
      var id = liste[i];
      var e = M.etats[id];
      var srcV = e.vnext.pages[etat.largeur + suffixe];
      var srcA = e.actuel.pages[etat.largeur + suffixe];
      mesurerUn(srcV, function (hv) {
        mesurerUn(srcA, function (ha) {
          lignes.push("<tr><td>" + esc(e.titre) + "</td>" + cellule(hv) + cellule(ha) + "</tr>");
          peindre();
          i += 1;
          suivant();
        });
      });
    }
    suivant();
  }

  function htmlPoints() {
    var s = '<div class="bloc-panneau"><h3>Ce sur quoi tu dois te prononcer</h3>' +
      '<p class="fin">Douze points. Pour chacun : quoi regarder, dans quel etat, et ce qui vaut oui ou non. ' +
      'Les boutons basculent directement sur l\\'etat concerne.</p></div>';
    M.points.forEach(function (p, i) {
      var liens = p.etats.map(function (id) {
        var e = M.etats[id];
        return '<button data-etat="' + esc(id) + '">' + esc(e ? e.titre : id) + "</button>";
      }).join("");
      s += '<details class="point"' + (i === 0 ? " open" : "") + '><summary>' +
        (i + 1) + ". " + esc(p.titre) + "</summary><div class=\\"corps\\">" +
        '<div class="bloc"><span class="cle">Quoi regarder</span>' + esc(p.regarder) + "</div>" +
        '<div class="bloc"><span class="cle">Ce qui vaut oui, ce qui vaut non</span>' + esc(p.tranche) + "</div>" +
        '<div class="bloc"><span class="cle">Ou le regarder</span><div class="liens">' + liens + "</div></div>" +
        "</div></details>";
    });
    return s;
  }

  function htmlSeuils() {
    var e = courant();
    var s = "";

    // avertissements du prototype pour l'etat courant
    s += '<div class="bloc-panneau"><h3>Avertissements du prototype — etat courant</h3>';
    var w = (!estExtra() && e.vnext && e.vnext.protoWarnings) || [];
    if (!w.length) {
      s += '<p class="vide">Aucun avertissement pour cet etat.</p>';
    } else {
      w.forEach(function (x) {
        s += '<div class="avertissement"><span class="t">a savoir</span>' + esc(x) + "</div>";
      });
    }
    s += '<p class="fin">Ces avertissements viennent du selecteur du prototype. Ils vivent ICI, ' +
      'jamais dans l\\'ecran produit : le joueur ne doit pas lire les notes de chantier.</p></div>';

    // seuils d'affichage
    s += '<div class="bloc-panneau"><h3>Seuils d\\'affichage — a valider par le fondateur</h3>' +
      '<table class="tbl"><tr><th>Seuil</th><th>Valeur</th><th>Role</th></tr>';
    (M.seuils || []).forEach(function (x) {
      s += "<tr><td class=\\"num\\">" + esc(x.nom) + '</td><td class="num">' + esc(x.valeur) +
        "</td><td>" + esc(x.role) + "</td></tr>";
    });
    s += "</table><p class=\\"fin\\">Aucun de ces seuils ne touche a une seance, une charge ou une " +
      "intensite. Ils decident seulement de ce que l\\'ECRAN a le droit de MONTRER quand la donnee " +
      "est maigre.</p></div>";

    // contrastes
    s += '<div class="bloc-panneau"><h3>Contraste — seuil AA ' + esc(M.seuilContrasteAA) + ':1</h3>' +
      '<table class="tbl"><tr><th>Usage</th><th>Avant</th><th>Apres</th></tr>';
    (M.contrastes || []).forEach(function (c) {
      s += "<tr><td>" + esc(c.usage) + '</td><td class="num">' + esc(c.avant.ratio) + " " +
        (c.avant.conforme ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-ko">non</span>') +
        '</td><td class="num">' + esc(c.apres.ratio) + " " +
        (c.apres.conforme ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-ko">non</span>') +
        "</td></tr>";
    });
    s += "</table>";
    if (M.couleurAction) {
      s += '<p class="fin">Orange d\\'action propose : <b style="color:' + esc(M.couleurAction) + '">' +
        esc(M.couleurAction) + "</b>. Zone tactile minimale : " + esc(M.tailleTactileMin) + " pt.</p>";
    }
    s += "</div>";

    // regles de rendu
    if (M.reglesDeRendu && M.reglesDeRendu.length) {
      s += '<div class="bloc-panneau"><h3>Regles de rendu du prototype</h3><table class="tbl">';
      M.reglesDeRendu.forEach(function (r) { s += "<tr><td>" + esc(r) + "</td></tr>"; });
      s += "</table></div>";
    }

    // ce que le harnais ne reproduit pas
    s += '<div class="bloc-panneau"><h3>Ce que le harnais ne reproduit pas</h3><table class="tbl">';
    (M.limites || []).forEach(function (l) {
      s += "<tr><td><b>" + esc(l.quoi) + "</b><br>" + esc(l.detail) + "</td></tr>";
    });
    s += "</table></div>";

    // stubs
    s += '<div class="bloc-panneau"><h3>Modules remplaces</h3><table class="tbl">' +
      "<tr><th>Module</th><th>Remplace par</th><th>Fidele ?</th></tr>";
    (M.stubs || []).forEach(function (x) {
      s += "<tr><td class=\\"num\\">" + esc(x.module) + "</td><td>" + esc(x.remplace) + "</td><td>" +
        (x.fidele ? '<span class="badge badge-ok">oui</span>' : '<span class="badge badge-ko">non</span>') +
        "<br><span style=\\"color:#8DA0BC\\">" + esc(x.note) + "</span></td></tr>";
    });
    s += "</table></div>";

    if (M.alertes && M.alertes.length) {
      s += '<div class="bloc-panneau"><h3>Alertes de generation</h3>';
      M.alertes.forEach(function (a) { s += '<div class="avertissement">' + esc(a) + "</div>"; });
      s += "</div>";
    }
    return s;
  }

  function htmlEtat() {
    var e = courant();
    if (!e) return '<p class="vide">Aucun etat selectionne.</p>';
    if (estExtra()) {
      return '<div class="bloc-panneau"><h3>' + esc(e.titre) + "</h3><p>" + esc(e.resume) + "</p>" +
        '<p class="fin">' + esc(e.pourquoi) + "</p></div>";
    }
    var s = '<div class="bloc-panneau"><h3>Donnees fictives</h3><p class="fin">' + esc(e.resume) +
      "</p></div>";

    var vm = e.vnext && e.vnext.viewModel;
    s += '<div class="bloc-panneau"><h3>Ce que le contrat decide pour cet etat</h3>';
    if (!vm) {
      s += '<p class="vide">Selecteur indisponible.</p>';
    } else {
      s += '<dl class="kv">' +
        "<dt>action principale</dt><dd>" + esc(vm.action ? vm.action.libelle : "—") +
        (vm.action && vm.action.sousLibelle ? "<br><span style=\\"color:#8DA0BC\\">" + esc(vm.action.sousLibelle) + "</span>" : "") +
        (vm.action && vm.action.secondaire ? "<br>action secondaire : " + esc(vm.action.secondaire) : "") + "</dd>" +
        "<dt>pourquoi</dt><dd>" + (vm.pourquoi ? esc(vm.pourquoi.texte) + ' <span style="color:#8DA0BC">(' + esc(vm.pourquoi.source) + ")</span>" : "<i>aucune ligne</i>") + "</dd>" +
        "<dt>cycle</dt><dd>" + (vm.cycle ? esc(vm.cycle.libelle) + " (" + esc(vm.cycle.nature) + ")" : "<i>aucun</i>") + "</dd>" +
        "<dt>ma semaine</dt><dd>" + (vm.semaine ? esc(vm.semaine) : "<i>aucun bloc</i>") + "</dd>" +
        "<dt>ma forme</dt><dd>" + esc(vm.forme) + "</dd>" +
        "<dt>conseil</dt><dd>" + (vm.conseil ? esc(vm.conseil) : "<i>aucun — supprime</i>") + "</dd>" +
        "<dt>pastille d'etat</dt><dd>" + (vm.pastilleEtat ? esc(vm.pastilleEtat) : "<i>aucune</i>") + "</dd>" +
        "<dt>lien de sortie</dt><dd>" + (vm.sortie ? esc(vm.sortie) : "<i>aucun</i>") + "</dd>" +
        "<dt>etat des donnees</dt><dd>" + esc(vm.etatDesDonnees) +
        (vm.avisDonnees ? " — " + esc(vm.avisDonnees) : "") + "</dd>" +
        "</dl>";
    }
    s += "</div>";

    s += '<div class="bloc-panneau"><h3>Correspondance cote Home actuel</h3>';
    if (!e.actuel || !e.actuel.scenarioId) {
      s += '<p class="vide">Aucune correspondance definie.</p>';
    } else {
      s += "<p><b>" + esc(e.actuel.scenarioTitre) + "</b> <span style=\\"color:#8DA0BC\\">(" +
        esc(e.actuel.scenarioId) + ")</span></p><p class=\\"fin\\">" + esc(e.actuel.scenarioResume) + "</p>";
      if (e.actuel.derive) {
        s += '<p class="fin">Scenario derive de <b>' + esc(e.actuel.derive) + "</b>, ajoute par le prototype.</p>";
      }
      if (e.actuel.qualite === "exact") {
        s += '<p class="fin"><span class="badge badge-ok">correspondance exacte</span></p>';
      } else {
        s += '<div class="avertissement"><span class="t">' +
          (e.actuel.qualite === "inexistant" ? "sans equivalent" : "approximatif") + "</span>" +
          esc(e.actuel.ecart) + "</div>";
      }
    }
    s += "</div>";

    if (e.vnext && e.vnext.sonde) {
      s += '<div class="bloc-panneau"><h3>Sonde de rendu (375 px)</h3><p class="fin">' +
        "Blocs de premier niveau : <b>" + esc(e.vnext.sonde.blocs.length) + "</b> · conteneurs de mise en page traverses : <b>" +
        esc(e.vnext.sonde.chainLength) + "</b> · noeuds qui se mesurent : <b>" +
        esc(e.vnext.sonde.noeudsMesures) + "</b>.</p>";
      if (e.vnext.sonde.erreurs && e.vnext.sonde.erreurs.length) {
        e.vnext.sonde.erreurs.forEach(function (x) {
          s += '<div class="avertissement"><span class="t">erreur de rendu</span>' + esc(String(x).slice(0, 400)) + "</div>";
        });
      }
      s += "</div>";
    }
    return s;
  }

  // -----------------------------------------------------------------------
  function rendre() {
    if (estExtra() && etat.variante !== "actuel") etat.variante = "actuel";
    if (etat.variante === "duo") etat.largeur = 375;
    if (etat.largeur !== M.largeurEchelle) etat.x13 = false;
    rendreBarre();
    rendreRail();
    rendreScene();
    rendrePanneaux();
    ecrireHash();
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
    var liste = M.ordreEtats.concat(M.extras.map(function (x) { return x.id; }));
    var i = liste.indexOf(etat.etatId);
    if (ev.key === "ArrowDown") { etat.etatId = liste[(i + 1) % liste.length]; rendre(); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { etat.etatId = liste[(i - 1 + liste.length) % liste.length]; rendre(); ev.preventDefault(); }
    else if (ev.key === "v") {
      var ordre = ["vnext", "actuel", "duo"];
      etat.variante = ordre[(ordre.indexOf(etat.variante) + 1) % 3];
      rendre();
    } else if (ev.key === "e") { etat.vue = etat.vue === "visible" ? "entiere" : "visible"; rendre(); }
    else if (ev.key === "p") { document.getElementById("btn-panneau").click(); }
  });

  window.addEventListener("hashchange", function () { lireHash(); rendre(); });

  lireHash();
  rendre();
})();
`;
}

module.exports = { viewerHtml, viewerCss, viewerJs };
