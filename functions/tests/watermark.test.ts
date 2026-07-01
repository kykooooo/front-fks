// functions/tests/watermark.test.ts
// Comparateur de watermark : ordre temporel lossless + tie-break déterministe.

import { explicitWatermark, incomingWins, readWatermark, watermarkFromEvent } from "../src/watermark";

describe("incomingWins", () => {
  it("temps plus récent gagne", () => {
    const older = explicitWatermark("2026-06-30T10:00:00.000Z", "a");
    const newer = explicitWatermark("2026-06-30T11:00:00.000Z", "a");
    expect(incomingWins(newer, older)).toBe(true);
    expect(incomingWins(older, newer)).toBe(false);
  });

  it("précision sous-milliseconde préservée (lossless, pas via Date.parse)", () => {
    // Ces deux instants tronquent à la MÊME ms via Date.parse, mais diffèrent en µs.
    const a = explicitWatermark("2026-06-30T10:00:00.000100Z", "x");
    const b = explicitWatermark("2026-06-30T10:00:00.000200Z", "x");
    expect(a.at).toBe(b.at); // Date.parse les rend égaux…
    expect(incomingWins(b, a)).toBe(true); // …mais le compare canonique distingue
    expect(incomingWins(a, b)).toBe(false);
  });

  it("temps égal → tie-break déterministe par id (le plus grand gagne)", () => {
    const t = "2026-06-30T10:00:00.000Z";
    const wa = explicitWatermark(t, "aaa");
    const wb = explicitWatermark(t, "bbb");
    // Quel que soit l'ordre d'arrivée, "bbb" gagne toujours.
    expect(incomingWins(wb, wa)).toBe(true);
    expect(incomingWins(wa, wb)).toBe(false);
  });

  it("rejeu EXACT (temps + id identiques) → perd (ordre strict, idempotent)", () => {
    const w = explicitWatermark("2026-06-30T10:00:00.000Z", "same");
    expect(incomingWins(w, w)).toBe(false);
  });

  it("doc legacy sans watermark → tout nouvel événement gagne", () => {
    const legacy = readWatermark({}); // pas de sourceEvent*
    const incoming = explicitWatermark("2026-06-30T10:00:00.000Z", "e");
    expect(incomingWins(incoming, legacy)).toBe(true);
  });

  it("watermarkFromEvent lit time + id du CloudEvent", () => {
    const wm = watermarkFromEvent({ time: "2026-06-30T10:00:00.000Z", id: "evt-123" });
    expect(wm.id).toBe("evt-123");
    expect(wm.time).toBe("2026-06-30T10:00:00.000Z");
    expect(wm.at).toBe(Date.parse("2026-06-30T10:00:00.000Z"));
  });
});
