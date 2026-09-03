// screens/newSession/ui/CarteEchecGeneration.tsx
//
// État d'erreur de génération : calme, compréhensible, sans détail technique.
// Il dit ce qui s'est passé, redit que rien n'a été enregistré, et donne des
// sorties. Il ne propose JAMAIS de séance de remplacement.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "../../../components/ui/Button";
import { palette } from "../theme";
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
  onRetourAccueil: () => void;
};

const LIBELLES: Record<ActionEchec, string> = {
  reessayer: "Réessayer",
  reessayer_enregistrement: "Réessayer l'enregistrement",
  modifier_contraintes: "Modifier mon lieu ou mon matériel",
  choisir_cycle: "Choisir un cycle",
  se_reconnecter: "Me reconnecter",
  reprendre_seance: "Reprendre ma séance",
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
  onRetourAccueil,
}: Props) {
  const gestionnaires: Record<ActionEchec, () => void> = {
    reessayer: onReessayer,
    reessayer_enregistrement: onReessayerEnregistrement,
    modifier_contraintes: onModifierContraintes,
    choisir_cycle: onChoisirCycle,
    se_reconnecter: onSeReconnecter,
    reprendre_seance: onReprendreSeance,
    retour_accueil: onRetourAccueil,
  };

  // Refus de sécurité : ce n'est pas une panne, c'est une décision du coach.
  // Même carte, ton différent : pas de « on n'a pas pu », pas de rouge, et
  // aucune action de relance (elles n'arrivent pas jusqu'ici, cf.
  // `actionsDuContrat`). Le texte est plus long que celui d'une panne (raison,
  // explication, voie de sortie, avertissement santé) : il lui faut ses lignes.
  const refusSecurite = echec.categorie === "securite";

  return (
    <View style={[styles.carte, refusSecurite && styles.carteSecurite]}>
      <Text style={styles.titre}>
        {refusSecurite ? "Pas de séance aujourd'hui" : "On n'a pas pu préparer ta séance"}
      </Text>

      {/* Message du contrat backend affiché tel quel, ou texte client quand le
          serveur n'a rien pu dire. Ni code, ni statut HTTP, ni étape interne. */}
      <Text
        style={[styles.message, refusSecurite && styles.messageSecurite]}
        numberOfLines={refusSecurite ? 16 : 6}
      >
        {echec.messageJoueur}
      </Text>

      {echec.attendreS ? (
        <Text style={styles.attente}>
          Patiente environ {echec.attendreS} seconde{echec.attendreS > 1 ? "s" : ""} avant de
          relancer.
        </Text>
      ) : null}

      <View style={styles.actions}>
        {actions.map((action, index) => (
          <Button
            key={action}
            label={LIBELLES[action]}
            variant={index === 0 ? "primary" : "ghost"}
            onPress={gestionnaires[action]}
            disabled={occupe}
            fullWidth
          />
        ))}
      </View>

      {/* Pas de référence support sur un refus de sécurité : rien n'est cassé,
          il n'y a pas d'incident à faire remonter. */}
      {echec.requestId && !refusSecurite ? (
        <Text style={styles.reference} selectable numberOfLines={1}>
          Réf. support : {echec.requestId}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.card,
    marginBottom: 12,
    gap: 8,
  },
  titre: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  carteSecurite: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.sub,
    minHeight: 38,
  },
  // Sur le fond teinté du refus, `sub` tiendrait tout juste le seuil AA
  // (4,58:1 mesuré en clair, pour 4,5:1 exigé) : marge trop faible pour un
  // texte que le joueur doit lire jusqu'au bout. On passe à `text`, qui
  // mesure 13,1:1 en clair et 13,9:1 en sombre sur ce même fond.
  messageSecurite: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
  },
  attente: {
    fontSize: 12,
    color: palette.sub,
    fontStyle: "italic",
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  reference: {
    marginTop: 2,
    fontSize: 10,
    color: palette.sub,
    opacity: 0.7,
  },
});
