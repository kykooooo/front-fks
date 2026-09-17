// components/home/HomeHeader.tsx
// En-tête de l'accueil (SPEC_DA_ACCUEIL_SEANCE.md §2.2) : marque FKS + avatar,
// date en kicker, grande salutation sur deux lignes. Aucune pastille d'état —
// l'info de forme vit désormais dans la carte « Ta forme » plus bas (2.1).
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { da, PLAFOND_TEXTE, PLAFOND_TITRE, TOUCHE_MIN } from "../../constants/daJoueur";
import { BrandMark } from "../ui/BrandMark";
import { extrairePrenom, salutation } from "../../hooks/home/homePresentation";
import { DaKicker } from "../ui/da";
import type { PrimaryCtaKind } from "../../hooks/home/usePrimaryCta";

type Props = {
  /** `devNowISO` si présent — sinon l'en-tête utilise l'heure réelle. */
  dateISO?: string;
  displayName?: string | null;
  kind: PrimaryCtaKind;
  onPressAvatar: () => void;
};

function HomeHeaderInner({ dateISO, displayName, kind, onPressAvatar }: Props) {
  const base = dateISO ? new Date(dateISO) : new Date();
  const dateLabel = format(base, "EEEE d MMMM", { locale: fr });
  const prenom = extrairePrenom(displayName);
  const texteSalutation = salutation(kind, prenom);
  const initiale = prenom ? prenom.charAt(0).toUpperCase() : null;

  return (
    <View>
      <View style={styles.rangeeMarque}>
        <BrandMark size="md" />
        <Pressable
          onPress={onPressAvatar}
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon profil"
        >
          {initiale ? (
            <Text style={styles.avatarInitiale} maxFontSizeMultiplier={PLAFOND_TEXTE}>
              {initiale}
            </Text>
          ) : (
            <Ionicons name="person-outline" size={20} color={da.colors.text} />
          )}
        </Pressable>
      </View>
      <DaKicker style={styles.date}>{dateLabel}</DaKicker>
      <Text style={styles.salutation} accessibilityRole="header" maxFontSizeMultiplier={PLAFOND_TITRE}>
        {texteSalutation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeeMarque: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: TOUCHE_MIN,
    height: TOUCHE_MIN,
    borderRadius: da.radius.pill,
    backgroundColor: da.colors.card,
    borderWidth: 1,
    borderColor: da.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitiale: {
    fontSize: 16,
    fontWeight: "700",
    color: da.colors.text,
  },
  date: {
    marginTop: da.spacing.md,
  },
  salutation: {
    ...da.typography.display,
    color: da.colors.text,
    marginTop: da.spacing.xxs,
  },
});

export default React.memo(HomeHeaderInner);
