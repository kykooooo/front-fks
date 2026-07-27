// domain/coachView/__tests__/today.test.ts
//
// Ce que ces tests PROTÈGENT :
//  - un chiffre absent vaut `null`, jamais 0 (un coach doit pouvoir croire un 0) ;
//  - la raison affichée est COURTE et autoportante, et dit QUAND pour une séance
//    prévue non faite — c'est cette information qui déclenche l'appel au joueur ;
//  - "profil non lu" (échec de lecture) et "profil en préparation" (état normal
//    du serveur) ne sont jamais confondus ;
//  - la provenance des signaux est énoncée à partir des signaux RÉELS, jamais
//    supposée ;
//  - une équipe féminine est nommée au féminin, sans faute d'accord.

import { makeSummary } from "./fixtures";
import { toCoachPlayerView, toCoachPlayerViews } from "../fromSummary";
import type { CoachPlayerSummary } from "../../coachSummary";
import {
  buildTodayActivity,
  buildTodayAttentionEntries,
  buildTodayCoverageNotes,
  buildTodayEmptyReason,
  buildTodayEmptyTitle,
  buildTodaySourcesLabel,
  formatTodayLabel,
  memberWordFor,
} from "../today";

const TODAY = "2026-07-27"; // lundi

const vues = (summaries: CoachPlayerSummary[]) => toCoachPlayerViews(summaries, TODAY);

describe("buildTodayActivity — zéro n'est pas indisponible", () => {
  test("sans fenêtre d'activité projetée, le chiffre du jour est null", () => {
    // Cas NOMINAL tant que la boucle de suivi joueur n'est pas mergée.
    const activite = buildTodayActivity(vues([makeSummary({ activity: null })]), TODAY);
    expect(activite.membresActifs).toBeNull();
    expect(activite.membresAvecDonnees).toBe(0);
    expect(activite.membresSansDonnees).toBe(1);
  });

  test("avec fenêtre d'activité et aucune séance du jour, le chiffre vaut 0", () => {
    const activite = buildTodayActivity(
      vues([makeSummary({ activity: { doneDateKeys: ["2026-07-26"] } })]),
      TODAY,
    );
    expect(activite.membresActifs).toBe(0);
    expect(activite.membresAvecDonnees).toBe(1);
  });

  test("les séances du jour sont comptées, membre par membre", () => {
    const activite = buildTodayActivity(
      vues([
        makeSummary({ playerUid: "u1", activity: { doneDateKeys: [TODAY, "2026-07-25"] } }),
        makeSummary({ playerUid: "u2", activity: { doneDateKeys: [TODAY] } }),
        makeSummary({ playerUid: "u3", activity: { doneDateKeys: ["2026-07-20"] } }),
      ]),
      TODAY,
    );
    expect(activite.membresActifs).toBe(2);
    expect(activite.membresAvecDonnees).toBe(3);
  });

  test("un mélange mesurable / non mesurable ne compte à zéro que les mesurables", () => {
    const activite = buildTodayActivity(
      vues([
        makeSummary({ playerUid: "u1", activity: { doneDateKeys: ["2026-07-26"] } }),
        makeSummary({ playerUid: "u2", activity: null }),
      ]),
      TODAY,
    );
    expect(activite.membresActifs).toBe(0);
    expect(activite.membresAvecDonnees).toBe(1);
    expect(activite.membresSansDonnees).toBe(1);
  });

  test("une clé de jour invalide ne produit jamais un chiffre inventé", () => {
    const activite = buildTodayActivity(
      vues([makeSummary({ activity: { doneDateKeys: [TODAY] } })]),
      "pas-une-date",
    );
    expect(activite.membresActifs).toBeNull();
    expect(activite.todayKey).toBe("");
  });
});

describe("buildTodayAttentionEntries — une raison courte et autoportante", () => {
  const seancePrevue = (dateKey: string) =>
    makeSummary({
      firstName: "Marc",
      latestSession: {
        dateKey,
        title: "Force bas du corps",
        focusLabel: "Force",
        intensityLabel: "Modérée",
        durationMin: 45,
        blockCount: 4,
        status: "planned",
      },
    });

  test("une séance prévue dans la semaine écoulée est datée par son jour", () => {
    const [entry] = buildTodayAttentionEntries(vues([seancePrevue("2026-07-24")]), TODAY);
    expect(entry.raison).toBe("Séance prévue vendredi, pas encore faite");
    expect(entry.statut).toBe("check");
    expect(entry.statutLibelle).toBe("À vérifier");
  });

  test("au-delà d'une semaine, la date complète revient (aucune ambiguïté)", () => {
    const [entry] = buildTodayAttentionEntries(vues([seancePrevue("2026-07-10")]), TODAY);
    expect(entry.raison).toContain("10 juillet");
  });

  test("sans séance connue, le complément dit l'absence au lieu de l'omettre", () => {
    const [entry] = buildTodayAttentionEntries(vues([seancePrevue("2026-07-24")]), TODAY);
    expect(entry.complement).toBe("Aucune séance enregistrée");
  });

  test("plusieurs signaux : le complément annonce ce qu'il reste à regarder", () => {
    const view = toCoachPlayerView(
      makeSummary({
        profileComplete: false,
        latestSession: {
          dateKey: "2026-07-24",
          title: null,
          focusLabel: null,
          intensityLabel: null,
          durationMin: null,
          blockCount: null,
          status: "planned",
        },
      }),
      TODAY,
    );
    const [entry] = buildTodayAttentionEntries([view], TODAY);
    expect(entry.complement).toBe("+ 1 autre point à regarder");
  });

  test("l'ordre d'entrée (priorité décidée par le roster) est conservé", () => {
    const entries = buildTodayAttentionEntries(
      vues([
        makeSummary({ playerUid: "u1", firstName: "Anna" }),
        makeSummary({ playerUid: "u2", firstName: "Bob" }),
      ]),
      TODAY,
    );
    expect(entries.map((e) => e.playerUid)).toEqual(["u1", "u2"]);
  });
});

describe("buildTodaySourcesLabel — la provenance est lue, jamais supposée", () => {
  test("aucune entrée : aucune phrase", () => {
    expect(buildTodaySourcesLabel([])).toBeNull();
  });

  test("les origines réellement présentes sont énoncées une seule fois", () => {
    const entries = buildTodayAttentionEntries(
      vues([
        makeSummary({
          playerUid: "u1",
          latestSession: {
            dateKey: "2026-07-24",
            title: null,
            focusLabel: null,
            intensityLabel: null,
            durationMin: null,
            blockCount: null,
            status: "planned",
          },
        }),
        makeSummary({ playerUid: "u2" }),
      ]),
      TODAY,
    );
    const phrase = buildTodaySourcesLabel(entries);
    expect(phrase).toContain("calculé par l'app");
    // Une seule occurrence, même si deux entrées partagent l'origine.
    expect(phrase?.match(/calculé par l'app/g)?.length).toBe(1);
  });
});

describe("buildTodayCoverageNotes — échec de lecture ≠ état normal du serveur", () => {
  test("aucun compteur : aucune note", () => {
    expect(buildTodayCoverageNotes(0, 0)).toEqual([]);
  });

  test("les profils non lus passent en premier et annoncent le doute", () => {
    const notes = buildTodayCoverageNotes(2, 3);
    expect(notes[0].id).toBe("profils_non_lus");
    expect(notes[0].titre).toBe("3 profils non lus");
    expect(notes[0].niveau).toBe("watch");
    expect(notes[0].pourquoi).toContain("incomplète");
  });

  test("les projections en préparation restent un état neutre, sans vocabulaire de panne", () => {
    const [note] = buildTodayCoverageNotes(1, 0);
    expect(note.id).toBe("profils_en_preparation");
    expect(note.titre).toBe("1 profil en cours de préparation");
    expect(note.niveau).toBe("unknown");
    expect(note.pourquoi.toLowerCase()).not.toContain("erreur");
    expect(note.pourquoi.toLowerCase()).not.toContain("échec");
  });

  test("un compteur négatif ou décimal ne produit pas de note absurde", () => {
    expect(buildTodayCoverageNotes(-4, 0)).toEqual([]);
    expect(buildTodayCoverageNotes(2.7, 0)[0].titre).toBe("2 profils en cours de préparation");
  });
});

describe("buildTodayEmptyReason — dire SUR QUOI porte le constat", () => {
  test("rien de lisible : on ne prétend pas avoir vérifié quoi que ce soit", () => {
    expect(buildTodayEmptyReason(0, 0, "membre")).toContain("Aucun profil lisible");
  });

  test("des profils à surveiller sont mentionnés sans être requalifiés", () => {
    expect(buildTodayEmptyReason(8, 2, "joueur")).toBe(
      "2 joueurs à surveiller, mais rien ne demande une lecture aujourd'hui.",
    );
  });

  test("aucune faute d'accord au féminin", () => {
    expect(buildTodayEmptyReason(1, 0, "joueuse")).toBe("Aucun signal à lire sur 1 joueuse.");
    expect(buildTodayEmptyReason(3, 0, "joueuse")).toBe("Aucun signal à lire sur 3 joueuses.");
  });
});

describe("Vocabulaire du groupe et date du jour", () => {
  test("le mot d'un membre suit le type d'équipe", () => {
    expect(memberWordFor("female")).toBe("joueuse");
    expect(memberWordFor("male")).toBe("joueur");
    expect(memberWordFor("mixed")).toBe("membre");
    expect(memberWordFor(null)).toBe("membre");
  });

  test("la date du jour est lisible et capitalisée", () => {
    expect(formatTodayLabel(TODAY)).toBe("Lundi 27 juillet");
  });

  test("une clé invalide ne fabrique jamais une date", () => {
    expect(formatTodayLabel("2026-02-30")).toBe("");
  });
});

// ─── RETOUR 6 : le constat de l'écran d'atterrissage dit son périmètre ──────
describe("données partielles — « rien à vérifier » ne devient pas « tout va bien »", () => {
  test("les membres dont il manque des données sont comptés", () => {
    // Aucune exécution, aucune séance prévue : cas NOMINAL d'aujourd'hui.
    const activite = buildTodayActivity(
      vues([
        makeSummary({ playerUid: "u1", activity: { doneDateKeys: [TODAY] } }),
        makeSummary({ playerUid: "u2", activity: { doneDateKeys: [TODAY] } }),
      ]),
      TODAY,
    );
    expect(activite.membresDonneesPartielles).toBe(2);
  });

  test("un membre sans fenêtre d'activité compte aussi comme partiel", () => {
    const activite = buildTodayActivity(vues([makeSummary({ activity: null })]), TODAY);
    expect(activite.membresAvecDonnees).toBe(0);
    expect(activite.membresDonneesPartielles).toBe(1);
  });

  test("le titre du vide change SEULEMENT quand il manque des données", () => {
    expect(buildTodayEmptyTitle(0)).toBe("Rien à vérifier aujourd'hui");
    expect(buildTodayEmptyTitle(3)).toBe("Rien à vérifier parmi les données disponibles");
    // Une valeur aberrante ne fabrique pas un titre nuancé.
    expect(buildTodayEmptyTitle(-2)).toBe("Rien à vérifier aujourd'hui");
  });

  test("la raison borne le constat sans le contredire", () => {
    const raison = buildTodayEmptyReason(8, 0, "joueur", 3);
    expect(raison).toContain("Aucun signal à lire sur 8 joueurs.");
    expect(raison).toContain("Une partie des données manque pour 3 joueurs");
    expect(raison).toContain("ce constat ne porte que sur ce qui a été transmis");
  });

  test("aucune phrase ajoutée quand rien ne manque", () => {
    expect(buildTodayEmptyReason(8, 0, "joueur", 0)).toBe("Aucun signal à lire sur 8 joueurs.");
  });

  test("les entrées d'attention portent le drapeau et un libellé nuancé", () => {
    const view = toCoachPlayerView(
      makeSummary({ activity: { doneDateKeys: ["2026-07-26"] } }),
      TODAY,
    );
    const [entree] = buildTodayAttentionEntries([view], TODAY);
    expect(entree.donneesPartielles).toBe(true);
    // Ce joueur n'a aucun signal : son libellé de statut est donc nuancé.
    expect(entree.statutLibelle).toBe("Rien à signaler parmi les données disponibles");
  });
});
