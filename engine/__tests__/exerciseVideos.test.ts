// engine/__tests__/exerciseVideos.test.ts
// Badge « Vidéo » exact : seule une démo directe (FKS ou vérifiée directe) compte.
// Une recherche YouTube ou une vidéo alternative (empruntée à une variante) ne
// doivent PAS afficher le badge.
import {
  getExerciseVideoRef,
  isDirectVideo,
  type ExerciseVideoRef,
} from "../exerciseVideos";

describe("isDirectVideo — badge vidéo exact", () => {
  it("compte une vidéo FKS hébergée comme directe", () => {
    const ref: ExerciseVideoRef = { kind: "fks_hosted", url: "https://x/y.mp4", label: "FKS" };
    expect(isDirectVideo(ref)).toBe(true);
  });

  it("compte une vidéo vérifiée directe", () => {
    const ref: ExerciseVideoRef = { kind: "vetted", url: "https://youtu.be/x", label: "src" };
    expect(isDirectVideo(ref)).toBe(true);
  });

  it("n'affiche PAS le badge pour une vidéo alternative (variante)", () => {
    const ref: ExerciseVideoRef = {
      kind: "vetted",
      alternative: true,
      url: "https://youtu.be/x",
      label: "Alternative (...)",
    };
    expect(isDirectVideo(ref)).toBe(false);
  });

  it("n'affiche PAS le badge pour une recherche", () => {
    const ref: ExerciseVideoRef = { kind: "search", url: "https://yt/results", query: "q" };
    expect(isDirectVideo(ref)).toBe(false);
  });
});

describe("getExerciseVideoRef — fallbacks", () => {
  it("retourne une recherche propre pour un ID inconnu (sans crash)", () => {
    const ref = getExerciseVideoRef("totally_unknown_exercise_id");
    expect(ref.kind).toBe("search");
    expect(isDirectVideo(ref)).toBe(false);
  });

  it("retourne une vidéo vérifiée directe pour un exercice mappé", () => {
    const ref = getExerciseVideoRef("str_back_squat");
    expect(ref.kind).toBe("vetted");
    expect(isDirectVideo(ref)).toBe(true);
  });
});
