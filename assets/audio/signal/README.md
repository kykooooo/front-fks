# Assets vocaux — Signal FKS V1

✅ **gauche.m4a / droite.m4a sont présents** (`assets/audio/signal/fr/`, voix du
fondateur) et le registre code (`services/signalAudio.ts` →
`SIGNAL_AUDIO_REGISTRY_FR`) pointe dessus. Ne jamais `require()` un fichier
absent (cela casse le bundling) — pour un futur mot manquant, laisser sa ligne
commentée.

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

1. ✅ Fichiers `gauche.m4a` / `droite.m4a` déposés dans `assets/audio/signal/fr/`.
2. ✅ Lignes `require(...)` décommentées dans `SIGNAL_AUDIO_REGISTRY_FR`
   (`services/signalAudio.ts`).
3. ⏳ Reste à passer `FKS_SIGNAL_V1_ENABLED=true` (via `app.json` extra ou `EXPO_PUBLIC_FKS_SIGNAL_V1`)
   pour activer la feature côté produit.
4. Signal FKS fonctionnera alors **100 % hors ligne** (assets bundlés, aucun TTS réseau).

Tant que le flag n'est pas activé, l'app affiche un message clair
« consignes vocales à venir » et ne lance aucune séquence.
