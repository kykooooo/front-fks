// B2-3 : garde-fous sur le contenu éditorial généré (engine/generated/exerciseContentV2.ts).
// Si le générateur ou le catalogue V2 dérive (jargon interne, mots désaccentués,
// ballon, lot pilote incomplet, orphelins silencieux), ces tests cassent.
import { EXERCISE_CONTENT_V2 } from "../generated/exerciseContentV2";
import { EXERCISE_BANK } from "../exerciseBank";
import { getExerciseContent } from "../exerciseContent";

// Tous les champs TEXTE d'une fiche (jamais sourceId/equipment/safetyExclude :
// les ids contiennent légitimement « acceleration » sans accent).
const textsOf = (id: string): string[] => {
  const e = EXERCISE_CONTENT_V2[id];
  return [e.name ?? "", e.description ?? "", e.setup ?? "", ...e.steps, ...e.cues, ...e.avoid];
};
const allIds = Object.keys(EXERCISE_CONTENT_V2);

describe("volumétrie et complétude", () => {
  it("375 fiches générées, chacune avec des étapes", () => {
    expect(allIds.length).toBe(375);
    for (const id of allIds) {
      expect(EXERCISE_CONTENT_V2[id].steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("seules 2 fiches n'ont pas de « À éviter » (fiches V2 sans commonMistakes, assumé)", () => {
    const sansAvoid = allIds.filter((id) => EXERCISE_CONTENT_V2[id].avoid.length === 0).sort();
    expect(sansAvoid).toEqual(["cod_wall_drill_a_skip", "rsa_reaction_sprint_10m"]);
  });
});

describe("zéro mot désaccentué (liste fermée) dans les textes servis", () => {
  // Mots qui n'existent PAS en français sans leur accent — toute occurrence est une faute.
  const UNACCENTED = new RegExp(
    "\\b(" +
      [
        "controle", "controles", "controlee", "controlees", "controlant",
        "epaule", "epaules", "legerement", "jusqua",
        "reception", "receptions", "acceleration", "accelerations",
        "deceleration", "decelerations", "relache", "relachement",
        "maitrise", "maitrisee", "regulier", "reguliere",
        "duree", "durees", "recuperation", "echauffement", "reaction", "reactions",
        "flechis", "flechie", "flechies", "gaine", "gainee", "gaines",
      ].join("|") +
      ")\\b",
    "i"
  );
  it("aucune fiche générée ne contient un mot de la liste", () => {
    const offenders: string[] = [];
    for (const id of allIds) {
      const hit = textsOf(id).find((t) => UNACCENTED.test(t));
      if (hit) offenders.push(`${id}: « ${hit} »`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("doctrine zéro ballon dans les textes générés", () => {
  const BALL_WORDS = /(swiss|fitball|medball|médecine-ball|ballon)/i;
  const stripBallNegations = (t: string) => t.replace(/sans ballon/gi, "");
  it("aucun texte généré ne propose un ballon (négation « sans ballon » tolérée)", () => {
    const offenders: string[] = [];
    for (const id of allIds) {
      const hit = textsOf(id).find((t) => BALL_WORDS.test(stripBallNegations(t)));
      if (hit) offenders.push(`${id}: « ${hit} »`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("aucune note éditoriale interne ne fuit vers le joueur", () => {
  const INTERNAL = /(_A_VALIDER|canonique paramétrable|presets? legacy|une seule fiche|=\s*paramètre|\blegacy\b)/i;
  it("jargon interne absent de toutes les fiches", () => {
    const offenders: string[] = [];
    for (const id of allIds) {
      const hit = textsOf(id).find((t) => INTERNAL.test(t));
      if (hit) offenders.push(`${id}: « ${hit} »`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("lot pilote : les 12 fiches sont complètes (aucune régression)", () => {
  // sprint_acceleration (id V2) est servi côté front par sprint_accel_10m (alias).
  const PILOTE = [
    "str_air_squat", "str_goblet_squat", "str_forward_lunge", "str_reverse_lunge",
    "str_hip_thrust", "str_glute_bridge", "str_copenhagen", "str_slider_leg_curl",
    "run_strides", "speed_ankling", "sprint_falling_start_10m", "sprint_accel_10m",
  ];
  it.each(PILOTE)("%s : ≥2 étapes, ≥2 bons gestes, ≥1 à éviter", (id) => {
    const e = EXERCISE_CONTENT_V2[id];
    expect(e).toBeDefined();
    expect(e.steps.length).toBeGreaterThanOrEqual(2);
    expect(e.cues.length).toBeGreaterThanOrEqual(2);
    expect(e.avoid.length).toBeGreaterThanOrEqual(1);
  });

  it("mob_hip_flexor_dynamic garde son contenu, sans la note interne « une seule fiche »", () => {
    const e = EXERCISE_CONTENT_V2["mob_hip_flexor_dynamic"];
    expect(e.steps.length).toBeGreaterThanOrEqual(3);
    expect(e.cues.join(" ")).not.toMatch(/une seule fiche/i);
    expect(e.avoid.length).toBeGreaterThanOrEqual(2);
  });
});

describe("orphelins V2 : liste exacte et repli legacy intact", () => {
  const ORPHANS = [
    "circuit_hi", "circuit_low_bodyweight", "circuit_mod_mix",
    "generic_breathing_nasal", "mob_shoulder", "run_tempo_2x8", "str_deadlift_heavy",
  ];
  it("la liste des ids sans fiche V2 ne bouge pas en silence", () => {
    const bankIds = EXERCISE_BANK.map((e) => e.id);
    const noV2 = bankIds.filter((id) => !EXERCISE_CONTENT_V2[id]).sort();
    // orphelins + exclusions déclarées du générateur (ballon, marqueurs de chantier).
    // 393 ids en banque − 374 d'entre eux couverts par une fiche V2 = 19.
    // (Le catalogue compte 375 fiches : rsa_reaction_sprint_10m en a une mais
    // n'est plus en banque depuis le merge, cf. le test suivant.)
    for (const orphan of ORPHANS) expect(noV2).toContain(orphan);
    expect(noV2.length).toBe(393 - 374);
  });

  it("purge structurelle : les 7 jeux réduits rsa_ssg_* n'existent plus dans la banque (+ le stub à 2 rsa_reaction_sprint_10m, retiré au merge)", () => {
    const bankIds = new Set(EXERCISE_BANK.map((e) => e.id));
    for (const id of ["rsa_ssg_2v2", "rsa_ssg_3v2", "rsa_ssg_3v3", "rsa_ssg_4v3", "rsa_ssg_4v4", "rsa_ssg_5v5", "rsa_ssg_6v6"]) {
      expect(bankIds.has(id)).toBe(false);
    }
    // 8e absence, arrivée AU MERGE et pas sur cette branche : le filtre
    // estExerciceNonSolo (fix/non-solo-front) empêche aussi le stub auto-généré
    // de rsa_reaction_sprint_10m — sprint sur signal externe, infaisable seul.
    // Le compte n'est donc pas relâché, il descend d'un cran pour une raison
    // nommée : 401 (audit) − 7 purgés à la source − 1 filtré = 393.
    expect(bankIds.has("rsa_reaction_sprint_10m")).toBe(false);
    expect(EXERCISE_BANK.length).toBe(393);
  });

  it("les orphelins avec instruction legacy la servent encore, sans « À éviter »", () => {
    for (const id of ["run_tempo_2x8", "str_deadlift_heavy", "mob_shoulder", "circuit_hi"]) {
      const content = getExerciseContent(id);
      expect(content).not.toBeNull();
      expect(content!.source).toBe("legacy");
      expect(content!.avoid).toEqual([]);
    }
  });

  it("generic_breathing_nasal reste sans contenu (comportement inchangé, à traiter au lot C)", () => {
    expect(getExerciseContent("generic_breathing_nasal")).toBeNull();
  });
});
