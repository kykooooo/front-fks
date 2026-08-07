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
  <div class="grp" id="grp-paire">
    <span class="lab">Paire</span>
    <div class="seg" id="seg-paire"></div>
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
  <div class="grp" id="grp-typo">
    <span class="lab">Typo</span>
    <div class="seg" id="seg-typo"></div>
  </div>
  <div class="grp" id="grp-anim">
    <span class="lab">Animations</span>
    <div class="seg" id="seg-anim"></div>
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
  /* La variante 2 a sa propre couleur de reperage dans l'OUTIL (jamais dans le
     produit) : en cote a cote, la colonne de droite doit se reconnaitre sans
     lire son titre. */
  --v2: #C48BFF;
  /* Reperage d'un reglage de presentation non par defaut (typographie d'avant,
     animations reduites). Jamais dans le produit, uniquement dans l'outil. */
  --typo: #F2B33D;
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
/* Un reglage de PRESENTATION qui n'est pas celui par defaut doit se voir sans
   lire le bouton : sinon on juge la typographie d'avant en croyant regarder
   celle d'apres. Couleur differente de l'actif ordinaire, exprès. */
.seg button.on.non-defaut { background: var(--typo); color: #17110A; }
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
/* La variante 2 se distingue a l'oeil dans la liste : c'est un autre ecran,
   pas un autre etat du meme ecran. */
#rail button.etat.v2 { border-left-color: #2E3F5C; }
#rail button.etat.v2.on { border-left-color: var(--v2); }
#rail button.etat .hote {
  display: block; font-size: 10.5px; color: var(--texte-2); margin-top: 2px; font-style: italic;
}

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
.puce-vnext2 { background: var(--v2); }
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
.badge-neutre { background: #223047; color: #A9BEDD; }
/* Bloc « ce que dit le contrat, pour l'etat courant » : toujours visible, jamais
   replie. C'est la reponse aux deux questions que le fondateur doit pouvoir se
   poser a tout moment — sur quoi la courbe est calculee, et si l'app ose
   annoncer un etat physique global. */
.encadre-portee {
  border: 1px solid #2E4A6B; background: #101E30; border-radius: 7px;
  padding: 10px 11px; margin-bottom: 14px;
}
.encadre-portee .t {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase;
  color: #7FB3FF; display: block; margin-bottom: 5px;
}
.encadre-portee .phrase { font-size: 12.5px; line-height: 1.6; color: #DCE6F4; }
.encadre-portee .sous { font-size: 11.5px; line-height: 1.55; color: var(--texte-2); margin-top: 6px; }
.sep-panneau {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--v2); border-top: 1px solid var(--bord); padding-top: 12px; margin: 16px 0 9px;
}
.sep-panneau.bleu { color: var(--actif); }
.avertissement {
  background: #2A1F0E; border: 1px solid #6B4C18; color: #FFE0B0; border-radius: 6px;
  padding: 8px 10px; font-size: 11.5px; line-height: 1.55; margin-bottom: 7px;
}
.avertissement .t { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; display: block; margin-bottom: 3px; color: #FFC97A; }
.vide { font-size: 12px; color: var(--texte-2); font-style: italic; }
dl.kv { margin: 0; font-size: 12px; }
dl.kv dt { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; color: var(--texte-2); margin-top: 9px; }
dl.kv dd { margin: 2px 0 0; line-height: 1.55; }

/* --- un axe a juger : la forme est volontairement differente d'un « point »,
   parce qu'on ne lui demande pas la meme chose. Un axe se tranche seul. ----- */
.axe { border: 1px solid var(--bord); border-radius: 7px; margin-bottom: 11px; background: var(--fond-3); overflow: hidden; }
.axe > summary {
  cursor: pointer; padding: 10px 11px; list-style: none; display: flex; align-items: baseline; gap: 8px;
}
.axe > summary::-webkit-details-marker { display: none; }
.axe > summary::before { content: "▸"; color: var(--texte-2); font-size: 11px; }
.axe[open] > summary::before { content: "▾"; }
.axe > summary .nom { font-size: 13.5px; font-weight: 700; }
.axe .corps { padding: 0 11px 12px; font-size: 12px; line-height: 1.6; }
.axe .q {
  font-size: 12.5px; line-height: 1.55; color: #CFE0FA; background: #16233A;
  border-left: 3px solid var(--actif); border-radius: 0 5px 5px 0; padding: 7px 9px; margin-bottom: 10px;
}
.axe .bascule {
  background: #2A2210; border: 1px solid #6B551A; border-radius: 5px; padding: 7px 9px;
  font-size: 11.5px; line-height: 1.55; color: #FFE7B8; margin-bottom: 10px;
}
.axe .bascule .t { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; display: block; margin-bottom: 3px; color: var(--typo); }
/* Cote a cote quand le panneau est large, empiles quand il ne l'est pas : les
   deux verdicts portent des phrases entieres, et deux colonnes de 150 px les
   rendraient illisibles — exactement le defaut qu'on demande de traquer dans
   l'ecran produit. */
.verdict { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.verdict > div { flex: 1 1 190px; min-width: 0; border-radius: 5px; padding: 7px 9px; font-size: 11.5px; line-height: 1.5; }
.verdict .v-oui { background: #10281C; border: 1px solid #2E7D5B; color: #B6EBCF; }
.verdict .v-non { background: #2A1210; border: 1px solid #6B2B22; color: #FFC8BC; }
.verdict .t { font-family: var(--mono); font-size: 9.5px; letter-spacing: .9px; text-transform: uppercase; display: block; margin-bottom: 3px; }
.cibles { display: flex; flex-wrap: wrap; gap: 5px; }
.cibles button {
  background: #223047; border: 1px solid var(--bord); border-radius: 999px; color: #CFE0FA;
  font-size: 10.5px; padding: 4px 10px; cursor: pointer; font-family: var(--mono); text-align: left;
}
.cibles button:hover { background: #2E415F; color: #fff; }
.cibles button.actif { background: var(--actif); color: #06101F; border-color: var(--actif); font-weight: 700; }

/* --- le repere de test de l'etat courant --------------------------------- */
.repere { border: 1px solid #3B5B33; background: #101E0F; border-radius: 7px; padding: 10px 11px; margin-bottom: 12px; }
.repere .t { font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: #8FE3B0; display: block; margin-bottom: 5px; }
.repere .gros { font-size: 14px; font-weight: 700; line-height: 1.4; }
.repere .chiffre { font-family: var(--mono); font-size: 13px; color: #DCE6F4; margin-top: 3px; }
.repere .sous { font-size: 11.5px; line-height: 1.55; color: var(--texte-2); margin-top: 7px; }
.repere.vide { border-color: #4A4A2A; background: #1B1A10; }
.repere.vide .t { color: #E4D48A; }
tr.retenu td { background: #14361F; }
tr.retenu td:first-child { border-left: 3px solid #8FE3B0; }

/* --- ce qui passe sous la ligne ------------------------------------------ */
.sousligne { font-size: 11.5px; line-height: 1.6; }
.sousligne .bloc-ligne { display: flex; gap: 8px; padding: 5px 6px; border-bottom: 1px solid var(--bord); }
.sousligne .bloc-ligne .pos { font-family: var(--mono); white-space: nowrap; }
.sousligne .dessus .pos { color: #7BD6A6; }
.sousligne .dessous .pos { color: #FFB46B; }
.sousligne .coupe .pos { color: #FF9E8C; }
.jauge { height: 8px; border-radius: 4px; background: #223047; overflow: hidden; margin: 6px 0 3px; }
.jauge > i { display: block; height: 100%; background: #7BD6A6; }
.jauge.deborde > i { background: #FFB46B; }

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

  // ------------------------------------------------------------------------
  // LES VARIANTES DE DEMARRAGE — l'ecran du nouveau joueur
  // ------------------------------------------------------------------------
  // Elles viennent du MANIFESTE, donc du ViewModel (« DEMARRAGE_VARIANTES ») :
  // le visualiseur affiche ce que le produit propose, jamais ce qu'un tableau
  // recopie ici pretendrait. Une troisieme variante apparaitrait toute seule ;
  // une variante retiree disparaitrait de meme.
  // ------------------------------------------------------------------------
  var VARIANTES_DEMARRAGE = M.variantesDemarrage || [];
  var IDS_DEMARRAGE = VARIANTES_DEMARRAGE.map(function (v) { return v.cle; });
  function estVarianteDemarrage(v) { return IDS_DEMARRAGE.indexOf(v) !== -1; }
  function varianteDemarragePar(cleVariante) {
    for (var i = 0; i < VARIANTES_DEMARRAGE.length; i++) {
      if (VARIANTES_DEMARRAGE[i].cle === cleVariante) return VARIANTES_DEMARRAGE[i];
    }
    return null;
  }

  var VARIANTES = [
    { id: "vnext", libelle: "Proposition vNext" },
    { id: "vnext2", libelle: "Progression integree" }
  ].concat(
    VARIANTES_DEMARRAGE.map(function (v) {
      return { id: v.cle, libelle: "V-" + v.id };
    })
  ).concat([
    { id: "actuel", libelle: "Home actuel" },
    { id: "duo", libelle: "Cote a cote" }
  ]);
  var VUES = [
    { id: "visible", libelle: "Zone visible sans defilement" },
    { id: "entiere", libelle: "Page entiere" }
  ];
  // Les paires du mode cote a cote. La premiere est celle que le fondateur a
  // demandee : variante 1 contre variante 2, a 375 px.
  //
  // Les paires de DEMARRAGE viennent ensuite, et dans cet ordre precis : la
  // question du 03/08 est « l'ecran actuel du nouveau joueur contre chacune des
  // deux propositions », puis « les deux propositions l'une contre l'autre ».
  var PAIRES = [
    { id: "v1v2", libelle: "vNext / Progression", gauche: "vnext", droite: "vnext2" },
    { id: "av1", libelle: "Actuel / vNext", gauche: "actuel", droite: "vnext" },
    { id: "av2", libelle: "Actuel / Progression", gauche: "actuel", droite: "vnext2" }
  ].concat(
    VARIANTES_DEMARRAGE.map(function (v) {
      return {
        id: "v1v" + v.id,
        libelle: "Actuelle / V-" + v.id,
        gauche: "vnext",
        droite: v.cle
      };
    })
  ).concat(
    VARIANTES_DEMARRAGE.length === 2
      ? [{
          id: "v" + VARIANTES_DEMARRAGE[0].id + "v" + VARIANTES_DEMARRAGE[1].id,
          libelle: "V-" + VARIANTES_DEMARRAGE[0].id + " / V-" + VARIANTES_DEMARRAGE[1].id,
          gauche: VARIANTES_DEMARRAGE[0].cle,
          droite: VARIANTES_DEMARRAGE[1].cle
        }]
      : []
  );
  var NOMS_VARIANTE = {
    vnext: "Proposition vNext",
    vnext2: "Progression integree (v2)",
    actuel: "Home actuel (production)"
  };
  VARIANTES_DEMARRAGE.forEach(function (v) { NOMS_VARIANTE[v.cle] = v.titre; });

  // ------------------------------------------------------------------------
  // L'AXE PRESENTATION, EN DEUX BOUTONS AU LIEU D'UN
  //
  // Le manifeste porte QUATRE combinaisons (typographie x mouvement). Les
  // proposer telles quelles ferait un segment de quatre boutons aux libelles
  // longs, dans une barre deja chargee — et surtout ca melangerait deux
  // jugements que le fondateur doit rendre SEPAREMENT.
  //
  // On expose donc les deux axes, et on retrouve la combinaison correspondante.
  // Si le produit en retirait une, le bouton se desactive avec son explication
  // plutot que d'afficher une page qui n'existe pas.
  // ------------------------------------------------------------------------
  var PRESENTATIONS = M.presentations || [];
  var TYPOS = [
    { id: "allegee", libelle: "Allegee" },
    { id: "actuelle", libelle: "Actuelle" }
  ];
  var ANIMS = [
    { id: "0", libelle: "Normales" },
    { id: "1", libelle: "Reduites" }
  ];

  function presentationParId(id) {
    for (var i = 0; i < PRESENTATIONS.length; i++) if (PRESENTATIONS[i].id === id) return PRESENTATIONS[i];
    return null;
  }
  function presentationPour(typo, anim) {
    for (var i = 0; i < PRESENTATIONS.length; i++) {
      if (PRESENTATIONS[i].echelle === typo && Boolean(PRESENTATIONS[i].reduceMotion) === Boolean(anim)) {
        return PRESENTATIONS[i];
      }
    }
    return null;
  }
  var PRESENTATION_DEFAUT = presentationParId(M.presentationParDefaut) || PRESENTATIONS[0] || null;
  function presentationCourante() {
    return presentationPour(etat.typo, etat.anim) || PRESENTATION_DEFAUT;
  }
  function estPresentationDefaut() {
    var p = presentationCourante();
    return !p || !PRESENTATION_DEFAUT || p.id === PRESENTATION_DEFAUT.id;
  }

  var etat = {
    etatId: M.ordreEtats[1] || M.ordreEtats[0],
    variante: "vnext",
    paire: "v1v2",
    largeur: 375,
    vue: "visible",
    x13: false,
    typo: PRESENTATION_DEFAUT ? PRESENTATION_DEFAUT.echelle : "allegee",
    anim: false,
    onglet: "axes",
    axeOuvert: null,
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
      if (k === "etat" && (M.etats[v] || etatsV2()[v] || trouverExtra(v))) etat.etatId = v;
      if (k === "var" && (["vnext", "vnext2", "actuel", "duo"].indexOf(v) !== -1 || estVarianteDemarrage(v))) etat.variante = v;
      if (k === "paire" && trouverPaire(v)) etat.paire = v;
      if (k === "w") { var w = Number(v); if (M.largeurs.indexOf(w) !== -1) etat.largeur = w; }
      if (k === "vue" && ["visible", "entiere"].indexOf(v) !== -1) etat.vue = v;
      if (k === "x13") etat.x13 = v === "1";
      if (k === "typo" && ["allegee", "actuelle"].indexOf(v) !== -1) etat.typo = v;
      if (k === "anim") etat.anim = v === "1";
      if (k === "onglet") etat.onglet = v;
    });
  }
  function ecrireHash() {
    var h = "etat=" + etat.etatId + "&var=" + etat.variante + "&paire=" + etat.paire +
      "&w=" + etat.largeur + "&vue=" + etat.vue + "&x13=" + (etat.x13 ? 1 : 0) +
      "&typo=" + etat.typo + "&anim=" + (etat.anim ? 1 : 0) +
      "&onglet=" + etat.onglet;
    if (("#" + h) !== location.hash) history.replaceState(null, "", "#" + h);
  }

  // Les etats de la variante 2 vivent dans une table SEPAREE : deux cas de carte
  // portent le meme identifiant qu'une fixture Home. Les fusionner en ferait
  // disparaitre un en silence.
  function etatsV2() { return M.etatsVariante2 || {}; }
  function ordreV2() { return M.ordreEtatsVariante2 || []; }
  function estVariante2(id) { return Boolean(etatsV2()[id]); }
  function trouverPaire(id) {
    for (var i = 0; i < PAIRES.length; i++) if (PAIRES[i].id === id) return PAIRES[i];
    return null;
  }
  function paireCourante() { return trouverPaire(etat.paire) || PAIRES[0]; }

  function trouverExtra(id) {
    for (var i = 0; i < M.extras.length; i++) if (M.extras[i].id === id) return M.extras[i];
    return null;
  }
  function courant() {
    return M.etats[etat.etatId] || etatsV2()[etat.etatId] || trouverExtra(etat.etatId);
  }
  function estExtra() {
    return !M.etats[etat.etatId] && !estVariante2(etat.etatId);
  }
  /** Toutes les variantes disponibles pour l'etat courant. */
  function varianteDispo(v) {
    var e = courant();
    if (!e) return false;
    if (estExtra()) return v === "actuel";
    if (v === "vnext2") return Boolean(e.vnext2 && Object.keys(e.vnext2.pages || {}).length);
    if (v === "vnext") return Boolean(e.vnext && Object.keys(e.vnext.pages || {}).length);
    if (v === "actuel") return Boolean(e.actuel && Object.keys(e.actuel.pages || {}).length);
    if (estVarianteDemarrage(v)) {
      var d = e.demarrage && e.demarrage[v];
      return Boolean(d && Object.keys(d.pages || {}).length);
    }
    if (v === "duo") return true;
    return false;
  }
  /** Le bloc de demarrage de l'etat courant pour une variante, ou null. */
  function blocDemarrage(v) {
    var e = courant();
    return (e && e.demarrage && e.demarrage[v]) || null;
  }
  function device(w) {
    for (var i = 0; i < M.devices.length; i++) if (M.devices[i].width === w) return M.devices[i];
    return M.devices[1];
  }
  function cle(w) { return w + (etat.x13 && w === M.largeurEchelle ? "-x13" : "") + "-" + etat.vue; }
  function cleVue(w, vue) { return w + (etat.x13 && w === M.largeurEchelle ? "-x13" : "") + "-" + vue; }
  function blocDe(e, variante) {
    if (!e) return null;
    if (variante === "vnext") return e.vnext;
    if (variante === "vnext2") return e.vnext2;
    if (estVarianteDemarrage(variante)) return (e.demarrage && e.demarrage[variante]) || null;
    return e.actuel;
  }

  /**
   * QUELLE TABLE DE PAGES SERVIR, ET SOUS QUELLE ETIQUETTE.
   *
   * Trois cas, et aucun ne doit etre silencieux :
   *   "exact"  — la combinaison demandee a bien ete generee ;
   *   "replie" — elle ne l'a pas ete, on sert la presentation par defaut ET on
   *              le dit sur le cadre. C'est le cas du Home de production, qui
   *              n'a qu'une typographie, la sienne : ce n'est pas un manque du
   *              harnais, c'est un fait du produit ;
   *   "absent" — rien a servir.
   *
   * Servir en silence une page d'une autre presentation serait le meme defaut
   * que servir la variante 1 sous l'etiquette « Progression integree ».
   */
  function tablePages(variante, w) {
    var bloc = blocDe(courant(), variante);
    if (!bloc || !bloc.pages) return { pages: null, statut: "absent", raison: null };
    var p = presentationCourante();
    var pp = bloc.pagesPresentations || null;
    if (p && pp && pp[p.id] && pp[p.id][cle(w)]) {
      return { pages: pp[p.id], statut: "exact", presentation: p, raison: null };
    }
    if (!bloc.pages[cle(w)]) return { pages: null, statut: "absent", raison: null };
    if (estPresentationDefaut()) {
      return { pages: bloc.pages, statut: "exact", presentation: PRESENTATION_DEFAUT, raison: null };
    }
    return {
      pages: bloc.pages,
      statut: "replie",
      presentation: PRESENTATION_DEFAUT,
      raison: variante === "actuel"
        ? "Le Home de production n'a qu'une typographie, la sienne : il n'a ni reglage d'echelle " +
          "ni prise en compte de « reduire les animations ». Cette colonne reste donc sur la " +
          "presentation par defaut, quel que soit le reglage choisi."
        : "Cette combinaison n'est pas generee a " + w + " px — seulement en " +
          (M.largeursComparaisonTypo || [320, 375]).join(" et ") + " px. La page affichee est " +
          "celle de la presentation par defaut."
    };
  }

  function pageDe(variante, w) {
    var t = tablePages(variante, w);
    return t.pages ? t.pages[cle(w)] || null : null;
  }

  /** La page « page entiere » de la meme combinaison — pour les mesures. */
  function pageEntiereDe(variante, w) {
    var t = tablePages(variante, w);
    return t.pages ? t.pages[cleVue(w, "entiere")] || null : null;
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
      b.className = (o.id === actifId ? "on" : "") + (o.id === actifId && o.nonDefaut ? " non-defaut" : "");
      if (o.titre) b.title = o.titre;
      if (estDesactive && estDesactive(o)) { b.disabled = true; b.title = estDesactive(o); }
      b.onclick = function () { onChoix(o.id); };
      hote.appendChild(b);
    });
  }

  /**
   * Un reglage de presentation est-il servable sur ce qu'on regarde ?
   * On repond en cherchant une page REELLE, pas en supposant : c'est ce qui
   * evite d'annoncer un reglage que la generation n'a pas produit.
   */
  function presentationServable(typo, anim) {
    var p = presentationPour(typo, anim);
    if (!p) return "Cette combinaison n'existe pas dans le module de presentation du produit.";
    var vs = etat.variante === "duo" ? [paireCourante().gauche, paireCourante().droite] : [etat.variante];
    var w = etat.variante === "duo" ? 375 : etat.largeur;
    for (var i = 0; i < vs.length; i++) {
      if (vs[i] === "actuel") continue; // le Home de production n'a pas ces reglages
      var bloc = blocDe(courant(), vs[i]);
      var pp = bloc && bloc.pagesPresentations;
      if (pp && pp[p.id] && pp[p.id][cle(w)]) return null;
    }
    if (p.id === M.presentationParDefaut) return null;
    return "Genere en " + (M.largeursComparaisonTypo || [320, 375]).join(" et ") + " px seulement. " +
      "En " + w + " px, le cadre affichera la presentation par defaut et le signalera.";
  }

  function rendreBarre() {
    segments(document.getElementById("seg-variante"), VARIANTES, etat.variante, function (v) {
      etat.variante = v; if (v === "duo") etat.largeur = 375; rendre();
    }, function (o) {
      if (estExtra() && o.id !== "actuel") return "Cet etat n'existe que cote Home actuel.";
      if (o.id === "vnext2" && !varianteDispo("vnext2")) {
        if (!M.varianteDeuxDisponible) return "La variante 2 n'a pas ete generee (voir les alertes).";
        return "Cet etat n'a pas de cas de carte progression. Les sept cas sont regroupes en bas " +
          "de la liste, sous « Variante 2 ».";
      }
      // Les variantes de demarrage n'existent QUE sur un compte sans aucune
      // seance terminee. Le bouton dit pourquoi, il ne disparait pas : le
      // fondateur doit voir que ces deux propositions existent, et sur quel
      // ecran elles s'appliquent.
      if (estVarianteDemarrage(o.id) && !varianteDispo(o.id)) {
        var dem = varianteDemarragePar(o.id);
        var eligibles = (M.etatsAvecDemarrage || []);
        if (!eligibles.length) return "Aucune variante de demarrage n'a ete generee (voir les alertes).";
        return (dem ? dem.titre + " — " : "") +
          "cette variante ne concerne QUE l'ecran d'un compte sans aucune seance terminee. " +
          "Etat(s) concerne(s) : " + eligibles.join(", ") + ".";
      }
      return null;
    });

    // La paire ne concerne que le cote a cote : hors de ce mode, le groupe
    // disparait au lieu d'afficher un reglage sans effet.
    var grpPaire = document.getElementById("grp-paire");
    grpPaire.style.display = etat.variante === "duo" ? "" : "none";
    segments(document.getElementById("seg-paire"), PAIRES, etat.paire, function (v) {
      etat.paire = v; rendre();
    }, function (o) {
      if ((o.gauche === "vnext2" || o.droite === "vnext2") && !varianteDispo("vnext2")) {
        return "Cet etat n'a pas de variante 2.";
      }
      if ((o.gauche === "actuel" || o.droite === "actuel") && !varianteDispo("actuel")) {
        return "Cet etat n'a pas de correspondance cote Home actuel.";
      }
      var cotes = [o.gauche, o.droite].filter(estVarianteDemarrage);
      for (var i = 0; i < cotes.length; i++) {
        if (!varianteDispo(cotes[i])) {
          return "Cet etat n'a pas de variante de demarrage : elles ne concernent qu'un compte " +
            "sans aucune seance terminee.";
        }
      }
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

    // --- l'axe presentation, en deux reglages independants ------------------
    var dispoTypo = PRESENTATIONS.length > 1;
    document.getElementById("grp-typo").style.display = dispoTypo ? "" : "none";
    document.getElementById("grp-anim").style.display = dispoTypo ? "" : "none";
    segments(document.getElementById("seg-typo"),
      TYPOS.map(function (t) {
        return {
          id: t.id,
          libelle: t.libelle,
          nonDefaut: !PRESENTATION_DEFAUT || t.id !== PRESENTATION_DEFAUT.echelle,
          titre: t.id === "allegee"
            ? "L'echelle demandee : plus aucun texte en graisse 800."
            : "L'ecran tel qu'il etait a l'iteration precedente : cinq roles en graisse 800."
        };
      }),
      etat.typo,
      function (v) { etat.typo = v; rendre(); },
      function (o) { return presentationServable(o.id, etat.anim); });

    segments(document.getElementById("seg-anim"),
      ANIMS.map(function (a) {
        return {
          id: a.id,
          libelle: a.libelle,
          nonDefaut: a.id === "1",
          titre: a.id === "1"
            ? "Le joueur a active « reduire les animations ». Au repos l'image est IDENTIQUE : " +
              "c'est le but. La preuve est comptee dans l'onglet « Cet etat »."
            : "Le reglage du telephone n'est pas actif — le cas de la grande majorite."
        };
      }),
      etat.anim ? "1" : "0",
      function (v) { etat.anim = v === "1"; rendre(); },
      function (o) { return presentationServable(etat.typo, o.id === "1"); });

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
        b.onclick = function () { allerA(id); };
        rail.appendChild(b);
      });
    });

    // --- variante 2 : ses propres groupes, clairement separes ---------------
    (M.groupesVariante2 || []).forEach(function (g) {
      var h = document.createElement("div");
      h.className = "groupe";
      h.innerHTML = '<div class="t" style="color:var(--v2)">' + esc(g.titre) + '</div>' +
        '<div class="a">' + esc(g.aide) + "</div>";
      rail.appendChild(h);
      g.etats.forEach(function (id) {
        var e = etatsV2()[id];
        if (!e) return;
        var b = document.createElement("button");
        b.className = "etat v2" + (id === etat.etatId ? " on" : "");
        var marque = e.qualiteAppariement === "approximatif"
          ? '<span class="marque marque-approximatif">appariement approx.</span>'
          : "";
        b.innerHTML = esc(e.titre) + marque +
          '<span class="hote">sur l\\'ecran « ' + esc(e.hoteTitre) + ' »</span>' +
          '<span class="sous">' + esc(e.id) + "</span>";
        b.onclick = function () { allerA(id); };
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
    var table = tablePages(variante, w);
    var src = table.pages ? table.pages[cle(w)] || null : null;
    var wrap = document.createElement("div");
    wrap.className = "cadre";
    wrap.style.width = w + "px";

    var titre = NOMS_VARIANTE[variante] || variante;
    var pres = table.presentation || presentationCourante();
    var tete = document.createElement("div");
    tete.className = "tete";
    tete.innerHTML = '<span class="puce puce-' + variante + '"></span>' + esc(titre) + " — " + w + " px" +
      (etat.x13 && w === M.largeurEchelle ? " — texte x" + M.echelleTexte : "") +
      (pres && PRESENTATION_DEFAUT && pres.id !== PRESENTATION_DEFAUT.id
        ? ' <span style="color:var(--typo)">— ' + esc(pres.court || pres.titre) + "</span>"
        : "");
    wrap.appendChild(tete);

    // Un repli n'est jamais silencieux : la colonne dit qu'elle ne montre pas ce
    // qui a ete demande, et pourquoi.
    if (table.statut === "replie") {
      var avis = document.createElement("div");
      avis.className = "mesure";
      avis.style.color = "var(--typo)";
      avis.style.marginTop = "0";
      avis.style.marginBottom = "6px";
      avis.textContent = "presentation par defaut — " + table.raison;
      wrap.appendChild(avis);
    }

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

  // ------------------------------------------------------------------------
  // File d'attente du mesureur.
  //
  // Il n'y a qu'UNE iframe de mesure pour toute la page. En mode cote a cote,
  // les deux cadres demandent leur mesure en meme temps : la seconde demande
  // ecrasait le "onload" et le "src" de la premiere, dont le rappel ne se declenchait
  // jamais. Resultat visible avant correction : la colonne de gauche restait
  // bloquee sur « mesure en cours… ». Defaut anterieur a la variante 2, mais qui
  // devient genant maintenant que le cote a cote est la vue principale.
  //
  // On serialise donc : une demande a la fois, les suivantes attendent.
  // ------------------------------------------------------------------------
  var fileMesure = [];
  var mesureEnCours = false;
  function demanderMesure(src, apres) {
    fileMesure.push({ src: src, apres: apres });
    if (!mesureEnCours) traiterMesure();
  }
  function traiterMesure() {
    if (!fileMesure.length) { mesureEnCours = false; return; }
    mesureEnCours = true;
    var tache = fileMesure.shift();
    var m = document.getElementById("mesureur");
    m.onload = function () {
      var h = null;
      try {
        var dev = m.contentDocument.querySelector(".device");
        h = dev ? dev.offsetHeight : null;
      } catch (err) { h = null; }
      tache.apres(h);
      traiterMesure();
    };
    m.src = tache.src;
  }

  // Mesure de la hauteur reelle du contenu. En vue « zone visible » le contenu
  // est coupe : on charge donc la page « entiere » dans une iframe cachee pour
  // savoir ce qui se trouve sous la ligne.
  var cacheMesures = {};
  function mesurer(variante, w, hauteurVue, sortie) {
    var d = device(w);
    // La presentation entre dans la cle du cache : deux typographies donnent deux
    // hauteurs, et servir l'une pour l'autre ferait mentir le chiffre affiche.
    var kEnt = variante + "|" + etat.etatId + "|" + w + "|" + (etat.x13 ? 1 : 0) + "|" +
      (presentationCourante() ? presentationCourante().id : "-");
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

    var src = pageEntiereDe(variante, w);
    if (!src) { sortie.textContent = "mesure indisponible"; return; }
    demanderMesure(src, function (h) {
      if (h == null) { sortie.textContent = "mesure impossible"; return; }
      cacheMesures[kEnt] = h;
      afficher(h);
    });
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

    var v2 = estVariante2(etat.etatId);
    var paire = paireCourante();
    // Les variantes reellement affichees a l'ecran, pour ne declencher que les
    // alertes qui concernent ce qu'on regarde vraiment.
    var affichees = etat.variante === "duo" ? [paire.gauche, paire.droite] : [etat.variante];
    var montre = function (v) { return affichees.indexOf(v) !== -1; };

    if (estExtra()) {
      alerte.innerHTML = '<div class="alerte alerte-orange"><span class="t">Etat du Home actuel uniquement</span>' +
        esc(e.pourquoi) + "</div>";
    } else {
      if (v2) {
        alerte.innerHTML += '<div class="alerte alerte-orange"><span class="t">Ecran d\\'accueil ' +
          'utilise pour la demonstration</span>La carte de cet etat a ete ecrite seule, sans ecran ' +
          'autour. Elle est posee ici sur « ' + esc(e.hoteTitre) + ' ». ' + esc(e.pourquoiCetHote) +
          "</div>";
      }
      if (v2 && e.ecartAppariement) {
        alerte.innerHTML += '<div class="alerte alerte-rouge"><span class="t">Appariement ' +
          'approximatif — a savoir avant de regarder</span>' + esc(e.ecartAppariement) + "</div>";
      }
      if (v2 && montre("vnext2") && e.vnext2 && e.vnext2.indisponible) {
        alerte.innerHTML += '<div class="alerte alerte-rouge"><span class="t">Variante 2 ' +
          'indisponible</span>' + esc(e.vnext2.indisponible) +
          " — le harnais refuse de servir la variante 1 sous cette etiquette. La colonne affiche " +
          "une page d'explication.</div>";
      }
      if (montre("vnext") && e.vnext && e.vnext.indisponible) {
        alerte.innerHTML += '<div class="alerte alerte-rouge"><span class="t">Proposition indisponible</span>' +
          esc(e.vnext.indisponible) + " — la colonne vNext affiche une page d'explication.</div>";
      }
      if (montre("actuel") && e.actuel && e.actuel.qualite && e.actuel.qualite !== "exact") {
        var cls = e.actuel.qualite === "inexistant" ? "alerte-rouge" : "alerte-orange";
        var t = e.actuel.qualite === "inexistant"
          ? "Le Home actuel n'a pas cet etat"
          : "Correspondance approximative";
        alerte.innerHTML += '<div class="alerte ' + cls + '"><span class="t">' + t + "</span>" +
          esc(e.actuel.ecart) + "</div>";
      }
    }

    // Un reglage de presentation non par defaut doit se signaler AVANT que le
    // fondateur ne se prononce : juger la typographie d'avant en croyant regarder
    // celle d'apres serait la pire confusion possible de cet outil.
    if (!estPresentationDefaut()) {
      var pc = presentationCourante();
      alerte.innerHTML +=
        '<div class="alerte alerte-orange"><span class="t">Presentation : ' + esc(pc.titre) +
        "</span>" + esc(pc.resume) +
        (pc.reduceMotion
          ? " CETTE PAGE EST VISUELLEMENT IDENTIQUE a celle sans le reglage, et c'est le resultat " +
            "voulu : au repos, un ecran sans animation ressemble a un ecran avec animation. Ce qui " +
            "change se compte dans l'onglet « Cet etat »."
          : "") +
        "</div>";
    }

    var hote = document.getElementById("cadres");
    hote.innerHTML = "";
    if (etat.variante === "duo") {
      cadre(paire.gauche, 375, hote);
      cadre(paire.droite, 375, hote);
    } else {
      cadre(etat.variante, etat.largeur, hote);
    }

    var d = device(etat.largeur);
    var pres = presentationCourante();
    document.getElementById("scene-pied").innerHTML =
      "<b>Les reperes.</b> Le haut du cadre est le haut physique de l'ecran. Le trait gris pointille " +
      "marque la fin de la zone systeme (" + d.insetTop + " px). Le trait rouge est la ligne de flottaison : " +
      "en dessous, il faut defiler. Le rectangle du bas represente la barre d'onglets (" +
      d.tabBarContent + " px + " + d.insetBottom + " px d'inset). Calcul : " + esc(d.calcul) +
      (pres ? "<br><b>Presentation affichee.</b> " + esc(pres.titre) + " — " + esc(pres.resume) : "") +
      "<br><b>Raccourcis.</b> Fleches haut / bas : changer d'etat. <code>v</code> : variante. " +
      "<code>c</code> : paire du cote a cote. <code>e</code> : vue. <code>p</code> : panneaux. " +
      "<code>t</code> : typographie. <code>a</code> : animations. <code>w</code> : largeur.";
  }

  // -----------------------------------------------------------------------
  // Panneaux
  // -----------------------------------------------------------------------
  var ONGLETS = [
    { id: "axes", libelle: "Valider" },
    { id: "regle", libelle: "La regle" },
    { id: "etat", libelle: "Cet etat" },
    { id: "mesures", libelle: "Mesures" },
    { id: "seuils", libelle: "Limites" }
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
    if (etat.onglet === "axes") c.innerHTML = htmlAxes();
    else if (etat.onglet === "regle") c.innerHTML = htmlRegle();
    else if (etat.onglet === "seuils") c.innerHTML = htmlSeuils();
    else if (etat.onglet === "mesures") { c.innerHTML = htmlMesuresSquelette(); mesurerSousLaLigne(); balayerHauteurs(); }
    else c.innerHTML = htmlEtat();

    // Un bouton de cible ne pose pas seulement l'etat : il pose la COMBINAISON
    // entiere (etat + variante + largeur + vue + texte + presentation). Sans ca,
    // « regarde ceci en 320 px avec la typo d'avant » demanderait trois reglages
    // a la main, et on finirait par regarder autre chose que ce qui est demande.
    Array.prototype.forEach.call(c.querySelectorAll("button[data-etat]"), function (b) {
      b.onclick = function () {
        allerA(b.getAttribute("data-etat"), {
          variante: b.getAttribute("data-variante"),
          paire: b.getAttribute("data-paire"),
          largeur: b.getAttribute("data-largeur"),
          vue: b.getAttribute("data-vue"),
          x13: b.getAttribute("data-x13"),
          typo: b.getAttribute("data-typo"),
          anim: b.getAttribute("data-anim")
        });
      };
    });
    // Les axes gardent leur pli d'un rendu a l'autre : le panneau se redessine a
    // chaque changement de reglage, et un axe qui se refermerait a chaque clic
    // rendrait la comparaison impraticable.
    Array.prototype.forEach.call(c.querySelectorAll("details.axe"), function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) etat.axeOuvert = d.getAttribute("data-axe");
        else if (etat.axeOuvert === d.getAttribute("data-axe")) etat.axeOuvert = null;
      });
    });
  }

  // -----------------------------------------------------------------------
  // Panneau « Hauteurs » : mesure TOUS les etats a la largeur courante, dans
  // le navigateur, et compare a la ligne de flottaison. C'est la reponse
  // chiffree aux points 3, 9 et 10 (ce qui tient sans defiler, la moitie basse,
  // la fin d'ecran).
  // -----------------------------------------------------------------------
  var EN_TETE_HAUTEURS =
    "<tr><th>Etat</th><th>vNext</th><th>Progression</th><th>Actuel</th></tr>";

  /**
   * PANNEAU « MESURES » — trois reponses chiffrees pour la combinaison affichee :
   *   1. la hauteur de la page, et de combien elle depasse la ligne de flottaison ;
   *   2. QUELS blocs passent sous cette ligne, un par un ;
   *   3. quelle echelle typographique est active, avec le detail role par role.
   *
   * Les deux premieres sont mesurees dans le navigateur, sur la page reellement
   * generee — pas estimees. La troisieme vient du contrat.
   */
  function htmlMesuresSquelette() {
    var d = device(etat.largeur);
    var varianteMesuree = etat.variante === "duo" ? paireCourante().droite : etat.variante;
    var wMesure = etat.variante === "duo" ? 375 : etat.largeur;
    var pres = presentationCourante();

    var s = '<div class="bloc-panneau"><h3>Ce que tu regardes, en chiffres</h3>' +
      '<dl class="kv">' +
      "<dt>combinaison</dt><dd>" + esc(NOMS_VARIANTE[varianteMesuree] || varianteMesuree) +
      " · " + wMesure + " px · vue " + esc(etat.vue === "visible" ? "zone visible" : "page entiere") +
      (etat.x13 ? " · texte x" + esc(M.echelleTexte) : " · texte x1") + "</dd>" +
      "<dt>echelle typographique active</dt><dd><b>" +
      esc(pres ? pres.titre : "—") + "</b>" +
      (pres && pres.reduceMotion ? " · <b>animations reduites</b>" : "") +
      '<br><span style="color:#8DA0BC">' + esc(pres ? pres.resume : "") + "</span></dd>" +
      "<dt>ligne de flottaison</dt><dd><b>" + d.stageVisible + " px</b> — " + esc(d.calcul) + "</dd>" +
      "</dl></div>";

    s += '<div class="bloc-panneau"><h3>Hauteur de la page, et ce qui passe sous la ligne</h3>' +
      '<div id="sous-la-ligne"><p class="vide">mesure en cours…</p></div>' +
      '<p class="fin">Mesure faite dans le navigateur sur la page « page entiere » de cette ' +
      "combinaison exacte. Un bloc « sous la ligne » n\\'est pas un defaut en soi : le defilement " +
      "est accepte. Ce qui compte est CE QUI se trouve dessous — de l\\'action a faire aujourd\\'hui " +
      "ou du bilan qu\\'on va chercher.</p></div>";

    // --- l'echelle typographique, role par role -----------------------------
    var comp = M.comparaisonEchelles || [];
    if (comp.length) {
      s += '<div class="bloc-panneau"><h3>Les deux echelles, role par role</h3>' +
        '<table class="tbl"><tr><th>Role</th><th>Actuelle</th><th>Allegee</th></tr>';
      comp.forEach(function (r) {
        var change = r.actuelle.fontSize !== r.allegee.fontSize ||
          r.actuelle.fontWeight !== r.allegee.fontWeight ||
          r.actuelle.lineHeight !== r.allegee.lineHeight;
        var fmt = function (x) { return x.fontSize + " px / " + x.fontWeight + " / " + x.lineHeight; };
        s += "<tr><td>" + esc(r.usage) +
          '<br><span style="color:#8DA0BC">' + esc(r.role) + "</span></td>" +
          '<td class="num"' + (change ? ' style="color:#FFB46B"' : "") + ">" + esc(fmt(r.actuelle)) + "</td>" +
          '<td class="num"' + (change ? ' style="color:#8FE3B0"' : "") + ">" + esc(fmt(r.allegee)) + "</td></tr>";
      });
      s += "</table><p class=\\"fin\\">Lecture : taille / graisse / interligne. Roles en graisse " +
        "800 : <b>cinq</b> avant, <b>zero</b> apres — la graisse maximale de l\\'ecran est " +
        "desormais 700. Rien n\\'a ete reduit pour gagner de la hauteur : le texte courant " +
        "GRANDIT (13 → 14 px, interligne 18 → 20) et les liens aussi. Les chiffres et les " +
        "metadonnees n\\'ont pas bouge d\\'un pixel.</p></div>";
    }

    // --- le balayage de tous les etats, a la largeur courante ---------------
    s += '<div class="bloc-panneau"><h3>Hauteur de contenu — tous les etats, ' + etat.largeur + " px" +
      (etat.x13 ? " · texte x" + M.echelleTexte : "") +
      (pres && PRESENTATION_DEFAUT && pres.id !== PRESENTATION_DEFAUT.id
        ? " · " + esc(pres.court || pres.titre)
        : "") + "</h3>" +
      '<p class="fin">Ligne de flottaison a <b>' + d.stageVisible + " px</b> : au-dela, il faut " +
      "defiler. La colonne <b>Progression</b> est la variante 2 : l\\'ecart avec la colonne vNext " +
      "chiffre exactement ce que la carte coute en hauteur par rapport au lien flottant qu\\'elle " +
      "remplace. Change la typographie en haut : ce tableau se remesure, et l\\'ecart entre les " +
      "deux echelles se lit ici en pixels.</p>" +
      '<table class="tbl" id="tbl-hauteurs">' + EN_TETE_HAUTEURS +
      '<tr><td colspan="4" class="vide">mesure en cours…</td></tr></table></div>';
    return s;
  }

  // -----------------------------------------------------------------------
  // CE QUI PASSE SOUS LA LIGNE, BLOC PAR BLOC.
  //
  // Les pages generees marquent chaque bloc de premier niveau (data-fks-bloc).
  // On charge la page « page entiere » de la combinaison affichee dans une iframe
  // cachee, on releve la position de chaque bloc par rapport au haut de l'ecran,
  // et on la compare a la ligne de flottaison. C'est une MESURE, pas une
  // estimation : elle porte sur la page que le fondateur regarde.
  // -----------------------------------------------------------------------
  var jetonSousLigne = 0;

  /**
   * La MEME page, dans l'autre echelle typographique. Sert a chiffrer ce que la
   * typographie coute (ou rapporte) en hauteur, sans demander au fondateur de
   * basculer et de retenir un nombre.
   */
  function pageAutreEchelle(variante, w) {
    if (!PRESENTATION_DEFAUT) return null;
    var p = presentationCourante();
    if (!p) return null;
    var autre = presentationPour(p.echelle === "allegee" ? "actuelle" : "allegee", p.reduceMotion);
    if (!autre) return null;
    var bloc = blocDe(courant(), variante);
    var pp = bloc && bloc.pagesPresentations;
    var src = pp && pp[autre.id] ? pp[autre.id][cleVue(w, "entiere")] : null;
    return src ? { src: src, presentation: autre } : null;
  }

  function mesurerSousLaLigne() {
    var monJeton = ++jetonSousLigne;
    var varianteMesuree = etat.variante === "duo" ? paireCourante().droite : etat.variante;
    var w = etat.variante === "duo" ? 375 : etat.largeur;
    var d = device(w);
    var src = pageEntiereDe(varianteMesuree, w);
    var hote = document.getElementById("sous-la-ligne");
    if (!hote) return;
    if (!src) { hote.innerHTML = '<p class="vide">Aucune page generee pour cette combinaison.</p>'; return; }

    var cadreM = document.createElement("iframe");
    cadreM.style.cssText = "position:absolute;left:-20000px;top:0;width:" + (w + 40) +
      "px;height:12000px;border:0;visibility:hidden";
    document.body.appendChild(cadreM);
    cadreM.onload = function () {
      if (monJeton !== jetonSousLigne) { cadreM.remove(); return; }
      var blocs = [];
      var hTotal = null;
      try {
        var doc = cadreM.contentDocument;
        var dev = doc.querySelector(".device");
        hTotal = dev ? dev.offsetHeight : null;
        var base = dev ? dev.getBoundingClientRect().top : 0;
        Array.prototype.forEach.call(doc.querySelectorAll("[data-fks-bloc]"), function (el) {
          var r = el.getBoundingClientRect();
          blocs.push({
            i: el.getAttribute("data-fks-bloc"),
            haut: Math.round(r.top - base),
            bas: Math.round(r.bottom - base),
            texte: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 90)
          });
        });
      } catch (err) { hTotal = null; }
      cadreM.remove();
      if (monJeton !== jetonSousLigne) return;
      if (hTotal == null) { hote.innerHTML = '<p class="vide">mesure impossible</p>'; return; }

      var ligne = d.stageVisible;
      var reste = hTotal - ligne;
      var pct = Math.max(4, Math.min(100, Math.round((ligne / Math.max(hTotal, 1)) * 100)));
      var h = '<dl class="kv"><dt>hauteur de la page</dt><dd><b>' + hTotal + " px</b></dd>" +
        "<dt>ligne de flottaison</dt><dd><b>" + ligne + " px</b></dd>" +
        "<dt>verdict</dt><dd>" +
        (reste > 2
          ? '<span style="color:#FFB46B"><b>' + reste + " px sous la ligne</b> — il faut defiler.</span>"
          : reste < -2
          ? '<span style="color:#7BD6A6">l\\'ecran s\\'arrete <b>' + (-reste) +
            " px avant</b> la ligne : tout tient sans defiler.</span>"
          : '<span style="color:#7BD6A6">l\\'ecran finit pile a la ligne.</span>') +
        "</dd></dl>" +
        '<div class="jauge' + (reste > 2 ? " deborde" : "") + '"><i style="width:' + pct + '%"></i></div>' +
        '<p class="fin">La barre montre la part de la page visible sans defiler.</p>';

      if (!blocs.length) {
        h += '<p class="vide">Aucun bloc repere sur cette page.</p>';
      } else {
        var dessous = blocs.filter(function (b) { return b.bas > ligne; });
        h += '<p class="fin"><b>' + dessous.length + " bloc(s) sur " + blocs.length +
          " touchent ou depassent la ligne.</b>";
        // LA DISTINCTION QUI COMPTE. Une page peut depasser la ligne sans qu'un
        // seul bloc de contenu soit coupe : ce qui deborde est alors la marge de
        // fin. Confondre les deux ferait condamner un ecran qui va tres bien.
        if (!dessous.length && reste > 2) {
          h += " Aucun bloc de CONTENU n\\'est coupe : les " + reste + " px qui depassent sont la " +
            "marge de fin d\\'ecran. Le defilement existe, mais il ne cache rien.";
        }
        h += "</p><div class=\\"sousligne\\">";
        blocs.forEach(function (b) {
          var cls = b.haut >= ligne ? "dessous" : b.bas > ligne ? "coupe" : "dessus";
          var mot = cls === "dessous" ? "sous la ligne" : cls === "coupe" ? "coupe par la ligne" : "visible";
          h += '<div class="bloc-ligne ' + cls + '"><span class="pos">' + b.haut + "→" + b.bas +
            " px<br>" + mot + '</span><span>' + esc(b.texte) + "</span></div>";
        });
        h += "</div>";
      }
      hote.innerHTML = h;

      // --- ce que l'AUTRE echelle typographique donnerait, en pixels ---------
      var autre = pageAutreEchelle(varianteMesuree, w);
      if (!autre) return;
      var cadreA = document.createElement("iframe");
      cadreA.style.cssText = cadreM.style.cssText;
      document.body.appendChild(cadreA);
      cadreA.onload = function () {
        var hA = null;
        try {
          var devA = cadreA.contentDocument.querySelector(".device");
          hA = devA ? devA.offsetHeight : null;
        } catch (e2) { hA = null; }
        cadreA.remove();
        if (monJeton !== jetonSousLigne || hA == null) return;
        var ecart = hA - hTotal;
        var p = document.createElement("p");
        p.className = "fin";
        p.innerHTML = "<b>La meme page dans l\\'autre echelle (" + esc(autre.presentation.titre) +
          ") : " + hA + " px</b> — soit " +
          (Math.abs(ecart) <= 2
            ? "la MEME hauteur, a " + Math.abs(ecart) + " px pres. L\\'allegement typographique ne " +
              "coute donc rien en hauteur sur cet ecran : c\\'est un choix de lisibilite, pas un " +
              "arbitrage contre le defilement."
            : (ecart > 0 ? ecart + " px de PLUS" : (-ecart) + " px de MOINS") +
              " que ce qui est affiche.");
        hote.appendChild(p);
      };
      cadreA.src = autre.src;
    };
    cadreM.src = src;
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
    // Les 15 etats de la variante 1, puis les 6 cas de la variante 2. Sur une
    // ligne de variante 2, la colonne vNext est celle de l'ecran d'accueil
    // utilise : c'est bien la comparaison qui a un sens.
    var liste = M.ordreEtats.map(function (id) { return { id: id, v2: false }; })
      .concat(ordreV2().map(function (id) { return { id: id, v2: true }; }));

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
      t.innerHTML = EN_TETE_HAUTEURS + lignes.join("");
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

    // Les pages de la PRESENTATION affichee, avec repli documente sur celle par
    // defaut. Sans ce repli, le tableau afficherait des trous en typo « actuelle »
    // pour la colonne « Home actuel », qui n'a pas ce reglage.
    var presBalayage = presentationCourante();
    function pagesDe(bloc) {
      if (!bloc) return null;
      var pp = bloc.pagesPresentations;
      if (presBalayage && pp && pp[presBalayage.id] && pp[presBalayage.id][etat.largeur + suffixe]) {
        return pp[presBalayage.id][etat.largeur + suffixe];
      }
      return bloc.pages ? bloc.pages[etat.largeur + suffixe] : null;
    }

    function suivant() {
      if (monJeton !== jetonBalayage) { cadre.remove(); return; }
      if (i >= liste.length) { cadre.remove(); peindre(); return; }
      var ligne = liste[i];
      var e = ligne.v2 ? etatsV2()[ligne.id] : M.etats[ligne.id];
      if (!e) { i += 1; suivant(); return; }
      mesurerUn(pagesDe(e.vnext), function (hv) {
        mesurerUn(pagesDe(e.vnext2), function (h2) {
          mesurerUn(pagesDe(e.actuel), function (ha) {
            var nom = ligne.v2
              ? '<span style="color:var(--v2)">' + esc(e.titre) + "</span>" +
                '<br><span style="font-size:10px;color:#8DA0BC">sur « ' + esc(e.hoteTitre) + " »</span>"
              : esc(e.titre);
            lignes.push("<tr><td>" + nom + "</td>" + cellule(hv) + cellule(h2) + cellule(ha) + "</tr>");
            peindre();
            i += 1;
            suivant();
          });
        });
      });
    }
    suivant();
  }

  function listePoints(points, ouvrirLePremier) {
    var s = "";
    points.forEach(function (p, i) {
      var liens = p.etats.map(function (id) {
        var e = M.etats[id] || etatsV2()[id];
        if (!e) return "";
        return '<button data-etat="' + esc(id) + '">' + esc(e.titre) + "</button>";
      }).join("");
      s += '<details class="point"' + (ouvrirLePremier && i === 0 ? " open" : "") + '><summary>' +
        (i + 1) + ". " + esc(p.titre) + "</summary><div class=\\"corps\\">" +
        '<div class="bloc"><span class="cle">Quoi regarder</span>' + esc(p.regarder) + "</div>" +
        '<div class="bloc"><span class="cle">Ce qui vaut oui, ce qui vaut non</span>' + esc(p.tranche) + "</div>" +
        '<div class="bloc"><span class="cle">Ou le regarder</span><div class="liens">' +
        (liens || '<span class="vide">aucun etat genere</span>') + "</div></div>" +
        "</div></details>";
    });
    return s;
  }

  function htmlPoints() {
    var v2 = estVariante2(etat.etatId);
    var pointsV2 = M.pointsProgression || [];

    // L'ordre suit ce qu'on regarde : sur un etat de variante 2, ses points
    // passent devant. On ne cache jamais l'autre serie.
    var blocV1 = '<div class="sep-panneau bleu">Variante 1 — l\\'ecran valide (' +
      M.points.length + " points)</div>" + listePoints(M.points, false);
    var blocV2 = pointsV2.length
      ? '<div class="sep-panneau">Variante 2 — la carte progression (' + pointsV2.length +
        " points)</div>" + listePoints(pointsV2, false)
      : "";

    return (v2 ? blocV2 + blocV1 : blocV1 + blocV2);
  }

  // -----------------------------------------------------------------------
  // PANNEAU « VALIDER » — un jugement par AXE, pas par ecran.
  //
  // C'est le panneau principal de cette iteration. Il repond a une demande
  // precise : pouvoir dire OUI a la typographie et NON a la hauteur sans que
  // les deux verdicts se contaminent.
  //
  // Chaque axe porte sa BASCULE (le reglage a manipuler) et ses CIBLES, qui sont
  // des combinaisons completes : un clic pose l'etat, la variante, la largeur, la
  // vue, l'echelle de texte et la presentation d'un seul coup.
  // -----------------------------------------------------------------------

  /** La cible correspond-elle EXACTEMENT a ce qui est affiche ? */
  function cibleActive(c) {
    if (c.etat !== etat.etatId) return false;
    var v = c.variante || (estVariante2(c.etat) ? "vnext2" : "vnext");
    if (v !== etat.variante) return false;
    if (v === "duo" && c.paire && c.paire !== etat.paire) return false;
    if (v !== "duo" && Number(c.largeur || 375) !== etat.largeur) return false;
    if ((c.vue || "visible") !== etat.vue) return false;
    if (Boolean(c.x13) !== etat.x13) return false;
    // Une cible qui ne DECLARE pas de presentation n'en impose pas : l'axe de la
    // pastille d'en-tete, par exemple, se juge dans n'importe quelle typographie.
    // La contraindre au defaut ferait clignoter le bouton actif d'un axe a
    // l'autre sans raison.
    if (!c.presentation) return true;
    var pres = presentationParId(c.presentation);
    if (!pres) return false;
    return pres.echelle === etat.typo && Boolean(pres.reduceMotion) === Boolean(etat.anim);
  }

  function boutonCible(c) {
    var connu = M.etats[c.etat] || etatsV2()[c.etat];
    if (!connu) {
      // Une cible qui pointe sur un etat non genere ne devient PAS un bouton
      // mort : elle se dit, avec la raison. Sinon le fondateur cliquerait dans
      // le vide sans comprendre.
      return '<span class="vide">' + esc(c.libelle) + " — etat non genere</span>";
    }
    var pres = c.presentation ? presentationParId(c.presentation) : null;
    var v = c.variante || (estVariante2(c.etat) ? "vnext2" : "vnext");
    return '<button class="' + (cibleActive(c) ? "actif" : "") + '"' +
      ' data-etat="' + esc(c.etat) + '"' +
      ' data-variante="' + esc(v) + '"' +
      (c.paire ? ' data-paire="' + esc(c.paire) + '"' : "") +
      ' data-largeur="' + esc(c.largeur || 375) + '"' +
      ' data-vue="' + esc(c.vue || "visible") + '"' +
      ' data-x13="' + (c.x13 ? "1" : "0") + '"' +
      (pres ? ' data-typo="' + esc(pres.echelle) + '" data-anim="' + (pres.reduceMotion ? "1" : "0") + '"' : "") +
      ">" + esc(c.libelle) + "</button>";
  }

  function htmlAxes() {
    var axes = M.axes || [];
    var s = '<div class="bloc-panneau"><h3>Sept axes, sept verdicts separes</h3>' +
      "<p>Chaque axe se juge SEUL : tu peux dire oui a la typographie et non a la hauteur, ils ne " +
      "se contaminent pas. Chaque axe dit quel reglage manipuler, et ses boutons posent la " +
      "combinaison entiere — etat, largeur, vue, texte et presentation d'un seul coup.</p>" +
      '<p class="fin">Un bouton en bleu plein = c\\'est exactement ce que tu regardes en ce moment.</p></div>';

    if (!axes.length) {
      s += '<p class="vide">Aucun axe declare (lib/axesAValider.js absent ?).</p>';
    }
    axes.forEach(function (a) {
      var ouvert = etat.axeOuvert === a.id;
      s += '<details class="axe" data-axe="' + esc(a.id) + '"' + (ouvert ? " open" : "") + ">" +
        '<summary><span class="nom">' + esc(a.titre) + "</span></summary>" +
        '<div class="corps">' +
        '<div class="q">' + esc(a.question) + "</div>" +
        '<div class="bascule"><span class="t">La bascule a manipuler</span>' + esc(a.bascule) + "</div>" +
        '<div class="bloc"><span class="cle">Quoi regarder</span>' + esc(a.regarder) + "</div>" +
        '<div class="verdict">' +
        '<div class="v-oui"><span class="t">ca vaut oui</span>' + esc(a.oui) + "</div>" +
        '<div class="v-non"><span class="t">ca vaut non</span>' + esc(a.non) + "</div>" +
        "</div>" +
        '<div class="bloc"><span class="cle">Ou le regarder — un clic pose tout</span>' +
        '<div class="cibles">' + (a.cibles || []).map(boutonCible).join("") + "</div></div>" +
        "</div></details>";
    });

    // --- la couverture demandee --------------------------------------------
    var couv = M.couverture || [];
    if (couv.length) {
      s += '<div class="sep-panneau bleu">Les huit situations demandees, et ou chacune se regarde</div>' +
        '<table class="tbl"><tr><th>Situation</th><th>Ce qu\\'on y voit</th></tr>';
      couv.forEach(function (c) {
        s += "<tr><td>" + boutonCible({
          libelle: c.situation,
          etat: c.cible.etat,
          variante: c.cible.variante,
          largeur: c.cible.largeur,
          vue: c.cible.vue,
          x13: c.cible.x13,
          presentation: c.cible.presentation
        }) + "</td><td>" + esc(c.ceQuOnVoit) + "</td></tr>";
      });
      s += "</table>";
    }

    // --- ce qui a change depuis l'iteration precedente ----------------------
    var chg = M.iterationChangements || [];
    if (chg.length) {
      s += '<div class="sep-panneau">« Progression integree » — avant / apres</div>' +
        '<p class="fin">Cinq changements depuis la version que tu as validee. Un seul est ' +
        "rejouable par une bascule : la typographie, parce que l\\'ancienne echelle a ete gardee " +
        "expres. Les autres ont REMPLACE ce qui existait — l\\'ancien selecteur de test a ete " +
        "supprime, les anciennes dates de fixture aussi. Fabriquer une fausse page « avant » " +
        "serait exactement l\\'erreur que cette iteration corrige : on ne la refait pas dans " +
        "l\\'outil qui sert a la juger. Ce qui n\\'est pas rejouable est donc CHIFFRE a cote.</p>";
      chg.forEach(function (c) {
        var badge = c.rejouable === "oui"
          ? '<span class="badge badge-ok">rejouable par une bascule</span>'
          : c.rejouable === "mesure"
          ? '<span class="badge badge-neutre">non rejouable — chiffre a cote</span>'
          : '<span class="badge badge-neutre">non rejouable — ajout</span>';
        s += '<details class="point"><summary>' + esc(c.titre) + "</summary>" +
          '<div class="corps">' +
          '<div class="bloc">' + badge + "</div>" +
          '<div class="bloc"><span class="cle">Ce qui change</span>' + esc(c.quoi) + "</div>" +
          '<div class="bloc"><span class="cle">A savoir</span>' + esc(c.aSavoir) + "</div>" +
          '<div class="bloc"><span class="cle">Ou le voir</span>' + esc(c.ouLeVoir) + "</div>" +
          "</div></details>";
      });
      (M.iterationInchange || []).forEach(function (t) {
        s += '<p class="fin">— ' + esc(t) + "</p>";
      });
    }

    // --- l'ancienne liste, point par point : rien n'est perdu ---------------
    s += '<div class="sep-panneau bleu">Le detail, point par point (la liste precedente)</div>' +
      '<p class="fin">Elle reste : elle est faite pour relire l\\'ecran de bout en bout, la ou les ' +
      "axes ci-dessus servent a trancher un sujet a la fois. Les deux disent la meme chose, " +
      "rangee autrement.</p>" + htmlPoints();
    return s;
  }

  /**
   * Bloc TOUJOURS visible en tete du panneau : les deux questions qu'on doit
   * pouvoir se poser a tout moment devant un chiffre.
   *   1. Sur QUOI la tendance est-elle calculee ? (R3 — la portee)
   *   2. L'ecran ose-t-il annoncer un etat physique global ? (R4)
   * Les deux reponses sont tirees du contrat de l'etat courant, jamais ecrites
   * en dur ici.
   */
  function htmlPorteeEtEtatGlobal() {
    var e = courant();
    if (!e || estExtra()) return "";
    var v2 = estVariante2(etat.etatId);
    var pv = v2 && e.vnext2 ? e.vnext2.viewModel : null;
    var hv = e.vnext ? e.vnext.viewModel : null;

    // --- 1. la portee ------------------------------------------------------
    var portee = null;
    var sansCourbe = null;
    if (v2) {
      if (pv && pv.courbe) portee = pv.courbe.portee;
      else if (pv && pv.tendanceIndisponible) sansCourbe = pv.tendanceIndisponible.explication;
      else sansCourbe = "Aucune courbe : rien de mesure sur cet etat.";
    } else if (hv) {
      if (hv.porteeForme) portee = hv.porteeForme;
      else sansCourbe = hv.raisonSansCourbe || "Aucune courbe sur cet etat.";
    }

    var s = '<div class="encadre-portee"><span class="t">Portee de la tendance — etat courant</span>';
    if (portee) {
      s += '<div class="phrase">« ' + esc(portee) + " »</div>" +
        '<div class="sous">Cette phrase doit etre LISIBLE a cote de la courbe, sur l\\'ecran ' +
        'lui-meme. Une trajectoire batie sur les seules seances FKS n\\'est pas l\\'etat physique ' +
        'du joueur : les entrainements club et les matchs n\\'y sont pas.</div>';
    } else {
      s += '<div class="phrase">Aucune courbe affichee sur cet etat.</div>' +
        '<div class="sous">' + esc(sansCourbe || "") + "</div>";
    }
    s += "</div>";

    // --- 2. l'etat physique global (D1) ------------------------------------
    //
    // DECISION DU FONDATEUR D1 (2026-07-28) : la pastille d'etat global est
    // RETIREE COMPLETEMENT de la variante 2. Ce panneau doit dire COMMENT, et
    // la reponse a change depuis l'iteration precedente : ce n'est plus un
    // verrou conditionne aux charges club, c'est une SUPPRESSION du contrat,
    // des deux cotes.
    //
    // ATTENTION : ce commentaire vit DANS un litteral de gabarit — pas de
    // caracteres accent grave ici, ils termineraient la chaine (erreur de
    // syntaxe au build). Les noms de champs sont donc cites entre guillemets.
    //
    // Le champ "etatGlobal" n'existe donc plus dans le ViewModel — ni le type
    // "ProgressionEtatGlobal", ni le champ d'entree "libelleEtatGlobal". Les
    // branches qui les lisaient ont ete RETIREES plutot que laissees a tourner
    // a blanc : elles affichaient une explication devenue fausse (« le type
    // d'entree ne porte le champ que si les charges club sont capturees »),
    // c'est-a-dire exactement le verrou conditionnel que le fondateur a refuse.
    s += '<div class="encadre-portee"><span class="t">Etat physique global — D1</span>';
    if (v2) {
      s += '<div class="phrase"><span class="badge badge-ok">rien d\\'annonce</span> ' +
        "La carte n\\'ecrit aucun libelle d\\'etat global, et l\\'en-tete non plus.</div>" +
        '<div class="sous">Ce n\\'est ni une convention de redaction, ni un verrou qu\\'un ' +
        "drapeau pourrait rouvrir : le champ de sortie (<code>etatGlobal</code>) et le champ " +
        "d\\'entree (<code>libelleEtatGlobal</code>) ont ete <b>supprimes du contrat</b>. " +
        "Aucune valeur d\\'entree ne peut donc faire ressortir « En forme » ou « Frais ». " +
        "Motif du fondateur : le modele de charge part encore de valeurs initiales " +
        "artificielles (ATL0 / CTL0) et ignore les entrainements club — aucun booleen ne " +
        "rendrait ce libelle honnete aujourd\\'hui. Une pastille « Charge FKS » ne pourra " +
        "revenir que le jour ou son calcul reposera sur des donnees entierement reelles, avec " +
        "une portee expliquee.</div>";
    } else {
      s += '<div class="phrase">La carte progression n\\'existe pas sur cet etat.</div>';
    }
    // LA PASTILLE D'EN-TETE — le seul endroit du panneau ou les deux colonnes ne
    // disent PAS la meme chose.
    //
    // hv.pastilleEtat est ce que la VARIANTE 1 affiche ; e.vnext2.pastilleEtat
    // ce que la VARIANTE 2 affiche reellement (mesure sur son propre ViewModel,
    // jamais suppose). Le second vaut null PARTOUT, et pas « tant que les
    // charges club ne sont pas capturees » : l'ecran retire lui-meme le
    // stateChip en variante 2, et le champ qui l'alimentait n'existe plus.
    // La branche « les deux colonnes affichent la pastille » est donc devenue
    // inatteignable ; elle est conservee sous forme d'ALERTE, parce qu'un
    // panneau qui garde une explication inatteignable la fait lire comme un cas
    // normal, alors que ce serait un ecart avec D1.
    if (hv && hv.pastilleEtat) {
      var pastilleV2 = v2 && e.vnext2 ? e.vnext2.pastilleEtat || null : null;
      if (v2) {
        s += '<div class="sous"><b>Ecart entre les deux colonnes :</b> l\\'en-tete de la ' +
          'VARIANTE 1 affiche la pastille « ' + esc(hv.pastilleEtat) + ' » — un etat physique ' +
          'GLOBAL. En VARIANTE 2 elle est <b>retiree</b> (decision D1) : un ecran ne peut pas ' +
          'annoncer un etat puis ecrire 200 px plus bas que les entrainements club n\\'y sont ' +
          'pas comptes. La variante 1 la garde volontairement, pour que l\\'ecart se voie. ' +
          'A regarder cote a cote avant de trancher.' +
          (pastilleV2
            ? ' <b>ANOMALIE — ECART AVEC D1 :</b> la variante 2 affiche pourtant « ' +
              esc(pastilleV2) + ' ». Cela ne devrait plus etre possible.'
            : "") +
          "</div>";
      } else {
        s += '<div class="sous"><b>A savoir :</b> l\\'en-tete de l\\'ecran affiche la pastille ' +
          '« ' + esc(hv.pastilleEtat) + ' ». C\\'est le bloc d\\'en-tete de la VARIANTE 1, et ' +
          'non la carte. La variante 2, elle, ne l\\'affiche <b>plus du tout</b> (decision D1) : ' +
          'le champ qui l\\'alimentait a ete supprime du contrat, aucune valeur d\\'entree ne ' +
          'peut le faire revenir. La variante 1 la conserve pour que la comparaison reste ' +
          'visible.</div>';
      }
    }
    s += "</div>";
    return s;
  }

  // -----------------------------------------------------------------------
  // PANNEAU « LA REGLE » — la decision produit qui attend d'etre validee.
  //
  // La carte n'affiche qu'UN test. Lequel, et pourquoi ? Trois etages, un
  // tableau cycle -> test, et un ordre de departage fige. Rien de tout ca n'est
  // visible a l'ecran produit — c'est normal, le joueur n'a pas a lire une regle.
  // Mais le fondateur, lui, doit pouvoir la contester ligne par ligne.
  // -----------------------------------------------------------------------
  function htmlRepereCourant() {
    var e = courant();
    if (!e || estExtra()) return "";
    if (!estVariante2(etat.etatId)) {
      return '<div class="repere vide"><span class="t">Repere de test — etat courant</span>' +
        '<div class="gros">Cet ecran n\\'a pas de carte progression.</div>' +
        '<div class="sous">Le repere de test est une decision de la CARTE. Choisis un des sept ' +
        "cas du groupe « Variante 2 », en bas de la liste de gauche.</div></div>";
    }
    var r = e.vnext2 && e.vnext2.repere;
    if (!r) {
      return '<div class="repere vide"><span class="t">Repere de test — etat courant</span>' +
        '<div class="gros">Selecteur indisponible.</div></div>';
    }

    var s = "";
    if (r.etat === "affiche") {
      s += '<div class="repere"><span class="t">Le test affiche, et pourquoi</span>' +
        '<div class="gros">' + esc(r.label) + "</div>" +
        '<div class="chiffre">' + esc(r.avant) + "  →  " + esc(r.apres) + "   <b>" + esc(r.ecart) +
        "</b>  (" + esc(r.sens === "amelioration" ? "en progres" : r.sens === "regression" ? "en retrait" : "identique") +
        ")</div>" +
        '<div class="sous"><b>' +
        (r.regle === "objectif_du_cycle" ? "REGLE 1" : r.departageApplique ? "REGLES 2 + 3" : "REGLE 2") +
        ".</b> " + esc(r.motif) + "</div>" +
        '<div class="sous">Mesures comparees : ' + esc(r.jours) + ".</div></div>";
    } else if (r.etat === "aucune") {
      s += '<div class="repere vide"><span class="t">Repere de test — etat courant</span>' +
        '<div class="gros">Aucun repere affiche.</div>' +
        '<div class="sous">' + esc(r.explication || "") +
        (r.raison ? ' <span style="color:#8DA0BC">(' + esc(r.raison) + ")</span>" : "") +
        " La carte ne fabrique pas une comparaison pour remplir la place.</div></div>";
    } else {
      s += '<div class="repere vide"><span class="t">Repere de test — etat courant</span>' +
        '<div class="gros">Hors sujet sur cet etat.</div>' +
        '<div class="sous">' + esc(r.explication || "") + "</div></div>";
    }

    // --- le cycle actif, et ce qu'il designe --------------------------------
    s += '<div class="bloc-panneau"><h3>Le cycle actif de ce joueur</h3>';
    if (r.cycleActif) {
      s += "<p><b>" + esc(r.libelleCycle || r.cycleActif) + "</b> — test attitre : <b>" +
        (r.champDuCycle
          ? esc(libelleChamp(r.champDuCycle))
          : "AUCUN, volontairement") + "</b></p>" +
        justification(r.fondementCycle, r.ecarteCycle);
    } else {
      s += '<p class="fin">Aucun cycle actif sur cette fixture : la regle 1 ne peut pas mordre.</p>';
    }
    s += "</div>";

    // --- les concurrents, et l'effet de la regle 1 --------------------------
    if (r.candidats && r.candidats.length) {
      s += '<div class="bloc-panneau"><h3>Ce qui etait comparable, et ce qui a ete retenu</h3>' +
        '<table class="tbl"><tr><th>Test</th><th>Derniere mesure</th><th>Ecart</th></tr>';
      r.candidats.forEach(function (c) {
        s += '<tr class="' + (c.retenu ? "retenu" : "") + '"><td>' + esc(c.label) +
          (c.retenu ? ' <span class="badge badge-ok">affiche</span>' : "") + "</td>" +
          '<td class="num">' + esc(c.jourApres) +
          (c.auPlusRecent ? '<br><span style="font-size:10px;color:#8DA0BC">le plus recent</span>' : "") +
          '</td><td class="num">' + esc(c.ecart) + "</td></tr>";
      });
      s += "</table>";
      if (r.exAequoAuPlusRecent > 1) {
        s += '<p class="fin"><b>' + esc(r.exAequoAuPlusRecent) + " tests partagent le meme " +
          "horodatage.</b> Ce n\\'est pas un hasard : une batterie du socle est enregistree en UNE " +
          "seule fois, donc ses trois tests portent la meme date A LA SECONDE. L\\'egalite est le " +
          "cas NORMAL, pas l\\'exception — c\\'est pour ca qu\\'un ordre de departage fige existe.</p>";
      }
      if (r.regle2Seule) {
        s += '<p class="fin"><b>Ce que la regle 2 SEULE aurait designe :</b> ' +
          esc(r.regle2Seule.label) + " (" + esc(r.regle2Seule.ecart) + ")." +
          (r.regle1Determinante
            ? " C\\'est DIFFERENT du test affiche : sur cet etat, la regle 1 — l\\'objectif du " +
              "cycle — change le resultat. Sans le tableau cycle -> test, c\\'est cet autre test " +
              "qui serait a l\\'ecran."
            : " C\\'est le MEME test : sur cet etat, la regle 1 ne change rien au resultat.") +
          '<br><span style="color:#8DA0BC">Calcul fait par la fonction du produit, avec « aucun ' +
          "cycle actif » — pas par une reconstitution du harnais. C\\'est la meme question que " +
          "posait la version precedente de la carte.</span></p>";
      }
      s += "</div>";
    }
    return s;
  }

  /**
   * La justification d'une ligne du tableau cycle -> test, REPLIEE.
   *
   * Ces textes citent le depot mot pour mot : ils contiennent des noms de
   * fichiers et de variables. C'est ce qui les rend verifiables — et illisibles
   * pour quelqu'un qui n'ecrit pas de code. On les garde donc integralement, mais
   * derriere un pli : le tableau reste lisible, et la preuve reste a un clic. Les
   * couper ou les reformuler les rendrait invérifiables, ce qui est pire.
   */
  function justification(fondement, ecarte) {
    if (!fondement && !ecarte) return "";
    return '<details class="point"><summary>Pourquoi cette ligne (citations du code)</summary>' +
      '<div class="corps">' +
      (fondement ? '<div class="bloc"><span class="cle">Ce qui la fonde</span>' + esc(fondement) + "</div>" : "") +
      (ecarte ? '<div class="bloc"><span class="cle">Ce qui a ete envisage puis ecarte</span>' + esc(ecarte) + "</div>" : "") +
      "</div></details>";
  }

  /** Libelle francais d'un champ de test, depuis l'ordre de departage publie. */
  function libelleChamp(champ) {
    var o = M.ordreDepartageProgression || [];
    for (var i = 0; i < o.length; i++) if (o[i].champ === champ) return o[i].label;
    return champ;
  }

  function htmlRegle() {
    var s = htmlPorteeEtEtatGlobal();
    s += htmlRepereCourant();

    // --- le tableau cycle -> test ------------------------------------------
    var map = M.mappingCyclesProgression || [];
    if (map.length) {
      s += '<div class="sep-panneau">Le tableau cycle → test — DECISION PRODUIT, elle t\\'attend</div>' +
        '<p class="fin">La carte n\\'affiche qu\\'UN test. Premiere regle : celui que vise le cycle ' +
        "actif. Ce tableau dit lequel, pour chacun des cinq cycles. Deux cycles n\\'ont " +
        "volontairement aucun test attitre : ils ne promettent d\\'ameliorer aucune qualite " +
        "precise, et leur en accrocher un ferait dire a l\\'ecran une chose que le cycle ne fait " +
        "pas. Chaque ligne se change en une minute — dis simplement laquelle est fausse.</p>" +
        '<table class="tbl"><tr><th>Cycle</th><th>Test mis en avant</th></tr>';
      map.forEach(function (l) {
        s += "<tr><td><b>" + esc(l.libelleCycle) + "</b>" +
          justification(l.fondement, l.ecarte) +
          "</td><td>" +
          (l.champ
            ? "<b>" + esc(libelleChamp(l.champ)) + "</b>"
            : '<span class="badge badge-neutre">aucun</span>') +
          "</td></tr>";
      });
      s += "</table>";
    }

    // --- l'ordre de departage ----------------------------------------------
    var ordre = M.ordreDepartageProgression || [];
    if (ordre.length) {
      s += '<div class="sep-panneau">L\\'ordre qui departage a egalite (regle 3)</div>' +
        '<p class="fin">Quand plusieurs tests partagent l\\'horodatage le plus recent — le cas ' +
        "NORMAL, puisqu\\'une batterie est enregistree en une fois — cet ordre tranche. Il est fige " +
        "au chargement, il ne lit AUCUNE valeur de test : un resultat en recul sort exactement " +
        "comme un resultat en progres. Les trois tests du socle passent devant les optionnels, " +
        "parce qu\\'ils existent chez tout le monde.</p>" +
        '<table class="tbl"><tr><th>#</th><th>Test</th></tr>';
      ordre.slice(0, 6).forEach(function (o) {
        s += '<tr><td class="num">' + esc(o.rang) + "</td><td>" + esc(o.label) +
          (o.socle ? ' <span class="badge badge-ok">socle</span>' : "") +
          (o.pourquoi ? '<br><span style="color:#8DA0BC">' + esc(o.pourquoi) + "</span>" : "") +
          "</td></tr>";
      });
      s += "</table>";
      if (ordre.length > 6) {
        s += '<p class="fin">Puis, dans l\\'ordre : ' +
          ordre.slice(6).map(function (o) { return esc(o.label); }).join(", ") + ".</p>";
      }
      s += '<p class="fin"><b>Ce que la regle ne fait JAMAIS.</b> Elle ne regarde ni le signe ni ' +
        "l\\'amplitude du resultat. Ce n\\'est pas une intention mais une contrainte du code : la " +
        "fonction qui choisit ne recoit QUE deux informations par test — lequel c\\'est, et sa " +
        "date. L\\'ecart, son sens et sa valeur ne lui sont pas transmis. Trier par « meilleure " +
        "progression » ne peut donc pas s\\'ecrire sans changer ce qu\\'elle recoit, et ce " +
        "changement se voit en une ligne.</p>";
    }

    return s + htmlSeuilsAffichage();
  }

  /** Les seuils qui decident de ce que l'ecran a le droit de MONTRER. */
  function htmlSeuilsAffichage() {
    var s = '<div class="sep-panneau bleu">Seuils d\\'affichage — a valider par le fondateur</div>';
    s += '<div class="bloc-panneau"><h3>L\\'ecran</h3>' +
      '<table class="tbl"><tr><th>Seuil</th><th>Valeur</th><th>Role</th></tr>';
    (M.seuils || []).forEach(function (x) {
      s += "<tr><td class=\\"num\\">" + esc(x.nom) + '</td><td class="num">' + esc(x.valeur) +
        "</td><td>" + esc(x.role) + "</td></tr>";
    });
    s += "</table><p class=\\"fin\\">Aucun de ces seuils ne touche a une seance, une charge ou une " +
      "intensite. Ils decident seulement de ce que l\\'ECRAN a le droit de MONTRER quand la donnee " +
      "est maigre.</p></div>";

    // seuils d'affichage — variante 2
    if (M.seuilsProgression && M.seuilsProgression.length) {
      s += '<div class="bloc-panneau"><h3>Seuils de la carte progression — a valider par le fondateur</h3>' +
        '<table class="tbl"><tr><th>Seuil</th><th>Valeur</th><th>Role</th></tr>';
      M.seuilsProgression.forEach(function (x) {
        s += "<tr><td class=\\"num\\">" + esc(x.nom) + '</td><td class="num">' + esc(x.valeur) +
          "</td><td>" + esc(x.role) + "</td></tr>";
      });
      s += "</table><p class=\\"fin\\">Memes garanties : aucun de ces seuils ne modifie une seance, " +
        "une charge, une intensite ou une prescription. Les deux premiers sont volontairement " +
        "REPRIS de l\\'ecran (memes valeurs, meme source) : la carte et le bloc de forme vivent sur " +
        "le meme ecran, et deux seuils differents produiraient un ecran qui se contredit. Le " +
        "troisieme est un compte DISTINCT des points de courbe : des points adosses a zero jour " +
        "reellement enregistre ne dessinent pas un joueur. Le quatrieme exige deux JOURS " +
        "differents pour comparer deux tests — c\\'est ce que la page Progression actuelle ne " +
        "verifie pas, et qui lui fait afficher une progression entre deux essais du meme " +
        "apres-midi.</p></div>";
    }
    return s;
  }

  // -----------------------------------------------------------------------
  // PANNEAU « LIMITES » — ce qui est faux ici, et ce qui ne se juge pas ici.
  // Regarder un ecran sans savoir ce qui est faux dedans, c'est valider une
  // illusion.
  // -----------------------------------------------------------------------
  function htmlSeuils() {
    var s = "";

    // La politique d'agrandissement : elle explique pourquoi les pages x1,3 de
    // cet outil sont PLUS etirees que ce que verra un vrai telephone.
    var pol = M.politiqueAgrandissement || [];
    if (pol.length) {
      s += '<div class="bloc-panneau"><h3>Texte agrandi : ce qui grandit sans limite, et ce qui s\\'arrete</h3>' +
        "<p>Le reglage d'agrandissement du telephone n'est JAMAIS desactive. Trois textes " +
        "d'AFFICHAGE cessent tout de meme de grandir a un moment : ils ne portent aucune " +
        "information, et les laisser filer volerait la place a ceux qui en portent. Tout le " +
        "reste — les chiffres, le texte courant, la portee de la mesure, les liens — grandit " +
        "autant que le systeme le demande.</p>" +
        '<table class="tbl"><tr><th>Texte</th><th>Plafond</th></tr>';
      pol.forEach(function (p) {
        s += "<tr><td>" + esc(p.texteConcerne) +
          '<br><span style="color:#8DA0BC">' + esc(p.raison) + "</span></td>" +
          '<td class="num">' +
          (p.plafond == null
            ? '<span class="badge badge-ok">aucun</span>'
            : "x" + esc(p.plafond)) +
          "</td></tr>";
      });
      s += "</table>" +
        '<div class="avertissement"><span class="t">a savoir en regardant les pages x' +
        esc(M.echelleTexte) + "</span>Ce visualiseur ne sait pas reproduire ces plafonds : ses " +
        "pages « x" + esc(M.echelleTexte) + " » multiplient TOUTES les tailles de texte. Elles " +
        "montrent donc le PIRE CAS. Sur telephone, la mise en page sera moins etiree que ce que " +
        "tu vois ici — jamais plus. Si elle tient ici, elle tient la-bas.</div></div>";
    }

    // La regle de mouvement, en toutes lettres.
    var rm = M.regleMouvement || [];
    if (rm.length) {
      s += '<div class="bloc-panneau"><h3>Le mouvement — la regle appliquee</h3><table class="tbl">';
      rm.forEach(function (r) { s += "<tr><td>" + esc(r) + "</td></tr>"; });
      s += "</table>" +
        '<p class="fin">Une capture ne peut pas montrer un mouvement, et encore moins son ' +
        "ABSENCE. C\\'est pour ca que le reglage « animations reduites » se verifie par un compteur " +
        "(onglet « Cet etat ») et non a l\\'oeil : au repos, les deux rendus sont identiques — " +
        "c\\'est precisement le resultat voulu.</p></div>";
    }

    // Ce que la verification de reproductibilite a trouve dans le Home ACTUEL.
    var pu = M.pulsationHomeActuel;
    if (pu && pu.etatsConcernes) {
      s += '<div class="bloc-panneau"><h3>Trouve en verifiant que deux generations donnent le meme resultat</h3>' +
        '<div class="avertissement"><span class="t">defaut du Home de production — hors perimetre</span>' +
        "Deux generations successives produisent des fichiers RIGOUREUSEMENT identiques… sauf pour " +
        "le Home de production, sur <b>" + esc(pu.etatsConcernes) + " etats</b>. La cause : son " +
        "bouton principal joue une pulsation EN BOUCLE, sans jamais consulter le reglage " +
        "« reduire les animations » du telephone. La capture attrape la boucle a un endroit " +
        "different a chaque fois." +
        "<br><br>Amplitude declaree dans le code de production : <b>" +
        esc(pu.amplitudeDeclaree || "") + "</b>. Au repos, l\\'echelle du bouton devrait valoir " +
        "exactement 1 sur toutes ces pages ; elle vaut autre chose, et une autre chose a chaque " +
        "generation. (Les valeurs relevees ne sont volontairement pas publiees ici : elles " +
        "changeraient a chaque build, et feraient echouer le controle d\\'idempotence du prototype " +
        "pour une raison qui ne le concerne pas.)" +
        "<br><br><b>Ce que ca prouve.</b> Ce harnais FORCE « mouvement reduit » avant chaque " +
        "rendu. Si le bouton de production consultait ce reglage, il serait immobile. Il pulse " +
        "quand meme : la preference d\\'accessibilite n\\'est donc pas respectee en production " +
        "aujourd\\'hui. Le prototype, lui, n\\'a aucune boucle — c\\'est mesure sur les 15 etats." +
        "<br><br>Non corrige ici : l\\'ecran de production est hors du perimetre de ce travail.</div></div>";
    }

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

  /**
   * Tout ce qui est propre a la variante 2 pour l'etat courant : ce que le
   * contrat de la carte a decide, ce que la mesure a reellement compte dans le
   * rendu, et ce que l'appariement coute.
   */
  function htmlEtatVariante2(e) {
    var s = "";
    var pv = e.vnext2 && e.vnext2.viewModel;

    // --- ce que le contrat de la carte decide -------------------------------
    s += '<div class="bloc-panneau"><h3>La carte progression — ce que le contrat decide</h3>';
    if (!pv) {
      s += '<p class="vide">Selecteur de carte indisponible.</p>';
    } else {
      s += '<dl class="kv"><dt>etat de la carte</dt><dd><b>' + esc(pv.etat) + "</b> — " +
        esc(pv.titre) + "</dd>";
      if (pv.reperes) s += "<dt>reperes</dt><dd>" + pv.reperes.map(esc).join("<br>") + "</dd>";
      if (pv.mention) s += "<dt>mention</dt><dd>" + esc(pv.mention) + "</dd>";
      if (pv.faits && pv.faits.length) {
        s += "<dt>faits affiches</dt><dd>" + pv.faits.map(function (f) {
          return esc(f.libelle) + " : <b>" + esc(f.valeur) + "</b>";
        }).join("<br>") + "</dd>";
      }
      if (pv.tendanceIndisponible) {
        s += "<dt>pas de tendance</dt><dd>" + esc(pv.tendanceIndisponible.explication) +
          ' <span style="color:#8DA0BC">(' + esc(pv.tendanceIndisponible.raison) + ")</span></dd>";
      }
      if (pv.courbe) {
        s += "<dt>courbe</dt><dd>" + esc(pv.courbe.points) + " points · " + esc(pv.courbe.periode) +
          " · " + esc(pv.courbe.joursObserves) + " jours enregistres<br>" +
          '<span style="color:#8DA0BC">' + esc(pv.courbe.portee) + "</span></dd>";
      }
      s += "<dt>comparaisons de tests</dt><dd>";
      if (!pv.comparaisons) {
        s += "<i>hors de cet etat</i>";
      } else if (pv.comparaisons.possible) {
        s += pv.comparaisons.liste.map(function (c) {
          return esc(c.label) + " : " + esc(c.avant) + " -> " + esc(c.apres) + " (<b>" +
            esc(c.ecart) + "</b>, " + esc(c.sens) + ")<br>" +
            '<span style="color:#8DA0BC">' + esc(c.jours) + "</span>";
        }).join("<br>");
      } else {
        s += "<i>aucune</i> — " + esc(pv.comparaisons.explication) +
          ' <span style="color:#8DA0BC">(' + esc(pv.comparaisons.raison) + ")</span>";
      }
      s += "</dd>";
      s += "<dt>bouton vers le detail</dt><dd>" +
        (pv.detail.affiche
          ? "<b>" + esc(pv.detail.label) + '</b> <span class="badge badge-neutre">' +
            esc(pv.detail.emphasis) + "</span>"
          : "<b>aucun</b>") +
        '<br><span style="color:#8DA0BC">' + esc(pv.detail.motif) + "</span>" +
        (pv.detail.reserve
          ? '<div class="avertissement" style="margin-top:6px"><span class="t">reserve sur la ' +
            "destination</span>" + esc(pv.detail.reserve) + "</div>"
          : "") +
        "</dd></dl>";
    }
    s += "</div>";

    // --- ce que la mesure a compte dans le rendu ---------------------------
    var m = e.vnext2 && e.vnext2.mesures;
    s += '<div class="bloc-panneau"><h3>Ce que la mesure a compte dans le rendu (375 px)</h3>';
    if (!m) {
      s += '<p class="vide">Aucune mesure : la variante 2 n\\'a pas pu etre rendue pour cet etat.</p>';
    } else {
      s += '<table class="tbl"><tr><th>Controle</th><th>Vu</th><th>Attendu</th></tr>';
      m.controles.forEach(function (c) {
        var ok = !c.indisponible && c.valeur === c.attendu;
        s += "<tr><td>" + esc(c.question) +
          '<br><span style="color:#8DA0BC">' + esc(c.pourquoi) + "</span>" +
          (c.trouve ? '<br><span style="color:#FFC97A">' + esc(c.trouve) + "</span>" : "") +
          '</td><td class="num">' +
          (c.indisponible ? "—" : esc(c.valeur)) + " " +
          (c.indisponible
            ? '<span class="badge badge-neutre">non mesure</span>'
            : ok
            ? '<span class="badge badge-ok">ok</span>'
            : '<span class="badge badge-ko">non</span>') +
          '</td><td class="num">' + esc(c.attendu) + "</td></tr>";
      });
      s += "</table>";
      if (!m.carteIsolee) {
        s += '<div class="avertissement"><span class="t">a savoir</span>Le balisage de la carte ' +
          "n\\'a pas pu etre isole : les controles qui portent sur la carte seule sont marques " +
          "« non mesure » plutot que devines.</div>";
      }
      (m.observations || []).forEach(function (o) {
        s += '<div class="avertissement"><span class="t">observation</span>' + esc(o.texte) + "</div>";
      });
      s += '<p class="fin">Le nombre d\\'aplats colores est compte sur TOUT l\\'ecran : si la carte ' +
        "en ajoutait un en bas, ce compteur passerait a 2. En revanche, la finesse du contraste et " +
        "le poids visuel reel ne se mesurent pas ici — c\\'est ce que tes yeux doivent trancher au " +
        "point 2.</p>";
    }

    // Les memes controles, a toutes les largeurs. Ce sont des comptes de
    // structure : ils ne devraient pas bouger d'une largeur a l'autre.
    var pl = e.vnext2 && e.vnext2.controlesParLargeur;
    if (pl) {
      s += '<p class="fin"><b>Aux quatre largeurs.</b> ';
      var lignes = Object.keys(pl).map(function (w) {
        return pl[w].length
          ? w + " px : <span style=\\"color:#FFAE9E\\">" + esc(pl[w].join(", ")) + "</span>"
          : w + ' px : <span style="color:#8FE3B0">tout passe</span>';
      });
      s += lignes.join(" · ") +
        ". Un compte de structure qui changerait avec la largeur signalerait un bloc qui " +
        "disparait sur petit ecran.</p>";
    }
    s += "</div>";

    // --- ce que l'appariement coute ----------------------------------------
    s += '<div class="bloc-panneau"><h3>Ecran d\\'accueil utilise, et ce qu\\'il coute</h3>' +
      "<p>La carte est posee sur <b>" + esc(e.hoteTitre) + "</b> " +
      '<span style="color:#8DA0BC">(' + esc(e.hoteId) + ")</span>.</p>" +
      '<p class="fin">' + esc(e.pourquoiCetHote) + "</p>";
    if (e.ecartAppariement) {
      s += '<div class="avertissement"><span class="t">appariement approximatif</span>' +
        esc(e.ecartAppariement) + "</div>";
    } else {
      s += '<p class="fin"><span class="badge badge-ok">appariement exact</span></p>';
    }
    if (e.audit) {
      s += '<table class="tbl"><tr><th>Ce qui est compare</th><th>Ou ca se voit</th><th>Verdict</th></tr>';
      e.audit.points.forEach(function (p) {
        var badge = p.verdict === "divergent"
          ? '<span class="badge badge-ko">divergent</span>'
          : p.verdict === "coherent"
          ? '<span class="badge badge-ok">coherent</span>'
          : '<span class="badge badge-neutre">sans objet</span>';
        s += "<tr><td>" + esc(p.libelle) + '<br><span style="color:#8DA0BC">' + esc(p.detail) +
          "</span></td><td>" +
          (p.ou === "ecran_v2" ? "sur l\\'ecran" : "en cote a cote") +
          "</td><td>" + badge + "</td></tr>";
      });
      s += "</table><p class=\\"fin\\">Cet audit est RECALCULE a chaque generation depuis les deux " +
        "contrats. Une divergence qui apparaitrait sans etre declaree leve une alerte de " +
        "generation : le harnais ne peut pas se taire.</p>";
    }
    s += "</div>";
    return s;
  }

  /**
   * L'ONGLET « CET ETAT » POUR UNE VARIANTE DE DEMARRAGE.
   *
   * Il repond a UNE question, element par element : d'ou sort ce que je lis ?
   *
   * Rien n'est reformule ici. Le champ « source » de chaque premier pas est
   * recopie tel que le contrat l'impose, et le seuil de chaque promesse est le
   * nom de la constante exportee, pas un chiffre reecrit. Un panneau qui
   * paraphraserait finirait par raconter autre chose que l'ecran.
   */
  function htmlCetEtatDemarrage(e, cleVariante) {
    var bloc = (e.demarrage && e.demarrage[cleVariante]) || null;
    var dem = varianteDemarragePar(cleVariante);
    if (!bloc) return "";
    var vm = bloc.viewModel && bloc.viewModel.demarrage;

    var s = '<div class="bloc-panneau"><h3>' + esc(dem ? dem.titre : cleVariante) + "</h3>" +
      "<p>" + esc(dem ? dem.resume : "") + "</p>" +
      '<p class="fin">Cette variante ne concerne QUE l\\'ecran d\\'un compte sans aucune seance ' +
      "terminee. Elle s\\'obtient en passant une option au meme selecteur, sur les memes donnees : " +
      "entre l\\'ecran actuel, V-A et V-B, rien d\\'autre ne change.</p></div>";

    if (!vm) {
      return s + '<div class="bloc-panneau"><p class="vide">Le selecteur n\\'a construit aucun ' +
        "bloc de demarrage pour cet etat.</p></div>";
    }

    // --- V-A : chaque pas, son etat, et la donnee qui l'a decide -----------
    if (vm.nature === "premiere_mission") {
      s += '<div class="bloc-panneau"><h3>Les premiers pas — chacun, et sa source</h3>' +
        '<p class="fin">La colonne « etat » n\\'est jamais ecrite a la main : c\\'est un booleen ' +
        "CALCULE a partir de la donnee citee a droite. Un pas dont l\\'etat ne serait pas " +
        "derivable n\\'apparaitrait pas du tout.</p>" +
        '<table class="tbl"><tr><th>Pas</th><th>Etat</th><th>D\\'ou vient cet etat</th></tr>';
      vm.premiersPas.forEach(function (p) {
        s += "<tr><td><b>" + esc(p.libelle) + "</b><br>" +
          '<span style="color:#8DA0BC">' + esc(p.detail) + "</span></td><td>" +
          (p.fait
            ? '<span class="badge badge-ok">fait</span>'
            : '<span class="badge badge-neutre">a faire</span>') +
          '</td><td><code>' + esc(p.source) + "</code></td></tr>";
      });
      s += "</table>" +
        '<p class="fin">AUCUNE de ces lignes n\\'est tapable : ni bouton, ni lien, ni chevron. ' +
        "Le contrat le rend impossible — un premier pas n\\'a aucun champ de destination. Elles " +
        "DISENT le chemin, elles ne le proposent pas : le seul point d\\'entree reste l\\'action du " +
        "jour, en haut.</p></div>";

      s += '<div class="bloc-panneau"><h3>« Pourquoi ce cycle » — d\\'ou sort la phrase</h3>';
      if (vm.pourquoiCeCycle) {
        s += '<div class="encadre-portee"><div class="phrase">« ' +
          esc(vm.pourquoiCeCycle.texte) + " »</div></div>" +
          '<dl class="kv"><dt>cycle recommande</dt><dd>' + esc(vm.pourquoiCeCycle.cycle) + "</dd>" +
          "<dt>ce qui a pese</dt><dd>" +
          (vm.pourquoiCeCycle.source === "objectif_declare_et_tests"
            ? "l\\'objectif declare au setup ET le cycle des derniers tests terrain"
            : "l\\'objectif declare au setup profil, seul") + "</dd>" +
          "<dt>qui la produit</dt><dd><code>recommendMicrocycle(domain/recommendMicrocycle.ts)</code>" +
          "</dd></dl>" +
          '<p class="fin">C\\'est la MEME fonction qui pre-selectionne deja le cycle a la fin du ' +
          "setup profil et dans la modale de choix de cycle. L\\'ecran ne recalcule rien : il ne " +
          "peut donc pas proposer autre chose que ce que le joueur trouvera en tapant sur " +
          "l\\'action.</p>";
      } else {
        s += '<p class="vide">Aucune ligne « pourquoi ce cycle » sur cet etat.</p>' +
          '<p class="fin">Deux cas la retirent, tous deux par prudence : un cycle deja actif ' +
          "(recommander a cote de ce qui tourne deja mettrait deux verites dans le meme ecran), " +
          "ou aucun objectif declare (la fonction rendrait bien un cycle, mais PAR DEFAUT — le " +
          "presenter comme un choix fonde sur le joueur serait une raison inventee). Le detail " +
          "est dans les avertissements ci-dessous.</p>";
      }
      s += "</div>";
    }

    // --- V-B : chaque promesse, et le seuil qui la tiendra ------------------
    if (vm.nature === "anticipation") {
      s += '<div class="bloc-panneau"><h3>Ce qui est annonce, et quand ca arrivera</h3>' +
        '<p class="fin">Chaque ligne porte le titre EXACT de la section qu\\'elle annonce et la ' +
        "CONSTANTE EXPORTEE qui la declenchera. Le chiffre lu dans la phrase est celui-la, pas un " +
        "nombre choisi pour la phrase : le jour ou le seuil change, la phrase change avec lui.</p>" +
        '<table class="tbl"><tr><th>Section a venir</th><th>Ce qui est promis</th>' +
        "<th>Seuil</th></tr>";
      vm.apercus.forEach(function (a) {
        s += "<tr><td><b>" + esc(a.titre) + "</b></td><td>" + esc(a.message) + "</td>" +
          '<td class="num">' + esc(a.seuil) + " seance(s)<br>" +
          '<code style="font-size:10px">' + esc(a.seuilNom) + "</code></td></tr>";
      });
      s += "</table>" +
        '<p class="fin">Aucune courbe grisee, aucun chiffre en attente, aucun « — » a la place ' +
        "d\\'une valeur : l\\'ecran assume qu\\'il est en construction au lieu de faire semblant " +
        "d\\'etre plein.</p></div>";
    }

    // --- les controles chiffres de la page regardee ------------------------
    if (bloc.controles) {
      var enEchec = (bloc.controlesParLargeur || {});
      var largeursKo = Object.keys(enEchec).filter(function (k) { return enEchec[k].length > 0; });
      s += '<div class="bloc-panneau"><h3>Ce qui a ete compte dans la page rendue</h3>' +
        '<p class="fin">Chaque attendu est DEDUIT du ViewModel, jamais recopie : c\\'est la seule ' +
        "facon qu\\'un controle continue de mesurer quelque chose le jour ou le contenu bouge.</p>" +
        '<table class="tbl"><tr><th>Ce qui est compte</th><th>Trouve</th><th>Attendu</th></tr>';
      bloc.controles.forEach(function (c) {
        var ok = c.valeur === c.attendu;
        s += "<tr><td>" + esc(c.quoi) + '</td><td class="num">' + esc(c.valeur) + " " +
          (ok ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-ko">non</span>') +
          '</td><td class="num">' + esc(c.attendu) + "</td></tr>";
      });
      s += "</table>";
      s += largeursKo.length
        ? '<p class="fin">Controle(s) en echec : ' +
          largeursKo.map(function (k) { return k + " px : " + enEchec[k].join(", "); }).join(" · ") +
          "</p>"
        : '<p class="fin">Aucun controle en echec, a aucune des largeurs generees.</p>';
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
    var v2courant = estVariante2(etat.etatId);
    var s = '<div class="bloc-panneau"><h3>Donnees fictives</h3><p class="fin">' + esc(e.resume) +
      "</p></div>";

    // --- la variante de demarrage, si c'est elle qu'on regarde --------------
    // Placee AVANT tout le reste : quand le fondateur bascule sur V-A ou V-B,
    // la premiere question est « d'ou sort chaque ligne que je lis ? », et la
    // reponse doit etre en haut du panneau, pas au fond.
    if (estVarianteDemarrage(etat.variante)) s += htmlCetEtatDemarrage(e, etat.variante);

    // --- avertissements du prototype, pour CET etat -------------------------
    // Ils vivent ICI, jamais dans l'ecran produit : le joueur ne doit pas lire
    // les notes de chantier.
    var w = estVarianteDemarrage(etat.variante)
      ? (blocDemarrage(etat.variante) || {}).protoWarnings || []
      : v2courant
      ? (e.vnext2 && e.vnext2.protoWarnings) || []
      : (e.vnext && e.vnext.protoWarnings) || [];
    if (w.length) {
      s += '<div class="bloc-panneau"><h3>Avertissements du prototype</h3>';
      w.forEach(function (x) {
        s += '<div class="avertissement"><span class="t">a savoir</span>' + esc(x) + "</div>";
      });
      s += '<p class="fin">Produits par le selecteur du prototype. Ils n\\'apparaissent jamais ' +
        "dans l\\'ecran produit.</p></div>";
    }

    // --- le mouvement : ce qu'une capture ne peut pas montrer ---------------
    var mv = estVarianteDemarrage(etat.variante)
      ? (blocDemarrage(etat.variante) || {}).mouvement
      : v2courant
      ? (e.vnext2 && e.vnext2.mouvement)
      : (e.vnext && e.vnext.mouvement);
    var presId = presentationCourante() ? presentationCourante().id : null;
    if (mv && presId && mv[presId]) {
      var c = mv[presId];
      var okMv = c.valeur === c.attendu;
      s += '<div class="bloc-panneau"><h3>Le mouvement — mesure, pas regarde</h3>' +
        "<p>" + esc(c.question) + " <b>" + esc(c.valeur) + "</b> element(s) portant une consigne " +
        "de mouvement, attendu <b>" + esc(c.attendu) + "</b> " +
        (okMv ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-ko">non</span>') +
        "</p>" +
        '<p class="fin">' + esc(c.trouve) + "</p>" +
        '<p class="fin">' + esc(c.pourquoi) + "</p>";
      // La comparaison entre les deux reglages : c'est elle qui fait la preuve.
      var ids = Object.keys(mv);
      if (ids.length > 1) {
        s += '<table class="tbl"><tr><th>Reglage</th><th>Consigne de mouvement</th></tr>';
        ids.forEach(function (id) {
          var p = presentationParId(id);
          s += "<tr" + (id === presId ? ' style="background:#16233A"' : "") + "><td>" +
            esc(p ? p.titre : id) + "</td>" +
            '<td class="num">' + esc(mv[id].valeur) + " / attendu " + esc(mv[id].attendu) + "</td></tr>";
        });
        s += "</table><p class=\\"fin\\">C\\'est le tableau entier qui fait la preuve, pas une " +
          "seule ligne : l\\'absence de transform quand le reglage est actif ne veut dire quelque " +
          "chose QUE si la ligne sans le reglage, elle, en porte un. Sinon ce serait un oubli, " +
          "pas un reglage respecte.</p>";
      }
      s += "</div>";
    }

    if (v2courant) s += htmlEtatVariante2(e);

    // Sur une variante de demarrage, c'est SON ViewModel qu'il faut lire : celui
    // de la variante actuelle affiche encore « ma forme », que le bloc a
    // absorbee. Montrer le mauvais ferait lire au fondateur un contrat qui n'est
    // pas celui de l'ecran qu'il a sous les yeux.
    var vm = estVarianteDemarrage(etat.variante)
      ? (blocDemarrage(etat.variante) || {}).viewModel || (e.vnext && e.vnext.viewModel)
      : e.vnext && e.vnext.viewModel;
    s += '<div class="bloc-panneau"><h3>' +
      (estVariante2(etat.etatId)
        ? "Le haut de l\\'ecran — decide par le contrat du Home"
        : estVarianteDemarrage(etat.variante)
        ? "Ce que le contrat decide pour cet ecran, dans cette variante"
        : "Ce que le contrat decide pour cet etat") + "</h3>";
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
    if (estVariante2(etat.etatId)) {
      s += '<p class="fin">Celle de l\\'ecran d\\'accueil utilise (<b>' + esc(e.hoteTitre) +
        "</b>). La carte progression, elle, n\\'a aucun equivalent dans le Home de production : " +
        "il n\\'y a qu\\'un lien vers une page separee.</p>";
    }
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

    var v2ici = estVariante2(etat.etatId);
    var sonde = v2ici ? e.vnext2 && e.vnext2.sonde : e.vnext && e.vnext.sonde;
    if (sonde) {
      s += '<div class="bloc-panneau"><h3>Sonde de rendu (375 px' +
        (v2ici ? ", variante 2" : "") + ")</h3><p class=\\"fin\\">" +
        "Blocs de premier niveau : <b>" + esc(sonde.blocs.length) + "</b> · conteneurs de mise en page traverses : <b>" +
        esc(sonde.chainLength) + "</b> · noeuds qui se mesurent : <b>" +
        esc(sonde.noeudsMesures) + "</b>.</p>";
      if (sonde.erreurs && sonde.erreurs.length) {
        sonde.erreurs.forEach(function (x) {
          s += '<div class="avertissement"><span class="t">erreur de rendu</span>' + esc(String(x).slice(0, 400)) + "</div>";
        });
      }
      s += "</div>";
    }
    return s;
  }

  // -----------------------------------------------------------------------
  /**
   * Remet l'etat de l'outil dans une combinaison qui EXISTE. Le principe : on ne
   * laisse jamais le visualiseur afficher « aucune page generee » quand un repli
   * evident existe, et on ne laisse jamais une variante active sur un etat qui ne
   * la possede pas — ce serait montrer un ecran pour un autre.
   */
  function normaliser() {
    if (estExtra() && etat.variante !== "actuel") etat.variante = "actuel";
    // Un etat de la variante 1 n'a pas de carte : on revient a la variante 1.
    // L'inverse n'est PAS force : sur un etat de variante 2, « Proposition
    // vNext » reste choisissable — c'est l'ecran d'accueil utilise, une vraie
    // page, et pouvoir la regarder seule a un sens.
    if (etat.variante === "vnext2" && !varianteDispo("vnext2")) etat.variante = "vnext";
    // Meme regle pour les variantes de demarrage : un etat qui n'y a pas droit
    // (parce que le compte a deja une seance terminee) revient a la variante
    // actuelle. Rester sur un bouton qui ne montre rien ferait croire que la
    // proposition est vide, alors qu'elle ne s'applique simplement pas ici.
    if (estVarianteDemarrage(etat.variante) && !varianteDispo(etat.variante)) etat.variante = "vnext";
    if (etat.variante === "duo") {
      etat.largeur = 375;
      var p = paireCourante();
      if (!varianteDispo(p.gauche) || !varianteDispo(p.droite)) {
        // On prend la premiere paire integralement disponible plutot que
        // d'afficher une colonne vide sans explication.
        for (var i = 0; i < PAIRES.length; i++) {
          if (varianteDispo(PAIRES[i].gauche) && varianteDispo(PAIRES[i].droite)) {
            etat.paire = PAIRES[i].id;
            break;
          }
        }
      }
    }
    if (etat.largeur !== M.largeurEchelle) etat.x13 = false;
    // Un reglage de presentation que le produit ne declare pas ne doit pas rester
    // dans l'etat : on revient au defaut plutot que de chercher une page qui
    // n'existera jamais.
    if (!presentationPour(etat.typo, etat.anim) && PRESENTATION_DEFAUT) {
      etat.typo = PRESENTATION_DEFAUT.echelle;
      etat.anim = Boolean(PRESENTATION_DEFAUT.reduceMotion);
    }
  }

  function rendre() {
    normaliser();
    rendreBarre();
    rendreRail();
    rendreScene();
    rendrePanneaux();
    ecrireHash();
  }

  /** L'ordre de parcours des fleches : la liste laterale, de haut en bas. */
  function listeNavigation() {
    return M.ordreEtats
      .concat(ordreV2())
      .concat(M.extras.map(function (x) { return x.id; }));
  }

  /**
   * Changer d'etat en gardant l'intention. Entrer dans la famille « variante 2 »
   * bascule sur la variante 2, en sortir ramene a la variante 1 — sinon on
   * changerait d'etat sans changer d'ecran, et le nom affiche ne correspondrait
   * plus a ce qu'on regarde. Le cote a cote, lui, n'est jamais interrompu.
   */
  function allerA(id, combinaison) {
    var avantV2 = estVariante2(etat.etatId);
    var apresV2 = estVariante2(id);
    etat.etatId = id;
    if (etat.variante !== "duo" && avantV2 !== apresV2) {
      etat.variante = apresV2 ? "vnext2" : "vnext";
    }
    // Une CIBLE d'axe pose la combinaison entiere. Sans ca, « regarde ceci en
    // 320 px avec la typographie d'avant » demanderait trois reglages a la main,
    // et on finirait par juger autre chose que ce qui est demande.
    var c = combinaison || null;
    if (c) {
      if (c.variante && (["vnext", "vnext2", "actuel", "duo"].indexOf(c.variante) !== -1 || estVarianteDemarrage(c.variante))) {
        etat.variante = c.variante;
      }
      if (c.paire && trouverPaire(c.paire)) etat.paire = c.paire;
      if (c.largeur && M.largeurs.indexOf(Number(c.largeur)) !== -1) etat.largeur = Number(c.largeur);
      if (c.vue && ["visible", "entiere"].indexOf(c.vue) !== -1) etat.vue = c.vue;
      if (c.x13 != null) etat.x13 = c.x13 === "1" || c.x13 === true;
      if (c.typo && ["allegee", "actuelle"].indexOf(c.typo) !== -1) etat.typo = c.typo;
      if (c.anim != null) etat.anim = c.anim === "1" || c.anim === true;
    }
    rendre();
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
    var liste = listeNavigation();
    var i = liste.indexOf(etat.etatId);
    if (ev.key === "ArrowDown") { allerA(liste[(i + 1) % liste.length]); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { allerA(liste[(i - 1 + liste.length) % liste.length]); ev.preventDefault(); }
    else if (ev.key === "v") {
      // On saute les variantes indisponibles sur l'etat courant : sinon la
      // touche semblerait ne rien faire une fois sur deux.
      var ordre = ["vnext", "vnext2"].concat(IDS_DEMARRAGE).concat(["actuel", "duo"]);
      var j = ordre.indexOf(etat.variante);
      for (var n = 1; n <= ordre.length; n++) {
        var cand = ordre[(j + n) % ordre.length];
        if (varianteDispo(cand) || cand === "duo") { etat.variante = cand; break; }
      }
      rendre();
    } else if (ev.key === "c") {
      // La paire du cote a cote. Bascule aussi EN cote a cote si on n'y est pas :
      // c'est le geste attendu quand on appuie sur « comparer ».
      if (etat.variante !== "duo") etat.variante = "duo";
      else {
        var k = PAIRES.map(function (p) { return p.id; }).indexOf(etat.paire);
        for (var q = 1; q <= PAIRES.length; q++) {
          var pc = PAIRES[(k + q) % PAIRES.length];
          if (varianteDispo(pc.gauche) && varianteDispo(pc.droite)) { etat.paire = pc.id; break; }
        }
      }
      rendre();
    } else if (ev.key === "e") { etat.vue = etat.vue === "visible" ? "entiere" : "visible"; rendre(); }
    else if (ev.key === "p") { document.getElementById("btn-panneau").click(); }
    // Les deux axes de presentation, chacun sur sa touche : la comparaison
    // typographique se fait en martelant une seule touche, sans quitter l'ecran
    // des yeux — c'est ainsi qu'on voit ce qui bouge.
    else if (ev.key === "t") { etat.typo = etat.typo === "allegee" ? "actuelle" : "allegee"; rendre(); }
    else if (ev.key === "a") { etat.anim = !etat.anim; rendre(); }
    else if (ev.key === "w") {
      // Alterne entre les deux largeurs que le fondateur a nommees.
      var duo = M.largeursComparaisonTypo || [320, 375];
      if (etat.variante !== "duo") {
        etat.largeur = etat.largeur === duo[0] ? duo[1] : duo[0];
        if (etat.largeur !== M.largeurEchelle) etat.x13 = false;
        rendre();
      }
    }
  });

  window.addEventListener("hashchange", function () { lireHash(); rendre(); });

  lireHash();
  rendre();
})();
`;
}

module.exports = { viewerHtml, viewerCss, viewerJs };
