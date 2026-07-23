import { resolveSessionHeading } from "../sessionHeading";

describe("resolveSessionHeading", () => {
  it("uses sessionTheme as heading and relegates title to detail when both present", () => {
    const result = resolveSessionHeading({
      title: "Explose tes démarrages",
      sessionTheme: "Construis les jambes qui font la différence",
    });
    expect(result.heading).toBe("Construis les jambes qui font la différence");
    expect(result.detail).toBe("Explose tes démarrages");
  });

  it("supports snake_case session_theme (raw backend payload)", () => {
    const result = resolveSessionHeading({
      title: "Séance Force",
      session_theme: "Prévention & appuis",
    });
    expect(result.heading).toBe("Prévention & appuis");
    expect(result.detail).toBe("Séance Force");
  });

  it("falls back to title when sessionTheme is absent (unchanged legacy behavior)", () => {
    const result = resolveSessionHeading({ title: "Footing Z2" });
    expect(result.heading).toBe("Footing Z2");
    expect(result.detail).toBeNull();
  });

  it("falls back to title when sessionTheme is null", () => {
    const result = resolveSessionHeading({ title: "Footing Z2", sessionTheme: null });
    expect(result.heading).toBe("Footing Z2");
    expect(result.detail).toBeNull();
  });

  it("falls back to title when sessionTheme is an empty/blank string", () => {
    const result = resolveSessionHeading({ title: "Footing Z2", sessionTheme: "   " });
    expect(result.heading).toBe("Footing Z2");
    expect(result.detail).toBeNull();
  });

  it("does not duplicate detail when title and sessionTheme are identical", () => {
    const result = resolveSessionHeading({
      title: "Récupération active",
      sessionTheme: "Récupération active",
    });
    expect(result.heading).toBe("Récupération active");
    expect(result.detail).toBeNull();
  });

  it("uses the provided fallback when both title and sessionTheme are absent", () => {
    const result = resolveSessionHeading({}, "Séance personnalisée");
    expect(result.heading).toBe("Séance personnalisée");
    expect(result.detail).toBeNull();
  });

  it("uses the default fallback ('Séance FKS') when no fallback is given", () => {
    const result = resolveSessionHeading(null);
    expect(result.heading).toBe("Séance FKS");
    expect(result.detail).toBeNull();
  });

  it("trims whitespace on both title and sessionTheme", () => {
    const result = resolveSessionHeading({
      title: "  Explose tes démarrages  ",
      sessionTheme: "  Construis les jambes  ",
    });
    expect(result.heading).toBe("Construis les jambes");
    expect(result.detail).toBe("Explose tes démarrages");
  });

  it("keeps the fallback FKS honest — the safe fallback session never reaches this helper with a session_theme override that hides 'Fallback FKS'", () => {
    // Le fallback FKS (screens/newSession/fallback.ts) émet title="Fallback FKS"
    // sans sessionTheme : le heading reste honnête, pas de régression.
    const result = resolveSessionHeading({ title: "Fallback FKS" });
    expect(result.heading).toBe("Fallback FKS");
    expect(result.detail).toBeNull();
  });
});
