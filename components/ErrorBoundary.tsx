// components/ErrorBoundary.tsx
// Composant qui capture les erreurs React et affiche un écran de secours au lieu de crasher l'app

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { theme, TYPE, RADIUS } from "../constants/theme";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary - Capture les erreurs React et affiche un écran de secours
 *
 * Analogie foot : C'est comme un gardien remplaçant. Si le titulaire se blesse (crash),
 * le remplaçant entre pour que le match continue (écran de secours au lieu de crash total).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Mise à jour de l'état pour afficher l'UI de secours au prochain rendu
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log l'erreur pour debug
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Error info:', errorInfo);
    }

    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });

    // Appeler le callback personnalisé si fourni
    this.props.onError?.(error, errorInfo);

    // Stocker les infos d'erreur dans le state
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Si un fallback personnalisé est fourni, l'utiliser
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Sinon, afficher l'écran d'erreur par défaut
      return (
        <DefaultErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Écran d'erreur par défaut - Sympathique et informatif
 */
function DefaultErrorScreen({
  error,
  errorInfo,
  onReset,
}: {
  error: Error;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icône d'erreur (emoji pour simplicité) */}
        <Text style={styles.icon}>⚠️</Text>

        {/* Titre */}
        <Text style={styles.title}>Oups, quelque chose a planté</Text>

        {/* Message utilisateur */}
        <Text style={styles.message}>
          Une erreur inattendue s'est produite. Pas de panique, tes données sont sauvegardées.
        </Text>

        {/* Détails techniques (en mode dev uniquement) */}
        {__DEV__ && (
          <ScrollView style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Détails techniques (dev mode) :</Text>
            <Text style={styles.detailsText}>
              {error.toString()}
              {'\n\n'}
              {errorInfo?.componentStack}
            </Text>
          </ScrollView>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onReset}>
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Si le problème persiste, redémarre l'app ou contacte le support.
          </Text>
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
    fontSize: TYPE.display.lg.fontSize,
    marginBottom: 20,
  },
  title: {
    fontSize: TYPE.title.fontSize,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: TYPE.body.fontSize,
    color: theme.colors.sub,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: RADIUS.sm,
    padding: 16,
    maxHeight: 200,
    width: '100%',
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  detailsText: {
    fontSize: TYPE.micro.fontSize,
    color: theme.colors.sub,
    fontFamily: 'monospace',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.sm,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: TYPE.body.fontSize,
    fontWeight: '600',
  },
  hint: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.sub,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
