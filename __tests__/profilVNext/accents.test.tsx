// __tests__/profilVNext/accents.test.tsx
// =============================================================================
// L'AXE « ACCENTS » (D7) — la couleur ne change JAMAIS une donnee
// =============================================================================
// Le mode colore reprend la famille d'accents du Home (accent/accentSoft).
// Ces tests verrouillent ses trois promesses :
//   1. memes textes AU CARACTERE PRES que le mode sobre (l'avatar est un glyphe
//      dessine, pas des initiales ; les pilules teintent des mots existants) ;
//   2. l'orange d'action du Home n'apparait NULLE PART (il reste reserve a
//      l'unique aplat du Home) ;
//   3. les marqueurs de verification sont identiques (aucun bloc ajoute/retire).
// =============================================================================

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { ProfilVNextScreen } from "../../screens/profilVNext/ProfilVNextScreen";
import { buildProfilVNextViewModel } from "../../screens/profilVNext/viewModel";
import { PROFIL_VNEXT_FIXTURES } from "../../screens/profilVNext/fixtures";
import { PROFIL_MARQUEURS } from "../../components/profilVNext/profilVNextMarqueurs";
import { couleurs } from "../../components/homeVNext/homeVNextTokens";
import type { AccentsId } from "../../components/profilVNext/profilVNextAccents";

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

function monter(vmFixtureId: string, accents: AccentsId) {
  const f = PROFIL_VNEXT_FIXTURES.find((x) => x.id === vmFixtureId);
  if (!f) throw new Error(`fixture inconnue : ${vmFixtureId}`);
  const vm = buildProfilVNextViewModel(f.input, { variante: "informe" });
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<ProfilVNextScreen vm={vm} accents={accents} />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children as React.ReactNode).filter(
        (c): c is string => typeof c === "string"
      )
    );
}

function parMarqueur(instance: ReactTestInstance, testID: string): number {
  return instance.findAll((n) => typeof n.type === "string" && n.props?.testID === testID).length;
}

function fondsColores(node: unknown): string[] {
  const trouves: string[] = [];
  const visiter = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const style = StyleSheet.flatten(n.props?.style);
    const bg = (style as { backgroundColor?: string } | undefined)?.backgroundColor;
    if (typeof bg === "string") trouves.push(bg.toUpperCase());
    (n.children ?? []).forEach(visiter);
  };
  visiter(node);
  return trouves;
}

// Les trois fixtures qui couvrent les surfaces de l'axe : faits pleins,
// absences (« A definir »), et textes longs.
const FIXTURES_TESTEES = ["joueur-complet", "profil-partiel", "stress-textes-longs"];

describe("accents (D7) : la couleur ne change jamais une donnee", () => {
  for (const id of FIXTURES_TESTEES) {
    it(`${id} : memes textes au caractere pres en sobre et en colore`, () => {
      const sobre = monter(id, "sobre");
      const colore = monter(id, "colore");
      expect(textes(colore.root)).toEqual(textes(sobre.root));
      demonter(sobre);
      demonter(colore);
    });

    it(`${id} : l'orange d'action du Home n'apparait nulle part en colore`, () => {
      const colore = monter(id, "colore");
      expect(fondsColores(colore.toJSON())).not.toContain(couleurs.action.toUpperCase());
      demonter(colore);
    });

    it(`${id} : memes marqueurs de verification dans les deux modes`, () => {
      const sobre = monter(id, "sobre");
      const colore = monter(id, "colore");
      for (const m of [
        PROFIL_MARQUEURS.ecran,
        PROFIL_MARQUEURS.identite,
        PROFIL_MARQUEURS.rythme,
        PROFIL_MARQUEURS.aDefinir,
        PROFIL_MARQUEURS.fait,
      ]) {
        expect(parMarqueur(colore.root, m)).toBe(parMarqueur(sobre.root, m));
      }
      demonter(sobre);
      demonter(colore);
    });
  }
});
