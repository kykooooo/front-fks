// __tests__/profilVNext/ecran.test.tsx
// =============================================================================
// PROTOTYPE Profil vNext — TESTS DE RENDU
// =============================================================================
// Le test du ViewModel verifie ce que l'ecran a le DROIT d'afficher ; celui-ci
// verifie ce qu'il affiche REELLEMENT : il monte les vrais composants sur toutes
// les fixtures, dans les deux variantes, et relit l'arbre produit.
//
// Le montage suit le patron du conteneur (lecon du Home : jamais de config
// fantome) : `<ProfilVNextScreen vm={...} />` avec le mock officiel de
// safe-area-context — exactement ce que fait `HomeVNextScreen.test.tsx` pour
// l'ecran que la production monte.
//
// Les regles verifiees sont les defauts de l'audit, pas de la cosmetique :
//   - AUCUN aplat colore : le Profil n'a pas d'action principale, c'est un
//     ecran de controle (le seul aplat de l'app vit au Home) ;
//   - l'absence s'affiche « A definir », jamais 0, jamais un placeholder ;
//   - en chargement, RIEN d'identitaire n'est rendu (pas de « Joueur ») ;
//   - variante pure : zero fait ; variante informee : autant de faits que le
//     ViewModel en a autorises ;
//   - chaque element tactile a un role d'accessibilite et un plancher de 44 pt ;
//   - aucun concept interdit (forme, serie, trophee, playlist, TSB) dans les
//     textes fabriques par l'ecran.
// =============================================================================

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { ProfilVNextScreen } from "../../screens/profilVNext/ProfilVNextScreen";
import {
  buildProfilVNextViewModel,
  PROFIL_VARIANTES,
  type ProfilVNextViewModel,
} from "../../screens/profilVNext/viewModel";
import { PROFIL_VNEXT_FIXTURES } from "../../screens/profilVNext/fixtures";
import { PROFIL_MARQUEURS } from "../../components/profilVNext/profilVNextMarqueurs";
import { couleurs, TAILLE_TACTILE_MIN } from "../../components/homeVNext/homeVNextTokens";

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

// -----------------------------------------------------------------------------
// Outils (repris de HomeVNextScreen.test.tsx)
// -----------------------------------------------------------------------------

function monter(vm: ProfilVNextViewModel) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<ProfilVNextScreen vm={vm} />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

function parMarqueur(instance: ReactTestInstance, testID: string): ReactTestInstance[] {
  // Noeuds HOTES uniquement : un composite et son noeud natif portent tous les
  // deux la prop, compter les deux doublerait chaque marqueur.
  return instance.findAll((n) => typeof n.type === "string" && n.props?.testID === testID);
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

function elementsTactiles(instance: ReactTestInstance): ReactTestInstance[] {
  return instance.findAll(
    (n) =>
      typeof n.type === "string" &&
      typeof (n.props as { onStartShouldSetResponder?: unknown })
        .onStartShouldSetResponder === "function"
  );
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

// -----------------------------------------------------------------------------
// Les regles, sur toutes les fixtures et les deux variantes
// -----------------------------------------------------------------------------

describe("rendu du Profil vNext", () => {
  for (const fixture of PROFIL_VNEXT_FIXTURES) {
    for (const variante of PROFIL_VARIANTES) {
      describe(`${fixture.id} / ${variante.id}`, () => {
        const vm = buildProfilVNextViewModel(fixture.input, { variante: variante.id });

        it("rend l'ecran, sans AUCUN aplat couleur d'action", () => {
          const rendu = monter(vm);
          expect(parMarqueur(rendu.root, PROFIL_MARQUEURS.ecran)).toHaveLength(1);
          // L'aplat du Home (couleurs.action) ne doit exister NULLE PART ici :
          // le Profil controle, il n'appelle pas a l'action.
          expect(fondsColores(rendu.toJSON())).not.toContain(couleurs.action.toUpperCase());
          demonter(rendu);
        });

        it("identite : chargement et pret sont mutuellement exclusifs", () => {
          const rendu = monter(vm);
          const prete = parMarqueur(rendu.root, PROFIL_MARQUEURS.identite).length;
          const chargement = parMarqueur(rendu.root, PROFIL_MARQUEURS.identiteChargement).length;
          if (vm.identite.kind === "chargement") {
            expect({ prete, chargement }).toEqual({ prete: 0, chargement: 1 });
          } else {
            expect({ prete, chargement }).toEqual({ prete: 1, chargement: 0 });
          }
          demonter(rendu);
        });

        it("l'absence s'affiche « A definir » — autant de fois que le ViewModel a de null", () => {
          const rendu = monter(vm);
          let attendus = 0;
          if (vm.identite.kind === "prete") {
            attendus += [
              vm.identite.prenom,
              vm.identite.poste,
              vm.identite.niveau,
              vm.identite.pied,
              vm.identite.objectif,
            ].filter((v) => v == null).length;
          }
          attendus += [
            vm.rythme.fksParSemaine,
            vm.rythme.clubParSemaine,
            vm.rythme.matchsParSemaine,
          ].filter((v) => v == null).length;
          expect(parMarqueur(rendu.root, PROFIL_MARQUEURS.aDefinir)).toHaveLength(attendus);
          demonter(rendu);
        });

        it("en chargement, aucun texte identitaire n'est rendu", () => {
          const rendu = monter(vm);
          if (vm.identite.kind === "chargement") {
            // Le bloc d'attente ne contient AUCUN texte : ni « Joueur » de
            // remplissage, ni champs vides. (Le mot « Joueur » peut exister
            // ailleurs legitimement — c'est un badge club resolu serveur.)
            const bloc = parMarqueur(rendu.root, PROFIL_MARQUEURS.identiteChargement)[0];
            expect(bloc.findAllByType(Text)).toHaveLength(0);
            // Et le repli displayName n'apparait nulle part : l'ecran attend le
            // doc, il ne « depanne » pas avec l'auth.
            const tout = textes(rendu.root).join(" | ");
            expect(tout).not.toContain(fixture.input.displayNameAuth ?? "@@jamais@@");
          }
          demonter(rendu);
        });

        it("les six lignes de controle sont rendues, chacune avec son marqueur", () => {
          const rendu = monter(vm);
          for (const ligne of vm.controles) {
            expect(
              parMarqueur(rendu.root, `${PROFIL_MARQUEURS.controle}-${ligne.id}`)
            ).toHaveLength(1);
          }
          demonter(rendu);
        });

        it("les faits rendus correspondent EXACTEMENT a ceux du ViewModel", () => {
          const rendu = monter(vm);
          const attendus = vm.controles.filter((l) => l.fait != null);
          const rendus = parMarqueur(rendu.root, PROFIL_MARQUEURS.fait);
          expect(rendus).toHaveLength(attendus.length);
          if (variante.id === "pur") expect(rendus).toHaveLength(0);
          demonter(rendu);
        });

        it("chaque element tactile a un role et un plancher de 44 pt", () => {
          const rendu = monter(vm);
          const tactiles = elementsTactiles(rendu.root);
          // Les 6 lignes de controle au minimum.
          expect(tactiles.length).toBeGreaterThanOrEqual(6);
          for (const t of tactiles) {
            expect(t.props.accessibilityRole).toBeTruthy();
            const style = StyleSheet.flatten(t.props.style) as { minHeight?: number };
            expect(style?.minHeight ?? 0).toBeGreaterThanOrEqual(TAILLE_TACTILE_MIN);
          }
          demonter(rendu);
        });

        it("aucun concept interdit dans les textes fabriques par l'ecran", () => {
          const rendu = monter(vm);
          // L'objectif DECLARE est la seule exception (« Être en forme toute la
          // saison » est une declaration du joueur, pas un etat calcule).
          const objectif =
            vm.identite.kind === "prete" && vm.identite.objectif != null
              ? vm.identite.objectif
              : null;
          const fabriques = textes(rendu.root).filter((txt) => txt !== objectif);
          const tout = fabriques.join(" | ");
          for (const motif of [/forme/i, /série/i, /trophée/i, /playlist/i, /tsb/i, /régularité/i]) {
            expect(tout).not.toMatch(motif);
          }
          demonter(rendu);
        });
      });
    }
  }
});
