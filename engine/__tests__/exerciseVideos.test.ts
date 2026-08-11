// A3 (audit bibliothèque §E3) : une vidéo empruntée à une VARIANTE n'est plus
// présentée comme la vidéo de l'exercice (kind « variant », par construction) —
// les 77 substitutions de l'audit sortent du « vetted » sans liste à maintenir.
import { EXERCISE_BANK } from "../exerciseBank";
import { getExerciseVideoRef } from "../exerciseVideos";

describe("les substitutions de l'audit ne sont plus des « vetted »", () => {
  it.each([
    ["speed_ankling", "sprint_falling_start_10m"], // montrait un tuto de départ incliné
    ["str_air_squat", "str_front_squat"], // montrait un front squat barre
    ["core_copenhagen_side_plank", "core_plank"], // montrait une planche classique
    ["cod_l_drill", "cod_45_cut_tech"], // montrait une coupe 45°
    ["run_strides", "sprint_flying_10m"], // montrait du sprint lancé
  ])("%s → kind variant (vidéo de %s)", (id, variantId) => {
    const ref = getExerciseVideoRef(id);
    expect(ref.kind).toBe("variant");
    if (ref.kind === "variant") expect(ref.variantId).toBe(variantId);
  });
});

describe("les vraies vidéos et les recherches ne bougent pas", () => {
  it("sprint_falling_start_10m garde sa vidéo dédiée", () => {
    const ref = getExerciseVideoRef("sprint_falling_start_10m");
    expect(ref.kind).toBe("vetted");
    if (ref.kind === "vetted") expect(ref.label).toBe("Falling start tutorial");
  });
  it("str_goblet_squat reste une recherche", () => {
    expect(getExerciseVideoRef("str_goblet_squat").kind).toBe("search");
  });
});

describe("par construction, sur toute la banque", () => {
  it("aucun « vetted » n'est une vidéo empruntée (libellé Alternative disparu)", () => {
    for (const e of EXERCISE_BANK) {
      const ref = getExerciseVideoRef(e.id);
      if (ref.kind === "vetted") {
        expect(ref.label.startsWith("Alternative")).toBe(false);
      }
    }
  });

  it("répartition mesurée : 105 vetted / 77 variant / 219 search (chiffres de l'audit)", () => {
    let vetted = 0;
    let variant = 0;
    let search = 0;
    for (const e of EXERCISE_BANK) {
      const kind = getExerciseVideoRef(e.id).kind;
      if (kind === "vetted") vetted += 1;
      else if (kind === "variant") variant += 1;
      else search += 1;
    }
    expect(vetted).toBe(105);
    expect(variant).toBe(77);
    expect(search).toBe(219);
  });
});
