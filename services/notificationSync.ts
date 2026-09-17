// services/notificationSync.ts
//
// LA COORDINATION ENTRE L'ÉTAT DE L'APP ET LE PLANIFICATEUR DE RAPPELS.
//
// ─── LE PROBLÈME QU'ELLE RÉSOUT ─────────────────────────────────────────────
// Programmer un rappel demande plusieurs allers-retours asynchrones (lecture de
// la permission, token push, annulation, programmation). Pendant ce temps, le
// monde bouge : le joueur coupe les notifications, se déconnecte, change de
// compte, supprime son compte. Une opération lancée AVANT ce changement et qui
// se termine APRÈS reposait des rappels que plus personne ne veut — la
// sérialisation seule ne protège pas : la demande périmée peut être la dernière
// de la file.
//
// ─── COMMENT ───────────────────────────────────────────────────────────────
// Une GÉNÉRATION (entier) est incrémentée à chaque changement de contexte
// (`invalidate`, appelé par la déconnexion, la suppression de compte, et par
// chaque `reconcile`). Toute opération capture la génération à son départ et,
// à chaque étape après un `await`, vérifie qu'elle est encore la courante —
// sinon elle s'arrête sans toucher au planificateur. Le service de
// notifications reçoit ce même test (`isStale`) et l'applique juste avant
// d'écrire.
//
// Le contexte (compte, préférence) est RELU à chaque étape via `readContext`,
// jamais capturé au départ : ce qui est programmé est toujours dérivé de l'état
// présent, pas de l'état d'il y a trois secondes.
//
// ─── CE QUE `reconcile` FAIT, ÉTAT PAR ÉTAT ────────────────────────────────
//  - auth pas encore résolue → RIEN (ne pas confondre « inconnu » et « déconnecté ») ;
//  - déconnecté (confirmé) → tout annuler ;
//  - préférence OFF → tout annuler ;
//  - préférence ON → permission (demandée si `requestPermission`) ; refusée →
//    tout annuler, `onPermissionDenied` ; accordée/inconnue → annuler puis reposer.
//  Le token push est lancé À CÔTÉ, jamais attendu : un token qui ne répond
//  jamais ne retarde ni ne bloque un rappel local.
//
// Aucune promesse n'est laissée rejeter : les échecs remontent en résultat
// (`"failed"`) et sont journalisés en dev.

import {
  applyNotificationPreferences as applyNotificationPreferencesReal,
  cancelAllScheduledQueued as cancelAllScheduledQueuedReal,
  registerPushTokenBestEffort as registerPushTokenBestEffortReal,
  type ApplyResult,
  type NotificationPreferences,
} from "./notifications";

export type NotificationSyncContext = {
  /** `true` dès que Firebase a répondu une première fois (connecté OU déconnecté). */
  authResolved: boolean;
  /** Compte connecté, ou `null` (déconnexion confirmée si `authResolved`). */
  uid: string | null;
  /** Préférence du joueur (store de réglages). */
  notificationsEnabled: boolean;
  sessionReminders: boolean;
};

export type NotificationSyncService = {
  applyNotificationPreferences: (
    prefs: NotificationPreferences,
    options?: { requestPermission?: boolean; isStale?: () => boolean },
  ) => Promise<ApplyResult>;
  registerPushTokenBestEffort: () => Promise<string | null>;
  /** Annulation terminale DANS la file (après toute écriture engagée). */
  cancelAllScheduledQueued: (options?: { isStale?: () => boolean }) => Promise<boolean>;
};

export type PurgeOutcome =
  | { status: "purged" }
  | { status: "skipped"; reason: "stale" }
  | { status: "failed"; error: unknown };

export type ReconcileOutcome =
  | { status: "skipped"; reason: "auth-unknown" | "stale" }
  | { status: "cancelled"; reason: "signed-out" | "disabled" | "permission-denied" }
  | { status: "scheduled"; scheduled: ApplyResult["scheduled"] }
  | { status: "failed"; error: unknown };

export type ReconcileOptions = {
  /** Demander la permission si elle n'a jamais été posée (bascule manuelle ON, connexion). */
  requestPermission?: boolean;
  /** Le téléphone a refusé : à l'appelant de refléter l'état (réglage à OFF). */
  onPermissionDenied?: () => void;
};

export type NotificationSync = {
  /** Réconcilie le planificateur avec le contexte COURANT. Ne rejette jamais. */
  reconcile: (options?: ReconcileOptions) => Promise<ReconcileOutcome>;
  /** Périme toute opération en vol (déconnexion, suppression, changement de compte). */
  invalidate: () => void;
  /**
   * NETTOYAGE TERMINAL (déconnexion, suppression de compte) : périme tout,
   * attend que les écritures engagées — appel natif compris — soient finies,
   * puis annule. À sa résolution, aucune opération antérieure ne peut plus
   * recréer un rappel. Si un contexte plus récent est apparu pendant
   * l'attente (nouveau compte), l'annulation est abandonnée : ce compte-là
   * a raison. Ne rejette jamais.
   */
  purge: () => Promise<PurgeOutcome>;
  /** Génération courante — exposée pour les tests. */
  generation: () => number;
  /**
   * Publie le contexte courant (App.tsx, après chaque rendu). Sans `readContext`
   * injecté, c'est CE contexte que les opérations relisent à chaque étape.
   */
  setContext: (ctx: NotificationSyncContext) => void;
};

export function createNotificationSync(deps: {
  /** Lecture du contexte à chaque étape. Absent : le contexte publié par `setContext`. */
  readContext?: () => NotificationSyncContext;
  service?: NotificationSyncService;
  log?: (message: string, error?: unknown) => void;
} = {}): NotificationSync {
  let contextePublie: NotificationSyncContext = {
    authResolved: false,
    uid: null,
    notificationsEnabled: false,
    sessionReminders: false,
  };
  const readContext = deps.readContext ?? (() => contextePublie);
  const service: NotificationSyncService = deps.service ?? {
    applyNotificationPreferences: applyNotificationPreferencesReal,
    registerPushTokenBestEffort: registerPushTokenBestEffortReal,
    cancelAllScheduledQueued: cancelAllScheduledQueuedReal,
  };
  const log = deps.log ?? ((m, e) => { if (__DEV__) console.warn(m, e); });
  let generation = 0;

  const invalidate = () => {
    generation += 1;
  };

  const reconcile = async (options: ReconcileOptions = {}): Promise<ReconcileOutcome> => {
    // Chaque réconciliation périme la précédente : la DERNIÈRE demandée est
    // celle qui décrit l'état voulu, les autres n'ont plus le droit d'écrire.
    invalidate();
    const mienne = generation;
    const isStale = () => mienne !== generation;

    const ctx = readContext();
    if (!ctx.authResolved) return { status: "skipped", reason: "auth-unknown" };

    try {
      if (!ctx.uid || !ctx.notificationsEnabled) {
        await service.applyNotificationPreferences({ enabled: false, sessionReminder: false }, { isStale });
        if (isStale()) return { status: "skipped", reason: "stale" };
        return { status: "cancelled", reason: ctx.uid ? "disabled" : "signed-out" };
      }

      const result = await service.applyNotificationPreferences(
        { enabled: true, sessionReminder: ctx.sessionReminders },
        { requestPermission: options.requestPermission, isStale },
      );
      if (isStale()) return { status: "skipped", reason: "stale" };

      if (result.permission === "denied") {
        options.onPermissionDenied?.();
        return { status: "cancelled", reason: "permission-denied" };
      }

      // Le token push : à côté, jamais attendu, jamais chaîné à un rappel. S'il
      // arrive après une déconnexion, il n'écrit qu'un token dans le stockage
      // local — aucun rappel n'en dépend.
      void service.registerPushTokenBestEffort().catch(() => null);

      return { status: "scheduled", scheduled: result.scheduled };
    } catch (error) {
      log("[notificationSync] réconciliation échouée", error);
      return { status: "failed", error };
    }
  };

  const purge = async (): Promise<PurgeOutcome> => {
    invalidate();
    const mienne = generation;
    const isStale = () => mienne !== generation;
    try {
      const faite = await service.cancelAllScheduledQueued({ isStale });
      return faite ? { status: "purged" } : { status: "skipped", reason: "stale" };
    } catch (error) {
      log("[notificationSync] purge échouée", error);
      return { status: "failed", error };
    }
  };

  return {
    reconcile,
    invalidate,
    purge,
    generation: () => generation,
    setContext: (ctx) => {
      contextePublie = ctx;
    },
  };
}

// ─── L'INSTANCE DE L'APPLICATION ─────────────────────────────────────────────
// Une seule, câblée par App.tsx (`installNotificationSync`). Les écrans et les
// services (déconnexion, suppression) passent par ces fonctions ; avant le
// câblage, elles ne font rien — il n'y a alors aucun rappel à protéger.

let instance: NotificationSync | null = null;

export function installNotificationSync(sync: NotificationSync): void {
  instance = sync;
}

export function invalidateNotificationSync(): void {
  instance?.invalidate();
}

/** Nettoyage terminal (déconnexion, suppression). Sans instance : rien à protéger. */
export function purgeNotifications(): Promise<PurgeOutcome> {
  if (!instance) return Promise.resolve({ status: "purged" });
  return instance.purge();
}

export function reconcileNotifications(options?: ReconcileOptions): Promise<ReconcileOutcome> {
  if (!instance) return Promise.resolve({ status: "skipped", reason: "auth-unknown" });
  return instance.reconcile(options);
}

/** RÉSERVÉ AUX TESTS. */
export function __resetNotificationSyncForTests(): void {
  instance = null;
}
