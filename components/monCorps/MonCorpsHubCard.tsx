// components/monCorps/MonCorpsHubCard.tsx
//
// LA CARTE D'ENTREE DE « MON CORPS », EN HAUT DU HUB SEANCE (decision D2).
//
// Elle a DEUX etats, et un seul a la fois :
//   - etat courant : une ligne qui dit ce qui est declare, ou « rien de
//     signale ». Aucun compteur : pas de « 0 gene », pas de « 2 blessures ».
//   - RELANCE (decision D5) : quand une gene en cours n'a pas ete touchee
//     depuis 7 jours, la carte devient une QUESTION avec ses trois reponses.
//     Sans reponse, la gene reste active — la carte n'expire rien, elle demande.
//
// Ce qu'on n'ecrit JAMAIS ici : le nombre de jours. « Ta gene date de 9 jours »
// transforme une question en reproche, et le chiffre n'aide en rien le joueur a
// repondre. La question suffit.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../constants/theme";
import { da, PLAFOND_TEXTE as DA_PLAFOND_TEXTE, TOUCHE_MIN } from "../../constants/daJoueur";
import { useHaptics } from "../../hooks/useHaptics";
import { changerStatutBlessure } from "../../hooks/monCorps/monCorpsActions";
import { useMonCorpsViewModel } from "../../hooks/monCorps/useMonCorpsViewModel";
import { DaNavRow, DaNotice, DaTextButton } from "../ui/da";

const C = theme.colors;
const PLAFOND_TITRE = 1.2;

type Props = {
  onPress: () => void;
  /**
   * `"hub"` (défaut) : rendu ACTUEL strictement inchangé — c'est l'onglet
   * Séance, hors périmètre du chantier DA Accueil. `"accueil"` : habillage
   * `da` (SPEC_DA_ACCUEIL_SEANCE.md §2.5), MÊMES textes, MÊMES trois réponses,
   * MÊME action `changerStatutBlessure`.
   */
  variant?: "hub" | "accueil";
};

export function MonCorpsHubCard({ onPress, variant = "hub" }: Props) {
  const vm = useMonCorpsViewModel();
  const haptics = useHaptics();
  const aRelancer = vm.aRelancer[0] ?? null;

  const repondre = (statut: "active" | "recovering" | "healed") => {
    if (!aRelancer) return;
    haptics.impactLight();
    changerStatutBlessure(aRelancer.id, statut);
  };

  const resume = vm.enCours.length
    ? vm.enCours.map((l) => `${l.zoneLabel.toLowerCase()} — ${l.graviteLabelCourt.toLowerCase()}`).join(" · ")
    : "Une gêne à signaler ?";

  if (variant === "accueil") {
    if (aRelancer) {
      return (
        <View style={styles.carteAccueilRelance}>
          <DaNotice
            tone="warn"
            icon="body-outline"
            title="Mon corps"
            message={`Ta gêne (${aRelancer.zoneLabel.toLowerCase()}) est toujours gênante ?`}
          >
            <View style={styles.rangeeAccueil}>
              <TouchableOpacity
                style={styles.puceAccueil}
                onPress={() => repondre("active")}
                accessibilityRole="button"
                accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme toujours là`}
              >
                <Text style={styles.puceAccueilTexte} maxFontSizeMultiplier={DA_PLAFOND_TEXTE}>
                  Toujours là
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.puceAccueil}
                onPress={() => repondre("recovering")}
                accessibilityRole="button"
                accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme en reprise`}
              >
                <Text style={styles.puceAccueilTexte} maxFontSizeMultiplier={DA_PLAFOND_TEXTE}>
                  En reprise
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.puceAccueil}
                onPress={() => repondre("healed")}
                accessibilityRole="button"
                accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme guérie`}
              >
                <Text style={styles.puceAccueilTexte} maxFontSizeMultiplier={DA_PLAFOND_TEXTE}>
                  C'est guéri
                </Text>
              </TouchableOpacity>
            </View>
            <DaTextButton label="Ouvrir Mon corps" onPress={onPress} icon="chevron-forward" />
          </DaNotice>
        </View>
      );
    }

    return (
      <DaNavRow
        icon="body-outline"
        title="Mon corps"
        subtitle={resume}
        onPress={() => {
          haptics.impactLight();
          onPress();
        }}
        accessibilityLabel={`Mon corps. ${resume}. Ouvrir.`}
      />
    );
  }

  if (aRelancer) {
    return (
      <View style={[styles.carte, styles.carteRelance]}>
        <View style={styles.enTete}>
          <Ionicons name="body-outline" size={18} color={C.warn} />
          <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>
            Mon corps
          </Text>
        </View>
        <Text style={styles.question}>
          Ta gêne ({aRelancer.zoneLabel.toLowerCase()}) est toujours gênante ?
        </Text>
        <View style={styles.rangee}>
          <TouchableOpacity
            style={styles.puce}
            onPress={() => repondre("active")}
            accessibilityRole="button"
            accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme toujours là`}
          >
            <Text style={styles.puceTexte}>Toujours là</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.puce}
            onPress={() => repondre("recovering")}
            accessibilityRole="button"
            accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme en reprise`}
          >
            <Text style={styles.puceTexte}>En reprise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.puce}
            onPress={() => repondre("healed")}
            accessibilityRole="button"
            accessibilityLabel={`Marquer la gêne ${aRelancer.zoneLabel} comme guérie`}
          >
            <Text style={styles.puceTexte}>C'est guéri</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.lien}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir Mon corps"
        >
          <Text style={styles.lienTexte}>Ouvrir Mon corps</Text>
          <Ionicons name="chevron-forward" size={16} color={C.sub} />
        </TouchableOpacity>
      </View>
    );
  }

  const resumeHub = vm.enCours.length
    ? vm.enCours.map((l) => `${l.zoneLabel.toLowerCase()} — ${l.graviteLabelCourt.toLowerCase()}`).join(" · ")
    : "Rien de signalé";

  return (
    <TouchableOpacity
      style={styles.carte}
      onPress={() => {
        haptics.impactLight();
        onPress();
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Mon corps. ${resumeHub}. Ouvrir.`}
    >
      <View style={styles.enTete}>
        <Ionicons name="body-outline" size={18} color={C.accent} />
        <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>
          Mon corps
        </Text>
        <Ionicons name="chevron-forward" size={18} color={C.sub} />
      </View>
      <Text style={styles.resume} numberOfLines={2}>
        {resumeHub}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carte: {
    minHeight: 72,
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardSoft,
  },
  carteRelance: { borderColor: C.warn, gap: 10 },
  enTete: { flexDirection: "row", alignItems: "center", gap: 8 },
  titre: { flex: 1, fontSize: 15, fontWeight: "700", color: C.text },
  resume: { fontSize: 13, lineHeight: 18, color: C.sub },
  question: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: C.text },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  puce: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
  },
  puceTexte: { fontSize: 13, fontWeight: "600", color: C.text },
  lien: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lienTexte: { fontSize: 13, fontWeight: "600", color: C.sub },
  // ── Variante "accueil" (jetons `da`, SPEC_DA_ACCUEIL_SEANCE.md §2.5) ──
  carteAccueilRelance: {
    gap: da.spacing.sm,
  },
  rangeeAccueil: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: da.spacing.xs,
  },
  puceAccueil: {
    minHeight: TOUCHE_MIN,
    justifyContent: "center",
    paddingHorizontal: da.spacing.md,
    borderRadius: da.radius.pill,
    borderWidth: 1.5,
    borderColor: da.colors.controlBorder,
    backgroundColor: da.colors.card,
  },
  puceAccueilTexte: {
    fontSize: 13,
    fontWeight: "600",
    color: da.colors.text,
  },
});
