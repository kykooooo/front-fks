// screens/PrebuiltSessionsScreen.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrainingStore } from "../state/trainingStore";
import { useNavigation } from "@react-navigation/native";

const palette = {
  bg: "#050509",
  bgSoft: "#050815",
  card: "#080C14",
  cardSoft: "#0c0e13",
  border: "#111827",
  borderSoft: "#1f2430",
  text: "#f9fafb",
  sub: "#9ca3af",
  accent: "#f97316",
  accentSoft: "rgba(249,115,22,0.16)",
};

type Prebuilt = {
  category: string;
  title: string;
  intensity: string; // "hard · 45–55'"
  duration: string;
  objective: string;
  detail: string[];
};

const PREBUILT_SESSIONS: Prebuilt[] = [
  {
    category: "RUN",
    title: "RUN #1 — VMA footballeur",
    intensity: "hard",
    duration: "45–55'",
    objective: "Pic de VMA, allure match, volume court mais qualitatif",
    detail: [
      "Échauffement 12–15' : footing léger, gammes, 3–4 lignes droites",
      "Bloc : 2 x 6 x 30\" @ ~100–105% VMA, 30\" rec, 3' entre séries",
      "Option finisher : 4 x 60 m progressifs (RPE 6–7)",
      "Retour au calme : footing léger + étirements dynamiques",
    ],
  },
  {
    category: "RUN",
    title: "RUN #2 — Tempo aérobie / seuil",
    intensity: "moderate",
    duration: "45–60'",
    objective: "Tenir un gros rythme match sans épuisement",
    detail: [
      "Échauffement 10' : footing progressif + 2 lignes droites",
      "Bloc : 3 x 8' allure confort-dur (mi-temps) · 3' rec",
      "Retour au calme : footing léger + mobilité hanches/chevilles",
    ],
  },
  {
    category: "STRENGTH",
    title: "STRENGTH #1 — Force bas du corps (gym)",
    intensity: "hard",
    duration: "60'",
    objective: "Force max utile sprint/duels",
    detail: [
      "Warm-up 10' : vélo/rameur + activation hanches/post chaîne",
      "Bloc 1 : Back ou front squat 4 x 4–5 @ 80–85% (2–3' rec)",
      "Bloc 2 : Bulgarian split squat 3 x 6–8 / jambe + Nordic assisté 3 x 4–6",
      "Bloc 3 : Copenhagen plank 3 x 20–30\" / côté + Planche 3 x 30–40\"",
      "Cool-down : étirements légers quadris/ischios/adducteurs",
    ],
  },
  {
    category: "STRENGTH",
    title: "STRENGTH #2 — Full body “match ready”",
    intensity: "moderate",
    duration: "45–50'",
    objective: "Full body dense, in-season",
    detail: [
      "Warm-up 8' : circuit léger (squat, pompe, good-morning, planche)",
      "Bloc circuit 3–4 tours : Goblet squat, Row, Hip thrust, Push-up (8–12 reps), 90–120\" rec",
      "Finisher core 6–8' : 3 x (dead bug, side plank, hollow)",
    ],
  },
  {
    category: "SPEED",
    title: "SPEED #1 — Vitesse max",
    intensity: "hard",
    duration: "30–40'",
    objective: "Top speed, volume bas, qualité",
    detail: [
      "Warm-up terrain 12–15' : footing léger, gammes, 3–4 lignes droites",
      "Bloc : 6 x 30–40 m à 95–100%, départ lancé, 2–3' rec",
      "Option COD léger : 4 x 20 m + COD 45° (RPE 7)",
    ],
  },
  {
    category: "SPEED",
    title: "SPEED #2 — RSA (Repeated Sprints)",
    intensity: "hard",
    duration: "30–40'",
    objective: "RSA sans finir cramé",
    detail: [
      "Warm-up 10–12'",
      "Bloc : 2 x 6 x (20 m + 20 m retour), 20\" rec entre sprints, 3' entre séries, RPE 7–8",
    ],
  },
  {
    category: "CIRCUIT",
    title: "CIRCUIT #1 — Conditioning terrain",
    intensity: "hard",
    duration: "30–35'",
    objective: "Cardio typé match sans matos",
    detail: [
      "Warm-up 8'",
      "Circuit 3–4 tours : 30\" shuttle run, 30\" squats/fentes, 30\" planche dynamique, 30\" récup, 30\" skipping, 30\" pompes, 60–90\" rec",
      "Cible RPE 7",
    ],
  },
  {
    category: "CIRCUIT",
    title: "CIRCUIT #2 — Gym floor",
    intensity: "moderate",
    duration: "45'",
    objective: "Force/cardio mix salle",
    detail: [
      "Circuit 3 rounds : Kettlebell swing 12, Goblet squat 10, Row 10, Farmer walk 30–40 m, Core 30\", 2' rec",
    ],
  },
  {
    category: "PLYO",
    title: "PLYO #1 — Sauts verticaux",
    intensity: "hard",
    duration: "30'",
    objective: "Explosivité + contrôle atterrissage",
    detail: [
      "Prep 8' : gammes + pogos 2 x 15",
      "Bloc : Box jumps 4 x 5, CMJ 3 x 6, Drop jump 3 x 5 (20–30 cm), 60–90\" rec",
    ],
  },
  {
    category: "PLYO",
    title: "PLYO #2 — COD & réactivité",
    intensity: "moderate",
    duration: "30–40'",
    objective: "COD court + appuis rapides",
    detail: [
      "Warm-up 8–10'",
      "Bloc COD : 4 x T-test court, 4 x slalom cônes 10–15 m (RPE 6–7), 3 x 15–20\" appuis rapides échelle/lignes",
    ],
  },
  {
    category: "MOBILITY",
    title: "MOBILITY #1 — Day after match",
    intensity: "easy",
    duration: "25–30'",
    objective: "Déverrouillage global, RPE 2–3",
    detail: [
      "Bloc 1 (10') : cat-camel, hip airplanes, squat prière",
      "Bloc 2 (10') : Couch stretch, hamstring actif, adducteur latéral",
      "Bloc 3 (5–10') : dorsiflexion murale, toes yoga",
    ],
  },
];

const INTENSITY_LABEL: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const INTENSITY_COLOR: Record<string, string> = {
  easy: "#4ade80",
  moderate: "#facc15",
  hard: "#fb7185",
};

export default function PrebuiltSessionsScreen() {
  const sessions = useTrainingStore((s) => s.sessions);
  const pending = sessions.filter((s) => !s.completed);
  const nav = useNavigation<any>();

  const grouped = useMemo(() => {
    const map: Record<string, Prebuilt[]> = {};
    for (const s of PREBUILT_SESSIONS) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return Object.entries(map);
  }, []);

  const pendingCount = pending.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroTitle}>Séances FKS</Text>
              <Text style={styles.heroSubtitle}>Bibliothèque opti par catégorie</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>Pré-construites</Text>
              <Text style={styles.heroBadgeValue}>
                {PREBUILT_SESSIONS.length}
              </Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>En attente</Text>
              <Text style={styles.heroStatValue}>{pendingCount}</Text>
              <Text style={styles.heroStatSub}>séance(s)</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Catégories</Text>
              <Text style={styles.heroStatValue}>{grouped.length}</Text>
              <Text style={styles.heroStatSub}>types de travail</Text>
            </View>
          </View>
        </View>

        {/* Pending sessions block */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Séances planifiées</Text>
            {pendingCount > 0 && (
              <View style={styles.sectionChip}>
                <Text style={styles.sectionChipText}>{pendingCount} en attente</Text>
              </View>
            )}
          </View>

          {pendingCount === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Aucune séance en attente. Tu peux lancer une séance FKS ou choisir un
                template ci-dessous.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {pending.map((s) => {
                const date = (s.dateISO ?? (s as any).date ?? "").slice(0, 10);
                const focus = s.focus ?? (s as any).modality ?? "—";
                const dur =
                  typeof s.durationMin === "number"
                    ? `${Math.round(s.durationMin)} min`
                    : typeof s.volumeScore === "number"
                    ? `${Math.round(s.volumeScore)} min`
                    : "—";

                return (
                  <View key={s.id} style={styles.pendingCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingTitle}>{focus}</Text>
                      <Text style={styles.pendingSub}>
                        {date} · {s.intensity ?? "—"} · {dur}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Library by category */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bibliothèque FKS</Text>
            <Text style={styles.sectionSubTitle}>Séances prêtes à l’emploi</Text>
          </View>

          {grouped.map(([category, list]) => (
            <View key={category} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{category}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{list.length} séances</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {list.map((s) => {
                  const intensityColor =
                    INTENSITY_COLOR[s.intensity] ?? palette.accent;

                  return (
                    <TouchableOpacity
                      key={s.title}
                      style={styles.prebuiltCard}
                      activeOpacity={0.9}
                      onPress={() =>
                        nav.navigate(
                          "PrebuiltSessionDetail" as never,
                          { session: s } as never
                        )
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardTitle}>{s.title}</Text>
                        </View>

                        <View style={styles.tagsRow}>
                          <View style={[styles.tag, { borderColor: intensityColor }]}>
                            <View
                              style={[
                                styles.tagDot,
                                { backgroundColor: intensityColor },
                              ]}
                            />
                            <Text style={styles.tagText}>
                              {INTENSITY_LABEL[s.intensity] ?? s.intensity}
                            </Text>
                          </View>
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>{s.duration}</Text>
                          </View>
                        </View>

                        <Text style={styles.cardObjective} numberOfLines={2}>
                          {s.objective}
                        </Text>
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroBadgeLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: palette.sub,
  },
  heroBadgeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.accent,
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.text,
    marginTop: 2,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  sectionSubTitle: {
    fontSize: 12,
    color: palette.sub,
  },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  sectionChipText: {
    fontSize: 11,
    color: palette.sub,
  },

  // Pending
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.bgSoft,
  },
  emptyText: {
    fontSize: 12,
    color: palette.sub,
  },
  pendingCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.cardSoft,
    flexDirection: "row",
    alignItems: "center",
  },
  pendingTitle: {
    color: palette.text,
    fontWeight: "600",
    fontSize: 14,
  },
  pendingSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },

  // Categories
  categoryBlock: {
    marginTop: 8,
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: palette.sub,
  },

  // Prebuilt cards
  prebuiltCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    backgroundColor: palette.cardSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },
  tagText: {
    fontSize: 11,
    color: palette.sub,
  },
  cardObjective: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 6,
  },

  arrow: {
    fontSize: 20,
    color: palette.sub,
    marginLeft: 8,
  },
});
