// screens/feedback/components/MonCorpsPrompt.tsx
//
// LA PASSERELLE FEEDBACK -> « MON CORPS » (décision D3).
//
// Elle s'affiche APRÈS l'enregistrement du feedback, jamais avant : le feedback
// est obligatoire (il débloque la génération suivante) et rien ne doit se mettre
// en travers. La refuser n'écrit RIEN — une douleur non située reste non située,
// on ne fabrique pas une gêne « zone : autre » à la place du joueur.
//
// Elle ne modifie jamais un statut toute seule (charte INJURY_IA_CHARTER, règle
// 3 : « jamais modifier le statut de blessure sans consentement joueur ») :
// chaque bouton est un geste du joueur.
//
// Même forme que `CyclePrompt` : une carte posée au-dessus de la barre de
// validation, deux ou trois boutons, aucun blocage.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';

const COLORS = theme.colors;

type Props = {
  /** Libellé de la zone déjà déclarée, ou `null` si aucune gêne en cours. */
  zoneEnCours: string | null;
  onSituer: () => void;
  onToujoursLa: () => void;
  onEnReprise: () => void;
  onPlusTard: () => void;
};

export function MonCorpsPrompt({
  zoneEnCours,
  onSituer,
  onToujoursLa,
  onEnReprise,
  onPlusTard,
}: Props) {
  return (
    <View style={styles.carte} accessibilityRole="summary">
      <Text style={styles.texte}>
        {zoneEnCours
          ? `Ta gêne (${zoneEnCours}) est toujours là ?`
          : 'Tu as noté une douleur marquée. Tu veux dire où ?'}
      </Text>
      <View style={styles.actions}>
        {zoneEnCours ? (
          <>
            <Button label="Toujours là" onPress={onToujoursLa} variant="primary" size="md" fullWidth />
            <Button label="En reprise" onPress={onEnReprise} variant="ghost" size="md" fullWidth />
            <Button label="Ouvrir Mon corps" onPress={onSituer} variant="ghost" size="md" fullWidth />
          </>
        ) : (
          <>
            <Button label="Oui, la situer" onPress={onSituer} variant="primary" size="md" fullWidth />
            <Button label="Plus tard" onPress={onPlusTard} variant="ghost" size="md" fullWidth />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  texte: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: 10, gap: 8 },
});
