// components/withErrorBoundary.tsx
// HOC (Higher Order Component) pour wrapper facilement n'importe quel écran avec ErrorBoundary

import React, { ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SessionErrorFallback } from './SessionErrorFallback';

/**
 * Wrapper pour ajouter facilement un Error Boundary à un écran
 *
 * Usage:
 * export default withErrorBoundary(MonEcran);
 *
 * ou avec un fallback personnalisé:
 * export default withErrorBoundary(MonEcran, {
 *   fallback: (error, reset) => <MonEcranErreur error={error} onRetry={reset} />
 * });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: {
    fallback?: (error: Error, resetError: () => void) => React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => {
    return (
      <ErrorBoundary
        fallback={options?.fallback}
        onError={options?.onError}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Wrapper spécifique pour les écrans liés aux séances
 * Utilise SessionErrorFallback par défaut
 */
export function withSessionErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  return withErrorBoundary(WrappedComponent, {
    fallback: (error, resetError) => (
      <SessionErrorFallback error={error} onRetry={resetError} />
    ),
    onError: (error, errorInfo) => {
      if (__DEV__) {
        console.error('[SessionErrorBoundary] Error caught:', error);
        console.error('[SessionErrorBoundary] Component stack:', errorInfo.componentStack);
      }
    },
  });
}
