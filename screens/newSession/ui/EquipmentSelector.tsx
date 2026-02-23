import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../theme";
import { showToast } from "../../../utils/toast";
import type { EnvironmentSelection } from "../types";

type CatalogItem = { id: string; label: string; source: "gym" | "pitch" | "home" | "both" };

// Équipement spécial salle (pas dans toutes les salles)
const GYM_SPECIAL_EQUIPMENT = [
  { id: "power_sled", label: "Traîneau / Sled", icon: "navigate", description: "Pour sprints résistés" },
  { id: "trap_bar", label: "Trap bar / Hex bar", icon: "git-commit", description: "Deadlifts, shrugs" },
  { id: "landmine", label: "Landmine", icon: "arrow-up", description: "Rotations, presses" },
  { id: "cable_machine", label: "Poulie / Cable", icon: "swap-vertical", description: "Tirage, rotations" },
];

type Props = {
  catalog: CatalogItem[];
  environment: EnvironmentSelection;
  availableEquipment: string[];
  selectedEquipment: string[];
  contextLoading: boolean;
  onSelect: (next: string[]) => void;
  onValidateContext: () => void;
  setupDone: boolean;
  gymMachinesEnabled?: boolean;
  onToggleGymMachines?: (next: boolean) => void;
  pitchSmallGearEnabled?: boolean;
  onTogglePitchSmallGear?: (next: boolean) => void;
};

// Equipment categories with icons
const HOME_EQUIPMENT = [
  { id: "home_small", label: "Petit matériel", icon: "fitness", description: "Tapis, bandes élastiques" },
  { id: "backpack", label: "Sac à dos chargé", icon: "bag", description: "Pour squats, RDL, rows" },
  { id: "water_bottles", label: "Bouteilles d'eau", icon: "water", description: "Poids légers polyvalents" },
  { id: "chair", label: "Chaise / Banc", icon: "square", description: "Step-ups, dips, bulgarians" },
];

export function EquipmentSelector({
  catalog,
  environment,
  availableEquipment,
  selectedEquipment,
  contextLoading,
  onSelect,
  onValidateContext,
  setupDone,
  gymMachinesEnabled = false,
  onToggleGymMachines,
  pitchSmallGearEnabled = false,
  onTogglePitchSmallGear,
}: Props) {
  const isHome = environment.includes("home");
  const isGym = environment.includes("gym");
  const isPitch = environment.includes("pitch");

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

  const handleValidate = () => {
    if (environment.length === 0) {
      showToast({ type: "warn", title: "Lieu requis", message: "Choisis un lieu avant de valider." });
      return;
    }
    // Gym = standard equipment always included → no validation needed
    // Pitch = needs small gear toggle OR gym selected
    // Home = needs equipment OR gym/pitch with gear
    const hasGym = environment.includes("gym");
    const hasPitch = environment.includes("pitch");
    const hasHome = environment.includes("home");
    const hasHomeEquipment = selectedEquipment.some(id => HOME_EQUIPMENT.some(h => h.id === id));

    // If gym is selected, we always have equipment (standard included)
    if (hasGym) {
      onValidateContext();
      return;
    }

    // No gym: check pitch and home requirements
    if (hasPitch && !pitchSmallGearEnabled && hasHome && !hasHomeEquipment) {
      showToast({ type: "warn", title: "Matériel requis", message: "Active le matériel terrain ou sélectionne un équipement maison." });
      return;
    }
    if (hasPitch && !pitchSmallGearEnabled && !hasHome) {
      showToast({ type: "warn", title: "Matériel requis", message: "Active le petit matériel terrain." });
      return;
    }
    if (hasHome && !hasHomeEquipment && !hasPitch) {
      showToast({ type: "warn", title: "Matériel requis", message: "Sélectionne au moins un équipement maison." });
      return;
    }
    onValidateContext();
  };

  if (environment.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cube-outline" size={28} color={palette.sub} />
        </View>
        <Text style={styles.emptyTitle}>Matériel</Text>
        <Text style={styles.emptySubtitle}>
          Choisis d'abord un lieu pour voir le matériel disponible
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="cube" size={18} color={palette.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Matériel disponible</Text>
          <Text style={styles.subtitle}>
            FKS adapte les exercices selon ton équipement
          </Text>
        </View>
      </View>

      {/* Gym Section */}
      {isGym && (
        <View style={[styles.locationSection, { borderLeftColor: "#8b5cf6" }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.12)" }]}>
              <Ionicons name="barbell" size={18} color="#8b5cf6" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Salle de sport</Text>
              <Text style={styles.sectionSubtitle}>Équipement standard inclus par défaut</Text>
            </View>
          </View>

          {/* Standard equipment - always included */}
          <View style={[styles.standardEquipmentBadge, { backgroundColor: "rgba(139, 92, 246, 0.08)" }]}>
            <View style={styles.standardEquipmentHeader}>
              <Ionicons name="checkmark-circle" size={16} color="#8b5cf6" />
              <Text style={[styles.standardEquipmentTitle, { color: "#8b5cf6" }]}>Inclus</Text>
            </View>
            <Text style={styles.standardEquipmentList}>
              Haltères • Barres • Bancs • Machines guidées • Poids libres
            </Text>
          </View>

          {/* Special equipment toggles */}
          <View style={styles.specialEquipmentSection}>
            <Text style={styles.specialEquipmentLabel}>Équipement spécial disponible ?</Text>
            <View style={styles.equipmentGrid}>
              {GYM_SPECIAL_EQUIPMENT.map((item) => {
                const enabled = selectedEquipment.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.85}
                    style={[
                      styles.equipmentCard,
                      enabled && styles.equipmentCardEnabledGym,
                    ]}
                  >
                    <View style={[
                      styles.equipmentIconWrap,
                      { backgroundColor: enabled ? "rgba(139, 92, 246, 0.15)" : palette.cardSoft }
                    ]}>
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={enabled ? "#8b5cf6" : palette.sub}
                      />
                    </View>
                    <View style={styles.equipmentInfo}>
                      <Text style={[
                        styles.equipmentLabel,
                        enabled && { color: "#8b5cf6" }
                      ]}>
                        {item.label}
                      </Text>
                      <Text style={styles.equipmentDescription}>
                        {item.description}
                      </Text>
                    </View>
                    {enabled && (
                      <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Pitch Section */}
      {isPitch && (
        <View style={[styles.locationSection, { borderLeftColor: "#22c55e" }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
              <Ionicons name="football" size={18} color="#22c55e" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Terrain</Text>
              <Text style={styles.sectionSubtitle}>Petit matériel pour les drills et la vitesse</Text>
            </View>
          </View>

          <View style={styles.quickToggle}>
            <View style={styles.quickToggleInfo}>
              <Ionicons name="checkmark-done" size={18} color="#22c55e" />
              <Text style={styles.quickToggleLabel}>Petit matériel dispo</Text>
            </View>
            <Switch
              value={pitchSmallGearEnabled}
              onValueChange={(next) => onTogglePitchSmallGear?.(next)}
              trackColor={{ false: palette.borderSoft, true: "rgba(34, 197, 94, 0.4)" }}
              thumbColor={pitchSmallGearEnabled ? "#22c55e" : palette.textMuted}
            />
          </View>

          {pitchSmallGearEnabled && (
            <View style={[styles.activeBadge, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={[styles.activeBadgeText, { color: "#22c55e" }]}>
                Cônes, plots, échelle, mini-haies, bandes
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Home Section */}
      {isHome && (
        <View style={[styles.locationSection, { borderLeftColor: "#f59e0b" }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
              <Ionicons name="home" size={18} color="#f59e0b" />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Maison</Text>
              <Text style={styles.sectionSubtitle}>Coche ce que tu as pour des séances plus variées</Text>
            </View>
          </View>

          <View style={styles.equipmentGrid}>
            {HOME_EQUIPMENT.map((item) => {
              const enabled = selectedEquipment.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.equipmentCard,
                    enabled && styles.equipmentCardEnabled,
                  ]}
                >
                  <View style={[
                    styles.equipmentIconWrap,
                    { backgroundColor: enabled ? "rgba(245, 158, 11, 0.15)" : palette.cardSoft }
                  ]}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={enabled ? "#f59e0b" : palette.sub}
                    />
                  </View>
                  <View style={styles.equipmentInfo}>
                    <Text style={[
                      styles.equipmentLabel,
                      enabled && { color: "#f59e0b" }
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={styles.equipmentDescription}>
                      {item.description}
                    </Text>
                  </View>
                  {enabled && (
                    <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Additional equipment chips (if not using quick toggles) */}
      {filtered.length > 0 && !((isGym && gymMachinesEnabled && environment.length === 1) || (isPitch && pitchSmallGearEnabled && environment.length === 1)) && (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsTitle}>Équipement supplémentaire</Text>
          <View style={styles.chipsWrap}>
            {filtered.map((item) => {
              const selected = selectedEquipment.includes(item.id);
              // Skip items already shown in home section
              if (HOME_EQUIPMENT.some(h => h.id === item.id)) return null;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  {selected && <Ionicons name="checkmark" size={14} color={palette.accent} />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Validation button */}
      <TouchableOpacity
        style={[
          styles.validateButton,
          setupDone && styles.validateButtonDone,
        ]}
        onPress={handleValidate}
        activeOpacity={0.85}
      >
        <Ionicons
          name={setupDone ? "checkmark-circle" : "arrow-forward"}
          size={20}
          color="#fff"
        />
        <Text style={styles.validateButtonText}>
          {setupDone ? "Contexte validé" : "Valider le contexte"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 24,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderStyle: "dashed",
    backgroundColor: palette.cardSoft,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.sub,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 2,
  },
  locationSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderLeftWidth: 4,
    backgroundColor: palette.card,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  quickToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
  },
  quickToggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  equipmentGrid: {
    gap: 10,
  },
  standardEquipmentBadge: {
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  standardEquipmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  standardEquipmentTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  standardEquipmentList: {
    fontSize: 13,
    color: palette.sub,
    lineHeight: 18,
  },
  specialEquipmentSection: {
    gap: 10,
  },
  specialEquipmentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  equipmentCardEnabledGym: {
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139, 92, 246, 0.06)",
  },
  equipmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  equipmentCardEnabled: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.06)",
  },
  equipmentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
  },
  equipmentDescription: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  chipsSection: {
    gap: 10,
  },
  chipsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.sub,
  },
  chipTextSelected: {
    color: palette.accent,
  },
  validateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: palette.accent,
  },
  validateButtonDone: {
    backgroundColor: "#22c55e",
  },
  validateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
