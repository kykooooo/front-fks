import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { palette } from "../theme";
import type { EnvironmentSelection } from "../types";

type CatalogItem = { id: string; label: string; source: "gym" | "pitch" | "home" | "both" };

type Props = {
  catalog: CatalogItem[];
  environment: EnvironmentSelection;
  availableEquipment: string[];
  selectedEquipment: string[];
  contextLoading: boolean;
  onSelect: (next: string[]) => void;
  onValidateContext: () => void;
  setupDone: boolean;
};

export function EquipmentSelector({
  catalog,
  environment,
  availableEquipment,
  selectedEquipment,
  contextLoading,
  onSelect,
  onValidateContext,
  setupDone,
}: Props) {
  const isHome = environment.includes("home");
  const filtered = catalog.filter((item) => {
    if (availableEquipment.length > 0 && !availableEquipment.includes(item.id)) return false;
    if (item.source === "both") return true;
    return environment.includes(item.source as any);
  });

  const homeToggles = [
    { id: "home_small", label: "Maison (petit matériel)" },
    { id: "backpack", label: "Sac à dos (chargé)" },
    { id: "water_bottles", label: "2 bouteilles d’eau" },
    { id: "chair", label: "Chaise/Banc" },
  ];

  const toggle = (id: string) => {
    onSelect(
      selectedEquipment.includes(id)
        ? selectedEquipment.filter((x) => x !== id)
        : [...selectedEquipment, id]
    );
  };

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.cardTitle}>Matériel disponible</Text>
      <Text style={styles.cardSubtitle}>
        Active uniquement ce que tu as sous la main. FKS adaptera les blocs.
      </Text>

      {contextLoading && (
        <Text style={[styles.helper, { marginTop: 8 }]}>
          <ActivityIndicator color={palette.accent} /> Chargement de ton matériel...
        </Text>
      )}

      {!contextLoading && environment.length === 0 && (
        <Text style={[styles.helper, { marginTop: 8 }]}>
          Choisis un lieu pour filtrer le matériel (salle, terrain ou chez toi).
        </Text>
      )}

      {!contextLoading && environment.length > 0 && (
        <>
          {isHome ? (
            <View style={styles.homeBlock}>
              <Text style={styles.homeTitle}>Matériel (maison)</Text>
              <Text style={styles.homeMessage}>
                Pour des séances maison plus efficaces et variées, coche ce que tu as : sac à dos
                (chargé), 2 bouteilles d’eau, chaise/banc. Ça débloque des exercices “chargés”
                (squat/row/RDL/press) et évite les séances trop répétitives.
              </Text>
              <View style={styles.homeToggleList}>
                {homeToggles.map((item) => {
                  const enabled = selectedEquipment.includes(item.id);
                  return (
                    <View key={item.id} style={styles.homeToggleRow}>
                      <Text style={styles.homeToggleLabel}>{item.label}</Text>
                      <Switch
                        value={enabled}
                        onValueChange={() => toggle(item.id)}
                        trackColor={{ false: palette.borderSoft, true: palette.accentSoft }}
                        thumbColor={enabled ? palette.accent : palette.textMuted}
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.homeHint}>
                Ça rend les séances plus variées et plus intenses.
              </Text>
            </View>
          ) : null}

          <View style={styles.chipsWrap}>
            {filtered.map((item) => {
              const selected = selectedEquipment.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={[styles.chip, selected ? styles.chipSelected : undefined]}
                >
                  <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.helper, { marginTop: 6 }]}>
            Sélectionne au moins un élément avant de générer.
          </Text>

          <TouchableOpacity
            style={[styles.cta, styles.ctaPrimary, { marginTop: 12, opacity: setupDone ? 0.8 : 1 }]}
            onPress={() => {
              if (environment.length === 0) {
                Alert.alert("Lieu requis", "Choisis un lieu avant de valider.");
                return;
              }
              if (selectedEquipment.length === 0) {
                Alert.alert("Matériel requis", "Sélectionne au moins un matériel.");
                return;
              }
              onValidateContext();
            }}
          >
            <Text style={styles.ctaPrimaryText}>
              {setupDone ? "Contexte validé" : "Valider le contexte"}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = {
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: palette.sub,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: palette.sub,
  },
  chipsWrap: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    color: palette.sub,
    fontWeight: "600" as const,
    fontSize: 12,
  },
  chipTextSelected: {
    color: palette.accent,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  homeBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    gap: 8,
  },
  homeTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: palette.text,
  },
  homeMessage: {
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
  homeToggleList: {
    gap: 6,
  },
  homeToggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  homeToggleLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: palette.text,
  },
  homeHint: {
    fontSize: 11,
    color: palette.sub,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ctaPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  ctaPrimaryText: {
    color: palette.bg,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    fontSize: 13,
  },
};
