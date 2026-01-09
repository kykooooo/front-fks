// screens/ProfileScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useTrainingStore } from '../state/trainingStore';
import { auth } from '../services/firebase';
import { computeStreakStats } from '../state/trainingStore/helpers';

const palette = {
  bg: '#050509',
  bgSoft: '#050815',
  card: '#080C14',
  cardSoft: '#0c0e13',
  border: '#111827',
  borderSoft: '#1f2430',
  text: '#f9fafb',
  sub: '#9ca3af',
  accent: '#f97316',
  accentSoft: 'rgba(249,115,22,0.18)',
  success: '#22c55e',
  warn: '#facc15',
  danger: '#fb7185',
};

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
};

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const nav = useNavigation<any>();

  const sessions = useTrainingStore((s) => s.sessions);
  const phase = useTrainingStore((s) => s.phase);
  const phaseCount = useTrainingStore((s) => s.phaseCount);
  const tsb = useTrainingStore((s) => s.tsb);
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsbHistory = useTrainingStore((s) => s.tsbHistory ?? []);
  const clubDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const devNowISO = useTrainingStore((s) => s.devNowISO);

  const athleteName = auth.currentUser?.displayName || 'athlète';

  const completedCount = useMemo(
    () => sessions.filter((s: any) => s.completed).length,
    [sessions]
  );
  const plannedCount = useMemo(
    () => sessions.filter((s: any) => !s.completed).length,
    [sessions]
  );

  const lastSessionDate = useMemo(() => {
    const done = [...sessions]
      .filter((s: any) => s.completed)
      .sort(
        (a, b) =>
          new Date(b.dateISO ?? b.date ?? 0).getTime() -
          new Date(a.dateISO ?? a.date ?? 0).getTime()
      );
    if (!done.length) return '—';
    const d = done[0].dateISO ?? done[0].date;
    if (!d) return '—';
    return format(new Date(d), "dd MMM", { locale: fr });
  }, [sessions]);

  const tsbLabel = tsb >= 0 ? 'Frais' : tsb <= -10 ? 'Fatigué' : 'En charge modérée';
  const tsbColor =
    tsb >= 0 ? palette.success : tsb <= -10 ? palette.danger : palette.accent;

  const tsbTrend = useMemo(() => {
    const vals = [...tsbHistory].slice(0, 7);
    if (vals.length < 2) return 'stable';
    const diff = vals[0] - vals[vals.length - 1];
    if (diff > 2) return 'en montée';
    if (diff < -2) return 'en baisse';
    return 'stable';
  }, [tsbHistory]);

  const fatigueTag =
    tsb <= -15 ? 'Fatigue élevée' : tsb <= -8 ? 'Fatigue modérée' : 'Fatigue OK';
  const riskTag =
    tsb <= -12 ? 'Risque : à surveiller' : tsb < -5 ? 'Risque : modéré' : 'Risque : bas';

  const streaks = useMemo(
    () =>
      computeStreakStats(
        sessions as any,
        [] as any,
        devNowISO ?? new Date().toISOString()
      ),
    [sessions, devNowISO]
  );

  const dayMap: Record<string, string> = {
    mon: 'Lundi',
    tue: 'Mardi',
    wed: 'Mercredi',
    thu: 'Jeudi',
    fri: 'Vendredi',
    sat: 'Samedi',
    sun: 'Dimanche',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO PROFIL JOUEUR */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {athleteName
                  .split(' ')
                  .map((p: any[]) => p[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{athleteName}</Text>
              <Text style={styles.heroRole}>Athlète FKS</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>TSB</Text>
              <Text style={[styles.heroBadgeValue, { color: tsbColor }]}>
                {tsb.toFixed(1)}
              </Text>
              <Text style={styles.heroBadgeSub}>{tsbLabel}</Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Séances complétées</Text>
              <Text style={styles.heroStatValue}>{completedCount}</Text>
              <Text style={styles.heroStatSub}>depuis le début</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Dernière séance</Text>
              <Text style={styles.heroStatValue}>{lastSessionDate}</Text>
              <Text style={styles.heroStatSub}>
                Phase {phase || '—'} · #{phaseCount || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* STATS SÉANCES */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Séances FKS</Text>
            <Text style={styles.sectionSubTitle}>Vue globale</Text>
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Planifiées"
              value={String(plannedCount)}
              sub="En attente dans le pipe"
            />
            <StatCard
              label="Complétées"
              value={String(completedCount)}
              sub="Séances validées"
            />
          </View>
        </View>

        {/* MOMENTUM / RÉGULARITÉ */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Momentum</Text>
            <Text style={styles.sectionSubTitle}>Constance hebdo / mensuelle</Text>
          </View>
          <View style={styles.streakCard}>
            <View style={styles.streakRow}>
              <Text style={styles.streakLabel}>Semaines avec FKS</Text>
              <Tag label={`${streaks.weeksFks} semaine${streaks.weeksFks > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>≥ 1 séance FKS par semaine sans interruption.</Text>

            <View style={[styles.streakRow, { marginTop: 10 }]}>
              <Text style={styles.streakLabel}>Club / match hebdo</Text>
              <Tag label={`${streaks.weeksClubMatch} semaine${streaks.weeksClubMatch > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>Présent chaque semaine en club ou en match.</Text>

            <View style={[styles.streakRow, { marginTop: 10 }]}>
              <Text style={styles.streakLabel}>VMA / tempo (mois)</Text>
              <Tag label={`${streaks.monthlyVmaCount} séance${streaks.monthlyVmaCount > 1 ? 's' : ''}`} />
            </View>
            <Text style={styles.streakHint}>Objectif: 4 séances VMA/tempo dans le mois.</Text>
          </View>
        </View>

        {/* CHARGE & FORME */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Charge & forme</Text>
            <Tag label={`Forme : ${tsbTrend}`} />
          </View>

          <View style={styles.loadCard}>
            <Text style={styles.loadMain}>
              ATL {atl.toFixed(1)} · CTL {ctl.toFixed(1)}
            </Text>
            <Text style={styles.loadSub}>
              ATL = charge récente, CTL = charge de fond. TSB = différence entre les deux.
            </Text>

            {/* Chips fatigue / risque */}
            <View style={styles.tagRow}>
              <Tag label={fatigueTag} />
              <Tag label={riskTag} />
            </View>

            {/* Mini-bar chart TSB 7 jours */}
            <View style={styles.chartRow}>
              {Array.from({ length: 7 }).map((_, idx) => {
                const val = tsbHistory[idx] ?? tsb;
                const height = Math.max(8, Math.min(60, Math.abs(val) * 2));
                const color = val >= 0 ? palette.success : palette.accent;
                const label =
                  idx === 0
                    ? 'J'
                    : idx === 1
                    ? 'J-1'
                    : idx === 2
                    ? 'J-2'
                    : idx === 3
                    ? 'J-3'
                    : idx === 4
                    ? 'J-4'
                    : idx === 5
                    ? 'J-5'
                    : 'J-6';
                return (
                  <View key={idx} style={styles.barWrapper}>
                    <Text style={styles.barValue}>{val.toFixed(0)}</Text>
                    <View
                      style={[
                        styles.bar,
                        { height, backgroundColor: color },
                      ]}
                    />
                    <Text style={styles.barLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.loadHint}>
              Négatif = charge élevée (à surveiller), positif = fenêtre plus fraîche.
            </Text>
          </View>
        </View>

        {/* SEMAINE TYPE */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Semaine type</Text>
            <Text style={styles.sectionSubTitle}>Club + match</Text>
          </View>

          <View style={styles.weekCard}>
            <Text style={styles.weekTitle}>Entraînements club</Text>
            {clubDays.length === 0 ? (
              <Text style={styles.weekEmpty}>Aucun jour renseigné.</Text>
            ) : (
              <View style={styles.weekTagsRow}>
                {clubDays.map((d) => (
                  <Tag key={d} label={dayMap[d] ?? d} />
                ))}
              </View>
            )}

            <View style={styles.weekDivider} />

            <Text style={styles.weekTitle}>Match</Text>
            {matchDays.length === 0 ? (
              <Text style={styles.weekEmpty}>Jour de match non renseigné.</Text>
            ) : (
              <View style={styles.weekTagsRow}>
                {matchDays.map((d) => (
                  <Tag key={d} label={dayMap[d] ?? d} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* CTA MODIFIER PROFIL */}
        <View style={{ marginTop: 4, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => nav.navigate('ProfileSetup')}
            activeOpacity={0.9}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>Modifier mon profil joueur</Text>
            <Text style={styles.editBtnSub}>
              Position, niveau, contraintes, semaine type…
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: palette.bg,
  },

  // HERO
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  heroRole: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  heroBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: 'flex-end',
  },
  heroBadgeLabel: {
    fontSize: 10,
    color: palette.sub,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroBadgeValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  heroBadgeSub: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginTop: 2,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
    marginHorizontal: 16,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: palette.sub,
  },

  // Stat cards
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.cardSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  statLabel: {
    color: palette.sub,
    fontSize: 12,
  },
  statValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statSub: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 2,
  },

  // Tag
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2430',
  },
  tagText: {
    color: palette.sub,
    fontSize: 11,
    fontWeight: '600',
  },

  // Charge & forme
  loadCard: {
    backgroundColor: palette.cardSoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  loadMain: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loadSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    height: 80,
  },
  barWrapper: {
    alignItems: 'center',
    width: 32,
  },
  barValue: {
    color: palette.sub,
    fontSize: 10,
  },
  bar: {
    width: 16,
    borderRadius: 4,
    opacity: 0.9,
    marginTop: 2,
  },
  barLabel: {
    color: palette.sub,
    fontSize: 10,
    marginTop: 2,
  },
  loadHint: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 8,
  },

  // Streaks / momentum
  streakCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.bgSoft,
    gap: 4,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  streakHint: {
    fontSize: 11,
    color: palette.sub,
  },

  // Semaine type
  weekCard: {
    backgroundColor: palette.cardSoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    gap: 8,
  },
  weekTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  weekEmpty: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },
  weekTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  weekDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginVertical: 4,
  },

  // CTA édit profil
  editBtn: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  editBtnText: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  editBtnSub: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 2,
  },
});
