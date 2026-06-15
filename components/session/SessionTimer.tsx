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
    const secRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getSeconds: () => secRef.current,
        setSeconds: (value: number) => {
          const next = Math.max(0, Math.round(value));
          secRef.current = next;
          setSec(next);
        },
        reset: () => {
          secRef.current = 0;
          setSec(0);
        },
      }),
      []
    );

    useEffect(() => {
      if (!running) return;
      intervalRef.current = setInterval(() => {
        setSec((prev) => {
          const next = prev + 1;
          if (maxSec != null && next >= maxSec) {
            onReachMax?.();
            return prev;
          }
          secRef.current = next;
          return next;
        });
      }, 1000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [running, maxSec, onReachMax]);

    return <Text style={style}>{formatTime(sec)}</Text>;
  }
);
