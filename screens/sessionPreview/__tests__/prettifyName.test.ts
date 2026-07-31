// screens/sessionPreview/__tests__/prettifyName.test.ts
// prettifyName capitalisait chaque mot ("Squat Poids Du Corps") — meme classe
// de bug que labelize() sur les phrases FR (cf. fix(profil) 2aa4564). Une
// phrase FR ne prend qu'une majuscule initiale.

import { prettifyName } from "../sessionPreviewConfig";

describe("prettifyName — casse francaise (majuscule initiale seule)", () => {
  test("nom deja redige par le backend : pas de mot-a-mot", () => {
    expect(prettifyName("Squat poids du corps")).toBe("Squat poids du corps");
  });

  test("nom court multi-mots reste inchange si deja correct", () => {
    expect(prettifyName("Nordic excentrique 3s")).toBe("Nordic excentrique 3s");
  });

  test("acronyme au milieu de la phrase n'est pas retouche", () => {
    expect(prettifyName("VMA courte")).toBe("VMA courte");
  });

  test("slug brut (id backend) : underscores -> espaces, une seule majuscule", () => {
    expect(prettifyName("strength_squat_bodyweight")).toBe("Strength squat bodyweight");
  });

  test("slug avec prefixe token retire", () => {
    expect(prettifyName("str_squat_bodyweight")).toBe("Squat bodyweight");
  });

  test("chaine vide -> fallback 'Exercice'", () => {
    expect(prettifyName("")).toBe("Exercice");
    expect(prettifyName("   ")).toBe("Exercice");
  });
});
