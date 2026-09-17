// components/home/__tests__/homeWeekStrip.test.tsx
// Rendu de la bande « Cette semaine » (SPEC_DA_ACCUEIL_SEANCE.md §2.4) :
// le jour courant est annoncé, une séance faite n'est jamais confondue avec
// une séance prévue, et aucune pastille « faite » (pleine, orange) n'apparaît
// sans `hasFks`. Même méthode que components/home/__tests__/homeProgressionCard.test.tsx
// (react-test-renderer, pas de rendu natif réel).
//
// NOTE D'EXECUTION : depuis un worktree, `npx jest` nu liste 0 test — lancer
// avec `npx jest --config jest.worktree.config.js components/home/__tests__`.

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import HomeWeekStrip from "../HomeWeekStrip";
import { da } from "../../../constants/daJoueur";
import type { WeekDayItem } from "../../../hooks/home/useWeekDays";

function jour(overrides: Partial<WeekDayItem> & { key: string; label: string }): WeekDayItem {
  return {
    isToday: false,
    hasFks: false,
    hasExt: false,
    hasClub: false,
    hasMatch: false,
    hasPlanned: false,
    ...overrides,
  };
}

const SEMAINE: WeekDayItem[] = [
  jour({ key: "2026-09-14", label: "L" }), // rien
  jour({ key: "2026-09-15", label: "M", hasPlanned: true }), // prévue non faite
  jour({ key: "2026-09-16", label: "M", hasExt: true }), // activité externe, pas FKS
  jour({ key: "2026-09-17", label: "J", isToday: true, hasFks: true, hasMatch: true }), // aujourd'hui, faite, match
  jour({ key: "2026-09-18", label: "V", hasClub: true }), // club
  jour({ key: "2026-09-19", label: "S" }), // rien
  jour({ key: "2026-09-20", label: "D" }), // rien
];

type Props = React.ComponentProps<typeof HomeWeekStrip>;

function monter(props: Partial<Props> = {}) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(
      <HomeWeekStrip
        weekDays={SEMAINE}
        fksCount={1}
        weeklyGoal={3}
        activityStreak={0}
        matchSoon={false}
        {...props}
      />
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
 * Toutes les chaînes affichées, dans l'ordre (même motif que
 * homeProgressionCard.test.tsx) — un enfant JSX numérique ({fksCount}) reste
 * un `number` dans `props.children`, converti ici en texte comme le ferait
 * le moteur de rendu natif.
 */
function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children as React.ReactNode)
        .filter((c): c is string | number => typeof c === "string" || typeof c === "number")
        .map((c) => String(c))
    );
}

/**
 * Les colonnes de jour : nœuds `accessible` porteurs d'un `accessibilityLabel`.
 * `deep: false` : un `View` composite ET le nœud hôte qu'il rend portent tous
 * les deux ces mêmes props — sans lui, chaque colonne serait comptée deux fois
 * (même piège que `pressableDeMarqueur` dans HomeVNextProgression.test.tsx).
 */
function colonnesJour(racine: ReactTestInstance): ReactTestInstance[] {
  return racine.findAll(
    (n) => n.props.accessible === true && typeof n.props.accessibilityLabel === "string",
    { deep: false }
  );
}

/**
 * Toutes les chaînes affichées, jointes en un seul bloc — espaces multiples
 * réduits à un seul : un enfant JSX ("Série en cours : ", {n}, " j") est TROIS
 * fragments adjacents dans le rendu réel (aucun espace n'est inséré entre
 * eux), mais `textes()` les traite comme des entrées de tableau séparées ;
 * sans cette normalisation, `.join(" ")` insérerait des espaces qui
 * n'existent pas à l'écran.
 */
function texteJoint(instance: ReactTestInstance): string {
  return textes(instance).join(" ").replace(/\s+/g, " ");
}

function labelDe(colonne: ReactTestInstance): string {
  return colonne.props.accessibilityLabel as string;
}

/**
 * La couleur de fond de la PASTILLE elle-même (32×32) dans une colonne —
 * distincte du petit point "prévu" (7×7) qui, lui, est délibérément coloré
 * `action` (spec §2.4 : la couleur ne porte jamais seule l'état, mais le point
 * l'utilise quand même comme UN des signaux). Chercher "n'importe quel fond
 * orange dans la colonne" confondrait donc le point et le remplissage plein —
 * cette fonction isole le remplissage par sa taille.
 */
function couleurPastille(colonne: ReactTestInstance): string | undefined {
  const noeuds = [colonne, ...colonne.findAll(() => true, { deep: true })];
  for (const n of noeuds) {
    const style = StyleSheet.flatten(n.props.style as never) as
      | { width?: unknown; height?: unknown; backgroundColor?: unknown }
      | undefined;
    if (style?.width === 32 && style?.height === 32 && typeof style.backgroundColor === "string") {
      return style.backgroundColor;
    }
  }
  return undefined;
}

describe("HomeWeekStrip — le jour courant est annoncé", () => {
  test("la colonne d'aujourd'hui porte « aujourd'hui » et le reste de son état, dans le bon ordre", () => {
    const rendu = monter();
    const colonnes = colonnesJour(rendu.root);
    const aujourdhui = colonnes.find((c) => labelDe(c).includes("aujourd'hui"));
    expect(aujourdhui).toBeDefined();
    expect(labelDe(aujourdhui!)).toBe("jeudi, aujourd'hui, séance FKS faite, match");
    demonter(rendu);
  });

  test("un seul jour est annoncé comme aujourd'hui", () => {
    const rendu = monter();
    const colonnes = colonnesJour(rendu.root);
    const marquesAujourdhui = colonnes.filter((c) => labelDe(c).includes("aujourd'hui"));
    expect(marquesAujourdhui).toHaveLength(1);
    demonter(rendu);
  });
});

describe("HomeWeekStrip — une séance faite n'est jamais confondue avec une séance prévue", () => {
  test("le jour « prévue non faite » ne dit jamais « faite », et sa pastille n'est jamais orange plein", () => {
    const rendu = monter();
    const colonnes = colonnesJour(rendu.root);
    const prevue = colonnes.find((c) => labelDe(c).includes("séance prévue"));
    expect(prevue).toBeDefined();
    expect(labelDe(prevue!)).not.toContain("faite");
    // Le petit point "prévu" (7×7) EST coloré `action` par design — seul le
    // remplissage PLEIN de la pastille (32×32) est réservé à `hasFks`.
    expect(couleurPastille(prevue!)).not.toBe(da.colors.action);
    demonter(rendu);
  });

  test("le jour « activité externe » n'est jamais confondu avec une séance FKS faite", () => {
    const rendu = monter();
    const colonnes = colonnesJour(rendu.root);
    const externe = colonnes.find((c) => labelDe(c).includes("activité enregistrée hors FKS"));
    expect(externe).toBeDefined();
    expect(labelDe(externe!)).not.toContain("faite");
    expect(couleurPastille(externe!)).not.toBe(da.colors.action);
    demonter(rendu);
  });
});

describe("HomeWeekStrip — aucune pastille « faite » sans hasFks", () => {
  test("le remplissage plein orange de la pastille n'apparaît que sur les jours hasFks", () => {
    const rendu = monter();
    const colonnes = colonnesJour(rendu.root);
    for (const colonne of colonnes) {
      const estFaite = labelDe(colonne).includes("séance FKS faite");
      const orange = couleurPastille(colonne) === da.colors.action;
      expect(orange).toBe(estFaite);
    }
    demonter(rendu);
  });
});

describe("HomeWeekStrip — compteur et pied de bloc", () => {
  test("le compteur affiche fksCount / weeklyGoal", () => {
    const rendu = monter({ fksCount: 2, weeklyGoal: 4 });
    const t = texteJoint(rendu.root);
    expect(t).toContain("2");
    expect(t).toContain("4");
    expect(t).toContain("séances");
    demonter(rendu);
  });

  test("aucun pied si streak à 0 et aucun match proche", () => {
    const rendu = monter({ activityStreak: 0, matchSoon: false });
    const t = texteJoint(rendu.root);
    expect(t).not.toContain("Série en cours");
    expect(t).not.toContain("Match proche");
    demonter(rendu);
  });

  test("streak > 0 affiche « Série en cours », jamais « Nouvelle »", () => {
    const rendu = monter({ activityStreak: 5 });
    const t = texteJoint(rendu.root);
    expect(t).toContain("Série en cours : 5 j");
    expect(t).not.toContain("Nouvelle");
    demonter(rendu);
  });

  test("match proche affiche « Match proche »", () => {
    const rendu = monter({ matchSoon: true });
    const t = texteJoint(rendu.root);
    expect(t).toContain("Match proche");
    demonter(rendu);
  });
});
