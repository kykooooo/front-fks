// __tests__/homeVNext/visualiseurAxes.test.ts
// =============================================================================
// LE VISUALISEUR NE DOIT PAS PROPOSER DE BOUTON QUI NE MENE NULLE PART
// =============================================================================
//
// CE QUE CES TESTS PROTEGENT
// -----------------------------------------------------------------------------
// Le panneau « Valider » range les questions par AXE, et chaque axe propose des
// CIBLES : un clic pose l'etat, la variante, la largeur, la vue, l'echelle de
// texte et la presentation d'un seul coup. Ces cibles sont ecrites a la main
// (lib/axesAValider.js) et designent des etats par identifiant.
//
// Une faute de frappe dans un identifiant ne casse rien : le visualiseur affiche
// « etat non genere » a la place du bouton, et le fondateur ne voit qu'un axe
// legerement plus pauvre. C'est exactement le genre de degradation silencieuse
// qui survit a une relecture. Ces tests la font echouer bruyamment.
//
// Ils verrouillent aussi la garantie la plus importante de l'axe presentation :
// la combinaison PAR DEFAUT ne passe AUCUNE prop a l'ecran. C'est ce qui rend
// les pages deja validees rigoureusement identiques a ce qu'elles etaient avant
// l'ajout de cet axe — pas « equivalentes », identiques.
//
// Ils tournent en JavaScript pur : ni jsdom, ni rendu, ni build.
// =============================================================================

import { HOME_VNEXT_FIXTURES_RENDU, PROGRESSION_FIXTURES_RENDU } from "../../screens/homeVNext/fixtures";
import { PRESENTATIONS_A_COMPARER } from "../../components/homeVNext/homeVNextPresentation";

// Les modules du harnais sont du JavaScript sans type : `require` est ici le bon
// outil, et le seul qui n'oblige pas a leur inventer des declarations.
/* eslint-disable @typescript-eslint/no-var-requires */
const { AXES, COUVERTURE } = require("../../prototype/home-vnext/lib/axesAValider");
const appariement = require("../../prototype/home-vnext/lib/appariementVariante2");
const presentations = require("../../prototype/home-vnext/lib/presentations");
/* eslint-enable @typescript-eslint/no-var-requires */

type Cible = {
  libelle?: string;
  etat: string;
  variante?: string;
  paire?: string;
  largeur?: number;
  vue?: string;
  x13?: boolean;
  presentation?: string;
};

/** Tous les identifiants d'etat qu'une generation complete produit. */
const ETATS_CONNUS = new Set<string>([
  ...HOME_VNEXT_FIXTURES_RENDU.map((f) => f.id),
  ...appariement.APPARIEMENTS.map((a: { id: string }) => a.id),
]);

const LARGEURS_GENEREES = [320, 375, 390, 768];
const LARGEUR_TEXTE_AGRANDI = 375;

const toutesLesCibles = (): { axe: string; cible: Cible }[] =>
  (AXES as { id: string; cibles: Cible[] }[]).flatMap((a) =>
    a.cibles.map((c) => ({ axe: a.id, cible: c }))
  );

describe("visualiseur — les sept axes", () => {
  it("couvre exactement les sept axes demandes, sans doublon", () => {
    expect((AXES as { id: string }[]).map((a) => a.id)).toEqual([
      "hierarchie-typo",
      "densite",
      "hauteur",
      "lisibilite",
      "carte-progression",
      "pied-secondaire",
      "pastille-absente",
    ]);
  });

  it("donne, pour chaque axe, une question, une bascule et DEUX verdicts separes", () => {
    // Un axe qui ne dirait pas quelle bascule manipuler obligerait a chercher le
    // reglage a la main — et on finirait par juger autre chose que l'axe.
    // Un axe qui fondrait « oui » et « non » dans une seule phrase forcerait un
    // verdict unique, ce que cette iteration cherche precisement a eviter.
    for (const a of AXES as Record<string, string>[]) {
      expect(typeof a.question).toBe("string");
      expect(a.question.length).toBeGreaterThan(20);
      expect(a.bascule.length).toBeGreaterThan(20);
      expect(a.regarder.length).toBeGreaterThan(20);
      expect(a.oui.length).toBeGreaterThan(20);
      expect(a.non.length).toBeGreaterThan(20);
      expect(a.oui).not.toEqual(a.non);
    }
  });

  it("ne designe QUE des etats reellement generes — aucun bouton mort", () => {
    const inconnus = toutesLesCibles().filter(({ cible }) => !ETATS_CONNUS.has(cible.etat));
    expect(
      inconnus.map(({ axe, cible }) => `${axe} -> ${cible.etat}`)
    ).toEqual([]);
  });

  it("ne designe que des largeurs, vues, paires et presentations qui existent", () => {
    const idsPresentation = new Set(PRESENTATIONS_A_COMPARER.map((p) => p.id));
    const fautes: string[] = [];
    for (const { axe, cible } of toutesLesCibles()) {
      if (cible.largeur != null && !LARGEURS_GENEREES.includes(cible.largeur)) {
        fautes.push(`${axe} : largeur ${cible.largeur}`);
      }
      if (cible.vue != null && !["visible", "entiere"].includes(cible.vue)) {
        fautes.push(`${axe} : vue ${cible.vue}`);
      }
      if (cible.variante != null && !["vnext", "vnext2", "actuel", "duo"].includes(cible.variante)) {
        fautes.push(`${axe} : variante ${cible.variante}`);
      }
      if (cible.presentation != null && !idsPresentation.has(cible.presentation)) {
        fautes.push(`${axe} : presentation ${cible.presentation}`);
      }
      // Le texte agrandi n'est genere qu'a une seule largeur. Une cible qui le
      // demanderait ailleurs afficherait la page a taille normale sans le dire.
      if (cible.x13 && (cible.largeur ?? 375) !== LARGEUR_TEXTE_AGRANDI) {
        fautes.push(`${axe} : texte x1,3 demande en ${cible.largeur} px`);
      }
      // Une cible « cote a cote » doit nommer sa paire : sinon elle herite de
      // celle qui trainait, et deux clics sur le meme bouton montrent deux choses.
      if (cible.variante === "duo" && !cible.paire) {
        fautes.push(`${axe} : cote a cote sans paire nommee`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("ne demande la carte progression que sur des etats qui en ont une", () => {
    // Une cible « vnext2 » sur un etat de variante 1 afficherait une page
    // d'explication a la place de l'ecran. Les etats de carte sont ceux, et
    // seulement ceux, dont l'identifiant est declare dans l'appariement.
    const etatsAvecCarte = new Set(appariement.APPARIEMENTS.map((a: { id: string }) => a.id));
    const fautes = toutesLesCibles()
      .filter(({ cible }) => {
        const variante = cible.variante ?? (etatsAvecCarte.has(cible.etat) ? "vnext2" : "vnext");
        if (variante === "vnext2") return !etatsAvecCarte.has(cible.etat);
        if (variante === "duo" && cible.paire && cible.paire.includes("2")) {
          return !etatsAvecCarte.has(cible.etat);
        }
        return false;
      })
      .map(({ axe, cible }) => `${axe} -> ${cible.etat}`);
    expect(fautes).toEqual([]);
  });
});

describe("visualiseur — les huit situations a couvrir", () => {
  it("les couvre toutes, et chacune pointe sur un etat reellement genere", () => {
    expect(COUVERTURE).toHaveLength(8);
    const fautes = (COUVERTURE as { situation: string; cible: Cible }[])
      .filter((c) => !ETATS_CONNUS.has(c.cible.etat))
      .map((c) => `${c.situation} -> ${c.cible.etat}`);
    expect(fautes).toEqual([]);
  });

  it("couvre les sept cas de carte, et le huitieme par un reglage et non par une fixture", () => {
    // Le reglage d'accessibilite n'est PAS une donnee de joueur : lui inventer
    // une fixture obligerait a en ecrire une par combinaison. Il se regarde donc
    // par la bascule de presentation, sur un etat existant.
    const parPresentation = (COUVERTURE as { cible: Cible }[]).filter(
      (c) => c.cible.presentation != null
    );
    expect(parPresentation).toHaveLength(1);
    const p = PRESENTATIONS_A_COMPARER.find((x) => x.id === parPresentation[0].cible.presentation);
    expect(p).toBeDefined();
    expect(p!.preferences.reduceMotion).toBe(true);

    // Les sept cas de carte sont tous atteignables depuis les axes.
    const vises = new Set(toutesLesCibles().map(({ cible }) => cible.etat));
    const manquants = PROGRESSION_FIXTURES_RENDU.map((f) => `v2-${f.id}`).filter(
      (id) => !vises.has(id)
    );
    expect(manquants).toEqual([]);
  });
});

describe("harnais — l'axe presentation", () => {
  it("derive du produit, jamais d'une liste recopiee", () => {
    const p = presentations.construirePresentations(PRESENTATIONS_A_COMPARER, LARGEURS_GENEREES);
    expect(p.map((x: { id: string }) => x.id)).toEqual(PRESENTATIONS_A_COMPARER.map((x) => x.id));
  });

  it("ne passe AUCUNE prop pour la combinaison par defaut", () => {
    // C'est la garantie de non-regression : les pages deja validees traversent
    // exactement le meme chemin qu'avant l'ajout de cet axe. Poser
    // `echelle="allegee"` a la place ferait le meme rendu, mais par un autre
    // chemin — et « le meme rendu » ne serait plus demontre, seulement suppose.
    const [defaut, ...autres] = presentations.construirePresentations(
      PRESENTATIONS_A_COMPARER,
      LARGEURS_GENEREES
    );
    expect(defaut.parDefaut).toBe(true);
    expect(presentations.propsDePresentation(defaut)).toEqual({});
    expect(defaut.suffixe).toBe("");
    for (const a of autres) {
      expect(presentations.propsDePresentation(a)).toEqual({
        echelle: a.echelle,
        reduceMotion: a.reduceMotion,
      });
      expect(a.suffixe).not.toBe("");
    }
    // Aucun suffixe en double : deux presentations qui partageraient un suffixe
    // ecraseraient mutuellement leurs fichiers, en silence.
    const suffixes = [defaut, ...autres].map((x: { suffixe: string }) => x.suffixe);
    expect(new Set(suffixes).size).toBe(suffixes.length);
  });

  it("retombe sur la seule combinaison par defaut si le produit est illisible", () => {
    const p = presentations.construirePresentations(null, LARGEURS_GENEREES);
    expect(p).toHaveLength(1);
    expect(p[0].parDefaut).toBe(true);
    expect(presentations.propsDePresentation(p[0])).toEqual({});
  });

  it("ne genere les autres combinaisons qu'aux largeurs de comparaison", () => {
    const p = presentations.construirePresentations(PRESENTATIONS_A_COMPARER, LARGEURS_GENEREES);
    expect(p[0].largeurs).toEqual(LARGEURS_GENEREES);
    for (const a of p.slice(1)) {
      expect(a.largeurs).toEqual(presentations.LARGEURS_COMPARAISON);
      expect(a.pourquoiPasPartout).toEqual(expect.any(String));
    }
  });
});

describe("harnais — la mesure du mouvement", () => {
  const marqueur = presentations.MARQUEUR_MOUVEMENT;
  const avec = `<div class="x" style="transform: scale(1);" data-testid="${marqueur}"><button/></div>`;
  const sans = `<div class="x" data-testid="${marqueur}"><button/></div>`;

  it("distingue un conteneur qui porte une consigne de mouvement d'un conteneur qui n'en porte aucune", () => {
    expect(presentations.mesurerMouvement(avec)).toMatchObject({ conteneurs: 1, avecTransform: 1 });
    expect(presentations.mesurerMouvement(sans)).toMatchObject({ conteneurs: 1, avecTransform: 0 });
    expect(presentations.mesurerMouvement("")).toMatchObject({ conteneurs: 0, avecTransform: 0 });
  });

  it("attend la PRESENCE quand le mouvement est autorise, et l'ABSENCE quand il ne l'est pas", () => {
    // Les deux sens comptent. Un controle qui n'exigerait que l'absence
    // passerait aussi sur un ecran ou le mouvement a ete oublie partout — et
    // « respecte le reglage » voudrait alors dire « ne fait rien ».
    expect(presentations.controleMouvement(presentations.mesurerMouvement(sans), true)).toMatchObject({
      valeur: 0,
      attendu: 0,
    });
    expect(presentations.controleMouvement(presentations.mesurerMouvement(avec), false)).toMatchObject({
      valeur: 1,
      attendu: 1,
    });
    // Le cas qui doit echouer : le reglage est actif, et la consigne est restee.
    const rate = presentations.controleMouvement(presentations.mesurerMouvement(avec), true);
    expect(rate.valeur).not.toBe(rate.attendu);
  });

  it("repere une animation qui tourne pendant la capture", () => {
    // Le Home de PRODUCTION pulse en boucle sans consulter le reglage du
    // telephone : au repos, son echelle ne vaut pas 1. C'est ce que cette mesure
    // attrape — et c'est la seule chose qui empeche deux generations d'etre
    // rigoureusement identiques.
    expect(presentations.mesurerPulsation('style="transform: scale(1.0148776);"')).toEqual([1.0148776]);
    expect(presentations.mesurerPulsation('style="transform: scale(1);"')).toEqual([]);
  });
});
