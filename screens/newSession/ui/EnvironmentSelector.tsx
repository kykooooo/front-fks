import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { palette } from "../theme";
import type { EnvironmentSelection } from "../types";

type Props = {
  environment: EnvironmentSelection;
  setEnvironment: React.Dispatch<React.SetStateAction<EnvironmentSelection>>;
  allowed?: Array<"gym" | "pitch" | "home">;
  descriptionOverrides?: Partial<Record<"gym" | "pitch" | "home", string>>;
};

export function EnvironmentSelector({ environment, setEnvironment, allowed, descriptionOverrides }: Props) {
  const allowedSet = new Set(allowed ?? ["gym", "pitch", "home"]);
  const toggle = (key: "gym" | "pitch" | "home") => {
    if (!allowedSet.has(key)) return;
    setEnvironment((prev) => {
      const has = prev.includes(key);
      const next = has
        ? prev.filter((e) => e !== key)
        : ([...prev, key].slice(0, 2) as EnvironmentSelection);
      return next;
    });
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.cardTitle}>Où tu t’entraînes aujourd’hui ?</Text>
      <Text style={styles.cardSubtitle}>
        Dis à FKS si tu vas à la salle, sur un terrain ou tu restes chez toi.
      </Text>
      <View style={styles.environmentRow}>
        {allowedSet.has("gym") ? (
          <EnvButton
            label="Salle"
            description={descriptionOverrides?.gym ?? "Machines, charges lourdes"}
            selected={environment.includes("gym")}
            onPress={() => toggle("gym")}
          />
        ) : null}
        {allowedSet.has("pitch") ? (
          <EnvButton
            label="Terrain"
            description={descriptionOverrides?.pitch ?? "Gazon, stabilisé, synthé"}
            selected={environment.includes("pitch")}
            onPress={() => toggle("pitch")}
          />
        ) : null}
        {allowedSet.has("home") ? (
          <EnvButton
            label="Chez toi"
            description={descriptionOverrides?.home ?? "Salon, jardin, cage d’escalier"}
            selected={environment.includes("home")}
            onPress={() => toggle("home")}
          />
        ) : null}
      </View>
    </View>
  );
}

function EnvButton({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.envCard, selected ? styles.envCardSelected : undefined]}
    >
      <Text style={[styles.envLabel, selected ? styles.envLabelSelected : undefined]}>
        {label}
      </Text>
      <Text
        style={[
          styles.envDescription,
          selected ? styles.envDescriptionSelected : undefined,
        ]}
      >
        {description}
      </Text>
    </TouchableOpacity>
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
  environmentRow: {
    flexDirection: "row" as const,
    gap: 8,
    marginTop: 12,
  },
  envCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  envCardSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  envLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: palette.text,
  },
  envLabelSelected: {
    color: palette.accent,
  },
  envDescription: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 4,
  },
  envDescriptionSelected: {
    color: palette.accent,
  },
};
