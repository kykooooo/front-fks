// components/InjuryForm.tsx
//
// Formulaire de déclaration d'une "zone sensible" (vocabulaire Option A).
// Utilisé dans :
//   - FeedbackScreen.PainInjuryRow (post-séance, consentement déjà donné
//     à l'inscription) → `requireLegalConsent={false}` (default).
//   - ProfileSetupScreen étape 4 (inscription) → `requireLegalConsent={true}`.
//   - ProfileScreen section "Zones sensibles" (modif plus tard) →
//     `requireLegalConsent={true}`.
//
// Vocabulaire UI (Option A validée) : on utilise "gêne" / "zone sensible".
// Mots bannis UI : diagnostic, pathologie, symptôme, traiter, soigner,
// lésion, médical (sauf disclaimer légal).
//
// Types TypeScript internes (InjuryRecord, InjuryArea, activeInjuries)
// INCHANGÉS — le renommage est uniquement UI.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InjuryRecord, InjuryArea, InjuryRestrictions, InjurySeverity, InjuryType } from '../domain/types';
import { INJURY_AREAS, INJURY_SEVERITY_LABELS, INJURY_TYPES, DEFAULT_RESTRICTIONS, RESTRICTIONS_PRESETS_BY_AREA } from '../constants/injury';
import { theme, TYPE, RADIUS } from "../constants/theme";
import { InjuryLegalBanner } from './InjuryLegalBanner';

type Props = {
  value: InjuryRecord | null;
  onChange: (next: InjuryRecord | null) => void;
  /**
   * Si `true`, affiche la bannière légale + 2 checkboxes obligatoires
   * (disclaimer médical + consentement RGPD art. 9 données de santé) +
   * la phrase de transparence des données collectées.
   *
   * Default : `false` (pour rester rétro-compatible avec les usages
   * post-séance où le consentement est déjà acquis à l'inscription).
   */
  requireLegalConsent?: boolean;
  /**
   * Appelé à chaque toggle de checkbox quand `requireLegalConsent={true}`.
   * Le parent l'utilise pour désactiver le bouton "Enregistrer" tant que
   * les deux cases ne sont pas cochées.
   */
  onConsentChange?: (bothChecked: boolean) => void;
  /**
   * Pour ouvrir la politique de confidentialité depuis la checkbox RGPD.
   */
  onOpenPrivacyPolicy?: () => void;
};

const TRANSPARENCE_PHRASE =
  "Données collectées : zone concernée, niveau de gêne, date. Stockées uniquement pour adapter tes séances. Supprimables à tout moment depuis Paramètres.";

const todayISO = () => new Date().toISOString();
const palette = theme.colors;

export default function InjuryForm({
  value,
  onChange,
  requireLegalConsent = false,
  onConsentChange,
  onOpenPrivacyPolicy,
}: Props) {
  const active = !!value;

  // État local des 2 checkboxes légales (uniquement si requireLegalConsent).
  const [medicalConsent, setMedicalConsent] = useState(false);
  const [rgpdConsent, setRgpdConsent] = useState(false);

  // Notifie le parent dès qu'une case change.
  useEffect(() => {
    if (!requireLegalConsent) return;
    onConsentChange?.(medicalConsent && rgpdConsent);
  }, [requireLegalConsent, medicalConsent, rgpdConsent, onConsentChange]);

  const setBase = (patch: Partial<InjuryRecord>) => {
    if (!value) {
      const base: InjuryRecord = {
        area: (patch.area as InjuryArea) ?? 'autre',
        severity: (patch.severity as InjurySeverity) ?? 1,
        type: (patch.type as InjuryType) ?? 'aigu',
        restrictions: patch.restrictions ?? DEFAULT_RESTRICTIONS,
        startDate: patch.startDate ?? todayISO(),
        lastConfirm: todayISO(),
      };
      const next = patch.note !== undefined ? { ...base, note: patch.note } : base;
      onChange(next);
      return;
    }

    const { note, ...restPatch } = patch;
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

  const onOpenPrivacy = useCallback(() => {
    onOpenPrivacyPolicy?.();
  }, [onOpenPrivacyPolicy]);

  return (
    <View style={styles.root}>
      {/* Bannière légale rouge — affichée EN HAUT uniquement à la déclaration
          initiale (inscription / profil). En post-séance, consentement déjà acquis. */}
      {requireLegalConsent ? <InjuryLegalBanner /> : null}

      <View style={styles.headerRow}>
        <Text style={styles.title}>J'ai une zone sensible</Text>
        <Switch value={active} onValueChange={toggleActive} accessibilityLabel="J'ai une zone sensible" />
      </View>

      {!active ? (
        <Text style={styles.muted}>Aucune zone sensible active</Text>
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

          {/* Sévérité — vocabulaire Option A ("Gêne légère", etc.) */}
          <View>
            <Text style={styles.label}>Niveau de gêne</Text>
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
            <Text style={styles.label}>Précautions</Text>
            {([
              ['avoidSprint', 'Éviter sprint'],
              ['avoidPlyo', 'Éviter sauts / plyo'],
              ['avoidHeavyLower', 'Éviter charges lourdes jambes'],
              ['avoidHeavyUpper', 'Éviter charges lourdes haut du corps'],
              ['avoidCutsImpacts', 'Éviter changements d’appuis / impacts'],
              ['avoidOverhead', 'Éviter mouvements overhead'],
            ] as const).map(([key, label]) => {
              const k = key as keyof InjuryRestrictions;
              const val = !!restrictions[k];
              return (
                <View key={key} style={styles.restrictRow}>
                  <Text style={styles.restrictLabel}>{label}</Text>
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
              placeholder="Ex : gêne au genou après match…"
              placeholderTextColor={palette.sub}
              style={styles.input}
              multiline
            />
          </View>
        </View>
      )}

      {/* Checkboxes légales + phrase de transparence (consentement unique
          à la déclaration initiale). */}
      {requireLegalConsent ? (
        <View style={styles.consentBlock}>
          <Text style={styles.transparence}>{TRANSPARENCE_PHRASE}</Text>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setMedicalConsent((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: medicalConsent }}
            accessibilityLabel="Je comprends que FKS n'établit pas de diagnostic médical"
          >
            <View style={[styles.checkboxBox, medicalConsent && styles.checkboxBoxChecked]}>
              {medicalConsent ? <Ionicons name="checkmark" size={14} color={palette.white} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>
              Je comprends que FKS n'établit pas de diagnostic médical.
            </Text>
          </Pressable>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setRgpdConsent((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rgpdConsent }}
            accessibilityLabel="J'accepte que mes données de santé soient utilisées uniquement pour adapter mes séances"
          >
            <View style={[styles.checkboxBox, rgpdConsent && styles.checkboxBoxChecked]}>
              {rgpdConsent ? <Ionicons name="checkmark" size={14} color={palette.white} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>
              J'accepte que mes données de santé soient utilisées uniquement pour adapter mes séances.{' '}
              {onOpenPrivacyPolicy ? (
                <Text style={styles.linkInline} onPress={onOpenPrivacy}>Politique de confidentialité</Text>
              ) : null}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: TYPE.body.fontSize, fontWeight: '700', color: palette.text },
  muted: { color: palette.sub },
  label: { fontWeight: '600', marginBottom: 6, color: palette.sub },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  btnPrimary: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  btnText: { color: palette.sub, fontWeight: '600' },
  btnTextPrimary: { color: palette.accent, fontWeight: '700' },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  chipSelected: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  chipText: { color: palette.sub, fontWeight: '600' },
  chipTextSelected: { color: palette.accent, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: RADIUS.md,
    padding: 10,
    minHeight: 44,
    backgroundColor: palette.cardSoft,
    color: palette.text,
  },
  restrictRow: { flexDirection: 'row', alignItems: 'center' },
  restrictLabel: { flex: 1, color: palette.text },

  // Consentement légal (inscription / profil uniquement)
  consentBlock: {
    marginTop: 8,
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  transparence: {
    fontSize: TYPE.caption.fontSize,
    lineHeight: 17,
    color: palette.sub,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 17,
    color: palette.text,
  },
  linkInline: {
    color: palette.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
