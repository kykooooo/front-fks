// screens/newSession/ui/CarteEchecGeneration.tsx
//
// État d'erreur de génération : calme, compréhensible, sans détail technique.
// Il dit ce qui s'est passé, redit que rien n'a été enregistré, et donne des
// sorties. Il ne propose JAMAIS de séance de remplacement.
//
// Restylage DA joueur (SPEC_DA_ACCUEIL_SEANCE.md §3.8) : MÊME contrat de
// props, MÊMES libellés d'action. Le gabarit visuel reprend celui de
// `DaNotice` (filet + icône colorée, carte blanche) mais est recomposé
// localement plutôt que d'importer le composant : `DaNotice` ne permet pas de
// piloter `numberOfLines` sur son message, alors qu'un refus de sécurité
// (texte long, jamais coupé à 6 lignes) et une panne (coupée à 6 lignes)
// exigent deux valeurs différentes sur EXACTEMENT le même texte — voir le
// test qui épingle ce nombre. Écart documenté dans le rapport de mission.

import React, { useEffect } from "react";
import { View, Text, StyleSheet, AccessibilityInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";
import { DaPrimaryButton } from "../../../components/ui/da/DaPrimaryButton";
import { DaTextButton } from "../../../components/ui/da/DaTextButton";
import type { ActionEchec, EchecGeneration } from "../echecGeneration";

type Props = {
  echec: EchecGeneration;
  actions: ActionEchec[];
  /** Une génération est en vol : toutes les actions sont neutralisées. */
  occupe: boolean;
  onReessayer: () => void;
  /** Rejoue l'enregistrement/l'affichage d'une séance DÉJÀ GÉNÉRÉE — jamais un nouvel appel payant. */
  onReessayerEnregistrement: () => void;
  onModifierContraintes: () => void;
  onChoisirCycle: () => void;
  onSeReconnecter: () => void;
  onReprendreSeance: () => void;
  onOuvrirMonCorps: () => void;
  onRetourAccueil: () => void;
};

const LIBELLES: Record<ActionEchec, string> = {
  reessayer: "Réessayer",
  reessayer_enregistrement: "Réessayer l'enregistrement",
  modifier_contraintes: "Modifier mon lieu ou mon matériel",
  choisir_cycle: "Choisir un cycle",
  se_reconnecter: "Me reconnecter",
  reprendre_seance: "Reprendre ma séance",
  ouvrir_mon_corps: "Ouvrir Mon corps",
  retour_accueil: "Revenir à l'accueil",
};

export function CarteEchecGeneration({
  echec,
  actions,
  occupe,
  onReessayer,
  onReessayerEnregistrement,
  onModifierContraintes,
  onChoisirCycle,
  onSeReconnecter,
  onReprendreSeance,
  onOuvrirMonCorps,
  onRetourAccueil,
}: Props) {
  const gestionnaires: Record<ActionEchec, () => void> = {
    reessayer: onReessayer,
    reessayer_enregistrement: onReessayerEnregistrement,
    modifier_contraintes: onModifierContraintes,
    choisir_cycle: onChoisirCycle,
    se_reconnecter: onSeReconnecter,
    reprendre_seance: onReprendreSeance,
    ouvrir_mon_corps: onOuvrirMonCorps,
    retour_accueil: onRetourAccueil,
  };

  // Refus de sécurité : ce n'est pas une panne, c'est une décision du coach.
  // Même carte, ton différent : ton "info" neutre (pas rouge), et aucune
  // action de relance (elles n'arrivent pas jusqu'ici, cf. `actionsDuContrat`).
  const refusSecurite = echec.categorie === "securite";
  const titre = refusSecurite ? "Pas de séance aujourd'hui" : "On n'a pas pu préparer ta séance";
  const couleurTon = refusSecurite ? da.colors.text : da.colors.dangerText;
  const iconeTon: keyof typeof Ionicons.glyphMap = refusSecurite
    ? "information-circle"
    : "alert-circle";

  // Annonce lecteur d'écran à l'apparition (montage = apparition : cette
  // carte n'est jamais gardée en vie masquée, l'écran la démonte quand
  // `echec` redevient null).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${titre}. ${echec.messageJoueur}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.carte} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.filet, { backgroundColor: couleurTon }]} />
      <View style={styles.corps}>
        <View style={styles.entete}>
          <Ionicons name={iconeTon} size={20} color={couleurTon} />
          <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            {titre}
          </Text>
        </View>

        {/* Message du contrat backend affiché tel quel, ou texte client quand le
            serveur n'a rien pu dire. Ni code, ni statut HTTP, ni étape interne. */}
        <Text
          style={[styles.message, refusSecurite && styles.messageSecurite]}
          numberOfLines={refusSecurite ? 16 : 6}
          maxFontSizeMultiplier={PLAFOND_TEXTE}
        >
          {echec.messageJoueur}
        </Text>

        {echec.attendreS ? (
          <Text style={styles.attente} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Patiente environ {echec.attendreS} seconde{echec.attendreS > 1 ? "s" : ""} avant de
            relancer.
          </Text>
        ) : null}

        <View style={styles.actions}>
          {actions.map((action, index) =>
            index === 0 ? (
              <DaPrimaryButton
                key={action}
                label={LIBELLES[action]}
                onPress={gestionnaires[action]}
                disabled={occupe}
                arrow={false}
              />
            ) : (
              <DaTextButton
                key={action}
                label={LIBELLES[action]}
                onPress={gestionnaires[action]}
                disabled={occupe}
              />
            )
          )}
        </View>

        {/* Pas de référence support sur un refus de sécurité : rien n'est cassé,
            il n'y a pas d'incident à faire remonter. */}
        {echec.requestId && !refusSecurite ? (
          <Text
            style={styles.reference}
            selectable
            numberOfLines={1}
            maxFontSizeMultiplier={PLAFOND_TEXTE}
          >
            Réf. support : {echec.requestId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row",
    borderRadius: da.radius.tile,
    borderWidth: 1,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
    overflow: "hidden",
    marginBottom: da.spacing.sm,
  },
  filet: {
    width: 3,
  },
  corps: {
    flex: 1,
    padding: da.spacing.md,
    gap: da.spacing.xs,
  },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.xs,
  },
  titre: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
    flexShrink: 1,
  },
  message: {
    ...da.typography.secondary,
    color: da.colors.sub,
    minHeight: 38,
  },
  // Sur le filet teinté du refus, `sub` tiendrait tout juste le seuil AA :
  // marge trop faible pour un texte que le joueur doit lire jusqu'au bout. On
  // passe à `text`, nettement plus contrasté.
  messageSecurite: {
    color: da.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  attente: {
    ...da.typography.secondary,
    color: da.colors.sub,
    fontStyle: "italic",
  },
  actions: {
    gap: da.spacing.xs,
    marginTop: 2,
  },
  reference: {
    marginTop: 2,
    fontSize: 10,
    color: da.colors.sub,
    opacity: 0.7,
  },
});
