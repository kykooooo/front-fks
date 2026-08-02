// domain/__tests__/clubDataDisclosure.test.ts
//
// LA DIVULGATION DIT-ELLE LA VÉRITÉ ?
//
// Une divulgation qui décrit un contrat périmé est pire qu'une absence de
// divulgation : elle rassure à tort. Cette suite l'arrime au contrat coach-safe
// RÉEL, celui que le front reçoit et affiche au coach.
//
// Trois verrous :
//  1. COUVERTURE — chaque champ réellement projeté est annoncé, et rien n'est
//     annoncé qui n'existe pas. `parseCoachPlayerSummary` sert de source de
//     vérité exécutable (on lui donne une projection riche et on lit ses clés) ;
//  2. INTERDITS — les catégories que Kyllian a explicitement voulu voir nommées
//     (douleur, fatigue, zone corporelle, commentaire libre, ressenti, note
//     privée) figurent bien du côté « jamais transmis » ;
//  3. TON — langage simple : ni juridique, ni médical, ni menaçant, et jamais
//     une phrase qui laisse croire qu'il faut demander l'autorisation de
//     rejoindre un club.

import {
  CLUB_DISCLOSURE,
  CLUB_DISCLOSURE_COVERED_KEYS,
  CLUB_DISCLOSURE_NEVER,
  CLUB_DISCLOSURE_SHARED,
  clubDisclosureTexts,
} from "../clubDataDisclosure";
import { parseCoachPlayerSummary } from "../coachSummary";

/**
 * Projection VOLONTAIREMENT COMPLÈTE : tous les champs optionnels sont fournis,
 * pour que `parseCoachPlayerSummary` produise le contrat maximal. Si un champ
 * manquait ici, la couverture serait mesurée sur un contrat tronqué.
 */
const PROJECTION_COMPLETE = {
  playerUid: "p1",
  firstName: "Anna",
  ageCategory: "U15",
  position: "Milieu",
  level: "Regional",
  profileComplete: true,
  latestSession: {
    dateKey: "2026-06-28",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
    status: "done",
  },
  lastActivity: { dateKey: "2026-06-28", durationMin: 40 },
  adaptation: { adapted: true, labels: ["Contrôle appuis et alignement"] },
  activity: { doneDateKeys: ["2026-06-28", "2026-06-25"] },
  lastPlanned: {
    dateKey: "2026-07-02",
    title: "Séance vitesse",
    focusLabel: "Vitesse",
    intensityLabel: "Intense",
    durationMin: 35,
    blockCount: 3,
  },
  lastDone: {
    dateKey: "2026-06-28",
    title: "Séance renfo / force",
    focusLabel: "Renfo / Force",
    intensityLabel: "Modérée",
    durationMin: 40,
    blockCount: 4,
  },
  execution: {
    completionPct: 83,
    completionStatus: "partial",
    itemsDone: 9,
    itemsAdapted: 1,
    itemsSkipped: 1,
    itemsReplaced: 0,
    itemsReplacedEquivalent: 0,
    itemsReplacedPartial: 0,
    itemsTotal: 12,
    deviationLabels: ["Manque de temps", "Autre raison"],
  },
};

describe("1. couverture — la divulgation annonce EXACTEMENT ce qui est transmis", () => {
  const projete = parseCoachPlayerSummary(PROJECTION_COMPLETE);

  test("la projection de référence est bien lue (sinon le test ne prouve rien)", () => {
    expect(projete).not.toBeNull();
    expect(Object.keys(projete as object).length).toBeGreaterThanOrEqual(13);
  });

  test("AUCUN champ projeté n'est passé sous silence", () => {
    const clesProjetees = Object.keys(projete as object).sort();
    const manquantes = clesProjetees.filter((k) => !CLUB_DISCLOSURE_COVERED_KEYS.includes(k));
    // Message lisible en cas d'échec : le champ ajouté au contrat sans être
    // annoncé au joueur apparaît nommément.
    expect(manquantes).toEqual([]);
  });

  test("la divulgation n'annonce RIEN qui ne soit pas dans le contrat", () => {
    const clesProjetees = Object.keys(projete as object);
    const inventees = CLUB_DISCLOSURE_COVERED_KEYS.filter((k) => !clesProjetees.includes(k));
    expect(inventees).toEqual([]);
  });

  test("aucune clé n'est annoncée deux fois (une phrase, un périmètre)", () => {
    const toutes = CLUB_DISCLOSURE_SHARED.flatMap((i) => i.cles);
    expect(new Set(toutes).size).toBe(toutes.length);
  });
});

describe("2. interdits — les catégories sensibles sont nommées comme NON transmises", () => {
  const jamais = CLUB_DISCLOSURE_NEVER.join(" ").toLowerCase();

  test.each([
    ["douleur", "douleur"],
    ["zone corporelle", "zones du corps"],
    ["fatigue", "fatigue"],
    ["ressenti", "ressenti"],
    ["commentaire libre", "commentaires libres"],
    ["note privée", "notes perso"],
  ])("%s est explicitement listé comme non transmis", (_categorie, mot) => {
    expect(jamais).toContain(mot);
  });

  test("les chiffres de charge (RPE, forme, fraîcheur) sont couverts", () => {
    expect(jamais).toContain("effort ressenti");
    expect(jamais).toContain("forme");
    expect(jamais).toContain("fraîcheur");
  });

  test("aucun champ sensible n'a pu se glisser dans la projection lue", () => {
    // Contre-preuve : on injecte des champs sensibles dans la projection brute
    // et on vérifie que le parseur front ne les laisse PAS passer. C'est ce qui
    // rend la promesse « ton coach ne voit jamais ça » vérifiable ici, sans
    // dépendre du code serveur (testé de son côté, functions/tests/dto.test.ts).
    const pollue = parseCoachPlayerSummary({
      ...PROJECTION_COMPLETE,
      pain: 3,
      fatigue: 4,
      comment: "j'ai mal au genou",
      rpe: 8,
      tsb: -14.2,
    });
    for (const cle of ["pain", "fatigue", "comment", "rpe", "tsb"]) {
      expect(Object.keys(pollue as object)).not.toContain(cle);
    }
  });

  test("la nuance des raisons d'écart est dite, pas cachée", () => {
    // Les raisons SONT transmises, mais aplaties en « Autre raison ». Taire ce
    // point rendrait la ligne « ton coach ne voit jamais tes douleurs »
    // approximative.
    expect(CLUB_DISCLOSURE.note.toLowerCase()).toContain("autre raison");
    expect(CLUB_DISCLOSURE.note.toLowerCase()).toContain("pas transmise");
  });

  test("le côté « partagé » ne promet aucune donnée sensible par inadvertance", () => {
    const partage = CLUB_DISCLOSURE_SHARED.map((i) => i.texte).join(" ").toLowerCase();
    for (const mot of ["douleur", "fatigue", "blessure", "sommeil", "santé", "rpe"]) {
      expect(partage).not.toContain(mot);
    }
  });
});

describe("3. ton — simple, court, et sans rien exiger du joueur", () => {
  const textes = clubDisclosureTexts();
  const tout = textes.join(" ").toLowerCase();

  test("aucun vocabulaire juridique", () => {
    for (const mot of [
      "consentement",
      "rgpd",
      "données personnelles",
      "traitement",
      "responsable de traitement",
      "article",
      "conditions générales",
      "juridique",
      "légal",
    ]) {
      expect(tout).not.toContain(mot);
    }
  });

  test("aucun vocabulaire médical", () => {
    for (const mot of ["diagnostic", "pathologie", "médical", "symptôme", "thérapeut"]) {
      expect(tout).not.toContain(mot);
    }
  });

  test("ne demande jamais une autorisation ni une case à cocher", () => {
    for (const mot of ["j'accepte", "je consens", "coche", "obligatoire", "autorise"]) {
      expect(tout).not.toContain(mot);
    }
  });

  test("dit au joueur qu'il peut partir", () => {
    expect(CLUB_DISCLOSURE.sortie.toLowerCase()).toContain("quitter");
  });

  test("ce n'est pas un pavé : phrases courtes, texte total borné", () => {
    for (const t of textes) expect(t.length).toBeLessThanOrEqual(170);
    expect(tout.length).toBeLessThanOrEqual(900);
  });
});
