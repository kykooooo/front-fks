// components/__tests__/SignalEntry.test.tsx
// Flag OFF par défaut (features non mocké) → V1 strictement préservée.
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("../../services/analytics", () => ({ trackEvent: jest.fn() }));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SignalEntry } from "../signal/SignalEntry";

const validCfg = {
  mode: "voice_direction" as const,
  cues: ["gauche", "droite"],
  minDelayMs: 2000,
  maxDelayMs: 5000,
};

describe("SignalEntry — flag désactivé", () => {
  it("ne rend RIEN quand le flag est désactivé, même avec un config valide", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <SignalEntry exerciseId="fks_backpedal_signal_sprint" signalConfig={validCfg} />
      );
    });
    expect(tree.toJSON()).toBeNull();
  });
});
