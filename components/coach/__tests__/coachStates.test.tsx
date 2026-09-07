// components/coach/__tests__/coachStates.test.tsx
//
// Ce que ces tests protègent : un écran vide ne doit jamais ressembler à une
// panne, et une erreur doit dire ce qui s'est passé.
// Concrètement : chaque variante a sa propre explication (pas de "Aucune
// donnée" générique recyclé partout), et aucune ne laisse le coach sans phrase.

import React from "react";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
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

  // LES TEXTES, MOT POUR MOT. Une variante d'état vide est une PHRASE que le
  // coach lit dans un moment où il ne sait pas quoi faire : elle ne doit pas
  // pouvoir changer par accident. Ce tableau est le contrat.
  const TEXTES: Record<(typeof COACH_EMPTY_VARIANTS)[number], { titre: string; corps: string }> = {
    accountWithoutClub: {
      titre: "Aucun club rattaché",
      corps:
        "Ton compte n'est rattaché à aucun club. Déconnecte-toi puis choisis « Tu es coach ? » à la connexion pour en créer un.",
    },
    clubWithoutPlayers: {
      titre: "Aucun joueur dans l'effectif",
      corps:
        "Personne n'a encore rejoint le club. Génère un code d'invitation, partage-le, et l'effectif se remplit au fur et à mesure des inscriptions.",
    },
    clubWithoutPlayersElsewhere: {
      titre: "Aucun joueur pour l'instant",
      corps:
        "Personne n'a encore rejoint le club. Chaque joueur y entre avec ton code d'invitation, qui se génère dans l'onglet Semaine.",
    },
    playerWithoutSession: {
      titre: "Aucune séance pour l'instant",
      corps:
        "Ce joueur a rejoint le club mais n'a pas encore terminé de séance FKS. Il n'y a donc rien à lire : ce n'est pas un problème technique.",
    },
    syncPending: {
      titre: "Synchronisation en cours",
      corps:
        "Les données de certains joueurs sont en cours de préparation. Elles apparaissent d'elles-mêmes dès qu'elles sont prêtes, sans rien faire de ton côté.",
    },
    accessRestricted: {
      titre: "Suivi non accessible",
      corps:
        "Une étape reste à faire avant que le suivi de ce joueur soit consultable. Il fait partie de l'effectif et peut s'entraîner normalement : seul l'affichage de ses données est en attente.",
    },
  };

  test.each(COACH_EMPTY_VARIANTS)("la variante %s affiche SES textes, mot pour mot", async (v) => {
    const texte = await renderText(<CoachEmptyState variant={v} />);
    expect(texte).toContain(TEXTES[v].titre);
    expect(texte).toContain(TEXTES[v].corps);
  });

  // UN TITRE N'EST PAS UNE PHRASE. Les cinq titres sont des groupes nominaux
  // ("Aucune séance pour l'instant", "Suivi non accessible") : aucun ne porte de
  // point final. `clubWithoutPlayersElsewhere` en avait un, hérité d'une
  // relecture — un détail invisible seul, une incohérence visible dès qu'on
  // enchaîne deux états vides. Ce test l'empêche de revenir sur n'importe
  // laquelle des variantes, y compris celles qu'on ajoutera après.
  test("aucun titre de variante ne se termine par un point", () => {
    for (const v of COACH_EMPTY_VARIANTS) {
      expect(TEXTES[v].titre.endsWith(".")).toBe(false);
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

// ─── AUCUNE COPIE MORTE ──────────────────────────────────────────────────────
// `firstLogin` et `noRecentData` ont vécu ici sans qu'AUCUN écran ne les rende :
// seul le test de couverture ci-dessus les affichait encore. Une copie que
// personne ne montre n'est relue par personne — `firstLogin` promettait
// « Générer un code d'invitation » sur un écran qui n'en émet aucun, et
// `noRecentData` un « Voir tout l'historique » qui n'existe nulle part. Elles
// sont supprimées ; ce test empêche la situation de revenir.
describe("CoachEmptyState — chaque variante est réellement rendue par un écran", () => {
  const dossierEcrans = resolve(__dirname, "..", "..", "..", "screens", "coach");
  const sources = readdirSync(dossierEcrans)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(resolve(dossierEcrans, f), "utf8"))
    .join("\n");

  test.each(COACH_EMPTY_VARIANTS)("la variante %s est citée par un écran coach", (v) => {
    expect(sources).toContain(`"${v}"`);
  });

  // ── UNE SEULE PHRASE POUR « CE COMPTE N'A PAS DE CLUB » ────────────────────
  // Les trois onglets coach affichaient cet état avec trois textes écrits
  // séparément, et deux d'entre eux décrivaient une création de club
  // INATTEIGNABLE depuis l'espace coach (« Crée ton club pour ouvrir ton
  // espace », « Crée ton club, ou demande à FKS de te rattacher »). Ce test
  // interdit qu'une quatrième version réapparaisse dans un écran.
  test("les trois onglets coach affichent la MÊME phrase, celle de la variante", () => {
    const ecrans = ["CoachTodayScreen.tsx", "CoachWeekScreen.tsx", "CoachRosterScreen.tsx"];
    for (const nom of ecrans) {
      const src = readFileSync(resolve(dossierEcrans, nom), "utf8");
      expect(src).toContain('variant="accountWithoutClub"');
    }
    // Les anciennes formulations ne survivent nulle part dans du code rendu.
    // (`sources` inclut les commentaires : on ne cherche donc que la partie de
    // phrase qui n'a jamais été citée dans une explication.)
    expect(sources).not.toContain("Ce compte n'est associé à aucun club.");
    expect(sources).not.toContain("le suivi de la semaine s'affichera ensuite ici");
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
