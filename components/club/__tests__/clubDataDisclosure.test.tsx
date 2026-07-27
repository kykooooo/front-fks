// components/club/__tests__/clubDataDisclosure.test.tsx
//
// La divulgation S'AFFICHE, en entier, et NE BLOQUE RIEN.
//
// Ce que ces tests protègent :
//  1. tout le contenu est réellement rendu (pas de repli, pas d'accordéon qu'on
//     oublierait d'ouvrir — une information qu'il faut déplier n'est pas donnée) ;
//  2. le composant ne porte AUCUN contrôle interactif : pas de bouton, pas de
//     case, pas de champ. Il ne peut donc pas empêcher un rattachement ;
//  3. il se rend sans aucune donnée d'entrée : il ne peut pas retarder un écran
//     en attendant un chargement.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ClubDataDisclosure } from "../ClubDataDisclosure";
import { CLUB_DISCLOSURE, clubDisclosureTexts } from "../../../domain/clubDataDisclosure";
import { collectText, findByHostType } from "../../coach/__tests__/treeUtils";

// `await act(async ...)` : Ionicons charge sa police via un setState async.
async function rendre(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<ClubDataDisclosure />);
  });
  return renderer;
}

describe("ClubDataDisclosure — affichée en entier", () => {
  test("chaque phrase de la divulgation est présente à l'écran", async () => {
    const renderer = await rendre();
    const affiche = collectText(renderer.toJSON());
    for (const phrase of clubDisclosureTexts()) {
      expect(affiche).toContain(phrase);
    }
  });

  test("les deux listes sont là : ce qui est vu, et ce qui ne l'est jamais", async () => {
    const renderer = await rendre();
    const affiche = collectText(renderer.toJSON()).join(" | ");
    expect(affiche).toContain(CLUB_DISCLOSURE.partageTitre);
    expect(affiche).toContain(CLUB_DISCLOSURE.jamaisTitre);
    expect(CLUB_DISCLOSURE.partage.length).toBeGreaterThanOrEqual(4);
    expect(CLUB_DISCLOSURE.jamais.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ClubDataDisclosure — n'exige rien, ne bloque rien", () => {
  test("aucun contrôle interactif (ni bouton, ni case, ni champ de saisie)", async () => {
    const renderer = await rendre();
    const arbre = renderer.toJSON();
    for (const type of ["TextInput", "Switch", "RNCAndroidSwitch"]) {
      expect(findByHostType(arbre, type)).toHaveLength(0);
    }
    // Aucun nœud ne réagit à une pression : rien à accepter, rien à refuser.
    const pressables = findByHostType(arbre, "View").filter(
      (n) => typeof (n.props as Record<string, unknown>).onClick === "function",
    );
    expect(pressables).toHaveLength(0);
  });

  test("se rend sans aucune prop ni aucune donnée chargée", async () => {
    // Preuve qu'elle ne peut pas retarder l'écran hôte : rien à attendre.
    const renderer = await rendre();
    expect(renderer.toJSON()).not.toBeNull();
  });
});
