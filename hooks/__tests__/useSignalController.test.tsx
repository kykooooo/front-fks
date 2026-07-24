// hooks/__tests__/useSignalController.test.tsx
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("../../services/analytics", () => ({ trackEvent: jest.fn() }));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState } from "react-native";
import { trackEvent } from "../../services/analytics";
import {
  useSignalController,
  type SignalControllerApi,
  type UseSignalControllerParams,
} from "../useSignalController";
import type { SignalEngineConfig, SignalScheduler } from "../../engine/signal/signalEngine";
import type { SignalAudioPlayer } from "../../services/signalAudio";

const trackEventMock = trackEvent as jest.Mock;

function makeFakeScheduler() {
  let time = 0;
  let seq = 1;
  const tasks = new Map<number, { fn: () => void; at: number }>();
  const earliest = () => {
    let best: [number, { fn: () => void; at: number }] | null = null;
    for (const e of tasks) if (!best || e[1].at < best[1].at) best = e;
    return best;
  };
  const scheduler: SignalScheduler = {
    setTimeout: (fn, ms) => {
      const id = seq++;
      tasks.set(id, { fn, at: time + ms });
      return id;
    },
    clearTimeout: (id) => void tasks.delete(id),
    now: () => time,
  };
  return {
    scheduler,
    advanceTime(ms: number) {
      const target = time + ms;
      for (;;) {
        const next = earliest();
        if (next && next[1].at <= target) {
          time = next[1].at;
          tasks.delete(next[0]);
          next[1].fn();
        } else break;
      }
      time = target;
    },
    runAll(max = 5000) {
      let n = 0;
      for (;;) {
        const next = earliest();
        if (!next || n++ > max) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
    },
  };
}

const engineConfig: SignalEngineConfig = {
  repetitions: 2,
  countdownMs: 1000,
  minDelayMs: 500,
  maxDelayMs: 500,
  recoveryMs: 1000,
  cueHoldMs: 400,
  cues: ["gauche", "droite"],
  maxConsecutiveSame: 2,
};

function mountController(overrides: Partial<UseSignalControllerParams> & { audio?: SignalAudioPlayer }) {
  const fake = makeFakeScheduler();
  const audio: SignalAudioPlayer =
    overrides.audio ?? {
      preload: jest.fn(() => ({ ok: true }) as const),
      play: jest.fn(),
      stop: jest.fn(),
      release: jest.fn(),
    };
  let api!: SignalControllerApi;
  function Harness() {
    api = useSignalController({
      engineConfig,
      exerciseId: "fks_backpedal_signal_sprint",
      catalogVersion: "2.0.0-draft",
      createAudio: () => audio,
      assetsAvailable: () => true,
      engineOptions: { rng: () => 0, scheduler: fake.scheduler },
      ...overrides,
    });
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });
  return { get: () => api, fake, audio, renderer };
}

beforeEach(() => {
  trackEventMock.mockClear();
});

describe("useSignalController — analytics", () => {
  it("émet started puis completed sur une séquence complète", () => {
    const { get, fake } = mountController({});
    act(() => get().start());
    expect(trackEventMock).toHaveBeenCalledWith(
      "signal_fks_started",
      expect.objectContaining({ exercise_id: "fks_backpedal_signal_sprint", planned_repetitions: 2 })
    );
    act(() => fake.runAll());
    expect(trackEventMock).toHaveBeenCalledWith(
      "signal_fks_completed",
      expect.objectContaining({ completed_repetitions: 2, planned_repetitions: 2 })
    );
  });

  it("émet abandoned sur arrêt utilisateur en cours", () => {
    const { get, fake } = mountController({});
    act(() => get().start());
    act(() => fake.advanceTime(1000)); // → waiting
    act(() => get().stop());
    expect(trackEventMock).toHaveBeenCalledWith(
      "signal_fks_abandoned",
      expect.objectContaining({ exercise_id: "fks_backpedal_signal_sprint" })
    );
  });

  it("ne transmet jamais de temps de réaction ni de score", () => {
    const { get, fake } = mountController({});
    act(() => get().start());
    act(() => fake.runAll());
    for (const call of trackEventMock.mock.calls) {
      const props = call[1] ?? {};
      for (const key of Object.keys(props)) {
        expect(/react|rt|latency|elapsed|time|score/i.test(key)).toBe(false);
      }
    }
  });
});

describe("useSignalController — erreur audio", () => {
  it("bascule en erreur audio_error si la lecture échoue", () => {
    const audio: SignalAudioPlayer = {
      preload: jest.fn(() => ({ ok: true }) as const),
      play: jest.fn(() => {
        throw new Error("boom");
      }),
      stop: jest.fn(),
      release: jest.fn(),
    };
    const { get, fake } = mountController({ audio });
    act(() => get().start());
    act(() => fake.runAll());
    expect(get().snapshot.state).toBe("error");
    expect(get().snapshot.errorCode).toBe("audio_error");
    expect(trackEventMock).toHaveBeenCalledWith(
      "signal_fks_error",
      expect.objectContaining({ error_code: "audio_error" })
    );
  });

  it("refuse de démarrer et signale missing_audio_assets si assets absents", () => {
    const { get } = mountController({ assetsAvailable: () => false });
    act(() => get().start());
    expect(get().snapshot.state).toBe("error");
    expect(get().snapshot.errorCode).toBe("missing_audio_assets");
    expect(trackEventMock).not.toHaveBeenCalledWith("signal_fks_started", expect.anything());
  });
});

describe("useSignalController — arrière-plan", () => {
  it("met en pause et coupe le son au passage en background", () => {
    const handlers: ((s: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event: any, cb: any) => {
        handlers.push(cb);
        return { remove: jest.fn() } as any;
      });

    const { get, fake, audio } = mountController({});
    act(() => get().start());
    act(() => fake.advanceTime(1000)); // → waiting
    act(() => handlers.forEach((h) => h("background")));

    expect(get().snapshot.state).toBe("paused");
    expect(audio.stop).toHaveBeenCalled();
    spy.mockRestore();
  });
});
