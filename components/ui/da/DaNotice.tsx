// components/ui/da/DaNotice.tsx
// Note d'état compacte (conseil du jour, séance en attente, erreur…). Par
// défaut : carte blanche bordée — JAMAIS un grand aplat coloré, seuls
// l'icône et un filet gauche de 3 px portent la couleur du ton
// (SPEC_DA_ACCUEIL_SEANCE.md §1.2). Variante `flat` (finition F5,
// 17/09/2026) : posée DANS une `DaCard` (donc déjà bordée/ombrée), la note
// n'a plus besoin de son propre cadre — sans lui, deux notes dans une carte
// dessinaient une carte dans la carte.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";

export type DaNoticeTone = "info" | "warn" | "danger" | "success";

type DaNoticeProps = {
  tone: DaNoticeTone;
  /** Icône Ionicons ; un défaut raisonnable existe par ton si omise. */
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message: string;
  /** Zone d'actions (DaTextButton, DaPrimaryButton…) sous le message. */
  children?: React.ReactNode;
  /** `true` → la note s'annonce elle-même (accessibilityRole="alert" + live region). */
  live?: boolean;
  /**
   * `true` → sans bordure ni ombre, fond teinté (`warnSoft`/`dangerSoft`/
   * `successSoft` selon le ton, `bg` pour `info`), rayon 12, padding 12.
   * Filet gauche et icône conservés. Réservé aux notes posées DANS une
   * `DaCard` (jamais une carte dans une carte). Défaut `false` = rendu
   * actuel inchangé.
   */
  flat?: boolean;
  testID?: string;
};

const ICONE_PAR_TON: Record<DaNoticeTone, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle",
  warn: "warning",
  danger: "alert-circle",
  success: "checkmark-circle",
};

/** Couleur de l'icône — inchangée par `flat`. */
function couleurIcone(tone: DaNoticeTone): string {
  switch (tone) {
    case "warn":
      return da.colors.warnText;
    case "danger":
      return da.colors.dangerText;
    case "success":
      return da.colors.successText;
    case "info":
    default:
      return da.colors.text;
  }
}

/**
 * Couleur du filet gauche. Pour `info`, distincte de l'icône depuis F5 :
 * `controlBorder` (contour neutre) au lieu de `text` — une barre noire aussi
 * dure que du texte principal lisait comme une erreur sur « Conseil du
 * jour », alors que "info" n'en est pas une.
 */
function couleurFilet(tone: DaNoticeTone): string {
  if (tone === "info") return da.colors.controlBorder;
  return couleurIcone(tone);
}

/** Fond teinté de la variante `flat`, par ton. */
function fondFlat(tone: DaNoticeTone): string {
  switch (tone) {
    case "warn":
      return da.colors.warnSoft;
    case "danger":
      return da.colors.dangerSoft;
    case "success":
      return da.colors.successSoft;
    case "info":
    default:
      return da.colors.bg;
  }
}

function DaNoticeBase({
  tone,
  icon,
  title,
  message,
  children,
  live = false,
  flat = false,
  testID,
}: DaNoticeProps) {
  const couleurIconeVal = couleurIcone(tone);
  const couleurFiletVal = couleurFilet(tone);
  const filetStyle = { backgroundColor: couleurFiletVal };
  const fondFlatStyle = flat ? { backgroundColor: fondFlat(tone) } : undefined;
  const accessibilityProps = live
    ? ({ accessibilityRole: "alert", accessibilityLiveRegion: "polite" } as const)
    : ({} as const);

  return (
    <View
      style={[styles.card, flat && styles.cardFlat, fondFlatStyle]}
      testID={testID}
      {...accessibilityProps}
    >
      <View style={[styles.filet, filetStyle]} />
      <View style={styles.iconWrap}>
        <Ionicons name={icon ?? ICONE_PAR_TON[tone]} size={20} color={couleurIconeVal} />
      </View>
      <View style={styles.contenu}>
        {title ? (
          <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.message} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          {message}
        </Text>
        {children ? <View style={styles.actions}>{children}</View> : null}
      </View>
    </View>
  );
}

export const DaNotice = React.memo(DaNoticeBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: da.radius.tile,
    borderWidth: 1,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    overflow: "hidden",
    paddingVertical: 12,
    paddingRight: 16,
    gap: 10,
  },
  cardFlat: {
    borderRadius: 12,
    borderWidth: 0,
    padding: 12,
  },
  filet: {
    width: 3,
  },
  iconWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  contenu: {
    flex: 1,
    gap: 4,
  },
  titre: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: da.colors.text,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: da.colors.sub,
  },
  actions: {
    marginTop: 6,
    gap: 4,
  },
});
