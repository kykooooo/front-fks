// domain/tracking/modes.ts
// Les trois modes de la boucle de suivi (voir ARCHITECTURE_BOUCLE.md) :
// collecte (snapshot + execution + feedback enrichi), shadow (decision
// calculee et stockee, n'influence rien), application (branche dans
// aiContext -- OFF par defaut au pilote). Override unique : users/{uid}.trackingConfig,
// active par joueur sans redeploiement (un OTA suffit pour changer les defauts).
export type TrackingModes = {
  collect: boolean;
  shadow: boolean;
  apply: boolean;
};

export const DEFAULT_TRACKING_MODES: TrackingModes = {
  collect: true,
  shadow: true,
  apply: false,
};

/**
 * Resout les modes actifs depuis le document utilisateur Firestore. Tolerant
 * a tout : document absent/null, trackingConfig absent/mal type, valeurs non
 * booleennes -> defauts. Garde-fou : apply ne peut etre actif QUE si collect
 * ET shadow le sont deja (jamais de mode Application isole).
 */
export function resolveTrackingModes(userDoc?: Record<string, unknown> | null): TrackingModes {
  const rawConfig =
    userDoc && typeof userDoc === "object" ? (userDoc as Record<string, unknown>).trackingConfig : undefined;
  const cfg = rawConfig && typeof rawConfig === "object" ? (rawConfig as Record<string, unknown>) : {};

  const collect = typeof cfg.collect === "boolean" ? cfg.collect : DEFAULT_TRACKING_MODES.collect;
  const shadow = typeof cfg.shadow === "boolean" ? cfg.shadow : DEFAULT_TRACKING_MODES.shadow;
  const requestedApply = typeof cfg.apply === "boolean" ? cfg.apply : DEFAULT_TRACKING_MODES.apply;

  const apply = requestedApply && collect && shadow;

  return { collect, shadow, apply };
}
