// prototype/home-vnext/lib/pageTemplate.js
// =============================================================================
// GABARIT D'UNE PAGE D'ECRAN — HTML STATIQUE, SANS JAVASCRIPT
// =============================================================================
// Une page = un ecran, un format, une vue. Elle contient :
//   - le cadre du telephone (`.stage`), a la largeur exacte demandee ;
//   - l'ecran rendu (`.device`), sans retouche du balisage produit ;
//   - les reperes du harnais : ligne de flottaison, zone systeme, barre d'onglets ;
//   - un bloc d'identification place SOUS le cadre (donc invisible quand le
//     visualiseur decoupe a la hauteur d'ecran, mais present si on ouvre la page
//     toute seule).
//
// DEUX VUES, DEUX TRAITEMENTS :
//   "visible" — le cadre a la HAUTEUR REELLE de l'ecran. Rien n'est neutralise :
//               la zone de defilement coupe toute seule, exactement comme sur le
//               telephone. C'est la vue honnete.
//   "entiere" — les conteneurs de mise en page (marques `data-fks="chain"`) sont
//               neutralises pour que toute la page soit visible d'un coup. C'est
//               une vue d'exploration : le telephone, lui, coupe.
//
// Le CSS de l'application (genere par react-native-web) est charge par un
// `<link>` unique : les pages restent legeres et le style est le meme partout.
// =============================================================================
"use strict";

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

/** Multiplie les tailles de texte ecrites en style en ligne (variante texte agrandi). */
function scaleInlineHtml(html, factor) {
  if (factor === 1) return html;
  return html.replace(
    /(font-size|line-height)\s*:\s*([\d.]+)px/g,
    (m, prop, val) => `${prop}: ${(parseFloat(val) * factor).toFixed(2)}px`
  );
}

const COULEURS_HARNAIS = {
  flottaison: "#D92D20",
  systeme: "#7A8699",
  tabbar: "#475467",
  chrome: "#101725",
};

function harnessCss({ device, vue }) {
  const { width, screenHeight, stageVisible, insetTop, tabBarTotal } = device;
  const visible = vue === "visible";
  return `
:root { color-scheme: light; }
html, body { margin: 0; padding: 0; background: #C9D2DE; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

.stage {
  position: relative;
  width: ${width}px;
  ${visible ? `height: ${screenHeight}px;` : `min-height: ${screenHeight}px;`}
  margin: 0;
  background: #F5F7FA;
  overflow: ${visible ? "hidden" : "visible"};
}

/* L'ecran de l'app : du haut physique jusqu'au haut de la barre d'onglets. */
/* En vue « page entiere » on ne force AUCUNE hauteur : la hauteur mesuree par
   le visualiseur est alors la vraie hauteur du contenu, et il peut dire
   combien de pixels restent sous la ligne de flottaison. */
.device {
  position: relative;
  width: ${width}px;
  ${visible ? `height: ${stageVisible}px;` : ""}
  display: flex;
  flex-direction: column;
  ${visible ? "overflow: hidden;" : ""}
}
.device > * { flex: 1 1 auto; min-height: 0; }
.device *::-webkit-scrollbar { width: 0; height: 0; }
.device * { scrollbar-width: none; }

${
  visible
    ? ""
    : `/* VUE PAGE ENTIERE : on neutralise UNIQUEMENT les conteneurs de mise en
   page externes (racine react-native-web, safe area, zone de defilement) pour
   que tout le contenu soit visible sans defiler. Les cartes internes gardent
   leur propre decoupe. */
.device [data-fks="chain"] {
  flex: 0 0 auto !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
}`
}

/* --- reperes du harnais ------------------------------------------------- */
.mk { position: absolute; left: 0; right: 0; pointer-events: none; z-index: 30; }
.mk-line { height: 0; }
.mk-label {
  position: absolute; right: 4px; top: -15px; font-size: 9.5px; font-weight: 700;
  padding: 1px 5px; border-radius: 3px; color: #fff; white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mk-systeme { top: ${insetTop}px; }
.mk-systeme .mk-line { border-top: 1px dashed ${COULEURS_HARNAIS.systeme}; }
/* A gauche : la droite est occupee par la pastille FICTIF du visualiseur. */
.mk-systeme .mk-label { background: ${COULEURS_HARNAIS.systeme}; left: 4px; right: auto; }
.mk-flottaison { top: ${stageVisible}px; }
.mk-flottaison .mk-line { border-top: 2px solid ${COULEURS_HARNAIS.flottaison}; }
.mk-flottaison .mk-label { background: ${COULEURS_HARNAIS.flottaison}; top: -16px; }

/* Barre d'onglets : posee la ou le systeme la pose.
   - vue « zone visible » : dessinee comme la vraie barre (elle est bien la) ;
   - vue « page entiere »  : dessinee en FANTOME hachure, sans icones, pour
     qu'on ne la confonde jamais avec du contenu de l'application. Elle montre
     uniquement ce qu'elle recouvrirait. */
.tabbar {
  position: absolute; left: 0; right: 0; top: ${stageVisible}px;
  height: ${tabBarTotal}px; z-index: 40; box-sizing: border-box;
}
${
  visible
    ? `.tabbar {
  background: rgba(245,247,250,.97); border-top: 1px solid #E2E7EE;
  display: flex; align-items: flex-start; justify-content: space-around;
  padding-top: 6px; padding-bottom: ${device.insetBottom}px;
}
.tabbar .tab { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 33%; }
.tabbar .dot { width: 22px; height: 22px; border-radius: 6px; background: #A9B3C2; }
.tabbar .tab.on .dot { background: #2A4D8F; }
.tabbar .lbl { font-size: 10px; color: #586374; }
.tabbar .tab.on .lbl { color: #2A4D8F; font-weight: 700; }
.tabbar .fantome { display: none; }`
    : `.tabbar {
  border-top: 2px solid ${COULEURS_HARNAIS.flottaison};
  background: repeating-linear-gradient(135deg,
    rgba(217,45,32,.13) 0 7px, rgba(217,45,32,.03) 7px 14px);
  display: flex; align-items: center; justify-content: center;
}
.tabbar .tab { display: none; }
.tabbar .fantome {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px; letter-spacing: .8px; text-transform: uppercase;
  color: ${COULEURS_HARNAIS.flottaison}; background: rgba(255,255,255,.88);
  border: 1px solid rgba(217,45,32,.45); border-radius: 4px; padding: 3px 8px;
}`
}

/* --- identification, SOUS le cadre -------------------------------------- */
.ident {
  width: ${Math.max(width, 360)}px; box-sizing: border-box;
  background: ${COULEURS_HARNAIS.chrome}; color: #C9D6EA;
  font-size: 11px; line-height: 1.55; padding: 10px 12px 16px;
}
.ident .fictif {
  display: inline-block; background: #7A1F1F; color: #fff; font-weight: 800;
  font-size: 10px; letter-spacing: .6px; text-transform: uppercase;
  padding: 3px 7px; border-radius: 3px; margin-bottom: 7px;
}
.ident b { color: #F0F5FF; }
.ident .ecart {
  margin-top: 8px; background: #3A1A16; border: 1px solid #6B2B22; color: #FFD8CF;
  border-radius: 5px; padding: 7px 9px;
}
.ident .ecart .titre { font-weight: 800; color: #FF9E8C; display: block; margin-bottom: 3px; }
`;
}

function tabbarHtml() {
  return `<div class="tabbar">
  <div class="tab on"><div class="dot"></div><div class="lbl">Accueil</div></div>
  <div class="tab"><div class="dot"></div><div class="lbl">Seance</div></div>
  <div class="tab"><div class="dot"></div><div class="lbl">Profil</div></div>
  <div class="fantome">barre d'onglets — ce qui est ici est masque</div>
</div>`;
}

/**
 * @param {object} o
 * @param {string} o.variante      "vnext" | "actuel"
 * @param {string} o.etatId        identifiant de l'etat
 * @param {string} o.etatTitre     titre lisible
 * @param {string} o.etatResume    une ligne
 * @param {object} o.device        entree de devices.js
 * @param {"visible"|"entiere"} o.vue
 * @param {number} o.echelleTexte  1 ou 1.3
 * @param {string} o.html          balisage capture de l'ecran
 * @param {string} o.cssHref       chemin relatif vers la feuille de style de l'app
 * @param {?object} o.ecart        { qualite, texte } quand la correspondance n'est pas exacte
 */
function pageEcran(o) {
  const { variante, etatId, etatTitre, etatResume, device, vue, echelleTexte, html, cssHref, ecart } = o;
  const nomVariante = variante === "vnext" ? "Proposition vNext" : "Home actuel (production)";
  const noteEchelle =
    echelleTexte === 1
      ? "texte a l'echelle 1"
      : `texte x${echelleTexte} — SIMULATION : les tailles de police et les interlignes du CSS sont ` +
        `multipliees. Ce n'est PAS le vrai Dynamic Type d'iOS, qui redistribue aussi les marges.`;

  const blocEcart = ecart
    ? `<div class="ecart"><span class="titre">${esc(
        ecart.qualite === "inexistant"
          ? "Le Home actuel n'a pas cet etat"
          : "Correspondance approximative"
      )}</span>${esc(ecart.texte)}</div>`
    : "";

  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FKS — ${esc(nomVariante)} — ${esc(etatTitre)} — ${device.width} px — ${esc(vue)}</title>
<link rel="stylesheet" href="${esc(cssHref)}">
<style>${harnessCss({ device, vue })}</style>
</head><body>
<div class="stage" data-fks-stage="1" data-fks-variante="${esc(variante)}" data-fks-etat="${esc(
    etatId
  )}" data-fks-largeur="${device.width}" data-fks-vue="${esc(vue)}">
  <div class="device">${scaleInlineHtml(html, echelleTexte)}</div>
  <div class="mk mk-systeme"><div class="mk-line"></div><div class="mk-label">zone systeme ${
    device.insetTop
  } px</div></div>
  ${tabbarHtml()}
  <div class="mk mk-flottaison"><div class="mk-line"></div><div class="mk-label">ligne de flottaison — ${
    device.stageVisible
  } px</div></div>
</div>
<div class="ident">
  <span class="fictif">Donnees fictives — prototype, non connecte</span><br>
  <b>${esc(nomVariante)}</b> · etat <b>${esc(etatTitre)}</b> (<code>${esc(etatId)}</code>)<br>
  ${esc(etatResume)}<br>
  <b>${device.width} x ${device.screenHeight}</b> — ${esc(device.reference)}<br>
  ${esc(device.calcul)}<br>
  Vue : <b>${vue === "visible" ? "zone visible sans defilement" : "page entiere"}</b> · ${esc(
    noteEchelle
  )}
  ${blocEcart}
</div>
</body></html>`;
}

/**
 * Page de repli quand l'ecran ne peut pas etre rendu (module absent, erreur de
 * rendu). On ne montre JAMAIS un ecran vide sans explication.
 */
function pageErreur({ variante, etatId, etatTitre, device, vue, titre, message, detail, viewModel }) {
  const vmBlock = viewModel
    ? `<h2>Ce que le contrat produit deja pour cet etat</h2>
<p class="note">Le selecteur (<code>screens/homeVNext/viewModel.ts</code>) fonctionne : voici son
resultat pour cette fixture. Il ne manque que l'ecran qui le dessine.</p>
<pre>${esc(JSON.stringify(viewModel, null, 2))}</pre>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FKS — ecran indisponible — ${esc(etatTitre)}</title>
<style>
html, body { margin:0; background:#1A1210; color:#FFE3DB;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
.wrap { width:${Math.max(device.width, 340)}px; box-sizing:border-box; padding:18px 16px 40px; }
h1 { font-size:15px; margin:0 0 10px; color:#FF9E8C; }
h2 { font-size:12.5px; margin:18px 0 6px; color:#FFB9AA; }
p { font-size:12px; line-height:1.6; margin:0 0 10px; }
p.note { color:#D8B6AE; }
code { background:#2A1B18; padding:1px 4px; border-radius:3px; font-size:11px; }
pre { background:#120C0B; border:1px solid #4A2A24; border-radius:6px; padding:10px;
  font-size:10.5px; line-height:1.5; overflow-x:auto; white-space:pre-wrap; color:#E8CFC8; }
.tag { display:inline-block; background:#7A1F1F; color:#fff; font-weight:800; font-size:10px;
  letter-spacing:.6px; text-transform:uppercase; padding:3px 7px; border-radius:3px; margin-bottom:10px; }
</style></head><body>
<div class="wrap">
<span class="tag">Donnees fictives — prototype, non connecte</span>
<h1>${esc(titre)}</h1>
<p>${esc(message)}</p>
<p class="note">Variante <b>${esc(variante)}</b> · etat <code>${esc(etatId)}</code> · ${
    device.width
  } px · vue ${esc(vue)}.</p>
${detail ? `<h2>Detail technique</h2><pre>${esc(detail)}</pre>` : ""}
${vmBlock}
</div></body></html>`;
}

module.exports = { pageEcran, pageErreur, esc, scaleInlineHtml };
