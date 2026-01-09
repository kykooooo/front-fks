import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { palette } from "../theme";
import type { EnvironmentSelection } from "../types";

type Props = {
  environment: EnvironmentSelection;
  setEnvironment: React.Dispatch<React.SetStateAction<EnvironmentSelection>>;
};

export function EnvironmentSelector({ environment, setEnvironment }: Props) {
  const toggle = (key: "gym" | "pitch" | "home") => {
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
        <EnvButton
          label="Salle"
          description="Machines, charges lourdes"
          selected={environment.includes("gym")}
          onPress={() => toggle("gym")}
        />
        <EnvButton
          label="Terrain"
          description="Gazon, stabilisé, synthé"
          selected={environment.includes("pitch")}
          onPress={() => toggle("pitch")}
        />
        <EnvButton
          label="Chez toi"
          description="Salon, jardin, cage d’escalier"
          selected={environment.includes("home")}
          onPress={() => toggle("home")}
        />
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
    borderColor: "#1f2933",
    backgroundColor: palette.cardSoft,
  },
  envCardSelected: {
    borderColor: palette.accent,
    backgroundColor: "#1f1308",
  },
  envLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: palette.text,
  },
  envLabelSelected: {
    color: palette.accentSoft,
  },
  envDescription: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 4,
  },
  envDescriptionSelected: {
    color: palette.accentSoft,
  },
};
