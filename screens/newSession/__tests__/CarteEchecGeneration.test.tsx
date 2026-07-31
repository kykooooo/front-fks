// screens/newSession/__tests__/CarteEchecGeneration.test.tsx
//
// NB : `react-test-renderer` n'est pas declare en devDependency dans
// package.json — il resout uniquement de facon transitive via jest-expo. Le
// typecheck ne casse pas grace a `types/react-test-renderer.d.ts` (shim
// partage, voir ce fichier pour le detail). A declarer explicitement en
// devDependency au prochain `npm install` planifie (P2 assume).
//
// Preuve de rendu legere (react-test-renderer, meme approche que
// screens/__tests__/SessionLiveScreen.itemRow.test.tsx sur la branche
// boucle-suivi-joueur) pour la carte d'echec de generation. Ce composant est
// le seul endroit ou le joueur voit une panne : il doit dire ce qui s'est
// passe (message du contrat), proposer des sorties (actions), et ne JAMAIS
// laisser deviner une seance (aucune prop de seance n'existe sur ce
// composant — un test qui affirme l'inverse serait un mensonge, donc on
// verifie ici que seuls le titre, le message et les actions attendues
// apparaissent, rien de plus).

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { CarteEchecGeneration } from "../ui/CarteEchecGeneration";
import type { EchecGeneration } from "../echecGeneration";

function buildEchec(overrides: Partial<EchecGeneration> = {}): EchecGeneration {
  return {
    source: "client",
    code: null,
    categorie: "transitoire",
    retryable: true,
    messageJoueur: "La connexion a été coupée avant la fin. Rien n'a été enregistré.",
    requestId: null,
    attendreS: null,
    actions: ["reessayer", "retour_accueil"],
    ...overrides,
  };
}

type Handlers = {
  onReessayer: jest.Mock;
  onReessayerEnregistrement: jest.Mock;
  onModifierContraintes: jest.Mock;
  onChoisirCycle: jest.Mock;
  onSeReconnecter: jest.Mock;
  onReprendreSeance: jest.Mock;
  onRetourAccueil: jest.Mock;
};

function buildHandlers(): Handlers {
  return {
    onReessayer: jest.fn(),
    onReessayerEnregistrement: jest.fn(),
    onModifierContraintes: jest.fn(),
    onChoisirCycle: jest.fn(),
    onSeReconnecter: jest.fn(),
    onReprendreSeance: jest.fn(),
    onRetourAccueil: jest.fn(),
  };
}

function renderCarte(
  echec: EchecGeneration,
  handlers: Handlers,
  occupe = false
) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <CarteEchecGeneration
        echec={echec}
        actions={echec.actions}
        occupe={occupe}
        onReessayer={handlers.onReessayer}
        onReessayerEnregistrement={handlers.onReessayerEnregistrement}
        onModifierContraintes={handlers.onModifierContraintes}
        onChoisirCycle={handlers.onChoisirCycle}
        onSeReconnecter={handlers.onSeReconnecter}
        onReprendreSeance={handlers.onReprendreSeance}
        onRetourAccueil={handlers.onRetourAccueil}
      />
    );
  });
  return tree;
}

function flattenText(node: TestRenderer.ReactTestInstance): string {
  const children = node.props.children;
  const list = Array.isArray(children) ? children : [children];
  return list
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("");
}

function allTexts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(flattenText);
}

// react-native.Pressable est un React.memo (le type réel embarqué n'est PAS
// la référence exportée par le module, comparer par displayName est donc la
// seule façon fiable de le retrouver ici — même limite que le composant
// Button qui l'enveloppe).
function findPressables(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((n) => {
    const type: any = n.type;
    const name = typeof type === "string" ? type : type?.displayName || type?.name;
    return name === "Pressable";
  });
}

function pressableForLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return findPressables(tree).find((p) =>
    p.findAllByType(Text).some((t) => flattenText(t) === label)
  );
}

describe("CarteEchecGeneration — message et actions du contrat, jamais de séance", () => {
  test("affiche le titre, le message du contrat et exactement les actions demandées", () => {
    const echec = buildEchec({
      messageJoueur: "Le serveur ne répond pas. Rien n'a été ajouté à ton programme.",
      actions: ["reessayer", "modifier_contraintes"],
    });
    const tree = renderCarte(echec, buildHandlers());
    const texts = allTexts(tree);

    expect(texts).toContain("On n'a pas pu préparer ta séance");
    expect(texts).toContain("Le serveur ne répond pas. Rien n'a été ajouté à ton programme.");
    expect(texts).toContain("Réessayer");
    expect(texts).toContain("Modifier mon lieu ou mon matériel");

    // Actions absentes du contrat : leurs libellés ne doivent apparaître nulle part.
    expect(texts).not.toContain("Réessayer l'enregistrement");
    expect(texts).not.toContain("Choisir un cycle");
    expect(texts).not.toContain("Me reconnecter");
    expect(texts).not.toContain("Reprendre ma séance");
    expect(texts).not.toContain("Revenir à l'accueil");

    // Rien qui ressemble à une séance fabriquée (aucune prop de séance
    // n'existe sur ce composant — cette assertion documente l'invariant).
    for (const mot of ["bloc", "exercice", "série", "reps", "min"]) {
      expect(texts.some((t) => t.toLowerCase().includes(mot))).toBe(false);
    }
  });

  test("un clic sur une action déclenche UNIQUEMENT le callback associé", () => {
    const echec = buildEchec({ actions: ["reessayer", "modifier_contraintes"] });
    const handlers = buildHandlers();
    const tree = renderCarte(echec, handlers);

    const bouton = pressableForLabel(tree, "Modifier mon lieu ou mon matériel");
    expect(bouton).toBeTruthy();
    act(() => {
      (bouton!.props.onPress as () => void)();
    });

    expect(handlers.onModifierContraintes).toHaveBeenCalledTimes(1);
    expect(handlers.onReessayer).not.toHaveBeenCalled();
  });

  test("occupe=true neutralise (disabled) toutes les actions", () => {
    const echec = buildEchec({ actions: ["reessayer", "retour_accueil"] });
    const tree = renderCarte(echec, buildHandlers(), true);

    const boutonReessayer = pressableForLabel(tree, "Réessayer");
    const boutonAccueil = pressableForLabel(tree, "Revenir à l'accueil");
    expect(boutonReessayer!.props.disabled).toBe(true);
    expect(boutonAccueil!.props.disabled).toBe(true);
  });

  test("sans attente ni référence support (contrat minimal) : ces blocs ne s'affichent pas", () => {
    const echec = buildEchec({ attendreS: null, requestId: null });
    const tree = renderCarte(echec, buildHandlers());
    const texts = allTexts(tree);

    expect(texts.some((t) => t.startsWith("Patiente environ"))).toBe(false);
    expect(texts.some((t) => t.startsWith("Réf. support"))).toBe(false);
  });

  test("avec attendreS et requestId (429 avec Retry-After) : les deux s'affichent, singulier respecté", () => {
    const echec = buildEchec({ attendreS: 1, requestId: "req-abc-123" });
    const tree = renderCarte(echec, buildHandlers());
    const texts = allTexts(tree);

    const attente = texts.find((t) => t.includes("Patiente environ"));
    expect(attente).toBeTruthy();
    expect(attente).toContain("1 seconde");
    expect(attente).not.toContain("1 secondes"); // singulier respecté

    const reference = texts.find((t) => t.includes("Réf. support"));
    expect(reference).toBeTruthy();
    expect(reference).toContain("req-abc-123");
  });
});
