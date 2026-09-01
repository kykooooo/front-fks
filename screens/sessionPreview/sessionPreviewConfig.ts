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
  // Slug brut (ex: "str_squat_bodyweight") : on retire le prefixe token et on
  // remplace les underscores par des espaces avant la mise en forme. Un nom
  // déjà rédigé par le backend (avec espaces) n'est pas retouché ici.
  const isSlug = /^[a-z0-9_]+$/i.test(trimmed) && trimmed.includes('_');
  const noPrefix = isSlug ? trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, '') : trimmed;
  const spaced = isSlug ? noPrefix.replace(/_/g, ' ').toLowerCase() : noPrefix;
  // Casse française : majuscule initiale seule (pas un mot-à-mot comme en
  // anglais — "Squat Poids Du Corps" est faux, "Squat poids du corps" est juste).
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const intensityTone = (intensity?: string) => {
  const key = (intensity ?? '').toLowerCase();
  if (key.includes('hard') || key.includes('max')) return 'danger';
  if (key.includes('mod')) return 'warn';
  if (key.includes('easy')) return 'ok';
  return 'default';
};

// ─── Repère technique (encadré PAR BLOC) ───
//
// ⚠️ Ce texte est un FALLBACK LOCAL, pas un conseil IA. Les vrais conseils
// d’Agent B (`coaching_tips`) sont au niveau SÉANCE côté backend
// (fksSchema.ts : `coaching_tips: z.array(z.string()).default([])`, jamais
// rattachés à un bloc) : ils s’affichent dans l’encart « Conseils du coach »
// de la préview et de l’écran live, pas ici. D’où l’intitulé DISTINCT côté
// bloc (« Repère technique ») : deux encarts à un « s » près, l’un local et
// l’autre IA, ne se distinguaient pas à l’œil sur le téléphone.
//
// Recette téléphone 01/09 : une séance Force affichait la MÊME phrase sur ses
// 4 blocs (tous matchent « strength/force »). D’où un POOL par famille, pioché
// de façon DÉTERMINISTE — pas de Math.random, les rendus et les tests restent
// stables — non pas par l’index GLOBAL du bloc (deux blocs force aux index 0
// et 6 retombaient sur la même phrase : 6 phrases, 0 % 6 === 6 % 6) mais par
// le RANG DU BLOC DANS SA FAMILLE : 1er bloc force → phrase 0, 2e → phrase 1.
//
// Invariant réellement tenu : deux blocs d’une même famille ne partagent
// jamais leur phrase tant que la famille compte au plus TIPS_PAR_FAMILLE (6)
// blocs dans la séance — donc TOUJOURS, le contrat backend plafonnant une
// séance à 7 blocs (fks/src/fksSchema.ts : `blocks` ... `.max(7)`).
export type CoachTipFamily =
  | 'force'
  | 'vitesse'
  | 'endurance'
  | 'plyo'
  | 'appuis'
  | 'mobilite'
  | 'general';

/** Ordre de test volontairement identique a l’ancienne cascade de `if`. */
const COACH_TIP_MATCHERS: { family: CoachTipFamily; keywords: string[] }[] = [
  { family: 'force', keywords: ['strength', 'force'] },
  { family: 'vitesse', keywords: ['speed', 'vitesse'] },
  { family: 'endurance', keywords: ['endurance', 'tempo', 'run'] },
  { family: 'plyo', keywords: ['plyo', 'saut'] },
  { family: 'appuis', keywords: ['cod', 'agility', 'appuis'] },
  { family: 'mobilite', keywords: ['mobility', 'mobilite'] },
];

const COACH_TIP_POOLS: Record<CoachTipFamily, readonly string[]> = {
  force: [
    'Technique propre, amplitude contrôlée, tempo stable.',
    'Descends lentement, remonte fort : la descente construit le muscle.',
    'Gainage serré à chaque série, le dos reste solide.',
    'Charge maîtrisée : si la technique casse, tu baisses le poids.',
    'Pousse dans les appuis, comme sur un duel épaule contre épaule.',
    'Respire entre les séries et récupère vraiment avant de repartir.',
  ],
  vitesse: [
    'Explosivité max, récup complète, départs propres.',
    'Chaque départ compte : imagine un appel dans le dos du défenseur.',
    'Bras qui travaillent, buste penché sur les premiers appuis.',
    'Récup complète entre les courses : la qualité prime sur le nombre.',
    'Arrête-toi net dès que la vitesse baisse, pas de sprint fatigué.',
    'Pieds vifs au sol, aucune crispation dans les épaules.',
  ],
  endurance: [
    'Rythme constant, respiration posée, relâchement.',
    'Tiens l’allure sans à-coups, comme sur une fin de match.',
    'Souffle par le ventre, épaules basses, foulée régulière.',
    'Si tu ne peux plus parler du tout, tu es trop vite : ajuste.',
    'Garde du jus pour la dernière série, c’est là que ça se joue.',
    'Pose bien le pied au sol, évite de taper le talon.',
  ],
  plyo: [
    'Contacts courts, gainage actif, atterrissages doux.',
    'Rebondis, ne t’écrase pas : imagine que le sol est brûlant.',
    'Réceptions genoux dans l’axe, jamais rentrés vers l’intérieur.',
    'Qualité avant quantité : dès que le ressort part, tu stoppes.',
    'Regarde loin devant, comme avant une remise de tête.',
    'Amorti silencieux : moins de bruit, moins d’impact sur les genoux.',
  ],
  appuis: [
    'Appuis bas, changements propres, regard haut.',
    'Baisse le centre de gravité avant chaque changement de direction.',
    'Pied planté fort, repars dans l’axe : un vrai crochet de match.',
    'Tête haute, tu dois pouvoir lire le jeu pendant l’appui.',
    'Petits pas rapides avant l’appui, jamais de grande enjambée.',
    'Freine avec les deux jambes pour protéger le genou d’appui.',
  ],
  mobilite: [
    'Amplitude progressive, aucune douleur, respiration lente.',
    'Va chercher l’amplitude sans forcer, la souplesse vient avec le temps.',
    'Respire à fond sur chaque position et relâche à l’expiration.',
    'Aucune douleur vive : la tension doit rester confortable.',
    'Prends ton temps, ce travail-là protège tes prochains matchs.',
    'Passe lentement d’une position à l’autre, sans à-coups.',
  ],
  general: [
    // Changement ASSUMÉ : la phrase historique était « Bloc N : qualité
    // d’exécution avant volume. » — le préfixe est retiré, la carte du bloc
    // porte déjà son numéro et son titre juste au-dessus de l’encadré.
    'Qualité d’exécution avant volume.',
    'Reste concentré sur le geste, pas sur le chrono.',
    'Respiration régulière, aucun mouvement précipité.',
    'Prends le temps de bien te placer avant chaque série.',
    'Écoute ton corps : une douleur vive, tu t’arrêtes.',
    'Finis le bloc aussi propre que tu l’as commencé.',
  ],
};

/** Nombre de phrases par famille = blocs d’une même famille sans répétition possible. */
export const TIPS_PAR_FAMILLE = COACH_TIP_POOLS.general.length;

export const getCoachTipFamily = (block?: Block): CoachTipFamily => {
  if (!block) return 'general';
  const raw = `${block.type ?? ''} ${block.focus ?? ''} ${block.goal ?? ''}`.toLowerCase();
  const hit = COACH_TIP_MATCHERS.find((m) => m.keywords.some((k) => raw.includes(k)));
  return hit ? hit.family : 'general';
};

/**
 * La phrase de CHAQUE bloc de la séance, dans l’ordre.
 *
 * Fonction PURE (aucun état de module, rien qui survive à un re-render) : le
 * compteur par famille naît et meurt dans l’appel. Deux rendus de la même
 * séance rendent donc exactement les mêmes phrases.
 */
export const coachTipsForBlocks = (
  blocks: readonly (Block | undefined)[] | null | undefined
): string[] => {
  if (!Array.isArray(blocks)) return [];
  const rangDansLaFamille = new Map<CoachTipFamily, number>();
  return blocks.map((block) => {
    const famille = getCoachTipFamily(block);
    const pool = COACH_TIP_POOLS[famille];
    const rang = rangDansLaFamille.get(famille) ?? 0;
    rangDansLaFamille.set(famille, rang + 1);
    return pool[rang % pool.length];
  });
};

/**
 * La phrase d’UN bloc, à sa place dans la séance. La séance entière est
 * nécessaire : le rang du bloc dans sa famille ne se lit pas sur le bloc seul.
 * Index aberrant (NaN, négatif, hors séance) : phrase générale, jamais de vide.
 */
export const getCoachTip = (
  blocks: readonly (Block | undefined)[] | null | undefined,
  index: number
): string => {
  const safeIndex = Number.isFinite(index) ? Math.floor(index) : 0;
  return coachTipsForBlocks(blocks)[safeIndex] ?? COACH_TIP_POOLS.general[0];
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
