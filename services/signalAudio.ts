// services/signalAudio.ts
//
// Abstraction audio Signal FKS basée sur expo-audio.
//
// Les enregistrements FR réels (fondateur) sont présents sous
// `assets/audio/signal/fr/` : gauche.m4a / droite.m4a. Le registre ci-dessous
// pointe donc dessus. Ne JAMAIS y mettre un `require()` d'un fichier absent
// (cela casserait le bundling) — si un futur mot manque, laisser sa ligne
// commentée comme avant.
//
// Format des fichiers (voir assets/audio/signal/README.md) :
//   - assets/audio/signal/fr/gauche.m4a
//   - assets/audio/signal/fr/droite.m4a
//   AAC/m4a mono, ~44.1 kHz, voix claire, sans silence de tête.
//
// Signal FKS fonctionne 100% hors ligne (assets bundlés, aucun TTS réseau).
// Reste à passer FKS_SIGNAL_V1_ENABLED=true (app.json extra / EXPO_PUBLIC_FKS_SIGNAL_V1)
// pour activer la feature côté produit — hors scope de ce chantier.

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import type { SignalV1Cue } from "../engine/signal/signalConfig";

/** Source d'un asset expo (résultat d'un `require`). */
export type AudioAssetSource = number;

/** Fabrique de lecteur injectable (mock en test). */
export type AudioPlayerFactory = (source: AudioAssetSource) => AudioPlayer;

/**
 * Registre des assets vocaux FR. Ne JAMAIS y mettre un `require()` d'un fichier absent
 * (laisser la ligne commentée tant que le fichier n'est pas bundlé).
 */
export const SIGNAL_AUDIO_REGISTRY_FR: Partial<Record<SignalV1Cue, AudioAssetSource>> = {
  gauche: require("../assets/audio/signal/fr/gauche.m4a"),
  droite: require("../assets/audio/signal/fr/droite.m4a"),
};

export type SignalAudioLoadResult =
  | { ok: true }
  | { ok: false; code: "missing_audio_assets" };

export interface SignalAudioPlayer {
  /** Précharge les consignes ; erreur contrôlée si un asset manque. */
  preload: (cues: SignalV1Cue[]) => SignalAudioLoadResult;
  /** Joue une consigne (depuis le début). Peut throw → géré par le contrôleur. */
  play: (cue: SignalV1Cue) => void;
  /** Coupe tout son en cours. */
  stop: () => void;
  /** Libère les ressources natives. */
  release: () => void;
}

/** True si tous les assets requis sont réellement disponibles. */
export function areSignalAssetsAvailable(
  cues: SignalV1Cue[],
  registry: Partial<Record<SignalV1Cue, AudioAssetSource>> = SIGNAL_AUDIO_REGISTRY_FR
): boolean {
  return cues.length > 0 && cues.every((cue) => registry[cue] != null);
}

/**
 * Crée un lecteur audio Signal FKS. `factory` et `registry` sont injectables
 * pour les tests. Ne plante jamais l'app : renvoie une erreur contrôlée si un
 * asset manque, et `play`/`stop`/`release` sont tolérants aux joueurs absents.
 */
export function createSignalAudioPlayer(
  registry: Partial<Record<SignalV1Cue, AudioAssetSource>> = SIGNAL_AUDIO_REGISTRY_FR,
  factory: AudioPlayerFactory = createAudioPlayer
): SignalAudioPlayer {
  const players = new Map<SignalV1Cue, AudioPlayer>();

  return {
    preload(cues) {
      if (!areSignalAssetsAvailable(cues, registry)) {
        return { ok: false, code: "missing_audio_assets" };
      }
      for (const cue of cues) {
        if (!players.has(cue)) {
          players.set(cue, factory(registry[cue] as AudioAssetSource));
        }
      }
      return { ok: true };
    },
    play(cue) {
      const player = players.get(cue);
      if (!player) throw new Error("missing_audio_assets");
      // seekTo est async : on l'ignore volontairement (relecture immédiate).
      void player.seekTo(0);
      player.play();
    },
    stop() {
      players.forEach((player) => {
        try {
          player.pause();
        } catch {
          // lecteur déjà libéré : sans effet.
        }
      });
    },
    release() {
      players.forEach((player) => {
        try {
          player.remove();
        } catch {
          // idempotent.
        }
      });
      players.clear();
    },
  };
}
