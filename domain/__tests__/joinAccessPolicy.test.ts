// domain/__tests__/joinAccessPolicy.test.ts
//
// Les MOTS de la politique de rattachement.
//
// Ce que cette suite verrouille :
//  1. le libellé de portée, au caractère près (exigence de Kyllian) ;
//  2. qu'aucune phrase affichable ne laisse croire qu'un changement de réglage
//     agit sur les membres DÉJÀ rattachés ;
//  3. que ce module reste un module de MOTS : aucune décision, aucune valeur de
//     politique redéclarée côté front (la source de vérité est le serveur).

import {
  JOIN_ACCESS_POLICY_MODE_LABELS,
  JOIN_ACCESS_POLICY_NO_RETROACTION,
  JOIN_ACCESS_POLICY_SCOPE_LABEL,
  JOIN_ACCESS_POLICY_TITLE,
  joinAccessPolicyTexts,
} from "../joinAccessPolicy";

describe("le libellé de portée, au mot près", () => {
  test("phrase exacte", () => {
    expect(JOIN_ACCESS_POLICY_SCOPE_LABEL).toBe(
      "S'applique aux prochains joueurs qui rejoignent le club",
    );
  });

  test("le rappel de non-rétroactivité dit ce que le changement NE fait PAS", () => {
    expect(JOIN_ACCESS_POLICY_NO_RETROACTION).toBe(
      "Changer ce réglage ne modifie aucun joueur déjà rattaché. Pour fermer un accès existant, il faut le retirer joueur par joueur.",
    );
  });
});

describe("aucune phrase ne promet un effet sur les membres existants", () => {
  // Familles de formulations qui affirmeraient une portée rétroactive. On
  // cherche « effectif / joueurs / membres déjà là » associé à un verbe d'effet.
  // La phrase de non-rétroactivité contient volontairement ces mots : elle est
  // reconnue par sa négation, testée à part ci-dessus.
  const PORTEE_RETROACTIVE = [
    /ferme (l'|les )?acc[eè]s (de|des) (ton |tes )?(effectif|joueurs|membres)/i,
    /(retire|coupe|supprime)( aussitôt| immédiatement)? (l'|les )?acc[eè]s (deja|déjà)/i,
    /s'applique (aussi )?(a|à) (ton |tes |l'|les )?(effectif|joueurs|membres) (deja|déjà)/i,
    /met (a|à) jour (ton |tes |l'|les )?(effectif|joueurs|membres)/i,
    /r[eé]voque .* (effectif|joueurs|membres)/i,
  ];

  test("balayage de TOUTES les phrases affichables", () => {
    for (const texte of joinAccessPolicyTexts()) {
      for (const motif of PORTEE_RETROACTIVE) {
        expect({ texte, motif: String(motif), promesse: motif.test(texte) }).toEqual({
          texte,
          motif: String(motif),
          promesse: false,
        });
      }
    }
  });

  test("chaque mode parle de qui REJOINT, jamais de qui est déjà là", () => {
    for (const phrase of Object.values(JOIN_ACCESS_POLICY_MODE_LABELS)) {
      expect(phrase).toMatch(/rejoint/i);
    }
  });

  test("le titre reste un titre : court, sans promesse", () => {
    expect(JOIN_ACCESS_POLICY_TITLE).toBe("Rattachement des joueurs");
    expect(JOIN_ACCESS_POLICY_TITLE.length).toBeLessThan(40);
  });
});

describe("module de MOTS, pas de décision", () => {
  test("aucune fonction de décision n'est exportée, et aucune valeur de politique n'est redéclarée", () => {
    const api = require("../joinAccessPolicy") as Record<string, unknown>;
    const fonctions = Object.entries(api)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k);
    // La seule fonction tolérée est le collecteur de phrases utilisé par ce test.
    expect(fonctions).toEqual(["joinAccessPolicyTexts"]);

    // Le front ne redéclare NI le nom du champ Firestore, NI le défaut serveur :
    // deux copies auraient fini par diverger, et c'est le serveur qui tranche.
    // Les clés de `JOIN_ACCESS_POLICY_MODE_LABELS` nomment les deux modes — c'est
    // volontaire (un libellé doit bien savoir de quel mode il parle) — mais
    // aucune VALEUR exportée ne porte le champ ni un défaut.
    const valeursPlates = Object.values(api).filter((v) => typeof v === "string");
    expect(valeursPlates).not.toContain("joinAccessPolicy");
    expect(valeursPlates).not.toContain("automatic_safe_projection");
    expect(Object.keys(api).filter((k) => /^DEFAULT_/.test(k))).toEqual([]);
  });
});
