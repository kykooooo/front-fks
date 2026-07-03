# Assets vocaux — Signal FKS V1

⚠️ **Aucun fichier vocal n'est encore présent.** Signal FKS ne peut PAS être testé
sur le terrain tant que ces enregistrements français réels ne sont pas ajoutés.
Le registre code (`services/signalAudio.ts` → `SIGNAL_AUDIO_REGISTRY_FR`) reste
volontairement vide : ne jamais `require()` un fichier absent (cela casse le bundling).

## Fichiers à enregistrer (V1)

| Consigne | Chemin attendu                         |
| -------- | -------------------------------------- |
| gauche   | `assets/audio/signal/fr/gauche.m4a`    |
| droite   | `assets/audio/signal/fr/droite.m4a`    |

> Le sous-dossier `fr/` est à créer en même temps que les fichiers.

## Format attendu

- Conteneur : **AAC / .m4a** (compatible expo-audio iOS + Android).
- Canal : mono.
- Échantillonnage : 44.1 kHz.
- Durée : **< 1 seconde** par mot.
- Voix claire, articulée, **sans silence de tête** (attaque immédiate) pour un
  déclenchement perçu instantané.
- Niveau normalisé (≈ -1 dBFS crête) pour être audible téléphone posé au sol.

## Activation (plus tard, hors de ce chantier)

1. Enregistrer et déposer `gauche.m4a` / `droite.m4a` dans `assets/audio/signal/fr/`.
2. Décommenter les deux lignes `require(...)` dans `SIGNAL_AUDIO_REGISTRY_FR`
   (`services/signalAudio.ts`).
3. Passer `FKS_SIGNAL_V1_ENABLED=true` (via `app.json` extra ou `EXPO_PUBLIC_FKS_SIGNAL_V1`).
4. Signal FKS fonctionne alors **100 % hors ligne** (assets bundlés, aucun TTS réseau).

Tant que ces fichiers ne sont pas présents, l'app affiche un message clair
« consignes vocales à venir » et ne lance aucune séquence.
