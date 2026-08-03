// __tests__/homeVNext/echelleEtMouvement.test.tsx
// =============================================================================
// PROTOTYPE Home vNext — ECHELLE TYPOGRAPHIQUE, PLAFONDS D'AGRANDISSEMENT,
// ET REGLAGE « REDUIRE LES ANIMATIONS »
// =============================================================================
//
// CE QUE CE FICHIER PROTEGE, ET POURQUOI CHAQUE REGLE Y EST
// -----------------------------------------------------------------------------
//  1. L'ECHELLE ALLEGEE est celle que le fondateur a ecrite, au dixieme pres.
//     Les valeurs attendues sont RECOPIEES ICI, a la main, depuis sa consigne :
//     si le test lisait la meme source que le code, il ne verifierait rien.
//  2. L'ECHELLE ACTUELLE n'a pas bouge. C'est la reference de comparaison ; si
//     elle derive, l'ecart montre au fondateur n'est plus l'ecart reel.
//  3. LA BASCULE FAIT QUELQUE CHOSE. Un test monte l'ecran dans les deux
//     echelles et exige que le rendu differe. Sans lui, une regression qui
//     ignorerait le contexte passerait pour un succes.
//  4. L'AGRANDISSEMENT SYSTEME n'est jamais desactive, et seuls les textes
//     d'affichage sont plafonnes. Un plafond pose par erreur sur la portee de la
//     mesure ou sur un message d'explication serait une perte d'information pour
//     les joueurs qui agrandissent leurs textes.
//  5. BORNER UN LIBELLE NE RAPETISSE PAS SA CIBLE. Verifie sur toutes les cibles
//     de tous les etats.
//  6. AUCUNE BOUCLE D'ANIMATION, et AUCUN MOUVEMENT quand « reduire les
//     animations » est actif.
//
//     C'est la regle de non-regression demandee. Elle vise un defaut REEL, mais
//     qui est en production et non dans ce prototype : `components/home/
//     HomePrimaryCTA.tsx` (lignes 39-49) lance un `Animated.loop` infini — une
//     pulsation d'echelle 1 -> 1,015, 900 ms dans chaque sens — sans jamais
//     consulter `reduceMotion`, alors que `screens/HomeScreen.tsx` (lignes 72-73)
//     le consulte pour son fondu d'entree. Ce fichier-la est hors du perimetre
//     du prototype et n'est pas corrige ici.
//
//     Le prototype, lui, n'a AUCUNE boucle aujourd'hui. Un test qui se contente
//     de constater une absence ne prouve rien : il serait vert meme casse. D'ou
//     le CANARI (`CanariPulsation`, plus bas) — un composant qui, lui, demarre
//     vraiment une boucle. Le meme detecteur doit le prendre. C'est ce qui
//     garantit qu'au moment de l'integration, brancher un `HomePrimaryCTA` non
//     garde fera echouer la suite au lieu de passer inapercu.
//
// NOTE D'EXECUTION : la config jest du depot ignore `.claude/worktrees/`. Depuis
// ce worktree, `npx jest` liste 0 test et sort en SUCCES. Ce fichier s'execute
// avec la config dediee :
//   npx jest --config prototype/home-vnext/jest.proto.config.js
// =============================================================================

import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { HomeVNextScreen } from "../../screens/homeVNext/HomeVNextScreen";
import {
  HOME_VNEXT_FIXTURES_RENDU,
  progressionInputDepuisHome,
} from "../../screens/homeVNext/fixtures";
import { buildProgressionViewModel } from "../../screens/homeVNext/progressionViewModel";
import { buildHomeVNextViewModel } from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "../../components/homeVNext/homeVNextMarqueurs";
import {
  PRESENTATIONS_A_COMPARER,
  PRESENTATION_PAR_DEFAUT,
} from "../../components/homeVNext/homeVNextPresentation";
import {
  AGRANDISSEMENT_LIBRE_MINIMAL,
  ECHELLES,
  ECHELLE_ACTUELLE,
  ECHELLE_ALLEGEE,
  ECHELLE_PAR_DEFAUT,
  PLAFOND_AGRANDISSEMENT,
  plafondDuRole,
  type RoleTypo,
  type StyleTypo,
} from "../../components/homeVNext/homeVNextTypo";
import {
  couleurs,
  SEUIL_CONTRASTE_AA,
  TAILLE_TACTILE_MIN,
} from "../../components/homeVNext/homeVNextTokens";

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

const ETATS = HOME_VNEXT_FIXTURES_RENDU;

// -----------------------------------------------------------------------------
// Outils de montage et de lecture d'arbre
// -----------------------------------------------------------------------------

type OptionsMontage = { echelle?: "actuelle" | "allegee"; reduceMotion?: boolean };

function monter(
  vm: ReturnType<typeof buildHomeVNextViewModel>,
  options: OptionsMontage = {}
) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(
      <HomeVNextScreen vm={vm} echelle={options.echelle} reduceMotion={options.reduceMotion} />
    );
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

/**
 * Le meme ecran, en VARIANTE 2 — celle que le fondateur a validee.
 *
 * Les garanties de cette suite (agrandissement libre, plafonds reserves aux
 * textes d'affichage, plancher tactile de 44 pt) doivent tenir sur l'ecran REEL,
 * pas seulement sur la variante 1. La carte progression apporte ses propres
 * textes (la portee, le cumul, la comparaison de test) et sa propre cible
 * tactile (le pied) : rien de tout cela n'etait couvert ici.
 */
function monterV2(
  fixture: (typeof HOME_VNEXT_FIXTURES_RENDU)[number],
  options: OptionsMontage = {}
) {
  const vm = buildHomeVNextViewModel(fixture.input, { variante: "v2" });
  const progression = buildProgressionViewModel(progressionInputDepuisHome(fixture.input));
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(
      <HomeVNextScreen
        vm={vm}
        variante="v2"
        progression={progression}
        echelle={options.echelle}
        reduceMotion={options.reduceMotion}
      />
    );
  });
  if (!rendu) throw new Error("rendu impossible");
  return { rendu: rendu as TestRenderer.ReactTestRenderer, vm, progression };
}

/** Le contenu textuel direct d'un noeud `Text`. */
function contenu(node: ReactTestInstance): string {
  return React.Children.toArray(node.props.children as React.ReactNode)
    .filter((c): c is string => typeof c === "string")
    .join("");
}

/** Le premier `Text` dont le contenu vaut exactement `texte`. `null` si absent. */
function texteExact(instance: ReactTestInstance, texte: string): ReactTestInstance | null {
  return instance.findAllByType(Text).find((n) => contenu(n) === texte) ?? null;
}

/**
 * Tous les elements REELLEMENT tactiles de l'arbre.
 *
 * Meme technique que les autres suites du prototype : on ne cherche pas
 * `Pressable` par son type (RN l'exporte enveloppe dans un `memo(forwardRef)`,
 * que `findAllByType` ne retrouve pas) mais un noeud natif qui capte le toucher.
 */
function elementsTactiles(instance: ReactTestInstance): ReactTestInstance[] {
  return instance.findAll(
    (n) =>
      typeof n.type === "string" &&
      typeof (n.props as { onStartShouldSetResponder?: unknown })
        .onStartShouldSetResponder === "function"
  );
}

/** Le noeud natif porteur d'un marqueur donne. */
function noeudsMarques(instance: ReactTestInstance, marqueur: string): ReactTestInstance[] {
  return instance.findAll((n) => typeof n.type === "string" && n.props.testID === marqueur);
}

/**
 * Les gestionnaires d'appui reellement poses par le prototype.
 *
 * On cible les elements `Pressable` par leurs PROPS et non par leur type : RN
 * exporte `Pressable` enveloppe dans un `memo(forwardRef)`, et surtout le noeud
 * natif qu'il rend ne porte plus `onPressIn` / `onPressOut` — `Pressability` les
 * a deja traduits en gestionnaires de responder. Appeler nos gestionnaires
 * directement teste ce que le prototype ecrit, sans traverser la machinerie
 * interne de RN (qui exige un evenement synthetique complet).
 */
function gestionnairesDAppui(
  instance: ReactTestInstance
): { onPressIn: () => void; onPressOut: () => void }[] {
  return instance
    .findAll(
      (n) =>
        typeof (n.props as { onPressIn?: unknown }).onPressIn === "function" &&
        typeof (n.props as { onPressOut?: unknown }).onPressOut === "function",
      { deep: true }
    )
    .map((n) => n.props as { onPressIn: () => void; onPressOut: () => void });
}

/**
 * Le rapport de contraste WCAG 2.1 entre deux couleurs `#RRGGBB`.
 *
 * Recalcule ici plutot que lu dans `CONTRASTES_MESURES` : un test qui relit la
 * valeur affichee par le fichier qu'il verifie ne verifie rien. Formule :
 * linearisation sRGB, luminance relative L = 0,2126 R + 0,7152 V + 0,0722 B,
 * puis (Lclair + 0,05) / (Lsombre + 0,05).
 */
function contrasteWCAG(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const propre = hex.replace("#", "");
    const canaux = [0, 2, 4].map((i) => parseInt(propre.slice(i, i + 2), 16) / 255);
    const [r, v, bl] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * v! + 0.0722 * bl!;
  };
  const la = luminance(a);
  const lb = luminance(b);
  const clair = Math.max(la, lb);
  const sombre = Math.min(la, lb);
  return (clair + 0.05) / (sombre + 0.05);
}

/** Toutes les tailles de police posees dans l'arbre rendu. */
function taillesDePolice(node: unknown): number[] {
  const trouvees: number[] = [];
  const visiter = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const style = StyleSheet.flatten(n.props?.style) as { fontSize?: unknown } | undefined;
    if (typeof style?.fontSize === "number") trouvees.push(style.fontSize);
    (n.children ?? []).forEach(visiter);
  };
  visiter(node);
  return trouvees;
}

// =============================================================================
// 1. LES DEUX ECHELLES
// =============================================================================

/**
 * L'echelle ALLEGEE, recopiee A LA MAIN depuis la consigne du fondateur.
 *
 *   salutation ............... 20 px, poids 700, interligne 26
 *   titre du CTA ............. 16 px, poids 700, interligne 21
 *   labels MA SEMAINE / ...... 12 px, poids 700, tracking ~0,8
 *   valeurs principales ...... 16-17 px, poids 700      -> 16 retenu
 *   texte courant ............ 14 px, poids 400 ou 500, interligne 20 -> 500 retenu
 *   metadonnees .............. 12-13 px                 -> 12 retenu
 *   liens secondaires ........ 14 px, poids 600
 *
 * Les trois derniers roles ne figurent pas dans sa liste : ce sont des fragments
 * accentues, alignes sur le palier voisin (documente dans `homeVNextTypo.ts`).
 */
const ALLEGEE_ATTENDUE: Record<RoleTypo, Partial<StyleTypo>> = {
  salutation: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  titreAction: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  overline: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  valeur: { fontSize: 16, fontWeight: "700" },
  corps: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  meta: { fontSize: 12 },
  lien: { fontSize: 14, fontWeight: "600" },
  emphaseCorps: { fontSize: 14, fontWeight: "600" },
  emphaseMeta: { fontSize: 12, fontWeight: "600" },
  metaAppuyee: { fontSize: 12, fontWeight: "700" },
};

/** L'echelle ACTUELLE, recopiee depuis ce qui etait a l'ecran avant. */
const ACTUELLE_ATTENDUE: Record<RoleTypo, StyleTypo> = {
  salutation: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.3 },
  titreAction: { fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: 0.3 },
  overline: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  valeur: { fontSize: 16, lineHeight: 20, fontWeight: "700", letterSpacing: 0 },
  corps: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0 },
  lien: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  emphaseCorps: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0 },
  emphaseMeta: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0 },
  metaAppuyee: { fontSize: 12, lineHeight: 16, fontWeight: "800", letterSpacing: 0 },
};

const ROLES = Object.keys(ACTUELLE_ATTENDUE) as RoleTypo[];

describe("Echelle typographique — les deux jeux", () => {
  it("expose exactement deux echelles, completes, sans role manquant", () => {
    expect(Object.keys(ECHELLES).sort()).toEqual(["actuelle", "allegee"]);
    for (const role of ROLES) {
      expect(ECHELLE_ACTUELLE[role]).toBeDefined();
      expect(ECHELLE_ALLEGEE[role]).toBeDefined();
    }
    // Et aucun role de plus, qui echapperait a la comparaison.
    expect(Object.keys(ECHELLE_ACTUELLE).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(ECHELLE_ALLEGEE).sort()).toEqual([...ROLES].sort());
  });

  it.each(ROLES)(
    "l'echelle allegee respecte la consigne du fondateur pour %s",
    (role: RoleTypo) => {
      expect(ECHELLE_ALLEGEE[role]).toMatchObject(ALLEGEE_ATTENDUE[role]);
    }
  );

  it.each(ROLES)("l'echelle actuelle n'a pas bouge d'un dixieme pour %s", (role: RoleTypo) => {
    expect(ECHELLE_ACTUELLE[role]).toEqual(ACTUELLE_ATTENDUE[role]);
  });

  it("supprime l'accumulation de graisse 800 : cinq roles avant, aucun apres", () => {
    const en800 = (echelle: typeof ECHELLE_ACTUELLE) =>
      ROLES.filter((r) => echelle[r].fontWeight === "800");
    expect(en800(ECHELLE_ACTUELLE)).toHaveLength(5);
    expect(en800(ECHELLE_ALLEGEE)).toHaveLength(0);
    // Graisse maximale de la nouvelle echelle : 700.
    for (const role of ROLES) {
      expect(Number(ECHELLE_ALLEGEE[role].fontWeight)).toBeLessThanOrEqual(700);
    }
  });

  it("ne rapetisse rien pour gagner de la hauteur : le texte lu GRANDIT", () => {
    // C'est la contrainte explicite du fondateur — le defilement est accepte,
    // reduire les textes explicatifs pour tenir dans une hauteur est interdit.
    expect(ECHELLE_ALLEGEE.corps.fontSize).toBeGreaterThan(ECHELLE_ACTUELLE.corps.fontSize);
    expect(ECHELLE_ALLEGEE.corps.lineHeight).toBeGreaterThan(ECHELLE_ACTUELLE.corps.lineHeight);
    expect(ECHELLE_ALLEGEE.lien.fontSize).toBeGreaterThan(ECHELLE_ACTUELLE.lien.fontSize);
    // Les metadonnees et les valeurs ne perdent pas un pixel non plus.
    expect(ECHELLE_ALLEGEE.meta.fontSize).toBe(ECHELLE_ACTUELLE.meta.fontSize);
    expect(ECHELLE_ALLEGEE.valeur.fontSize).toBe(ECHELLE_ACTUELLE.valeur.fontSize);
  });

  it("rend l'echelle allegee par defaut", () => {
    expect(ECHELLE_PAR_DEFAUT).toBe("allegee");
    expect(PRESENTATION_PAR_DEFAUT.echelle).toBe("allegee");
    // Et le defaut est vraiment applique quand l'ecran ne recoit aucune prop.
    const vm = buildHomeVNextViewModel(ETATS[1]!.input);
    const sansProp = monter(vm);
    const explicite = monter(vm, { echelle: "allegee" });
    expect(taillesDePolice(sansProp.toJSON())).toEqual(taillesDePolice(explicite.toJSON()));
    demonter(sansProp);
    demonter(explicite);
  });

  it("la bascule change reellement le rendu (elle n'est pas un decor)", () => {
    // Sans ce test, un composant qui oublierait de lire le contexte rendrait
    // toujours la meme chose et la comparaison montree au fondateur serait fausse.
    const vm = buildHomeVNextViewModel(ETATS[1]!.input);
    const allegee = monter(vm, { echelle: "allegee" });
    const actuelle = monter(vm, { echelle: "actuelle" });

    const taillesAllegee = taillesDePolice(allegee.toJSON());
    const taillesActuelle = taillesDePolice(actuelle.toJSON());

    expect(taillesAllegee.length).toBeGreaterThan(0);
    expect(taillesAllegee).not.toEqual(taillesActuelle);
    // La salutation, elle, est verifiable nommement.
    expect(taillesAllegee).toContain(ECHELLE_ALLEGEE.salutation.fontSize);
    expect(taillesActuelle).toContain(ECHELLE_ACTUELLE.salutation.fontSize);

    demonter(allegee);
    demonter(actuelle);
  });

  it("propose les quatre reglages a comparer, tous distincts", () => {
    const cles = PRESENTATIONS_A_COMPARER.map(
      (p) => `${p.preferences.echelle}/${p.preferences.reduceMotion}`
    );
    expect(new Set(cles).size).toBe(cles.length);
    expect(cles).toHaveLength(4);
  });
});

// =============================================================================
// 2. LES PLAFONDS D'AGRANDISSEMENT SYSTEME
// =============================================================================

describe("Agrandissement systeme — la politique", () => {
  it("ne borne QUE les trois roles d'affichage", () => {
    const bornes = ROLES.filter((r) => PLAFOND_AGRANDISSEMENT[r] !== null);
    expect(bornes.sort()).toEqual(["overline", "salutation", "titreAction"]);
  });

  it("laisse grandir sans limite tout ce qui porte une information", () => {
    // Le fondateur l'a pose comme une regle : « informations et textes
    // explicatifs, AUCUNE borne sous x1,3 ». `null` = aucune borne du tout.
    for (const role of ["valeur", "corps", "meta", "lien"] as const) {
      expect(PLAFOND_AGRANDISSEMENT[role]).toBeNull();
      expect(plafondDuRole(role)).toEqual({});
    }
    expect(AGRANDISSEMENT_LIBRE_MINIMAL).toBe(1.3);
  });

  it("tient les plafonds demandes : ~1,2 pour l'affichage, ~1,15 pour les capitales", () => {
    expect(PLAFOND_AGRANDISSEMENT.salutation).toBe(1.2);
    expect(PLAFOND_AGRANDISSEMENT.titreAction).toBe(1.2);
    expect(PLAFOND_AGRANDISSEMENT.overline).toBe(1.15);
    expect(plafondDuRole("salutation")).toEqual({ maxFontSizeMultiplier: 1.2 });
  });

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne desactive jamais l'agrandissement systeme",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);
      for (const t of rendu.root.findAllByType(Text)) {
        // `undefined` (le defaut, donc actif) est la seule valeur toleree ;
        // `false` desactiverait l'agrandissement et est interdit partout.
        expect(t.props.allowFontScaling).not.toBe(false);
      }
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne pose de plafond que sur des textes d'affichage",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);

      const plafonnes = rendu.root
        .findAllByType(Text)
        .filter((t) => t.props.maxFontSizeMultiplier !== undefined);

      // Les seuls textes plafonnes possibles, dans l'ordre de l'ecran : la
      // salutation, le libelle de l'action, et les titres de section.
      const autorises = new Set<string>([
        vm.header.greeting,
        vm.action.label,
        "MA SEMAINE",
        "MA FORME",
        "MA PROGRESSION",
      ]);

      for (const t of plafonnes) {
        expect(autorises.has(contenu(t))).toBe(true);
        expect(t.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.2);
        expect(t.props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(1.15);
      }

      // Et, dans l'autre sens : ce qui porte l'information n'est JAMAIS borne.
      const jamaisBornes = [
        vm.header.dateLabel,
        vm.action.sublabel,
        vm.action.secondary?.label,
        vm.why?.text,
        vm.week?.message,
        vm.exit?.label,
        vm.form && vm.form.kind === "available" ? vm.form.scope : null,
        vm.form && vm.form.kind === "insufficient" ? vm.form.message : null,
        vm.note?.message,
        vm.dataNotice,
      ].filter((v): v is string => typeof v === "string" && v.length > 0);

      for (const attendu of jamaisBornes) {
        const noeud = texteExact(rendu.root, attendu);
        if (noeud === null) continue; // ce texte n'est pas a l'ecran dans cet etat
        expect(noeud.props.maxFontSizeMultiplier).toBeUndefined();
      }

      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s : borner un libelle ne rapetisse pas sa cible tactile",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm);

      const cibles = elementsTactiles(rendu.root);
      expect(cibles.length).toBeGreaterThan(0);

      for (const cible of cibles) {
        const style = StyleSheet.flatten(cible.props.style) as { minHeight?: number };
        // Le plancher tient dans TOUS les cas, plafond ou pas.
        expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);

        // Et quand la cible CONTIENT un texte plafonne, le plancher ne vient pas
        // de la taille du texte mais du conteneur : il reste donc intact.
        const contientUnPlafond = cible
          .findAllByType(Text)
          .some((t) => t.props.maxFontSizeMultiplier !== undefined);
        if (contientUnPlafond) {
          expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
        }
      }

      // L'aplat d'action, nommement : 76 pt poses par son conteneur.
      if (vm.action.emphasis === "aplat") {
        const aplat = rendu.root.findAll(
          (n) => typeof n.type === "string" && n.props.nativeID === MARQUEURS.aplat
        );
        expect(aplat).toHaveLength(1);
        const style = StyleSheet.flatten(aplat[0]!.props.style) as { minHeight?: number };
        expect(style?.minHeight).toBe(76);
      }

      demonter(rendu);
    }
  );
});

// =============================================================================
// 2 bis. LES MEMES GARANTIES SUR L'ECRAN VALIDE (VARIANTE 2)
// =============================================================================
// Tout ce qui precede monte la variante 1. Or c'est la variante 2 que le
// fondateur a validee, et elle porte des textes que la variante 1 n'a pas : la
// portee de la courbe, le cumul en ligne de metadonnee, la comparaison de test,
// et une cible tactile de plus (le pied de la carte).
// =============================================================================

describe("Variante 2 — l'ecran valide tient les memes regles", () => {
  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne desactive jamais l'agrandissement systeme",
    (_id, fixture) => {
      const { rendu } = monterV2(fixture);
      for (const t of rendu.root.findAllByType(Text)) {
        expect(t.props.allowFontScaling).not.toBe(false);
      }
      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne plafonne que des textes d'affichage, jamais la portee ni un fait",
    (_id, fixture) => {
      const { rendu, vm, progression } = monterV2(fixture);

      const autorises = new Set<string>([
        vm.header.greeting,
        vm.action.label,
        "MA SEMAINE",
        "MA PROGRESSION",
      ]);
      for (const t of rendu.root
        .findAllByType(Text)
        .filter((n) => n.props.maxFontSizeMultiplier !== undefined)) {
        expect(autorises.has(contenu(t))).toBe(true);
      }

      // Et nommement, dans l'autre sens : les textes que la carte ajoute a
      // l'ecran ne sont bornes par rien.
      const jamaisBornes: string[] = [];
      if (progression.state === "ready") {
        jamaisBornes.push(progression.courbe.portee, progression.resume.libelle);
      }
      if (progression.state === "collecting") {
        jamaisBornes.push(...progression.faits.map((f) => f.libelle));
      }
      if (progression.detail.affiche && progression.detail.label !== null) {
        jamaisBornes.push(progression.detail.label);
      }
      for (const attendu of jamaisBornes) {
        const noeud = texteExact(rendu.root, attendu);
        if (noeud === null) continue;
        expect(noeud.props.maxFontSizeMultiplier).toBeUndefined();
      }

      demonter(rendu);
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s : toutes les cibles tactiles tiennent 44 pt, pied de carte compris",
    (_id, fixture) => {
      const { rendu, progression } = monterV2(fixture);

      for (const cible of elementsTactiles(rendu.root)) {
        const style = StyleSheet.flatten(cible.props.style) as { minHeight?: number };
        expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
      }

      // Le pied de la carte est une cible a part entiere : on verifie qu'il est
      // bien la quand le ViewModel l'autorise, et qu'il tient le plancher.
      const pieds = noeudsMarques(rendu.root, MARQUEURS.progressionDetail);
      if (progression.detail.affiche) {
        expect(pieds.length).toBeGreaterThanOrEqual(1);
        const style = StyleSheet.flatten(pieds[0]!.props.style) as { minHeight?: number };
        expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
      }

      demonter(rendu);
    }
  );

  it("la bascule d'echelle agit aussi sur la carte progression", () => {
    // Sans ce test, la carte pourrait rester figee sur un seul jeu de styles
    // pendant que le reste de l'ecran bascule — et le fondateur comparerait deux
    // ecrans dont une partie n'a pas bouge.
    const fixture = ETATS.find((f) => f.id === "tendance-disponible")!;
    const allegee = monterV2(fixture, { echelle: "allegee" });
    const actuelle = monterV2(fixture, { echelle: "actuelle" });

    const taillesDeLaCarte = (rendu: TestRenderer.ReactTestRenderer) => {
      const carte = noeudsMarques(rendu.root, MARQUEURS.progression)[0]!;
      return carte
        .findAllByType(Text)
        .map(
          (t) => (StyleSheet.flatten(t.props.style) as { fontSize?: number } | undefined)?.fontSize
        );
    };

    expect(taillesDeLaCarte(allegee.rendu)).not.toEqual(taillesDeLaCarte(actuelle.rendu));
    demonter(allegee.rendu);
    demonter(actuelle.rendu);
  });
});

// =============================================================================
// 3. LE REGLAGE « REDUIRE LES ANIMATIONS »
// =============================================================================

/**
 * Le detecteur de boucles.
 *
 * Deux filets, parce qu'il y a deux facons realistes de reintroduire une
 * pulsation :
 *   - `Animated.loop`, exactement comme le fait `components/home/HomePrimaryCTA.tsx` ;
 *   - `setInterval`, la boucle ecrite a la main.
 *
 * `Animated.timing` n'est PAS surveille : c'est la brique de l'enfoncement, elle
 * est legitime et se termine toute seule.
 */
function installerDetecteurDeBoucles() {
  const boucles = jest.spyOn(Animated, "loop");
  const intervalles = jest.spyOn(global, "setInterval");
  return {
    get compte() {
      return boucles.mock.calls.length + intervalles.mock.calls.length;
    },
    get detail() {
      return `Animated.loop : ${boucles.mock.calls.length} appel(s), setInterval : ${intervalles.mock.calls.length} appel(s)`;
    },
    restaurer() {
      boucles.mockRestore();
      intervalles.mockRestore();
    },
  };
}

/**
 * LE CANARI.
 *
 * Il fait EXACTEMENT ce que fait `HomePrimaryCTA` en production : une pulsation
 * infinie, lancee au montage, sans consulter `reduceMotion`. Il n'est monte que
 * dans un seul test, dont le but est de prouver que le detecteur ci-dessus prend
 * bien ce cas. Sans lui, « zero boucle detectee » ne voudrait rien dire : un
 * detecteur casse donnerait le meme resultat.
 */
function CanariPulsation() {
  const [pulse] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });
  return <Animated.View style={{ transform: [{ scale }] }} />;
}

describe("Mouvement — aucune boucle, et rien qui bouge en mouvement reduit", () => {
  it("le detecteur de boucles fonctionne : il prend le canari", () => {
    // Le canari reproduit le defaut reel de components/home/HomePrimaryCTA.tsx.
    const detecteur = installerDetecteurDeBoucles();
    let rendu: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      rendu = TestRenderer.create(
        <View>
          <CanariPulsation />
        </View>
      );
    });
    const compte = detecteur.compte;
    act(() => {
      (rendu as unknown as TestRenderer.ReactTestRenderer).unmount();
    });
    detecteur.restaurer();

    // Si cette ligne echoue, ce n'est PAS le prototype qui est casse : c'est le
    // detecteur. Tous les tests « zero boucle » ci-dessous seraient alors vides
    // de sens.
    expect(compte).toBeGreaterThanOrEqual(1);
  });

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne demarre aucune boucle quand « reduire les animations » est actif",
    (_id, fixture) => {
      const detecteur = installerDetecteurDeBoucles();
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm, { reduceMotion: true });

      // Au montage : rien.
      expect(detecteur.compte).toBe(0);

      // Et rien non plus apres un appui complet sur chaque cible : une pulsation
      // pourrait aussi etre lancee au premier contact.
      const appuis = gestionnairesDAppui(rendu.root);
      expect(appuis.length).toBeGreaterThan(0);
      for (const appui of appuis) {
        act(() => {
          appui.onPressIn();
          appui.onPressOut();
        });
      }

      const compte = detecteur.compte;
      const detail = detecteur.detail;
      demonter(rendu);
      detecteur.restaurer();

      expect(compte === 0 ? "aucune boucle" : detail).toBe("aucune boucle");
    }
  );

  it.each(ETATS.map((f) => [f.id, f] as const))(
    "%s ne demarre aucune boucle non plus quand le mouvement est autorise",
    (_id, fixture) => {
      // Le prototype n'a pas de pulsation d'attention DU TOUT : un bouton qui
      // bouge tout seul demande de l'attention sans rien apprendre.
      const detecteur = installerDetecteurDeBoucles();
      const vm = buildHomeVNextViewModel(fixture.input);
      const rendu = monter(vm, { reduceMotion: false });
      const compte = detecteur.compte;
      const detail = detecteur.detail;
      demonter(rendu);
      detecteur.restaurer();

      expect(compte === 0 ? "aucune boucle" : detail).toBe("aucune boucle");
    }
  );

  it.each(
    ETATS.filter((f) => buildHomeVNextViewModel(f.input).action.emphasis === "aplat").map(
      (f) => [f.id, f] as const
    )
  )("%s : aucun mouvement de l'action quand le reglage est actif", (_id, fixture) => {
    const vm = buildHomeVNextViewModel(fixture.input);

    const reduit = monter(vm, { reduceMotion: true });
    const noeudsReduits = noeudsMarques(reduit.root, MARQUEURS.mouvementAction);
    expect(noeudsReduits).toHaveLength(1);
    const styleReduit = StyleSheet.flatten(noeudsReduits[0]!.props.style) as
      | { transform?: unknown }
      | undefined;
    // AUCUN transform, pas meme un transform neutre : le mouvement n'existe pas.
    expect(styleReduit?.transform).toBeUndefined();
    demonter(reduit);

    // Et, pour prouver que l'absence vient bien du reglage et pas d'un oubli :
    // le meme etat, mouvement autorise, porte un transform.
    const normal = monter(vm, { reduceMotion: false });
    const noeudsNormaux = noeudsMarques(normal.root, MARQUEURS.mouvementAction);
    expect(noeudsNormaux).toHaveLength(1);
    const styleNormal = StyleSheet.flatten(noeudsNormaux[0]!.props.style) as
      | { transform?: unknown }
      | undefined;
    expect(styleNormal?.transform).toBeDefined();
    demonter(normal);
  });

  it.each(
    ETATS.filter((f) => buildHomeVNextViewModel(f.input).action.emphasis === "aplat").map(
      (f) => [f.id, f] as const
    )
  )("%s : l'action reste identifiable et utilisable sans la moindre animation", (_id, fixture) => {
    const vm = buildHomeVNextViewModel(fixture.input);
    const rendu = monter(vm, { reduceMotion: true });

    const aplats = rendu.root.findAll(
      (n) => typeof n.type === "string" && n.props.nativeID === MARQUEURS.aplat
    );
    expect(aplats).toHaveLength(1);
    const aplat = aplats[0]!;

    // Reconnaissable a l'arret : c'est un bouton, il porte son libelle, et il
    // garde son aplat colore et sa hauteur.
    expect(aplat.props.accessibilityRole).toBe("button");
    expect(String(aplat.props.accessibilityLabel)).toContain(vm.action.label);
    expect(texteExact(rendu.root, vm.action.label)).not.toBeNull();
    const style = StyleSheet.flatten(aplat.props.style) as {
      minHeight?: number;
      backgroundColor?: string;
    };
    expect(style.minHeight).toBe(76);
    expect(typeof style.backgroundColor).toBe("string");

    // Le retour d'appui existe toujours : c'est un assombrissement, pas un
    // mouvement. Il reste donc branche, et il ne demarre toujours aucune boucle.
    const appuiDeLAction = rendu.root
      .findAll((n) => n.props?.nativeID === MARQUEURS.aplat, { deep: true })
      .find((n) => typeof (n.props as { onPressIn?: unknown }).onPressIn === "function");
    expect(appuiDeLAction).toBeDefined();

    const detecteur = installerDetecteurDeBoucles();
    act(() => {
      (appuiDeLAction!.props as { onPressIn: () => void }).onPressIn();
      (appuiDeLAction!.props as { onPressOut: () => void }).onPressOut();
    });
    const compte = detecteur.compte;
    detecteur.restaurer();
    expect(compte).toBe(0);

    demonter(rendu);
  });

  // ---------------------------------------------------------------------------
  // CE QUE L'ACTION NE PERD PAS QUAND LE MOUVEMENT EST COUPE
  // ---------------------------------------------------------------------------
  // Demande explicite du fondateur : « Le CTA reste clairement identifiable sans
  // animation — verifie qu'il ne perd ni son aplat, ni son contraste, ni sa
  // fleche. » Les trois sont donc verifiees separement, et MESUREES quand elles
  // se mesurent : la couleur est comparee au token, le contraste est CALCULE
  // depuis les couleurs reellement rendues, la fleche est cherchee dans l'arbre.
  // ---------------------------------------------------------------------------
  it.each(
    ETATS.filter((f) => buildHomeVNextViewModel(f.input).action.emphasis === "aplat").map(
      (f) => [f.id, f] as const
    )
  )("%s : sans animation, l'action garde son aplat, son contraste et sa fleche", (_id, fixture) => {
    const vm = buildHomeVNextViewModel(fixture.input);

    /** Ce qui doit etre STRICTEMENT identique avec et sans mouvement. */
    const releverLAction = (rendu: TestRenderer.ReactTestRenderer) => {
      const aplat = rendu.root.findAll(
        (n) => typeof n.type === "string" && n.props.nativeID === MARQUEURS.aplat
      )[0]!;
      const styleAplat = StyleSheet.flatten(aplat.props.style) as {
        backgroundColor?: string;
        minHeight?: number;
      };
      const libelle = texteExact(rendu.root, vm.action.label);
      const couleurDuLibelle = (
        StyleSheet.flatten(libelle?.props.style) as { color?: string } | undefined
      )?.color;

      // LA FLECHE. Le chevron n'est pas une police d'icone : c'est un carre dont
      // on ne garde que deux bordures, pivote de 45 degres. On le cherche donc
      // par sa forme, a l'interieur de l'aplat — un chevron retire par megarde
      // ne laisserait aucun noeud de ce genre.
      const fleches = aplat.findAll((n) => {
        if (typeof n.type !== "string") return false;
        const s = StyleSheet.flatten(n.props.style) as
          | { borderTopWidth?: number; borderRightWidth?: number; borderColor?: string }
          | undefined;
        return (
          typeof s?.borderTopWidth === "number" &&
          s.borderTopWidth > 0 &&
          typeof s?.borderRightWidth === "number" &&
          s.borderRightWidth > 0
        );
      });

      return {
        fond: styleAplat.backgroundColor,
        hauteur: styleAplat.minHeight,
        libelle: libelle === null ? null : contenu(libelle),
        couleurDuLibelle,
        fleches: fleches.length,
      };
    };

    const reduit = monter(vm, { reduceMotion: true });
    const avecMouvement = monter(vm, { reduceMotion: false });
    const releveReduit = releverLAction(reduit);
    const releveNormal = releverLAction(avecMouvement);
    demonter(reduit);
    demonter(avecMouvement);

    // 1. L'APLAT : la meme couleur exacte, pas seulement « une couleur ».
    expect(releveReduit.fond).toBe(couleurs.action);
    expect(releveReduit.hauteur).toBe(76);

    // 2. LA FLECHE : elle est toujours la.
    expect(releveReduit.fleches).toBeGreaterThanOrEqual(1);

    // 3. LE CONTRASTE : calcule depuis les deux couleurs reellement rendues,
    //    avec la formule WCAG 2.1. Ce n'est pas une valeur recopiee du token.
    expect(releveReduit.couleurDuLibelle).toBe(couleurs.texteSurAction);
    const ratio = contrasteWCAG(releveReduit.couleurDuLibelle!, releveReduit.fond!);
    expect(ratio).toBeGreaterThanOrEqual(SEUIL_CONTRASTE_AA);

    // 4. ET RIEN D'AUTRE NE CHANGE : couper le mouvement ne retire que le
    //    mouvement. Sans cette comparaison, un aplat devenu terne dans les deux
    //    cas passerait les trois assertions ci-dessus.
    expect(releveReduit).toEqual(releveNormal);
  });
});
