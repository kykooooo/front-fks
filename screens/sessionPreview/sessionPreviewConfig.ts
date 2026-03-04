// screens/sessionPreview/sessionPreviewConfig.ts
// Types V2 (camelCase, aligned with snakeToCamel transform) + helpers purs

export type BlockItem = {
  name?: string | null;
  description?: string | null;
  footballContext?: string | null;
  exerciseId?: string | null;
  id?: string | null;

  sets?: number | null;
  reps?: number | null;

  workS?: number | null;
  restS?: number | null;
  workRestSec?: number[] | null;
  workRest?: string | null;

  durationMin?: number | null;
  durationPerSetSec?: number | null;

  notes?: string | null;
  modality?: string | null;
};

export type Block = {
  id?: string;
  blockId?: string;
  name?: string | null;
  type?: string;
  goal?: string | null;
  focus?: string | null;
  intensity?: string;
  durationMin?: number;
  items?: BlockItem[];
  notes?: string | null;
  timerPresets?: {
    label?: string;
    workS?: number | null;
    restS?: number | null;
    rounds?: number | null;
  }[] | null;
};

// ─── Pure helpers ───

export const formatTime = (total: number) => {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const cleanDisplayNote = (value?: string | null) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const cleaned = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith('token:'))
    .join('\n')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

export const formatPresetLabel = (preset: {
  label?: string | null;
  workS?: number | null;
  restS?: number | null;
  rounds?: number | null;
}) => {
  const parts: string[] = [];
  if (preset.label) parts.push(String(preset.label));
  if (Number.isFinite(Number(preset.workS)) && Number.isFinite(Number(preset.restS))) {
    parts.push(`${Number(preset.workS)}s/${Number(preset.restS)}s`);
  }
  if (Number.isFinite(Number(preset.rounds)) && Number(preset.rounds) > 0) {
    parts.push(`x${Number(preset.rounds)}`);
  }
  return parts.join(' · ');
};

export function prettifyName(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Exercice';
  const noPrefix = trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, '');
  const spaced = noPrefix.replace(/_/g, ' ');
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const intensityTone = (intensity?: string) => {
  const key = (intensity ?? '').toLowerCase();
  if (key.includes('hard') || key.includes('max')) return 'danger';
  if (key.includes('mod')) return 'warn';
  if (key.includes('easy')) return 'ok';
  return 'default';
};

export const getCoachTip = (block: Block | undefined, index: number) => {
  if (!block) return 'Qualité d\u2019exécution avant volume.';
  const raw = `${block.type ?? ''} ${block.focus ?? ''} ${block.goal ?? ''}`.toLowerCase();
  if (raw.includes('strength') || raw.includes('force')) {
    return 'Technique propre, amplitude contrôlée, tempo stable.';
  }
  if (raw.includes('speed') || raw.includes('vitesse')) {
    return 'Explosivité max, récup complète, départs propres.';
  }
  if (raw.includes('endurance') || raw.includes('tempo') || raw.includes('run')) {
    return 'Rythme constant, respiration posée, relâchement.';
  }
  if (raw.includes('plyo') || raw.includes('saut')) {
    return 'Contacts courts, gainage actif, atterrissages doux.';
  }
  if (raw.includes('cod') || raw.includes('agility') || raw.includes('appuis')) {
    return 'Appuis bas, changements propres, regard haut.';
  }
  if (raw.includes('mobility') || raw.includes('mobilite')) {
    return 'Amplitude progressive, aucune douleur, respiration lente.';
  }
  return `Bloc ${index + 1} : qualité d\u2019exécution avant volume.`;
};

export const getDisplayName = (it: BlockItem) => {
  const displayNameRaw = (it?.name || '').trim();
  const fallbackId =
    typeof it?.exerciseId === 'string' && it.exerciseId.trim()
      ? it.exerciseId.trim()
      : typeof it?.id === 'string' && it.id.trim()
      ? it.id.trim()
      : undefined;
  const displayName =
    displayNameRaw.length > 0
      ? prettifyName(displayNameRaw)
      : fallbackId
      ? prettifyName(fallbackId)
      : it?.modality
      ? prettifyName(String(it.modality))
      : 'Exercice';
  return displayName;
};

export const getExerciseId = (it: BlockItem) => {
  if (typeof it?.exerciseId === 'string' && it.exerciseId.trim()) {
    return it.exerciseId.trim();
  }
  if (typeof it?.id === 'string' && it.id.trim()) {
    return it.id.trim();
  }
  return null;
};

export const formatItemMeta = (item: BlockItem) => {
  const parts: string[] = [];
  if (item?.sets != null && item.sets > 0) parts.push(`${item.sets}x`);
  if (item?.reps != null && item.reps > 0) parts.push(`${item.reps} reps`);
  if (Array.isArray(item?.workRestSec) && item.workRestSec.length >= 2) {
    const [w, r] = item.workRestSec;
    parts.push(`${w ?? '?'}s/${r ?? '?'}s`);
  } else if (item?.workS || item?.restS) {
    if (item.workS) parts.push(`${item.workS}s`);
    if (item.restS) parts.push(`/${item.restS}s`);
  } else if (item?.workRest && item.workRest.trim().length > 0) {
    parts.push(item.workRest.trim());
  }
  if (item?.durationPerSetSec) parts.push(`${item.durationPerSetSec}s / série`);
  if (item?.durationMin) parts.push(`${item.durationMin} min`);
  return parts.join(' \u00b7 ');
};

export function buildReasons(dateISO: string, clubDays: string[], matchDays: string[]) {
  const reasons: string[] = [];
  const d = new Date(`${dateISO}T00:00:00`);
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = map[d.getDay()] ?? '';
  const tomorrow = map[new Date(d.getTime() + 86400000).getDay()] ?? '';

  if (!matchDays.includes(tomorrow) && !matchDays.includes(today)) {
    reasons.push('Pas de match aujourd\u2019hui ou demain');
  }
  if (clubDays.includes(tomorrow)) reasons.push('Veille de jour club : volume surveillé');
  if (!clubDays.includes(today) && !matchDays.includes(today)) {
    reasons.push('Jour libre de club/match \u2192 séance cible possible');
  }
  if (reasons.length === 0) reasons.push('Séance adaptée au calendrier déclaré');
  return reasons;
}
