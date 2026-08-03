// domain/__tests__/clubDirectivePromesse.test.ts
//
// LA DIRECTIVE NE DOIT RIEN PROMETTRE QU'ELLE NE TIENT PAS.
//
// Constat de départ (juillet 2026) : le moteur de génération NE LIT PAS la
// directive. Elle part bien dans le contexte, mais aucune séance n'est adaptée
// parce qu'elle existe. Or les écrans annonçaient le contraire :
//   - au coach   : « susceptible d'influencer ses prochaines séances » ;
//   - au coach   : « FKS en tient compte pour leurs prochaines séances » (toast
//                  de confirmation — la pire des trois, elle arrive au moment où
//                  le coach a le plus de raisons d'y croire) ;
//   - au joueur  : « FKS en tient compte pour tes séances » ;
//   - au joueur  : « une directive était active lors de la construction de cette
//                  séance et a été transmise à FKS » — littéralement vrai, et
//                  malgré tout trompeur : on ne cite pas un transport au milieu
//                  d'une séance sans laisser croire qu'il a pesé.
//
// Cette suite verrouille les deux versants :
//  1. les phrases honnêtes, au caractère près ;
//  2. un BALAYAGE de toutes les constantes de texte exportées du chantier, qui
//     échoue si une promesse d'influence réapparaît — sous n'importe quelle
//     formulation appartenant aux familles connues (cf. le détecteur et ses
//     limites, domain/__tests__/helpers/promesseInfluence.ts).

import * as directive from "../clubDirective";
import * as noteCoach from "../clubCoachNote";
import {
  chainesDe,
  promessesDInfluence,
} from "./helpers/promesseInfluence";

const TODAY = "2026-07-27";
const brut = {
  objective: "prevention",
  instruction: "On garde les appuis",
  validFrom: "2026-07-20",
  validUntil: "2026-08-10",
  active: true,
  createdBy: "coachA",
};

// ────────────────────────────────────────────────────────────────────────────
describe("les phrases honnêtes, au mot près", () => {
  test("le libellé de préparation est EXACTEMENT celui décidé", () => {
    expect(directive.CLUB_DIRECTIVE_PREPARATION_NOTICE).toBe(
      "Fonction en préparation — cette directive n'est pas encore appliquée aux séances",
    );
  });

  test("le libellé coach garde ce qui est VRAI (le joueur lit) et lâche ce qui est FAUX", () => {
    expect(directive.CLUB_DIRECTIVE_LABEL).toBe(
      "Directive d'entraînement — visible par le joueur, dans l'application, dès qu'elle est enregistrée.",
    );
    expect(directive.CLUB_DIRECTIVE_LABEL).toContain("visible par le joueur");
  });

  test("le toast de confirmation ne parle plus que de ce qui a eu lieu", () => {
    expect(directive.CLUB_DIRECTIVE_SAVED_TOAST).toEqual({
      titre: "Directive enregistrée",
      message: "Tes joueurs peuvent la lire depuis leur application.",
    });
  });

  test("l'ancienne phrase de séance n'existe plus, sous aucun nom", () => {
    // Elle disait « ... a été transmise à FKS » sur l'écran de séance du joueur.
    expect((directive as Record<string, unknown>).CLUB_DIRECTIVE_SESSION_NOTICE).toBeUndefined();
    for (const t of chainesDe(directive)) {
      expect(t).not.toContain("transmise à FKS");
    }
  });

  test("ce que le joueur lit porte la phrase de préparation, telle quelle", () => {
    const notice = directive.clubDirectiveNotice(directive.parseClubDirective(brut), TODAY);
    expect(notice?.preparation).toBe(directive.CLUB_DIRECTIVE_PREPARATION_NOTICE);
    expect(notice?.precision).toBe("Ton club a posé cette consigne pour toi. C'est un message de ton coach.");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("balayage anti-promesse de TOUTES les constantes exportées", () => {
  /**
   * On balaie les modules, pas une liste de chaînes : toute constante ajoutée
   * demain est couverte sans que personne n'ait à penser à l'inscrire.
   * Le rendu joueur est ajouté à la main parce qu'il est PRODUIT (une fonction),
   * pas exporté comme texte.
   */
  const textes = (): string[] => [
    ...chainesDe(directive),
    ...chainesDe(noteCoach),
    ...chainesDe(directive.clubDirectiveNotice(directive.parseClubDirective(brut), TODAY)),
  ];

  test("aucune phrase n'affirme un effet sur une séance", () => {
    const fautes = textes().flatMap((t) => promessesDInfluence(t));
    expect(fautes).toEqual([]);
  });

  test("le balayage couvre réellement quelque chose (témoin)", () => {
    // Sans ce témoin, un détecteur cassé (ou un balayage vide) rendrait le test
    // ci-dessus vert pour de mauvaises raisons.
    expect(textes().length).toBeGreaterThan(8);
    expect(textes().join(" ")).toContain("Fonction en préparation");
  });

  test("le détecteur attrape bien les formulations retirées (témoin négatif)", () => {
    const anciennes = [
      "Directive d'entraînement — visible par le joueur et susceptible d'influencer ses prochaines séances.",
      "Tes joueurs peuvent la lire ; FKS en tient compte pour leurs prochaines séances.",
      "Ton club a posé cette directive. FKS en tient compte pour tes séances, sans jamais passer devant les règles de sécurité.",
      "FKS s'appuie dessus pour construire ta séance",
      "Ta prochaine séance sera adaptée à cette consigne",
    ];
    for (const phrase of anciennes) {
      expect({ phrase, detecte: promessesDInfluence(phrase).length > 0 }).toEqual({
        phrase,
        detecte: true,
      });
    }
  });

  test("le détecteur laisse passer les phrases NIÉES (sinon il serait inutilisable)", () => {
    const honnetes = [
      "Fonction en préparation — cette directive n'est pas encore appliquée aux séances",
      "Note privée — visible uniquement par l'encadrement autorisé. Cette note ne modifie pas les séances.",
      "Cette consigne n'influence aucune séance pour le moment.",
    ];
    for (const phrase of honnetes) {
      expect({ phrase, fautes: promessesDInfluence(phrase) }).toEqual({ phrase, fautes: [] });
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("aucun état d'écran ne prétend qu'une adaptation a eu lieu", () => {
  test("le rendu joueur ne contient ni « adaptée », ni « appliquée », ni « prise en compte »", () => {
    const notice = directive.clubDirectiveNotice(directive.parseClubDirective(brut), TODAY);
    const texte = chainesDe(notice).join(" | ");
    // « appliquée » n'apparaît QUE dans la phrase de préparation, niée.
    expect(texte).toContain("n'est pas encore appliquée aux séances");
    expect(texte).not.toMatch(/a été (adaptée|prise en compte|appliquée)/i);
    expect(texte).not.toMatch(/ta séance a été/i);
  });

  test("une directive inactive, expirée ou future ne produit AUCUN rendu", () => {
    const cas = [
      { ...brut, active: false },
      { ...brut, validFrom: "2026-08-01", validUntil: "2026-08-10" }, // future
      { ...brut, validFrom: "2026-07-01", validUntil: "2026-07-10" }, // expirée
    ];
    for (const c of cas) {
      expect(directive.clubDirectiveNotice(directive.parseClubDirective(c), TODAY)).toBeNull();
    }
  });
});
