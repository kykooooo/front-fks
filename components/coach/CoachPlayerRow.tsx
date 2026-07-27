// components/coach/CoachPlayerRow.tsx
//
// Une ligne d'effectif. Dense, scannable, et volontairement PAUVRE : au maximum
// trois informations (identité, contexte, dernière activité) plus un statut.
//
// POURQUOI cette limite de trois lignes.
// La tentation est d'entasser ici tout ce qu'on sait du joueur — la ligne
// devient alors une fiche miniature, et l'effectif n'est plus scannable : le
// coach ne peut plus répondre en un coup d'œil à "qui n'a rien fait ?". Le
// détail appartient à la fiche joueur, pas à la liste. Si une information ne
// sert pas à décider "j'ouvre cette fiche ou pas", elle sort.
//
// Composant purement présentationnel.

import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useCoachLayout } from "./CoachScreen";
import { CoachStatusPill } from "./CoachStatusPill";
import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  statusTone,
  type CoachStatusLevel,
} from "./coachTheme";

type CoachPlayerRowProps = {
  /** Prénom tel que projeté par le serveur (peut être absent). */
  firstName: string | null;
  /** Contexte court déjà composé en amont, ex. "Milieu · U17". */
  meta?: string | null;
  statusLevel: CoachStatusLevel;
  /** Libellé de statut personnalisé (le niveau reste ce qui porte le sens). */
  statusLabel?: string;
  /**
   * Nuance du statut qui ne tient pas dans la pastille — aujourd'hui
   * « Rien à signaler parmi les données disponibles » (cf.
   * `domain/coachView/statusLabel.coachStatusPrecision`).
   *
   * POURQUOI UNE LIGNE EN PLUS PLUTÔT QU'UNE PASTILLE PLUS LONGUE. La phrase
   * fait 44 caractères : dans une pastille posée à droite d'un prénom, elle se
   * coupe en plein mot et la nuance disparaît précisément là où elle compte.
   * Affichée en dessous, elle se lit entière ; passée aussi à la pastille
   * (`fullLabel`), elle s'entend au lecteur d'écran. `null` = rien à nuancer,
   * et la ligne n'existe pas : on n'ajoute pas une phrase de bruit par joueur.
   */
  statusPrecision?: string | null;
  /**
   * Dernière activité en langage clair, ex. "Séance faite hier".
   * `null` -> "Aucune séance enregistrée" : on dit l'absence, on ne l'omet pas.
   */
  activityLabel?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const NO_NAME = "Joueur sans prénom";
const NO_ACTIVITY = "Aucune séance enregistrée";

/** Initiale de l'avatar. Aucun prénom -> "?" (jamais une lettre inventée). */
function initialOf(firstName: string | null): string {
  const trimmed = (firstName ?? "").trim();
  return trimmed ? trimmed.slice(0, 1).toLocaleUpperCase("fr-FR") : "?";
}

export function CoachPlayerRow({
  firstName,
  meta,
  statusLevel,
  statusLabel,
  statusPrecision,
  activityLabel,
  onPress,
  style,
  testID,
}: CoachPlayerRowProps) {
  const { narrow } = useCoachLayout();
  const tone = statusTone(statusLevel);
  const displayName = (firstName ?? "").trim() || NO_NAME;
  const activity = (activityLabel ?? "").trim() || NO_ACTIVITY;
  const metaText = (meta ?? "").trim();
  const precisionText = (statusPrecision ?? "").trim();

  // Sur un écran très étroit (320 pt), prénom et pastille côte à côte se
  // tronquent l'un l'autre. On descend alors la pastille sur sa propre ligne.
  const pillInline = !narrow;

  const pill = (
    <CoachStatusPill
      level={statusLevel}
      label={statusLabel}
      fullLabel={precisionText || null}
      size="sm"
      style={pillInline ? styles.pillInline : styles.pillStacked}
    />
  );

  // Une seule annonce pour toute la ligne : le lecteur d'écran ne doit pas
  // égrener quatre fragments sans lien. Le statut annoncé est le libellé
  // COMPLET quand il en existe un — jamais le raccourci de la pastille.
  const a11yLabel = [
    displayName,
    metaText,
    `Statut : ${statusLabel ?? (precisionText || tone.libelle)}`,
    activity,
  ]
    .filter(Boolean)
    .join(". ");

  const content = (
    <View style={[styles.row, style]} testID={testID}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText} numberOfLines={1}>
          {initialOf(firstName)}
        </Text>
      </View>

      <View style={styles.center}>
        <View style={styles.nameLine}>
          {/* Contenu serveur -> numberOfLines obligatoire (CLAUDE.md règle d'or). */}
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {pillInline ? pill : null}
        </View>

        {/* DEUX lignes, à TOUTES les largeurs, et ce n'est pas un détail
            cosmétique. Cette ligne porte la RAISON de la présence du joueur
            dans "À vérifier aujourd'hui" ("Séance prévue vendredi, pas encore
            faite"). Bornée à une ligne, elle se coupait en plein mot à 375 pt
            — le coach lisait "…pas encore f…" et perdait exactement
            l'information qui déclenche l'appel. On AUGMENTE la borne, on ne la
            retire pas : un libellé serveur à rallonge doit toujours s'arrêter.
            Dans l'effectif, où cette ligne ne porte qu'un contexte court
            ("Milieu · U17"), elle tient d'elle-même sur une seule ligne. */}
        {metaText ? (
          <Text style={styles.meta} numberOfLines={2}>
            {metaText}
          </Text>
        ) : null}

        <Text style={styles.activity} numberOfLines={1}>
          {activity}
        </Text>

        {/* Nuance du statut : deux lignes, parce que la phrase entière DOIT se
            lire. C'est elle qui empêche « Rien à signaler » de passer pour une
            preuve alors qu'il manque des données. */}
        {precisionText ? (
          <Text style={styles.precision} numberOfLines={2} testID="coach-row-status-precision">
            {precisionText}
          </Text>
        ) : null}

        {pillInline ? null : pill}
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={coachColors.muted} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Ouvre la fiche du joueur"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.sm,
    paddingVertical: coachSpacing.sm,
    paddingHorizontal: coachSpacing.md,
    // minHeight (jamais height) : la ligne s'étire si la police système grossit
    // ou si la pastille descend sur sa propre ligne.
    minHeight: coachLayout.rowMinHeight,
    backgroundColor: coachColors.card,
  },
  pressed: { opacity: 0.6 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: coachRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: coachColors.accentSoft,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
  },
  avatarText: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "800",
    color: coachColors.accent,
  },
  // flexShrink : sans lui, un prénom long pousse la pastille hors de l'écran.
  center: { flex: 1, flexShrink: 1, gap: 2 },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
  },
  name: {
    flexShrink: 1,
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  pillInline: { marginLeft: "auto" },
  pillStacked: { marginTop: coachSpacing.xxs },
  meta: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  activity: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
  },
  precision: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },
});
