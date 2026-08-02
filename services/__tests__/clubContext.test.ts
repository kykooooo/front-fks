// services/__tests__/clubContext.test.ts
//
// `buildClubContextPayload` : ce qui part vers le backend de génération, et
// surtout ce qui n'en part plus.
//
// ─── LA SONDE HOSTILE ───────────────────────────────────────────────────────
// Ces tests n'affirment pas « la clé `note` est absente ». Une clé peut changer
// de nom, être recopiée dans un champ voisin, ou se retrouver concaténée dans
// une chaîne. On INJECTE donc un texte manifestement sensible dans le document
// source, puis on cherche ce texte — et chacun de ses mots — dans le payload
// SÉRIALISÉ EN ENTIER. Une fuite par renommage, par duplication ou par
// concaténation tombe de la même façon.
//
// Le pendant positif est indispensable, sinon on prouverait seulement qu'on a
// tout stérilisé : une DIRECTIVE, elle, DOIT arriver mot pour mot.

import { buildClubContextPayload, buildClubDirectivePayload } from "../aiContextHelpers";

// ─── Textes injectés ────────────────────────────────────────────────────────
// Écrits comme un coach les écrirait réellement dans un pense-bête : un nom de
// blessure, une zone corporelle, un jugement personnel. Aucune donnée réelle.
const NOTE_SENSIBLE =
  "Rachid tendinite rotulienne genou droit, il se plaint tout le temps, ne pas le titulariser";
const MOTS_SENSIBLES = [
  "Rachid",
  "tendinite",
  "rotulienne",
  "genou",
  "plaint",
  "titulariser",
];

const TODAY = "2026-07-27";

/** Tout le payload, sérialisé : clés ET valeurs, à n'importe quelle profondeur. */
const serialise = (value: unknown) => JSON.stringify(value ?? null);

/** Directive valide et applicable le jour `TODAY`. */
const directiveValide = (over: Record<string, unknown> = {}) => ({
  objective: "prevention",
  instruction: "On garde les appuis, personne ne force sur les frappes",
  validFrom: "2026-07-20",
  validUntil: "2026-08-10",
  active: true,
  createdBy: "coachA",
  ...over,
});

// ────────────────────────────────────────────────────────────────────────────
describe("buildClubContextPayload — le cadre de semaine part toujours", () => {
  test("doc complet → payload complet (avec week_key)", () => {
    const payload = buildClubContextPayload(
      { trainingIntensity: "heavy", weekGoal: "freshness" },
      "2026-06-01",
    );
    expect(payload).toEqual({
      training_intensity: "heavy",
      week_goal: "freshness",
      week_key: "2026-06-01",
    });
  });

  test("seulement l'intensité → pas de week_goal", () => {
    const payload = buildClubContextPayload({ trainingIntensity: "light" }, "2026-06-01");
    expect(payload).toEqual({ training_intensity: "light", week_key: "2026-06-01" });
  });

  test("valeurs invalides → null (jamais d'invention)", () => {
    expect(buildClubContextPayload({ trainingIntensity: "brutal", weekGoal: "muscu" })).toBeNull();
  });

  test("doc absent → null (ne casse pas la génération)", () => {
    expect(buildClubContextPayload(null)).toBeNull();
    expect(buildClubContextPayload(undefined)).toBeNull();
  });

  test("match du week-end conservé : ce n'est pas une donnée privée", () => {
    const payload = buildClubContextPayload(
      { trainingIntensity: "normal", weekGoal: "speed", matchThisWeekend: true },
      "2026-06-01",
    );
    expect(payload?.match_this_weekend).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("SONDE HOSTILE — la note privée ne traverse AUCUN canal de génération", () => {
  test("une note sensible dans le doc source n'apparaît NULLE PART dans le payload", () => {
    const payload = buildClubContextPayload(
      { trainingIntensity: "heavy", weekGoal: "freshness", note: NOTE_SENSIBLE },
      "2026-06-01",
    );

    // Le cadre part normalement : on ne prouve pas l'étanchéité en cassant tout.
    expect(payload).toEqual({
      training_intensity: "heavy",
      week_goal: "freshness",
      week_key: "2026-06-01",
    });

    const brut = serialise(payload);
    expect(brut).not.toContain(NOTE_SENSIBLE);
    // Chaque mot séparément : attrape une fuite tronquée ou reformatée.
    for (const mot of MOTS_SENSIBLES) expect(brut).not.toContain(mot);
    // Et le nom de clé lui-même a disparu du contrat.
    expect(brut).not.toContain("note");
  });

  test("un renommage du champ source ne rouvre rien (nothing-in, nothing-out)", () => {
    // Variantes qu'un document ancien ou un client tiers pourrait porter.
    for (const cle of ["note", "coachNote", "notes", "staffNote", "privateNote"]) {
      const payload = buildClubContextPayload(
        { trainingIntensity: "normal", weekGoal: "speed", [cle]: NOTE_SENSIBLE },
        "2026-06-01",
      );
      const brut = serialise(payload);
      expect(brut).not.toContain(NOTE_SENSIBLE);
      for (const mot of MOTS_SENSIBLES) expect(brut).not.toContain(mot);
    }
  });

  test("la note ne se faufile pas non plus via l'objet directive", () => {
    // Tentative franche : on colle la note dans chaque champ de la directive.
    const payload = buildClubContextPayload(
      { trainingIntensity: "normal", weekGoal: "speed", note: NOTE_SENSIBLE },
      "2026-06-01",
      {
        todayKey: TODAY,
        directive: directiveValide({ note: NOTE_SENSIBLE, comment: NOTE_SENSIBLE }),
      },
    );
    const brut = serialise(payload);
    expect(payload?.directive).toBeDefined(); // la directive est bien passée
    expect(brut).not.toContain(NOTE_SENSIBLE);
    for (const mot of MOTS_SENSIBLES) expect(brut).not.toContain(mot);
  });

  test("aucune note ne sort même quand le cadre est vide (payload null)", () => {
    const payload = buildClubContextPayload({ note: NOTE_SENSIBLE }, "2026-06-01");
    expect(payload).toBeNull();
    expect(serialise(payload)).not.toContain("Rachid");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("PENDANT POSITIF — la directive, elle, DOIT arriver au backend", () => {
  test("directive active et valide → transmise mot pour mot", () => {
    const payload = buildClubContextPayload(
      { trainingIntensity: "normal", weekGoal: "speed" },
      "2026-07-27",
      { todayKey: TODAY, directive: directiveValide() },
    );
    expect(payload?.directive).toEqual({
      objective: "prevention",
      instruction: "On garde les appuis, personne ne force sur les frappes",
      valid_from: "2026-07-20",
      valid_until: "2026-08-10",
    });
    // Le cadre de semaine n'est pas écrasé par la directive : les deux coexistent.
    expect(payload?.training_intensity).toBe("normal");
    expect(payload?.week_goal).toBe("speed");
  });

  test("une directive suffit à produire un contexte club, même sans cadre", () => {
    const payload = buildClubContextPayload(null, "2026-07-27", {
      todayKey: TODAY,
      directive: directiveValide(),
    });
    expect(payload?.directive?.objective).toBe("prevention");
    expect(payload?.week_key).toBe("2026-07-27");
  });

  test("directive LEVÉE (active: false) → jamais transmise", () => {
    const payload = buildClubContextPayload({ weekGoal: "speed" }, "2026-07-27", {
      todayKey: TODAY,
      directive: directiveValide({ active: false }),
    });
    expect(payload?.directive).toBeUndefined();
  });

  test("directive EXPIRÉE ou pas encore commencée → jamais transmise", () => {
    const expiree = buildClubDirectivePayload(
      directiveValide({ validFrom: "2026-06-01", validUntil: "2026-06-30" }),
      TODAY,
    );
    expect(expiree).toBeUndefined();

    const future = buildClubDirectivePayload(
      directiveValide({ validFrom: "2026-09-01", validUntil: "2026-09-30" }),
      TODAY,
    );
    expect(future).toBeUndefined();
  });

  test("objectif hors allowlist → directive refusée en entier (pas de moitié de consigne)", () => {
    expect(buildClubDirectivePayload(directiveValide({ objective: "muscu" }), TODAY)).toBeUndefined();
  });

  test("consigne vide → directive refusée (une directive sans consigne n'existe pas)", () => {
    expect(buildClubDirectivePayload(directiveValide({ instruction: "   " }), TODAY)).toBeUndefined();
  });

  test("consigne trop longue → tronquée à la borne du domaine, jamais rejetée en silence", () => {
    const payload = buildClubDirectivePayload(
      directiveValide({ instruction: "x".repeat(500) }),
      TODAY,
    );
    expect(payload?.instruction.length).toBe(160);
  });

  test("sans jour de référence, aucune directive n'est transmise (fail-closed)", () => {
    expect(buildClubDirectivePayload(directiveValide(), undefined)).toBeUndefined();
    expect(buildClubDirectivePayload(directiveValide(), null)).toBeUndefined();
  });
});
