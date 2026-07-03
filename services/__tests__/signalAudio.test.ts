// services/__tests__/signalAudio.test.ts
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));

import {
  areSignalAssetsAvailable,
  createSignalAudioPlayer,
  SIGNAL_AUDIO_REGISTRY_FR,
} from "../signalAudio";

const mkPlayer = () => ({
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  remove: jest.fn(),
});

describe("areSignalAssetsAvailable", () => {
  it("false si le registre est vide (aucun vrai fichier vocal en V1)", () => {
    expect(areSignalAssetsAvailable(["gauche", "droite"], SIGNAL_AUDIO_REGISTRY_FR)).toBe(false);
    expect(areSignalAssetsAvailable(["gauche"], {})).toBe(false);
    expect(areSignalAssetsAvailable([], { gauche: 1 })).toBe(false);
  });

  it("true si tous les assets requis sont présents", () => {
    expect(areSignalAssetsAvailable(["gauche", "droite"], { gauche: 1, droite: 2 })).toBe(true);
  });
});

describe("createSignalAudioPlayer", () => {
  it("retourne missing_audio_assets quand un asset manque", () => {
    const player = createSignalAudioPlayer({}, () => mkPlayer() as any);
    expect(player.preload(["gauche", "droite"])).toEqual({
      ok: false,
      code: "missing_audio_assets",
    });
  });

  it("précharge et joue via le lecteur injecté", () => {
    const players: ReturnType<typeof mkPlayer>[] = [];
    const factory = jest.fn(() => {
      const p = mkPlayer();
      players.push(p);
      return p as any;
    });
    const audio = createSignalAudioPlayer({ gauche: 11, droite: 22 }, factory);

    expect(audio.preload(["gauche", "droite"])).toEqual({ ok: true });
    expect(factory).toHaveBeenCalledTimes(2);

    audio.play("gauche");
    expect(players[0].seekTo).toHaveBeenCalledWith(0);
    expect(players[0].play).toHaveBeenCalledTimes(1);

    audio.stop();
    expect(players[0].pause).toHaveBeenCalled();

    audio.release();
    expect(players[0].remove).toHaveBeenCalled();
  });

  it("play() throw si la consigne n'a pas été préchargée", () => {
    const audio = createSignalAudioPlayer({ gauche: 1 }, () => mkPlayer() as any);
    expect(() => audio.play("gauche")).toThrow("missing_audio_assets");
  });
});
