import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
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
  const filtered = catalog.filter((item) => {
    if (availableEquipment.length > 0 && !availableEquipment.includes(item.id)) return false;
    if (item.source === "both") return true;
    return environment.includes(item.source as any);
  });

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
    borderColor: "#4b5563",
    backgroundColor: "#020617",
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: "#1f1308",
  },
  chipText: {
    color: palette.sub,
    fontWeight: "600" as const,
    fontSize: 12,
  },
  chipTextSelected: {
    color: palette.accentSoft,
    fontWeight: "700" as const,
    fontSize: 12,
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
    color: "#050509",
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    fontSize: 13,
  },
};
