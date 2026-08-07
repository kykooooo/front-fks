// prototype/profil/lib/viewerTemplate.js
// =============================================================================
// LE VISUALISEUR DU PROFIL
// =============================================================================
// La page que le fondateur ouvre. Trois principes :
//
//   1. L'OUTIL NE RESSEMBLE PAS AU PRODUIT : fond sombre, police differente,
//      libelles en petites capitales. On ne confond pas le harnais et l'app.
//   2. L'ECRAN PRODUIT VIT DANS UNE IFRAME, a la largeur exacte demandee, avec
//      ses reperes (ligne de flottaison rouge, zone systeme, barre d'onglets) —
//      dessines par la page elle-meme (lib/pageTemplate.js, calcul de zone
//      visible de lib/devices.js).
//   3. TOUT LE COMMENTAIRE (decisions, protoWarnings, limites) VIT HORS DE
//      L'ECRAN, dans un panneau a onglets. Les protoWarnings n'apparaissent
//      JAMAIS dans l'ecran produit.
//
// Le visualiseur lit TOUT depuis manifest.js : etats, variantes, largeurs,
// vues, decisions, seuils, limites. Rien n'est recopie du contrat ici.
// Une page absente affiche un cadre d'explication — jamais une autre page.
// =============================================================================
"use strict";

/** @param {string} version marque de fraicheur (cache navigateur). */
function viewerHtml(version) {
  const v = encodeURIComponent(version || "0");
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FKS — prototype Profil vNext — visualiseur</title>
<link rel="stylesheet" href="viewer.css?v=${v}">
</head><body>

<div id="bandeau">
  <span class="pastille">Données fictives</span>
  <b>PROTOTYPE PROFIL — NON CONNECTÉ</b>
  <span class="sep">·</span>
  <span id="bandeau-etat">—</span>
  <span class="droite" id="bandeau-meta"></span>
</div>

<div id="barre">
  <div class="grp"><span class="lab">Variante</span><div class="seg" id="seg-variante"></div></div>
  <div class="grp"><span class="lab">Largeur</span><div class="seg" id="seg-largeur"></div></div>
  <div class="grp"><span class="lab">Vue</span><div class="seg" id="seg-vue"></div></div>
  <div class="grp"><span class="lab">Texte</span><div class="seg" id="seg-texte"></div></div>
  <div class="grp" id="grp-accents"><span class="lab">Accents</span><div class="seg" id="seg-accents"></div></div>
  <div class="grp droite">
    <span class="lab" id="raccourcis">↑↓ état · v variante · w largeur · e vue · t texte · c accents</span>
  </div>
</div>

<div id="corps">
  <nav id="rail" aria-label="États"></nav>
  <main id="scene">
    <div id="scene-titre">—</div>
    <div id="scene-resume"></div>
    <div id="scene-alertes"></div>
    <div id="cadres"></div>
  </main>
  <aside id="panneaux">
    <div class="onglets" id="onglets"></div>
    <div class="contenu" id="panneau-contenu"></div>
  </aside>
</div>

<script src="manifest.js?v=${v}"></script>
<script src="viewer.js?v=${v}"></script>
</body></html>`;
}

function viewerCss() {
  return `/* Habillage du visualiseur — volontairement TRES different du produit. */
:root {
  --fond: #0B0F17; --fond-2: #111826; --fond-3: #192336; --bord: #263349;
  --texte: #E2EAF6; --texte-2: #93A5C0; --actif: #4C8DFF; --alerte: #8C1D1D;
  --avert: #B4530C; --ok: #2E7D5B; --reco: #C9A227;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sans: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--fond); color: var(--texte); font-family: var(--sans); }
body { display: flex; flex-direction: column; overflow: hidden; }

/* --- bandeau permanent --------------------------------------------------- */
#bandeau {
  flex: 0 0 auto; background: linear-gradient(90deg, var(--alerte), #6E1717); color: #fff;
  padding: 6px 14px; font-family: var(--mono); font-size: 11px; letter-spacing: .4px;
  display: flex; align-items: center; gap: 9px;
}
#bandeau .pastille {
  background: #fff; color: var(--alerte); font-weight: 800; text-transform: uppercase;
  padding: 2px 6px; border-radius: 999px; font-size: 9.5px;
}
#bandeau .sep { opacity: .5; }
#bandeau .droite { margin-left: auto; opacity: .8; font-size: 10.5px; }

/* --- barre d'outils ------------------------------------------------------ */
#barre {
  flex: 0 0 auto; background: var(--fond-2); border-bottom: 1px solid var(--bord);
  padding: 9px 16px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
}
#barre .grp { display: flex; align-items: center; gap: 9px; }
#barre .grp.droite { margin-left: auto; }
#barre .lab {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1.1px; text-transform: uppercase;
  color: var(--texte-2);
}
.seg { display: flex; background: #0D1420; border: 1px solid var(--bord); border-radius: 999px; padding: 2px; gap: 2px; }
.seg button {
  background: transparent; color: var(--texte-2); border: 0; border-radius: 999px;
  padding: 5px 12px; font-family: var(--mono); font-size: 11px; cursor: pointer; white-space: nowrap;
  transition: background .12s ease, color .12s ease;
}
.seg button:hover:not(:disabled):not(.on) { background: #1C2839; color: var(--texte); }
.seg button.on { background: var(--actif); color: #06101F; font-weight: 700; }
.seg button:disabled { opacity: .35; cursor: not-allowed; }

/* --- corps --------------------------------------------------------------- */
#corps { flex: 1 1 auto; display: flex; min-height: 0; }

#rail {
  flex: 0 0 258px; background: var(--fond-2); border-right: 1px solid var(--bord);
  overflow-y: auto; padding: 12px 0 40px;
}
#rail .entete { padding: 4px 16px 8px; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 1.2px; text-transform: uppercase; color: var(--actif); }
#rail button.etat {
  display: block; width: calc(100% - 12px); margin: 1px 6px; text-align: left; background: transparent;
  border: 0; border-radius: 8px; color: var(--texte); padding: 8px 10px;
  cursor: pointer; font-size: 12.5px; line-height: 1.35;
  transition: background .12s ease;
}
#rail button.etat:hover { background: var(--fond-3); }
#rail button.etat.on { background: var(--fond-3); box-shadow: inset 3px 0 0 var(--actif); font-weight: 700; }
#rail button.etat .sous { display: block; font-family: var(--mono); font-size: 9.5px; color: var(--texte-2); margin-top: 2px; font-weight: 400; }

#scene {
  flex: 1 1 auto; overflow: auto; padding: 14px 20px 30px; min-width: 0;
  background: radial-gradient(1100px 500px at 50% -80px, #141D2E 0%, var(--fond) 60%);
}
#scene-titre { font-size: 16px; font-weight: 700; }
#scene-resume { font-size: 12.5px; color: var(--texte-2); margin-top: 3px; line-height: 1.5; max-width: 900px; }
#scene-alertes { margin-top: 9px; max-width: 900px; }
#scene-alertes .alerte {
  background: #3A1A16; border: 1px solid #6B2B22; color: #FFD8CF; border-radius: 8px;
  padding: 8px 11px; font-size: 12px; line-height: 1.5; margin-bottom: 6px;
}
#cadres { display: flex; gap: 34px; align-items: flex-start; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
.cadre { flex: 0 0 auto; }
.cadre .titre-cadre {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .8px; text-transform: uppercase;
  color: var(--texte-2); margin-bottom: 8px; text-align: center;
}
.cadre .titre-cadre b { color: var(--texte); }

/* Le chassis du telephone : lunette sombre arrondie, encoche, ombre portee.
   L'iframe garde la TAILLE LOGIQUE exacte (largeur d'appareil) ; c'est le
   chassis entier qui est mis a l'echelle pour tenir dans la fenetre —
   .fit recoit un transform scale() calcule par le script, et le conteneur
   .viewport reserve exactement la place a l'echelle. */
.cadre .viewport { position: relative; overflow: hidden; }
/* inline-block : le chassis prend sa taille INTRINSEQUE (celle de l'iframe),
   jamais celle du conteneur — sinon la mesure d'echelle se mord la queue
   (viewport reduit -> chassis reduit -> echelle fausse). */
.cadre .fit { transform-origin: top left; display: inline-block; }
.cadre .shell {
  position: relative; display: inline-block; padding: 12px; background: #05070C;
  border: 1px solid #2A3548; border-radius: 40px;
  box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.4);
}
.cadre .shell .encoche {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 32%; height: 13px; background: #05070C; z-index: 5;
  border-radius: 0 0 12px 12px; pointer-events: none;
}
.cadre iframe { border: 0; border-radius: 28px; background: #F5F7FA; display: block; }
.cadre .sous-cadre {
  font-family: var(--mono); font-size: 10px; color: var(--texte-2); margin-top: 10px;
  max-width: 430px; line-height: 1.55; text-align: center; margin-left: auto; margin-right: auto;
}
.cadre .mesure { color: var(--texte); }
.cadre-absent {
  border: 1px dashed #6B2B22; border-radius: 10px; background: #1C1210; color: #FFD8CF;
  padding: 16px 14px; font-size: 12px; line-height: 1.6;
}
.cadre-absent b { display: block; color: #FF9E8C; margin-bottom: 6px; }

#panneaux {
  flex: 0 0 372px; background: var(--fond-2); border-left: 1px solid var(--bord);
  display: flex; flex-direction: column; min-height: 0;
}
#panneaux .onglets { flex: 0 0 auto; display: flex; border-bottom: 1px solid var(--bord); }
#panneaux .onglets button {
  flex: 1 1 auto; background: transparent; border: 0; border-bottom: 2px solid transparent;
  color: var(--texte-2); padding: 10px 6px; font-family: var(--mono); font-size: 10.5px;
  letter-spacing: .8px; text-transform: uppercase; cursor: pointer;
}
#panneaux .onglets button.on { color: var(--texte); border-bottom-color: var(--actif); }
#panneaux .contenu { flex: 1 1 auto; overflow-y: auto; padding: 14px; font-size: 12.5px; line-height: 1.55; }

.carte-p { background: var(--fond-3); border: 1px solid var(--bord); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.carte-p h3 { margin: 0 0 6px; font-size: 13px; }
.carte-p .q { color: var(--texte-2); font-size: 12px; margin-bottom: 8px; }
.carte-p .opt { border-left: 3px solid var(--bord); padding: 6px 9px; margin: 6px 0; font-size: 12px; }
.carte-p .opt.reco { border-left-color: var(--reco); }
.carte-p .opt .lib { font-weight: 700; }
.carte-p .opt .lib .badge-reco {
  font-family: var(--mono); font-size: 9px; letter-spacing: .6px; text-transform: uppercase;
  background: var(--reco); color: #17110A; border-radius: 3px; padding: 1px 5px; margin-left: 6px;
}
.carte-p .opt .csq { color: var(--texte-2); margin-top: 2px; }
.carte-p .cout { font-size: 11.5px; color: var(--texte-2); border-top: 1px solid var(--bord); margin-top: 8px; padding-top: 7px; }
.carte-p .actions { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.carte-p .actions button {
  background: var(--fond-2); color: var(--texte); border: 1px solid var(--bord); border-radius: 5px;
  padding: 5px 9px; font-family: var(--mono); font-size: 10.5px; cursor: pointer;
}
.carte-p .actions button:hover { border-color: var(--actif); }
.carte-p .actions button.on { background: var(--actif); color: #06101F; border-color: var(--actif); }

.pan-titre { font-family: var(--mono); font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; color: var(--actif); margin: 14px 0 6px; }
.pan-titre:first-child { margin-top: 0; }
.avert { background: #2A1F10; border: 1px solid #4A3410; color: #FFD79B; border-radius: 6px; padding: 7px 10px; font-size: 11.5px; margin: 4px 0; }
.ok { color: #9CD4B5; }
ul.liste { margin: 4px 0; padding-left: 18px; }
ul.liste li { margin: 4px 0; color: var(--texte-2); }
ul.liste li b { color: var(--texte); }
code { background: #0A0F16; border: 1px solid var(--bord); border-radius: 3px; padding: 0 4px; font-size: 11px; }
.mono { font-family: var(--mono); font-size: 11px; }
`;
}

function viewerJs() {
  return `"use strict";
/* Le visualiseur lit TOUT depuis window.__FKS_MANIFEST__ (manifest.js). */
(function () {
  var M = window.__FKS_MANIFEST__;
  if (!M) { document.body.textContent = "manifest.js absent — lance node prototype/profil/build.js"; return; }

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var $ = function (id) { return document.getElementById(id); };

  // Les 4 valeurs de la bascule variante : les 2 variantes du contrat + le
  // Profil actuel + le cote a cote (vNext informe a gauche, actuel a droite).
  var VARIANTES_UI = M.variantes.map(function (v) { return { id: v.id, libelle: v.libelle }; })
    .concat([{ id: "actuel", libelle: "Profil actuel" }, { id: "duo", libelle: "Côte à côte" }]);
  var VUES = M.vues || ["visible", "entiere"];

  // L'axe accents (D7) : liste et defaut lus dans le manifeste (qui les lit
  // dans le produit). Sans axe (module illisible au build), la bascule n'a
  // qu'un choix et reste inerte.
  var ACCENTS = M.accents || [];
  var ACCENTS_DEFAUT = M.accentsParDefaut || "sobre";
  var libelleAccent = function (id) {
    if (M.accentsLibelles && M.accentsLibelles[id]) return M.accentsLibelles[id];
    for (var i = 0; i < ACCENTS.length; i += 1) if (ACCENTS[i].id === id) return ACCENTS[i].libelle;
    return id;
  };

  // --- etat courant + hash ------------------------------------------------
  var S = {
    etat: M.ordreEtats[0],
    variante: M.varianteParDefaut || "informe",
    w: 375,
    vue: "visible",
    x13: 0,
    acc: ACCENTS_DEFAUT,
    onglet: "decisions",
  };
  function lireHash() {
    var h = location.hash.replace(/^#/, "");
    h.split("&").forEach(function (kv) {
      var p = kv.split("="); if (p.length !== 2) return;
      var k = decodeURIComponent(p[0]), val = decodeURIComponent(p[1]);
      if (k === "etat" && M.etats[val]) S.etat = val;
      if (k === "var" && VARIANTES_UI.some(function (v) { return v.id === val; })) S.variante = val;
      if (k === "w" && M.largeurs.indexOf(Number(val)) !== -1) S.w = Number(val);
      if (k === "vue" && VUES.indexOf(val) !== -1) S.vue = val;
      if (k === "x13") S.x13 = val === "1" ? 1 : 0;
      if (k === "acc" && ACCENTS.some(function (a) { return a.id === val; })) S.acc = val;
      if (k === "onglet" && ["decisions", "etat", "limites"].indexOf(val) !== -1) S.onglet = val;
    });
    if (S.w !== M.largeurEchelle) S.x13 = 0;
  }
  function ecrireHash() {
    var h = "etat=" + S.etat + "&var=" + S.variante + "&w=" + S.w + "&vue=" + S.vue +
      "&x13=" + S.x13 + "&acc=" + S.acc + "&onglet=" + S.onglet;
    if ("#" + h !== location.hash) history.replaceState(null, "", "#" + h);
  }

  // --- mesures en direct (jsdom ne mesure pas ; ici, si) -------------------
  var mesures = {}; // rel -> { contenu, note }

  function deviceDe(w) {
    for (var i = 0; i < M.devices.length; i += 1) if (M.devices[i].width === w) return M.devices[i];
    return null;
  }
  function cleDePage() { return String(S.w) + (S.x13 ? "-x13" : "") + "-" + S.vue; }

  function pagesDe(varianteId) {
    var e = M.etats[S.etat];
    if (!e) return null;
    // Le Profil actuel a son propre style : l'axe accents ne s'y applique pas.
    if (varianteId === "actuel") return e.actuel ? e.actuel.pages : null;
    var bloc = e.vnext && e.vnext[varianteId];
    if (!bloc) return null;
    if (S.acc !== ACCENTS_DEFAUT) {
      // Table separee : une page accents absente rend null — le cadre explique,
      // il ne sert JAMAIS la page sobre sous l'etiquette « Coloré ».
      return (bloc.pagesAccents && bloc.pagesAccents[S.acc]) || null;
    }
    return bloc.pages;
  }

  // --- rendu de la barre ---------------------------------------------------
  function seg(el, items, courant, surClic) {
    el.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.textContent = it.libelle;
      if (it.title) b.title = it.title;
      if (it.disabled) b.disabled = true;
      if (it.id === courant) b.className = "on";
      b.addEventListener("click", function () { surClic(it.id); });
      el.appendChild(b);
    });
  }

  function rendreBarre() {
    seg($("seg-variante"), VARIANTES_UI, S.variante, function (id) { S.variante = id; rendre(); });
    seg($("seg-largeur"), M.largeurs.map(function (w) { return { id: w, libelle: w + " px" }; }),
      S.w, function (id) { S.w = id; if (S.w !== M.largeurEchelle) S.x13 = 0; rendre(); });
    seg($("seg-vue"), [
      { id: "visible", libelle: "zone visible" },
      { id: "entiere", libelle: "page entière" },
    ], S.vue, function (id) { S.vue = id; rendre(); });
    var x13Dispo = S.w === M.largeurEchelle;
    seg($("seg-texte"), [
      { id: 0, libelle: "×1" },
      {
        id: 1, libelle: "×1,3", disabled: !x13Dispo,
        title: x13Dispo
          ? "Simulation : tailles de police et interlignes multipliés (pas le vrai Dynamic Type)"
          : "Généré en " + M.largeurEchelle + " px uniquement — passe la largeur à " + M.largeurEchelle + " pour comparer le texte agrandi",
      },
    ], S.x13, function (id) { if (id === 0 || x13Dispo) { S.x13 = id; rendre(); } });

    // Accents (D7). Desactive sur « Profil actuel » : la production a son
    // propre style, l'axe n'existe que sur le Profil vNext. En côte à côte,
    // seule la colonne vNext change.
    var accActif = S.variante !== "actuel";
    seg($("seg-accents"), ACCENTS.map(function (a) {
      return {
        id: a.id,
        libelle: libelleAccent(a.id),
        disabled: !accActif,
        title: accActif
          ? a.description || ""
          : "Le Profil actuel (production) a son propre style — l'axe accents ne s'applique qu'au Profil vNext",
      };
    }), S.acc, function (id) { if (accActif) { S.acc = id; rendre(); } });
    $("grp-accents").style.display = ACCENTS.length > 1 ? "" : "none";
  }

  // --- rail ----------------------------------------------------------------
  function rendreRail() {
    var rail = $("rail");
    rail.innerHTML = '<div class="entete">Les 7 états</div>';
    M.ordreEtats.forEach(function (id) {
      var e = M.etats[id];
      var b = document.createElement("button");
      b.className = "etat" + (id === S.etat ? " on" : "");
      b.title = e.description;
      b.innerHTML = esc(e.titre) + '<span class="sous">' + esc(id) + "</span>";
      b.addEventListener("click", function () { S.etat = id; rendre(); });
      rail.appendChild(b);
    });
  }

  // --- cadres --------------------------------------------------------------
  function nomVariante(id) {
    for (var i = 0; i < VARIANTES_UI.length; i += 1) if (VARIANTES_UI[i].id === id) return VARIANTES_UI[i].libelle;
    return id;
  }

  function cadreHtml(varianteId) {
    var pages = pagesDe(varianteId);
    var cle = cleDePage();
    var rel = pages ? pages[cle] : null;
    var d = deviceDe(S.w);
    var accentVisible = varianteId !== "actuel" && S.acc !== ACCENTS_DEFAUT;
    var t = '<div class="titre-cadre"><b>' + esc(nomVariante(varianteId)) + "</b> · " + S.w +
      " px · " + (S.vue === "visible" ? "zone visible" : "page entière") + (S.x13 ? " · ×1,3" : "") +
      (accentVisible ? " · accents " + esc(libelleAccent(S.acc)) : "") + "</div>";
    if (!rel) {
      return '<div class="cadre" style="width:' + Math.max(S.w, 340) + 'px">' + t +
        '<div class="cadre-absent"><b>Page non générée</b>' +
        "Aucune page pour l’état <code>" + esc(S.etat) + "</code> en " + S.w + " px, vue « " + esc(S.vue) + " »" +
        (S.x13 ? ", texte ×1,3" : "") +
        (accentVisible ? ", accents « " + esc(libelleAccent(S.acc)) + " »" : "") + ".<br>" +
        "Génération partielle probable (FKS_ETATS / FKS_LARGEURS), ou axe accents absent au " +
        "moment du build — relance <code>node prototype/profil/build.js</code> sans filtre. " +
        "Le visualiseur n’affiche jamais une autre page à la place.</div></div>";
    }
    var m = mesures[rel];
    var mesureTxt;
    if (S.vue === "entiere") {
      mesureTxt = m
        ? '<span class="mesure">hauteur de page mesurée : ' + m.contenu + " px · sous la ligne de flottaison : " +
          Math.max(0, m.contenu - (d ? d.stageVisible : 0)) + " px</span>"
        : "mesure en cours…";
    } else {
      mesureTxt = "ce qui touche la ligne rouge continue sous la barre d'onglets : sur le téléphone, ça défile. " +
        "Vue « page entière » (touche e) pour tout voir et mesurer";
    }
    return '<div class="cadre"><a href="' + esc(rel) + '" target="_blank" style="text-decoration:none">' + t + "</a>" +
      '<div class="viewport"><div class="fit"><div class="shell"><div class="encoche"></div>' +
      '<iframe src="' + esc(rel) + '" data-rel="' + esc(rel) + '" width="' + S.w +
      '" height="' + (d ? d.screenHeight : 800) + '" scrolling="no" title="' + esc(nomVariante(varianteId)) + '"></iframe>' +
      "</div></div></div>" +
      '<div class="sous-cadre"><span class="echelle-txt"></span>' + mesureTxt + (d ? "<br>" + esc(d.calcul) : "") + "</div></div>";
  }

  function brancherMesures() {
    Array.prototype.forEach.call(document.querySelectorAll("#cadres iframe"), function (f) {
      f.addEventListener("load", function () {
        try {
          var doc = f.contentDocument;
          var stage = doc.querySelector("[data-fks-stage]");
          var contenu = stage ? stage.scrollHeight : doc.body.scrollHeight;
          // L'iframe s'arrete au CADRE du telephone (le stage) : le bloc
          // d'identification sous le cadre appartient a la page ouverte seule,
          // pas au visualiseur (le panneau « Cet etat » porte deja tout ca).
          if (S.vue === "entiere") {
            f.style.height = (stage ? stage.offsetHeight : doc.body.scrollHeight) + "px";
          }
          mesures[f.getAttribute("data-rel")] = { contenu: contenu };
          ajusterEchelles();
          rendreSousCadres();
          if (S.onglet === "etat") rendrePanneau();
        } catch (_) { /* iframe inaccessible : on n'affiche pas de fausse mesure */ }
      });
    });
  }

  // --- mise a l'echelle : TOUT le telephone tient dans la fenetre -----------
  // En vue « zone visible » (la vue de jugement), le chassis entier est reduit
  // pour tenir dans la scene : plus jamais un bas d'ecran coupe par la fenetre.
  // En vue « page entiere » (exploration), on ne reduit que si la LARGEUR
  // deborde — la hauteur se parcourt au defilement, c'est son role.
  function ajusterEchelles() {
    var scene = $("scene");
    var cadres = document.querySelectorAll("#cadres .cadre");
    if (!cadres.length) return;
    // Hauteur disponible pour le chassis : la scene moins l'en-tete de scene
    // (titre + resume + alertes) et le titre/sous-titre du cadre (~110 px).
    var enTete = $("scene-titre").offsetHeight + $("scene-resume").offsetHeight +
      $("scene-alertes").offsetHeight;
    var dispoH = Math.max(260, scene.clientHeight - enTete - 168);
    var nb = cadres.length;
    var dispoW = Math.max(300, (scene.clientWidth - 40 - (nb - 1) * 34) / nb);
    Array.prototype.forEach.call(cadres, function (c) {
      var fit = c.querySelector(".fit");
      var shell = c.querySelector(".shell");
      var viewport = c.querySelector(".viewport");
      var echelleTxt = c.querySelector(".echelle-txt");
      if (!fit || !shell || !viewport) return;
      var w = shell.offsetWidth;
      var h = shell.offsetHeight;
      if (!w || !h) return;
      var s = Math.min(1, dispoW / w);
      if (S.vue === "visible") s = Math.min(s, dispoH / h);
      s = Math.max(s, 0.3);
      fit.style.transform = "scale(" + s + ")";
      viewport.style.width = Math.round(w * s) + "px";
      viewport.style.height = Math.round(h * s) + "px";
      if (echelleTxt) {
        echelleTxt.textContent = s < 0.995
          ? "affiché à " + Math.round(s * 100) + " % — les mesures restent en pixels logiques · "
          : "";
      }
    });
  }
  window.addEventListener("resize", ajusterEchelles);

  function rendreSousCadres() {
    // Re-rend uniquement les textes de mesure, sans recharger les iframes ni
    // perdre l'indication d'echelle (reposee ensuite par ajusterEchelles).
    var d = deviceDe(S.w);
    Array.prototype.forEach.call(document.querySelectorAll("#cadres .cadre"), function (c) {
      var f = c.querySelector("iframe");
      var sous = c.querySelector(".sous-cadre");
      if (!f || !sous) return;
      var m = mesures[f.getAttribute("data-rel")];
      if (S.vue === "entiere" && m) {
        sous.innerHTML = '<span class="echelle-txt"></span><span class="mesure">hauteur de page mesurée : ' + m.contenu +
          " px · sous la ligne de flottaison : " + Math.max(0, m.contenu - (d ? d.stageVisible : 0)) +
          " px</span>" + (d ? "<br>" + esc(d.calcul) : "");
      }
    });
    ajusterEchelles();
  }

  function rendreScene() {
    var e = M.etats[S.etat];
    $("scene-titre").textContent = e ? e.titre : S.etat;
    $("scene-resume").textContent = e ? e.description : "";
    $("scene-alertes").innerHTML = (M.alertes || [])
      .map(function (a) { return '<div class="alerte">' + esc(a) + "</div>"; }).join("");
    var html = "";
    if (S.variante === "duo") {
      // Cote a cote : vNext INFORME a gauche, actuel a droite — meme etat,
      // meme largeur. C'est la comparaison demandee, pas une option libre.
      html = cadreHtml("informe") + cadreHtml("actuel");
    } else {
      html = cadreHtml(S.variante);
    }
    $("cadres").innerHTML = html;
    brancherMesures();
    // Premier calage avant le chargement des iframes (le chassis a deja sa
    // taille), puis recalage a chaque « load » et a chaque redimensionnement.
    ajusterEchelles();
  }

  // --- panneaux ------------------------------------------------------------
  function rendreOnglets() {
    var defs = [
      { id: "decisions", libelle: "Décisions" },
      { id: "etat", libelle: "Cet état" },
      { id: "limites", libelle: "Limites" },
    ];
    var el = $("onglets");
    el.innerHTML = "";
    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.textContent = d.libelle;
      if (d.id === S.onglet) b.className = "on";
      b.addEventListener("click", function () { S.onglet = d.id; rendre(); });
      el.appendChild(b);
    });
  }

  function panneauDecisions() {
    return (M.decisions || []).map(function (d) {
      var opts = d.options.map(function (o) {
        var reco = o.id === d.recommandation;
        return '<div class="opt' + (reco ? " reco" : "") + '"><span class="lib">' + esc(o.libelle) +
          (reco ? '<span class="badge-reco">recommandé</span>' : "") + '</span><div class="csq">' +
          esc(o.consequences) + "</div></div>";
      }).join("");
      var actions = "";
      if (d.id === "D1") {
        // D1 se JUGE sur la bascule : ces boutons posent la variante du
        // visualiseur, memes donnees, deux rendus.
        actions = '<div class="actions">' +
          '<button data-var="pur"' + (S.variante === "pur" ? ' class="on"' : "") + ">Voir en contrôle pur</button>" +
          '<button data-var="informe"' + (S.variante === "informe" ? ' class="on"' : "") + ">Voir en contrôle informé</button>" +
          "</div>";
      }
      if (d.id === "D7" && ACCENTS.length > 1) {
        // D7 se JUGE sur la bascule Accents (patron D1) : memes donnees, memes
        // mots, deux habillages.
        actions = '<div class="actions">' + ACCENTS.map(function (a) {
          return '<button data-acc="' + esc(a.id) + '"' + (S.acc === a.id ? ' class="on"' : "") +
            ">Voir en " + esc(libelleAccent(a.id).toLowerCase()) + "</button>";
        }).join("") + "</div>";
      }
      return '<div class="carte-p"><h3>' + esc(d.id) + " · " + esc(d.titre) + '</h3><div class="q">' +
        esc(d.question) + "</div>" + opts + actions + '<div class="cout">Coût : ' + esc(d.cout) + "</div></div>";
    }).join("");
  }

  function panneauEtat() {
    var e = M.etats[S.etat];
    if (!e) return "";
    var html = '<div class="pan-titre">Description</div><div>' + esc(e.description) + "</div>";

    html += '<div class="pan-titre">Avertissements du prototype (protoWarnings)</div>';
    (M.variantes || []).forEach(function (v) {
      var bloc = e.vnext && e.vnext[v.id];
      var ws = (bloc && bloc.protoWarnings) || [];
      html += "<div><b>" + esc(v.libelle) + "</b> : " +
        (ws.length ? "" : '<span class="ok">aucun</span>') + "</div>";
      if (ws.length) html += ws.map(function (w) { return '<div class="avert">' + esc(w) + "</div>"; }).join("");
    });

    html += '<div class="pan-titre">Hauteurs</div>';
    html += '<div class="mono">Manifeste : hauteur = ' + esc(e.hauteurs ? e.hauteurs.valeur : 0) +
      " (" + esc(e.hauteurs ? e.hauteurs.note : "") + ")</div>";
    var pages = S.variante === "duo" ? ["informe", "actuel"] : [S.variante];
    pages.forEach(function (vid) {
      var p = pagesDe(vid); var rel = p ? p[cleDePage()] : null;
      var m = rel ? mesures[rel] : null;
      html += '<div class="mono">' + esc(nomVariante(vid)) + " · page courante : " +
        (m ? m.contenu + " px (mesuré dans le cadre)" :
          (S.vue === "entiere" ? "mesure en cours…" : "bascule en vue « page entière » pour mesurer")) + "</div>";
    });

    var sondes = [];
    (M.variantes || []).forEach(function (v) {
      var bloc = e.vnext && e.vnext[v.id];
      if (bloc && bloc.sonde) sondes.push([v.libelle, bloc.sonde]);
    });
    if (e.actuel && e.actuel.sonde) sondes.push(["Profil actuel", e.actuel.sonde]);
    if (sondes.length) {
      html += '<div class="pan-titre">Sonde de rendu (à 375 px)</div><ul class="liste">';
      sondes.forEach(function (s) {
        html += "<li><b>" + esc(s[0]) + "</b> : " + (s[1].blocs ? s[1].blocs.length : 0) +
          " blocs · " + esc(s[1].longueurTexte) + " caractères de texte" +
          (s[1].erreurs && s[1].erreurs.length ? " · " + s[1].erreurs.length + " erreur(s) de rendu" : "") + "</li>";
      });
      html += "</ul>";
    }

    var vmBloc = e.vnext && e.vnext[S.variante === "duo" ? "informe" : S.variante];
    if (vmBloc && vmBloc.viewModel) {
      html += '<div class="pan-titre">Le ViewModel de cette variante</div>' +
        '<pre class="mono" style="white-space:pre-wrap;background:#0A0F16;border:1px solid var(--bord);border-radius:5px;padding:8px;max-height:280px;overflow:auto">' +
        esc(JSON.stringify(vmBloc.viewModel, null, 1)) + "</pre>";
    }
    return html;
  }

  function panneauLimites() {
    var html = '<div class="pan-titre">Seuils d’affichage du contrat</div>';
    html += (M.seuils && M.seuils.length)
      ? '<ul class="liste">' + M.seuils.map(function (s) {
          return "<li><b>" + esc(s.nom) + "</b> = " + esc(s.valeur) + " — " + esc(s.role) + "</li>";
        }).join("") + "</ul>"
      : "<div>Tableau VIDE — " + esc(M.seuilsNote || "") + "</div>";

    html += '<div class="pan-titre">Ce que le harnais ne reproduit pas</div><ul class="liste">' +
      (M.limites || []).map(function (l) { return "<li><b>" + esc(l.quoi) + "</b> — " + esc(l.detail) + "</li>"; }).join("") + "</ul>";

    html += '<div class="pan-titre">Approximations du côté « Profil actuel »</div><ul class="liste">' +
      (M.approximations || []).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>";

    html += '<div class="pan-titre">Modules remplacés</div><ul class="liste">' +
      (M.stubs || []).map(function (s) {
        return "<li><b>" + esc(s.module) + "</b> → " + esc(s.remplace) +
          (s.fidele ? ' <span class="ok">(fidèle)</span>' : " (non fidèle)") + " — " + esc(s.note) + "</li>";
      }).join("") + "</ul>";

    html += '<div class="pan-titre">Horloge fictive</div><div class="mono">' +
      esc(M.horlogeFictive ? M.horlogeFictive.texte + " (" + M.horlogeFictive.iso + ")" : "—") + "</div>";
    return html;
  }

  function rendrePanneau() {
    var c = $("panneau-contenu");
    c.innerHTML = S.onglet === "decisions" ? panneauDecisions()
      : S.onglet === "etat" ? panneauEtat()
      : panneauLimites();
    Array.prototype.forEach.call(c.querySelectorAll("button[data-var]"), function (b) {
      b.addEventListener("click", function () { S.variante = b.getAttribute("data-var"); rendre(); });
    });
    Array.prototype.forEach.call(c.querySelectorAll("button[data-acc]"), function (b) {
      b.addEventListener("click", function () {
        S.acc = b.getAttribute("data-acc");
        // L'axe ne se voit pas sur le Profil actuel : on bascule sur la
        // variante informee pour que le bouton montre reellement quelque chose.
        if (S.variante === "actuel") S.variante = "informe";
        rendre();
      });
    });
  }

  // --- clavier -------------------------------------------------------------
  document.addEventListener("keydown", function (ev) {
    if (/input|textarea|select/i.test((ev.target && ev.target.tagName) || "")) return;
    var ids = M.ordreEtats;
    var i = ids.indexOf(S.etat);
    if (ev.key === "ArrowDown") { S.etat = ids[(i + 1) % ids.length]; rendre(); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { S.etat = ids[(i - 1 + ids.length) % ids.length]; rendre(); ev.preventDefault(); }
    else if (ev.key === "v") {
      var vs = VARIANTES_UI.map(function (v) { return v.id; });
      S.variante = vs[(vs.indexOf(S.variante) + 1) % vs.length]; rendre();
    } else if (ev.key === "w") {
      var wi = M.largeurs.indexOf(S.w);
      S.w = M.largeurs[(wi + 1) % M.largeurs.length];
      if (S.w !== M.largeurEchelle) S.x13 = 0;
      rendre();
    } else if (ev.key === "e") { S.vue = S.vue === "visible" ? "entiere" : "visible"; rendre(); }
    else if (ev.key === "t") { if (S.w === M.largeurEchelle) { S.x13 = S.x13 ? 0 : 1; rendre(); } }
    else if (ev.key === "c") {
      if (S.variante !== "actuel" && ACCENTS.length > 1) {
        var as = ACCENTS.map(function (a) { return a.id; });
        S.acc = as[(as.indexOf(S.acc) + 1) % as.length];
        rendre();
      }
    }
  });

  window.addEventListener("hashchange", function () { lireHash(); rendre(); });

  // --- rendu global --------------------------------------------------------
  function rendre() {
    ecrireHash();
    $("bandeau-etat").textContent = S.etat + " · " + nomVariante(S.variante) +
      (S.variante !== "actuel" && S.acc !== ACCENTS_DEFAUT ? " · accents " + libelleAccent(S.acc) : "");
    $("bandeau-meta").textContent = "généré le " + (M.genereLe || "?") +
      " · toutes les données sont inventées";
    rendreBarre();
    rendreRail();
    rendreScene();
    rendreOnglets();
    rendrePanneau();
  }

  lireHash();
  rendre();
})();
`;
}

module.exports = { viewerHtml, viewerCss, viewerJs };
