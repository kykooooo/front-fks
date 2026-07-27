// domain/coachView/__tests__/identityLabels.test.ts
//
// Ce que ces tests protègent, et c'est le point CENTRAL du retour de Kyllian :
// le coach doit lire « Régional » et « Défenseur » accentués, SANS que la valeur
// stockée change d'un caractère.
//
// La valeur persistée s'écrit « Regional » sans accent parce qu'elle est
// comparée à une allowlist serveur (functions/src/coachLabels.ts, LEVELS /
// POSITIONS). Toucher la donnée casserait la projection coach et les tests de
// règles Firestore. Ces tests verrouillent donc les deux côtés à la fois :
// le rendu change, la donnée non.
//
// Lancement depuis un worktree : npx jest --config jest.coach.config.js

import {
  coachAgeCategoryLabel,
  coachIdentityLine,
  coachLevelLabel,
  coachPositionLabel,
} from "../identityLabels";
import { matchesCoachSearch, normalizeSearchText } from "../roster";
import { makeSummary, makeView } from "./fixtures";

describe("tables d'affichage — accents à l'écran", () => {
  test("les libellés manquant un accent le reçoivent", () => {
    expect(coachLevelLabel("Regional")).toBe("Régional");
    expect(coachPositionLabel("Defenseur")).toBe("Défenseur");
  });

  test("les libellés déjà corrects passent tels quels", () => {
    for (const niveau of ["Amateur", "National", "Semi-pro", "Pro"]) {
      expect(coachLevelLabel(niveau)).toBe(niveau);
    }
    for (const poste of ["Gardien", "Milieu", "Attaquant"]) {
      expect(coachPositionLabel(poste)).toBe(poste);
    }
    for (const categorie of ["U13", "U15", "U17", "U18", "Senior"]) {
      expect(coachAgeCategoryLabel(categorie)).toBe(categorie);
    }
  });

  test("une valeur inconnue de la table ressort telle quelle, jamais masquée", () => {
    // Un niveau ajouté côté serveur et pas encore connu ici doit rester lisible :
    // afficher un vide ferait disparaître une information réelle.
    expect(coachLevelLabel("Départemental")).toBe("Départemental");
    expect(coachPositionLabel("Latéral")).toBe("Latéral");
  });

  test("une absence reste une absence : null ne devient pas une chaîne", () => {
    expect(coachLevelLabel(null)).toBeNull();
    expect(coachPositionLabel(undefined)).toBeNull();
    expect(coachLevelLabel("   ")).toBeNull();
  });
});

describe("LA VALEUR BRUTE N'EST JAMAIS MODIFIÉE — seulement son rendu", () => {
  test("la projection parsée garde « Regional » sans accent", () => {
    const summary = makeSummary({ level: "Regional", position: "Defenseur" });
    expect(summary.level).toBe("Regional");
    expect(summary.position).toBe("Defenseur");
  });

  test("le modèle de lecture aussi : accentuer se fait à l'affichage, pas en amont", () => {
    const view = makeView({ level: "Regional", position: "Defenseur" });
    expect(view.niveau).toBe("Regional");
    expect(view.poste).toBe("Defenseur");
    // Et pourtant le coach lit bien les accents.
    expect(coachLevelLabel(view.niveau)).toBe("Régional");
    expect(coachPositionLabel(view.poste)).toBe("Défenseur");
  });

  test("appeler la table d'affichage ne mute pas l'objet source", () => {
    const view = makeView({ level: "Regional" });
    const avant = view.niveau;
    coachLevelLabel(view.niveau);
    coachIdentityLine([coachPositionLabel(view.poste), coachLevelLabel(view.niveau)]);
    expect(view.niveau).toBe(avant);
    expect(view.niveau).toBe("Regional");
  });

  test("la recherche continue de porter sur la valeur brute, accentuée ou non", () => {
    const view = makeView({ level: "Regional", position: "Defenseur", firstName: "Anna" });
    // Le coach tape avec accent : `normalizeSearchText` les retire des deux côtés.
    expect(matchesCoachSearch(view, "régional")).toBe(true);
    expect(matchesCoachSearch(view, "regional")).toBe(true);
    expect(matchesCoachSearch(view, "défenseur")).toBe(true);
    expect(matchesCoachSearch(view, "defenseur")).toBe(true);
    // Preuve du mécanisme, pas seulement du résultat.
    expect(normalizeSearchText("Régional")).toBe(normalizeSearchText("Regional"));
  });
});

describe("coachIdentityLine — on ne remplit pas les trous", () => {
  test("les morceaux absents sont omis, pas remplacés par un tiret", () => {
    expect(coachIdentityLine(["Milieu", null, "U15"])).toBe("Milieu · U15");
    expect(coachIdentityLine([null, undefined, "  "])).toBe("");
  });

  test("ordre et séparateur respectés", () => {
    expect(coachIdentityLine(["Défenseur", "Régional", "U17"])).toBe(
      "Défenseur · Régional · U17",
    );
  });
});
