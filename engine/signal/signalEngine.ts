// engine/signal/signalEngine.ts
//
// Moteur pur Signal FKS V1 — AUCUNE dépendance à React ni à React Native / Expo.
// Machine à états déterministe, timers injectables (scheduler) et aléatoire
// injectable (rng) pour être testable avec des timers simulés.
//
// Flux d'une répétition : countdown → (par rep) waiting → cue → recovery → …
// La dernière répétition se termine sur le cue puis passe directement à
// `completed` (pas de récupération finale) ⇒ exactement `repetitions` signaux.

export type SignalCue = string;

export type SignalState =
  | "idle"
  | "countdown"
  | "waiting"
  | "cue"
  | "recovery"
  | "paused"
  | "completed"
  | "error";

/** Phases réellement minutées (sous-ensemble des états). */
type SignalPhase = "countdown" | "waiting" | "cue" | "recovery";

export interface SignalEngineConfig {
  /** Nombre exact de répétitions (signaux) à produire. */
  repetitions: number;
  /** Durée du compte à rebours initial (ms). */
  countdownMs: number;
  /** Délai aléatoire minimal avant un signal (ms). */
  minDelayMs: number;
  /** Délai aléatoire maximal avant un signal (ms). */
  maxDelayMs: number;
  /** Durée de récupération entre deux répétitions (ms). */
  recoveryMs: number;
  /** Durée d'affichage/maintien du signal avant la récupération (ms). */
  cueHoldMs: number;
  /** Consignes disponibles (ex: ["gauche", "droite"]). */
  cues: SignalCue[];
  /** Interdit plus de N signaux identiques consécutifs (V1 : 2). */
  maxConsecutiveSame: number;
}

export interface SignalSnapshot {
  state: SignalState;
  /** Répétition en cours (1-based) ; 0 tant que rien n'a démarré. */
  currentRep: number;
  totalReps: number;
  /** Signaux effectivement délivrés. */
  completedReps: number;
  /** Consigne du signal en cours (uniquement pendant l'état `cue`). */
  currentCue: SignalCue | null;
  errorCode: string | null;
}

export interface SignalEngineCallbacks {
  onSnapshot?: (snapshot: SignalSnapshot) => void;
  onCue?: (cue: SignalCue, rep: number) => void;
  onCompleted?: (completedReps: number) => void;
  onError?: (code: string) => void;
}

export interface SignalScheduler {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  now: () => number;
}

const defaultScheduler: SignalScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export interface SignalEngineOptions {
  rng?: () => number;
  scheduler?: SignalScheduler;
}

const phaseToState: Record<SignalPhase, SignalState> = {
  countdown: "countdown",
  waiting: "waiting",
  cue: "cue",
  recovery: "recovery",
};

export class SignalEngine {
  private readonly config: SignalEngineConfig;
  private readonly callbacks: SignalEngineCallbacks;
  private readonly rng: () => number;
  private readonly scheduler: SignalScheduler;

  private state: SignalState = "idle";
  private phase: SignalPhase | null = null;
  private timerId: number | null = null;
  private phaseEndsAt = 0;
  private remainingMs = 0;
  private pausedPhase: SignalPhase | null = null;

  private currentRep = 0;
  private completedReps = 0;
  private currentCue: SignalCue | null = null;
  private errorCode: string | null = null;

  private cueHistory: SignalCue[] = [];
  private destroyed = false;

  constructor(
    config: SignalEngineConfig,
    callbacks: SignalEngineCallbacks = {},
    options: SignalEngineOptions = {}
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.rng = options.rng ?? Math.random;
    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  getSnapshot(): SignalSnapshot {
    return {
      state: this.state,
      currentRep: this.currentRep,
      totalReps: this.config.repetitions,
      completedReps: this.completedReps,
      currentCue: this.currentCue,
      errorCode: this.errorCode,
    };
  }

  start(): void {
    if (this.destroyed) return;
    if (this.state !== "idle") return;
    this.currentRep = 0;
    this.completedReps = 0;
    this.currentCue = null;
    this.errorCode = null;
    this.cueHistory = [];
    this.arm("countdown", this.config.countdownMs);
  }

  pause(): void {
    if (this.destroyed) return;
    if (this.phase == null || this.state === "paused") return;
    this.clearTimer();
    this.remainingMs = Math.max(0, this.phaseEndsAt - this.scheduler.now());
    this.pausedPhase = this.phase;
    this.phase = null;
    this.setState("paused");
  }

  resume(): void {
    if (this.destroyed) return;
    if (this.state !== "paused" || this.pausedPhase == null) return;
    const phase = this.pausedPhase;
    this.pausedPhase = null;
    this.arm(phase, this.remainingMs);
  }

  /** Arrêt utilisateur : nettoie et revient à `idle` (n'émet pas `completed`). */
  stop(): void {
    if (this.destroyed) return;
    this.clearTimer();
    this.phase = null;
    this.pausedPhase = null;
    this.currentCue = null;
    this.setState("idle");
  }

  /** Échec externe contrôlé (ex: audio) → état `error`. */
  fail(code: string): void {
    if (this.destroyed) return;
    this.clearTimer();
    this.phase = null;
    this.pausedPhase = null;
    this.currentCue = null;
    this.errorCode = code;
    this.setState("error");
    this.callbacks.onError?.(code);
  }

  /** Démontage : coupe tout, plus aucun callback ni timer ensuite. */
  destroy(): void {
    this.clearTimer();
    this.destroyed = true;
    this.phase = null;
    this.pausedPhase = null;
  }

  // ── interne ────────────────────────────────────────────────────────────────

  private clearTimer(): void {
    if (this.timerId != null) {
      this.scheduler.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private setState(state: SignalState): void {
    this.state = state;
    this.notify();
  }

  private notify(): void {
    if (this.destroyed) return;
    this.callbacks.onSnapshot?.(this.getSnapshot());
  }

  private arm(phase: SignalPhase, ms: number): void {
    this.clearTimer();
    this.phase = phase;
    this.phaseEndsAt = this.scheduler.now() + ms;
    this.setState(phaseToState[phase]);
    this.timerId = this.scheduler.setTimeout(() => {
      this.timerId = null;
      this.onPhaseEnd();
    }, ms);
  }

  private onPhaseEnd(): void {
    if (this.destroyed) return;
    switch (this.phase) {
      case "countdown":
        this.beginRep();
        break;
      case "waiting":
        this.fireCue();
        break;
      case "cue":
        this.afterCue();
        break;
      case "recovery":
        this.beginRep();
        break;
      default:
        break;
    }
  }

  private beginRep(): void {
    this.currentRep += 1;
    this.currentCue = null;
    this.arm("waiting", this.randomDelay());
  }

  private fireCue(): void {
    const cue = this.pickCue();
    this.currentCue = cue;
    this.completedReps += 1;
    this.arm("cue", this.config.cueHoldMs);
    // onCue après avoir armé l'état `cue` : le contrôleur joue l'audio.
    this.callbacks.onCue?.(cue, this.currentRep);
  }

  private afterCue(): void {
    this.currentCue = null;
    if (this.currentRep >= this.config.repetitions) {
      this.complete();
      return;
    }
    this.arm("recovery", this.config.recoveryMs);
  }

  private complete(): void {
    this.clearTimer();
    this.phase = null;
    this.setState("completed");
    this.callbacks.onCompleted?.(this.completedReps);
  }

  private randomDelay(): number {
    const span = Math.max(0, this.config.maxDelayMs - this.config.minDelayMs);
    const delay = this.config.minDelayMs + Math.floor(this.clampedRng() * (span + 1));
    return Math.min(this.config.maxDelayMs, Math.max(this.config.minDelayMs, delay));
  }

  private pickCue(): SignalCue {
    const limit = Math.max(1, this.config.maxConsecutiveSame);
    let pool = this.config.cues;
    if (this.cueHistory.length >= limit) {
      const lastN = this.cueHistory.slice(-limit);
      if (lastN.every((c) => c === lastN[0])) {
        const filtered = this.config.cues.filter((c) => c !== lastN[0]);
        if (filtered.length > 0) pool = filtered;
      }
    }
    const idx = Math.min(pool.length - 1, Math.floor(this.clampedRng() * pool.length));
    const cue = pool[idx];
    this.cueHistory.push(cue);
    return cue;
  }

  private clampedRng(): number {
    const r = this.rng();
    if (!Number.isFinite(r)) return 0;
    return Math.min(0.9999999, Math.max(0, r));
  }
}
