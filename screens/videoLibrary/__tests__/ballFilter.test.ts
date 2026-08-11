// A4 (audit bibliothèque §E5) : doctrine « zéro ballon » — le filtre attrape aussi
// « swissball » (sans underscore), et aucun texte de la banque VISIBLE ne propose
// de ballon (swiss/fitball/medball/ballon).
import { EXERCISE_BANK, EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../../../engine/exerciseInstructions";
import { isBallExercise } from "../videoLibraryConfig";

const BALL_WORDS = /(swiss|fitball|medball|médecine-ball|ballon)/i;
// « sans ballon » est une NÉGATION (ex. « Speed dribbles — sans ballon ») : tolérée,
// même règle que le générateur scripts/generateExerciseContent.js.
const stripBallNegations = (t: string) => t.replace(/sans ballon/gi, "");

describe("filtre anti-ballon", () => {
  it("core_stir_the_pot_swissball est masqué (le trou « swissball » est bouché)", () => {
    const e = EXERCISE_BY_ID["core_stir_the_pot_swissball"];
    expect(e).toBeDefined();
    expect(isBallExercise(e)).toBe(true);
  });

  it("les ids ballon historiques restent masqués", () => {
    for (const id of ["str_swiss_ball_leg_curl", "mb_chest_pass_wall", "mb_overhead_slam", "cod_medball_rotational_throw"]) {
      expect(isBallExercise(EXERCISE_BY_ID[id])).toBe(true);
    }
  });

  it("aucun texte de la banque visible ne mentionne un ballon", () => {
    const offenders: string[] = [];
    for (const e of EXERCISE_BANK) {
      if (isBallExercise(e)) continue;
      const instruction = EXERCISE_INSTRUCTIONS[e.id];
      const texts = [e.name, e.description, instruction?.howTo ?? "", ...(instruction?.cues ?? [])].map(stripBallNegations);
      if (texts.some((t) => BALL_WORDS.test(t))) offenders.push(`${e.id}: ${texts.find((t) => BALL_WORDS.test(t))}`);
    }
    expect(offenders).toEqual([]);
  });
});
