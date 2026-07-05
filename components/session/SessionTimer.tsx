// components/session/SessionTimer.tsx
// Affichage isolé du chrono de séance.
// Détient son propre state + interval pour que le tick (1/s) ne redessine QUE
// l'horloge, et pas l'arbre parent (FlatList / cartes de bloc).
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

export type SessionTimerHandle = {
  /** Lecture synchrone du nombre de secondes courant (sans re-render). */
  getSeconds: () => number;
  /** Force une valeur (ex : reprise d'une séance sauvegardée). */
  setSeconds: (value: number) => void;
  /** Remet le chrono à zéro. */
  reset: () => void;
};

type Props = {
  /** Le chrono avance tant que `running` est vrai (contrôlé par le parent). */
  running: boolean;
  /** Plafond de sécurité optionnel (en secondes). */
  maxSec?: number;
  /** Appelé quand le plafond est atteint (le parent met `running` à false). */
  onReachMax?: () => void;
  style?: StyleProp<TextStyle>;
};

const pad = (n: number) => Math.floor(n).toString().padStart(2, "0");
const formatTime = (total: number) => `${pad(total / 60)}:${pad(total % 60)}`;

export const SessionTimer = forwardRef<SessionTimerHandle, Props>(
  function SessionTimer({ running, maxSec, onReachMax, style }, ref) {
    const [sec, setSec] = useState(0);
    // Chrono basé sur l'horloge réelle (Date.now) et non sur un compteur
    // incrémental : les setInterval JS sont suspendus en arrière-plan /
    // écran verrouillé, le temps réel doit quand même être compté.
    const baseSecRef = useRef(0);
    const runningSinceRef = useRef<number | null>(null);
    const maxReachedRef = useRef(false);

    const computeSeconds = () => {
      const runningPart =
        runningSinceRef.current != null ? (Date.now() - runningSinceRef.current) / 1000 : 0;
      return baseSecRef.current + runningPart;
    };

    useImperativeHandle(
      ref,
      () => ({
        getSeconds: () => Math.floor(computeSeconds()),
        setSeconds: (value: number) => {
          const next = Math.max(0, Math.round(value));
          baseSecRef.current = next;
          if (runningSinceRef.current != null) runningSinceRef.current = Date.now();
          maxReachedRef.current = false;
          setSec(next);
        },
        reset: () => {
          baseSecRef.current = 0;
          if (runningSinceRef.current != null) runningSinceRef.current = Date.now();
          maxReachedRef.current = false;
          setSec(0);
        },
      }),
      []
    );

    useEffect(() => {
      if (!running) return;
      runningSinceRef.current = Date.now();
      const tick = () => {
        let next = computeSeconds();
        if (maxSec != null && next >= maxSec) {
          next = maxSec;
          if (!maxReachedRef.current) {
            maxReachedRef.current = true;
            onReachMax?.();
          }
        }
        setSec(Math.floor(next));
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => {
        clearInterval(id);
        // Fige le temps accumulé à la pause (borné au plafond éventuel).
        const stopped = Math.floor(computeSeconds());
        baseSecRef.current = maxSec != null ? Math.min(stopped, maxSec) : stopped;
        runningSinceRef.current = null;
      };
    }, [running, maxSec, onReachMax]);

    return <Text style={style}>{formatTime(sec)}</Text>;
  }
);
