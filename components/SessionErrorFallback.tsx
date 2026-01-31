// components/SessionErrorFallback.tsx
// Écran d'erreur spécifique pour les problèmes de génération de séance

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { theme } from '../constants/theme';

interface Props {
  error: Error;
  onRetry?: () => void;
}

/**
 * Écran d'erreur pour les problèmes de génération/affichage de séance
 * Plus contextuel que l'écran d'erreur générique
 */
export function SessionErrorFallback({ error, onRetry }: Props) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  const handleGoHome = () => {
    navigation.navigate('Tabs', { screen: 'Home' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>⚽</Text>

        <Text style={styles.title}>Problème avec la séance</Text>

        <Text style={styles.message}>
          La séance n'a pas pu être chargée ou affichée correctement.
          {'\n\n'}
          Tes données sont sauvegardées, tu peux réessayer ou revenir à l'accueil.
        </Text>

        {__DEV__ && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
              <Text style={styles.primaryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome}>
            <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: theme.colors.sub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.sub,
    fontFamily: 'monospace',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
