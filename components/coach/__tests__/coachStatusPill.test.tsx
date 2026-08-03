// components/coach/__tests__/coachStatusPill.test.tsx
//
// Ce que ces tests protègent : LA COULEUR N'EST JAMAIS SEULE À PORTER LE SENS.
// Si quelqu'un simplifie un jour la pastille en "juste une couleur", ces tests
// tombent. C'est exactement leur raison d'être : un coach daltonien, ou un coach
// en plein soleil, doit pouvoir distinguer les quatre statuts sans la couleur.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { CoachStatusPill } from "../CoachStatusPill";
import { COACH_STATUS_LEVELS, statusTone, type CoachStatusLevel } from "../coachTheme";
import { collectProp, flatText } from "./treeUtils";

// `await act(async ...)` : Ionicons charge sa police via un setState async,
// on laisse le rendu se stabiliser avant de lire l'arbre.
async function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return renderer.toJSON();
}

describe("CoachStatusPill — le sens ne dépend pas de la couleur", () => {
  test.each(COACH_STATUS_LEVELS)("le niveau %s affiche son libellé écrit", async (level) => {
    const tree = await render(<CoachStatusPill level={level} />);
    expect(flatText(tree)).toContain(statusTone(level).libelle);
  });

  test("les 4 libellés sont distincts et sont ceux du vocabulaire coach", () => {
    const libelles = COACH_STATUS_LEVELS.map((l) => statusTone(l).libelle);
    expect(new Set(libelles).size).toBe(4);
    expect(libelles).toEqual([
      "Rien à signaler",
      "À surveiller",
      "À vérifier",
      "Indisponible",
    ]);
  });

  test("les 4 icônes sont distinctes (2e porteur de sens, sans couleur)", () => {
    const icones = COACH_STATUS_LEVELS.map((l) => statusTone(l).icone);
    expect(new Set(icones).size).toBe(4);
  });

  test.each(COACH_STATUS_LEVELS)("le niveau %s rend bien une icône en plus du texte", async (level) => {
    const tree = await render(<CoachStatusPill level={level} />);
    // Ionicons se rend en glyphe : au moins un nœud de plus que le seul libellé.
    const textes = flatText(tree);
    expect(textes).toContain(statusTone(level).libelle);
    expect(textes.length).toBeGreaterThan(statusTone(level).libelle.length);
  });

  test("un libellé personnalisé n'efface PAS le statut pour le lecteur d'écran", async () => {
    const tree = await render(
      <CoachStatusPill level="check" label="Aucune séance depuis 9 jours" />
    );
    const labels = collectProp(tree, "accessibilityLabel").filter(
      (v): v is string => typeof v === "string"
    );
    const joined = labels.join(" | ");
    expect(joined).toContain("À vérifier"); // le statut canonique reste annoncé
    expect(joined).toContain("Aucune séance depuis 9 jours"); // la précision aussi
    // Et le texte visible affiche bien la version personnalisée.
    expect(flatText(tree)).toContain("Aucune séance depuis 9 jours");
  });

  // RETOUR 6. La nuance « parmi les données disponibles » ne tient pas dans une
  // pastille : elle s'affiche à côté. Mais un utilisateur de lecteur d'écran ne
  // voit pas ce « à côté » — il doit l'ENTENDRE, sinon on lui laisse le constat
  // faux qu'on vient justement de corriger pour les voyants.
  test("le libellé complet est annoncé même quand la pastille reste courte", async () => {
    const tree = await render(
      <CoachStatusPill level="normal" fullLabel="Rien à signaler parmi les données disponibles" />,
    );
    const labels = collectProp(tree, "accessibilityLabel").filter(
      (v): v is string => typeof v === "string",
    );
    expect(labels.join(" | ")).toContain(
      "Statut : Rien à signaler parmi les données disponibles",
    );
    // Le visible, lui, reste court : c'est une pastille, pas une phrase.
    expect(flatText(tree)).toContain("Rien à signaler");
    expect(flatText(tree)).not.toContain("parmi les données disponibles");
  });

  test("le raccourci n'est pas réannoncé deux fois au lecteur d'écran", async () => {
    const tree = await render(
      <CoachStatusPill
        level="normal"
        label="Rien à signaler"
        fullLabel="Rien à signaler parmi les données disponibles"
      />,
    );
    const labels = collectProp(tree, "accessibilityLabel").filter(
      (v): v is string => typeof v === "string",
    );
    const joined = labels.join(" | ");
    expect(joined).toContain("Statut : Rien à signaler parmi les données disponibles");
    expect(joined).not.toContain("disponibles. Rien à signaler");
  });

  test("un niveau inattendu retombe sur 'Indisponible', jamais sur un statut rassurant", async () => {
    const bogus = "totally_unknown" as CoachStatusLevel;
    expect(statusTone(bogus).libelle).toBe("Indisponible");
    const tree = await render(<CoachStatusPill level={bogus} />);
    expect(flatText(tree)).toContain("Indisponible");
  });
});
