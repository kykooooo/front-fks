// components/home/HomeAdviceCard.tsx
// Conseil contextuel (SPEC_DA_ACCUEIL_SEANCE.md §2.8) : passé sur `DaNotice`
// — carte blanche, icône + filet colorés selon `tone`, plus d'aplat coloré ni
// de badge « Conseil du jour » coloré (kicker sobre au-dessus). `tip` et le
// bouton d'action sont conservés, mêmes textes, même navigation.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHaptics } from "../../hooks/useHaptics";
import { da, PLAFOND_TEXTE } from "../../constants/daJoueur";
import { DaKicker, DaNotice, DaTextButton } from "../ui/da";
import type { Advice } from "../../domain/adviceRules";

type Props = {
  advice: Advice;
};

function HomeAdviceCardInner({ advice }: Props) {
  if (__DEV__) console.log("[RENDER] HomeAdviceCard");
  const nav = useNavigation<any>();
  const haptics = useHaptics();

  const handleAction = () => {
    haptics.impactLight();
    if (advice.actionRoute) {
      nav.navigate(advice.actionRoute, advice.actionParams ?? {});
    }
  };

  return (
    <View style={styles.enveloppe}>
      <DaKicker>CONSEIL DU JOUR</DaKicker>
      <DaNotice
        tone={advice.tone}
        icon={advice.icon as any}
        title={advice.title}
        message={advice.message}
      >
        {advice.tip ? (
          <Text style={styles.tip} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={3}>
            {advice.tip}
          </Text>
        ) : null}
        {advice.actionLabel ? (
          <DaTextButton label={advice.actionLabel} onPress={handleAction} icon="arrow-forward" />
        ) : null}
      </DaNotice>
    </View>
  );
}

const styles = StyleSheet.create({
  enveloppe: {
    gap: da.spacing.xs,
  },
  tip: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
});

export default React.memo(HomeAdviceCardInner);
