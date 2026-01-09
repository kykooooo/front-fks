// utils/ema.ts

/**
 * Calcul EMA simple : ema_next = alpha * x + (1 - alpha) * ema_prev
 * Si prev est undefined/null, on seeds avec x ou une valeur fournie.
 */
export function ema(
    x: number,
    prev?: number | null,
    alpha: number = 0.5,
    seed?: number
  ): number {
    const base = prev ?? (seed ?? x);
    return alpha * x + (1 - alpha) * base;
  }
  