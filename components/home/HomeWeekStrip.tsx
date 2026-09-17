// components/home/HomeWeekStrip.tsx
// « Cette semaine » (SPEC_DA_ACCUEIL_SEANCE.md §2.4) : 7 pastilles, une par
// jour de la semaine calendaire du joueur (`useWeekDays`, déjà appelé côté
// écran — ce composant ne lit aucun store). Bande NON interactive : la
// couleur ne porte jamais seule l'état (coche / point / anneau / mot s'y
// ajoutent toujours), et rien ici n'est inventé — tout vient des drapeaux du
// hook.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { da, PLAFOND_TEXTE } from "../../constants/daJoueur";
import { DaKicker } from "../ui/da";
import { decrireJourSemaine } from "../../hooks/home/homePresentation";
import type { WeekDayItem } from "../../hooks/home/useWeekDays";

type Props = {
  weekDays: WeekDayItem[];
  fksCount: number;
  weeklyGoal: number;
  activityStreak: number;
  matchSoon: boolean;
};

function nomLongDuJour(dateKey: string): string {
  // `dateKey` est un "YYYY-MM-DD" local (toDateKey) : midi évite tout risque
  // de bascule de jour en le parsant.
  return format(new Date(`${dateKey}T12:00:00`), "EEEE", { locale: fr });
}

function Pastille({ item }: { item: WeekDayItem }) {
  if (item.hasFks) {
    return (
      <View style={[styles.pastille, styles.pastilleFaite]}>
        <Ionicons name="checkmark" size={16} color={da.colors.onAction} />
      </View>
    );
  }
  if (item.hasExt) {
    return (
      <View style={[styles.pastille, styles.pastilleExterne]}>
        <Ionicons name="checkmark" size={16} color={da.colors.text} />
      </View>
    );
  }
  if (item.hasPlanned) {
    return (
      <View style={[styles.pastille, styles.pastilleVide]}>
        <View style={styles.pointPrevu} />
      </View>
    );
  }
  return <View style={[styles.pastille, styles.pastilleVide]} />;
}

function ColonneJour({ item }: { item: WeekDayItem }) {
  const nomLong = nomLongDuJour(item.key);
  const label = decrireJourSemaine(item, nomLong);
  const legende = item.hasMatch ? "Match" : item.hasClub ? "Club" : null;

  return (
    <View style={styles.colonne} accessible accessibilityLabel={label}>
      {/* Conteneur d'anneau FIXE (40×40) pour TOUTES les colonnes — bordure
          transparente quand ce n'est pas aujourd'hui, pour que la place de
          l'anneau soit réservée partout et que les 7 lettres restent alignées
          (F3 : sans ce conteneur commun, seule la colonne du jour avait une
          pastille agrandie, ce qui faisait descendre sa lettre). */}
      <View style={[styles.anneauConteneur, item.isToday && styles.anneauActif]}>
        <Pastille item={item} />
      </View>
      <Text
        style={[styles.lettre, item.isToday && styles.lettreAujourdhui]}
        maxFontSizeMultiplier={PLAFOND_TEXTE}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      {legende ? (
        <Text style={styles.legende} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
          {legende}
        </Text>
      ) : null}
    </View>
  );
}

function HomeWeekStripInner({ weekDays, fksCount, weeklyGoal, activityStreak, matchSoon }: Props) {
  const afficherPied = activityStreak > 0 || matchSoon;

  return (
    <View>
      <View style={styles.enTete}>
        <DaKicker>CETTE SEMAINE</DaKicker>
        <Text style={styles.compteur} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
          {fksCount} / {weeklyGoal} séances
        </Text>
      </View>
      <View style={styles.bande}>
        {weekDays.map((item) => (
          <ColonneJour key={item.key} item={item} />
        ))}
      </View>
      {afficherPied ? (
        <View style={styles.pied}>
          {activityStreak > 0 ? (
            <Text style={styles.piedTexte} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={1}>
              Série en cours : {activityStreak} j
            </Text>
          ) : null}
          {matchSoon ? (
            <View style={styles.piedMatch}>
              <Ionicons name="alert-circle-outline" size={14} color={da.colors.warnText} />
              <Text
                style={styles.piedMatchTexte}
                maxFontSizeMultiplier={PLAFOND_TEXTE}
                numberOfLines={1}
              >
                Match proche
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  enTete: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: da.spacing.xs,
  },
  compteur: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  bande: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: da.spacing.sm,
    gap: da.spacing.xxs,
  },
  colonne: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  anneauConteneur: {
    width: 40,
    height: 40,
    borderRadius: da.radius.pill,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  anneauActif: {
    borderColor: da.colors.action,
  },
  pastille: {
    width: 32,
    height: 32,
    borderRadius: da.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleFaite: {
    backgroundColor: da.colors.action,
  },
  pastilleExterne: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: da.colors.text,
  },
  pastilleVide: {
    backgroundColor: da.colors.card,
    borderWidth: 1,
    borderColor: da.colors.border,
  },
  pointPrevu: {
    width: 7,
    height: 7,
    borderRadius: da.radius.pill,
    backgroundColor: da.colors.action,
  },
  lettre: {
    fontSize: 13,
    fontWeight: "600",
    color: da.colors.text,
  },
  lettreAujourdhui: {
    color: da.colors.actionText,
    fontWeight: "700",
  },
  legende: {
    fontSize: 11,
    color: da.colors.sub,
  },
  pied: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: da.spacing.sm,
    marginTop: da.spacing.sm,
  },
  piedTexte: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  piedMatch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  piedMatchTexte: {
    ...da.typography.secondary,
    color: da.colors.warnText,
  },
});

export default React.memo(HomeWeekStripInner);
