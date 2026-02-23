// components/session/blockConfig.ts
// Config couleurs + icones par type de bloc (meme pattern que MODALITY_CONFIG dans VideoLibrary)

export type BlockType =
  | 'warmup'
  | 'strength'
  | 'run'
  | 'speed'
  | 'plyo'
  | 'circuit'
  | 'core'
  | 'cod'
  | 'mobility'
  | 'cooldown';

export type BlockConfig = {
  icon: string;
  label: string;
  tint: string;
  tintSoft: string;
};

export const BLOCK_CONFIG: Record<BlockType, BlockConfig> = {
  warmup:   { icon: 'flame-outline',       label: 'Echauffement',    tint: '#f59e0b', tintSoft: 'rgba(245,158,11,0.10)' },
  strength: { icon: 'barbell-outline',      label: 'Force',           tint: '#ef4444', tintSoft: 'rgba(239,68,68,0.10)' },
  run:      { icon: 'footsteps-outline',    label: 'Course',          tint: '#2563eb', tintSoft: 'rgba(37,99,235,0.10)' },
  speed:    { icon: 'flash-outline',        label: 'Vitesse',         tint: '#ff7a1a', tintSoft: 'rgba(255,122,26,0.10)' },
  plyo:     { icon: 'rocket-outline',       label: 'Plyo',            tint: '#8b5cf6', tintSoft: 'rgba(139,92,246,0.10)' },
  circuit:  { icon: 'sync-outline',         label: 'Circuit',         tint: '#ff7a1a', tintSoft: 'rgba(255,122,26,0.10)' },
  core:     { icon: 'shield-outline',       label: 'Gainage',         tint: '#06b6d4', tintSoft: 'rgba(6,182,212,0.10)' },
  cod:      { icon: 'git-branch-outline',   label: 'Agilité',        tint: '#16a34a', tintSoft: 'rgba(22,163,74,0.10)' },
  mobility: { icon: 'body-outline',         label: 'Mobilité',       tint: '#14b8a6', tintSoft: 'rgba(20,184,166,0.10)' },
  cooldown: { icon: 'snow-outline',         label: 'Retour au calme', tint: '#64748b', tintSoft: 'rgba(100,116,139,0.10)' },
};

const FALLBACK_CONFIG: BlockConfig = {
  icon: 'ellipse-outline',
  label: 'Bloc',
  tint: '#6b7280',
  tintSoft: 'rgba(107,114,128,0.10)',
};

export function getBlockConfig(type?: string): BlockConfig {
  if (!type) return FALLBACK_CONFIG;
  const key = type.toLowerCase() as BlockType;
  return BLOCK_CONFIG[key] ?? FALLBACK_CONFIG;
}

// ====== FORCE PIPELINE — labels précis par token ======
const FORCE_TOKEN_LABEL: Record<string, string> = {
  strength_force_lower_main:      'Force',
  strength_force_upper_main:      'Force',
  strength_force_lower_support:   'Renfo',
  strength_force_upper_support:   'Renfo',
  strength_force_posterior_prehab: 'Prévention',
  strength_force_appuis:          'Appuis',
  core_force_brace:               'Core',
};

/**
 * Extrait le token:xxx depuis les notes du bloc (ex: "token:strength_force_lower_main").
 */
function extractToken(notes?: string | null): string | null {
  if (typeof notes !== 'string') return null;
  const match = notes.match(/token:(\S+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Retourne le label affiné pour un bloc Force si un token est présent,
 * sinon le label générique du type.
 */
export function getBlockLabel(block: { type?: string; notes?: string | null }): string {
  const token = extractToken(block.notes);
  if (token && FORCE_TOKEN_LABEL[token]) return FORCE_TOKEN_LABEL[token];
  return getBlockConfig(block.type).label;
}

type BlockLike = { type?: string; intensity?: string; notes?: string | null };

export function getTransitionLabel(prev: BlockLike, next: BlockLike): string {
  const nextType = (next.type ?? '').toLowerCase();
  const prevIntensity = (prev.intensity ?? '').toLowerCase();
  const nextIntensity = (next.intensity ?? '').toLowerCase();

  if (nextType === 'cooldown' || nextType === 'mobility') return 'Retour au calme';
  if (nextIntensity.includes('hard') && !prevIntensity.includes('hard')) return 'Montée en intensité';
  if (nextIntensity.includes('easy') && prevIntensity.includes('hard')) return 'Récupération active';

  if (prev.notes?.toLowerCase().includes('repos') || prev.notes?.toLowerCase().includes('rest')) {
    return 'Repos entre blocs';
  }

  return 'Bloc suivant';
}
