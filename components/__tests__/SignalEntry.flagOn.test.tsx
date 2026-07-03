// components/__tests__/SignalEntry.flagOn.test.tsx
// Flag Signal FKS forcé ON pour ce fichier uniquement (mock top-level, hoisté).
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("../../services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../../config/features", () => ({
  FKS_SIGNAL_V1_ENABLED: true,
  FKS_CATALOG_V2_ENABLED: false,
}));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SignalEntry } from "../signal/SignalEntry";

const validCfg = {
  mode: "voice_direction" as const,
  cues: ["gauche", "droite"],
  minDelayMs: 2000,
  maxDelayMs: 5000,
};

describe("SignalEntry — flag activé", () => {
  it("assets absents → chip passive claire, aucun bouton de lancement", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <SignalEntry exerciseId="fks_late_gate_choice" signalConfig={validCfg} />
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("bientôt disponible");
    expect(json).not.toContain("Lancer Signal FKS");
  });

  it("exercice non compatible → rien", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <SignalEntry exerciseId="str_back_squat" signalConfig={validCfg} />
      );
    });
    expect(tree.toJSON()).toBeNull();
  });

  it("signalConfig invalide (color_gate) → rien", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <SignalEntry
          exerciseId="fks_late_gate_choice"
          signalConfig={{ ...validCfg, mode: "color_gate" }}
        />
      );
    });
    expect(tree.toJSON()).toBeNull();
  });
});
