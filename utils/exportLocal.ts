// utils/exportLocal.ts
//
// L'EXPORT DES DONNÉES LOCALES — pur, testable, et honnête sur son périmètre.
//
// CE QUE C'EST : une photographie JSON des stores persistés SUR CE TÉLÉPHONE
// (séances, charges, ressentis, planning, « Mon corps », préférences). Rien
// d'autre.
//
// CE QUE CE N'EST PAS, et l'écran le dit avec les mêmes mots :
//  - pas le profil distant complet (`users/{uid}` Firestore) : seul son miroir
//    local (objectif hebdo, jours club/match) est présent via le store externe ;
//  - pas une sauvegarde restaurable : aucun écran ne sait relire ce fichier ;
//  - pas un export exhaustif au sens RGPD : celui-ci passe par kyllian@fks-app.com.
//
// CE QU'ON RETIRE : les fonctions des stores, les clés techniques (`_hydrated`,
// `_currentUid`…), et le dernier contexte IA envoyé au backend (`lastAiContext`,
// technique, redondant avec le profil et les séances). Aucun secret n'a jamais
// vécu dans ces stores ; le token push n'y est pas non plus.

export const EXPORT_FORMAT_VERSION = 2;

/** Clés retirées de tout store exporté, en plus des fonctions et des clés `_privées`. */
export const EXPORT_EXCLUDED_KEYS: readonly string[] = ["lastAiContext", "lastAiSessionV2"];

export type LocalExportInput = {
  exportedAtISO: string;
  appVersion: string | null;
  stores: {
    load: Record<string, unknown>;
    sessions: Record<string, unknown>;
    feedback: Record<string, unknown>;
    external: Record<string, unknown>;
    body: Record<string, unknown>;
    settings: Record<string, unknown>;
  };
};

export type LocalExport = {
  format: "fks-local-export";
  formatVersion: number;
  exportedAt: string;
  appVersion: string | null;
  /** Périmètre écrit DANS le fichier : celui qui l'ouvre sait ce qu'il a. */
  scope: {
    includes: string[];
    excludes: string[];
    restorable: false;
  };
  data: LocalExportInput["stores"];
};

/** Ne garde que les DONNÉES d'un état de store : ni fonctions, ni clés techniques. */
export function donneesSeules(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === "function") continue;
    if (key.startsWith("_")) continue;
    if (EXPORT_EXCLUDED_KEYS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export function buildLocalExport(input: LocalExportInput): LocalExport {
  const stores = input.stores;
  return {
    format: "fks-local-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: input.exportedAtISO,
    appVersion: input.appVersion,
    scope: {
      includes: [
        "sessions (séances FKS et leurs ressentis)",
        "load (charge ATL/CTL/TSB calculée localement)",
        "feedback (états du jour)",
        "external (charges club/match, planning, objectif hebdo — miroir local du profil)",
        "body (« Mon corps » : gênes déclarées, jamais envoyées à un club)",
        "settings (préférences de l'appareil)",
      ],
      excludes: [
        "profil complet Firestore (users/{uid})",
        "compte de connexion et identifiants",
        "contexte technique envoyé au moteur de génération",
      ],
      restorable: false,
    },
    data: {
      load: donneesSeules(stores.load),
      sessions: donneesSeules(stores.sessions),
      feedback: donneesSeules(stores.feedback),
      external: donneesSeules(stores.external),
      body: donneesSeules(stores.body),
      settings: donneesSeules(stores.settings),
    },
  };
}

/** Nom de fichier daté, stable pour les tests. */
export function nomFichierExport(exportedAtISO: string): string {
  return `fks-donnees-locales-${exportedAtISO.slice(0, 10)}.json`;
}
