// functions/tests/dto.test.ts
// Garde-fou anti-fuite `assertCoachSafe` (dernier rempart avant écriture).

import { assertCoachSafe } from "../src/dto";

describe("assertCoachSafe", () => {
  it("accepte une projection propre", () => {
    expect(() =>
      assertCoachSafe({
        playerUid: "p",
        firstName: "Anna",
        adaptation: { adapted: true, labels: ["Contrôle appuis et alignement"] },
        latestSession: { id: "s1", status: "done", durationMin: 40 },
      }),
    ).not.toThrow();
  });

  it("rejette une clé interdite en top-level", () => {
    expect(() => assertCoachSafe({ playerUid: "p", rpe: 8 })).toThrow(/rpe/i);
  });

  it("rejette une clé interdite imbriquée (dans un objet)", () => {
    expect(() => assertCoachSafe({ latestSession: { metrics: { tsb: -14 } } })).toThrow(/metrics/i);
  });

  it("rejette une clé interdite imbriquée dans un tableau", () => {
    expect(() => assertCoachSafe({ items: [{ ok: 1 }, { feedback: { pain: 3 } }] })).toThrow(/feedback/i);
  });

  it("rejette 'ai' et 'aiV2' (blueprints)", () => {
    expect(() => assertCoachSafe({ ai: {} })).toThrow(/ai/i);
    expect(() => assertCoachSafe({ aiV2: {} })).toThrow(/ai/i);
  });
});
