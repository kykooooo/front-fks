// state/stores/__tests__/useBodyStore.test.ts
//
// GARDE ANTI-DOUBLON PAR ZONE (P3, round 2 de l'audit « Mon corps »).
//
// Le setup (D6, `ProfileSetupScreen.tsx`) et la passerelle du feedback (D3,
// `useFeedbackSave.ts`) peuvent tous les deux appeler `ajouterGene` pour une
// zone DEJA suivie ailleurs (le joueur redéclare son genou au feedback alors
// qu'il l'avait déjà signalé au setup). Sans garde, deux lignes « genou »
// coexisteraient : `collectActivePainConstraints` ne lirait que l'une des
// deux au hasard de l'ordre, et l'écran « Mon corps » afficherait un doublon
// que rien ne permettrait de comprendre.
import { useBodyStore } from "../useBodyStore";

function reset() {
  useBodyStore.setState({ bodyInjuries: [], migrationFeedbackAt: null });
}

beforeEach(reset);

describe("ajouterBlessure — anti-doublon par zone (active/en reprise)", () => {
  test("deux appels sur la même zone active → UNE seule entrée, mise à jour", () => {
    const premiere = useBodyStore.getState().ajouterBlessure({
      zone: "genou",
      gravite: 1,
      source: "feedback",
      nowISO: "2026-09-01T10:00:00.000Z",
    });
    const seconde = useBodyStore.getState().ajouterBlessure({
      zone: "genou",
      gravite: 3,
      source: "manual",
      nowISO: "2026-09-03T10:00:00.000Z",
    });

    const injuries = useBodyStore.getState().bodyInjuries;
    expect(injuries).toHaveLength(1);
    // Même ligne (même id), pas une deuxième créée à côté.
    expect(seconde.id).toBe(premiere.id);
    // La gravité et la date de mise à jour suivent la déclaration la plus récente.
    expect(injuries[0].gravite).toBe(3);
    expect(injuries[0].updatedAt).toBe("2026-09-03T10:00:00.000Z");
    // Une nouvelle déclaration dit "ça recommence / c'est toujours là" — jamais
    // "en reprise", que le joueur seul peut affirmer.
    expect(injuries[0].statut).toBe("active");
    // La date de PREMIÈRE déclaration ne bouge pas : ce n'est pas une nouvelle gêne.
    expect(injuries[0].declaredAt).toBe("2026-09-01T10:00:00.000Z");
  });

  test("une zone déjà EN REPRISE se fait aussi mettre à jour, pas dupliquer", () => {
    const premiere = useBodyStore.getState().ajouterBlessure({
      zone: "cheville",
      gravite: 2,
      source: "manual",
      nowISO: "2026-09-01T10:00:00.000Z",
    });
    useBodyStore.getState().changerStatut(premiere.id, "recovering", "2026-09-02T10:00:00.000Z");

    useBodyStore.getState().ajouterBlessure({
      zone: "cheville",
      gravite: 2,
      source: "feedback",
      nowISO: "2026-09-03T10:00:00.000Z",
    });

    const injuries = useBodyStore.getState().bodyInjuries;
    expect(injuries).toHaveLength(1);
    expect(injuries[0].statut).toBe("active");
  });

  test("une zone GUÉRIE ne bloque rien : une nouvelle déclaration ouvre une ligne distincte", () => {
    const guerie = useBodyStore.getState().ajouterBlessure({
      zone: "ischio",
      gravite: 2,
      source: "feedback",
      nowISO: "2026-08-01T10:00:00.000Z",
    });
    useBodyStore.getState().changerStatut(guerie.id, "healed", "2026-08-15T10:00:00.000Z");

    const nouvelle = useBodyStore.getState().ajouterBlessure({
      zone: "ischio",
      gravite: 1,
      source: "manual",
      nowISO: "2026-09-01T10:00:00.000Z",
    });

    const injuries = useBodyStore.getState().bodyInjuries;
    expect(injuries).toHaveLength(2);
    expect(nouvelle.id).not.toBe(guerie.id);
    expect(injuries.find((b) => b.id === guerie.id)?.statut).toBe("healed");
    expect(injuries.find((b) => b.id === nouvelle.id)?.statut).toBe("active");
  });

  test("la note n'est remplacée que si une nouvelle est fournie — jamais effacée en silence", () => {
    useBodyStore.getState().ajouterBlessure({
      zone: "dos",
      gravite: 2,
      source: "manual",
      note: "ça tire le matin",
      nowISO: "2026-09-01T10:00:00.000Z",
    });

    // Deuxième déclaration SANS note : celle déjà écrite doit survivre.
    useBodyStore.getState().ajouterBlessure({
      zone: "dos",
      gravite: 2,
      source: "feedback",
      nowISO: "2026-09-02T10:00:00.000Z",
    });

    expect(useBodyStore.getState().bodyInjuries[0].note).toBe("ça tire le matin");

    // Troisième déclaration AVEC une nouvelle note : elle remplace l'ancienne.
    useBodyStore.getState().ajouterBlessure({
      zone: "dos",
      gravite: 2,
      source: "manual",
      note: "surtout en extension",
      nowISO: "2026-09-03T10:00:00.000Z",
    });
    expect(useBodyStore.getState().bodyInjuries[0].note).toBe("surtout en extension");
  });

  test("deux zones différentes ne sont jamais fusionnées", () => {
    useBodyStore.getState().ajouterBlessure({ zone: "genou", gravite: 1, source: "manual" });
    useBodyStore.getState().ajouterBlessure({ zone: "cheville", gravite: 1, source: "manual" });

    expect(useBodyStore.getState().bodyInjuries).toHaveLength(2);
  });
});
