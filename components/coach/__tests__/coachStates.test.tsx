// components/coach/__tests__/coachStates.test.tsx
//
// Ce que ces tests protègent : un écran vide ne doit jamais ressembler à une
// panne, et une erreur doit dire ce qui s'est passé.
// Concrètement : chaque variante a sa propre explication (pas de "Aucune
// donnée" générique recyclé partout), et aucune ne laisse le coach sans phrase.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { CoachEmptyState, COACH_EMPTY_VARIANTS } from "../CoachEmptyState";
import {
  CoachErrorState,
  COACH_ERROR_SUBJECTS,
  COACH_ERROR_VARIANTS,
} from "../CoachErrorState";
import { flatText } from "./treeUtils";

// `await act(async ...)` : Ionicons charge sa police via un setState async.
async function renderText(element: React.ReactElement): Promise<string> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return flatText(renderer.toJSON());
}

describe("CoachEmptyState — chaque vide est nommé et expliqué", () => {
  test.each(COACH_EMPTY_VARIANTS)(
    "la variante %s affiche un titre et une explication",
    async (v) => {
      const texte = await renderText(<CoachEmptyState variant={v} />);
      // Titre + corps = au moins deux fragments, et une phrase de vraie longueur.
      expect(texte.split(" | ").length).toBeGreaterThanOrEqual(2);
      expect(texte.length).toBeGreaterThan(60);
    }
  );

  test("les explications des variantes sont toutes différentes", async () => {
    const textes: string[] = [];
    for (const v of COACH_EMPTY_VARIANTS) {
      textes.push(await renderText(<CoachEmptyState variant={v} />));
    }
    expect(new Set(textes).size).toBe(COACH_EMPTY_VARIANTS.length);
  });

  test("aucun vide n'emploie un vocabulaire de panne", async () => {
    for (const v of COACH_EMPTY_VARIANTS) {
      const texte = (await renderText(<CoachEmptyState variant={v} />)).toLowerCase();
      expect(texte).not.toContain("erreur");
      expect(texte).not.toContain("échec");
    }
  });

  test("l'action n'apparaît que si l'écran en fournit une", async () => {
    const sans = await renderText(<CoachEmptyState variant="syncPending" />);
    expect(sans).not.toContain("Actualiser");

    const avec = await renderText(
      <CoachEmptyState variant="syncPending" action={{ onPress: () => {} }} />
    );
    expect(avec).toContain("Actualiser");
  });
});

describe("CoachErrorState — dire ce qui s'est passé, proposer une sortie", () => {
  test.each(COACH_ERROR_VARIANTS)("la variante %s propose une action utile", async (v) => {
    const texte = await renderText(
      <CoachErrorState variant={v} action={{ onPress: () => {} }} />
    );
    expect(texte.length).toBeGreaterThan(60);
    // Une des deux sorties prévues, jamais un bouton sans verbe.
    expect(/Réessayer|Se reconnecter/.test(texte)).toBe(true);
  });

  test("aucune erreur ne se contente d'un message générique", async () => {
    for (const v of COACH_ERROR_VARIANTS) {
      const texte = await renderText(<CoachErrorState variant={v} />);
      expect(texte).not.toContain("Une erreur est survenue");
    }
  });

  test("l'accès refusé explique la cause, sans code technique", async () => {
    const texte = await renderText(<CoachErrorState variant="accessDenied" />);
    expect(texte).toContain("Accès non autorisé");
    expect(texte).not.toMatch(/permission-denied|PERMISSION_DENIED|firestore/i);
  });
});

// ─── RETOUR 5 : aucune cause affirmée, aucune garantie invérifiable ──────────
// L'ancienne copie disait « Vérifiez votre connexion » (une cause que l'app ne
// connaît pas) et « les données sont conservées côté serveur » (une promesse sur
// un serveur qu'on n'a justement pas réussi à joindre).
describe("CoachErrorState — constat, action, hypothèse au conditionnel", () => {
  test("plus aucune affirmation de cause ni de garantie, sur AUCUNE variante", async () => {
    for (const variante of COACH_ERROR_VARIANTS) {
      const texte = await renderText(<CoachErrorState variant={variante} />);
      expect(texte).not.toContain("Vérifiez votre connexion");
      expect(texte).not.toContain("conservées côté serveur");
      expect(texte).not.toContain("rien n'est perdu");
    }
  });

  test("le constat nomme l'objet réellement concerné", async () => {
    const attendu: Record<(typeof COACH_ERROR_SUBJECTS)[number], string> = {
      donnees: "Impossible de charger les données.",
      effectif: "Impossible de charger l'effectif.",
      fiche: "Impossible de charger la fiche du joueur.",
      club: "Impossible de charger les informations du club.",
      semaine: "Impossible de charger la semaine du club.",
    };
    for (const sujet of COACH_ERROR_SUBJECTS) {
      const texte = await renderText(<CoachErrorState variant="network" subject={sujet} />);
      expect(texte).toContain(attendu[sujet]);
    }
  });

  test("la structure exigée est respectée : action puis hypothèse au conditionnel", async () => {
    const texte = await renderText(<CoachErrorState variant="unexpected" subject="effectif" />);
    expect(texte).toContain(
      "Impossible de charger l'effectif. Réessaie. Si le problème persiste, ton accès au club devra peut-être être vérifié.",
    );
  });

  test("sans sujet, le constat reste neutre plutôt que d'en inventer un", async () => {
    const texte = await renderText(<CoachErrorState variant="network" />);
    expect(texte).toContain("Impossible de charger les données.");
  });
});
