// src/screens/SessionPreviewScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useTrainingStore } from '../state/trainingStore';
import { getWarmupForSession } from '../constants/warmups';

type SessionPreviewRoute = RouteProp<AppStackParamList, 'SessionPreview'>;

// ====== TYPES V2 (alignés avec backend) ======
type BlockItem = {
  name?: string | null;
  description?: string | null;
  exercise_id?: string | null;

  sets?: number | null;
  reps?: number | null;

  // travail au temps
  work_s?: number | null;
  rest_s?: number | null;
  work_rest_sec?: number[] | null; // [work, rest]
  work_rest?: string | null;       // fallback texte ("10x200m / 40s rec")

  duration_min?: number | null;
  duration_per_set_sec?: number | null;

  notes?: string | null;
  modality?: string | null;
};

type Block = {
  id?: string;
  block_id?: string;
  name?: string | null;
  type?: string;
  goal?: string | null;
  focus?: string | null;
  intensity?: string;
  duration_min?: number;
  items?: BlockItem[];
  notes?: string | null;
  timer_presets?: {
    label?: string;
    work_s?: number | null;
    rest_s?: number | null;
    rounds?: number | null;
  }[] | null;
};

// ====== UI HELPERS ======
const palette = {
  bg: '#050509',
  card: '#0c0e13',
  cardSoft: '#10131b',
  border: '#1f2430',
  text: '#f9fafb',
  sub: '#9ca3af',
  accent: '#f97316',
  accentSoft: '#fed7aa',
  success: '#22c55e',
};

function prettifyName(name: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Exercice';
  // enlève les prefixes techniques
  const noPrefix = trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, '');
  const spaced = noPrefix.replace(/_/g, ' ');
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

// ====== BLOC ======
function BlockCard({ block, index }: { block: Block; index: number }) {
  const blockKey = `block_${index}`;
  const title = block.goal || (block as any).name || block.type || block.focus || 'Bloc';

  const focus = block.focus || block.type || '';

  const formatTimerPreset = (tp: NonNullable<Block['timer_presets']>[number]) => {
    const work = tp?.work_s ? `${tp.work_s}s` : '?';
    const rest = tp?.rest_s ? `${tp.rest_s}s` : '?';
    const rounds = tp?.rounds ? `${tp.rounds}x` : '';
    return `${rounds} ${work}/${rest}`.trim();
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowSpace}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Pill label={`${block.duration_min ?? 0} min`} />
      </View>

      <Text style={styles.muted}>
        {focus ? `${focus} · ` : ''}
        {block.intensity ?? '-'}
      </Text>

      <View style={{ marginTop: 8, gap: 6 }}>
        {block.items?.map((it: BlockItem, idx: number) => {
          const displayNameRaw = (it?.name || '').trim();
          const fallbackId =
            typeof (it as any)?.exercise_id === 'string' && (it as any).exercise_id.trim()
              ? (it as any).exercise_id.trim()
              : typeof (it as any)?.id === 'string' && (it as any).id.trim()
              ? (it as any).id.trim()
              : undefined;
          const displayName =
            displayNameRaw.length > 0
              ? prettifyName(displayNameRaw)
              : fallbackId
              ? prettifyName(fallbackId)
              : it?.modality
              ? prettifyName(String(it.modality))
              : 'Exercice';

          const parts: string[] = [];

          // sets / reps
          if (it?.sets != null && it.sets > 0) parts.push(`${it.sets}x`);
          if (it?.reps != null && it.reps > 0) parts.push(`${it.reps} reps`);

          // travail au temps (priorité au tableau work_rest_sec)
          if (Array.isArray(it?.work_rest_sec) && it.work_rest_sec.length >= 2) {
            const [w, r] = it.work_rest_sec;
            parts.push(`${w ?? '?'}s/${r ?? '?'}s`);
          } else if (it?.work_s || it?.rest_s) {
            if (it.work_s) parts.push(`${it.work_s}s`);
            if (it.rest_s) parts.push(`/${it.rest_s}s`);
          } else if (it?.work_rest && it.work_rest.trim().length > 0) {
            // fallback texte brut (ex: "10x200m / 40s rec")
            parts.push(it.work_rest.trim());
          }

          if (it?.duration_per_set_sec)
            parts.push(`${it.duration_per_set_sec}s / série`);
          if (it?.duration_min)
            parts.push(`${it.duration_min} min`);

          const meta = parts.join(' · ');

          return (
            <View key={`${blockKey}_${idx}`} style={styles.itemRow}>
              <Text style={styles.itemName}>{displayName}</Text>
              {it.description ? <Text style={styles.itemNote}>{it.description}</Text> : null}
              {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
              {it.notes ? <Text style={styles.itemNote}>{it.notes}</Text> : null}
            </View>
          );
        })}

        {Array.isArray(block.timer_presets) && block.timer_presets.length > 0 ? (
          <View style={{ marginTop: 4, gap: 4 }}>
            <Text style={styles.muted}>Intervalles</Text>
            {block.timer_presets.map(
              (tp: NonNullable<Block['timer_presets']>[number], i: number) => (
                <Text key={`${blockKey}_tp_${i}`} style={styles.itemMeta}>
                  • {tp.label ? `${tp.label} : ` : ''}
                  {formatTimerPreset(tp)}
                </Text>
              )
            )}
          </View>
        ) : null}
      </View>

      {block.notes ? (
        <Text style={[styles.itemNote, { marginTop: 6 }]}>{block.notes}</Text>
      ) : null}
    </View>
  );
}

// ====== SCREEN ======
export default function SessionPreviewScreen({ route }: { route: SessionPreviewRoute }) {
  const { v2, plannedDateISO, sessionId } = route.params;
  const nav = useNavigation<any>();
  const title = v2.title || 'Séance IA';
  const phase = useTrainingStore((s) => s.phase);
  const tsb = useTrainingStore((s) => s.tsb);
  const clubDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const sessions = useTrainingStore((s) => s.sessions);

  const recentBadges = useMemo(() => {
    const sorted = [...(sessions ?? [])]
      .filter((s: any) => s.completed)
      .sort((a: any, b: any) => (b.dateISO ?? b.date ?? '').localeCompare(a.dateISO ?? a.date ?? ''))
      .slice(0, 5);
    const badges: string[] = [];
    sorted.forEach((s) => {
      const focus = (s.focus ?? (s as any).modality ?? '').toString().toLowerCase() || 'run';
      const intensity = (s.intensity ?? '').toString().toLowerCase() || 'moderate';
      badges.push(`focus:${focus}`);
      badges.push(`focus_intensity:${focus}:${intensity}`);
    });
    return Array.from(new Set(badges)).slice(0, 8);
  }, [sessions]);

  const metrics = v2.analytics?.target_metrics;
  const distance = metrics?.distance_m;
  const hasDistance = distance != null && Number.isFinite(distance);
  const distanceLabel =
    hasDistance && distance! >= 1000
      ? `≈${(distance! / 1000).toFixed(1)} km`
      : hasDistance
      ? `≈${distance} m`
      : null;
  const warmup = useMemo(() => getWarmupForSession(v2), [v2]);

  const contacts = metrics?.contacts;
  const totalReps = metrics?.total_reps;
  const srpe = v2.estimated_load?.srpe ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <Text style={styles.title}>{title}</Text>
        {v2.subtitle ? <Text style={styles.subtitle}>{v2.subtitle}</Text> : null}

        <View style={styles.rowWrap}>
          {v2.intensity ? <Pill label={v2.intensity} /> : null}
          {v2.focus_primary ? <Pill label={v2.focus_primary} /> : null}
          {v2.focus_secondary ? <Pill label={v2.focus_secondary} /> : null}
          {v2.duration_min != null ? <Pill label={`${v2.duration_min} min`} /> : null}
          {v2.rpe_target != null ? <Pill label={`RPE ${v2.rpe_target}`} /> : null}
          {srpe != null ? <Pill label={`sRPE ≈ ${srpe}`} /> : null}
          {v2.location ? <Pill label={v2.location} /> : null}
          <Pill label={plannedDateISO} />
        </View>

        <View style={[styles.section, styles.infoCard]}>
          <Text style={styles.sectionTitle}>Pourquoi cette séance ?</Text>
          <Text style={styles.body}>Phase : {phase}</Text>
          <Text style={styles.body}>
            TSB actuel : {tsb.toFixed(1)}{' '}
            {tsb <= -10 ? '(fatigue élevée)' : tsb < 0 ? '(fatigue modérée)' : '(plutôt frais)'}
          </Text>
          <Text style={styles.body}>
            Objectif : {v2.focus_primary ?? '—'} · {v2.intensity ?? '-'} · ~{v2.duration_min ?? '?'} min
          </Text>
          <View style={{ marginTop: 6, gap: 2 }}>
            {buildReasons(plannedDateISO, clubDays, matchDays).map((r, i) => (
              <Text key={`r_${i}`} style={styles.bullet}>• {r}</Text>
            ))}
          </View>
        </View>

        {/* METRICS */}
        {metrics && (
          <View style={[styles.section, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>Métriques</Text>
            <View style={styles.rowWrap}>
              {distanceLabel && <Pill label={distanceLabel} />}
              {contacts != null && (
                <Pill label={`Contacts ${contacts}`} />
              )}
              {totalReps != null && (
                <Pill label={`Reps totales ${totalReps}`} />
              )}
            </View>
            {v2.analytics?.rationale ? (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {v2.analytics.rationale}
              </Text>
            ) : null}
          </View>
        )}

        {/* BADGES */}
        {v2.badges && v2.badges.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.rowWrap}>
              {v2.badges.map((b: string) => (
                <Pill key={b} label={b} />
              ))}
            </View>
          </View>
        ) : null}
        {recentBadges.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags utilisés (historique)</Text>
            <View style={styles.rowWrap}>
              {recentBadges.map((b) => (
                <Pill key={`hist_${b}`} label={b} />
              ))}
            </View>
          </View>
        ) : null}

        {/* WARMUP */}
        {warmup ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Échauffement recommandé</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {warmup.title} · {warmup.duration}
              </Text>
              <View style={{ marginTop: 6, gap: 4 }}>
                {warmup.steps.map((s, i) => (
                  <Text key={`wu_${i}`} style={styles.bullet}>
                    • {s}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* BLOCS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocs</Text>
          <View style={{ gap: 12 }}>
            {v2.blocks?.map((b: Block, i: number) => (
              <BlockCard key={`block_${i}`} block={b} index={i} />
            ))}
          </View>
        </View>

        {/* COACHING */}
        {v2.coaching_tips && v2.coaching_tips.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coaching</Text>
            {v2.coaching_tips.map((tip: string, i: number) => (
              <Text key={`tip_${i}`} style={styles.bullet}>
                • {tip}
              </Text>
            ))}
          </View>
        ) : null}

        {/* GUARDRails */}
        {v2.guardrails_applied && v2.guardrails_applied.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Garde-fous</Text>
            {v2.guardrails_applied.map((g: string, i: number) => (
              <Text key={`guard_${i}`} style={styles.bullet}>
                • {g.split('_').join(' ')}
              </Text>
            ))}
          </View>
        ) : null}

        {/* SÉCURITÉ */}
        {v2.safety_notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sécurité</Text>
            <Text style={styles.body}>{v2.safety_notes}</Text>
          </View>
        ) : null}

        {/* POST SESSION */}
        {v2.post_session?.mobility && v2.post_session.mobility.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Post-séance</Text>
            {v2.post_session.mobility.map((m: string, i: number) => (
              <Text key={`mob_${i}`} style={styles.bullet}>
                • {m}
              </Text>
            ))}
            {v2.post_session.cooldown_min ? (
              <Text style={styles.bullet}>
                • Retour au calme {v2.post_session.cooldown_min} min
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* BOUTON FEEDBACK */}
        {sessionId ? (
          <View style={[styles.section, { marginBottom: 24 }]}>
            <TouchableOpacity
              onPress={() =>
                nav.navigate('Feedback' as never, { sessionId } as never)
              }
              style={styles.feedbackBtn}
            >
              <Text style={styles.feedbackText}>Donner mon feedback</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ====== STYLES ======
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: palette.text },
  subtitle: { fontSize: 15, color: palette.sub, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pillText: { color: palette.text, fontWeight: '600', fontSize: 12 },
  section: { marginTop: 18 },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  muted: { color: palette.sub, marginTop: 2, fontSize: 12 },
  itemRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#111827',
  },
  itemName: { color: palette.text, fontWeight: '600', fontSize: 14 },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 1 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  bullet: { color: palette.text, marginBottom: 4, fontSize: 13 },
  rowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  body: { color: '#d8d8e5', fontSize: 13 },
  feedbackBtn: {
    backgroundColor: palette.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.accentSoft,
  },
  feedbackText: { color: '#050509', fontWeight: '700', fontSize: 15 },
  infoCard: {
    backgroundColor: '#11111a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f1f2a',
    marginTop: 12,
    gap: 2,
  },
});

function buildReasons(dateISO: string, clubDays: string[], matchDays: string[]) {
  const reasons: string[] = [];
  // Utilise le fuseau local pour coller au ressenti de l'utilisateur
  const d = new Date(`${dateISO}T00:00:00`);
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = map[d.getDay()] ?? '';
  const tomorrow = map[new Date(d.getTime() + 86400000).getDay()] ?? '';

  if (!matchDays.includes(tomorrow) && !matchDays.includes(today)) {
    reasons.push('Pas de match aujourd’hui ou demain');
  }
  if (clubDays.includes(tomorrow)) reasons.push('Veille de jour club : volume surveillé');
  if (!clubDays.includes(today) && !matchDays.includes(today)) {
    reasons.push('Jour libre de club/match → séance cible possible');
  }
  if (reasons.length === 0) reasons.push('Séance adaptée au calendrier déclaré');
  return reasons;
}
