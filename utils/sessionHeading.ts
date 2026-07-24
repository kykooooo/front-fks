// utils/sessionHeading.ts
//
// Titre affiché en priorité pour une séance générée (fks.next_session.v2).
//
// Constat démo 23/07 (Kyllian) : les écrans de séance affichaient v2.title
// comme titre principal — un libellé souvent générique/orienté cycle
// (ex. "Séance explosive") — alors que le backend (Agent B, pipeline
// 2-agents) génère déjà `session_theme`, un résumé fidèle au CONTENU réel
// de la séance servie (ex. "Séance prévention & appuis" pour un U15), qui
// peut diverger du thème du cycle actif. `session_theme` doit donc primer
// comme titre principal quand il est présent ; `title` (souvent calqué sur
// l'archétype) est relégué en information secondaire, jamais perdu.
//
// Accepte indifféremment un objet camelCase (FKS_NextSessionV2 côté front)
// ou snake_case (payload brut / Session.ai côté store) — les deux formes
// circulent selon l'écran.

export type SessionHeadingSource =
  | {
      title?: unknown;
      sessionTheme?: unknown;
      session_theme?: unknown;
    }
  | null
  | undefined;

export type SessionHeading = {
  /** Texte à afficher comme titre principal de la séance. */
  heading: string;
  /**
   * Ancien titre (souvent lié à l'archétype), à afficher en sous-info quand
   * `session_theme` a pris la place du titre principal. `null` si rien à
   * afficher en plus (pas de perte d'info dans tous les cas : soit le
   * titre devient le heading, soit il devient le detail).
   */
  detail: string | null;
};

const DEFAULT_FALLBACK = "Séance FKS";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSessionHeading(
  source: SessionHeadingSource,
  fallback: string = DEFAULT_FALLBACK
): SessionHeading {
  const theme =
    asTrimmedString(source?.sessionTheme) || asTrimmedString(source?.session_theme);
  const title = asTrimmedString(source?.title);

  if (theme) {
    return { heading: theme, detail: title && title !== theme ? title : null };
  }

  return { heading: title || fallback, detail: null };
}
