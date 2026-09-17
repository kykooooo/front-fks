// screens/newSession/ui/EquipmentSelector.tsx
//
// Restylage DA joueur (SPEC_DA_ACCUEIL_SEANCE.md §3.6) : MÊMES ids, MÊMES
// libellés, MÊMES conditions d'affichage que la version d'origine — seul le
// gabarit visuel change (jetons `da`, DaRowGroup/DaCheckRow, groupe
// repliable). Le bouton "Valider le contexte" a disparu (fusion 3.6, décidée
// et faite dans NewSessionScreen.tsx) : ce composant n'écrit plus jamais
// `setupDone`.
import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TITRE, PLAFOND_TEXTE } from "../../../constants/daJoueur";
import { DaCheckRow } from "../../../components/ui/da/DaCheckRow";
import { DaRowGroup } from "../../../components/ui/da/DaRowGroup";
import type { EnvironmentSelection } from "../types";

type CatalogItem = { id: string; label: string; source: "gym" | "pitch" | "home" | "both" };

// Équipement spécial salle (pas dans toutes les salles).
// NOTE contrat : la banque backend exige l'id "sled" (aucun alias "power_sled"
// pour l'instant — alias à ajouter côté backend, ne pas renommer ici sans
// coordination). Le toggle "landmine" a été retiré : aucun équipement backend
// ne porte cet id (le landmine press est gaté par "barbell", déjà couvert par
// gym_full envoyé d'office en salle).
// Icônes filaires (-outline) : le reste de l'écran (tuiles de lieu, chevrons,
// icône "poids du corps") est entièrement filaire — les pleines d'origine
// juraient (finitions orchestrateur G3). Ids/libellés/descriptions intacts.
export const GYM_SPECIAL_EQUIPMENT = [
  { id: "power_sled", label: "Traîneau / Sled", icon: "navigate-outline" as const, description: "Pour sprints résistés" },
  { id: "trap_bar", label: "Trap bar / Hex bar", icon: "git-commit-outline" as const, description: "Deadlifts, shrugs" },
  { id: "cable_machine", label: "Poulie / Cable", icon: "swap-vertical-outline" as const, description: "Tirage, rotations" },
];

export const HOME_EQUIPMENT = [
  { id: "home_small", label: "Petit matériel", icon: "fitness-outline" as const, description: "Tapis, bandes élastiques" },
  { id: "backpack", label: "Sac à dos chargé", icon: "bag-outline" as const, description: "Pour squats, RDL, rows" },
  { id: "water_bottles", label: "Bouteilles d'eau", icon: "water-outline" as const, description: "Poids légers polyvalents" },
  { id: "chair", label: "Chaise / Banc", icon: "square-outline" as const, description: "Step-ups, dips, bulgarians" },
];

type Props = {
  catalog: CatalogItem[];
  environment: EnvironmentSelection;
  availableEquipment: string[];
  selectedEquipment: string[];
  onSelect: (next: string[]) => void;
  /** `contextLoading` du store, déjà combiné avec `!generating` par l'appelant
   *  (spec §3.8 : "contextLoading SANS generating") — ce composant n'a pas
   *  besoin de connaître `generating` pour ça. */
  contextLoading?: boolean;
  /** Toujours false en pratique aujourd'hui (aucun contrôle ne la fait passer
   *  à true) : formule conservée à l'identique pour ne pas changer la
   *  condition d'affichage de "Équipement supplémentaire" (spec §3.6). */
  gymMachinesEnabled?: boolean;
  pitchSmallGearEnabled?: boolean;
  onTogglePitchSmallGear?: (next: boolean) => void;
};

export function EquipmentSelector({
  catalog,
  environment,
  availableEquipment,
  selectedEquipment,
  onSelect,
  contextLoading = false,
  gymMachinesEnabled = false,
  pitchSmallGearEnabled = false,
  onTogglePitchSmallGear,
}: Props) {
  const isHome = environment.includes("home");
  const isGym = environment.includes("gym");
  const isPitch = environment.includes("pitch");
  const mixte = environment.length > 1;

  const filtered = catalog.filter((item) => {
    if (availableEquipment.length > 0 && !availableEquipment.includes(item.id)) return false;
    if (item.source === "both") return true;
    return environment.includes(item.source as any);
  });
  const supplementaires = filtered.filter(
    (item) => !HOME_EQUIPMENT.some((h) => h.id === item.id)
  );

  // "Sans matériel" est un choix assumé (poids du corps), pas un oubli :
  // on l'affiche dès que rien ne vient compléter le poids du corps
  // (salle = toujours équipée par défaut, donc jamais concernée).
  const hasHomeEquipmentSelected = selectedEquipment.some((id) => HOME_EQUIPMENT.some((h) => h.id === id));
  const showBodyweightHint = !isGym && !pitchSmallGearEnabled && !hasHomeEquipmentSelected;

  const toggle = (id: string) => {
    onSelect(
      selectedEquipment.includes(id)
        ? selectedEquipment.filter((x) => x !== id)
        : [...selectedEquipment, id]
    );
  };

  // MÊME condition d'affichage qu'à l'origine (spec §3.6) : le groupe
  // repliable disparaît entièrement dans les mêmes cas qu'avant.
  const afficherSupplementaires =
    supplementaires.length > 0 &&
    !((isGym && gymMachinesEnabled && environment.length === 1) || (isPitch && pitchSmallGearEnabled && environment.length === 1));

  const [ouvert, setOuvert] = useState(() => supplementaires.length <= 5);
  const nombreCoches = supplementaires.filter((item) => selectedEquipment.includes(item.id)).length;

  if (environment.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>Ton matériel</Text>
        <Text style={styles.sousTexte} maxFontSizeMultiplier={PLAFOND_TEXTE}>Choisis d'abord un lieu.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>Ton matériel</Text>
      <Text style={styles.sousTexte} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        Sélectionne ce que tu as avec toi.
      </Text>

      {contextLoading ? (
        <View style={styles.chargement}>
          <ActivityIndicator size="small" color={da.colors.sub} />
          <Text style={styles.sousTexte} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Chargement de ton matériel…
          </Text>
        </View>
      ) : null}

      {isGym ? (
        <View style={styles.groupe}>
          {mixte ? <GroupHeader icon="barbell-outline" label="Salle" /> : null}
          <DaRowGroup>
            <View style={styles.ligneStandard}>
              <Ionicons name="checkmark-circle" size={22} color={da.colors.successText} />
              <View style={styles.texteStandard}>
                <Text style={styles.libelleStandard} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                  Équipement standard inclus
                </Text>
                <Text style={styles.descriptionStandard} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                  Haltères • Barres • Bancs • Machines guidées • Poids libres
                </Text>
              </View>
            </View>
            {GYM_SPECIAL_EQUIPMENT.map((item) => (
              <DaCheckRow
                key={item.id}
                label={item.label}
                description={item.description}
                icon={item.icon}
                checked={selectedEquipment.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </DaRowGroup>
        </View>
      ) : null}

      {isPitch ? (
        <View style={styles.groupe}>
          {mixte ? <GroupHeader icon="football-outline" label="Terrain" /> : null}
          <DaRowGroup>
            <DaCheckRow
              label="Petit matériel dispo"
              description="Cônes, plots, bandes élastiques"
              icon="checkmark-done-outline"
              checked={pitchSmallGearEnabled}
              onToggle={() => onTogglePitchSmallGear?.(!pitchSmallGearEnabled)}
            />
          </DaRowGroup>
        </View>
      ) : null}

      {isHome ? (
        <View style={styles.groupe}>
          {mixte ? <GroupHeader icon="home-outline" label="Maison" /> : null}
          <DaRowGroup>
            {HOME_EQUIPMENT.map((item) => (
              <DaCheckRow
                key={item.id}
                label={item.label}
                description={item.description}
                icon={item.icon}
                checked={selectedEquipment.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </DaRowGroup>
        </View>
      ) : null}

      {afficherSupplementaires ? (
        <View style={styles.groupe}>
          <Pressable
            onPress={() => setOuvert((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: ouvert }}
            style={styles.enteteRepliable}
          >
            <Text style={styles.libelleRepliable} maxFontSizeMultiplier={PLAFOND_TEXTE}>
              Équipement supplémentaire · {nombreCoches} coché{nombreCoches > 1 ? "s" : ""}
            </Text>
            <Ionicons
              name={ouvert ? "chevron-up" : "chevron-down"}
              size={20}
              color={da.colors.sub}
            />
          </Pressable>
          {ouvert ? (
            <DaRowGroup>
              {supplementaires.map((item) => (
                <DaCheckRow
                  key={item.id}
                  label={item.label}
                  checked={selectedEquipment.includes(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </DaRowGroup>
          ) : null}
        </View>
      ) : null}

      {showBodyweightHint ? (
        <View style={styles.bodyweightHint}>
          <Ionicons name="body-outline" size={16} color={da.colors.sub} />
          <Text style={styles.bodyweightHintText} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Aucun matériel ? La séance sera au poids du corps.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** En-tête discret d'un groupe, affiché seulement en séance mixte (§3.6). */
function GroupHeader({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.groupHeader}>
      <Ionicons name={icon} size={18} color={da.colors.text} />
      <Text style={styles.groupHeaderLabel} maxFontSizeMultiplier={PLAFOND_TEXTE}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: da.spacing.md,
  },
  titre: {
    ...da.typography.section,
    color: da.colors.text,
  },
  sousTexte: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  chargement: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.xs,
  },
  groupe: {
    gap: da.spacing.xs,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.xs,
  },
  groupHeaderLabel: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  ligneStandard: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.sm,
    paddingVertical: da.spacing.sm,
    paddingHorizontal: da.spacing.md,
    minHeight: 56,
  },
  texteStandard: {
    flex: 1,
    gap: 2,
  },
  libelleStandard: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  descriptionStandard: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  enteteRepliable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: da.spacing.xs,
  },
  libelleRepliable: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
    flex: 1,
  },
  bodyweightHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.xs,
  },
  bodyweightHintText: {
    flex: 1,
    ...da.typography.secondary,
    color: da.colors.sub,
  },
});
