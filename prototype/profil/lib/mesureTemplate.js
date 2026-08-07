// prototype/home-vnext/lib/mesureTemplate.js
// =============================================================================
// LA PAGE QUI MESURE — celle qu'un vrai navigateur execute
// =============================================================================
//
// POURQUOI UN NAVIGATEUR : le harnais de rendu tourne dans jsdom, qui n'a AUCUN
// moteur de mise en page. Toute hauteur y vaut 0. Les hauteurs de page, les
// zones tactiles, les debordements et les contrastes reels ne peuvent donc etre
// mesures que dans un vrai moteur de rendu.
//
// COMMENT : cette page charge chaque page generee dans un `<iframe>`, mesure,
// puis ecrit le resultat en JSON dans un `<pre>`. Chrome est lance en mode
// « headless » avec `--dump-dom`, qui recrache le DOM final : le JSON revient
// donc dans la sortie standard. Aucun pilote, aucune dependance a installer.
//
// TOUT EST SYNCHRONE, ET C'EST VOLONTAIRE. `--dump-dom` recrache le DOM au
// moment de l'evenement `load` : tout ce qui serait fait dans une promesse ou
// un `setTimeout` arriverait TROP TARD et ne figurerait pas dans la sortie. On
// recupere donc chaque page par XHR synchrone, on lui injecte sa feuille de
// style EN LIGNE (une feuille liee se chargerait de facon asynchrone, et on
// mesurerait une page sans style), et on ecrit dans l'iframe par
// `document.write` — qui, lui, est synchrone. La mise en page est alors
// calculee des le premier `getBoundingClientRect`.
//
// CE QUI EST MESURE, ET CE QUE CA VEUT DIRE :
//   hauteurTotale   hauteur de tout le contenu de l'ecran, marges de safe area
//                   comprises. C'est le chiffre du tableau de comparaison.
//   sousLaLigne     ce qui depasse la zone visible sans defiler.
//   tactiles        chaque element cliquable, avec sa hauteur reelle.
//   contrastes      chaque texte, avec son ratio WCAG contre son fond EFFECTIF
//                   (le premier fond opaque trouve en remontant les parents).
//   debordements    tout element qui sort du cadre de l'appareil.
//   clampes         tout texte reellement coupe par `numberOfLines`.
//   chevauchements  deux textes qui se superposent (hors decor absolu).
// =============================================================================
"use strict";

/**
 * @param {Array<{cle:string, url:string, largeur:number, hauteurVisible:number}>} cibles
 */
function mesureHtml(cibles) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>FKS — mesures</title>
<style>
  html,body{margin:0;background:#0E1420;color:#CFE0F5;font:12px ui-monospace,Consolas,monospace}
  #cadre{position:absolute;left:-10000px;top:0;border:0}
  #etat{padding:8px}
  pre{white-space:pre-wrap;word-break:break-all;padding:8px}
</style></head><body>
<div id="etat">mesures en cours…</div>
<iframe id="cadre" width="900" height="4000"></iframe>
<pre id="resultat">EN_ATTENTE</pre>
<script>
const CIBLES = ${JSON.stringify(cibles)};

// --- couleurs : luminance relative et ratio WCAG 2.1 -------------------------
function versRgba(txt) {
  if (!txt) return null;
  const m = txt.match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s.trim()));
  return { r: p[0], v: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function canal(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(c) {
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.v) + 0.0722 * canal(c.b);
}
function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
/** Compose une couleur semi-transparente sur son fond. */
function composer(dessus, dessous) {
  const a = dessus.a;
  return {
    r: dessus.r * a + dessous.r * (1 - a),
    v: dessus.v * a + dessous.v * (1 - a),
    b: dessus.b * a + dessous.b * (1 - a),
    a: 1,
  };
}
/** Fond EFFECTIF d'un element : on remonte tant que c'est transparent. */
function fondEffectif(el, doc) {
  let couche = { r: 255, v: 255, b: 255, a: 1 };
  const pile = [];
  let n = el;
  while (n && n !== doc.documentElement) {
    const bg = versRgba(doc.defaultView.getComputedStyle(n).backgroundColor);
    if (bg && bg.a > 0) pile.push(bg);
    n = n.parentElement;
  }
  for (let i = pile.length - 1; i >= 0; i--) {
    couche = pile[i].a >= 1 ? { ...pile[i], a: 1 } : composer(pile[i], couche);
  }
  return couche;
}

// --- mesure d'une page -------------------------------------------------------
function mesurerUnePage(doc, cible) {
  const vue = doc.querySelector(".device");
  const stage = doc.querySelector(".stage");
  if (!vue) return { erreur: "aucun .device — la page n'est pas un ecran rendu" };

  const rVue = vue.getBoundingClientRect();
  const tous = Array.from(vue.querySelectorAll("*"));
  const win = doc.defaultView;

  // ---- hauteur reelle du contenu -------------------------------------------
  // On prend le bas le plus bas de tous les elements NON absolus : c'est la
  // hauteur qu'occupe reellement l'ecran, meme si un conteneur a ete etire.
  let basMax = 0;
  for (const el of tous) {
    const st = win.getComputedStyle(el);
    if (st.position === "absolute" || st.position === "fixed") continue;
    if (st.display === "none" || st.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 && r.width <= 0) continue;
    basMax = Math.max(basMax, r.bottom - rVue.top);
  }
  const hauteurTotale = Math.max(Math.round(rVue.height), Math.round(basMax));

  // ---- blocs de premier niveau ---------------------------------------------
  const blocs = Array.from(vue.querySelectorAll("[data-fks-bloc]")).map((b) => ({
    i: Number(b.getAttribute("data-fks-bloc")),
    hauteur: Math.round(b.getBoundingClientRect().height),
    texte: (b.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 70),
  }));

  // ---- marqueurs ------------------------------------------------------------
  const marqueur = (nom) => vue.querySelectorAll('[data-testid="' + nom + '"]').length;

  // ---- carte progression (VARIANTE 2) ---------------------------------------
  // AJOUT DE LA PASSE D'INTEGRATION. Plusieurs regles portent sur la CARTE et
  // pas sur l'ecran : aucun second aplat DANS la carte, un seul element
  // focusable DANS la carte, contraste des textes DE LA CARTE. Sans savoir ou
  // commence et ou finit la carte, ces controles accuseraient le mauvais bloc —
  // ou passeraient a cote. On repere donc son noeud une fois, et chaque element
  // mesure porte ensuite un booleen dansCarte.
  //
  // Purement ADDITIF : sur une page de variante 1 il n'y a pas de carte, le
  // champ carte vaut null et tous les dansCarte valent false. Aucun champ
  // existant ne change, donc verifier.js n'est pas affecte.
  // (Aucun accent grave dans ce commentaire : tout le bloc vit dans un litteral
  //  de gabarit, un accent grave y fermerait la chaine.)
  const carteEl = vue.querySelector('[data-testid="home-vnext-progression"]');
  const dansCarte = (el) => (carteEl ? carteEl.contains(el) : false);

  // ---- elements tactiles ----------------------------------------------------
  const estTactile = (el) => {
    const role = el.getAttribute("role");
    return (
      el.tagName === "BUTTON" ||
      role === "button" ||
      role === "link" ||
      (el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1")
    );
  };
  /** Un tactile a l'INTERIEUR d'un autre tactile = cible ambigue, focus incoherent. */
  const tactileImbrique = (el) => {
    let n = el.parentElement;
    while (n && n !== doc.documentElement) {
      if (estTactile(n)) return true;
      n = n.parentElement;
    }
    return false;
  };
  const tactiles = tous.filter(estTactile).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      marqueur: el.getAttribute("data-testid") || null,
      libelle: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
      libelleExplicite: el.hasAttribute("aria-label"),
      texte: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60),
      hauteur: Math.round(r.height * 10) / 10,
      largeur: Math.round(r.width * 10) / 10,
      imbrique: tactileImbrique(el),
      dansCarte: dansCarte(el),
    };
  });

  // ---- aplats colores (un seul autorise) ------------------------------------
  // ATTENTION : il faut tenir compte de l'OPACITE effective, pas seulement de
  // l'alpha du fond. Le voile de pression de l'aplat est un calque noir plein
  // pose a une opacite de 0 — invisible, mais un compteur naif le compte comme
  // un second aplat. Faute constatee au premier passage du verificateur.
  // (Pas de guillemets obliques dans ce commentaire : ce fichier est un
  //  gabarit, tout le bloc vit dans un litteral de gabarit.)
  const opaciteEffective = (el) => {
    let o = 1;
    let n = el;
    while (n && n !== doc.documentElement) {
      const v = parseFloat(win.getComputedStyle(n).opacity);
      if (!Number.isNaN(v)) o *= v;
      n = n.parentElement;
    }
    return o;
  };
  const aplats = tous
    .filter((el) => {
      const bg = versRgba(win.getComputedStyle(el).backgroundColor);
      if (!bg || bg.a * opaciteEffective(el) < 0.9) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 40) return false;
      // Un aplat = une surface coloree franche, ni blanc ni gris tres clair.
      const l = luminance(bg);
      return l < 0.5;
    })
    .map((el) => {
      const bg = versRgba(win.getComputedStyle(el).backgroundColor);
      const r = el.getBoundingClientRect();
      return {
        couleur:
          "rgb(" + Math.round(bg.r) + "," + Math.round(bg.v) + "," + Math.round(bg.b) + ")",
        marqueur: el.getAttribute("data-testid") || el.id || null,
        hauteur: Math.round(r.height),
        largeur: Math.round(r.width),
        dansCarte: dansCarte(el),
      };
    });

  // ---- textes : contraste, troncature, debordement --------------------------
  const contrastes = [];
  const clampes = [];
  const boitesTexte = [];
  for (const el of tous) {
    const aDuTexteDirect = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0
    );
    if (!aDuTexteDirect) continue;
    const st = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const texte = (el.textContent || "").trim().replace(/\\s+/g, " ");
    const couleur = versRgba(st.color);
    const fond = fondEffectif(el, doc);
    const taille = parseFloat(st.fontSize) || 0;
    const graisse = parseInt(st.fontWeight, 10) || 400;
    if (couleur) {
      const couleurComposee = couleur.a < 1 ? composer(couleur, fond) : couleur;
      contrastes.push({
        texte: texte.slice(0, 48),
        couleur: st.color,
        fond:
          "rgb(" + Math.round(fond.r) + "," + Math.round(fond.v) + "," + Math.round(fond.b) + ")",
        taille: Math.round(taille * 10) / 10,
        graisse,
        // Seuil AA : 3:1 pour du "grand texte" (>= 24px, ou >= 18.66px en gras).
        grandTexte: taille >= 24 || (taille >= 18.66 && graisse >= 700),
        ratio: Math.round(ratio(couleurComposee, fond) * 100) / 100,
        dansCarte: dansCarte(el),
      });
    }
    // Troncature reelle : le contenu deborde la boite qui le clippe.
    //
    // ATTENTION — "hidden" NE SUFFIT PAS. react-native-web rend numberOfLines
    // avec -webkit-line-clamp, et le navigateur calcule alors overflow: "clip",
    // pas "hidden". Ne tester que "hidden" faisait passer inapercues 9 troncatures
    // reelles a l'echelle x1,3 (la phrase de portee de la mesure, coupee sur tous
    // les etats a courbe). Bug trouve en comparant une capture a l'oeil avec le
    // verdict du verificateur : la capture montrait des points de suspension que
    // le compteur annoncait absents.
    const clipVertical =
      st.overflow === "hidden" ||
      st.overflowY === "hidden" ||
      st.overflow === "clip" ||
      st.overflowY === "clip" ||
      (st.webkitLineClamp && st.webkitLineClamp !== "none");
    if (clipVertical && el.scrollHeight > el.clientHeight + 1) {
      clampes.push({
        texte: texte.slice(0, 70),
        lignesMax: st.webkitLineClamp && st.webkitLineClamp !== "none" ? st.webkitLineClamp : null,
        cache: el.scrollHeight - el.clientHeight,
        dansCarte: dansCarte(el),
      });
    }
    if (
      (st.textOverflow === "ellipsis" || clipVertical) &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      clampes.push({
        texte: texte.slice(0, 70),
        lignesMax: "1",
        cache: el.scrollWidth - el.clientWidth,
        dansCarte: dansCarte(el),
      });
    }
    boitesTexte.push({
      texte: texte.slice(0, 40),
      absolu: st.position === "absolute" || st.position === "fixed",
      x: r.left - rVue.left,
      y: r.top - rVue.top,
      w: r.width,
      h: r.height,
      el,
    });
  }

  // ---- debordements lateraux ------------------------------------------------
  const debordements = [];
  for (const el of tous) {
    const st = win.getComputedStyle(el);
    if (st.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) continue;
    const depasseDroite = r.right - (rVue.left + cible.largeur);
    const depasseGauche = rVue.left - r.left;
    if (depasseDroite > 0.5 || depasseGauche > 0.5) {
      debordements.push({
        texte: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 50),
        droite: Math.round(depasseDroite * 10) / 10,
        gauche: Math.round(depasseGauche * 10) / 10,
      });
    }
  }

  // ---- chevauchements de textes --------------------------------------------
  // Deux boites de texte qui se recouvrent alors qu'aucune n'est en position
  // absolue = un texte ecrit par-dessus un autre.
  const chevauchements = [];
  const flux = boitesTexte.filter((b) => !b.absolu);
  for (let i = 0; i < flux.length; i++) {
    for (let j = i + 1; j < flux.length; j++) {
      const a = flux[i];
      const b = flux[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        chevauchements.push({
          a: a.texte,
          b: b.texte,
          recouvrement: Math.round(ox) + "x" + Math.round(oy),
        });
      }
    }
  }

  // ---- respiration finale ---------------------------------------------------
  // VIDE reel au bas de l'ecran : distance entre le bas du dernier element de
  // CONTENU (on exclut les conteneurs de mise en page, dont la boite inclut le
  // padding) et le bas du contenu.
  //
  // Trop peu : le dernier lien est colle a la barre d'onglets.
  // Trop : c'est le defaut du Home actuel, mesure a 70 px de vide en fin de
  // defilement par l'audit. Attendu ici : 24 px de respiration + 34 px d'inset
  // bas applique par <Screen> = 58 px sur un appareil a encoche.
  let basDernierTactile = null;
  let basDernierContenu = null;
  for (const el of tous) {
    const st = win.getComputedStyle(el);
    if (st.position === "absolute" || st.position === "fixed") continue;
    if (st.display === "none" || st.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 && r.width <= 0) continue;
    const bas = r.bottom - rVue.top;

    // Les conteneurs de mise en page portent le padding : leur bas EST le bas
    // du contenu, ils ne disent rien du dernier element visible.
    if (!el.hasAttribute("data-fks")) {
      if (basDernierContenu === null || bas > basDernierContenu) basDernierContenu = bas;
    }

    const role = el.getAttribute("role");
    const estTactile =
      el.tagName === "BUTTON" ||
      role === "button" ||
      role === "link" ||
      (el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1");
    if (estTactile && (basDernierTactile === null || bas > basDernierTactile)) {
      basDernierTactile = bas;
    }
  }

  return {
    hauteurTotale,
    hauteurVisible: cible.hauteurVisible,
    sousLaLigne: Math.max(0, hauteurTotale - cible.hauteurVisible),
    basDernierTactile: basDernierTactile === null ? null : Math.round(basDernierTactile),
    basDernierContenu: basDernierContenu === null ? null : Math.round(basDernierContenu),
    respirationFinale:
      basDernierContenu === null ? null : Math.round(hauteurTotale - basDernierContenu),
    nbBlocs: blocs.length,
    blocs,
    marqueurs: {
      actionPrincipale: marqueur("home-vnext-action-principale"),
      lienSecondaire: marqueur("home-vnext-lien-secondaire"),
      lienSortie: marqueur("home-vnext-lien-sortie"),
      courbe: marqueur("home-vnext-courbe"),
      formeInsuffisante: marqueur("home-vnext-forme-insuffisante"),
      etatDuJour: marqueur("home-vnext-etat-du-jour"),
      conseil: marqueur("home-vnext-conseil"),
      semaine: marqueur("home-vnext-semaine"),
    },
    tactiles,
    aplats,
    contrastes,
    clampes,
    debordements,
    chevauchements,
    stageLargeur: stage ? Math.round(stage.getBoundingClientRect().width) : null,
    // Encombrement de la carte progression, quand elle existe. Sert a dire ce
    // que la carte COUTE en hauteur par rapport au lien qu'elle remplace.
    carte: carteEl
      ? (function () {
          const rc = carteEl.getBoundingClientRect();
          return {
            hauteur: Math.round(rc.height),
            largeur: Math.round(rc.width),
            y: Math.round(rc.top - rVue.top),
            texte: (carteEl.textContent || "").trim().replace(/\\s+/g, " "),
            marqueurs: {
              detail: carteEl.querySelectorAll('[data-testid="home-vnext-progression-detail"]').length,
              fait: carteEl.querySelectorAll('[data-testid="home-vnext-progression-fait"]').length,
              portee: carteEl.querySelectorAll('[data-testid="home-vnext-progression-portee"]').length,
              test: carteEl.querySelectorAll('[data-testid="home-vnext-progression-test"]').length,
              courbe: carteEl.querySelectorAll('[data-testid="home-vnext-courbe"]').length,
            },
          };
        })()
      : null,
  };
}

// --- recuperation synchrone --------------------------------------------------
function lireSync(url) {
  const x = new XMLHttpRequest();
  x.open("GET", url, false);
  x.send(null);
  if (x.status !== 200) throw new Error("HTTP " + x.status + " sur " + url);
  return x.responseText;
}

// --- boucle ------------------------------------------------------------------
const cadre = document.getElementById("cadre");
const sortie = document.getElementById("resultat");
const etat = document.getElementById("etat");
const resultats = {};
const feuilles = {};

function feuilleDe(href) {
  // "../../app.css?v=abc" -> "/app.css"
  const nom = href.split("?")[0].split("/").pop();
  if (!feuilles[nom]) feuilles[nom] = lireSync("/" + nom);
  return feuilles[nom];
}

for (let i = 0; i < CIBLES.length; i++) {
  const cible = CIBLES[i];
  try {
    let html = lireSync(cible.url);
    // La feuille liee devient une feuille EN LIGNE : sans ca, elle se chargerait
    // apres la mesure et on mesurerait une page sans style.
    html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, href) => {
      try {
        return "<style>" + feuilleDe(href) + "</style>";
      } catch (e) {
        return "<!-- feuille introuvable : " + href + " -->";
      }
    });
    const doc = cadre.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    resultats[cible.cle] = mesurerUnePage(doc, cible);
  } catch (e) {
    resultats[cible.cle] = { erreur: String((e && e.message) || e) };
  }
}

sortie.textContent = "###JSON###" + JSON.stringify(resultats) + "###FIN###";
etat.textContent = "termine : " + CIBLES.length + " pages mesurees";
</script>
</body></html>`;
}

module.exports = { mesureHtml };
