// screens/newSession/ui/EnvironmentSelector.tsx
//
// Restylage DA joueur (SPEC_DA_ACCUEIL_SEANCE.md §3.5) : MÊME règle de
// sélection (1 ou 2 lieux, `[...prev, key].slice(0, 2)`, filtrée par
// `allowedLocations`) — seul le gabarit visuel change. Les tuiles sont des
// cases à cocher accessibles (accessibilityRole="checkbox"), pas des boutons
// radio : la sélection multiple (séance mixte) est le comportement réel.
import React from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TITRE, PLAFOND_TEXTE } from "../../../constants/daJoueur";
import { showToast } from "../../../utils/toast";
import type { EnvironmentSelection } from "../types";
import { MICROCYCLES, isMicrocycleId, getRecommendedLocation, type MicrocycleId } from "../../../domain/microcycles";

type LocKey = "gym" | "pitch" | "home";

/** Ordre canonique d'affichage (celui de la maquette : Salle, Terrain,
 *  Maison) — INDÉPENDANT de l'ordre de `allowedLocations` du cycle, qui varie
 *  d'un cycle à l'autre et n'a jamais été un ordre d'affichage. */
const ORDRE_CANONIQUE: LocKey[] = ["gym", "pitch", "home"];

type Props = {
  environment: EnvironmentSelection;
  setEnvironment: React.Dispatch<React.SetStateAction<EnvironmentSelection>>;
  allowed?: Array<"gym" | "pitch" | "home">;
  currentCycleId?: MicrocycleId | string | null;
};

const LOCATION_META: Record<LocKey, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  gym: { label: "Salle", icon: "barbell-outline" },
  pitch: { label: "Terrain", icon: "football-outline" },
  home: { label: "Maison", icon: "home-outline" },
};

/** Description par défaut (hors cycle) — mêmes textes que l'ancienne version. */
const DESCRIPTION_DEFAUT: Record<LocKey, string> = {
  gym: "Machines, charges lourdes, haltères",
  pitch: "Gazon, synthé, stabilisé",
  home: "Salon, jardin, peu de matériel",
};

export function EnvironmentSelector({ environment, setEnvironment, allowed, currentCycleId }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const empile = width < 340 || fontScale > 1.15;

  const allowedList = (allowed ?? ["gym", "pitch", "home"]) as LocKey[];
  const locationsAffichees = ORDRE_CANONIQUE.filter((key) => allowedList.includes(key));

  const cycle = currentCycleId && isMicrocycleId(currentCycleId) ? MICROCYCLES[currentCycleId] : null;
  const recommended = cycle ? getRecommendedLocation(cycle.id) : null;

  const toggle = (key: LocKey) => {
    if (!allowedList.includes(key)) return;
    // Décision AVANT `setEnvironment`, sur la prop `environment` : une
    // fonction de mise à jour doit rester pure (React peut l'invoquer deux
    // fois, StrictMode en dev) — le toast est un effet de bord, il ne peut
    // pas vivre dedans.
    if (!environment.includes(key) && environment.length >= 2) {
      // Règle inchangée (slice(0, 2) aurait de toute façon ignoré ce 3e
      // lieu) : on informe seulement le joueur pourquoi rien ne s'est passé.
      showToast({
        type: "info",
        title: "Deux lieux maximum",
        message: "Retire un lieu pour en choisir un autre.",
      });
      return;
    }
    setEnvironment((prev) => {
      const has = prev.includes(key);
      return has
        ? prev.filter((e) => e !== key)
        : ([...prev, key].slice(0, 2) as EnvironmentSelection);
    });
  };

  const descriptionPour = (key: LocKey) => cycle?.locationDescriptions?.[key] ?? DESCRIPTION_DEFAUT[key];

  const aide =
    environment.length === 1
      ? descriptionPour(environment[0] as LocKey)
      : environment.length === 2
      ? environment.map((key) => `${LOCATION_META[key as LocKey].label} : ${descriptionPour(key as LocKey)}`).join("\n")
      : null;

  const conseilNonChoisi =
    recommended && allowedList.includes(recommended.location) && !environment.includes(recommended.location)
      ? `Conseillé pour ce cycle : ${LOCATION_META[recommended.location].label}.${recommended.reason ? ` ${recommended.reason}` : ""}`
      : null;

  return (
    <View style={styles.container}>
      <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>Où t'entraînes-tu ?</Text>

      <View style={empile ? styles.listeEmpilee : styles.ligneTuiles}>
        {locationsAffichees.map((key) => {
          const meta = LOCATION_META[key];
          const selected = environment.includes(key);
          const isRecommended = recommended?.location === key;
          const couleurIcone = selected ? da.colors.action : da.colors.text;

          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={meta.label}
              accessibilityHint={selected ? "Sélectionné" : undefined}
              style={[
                empile ? styles.tuileEmpilee : styles.tuile,
                selected && styles.tuileSelectionnee,
              ]}
            >
              {empile ? (
                <>
                  <Ionicons name={meta.icon} size={28} color={couleurIcone} />
                  <View style={styles.texteEmpile}>
                    <Text style={styles.libelleEmpile} maxFontSizeMultiplier={PLAFOND_TEXTE}>{meta.label}</Text>
                    {isRecommended ? (
                      <Text style={styles.conseille} maxFontSizeMultiplier={PLAFOND_TEXTE}>Conseillé</Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <View style={styles.pastille}>
                      <Ionicons name="checkmark" size={14} color={da.colors.onAction} />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {selected ? (
                    <View style={styles.pastilleCoin}>
                      <Ionicons name="checkmark" size={14} color={da.colors.onAction} />
                    </View>
                  ) : null}
                  <Ionicons name={meta.icon} size={28} color={couleurIcone} />
                  <Text style={styles.libelleGrille} maxFontSizeMultiplier={PLAFOND_TEXTE}>{meta.label}</Text>
                  {isRecommended ? (
                    <Text style={styles.conseille} maxFontSizeMultiplier={PLAFOND_TEXTE}>Conseillé</Text>
                  ) : null}
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Ordre voulu par la maquette : d'abord l'aide du/des lieu(x) choisi(s)
          (juste sous les tuiles), puis la phrase mixte, puis l'éventuel
          "Conseillé pour ce cycle". */}
      {aide ? <Text style={styles.aide} maxFontSizeMultiplier={PLAFOND_TEXTE}>{aide}</Text> : null}

      <Text style={styles.mixteHelp} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        {environment.length === 2
          ? `Séance mixte : ${environment.map((k) => LOCATION_META[k as LocKey].label).join(" + ")}.`
          : "Tu peux combiner deux lieux pour une séance mixte."}
      </Text>

      {conseilNonChoisi ? (
        <Text style={styles.aide} maxFontSizeMultiplier={PLAFOND_TEXTE}>{conseilNonChoisi}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: da.spacing.sm,
  },
  titre: {
    ...da.typography.section,
    color: da.colors.text,
  },
  ligneTuiles: {
    flexDirection: "row",
    gap: da.spacing.sm,
  },
  listeEmpilee: {
    gap: da.spacing.xs,
  },
  tuile: {
    flex: 1,
    minHeight: 96,
    borderRadius: da.radius.tile,
    // Bordure 2 px AU REPOS DÉJÀ (couleur neutre) : la sélection ne change
    // que la couleur, jamais l'épaisseur — sinon le contenu saute d'1 px
    // (le padding/gap ne compense pas un changement de borderWidth).
    borderWidth: 2,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: da.spacing.sm,
  },
  tuileEmpilee: {
    minHeight: 56,
    borderRadius: da.radius.tile,
    borderWidth: 2,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.sm,
    paddingHorizontal: da.spacing.md,
  },
  tuileSelectionnee: {
    borderColor: da.colors.action,
    backgroundColor: da.colors.actionSoft,
  },
  texteEmpile: {
    flex: 1,
  },
  libelleGrille: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
    textAlign: "center",
  },
  libelleEmpile: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  conseille: {
    ...da.typography.secondary,
    fontSize: 12,
    lineHeight: 16,
    color: da.colors.sub,
  },
  pastille: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: da.colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleCoin: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: da.colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  mixteHelp: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  aide: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
});
