// components/InjuryForm.tsx
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet, ScrollView } from 'react-native';
import type { InjuryRecord, InjuryArea, InjuryRestrictions, InjurySeverity, InjuryType } from '../domain/types';
import { INJURY_AREAS, INJURY_SEVERITY_LABELS, INJURY_TYPES, DEFAULT_RESTRICTIONS, RESTRICTIONS_PRESETS_BY_AREA } from '../constants/injury';

type Props = {
  value: InjuryRecord | null;
  onChange: (next: InjuryRecord | null) => void;
};

const todayISO = () => new Date().toISOString();

export default function InjuryForm({ value, onChange }: Props) {
  const active = !!value;

  const setBase = (patch: Partial<InjuryRecord>) => {
    if (!value) {
      // création
      const base: InjuryRecord = {
        area: (patch.area as InjuryArea) ?? 'autre',
        severity: (patch.severity as InjurySeverity) ?? 1,
        type: (patch.type as InjuryType) ?? 'aigu',
        restrictions: patch.restrictions ?? DEFAULT_RESTRICTIONS,
        startDate: patch.startDate ?? todayISO(),
        lastConfirm: todayISO(),
        // ⚠️ on n'ajoute PAS note ici si elle est undefined
      };
      const next = patch.note !== undefined ? { ...base, note: patch.note } : base;
      onChange(next);
      return;
    }
  
    // mise à jour
    const { note, ...restPatch } = patch; // ⚠️ on retire note si undefined
    const merged = { ...value, ...restPatch, lastConfirm: todayISO() };
    const next = note !== undefined ? { ...merged, note } : merged;
    onChange(next);
  };

  const toggleActive = () => {
    if (active) onChange(null);
    else setBase({});
  };

  const restrictions: InjuryRestrictions = useMemo(() => {
    if (!value) return DEFAULT_RESTRICTIONS;
    return value.restrictions ?? DEFAULT_RESTRICTIONS;
  }, [value]);

  const applyPresetForArea = (area: InjuryArea) => {
    const preset = RESTRICTIONS_PRESETS_BY_AREA[area];
    setBase({ area, restrictions: preset ? { ...DEFAULT_RESTRICTIONS, ...preset } : { ...DEFAULT_RESTRICTIONS } });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Blessure ?</Text>
        <Switch value={active} onValueChange={toggleActive} />
      </View>

      {!active ? (
        <Text style={styles.muted}>Aucune blessure active</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Zones */}
          <View>
            <Text style={styles.label}>Zone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {INJURY_AREAS.map((a) => {
                const selected = value?.area === a;
                return (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => applyPresetForArea(a)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Sévérité */}
          <View>
            <Text style={styles.label}>Sévérité</Text>
            <View style={styles.rowWrap}>
              {[0,1,2,3].map((s) => {
                const sel = value?.severity === s;
                return (
                  <TouchableOpacity key={s} style={[styles.btn, sel && styles.btnPrimary]} onPress={() => setBase({ severity: s as InjurySeverity })}>
                    <Text style={[styles.btnText, sel && styles.btnTextPrimary]}>{INJURY_SEVERITY_LABELS[s as 0|1|2|3]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Type */}
          <View>
            <Text style={styles.label}>Type</Text>
            <View style={styles.rowWrap}>
              {INJURY_TYPES.map((t) => {
                const sel = value?.type === t;
                return (
                  <TouchableOpacity key={t} style={[styles.btn, sel && styles.btnPrimary]} onPress={() => setBase({ type: t })}>
                    <Text style={[styles.btnText, sel && styles.btnTextPrimary]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Restrictions */}
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Restrictions</Text>
            {([
              ['avoidSprint', 'Éviter sprint'],
              ['avoidPlyo', 'Éviter sauts/plyo'],
              ['avoidHeavyLower', 'Éviter charges lourdes jambes'],
              ['avoidHeavyUpper', 'Éviter charges lourdes haut du corps'],
              ['avoidCutsImpacts', 'Éviter changements d’appuis/impacts'],
              ['avoidOverhead', 'Éviter mouvements overhead'],
            ] as const).map(([key, label]) => {
              const k = key as keyof InjuryRestrictions;
              const val = !!restrictions[k];
              return (
                <View key={key} style={styles.restrictRow}>
                  <Text style={{ flex: 1 }}>{label}</Text>
                  <Switch
                    value={val}
                    onValueChange={(nv) => setBase({ restrictions: { ...restrictions, [k]: nv } })}
                  />
                </View>
              );
            })}
          </View>

          {/* Note */}
          <View>
            <Text style={styles.label}>Note (optionnel)</Text>
            <TextInput
              value={value?.note ?? ''}
              onChangeText={(txt) => setBase({ note: txt })}
              placeholder="Ex: douleur au genou après match…"
              style={styles.input}
              multiline
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', padding: 12, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#777' },
  label: { fontWeight: '600', marginBottom: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  btnPrimary: { backgroundColor: '#111', borderColor: '#111' },
  btnText: { color: '#111' },
  btnTextPrimary: { color: '#fff' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#ccc' },
  chipSelected: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#111' },
  chipTextSelected: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 10, minHeight: 44 },
  restrictRow: { flexDirection: 'row', alignItems: 'center' },
});
