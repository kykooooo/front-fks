// hooks/useSignalController.ts
//
// Orchestration React de Signal FKS : relie le moteur pur, l'audio (expo-audio),
// AppState et l'analytics. Toute la logique de minuterie/état vit dans le moteur
// pur ; ce hook ne fait que câbler React + effets de bord.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  SignalEngine,
  type SignalEngineConfig,
  type SignalEngineOptions,
  type SignalSnapshot,
} from "../engine/signal/signalEngine";
import {
  areSignalAssetsAvailable,
  createSignalAudioPlayer,
  type SignalAudioPlayer,
} from "../services/signalAudio";
import type { SignalV1Cue } from "../engine/signal/signalConfig";
import {
  trackSignalAbandoned,
  trackSignalCompleted,
  trackSignalError,
  trackSignalStarted,
  type SignalAnalyticsContext,
} from "../services/signalAnalytics";

const RUNNING_STATES = new Set<SignalSnapshot["state"]>([
  "countdown",
  "waiting",
  "cue",
  "recovery",
  "paused",
]);

export type UseSignalControllerParams = {
  engineConfig: SignalEngineConfig;
  exerciseId: string;
  catalogVersion?: string | null;
  /** Injections de test. */
  createAudio?: () => SignalAudioPlayer;
  engineOptions?: SignalEngineOptions;
  /** Vérifie la disponibilité réelle des assets (injectable en test). */
  assetsAvailable?: (cues: SignalV1Cue[]) => boolean;
};

export type SignalControllerApi = {
  snapshot: SignalSnapshot;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

export function useSignalController(
  params: UseSignalControllerParams
): SignalControllerApi {
  const {
    engineConfig,
    exerciseId,
    catalogVersion = null,
    createAudio,
    engineOptions,
    assetsAvailable = areSignalAssetsAvailable,
  } = params;

  const cues = engineConfig.cues as SignalV1Cue[];
  const analyticsCtx = useMemo<SignalAnalyticsContext>(
    () => ({
      exercise_id: exerciseId,
      catalog_version: catalogVersion,
      planned_repetitions: engineConfig.repetitions,
    }),
    [exerciseId, catalogVersion, engineConfig.repetitions]
  );

  const audioRef = useRef<SignalAudioPlayer | null>(null);
  const engineRef = useRef<SignalEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SignalSnapshot>(() => ({
    state: "idle",
    currentRep: 0,
    totalReps: engineConfig.repetitions,
    completedReps: 0,
    currentCue: null,
    errorCode: null,
  }));

  // Création moteur + audio au montage (refs écrites dans un effet, pas pendant
  // le render). Nettoyage complet au démontage : coupe timers + libère l'audio.
  useEffect(() => {
    const audio = (createAudio ?? createSignalAudioPlayer)();
    const engine = new SignalEngine(
      engineConfig,
      {
        onSnapshot: setSnapshot,
        onCue: (cue) => {
          try {
            audio.play(cue as SignalV1Cue);
          } catch {
            engineRef.current?.fail("audio_error");
          }
        },
        onCompleted: (completed) => {
          audio.stop();
          trackSignalCompleted({ ...analyticsCtx, completed_repetitions: completed });
        },
        onError: (code) => {
          audio.stop();
          trackSignalError({
            ...analyticsCtx,
            error_code: code,
            completed_repetitions: engineRef.current?.getSnapshot().completedReps ?? 0,
          });
        },
      },
      engineOptions
    );
    audioRef.current = audio;
    engineRef.current = engine;
    return () => {
      engine.destroy();
      audio.release();
    };
    // Setup unique : les props du contrôleur sont stables sur sa durée de vie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    const engine = engineRef.current;
    const audio = audioRef.current;
    if (!engine || !audio) return;
    if (!assetsAvailable(cues)) {
      // Pas de séquence : erreur contrôlée, aucun fallback réseau.
      engine.fail("missing_audio_assets");
      return;
    }
    const loaded = audio.preload(cues);
    if (!loaded.ok) {
      engine.fail(loaded.code);
      return;
    }
    trackSignalStarted(analyticsCtx);
    engine.start();
  }, [assetsAvailable, cues, analyticsCtx]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    audioRef.current?.stop();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const before = engine.getSnapshot();
    audioRef.current?.stop();
    engine.stop();
    if (RUNNING_STATES.has(before.state)) {
      trackSignalAbandoned({
        ...analyticsCtx,
        completed_repetitions: before.completedReps,
      });
    }
  }, [analyticsCtx]);

  // Arrière-plan → pause immédiate, jamais de reprise automatique.
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        engineRef.current?.pause();
        audioRef.current?.stop();
      }
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, []);

  return { snapshot, start, pause, resume, stop };
}
