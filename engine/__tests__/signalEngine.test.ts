// engine/__tests__/signalEngine.test.ts
// Moteur pur Signal FKS : timers simulés (scheduler injecté) + aléatoire injecté.
import {
  SignalEngine,
  type SignalEngineConfig,
  type SignalScheduler,
  type SignalSnapshot,
} from "../signal/signalEngine";

// Scheduler déterministe : enregistre les durées et permet d'avancer le temps.
function makeFakeScheduler() {
  let time = 0;
  let seq = 1;
  const tasks = new Map<number, { fn: () => void; at: number }>();
  const durations: number[] = [];

  const earliest = (): [number, { fn: () => void; at: number }] | null => {
    let best: [number, { fn: () => void; at: number }] | null = null;
    for (const entry of tasks) {
      if (!best || entry[1].at < best[1].at) best = entry;
    }
    return best;
  };

  const scheduler: SignalScheduler = {
    setTimeout: (fn, ms) => {
      const id = seq++;
      tasks.set(id, { fn, at: time + ms });
      durations.push(ms);
      return id;
    },
    clearTimeout: (id) => {
      tasks.delete(id);
    },
    now: () => time,
  };

  return {
    scheduler,
    durations,
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
    runAll(maxSteps = 5000) {
      let steps = 0;
      for (;;) {
        const next = earliest();
        if (!next || steps++ > maxSteps) break;
        time = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
    },
    pendingCount: () => tasks.size,
  };
}

// Sentinelles hors de la plage [min,max] pour isoler les délais "waiting".
const baseConfig = (over: Partial<SignalEngineConfig> = {}): SignalEngineConfig => ({
  repetitions: 3,
  countdownMs: 9000,
  minDelayMs: 500,
  maxDelayMs: 1500,
  recoveryMs: 7000,
  cueHoldMs: 8000,
  cues: ["gauche", "droite"],
  maxConsecutiveSame: 2,
  ...over,
});

const waitingDelays = (durations: number[]) =>
  durations.filter((d) => d >= 500 && d <= 1500);

describe("SignalEngine — délai aléatoire borné", () => {
  it("reste dans [min,max] pour rng=0 (borne basse)", () => {
    const fake = makeFakeScheduler();
    const engine = new SignalEngine(baseConfig(), {}, { rng: () => 0, scheduler: fake.scheduler });
    engine.start();
    fake.runAll();
    const delays = waitingDelays(fake.durations);
    expect(delays.length).toBe(3);
    expect(delays.every((d) => d === 500)).toBe(true);
  });

  it("reste dans [min,max] pour rng≈1 (borne haute)", () => {
    const fake = makeFakeScheduler();
    const engine = new SignalEngine(baseConfig(), {}, { rng: () => 0.999999, scheduler: fake.scheduler });
    engine.start();
    fake.runAll();
    const delays = waitingDelays(fake.durations);
    expect(delays.length).toBe(3);
    expect(delays.every((d) => d >= 500 && d <= 1500)).toBe(true);
    expect(delays.every((d) => d === 1500)).toBe(true);
  });
});

describe("SignalEngine — pas de 3 signaux identiques consécutifs", () => {
  it("casse une série de plus de 2 identiques (rng biaisé vers index 0)", () => {
    const fake = makeFakeScheduler();
    const cues: string[] = [];
    const engine = new SignalEngine(
      baseConfig({ repetitions: 8 }),
      { onCue: (cue) => cues.push(cue) },
      { rng: () => 0, scheduler: fake.scheduler }
    );
    engine.start();
    fake.runAll();
    expect(cues).toHaveLength(8);
    for (let i = 2; i < cues.length; i++) {
      expect(cues[i] === cues[i - 1] && cues[i - 1] === cues[i - 2]).toBe(false);
    }
  });
});

describe("SignalEngine — nombre exact de répétitions", () => {
  it("produit exactement `repetitions` signaux puis `completed`", () => {
    const fake = makeFakeScheduler();
    let completed = -1;
    let cueCount = 0;
    const engine = new SignalEngine(
      baseConfig({ repetitions: 4 }),
      { onCue: () => (cueCount += 1), onCompleted: (n) => (completed = n) },
      { rng: () => 0.3, scheduler: fake.scheduler }
    );
    engine.start();
    fake.runAll();
    expect(cueCount).toBe(4);
    expect(completed).toBe(4);
    expect(engine.getSnapshot().state).toBe("completed");
  });
});

describe("SignalEngine — enchaînement countdown → waiting → cue → recovery", () => {
  it("respecte l'ordre des états", () => {
    const fake = makeFakeScheduler();
    const states: SignalSnapshot["state"][] = [];
    const engine = new SignalEngine(
      baseConfig({ repetitions: 2 }),
      { onSnapshot: (s) => states.push(s.state) },
      { rng: () => 0, scheduler: fake.scheduler }
    );
    engine.start();
    fake.runAll();
    expect(states.slice(0, 4)).toEqual(["countdown", "waiting", "cue", "recovery"]);
    expect(states[states.length - 1]).toBe("completed");
  });
});

describe("SignalEngine — pause / reprise", () => {
  it("met en pause, conserve le temps restant et reprend", () => {
    const fake = makeFakeScheduler();
    const engine = new SignalEngine(
      baseConfig({ repetitions: 1 }),
      {},
      { rng: () => 0, scheduler: fake.scheduler }
    );
    engine.start();
    fake.advanceTime(9000); // fin countdown → waiting (délai 500)
    expect(engine.getSnapshot().state).toBe("waiting");
    fake.advanceTime(200); // 200/500 écoulés
    engine.pause();
    expect(engine.getSnapshot().state).toBe("paused");
    const before = fake.durations.length;
    engine.resume();
    // reprise : ré-arme le waiting avec le restant (300ms)
    expect(fake.durations[before]).toBe(300);
    fake.advanceTime(300);
    expect(engine.getSnapshot().state).toBe("cue");
  });
});

describe("SignalEngine — arrêt utilisateur", () => {
  it("revient à idle sans émettre completed", () => {
    const fake = makeFakeScheduler();
    let completedCalls = 0;
    const engine = new SignalEngine(
      baseConfig(),
      { onCompleted: () => (completedCalls += 1) },
      { rng: () => 0, scheduler: fake.scheduler }
    );
    engine.start();
    fake.advanceTime(9000);
    engine.stop();
    expect(engine.getSnapshot().state).toBe("idle");
    expect(fake.pendingCount()).toBe(0);
    fake.runAll();
    expect(completedCalls).toBe(0);
  });
});

describe("SignalEngine — nettoyage au démontage", () => {
  it("coupe les timers et n'émet plus rien après destroy", () => {
    const fake = makeFakeScheduler();
    let snapshots = 0;
    const engine = new SignalEngine(
      baseConfig(),
      { onSnapshot: () => (snapshots += 1) },
      { rng: () => 0, scheduler: fake.scheduler }
    );
    engine.start();
    fake.advanceTime(9000);
    const countBefore = snapshots;
    engine.destroy();
    expect(fake.pendingCount()).toBe(0);
    fake.runAll();
    expect(snapshots).toBe(countBefore);
  });
});

describe("SignalEngine — pas de mesure de temps de réaction", () => {
  it("le snapshot n'expose aucun champ de timing/perf", () => {
    const fake = makeFakeScheduler();
    const engine = new SignalEngine(baseConfig(), {}, { rng: () => 0, scheduler: fake.scheduler });
    const keys = Object.keys(engine.getSnapshot());
    expect(keys.sort()).toEqual(
      ["completedReps", "currentCue", "currentRep", "errorCode", "state", "totalReps"].sort()
    );
    expect(keys.some((k) => /react|rt|latency|time|score/i.test(k))).toBe(false);
  });
});
