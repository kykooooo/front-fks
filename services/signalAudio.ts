// services/signalAudio.ts
//
// Abstraction audio Signal FKS basée sur expo-audio.
//
// IMPORTANT : la V1 ne contient encore AUCUN fichier vocal réel. Le registre est
// donc volontairement VIDE — on ne fait aucun `require()` d'un fichier absent
// (ce qui casserait le bundling). Quand les vrais enregistrements français seront
// ajoutés sous `assets/audio/signal/fr/`, décommenter les lignes du registre.
//
// Format attendu des futurs fichiers (voir assets/audio/signal/README.md) :
//   - assets/audio/signal/fr/gauche.m4a
//   - assets/audio/signal/fr/droite.m4a
//   AAC/m4a mono, ~44.1 kHz, < 1 s, voix claire, sans silence de tête.
//
// Signal FKS fonctionnera 100% hors ligne une fois ces fichiers présents
// (assets bundlés, aucun TTS réseau).

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import type { SignalV1Cue } from "../engine/signal/signalConfig";

/** Source d'un asset expo (résultat d'un `require`). */
export type AudioAssetSource = number;

/** Fabrique de lecteur injectable (mock en test). */
export type AudioPlayerFactory = (source: AudioAssetSource) => AudioPlayer;

/**
 * Registre des assets vocaux FR. VIDE tant que les fichiers réels n'existent pas.
 * Ne JAMAIS y mettre un `require()` d'un fichier absent.
 */
export const SIGNAL_AUDIO_REGISTRY_FR: Partial<Record<SignalV1Cue, AudioAssetSource>> = {
  // gauche: require("../assets/audio/signal/fr/gauche.m4a"),
  // droite: require("../assets/audio/signal/fr/droite.m4a"),
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
