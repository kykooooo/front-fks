import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

const palette = {
  bg: "#050509",
  card: "#0c0e13",
  cardSoft: "#10131b",
  border: "#1f2430",
  text: "#f9fafb",
  sub: "#9ca3af",
  accent: "#f97316",
  accentSoft: "#fed7aa",
  success: "#22c55e",
  danger: "#ef4444",
};

const STORAGE_KEY = "fks_tests_v1";

type TestEntry = {
  ts: number;
  broadJumpCm?: number;
  tripleJumpCm?: number;
  sprint10s?: number;
  sprint20s?: number;
  sprint30s?: number;
  endurance6min_m?: number;
  gobletKg?: number;
  gobletReps?: number;
  splitKg?: number;
  splitReps?: number;
  notes?: string;
};

type FieldKey = keyof Omit<TestEntry, "ts">;

type FieldConfig = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  group: "sauts" | "vitesse" | "endurance" | "force" | "autre";
};

const FIELDS: FieldConfig[] = [
  // SAUTS
  { key: "broadJumpCm", label: "Saut en longueur (cm)", group: "sauts" },
  { key: "tripleJumpCm", label: "Triple bonds (cm)", group: "sauts" },

  // VITESSE
  { key: "sprint10s", label: "Vitesse 10 m (s)", group: "vitesse" },
  { key: "sprint20s", label: "Vitesse 20 m (s)", group: "vitesse" },
  { key: "sprint30s", label: "Vitesse 30 m (s)", group: "vitesse" },

  // ENDURANCE
  { key: "endurance6min_m", label: "Endurance 6' (m)", group: "endurance" },

  // FORCE
  { key: "gobletKg", label: "Goblet squat charge (kg)", group: "force" },
  { key: "gobletReps", label: "Goblet squat reps", group: "force" },
  { key: "splitKg", label: "Split squat charge (kg)", group: "force" },
  { key: "splitReps", label: "Split squat reps", group: "force" },
];

const protoPlan = [
  "Échauffement structuré (mobilité + activation + lignes droites)",
  "Sauts : broad jump puis triple bonds",
  "Vitesse : 10–30 m",
  "Pause 5–10 min (hydratation)",
  "Endurance : 6 min",
  "Force repère : goblet squat 8–10RM ou split squat",
];

type Mode = "overview" | "edit";

export default function TestsScreen() {
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [form, setForm] = useState<Partial<TestEntry>>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("edit");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TestEntry[];
          setEntries(parsed);
          if (parsed[0]) {
            const rest = { ...parsed[0] } as any;
            delete rest.ts;
            setForm(rest);
          }
          if (parsed.length > 0) {
            setMode("overview");
          }
        }
      } catch (e) {
        console.warn("load tests", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    const cleanEntry: TestEntry = { ts: Date.now() };
    (Object.keys(form) as FieldKey[]).forEach((k) => {
      const val = (form as any)[k];
      if (val !== undefined && val !== null && val !== "") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          (cleanEntry as any)[k] = num;
        }
      }
    });
    cleanEntry.notes = form.notes || undefined;

    try {
      const next = [cleanEntry, ...entries].slice(0, 30);
      setEntries(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      Alert.alert("Enregistré", "Tes valeurs de test sont sauvegardées.");
      // Après sauvegarde, on repasse en vue overview
      setMode("overview");
    } catch (e) {
      console.warn("save tests", e);
      Alert.alert("Erreur", "Impossible de sauvegarder les tests.");
    }
  };

  const lastTwo = useMemo(() => entries.slice(0, 2), [entries]);
  const last = lastTwo[0];

  const groupedFields = useMemo(() => {
    const groups: Record<string, { title: string; fields: FieldConfig[] }> = {
      sauts: { title: "Sauts / Explosivité", fields: [] },
      vitesse: { title: "Vitesse linéaire", fields: [] },
      endurance: { title: "Endurance aérobie", fields: [] },
      force: { title: "Force repère", fields: [] },
    };

    for (const f of FIELDS) {
      if (groups[f.group]) {
        groups[f.group].fields.push(f);
      }
    }
    return Object.values(groups).filter((g) => g.fields.length > 0);
  }, []);

  const getUnitForField = (key: FieldKey): string => {
    switch (key) {
      case "broadJumpCm":
      case "tripleJumpCm":
        return "cm";
      case "endurance6min_m":
        return "m";
      case "sprint10s":
      case "sprint20s":
      case "sprint30s":
        return "s";
      case "gobletKg":
      case "splitKg":
        return "kg";
      default:
        return "";
    }
  };

  const isBetterDelta = (key: FieldKey, delta: number): boolean => {
    // Pour les sprints : plus petit = mieux
    if (key === "sprint10s" || key === "sprint20s" || key === "sprint30s") {
      return delta < 0;
    }
    // Pour tout le reste : plus grand = mieux
    return delta > 0;
  };

  const renderDelta = (key: FieldKey) => {
    if (lastTwo.length < 2) return null;
    const curr = lastTwo[0]?.[key];
    const prev = lastTwo[1]?.[key];
    if (curr === undefined || prev === undefined) return null;

    const currNum = Number(curr);
    const prevNum = Number(prev);
    if (!Number.isFinite(currNum) || !Number.isFinite(prevNum)) return null;

    const delta = currNum - prevNum;
    if (delta === 0) return null;

    const better = isBetterDelta(key, delta);
    const sign = delta > 0 ? "+" : "";
    const unit = getUnitForField(key);
    const arrow = better ? "↑" : "↓";

    return (
      <View style={styles.deltaChip}>
        <Text style={[styles.deltaText, { color: better ? palette.success : palette.danger }]}>
          {arrow} {sign}
          {Math.abs(delta).toFixed(2)} {unit}
        </Text>
        <Text style={styles.deltaSub}>vs. dernier test</Text>
      </View>
    );
  };

  const renderOverviewCard = () => {
    if (!last) return null;

    return (
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Ta dernière performance</Text>
            <Text style={styles.sectionSub}>
              {lastTwo.length > 1
                ? "Comparée au test précédent."
                : "Premier test enregistré."}
            </Text>
          </View>
          <View style={styles.overviewPill}>
            <Text style={styles.overviewPillLabel}>Test</Text>
            <Text style={styles.overviewPillDate}>
              {format(new Date(last.ts), "dd/MM")}
            </Text>
          </View>
        </View>

        <View style={{ gap: 14, marginTop: 10 }}>
          {groupedFields.map((group) => (
            <View key={group.title} style={styles.overviewGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={{ gap: 8 }}>
                {group.fields.map((f) => {
                  const val = last[f.key];
                  if (val === undefined) return null;
                  const unit = getUnitForField(f.key);
                  return (
                    <View key={f.key} style={styles.overviewMetricRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.overviewMetricLabel}>{f.label}</Text>
                        <Text style={styles.overviewMetricValue}>
                          {val}
                          {unit ? ` ${unit}` : ""}
                        </Text>
                      </View>
                      {renderDelta(f.key)}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {last.notes ? (
            <View style={styles.overviewNotesBlock}>
              <Text style={styles.groupTitle}>Notes du jour</Text>
              <Text style={styles.overviewNotesText}>{last.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Batterie de tests FKS</Text>
            <Text style={styles.subtitle}>
              Référence terrain pour suivre ta progression sur la saison.
            </Text>
          </View>
          {last && (
            <View style={styles.lastBadge}>
              <Text style={styles.lastBadgeLabel}>Dernier test</Text>
              <Text style={styles.lastBadgeDate}>
                {format(new Date(last.ts), "dd/MM/yyyy")}
              </Text>
            </View>
          )}
        </View>

        {/* PLAN */}
        <View style={styles.planCard}>
          <Text style={styles.sectionTitle}>Déroulé conseillé</Text>
          <View style={{ gap: 10, marginTop: 6 }}>
            {protoPlan.map((step, idx) => (
              <View key={step} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{idx + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* OVERVIEW OU FORM */}
        {mode === "overview" && entries.length > 0 ? (
          <>
            {renderOverviewCard()}

            <TouchableOpacity
              style={styles.refaireBtn}
              activeOpacity={0.9}
              onPress={() => setMode("edit")}
            >
              <Text style={styles.refaireBtnText}>Refaire un test complet</Text>
              <Text style={styles.refaireBtnSub}>
                Nouveau test, les anciens restent en historique.
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Saisis tes valeurs</Text>
            <Text style={styles.sectionSub}>
              Idéalement sur le même terrain, même chaussures, même moment de la journée.
            </Text>

            <View style={{ gap: 18, marginTop: 10 }}>
              {groupedFields.map((group) => (
                <View key={group.title} style={styles.groupBlock}>
                  <View style={styles.groupHeaderRow}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                  </View>

                  <View style={{ gap: 12 }}>
                    {group.fields.map((f) => (
                      <View key={f.key} style={{ gap: 4 }}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>{f.label}</Text>
                          {renderDelta(f.key)}
                        </View>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          placeholder={f.placeholder || "0"}
                          placeholderTextColor={palette.sub}
                          value={form[f.key]?.toString() ?? ""}
                          onChangeText={(txt) =>
                            setForm((prev) => ({ ...prev, [f.key]: txt }))
                          }
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* NOTES */}
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupTitle}>Notes du jour</Text>
                  <Text style={styles.groupTag}>Contexte</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Ressenti, météo, surface, fatigue, blessure légère..."
                  placeholderTextColor={palette.sub}
                  multiline
                  value={form.notes ?? ""}
                  onChangeText={(txt) => setForm((prev) => ({ ...prev, notes: txt }))}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              activeOpacity={0.9}
              onPress={save}
              disabled={loading}
            >
              <Text style={styles.saveBtnText}>
                {loading ? "Chargement..." : "Sauvegarder ce test"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HISTORIQUE */}
        {entries.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Historique récent</Text>
            <Text style={styles.sectionSub}>
              Vue rapide : saut, vitesse courte et 6 minutes.
            </Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {entries.slice(0, 5).map((e) => (
                <View key={e.ts} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyDate}>
                      {format(new Date(e.ts), "dd/MM/yyyy")}
                    </Text>
                    <Text style={styles.historyTime}>
                      {format(new Date(e.ts), "HH:mm")}
                    </Text>
                  </View>
                  <Text style={styles.historyValues}>
                    {[
                      e.broadJumpCm ? `SJ ${e.broadJumpCm}cm` : null,
                      e.sprint10s ? `10m ${e.sprint10s}s` : null,
                      e.endurance6min_m ? `6' ${e.endurance6min_m}m` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "--"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
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
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.sub,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  lastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "flex-end",
  },
  lastBadgeLabel: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastBadgeDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  // CARDS
  planCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 6,
  },
  formCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 12,
  },
  historyCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },

  // PLAN STEPS
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.accent,
    textAlign: "center",
    fontWeight: "700",
    paddingTop: 2,
    fontSize: 12,
  },
  stepText: {
    color: palette.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // GROUPS
  groupBlock: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  groupTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    color: palette.accent,
    borderWidth: 1,
    borderColor: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // INPUTS
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },
  inputLabel: {
    color: palette.sub,
    fontSize: 12,
  },
  input: {
    backgroundColor: "#050713",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  // DELTA
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#050713",
    alignItems: "flex-end",
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  deltaSub: {
    fontSize: 9,
    color: palette.sub,
  },

  // BUTTONS
  saveBtn: {
    marginTop: 12,
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#0b0f19",
    fontWeight: "700",
    fontSize: 14,
  },
  refaireBtn: {
    marginTop: 12,
    backgroundColor: palette.cardSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  refaireBtnText: {
    color: palette.accentSoft,
    fontWeight: "700",
    fontSize: 14,
  },
  refaireBtnSub: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 4,
  },

  // HISTORY
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31, 36, 48, 0.6)",
  },
  historyDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600",
  },
  historyTime: {
    color: palette.sub,
    fontSize: 10,
  },
  historyValues: {
    color: palette.text,
    fontSize: 12,
    textAlign: "right",
  },

  // OVERVIEW
  overviewCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 10,
  },
  overviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  overviewPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "flex-end",
  },
  overviewPillLabel: {
    color: palette.sub,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  overviewPillDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  overviewGroup: {
    gap: 8,
  },
  overviewMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  overviewMetricLabel: {
    color: palette.sub,
    fontSize: 11,
  },
  overviewMetricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  overviewNotesBlock: {
    marginTop: 6,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#050713",
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  overviewNotesText: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
  },
});
