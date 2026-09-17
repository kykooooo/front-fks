// components/home/HomeSessionCard.tsx
// La carte « prochaine séance » (SPEC_DA_ACCUEIL_SEANCE.md §2.3) — premier
// bloc important de l'accueil. Fusionne l'ancien CTA + badge cycle + carte
// "Prochaine séance" (HomeNextSessionCard, supprimée) en UNE carte.
//
// `usePrimaryCta` garde TOUTE sa logique : ce composant ne fait que choisir un
// GABARIT selon `primaryCta.kind` (6 valeurs, aucune condition rejouée ici) et
// affiche des chaînes déjà calculées — jamais de durée/séance/progression
// inventée. Si `homeCyclePhase` (ici `cyclePhase`) est `null`, pas de méta.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { da, PLAFOND_TEXTE, PLAFOND_TITRE } from "../../constants/daJoueur";
import { DaCard, DaKicker, DaNotice, DaTextButton } from "../ui/da";
import { decrireSeanceEnAttente, type PrimaryCtaKind } from "../../hooks/home/usePrimaryCta";
import { MICROCYCLES, type MicrocycleId } from "../../domain/microcycles";
import type { MicrocyclePhaseInfo } from "../../utils/microcycleUtils";
import type { Session } from "../../domain/types";
import HomePitchIllustration from "./HomePitchIllustration";
import HomePrimaryCTA from "./HomePrimaryCTA";

type PrimaryCta = {
  label: string;
  sub?: string;
  kind: PrimaryCtaKind;
  disabled?: boolean;
  onPress?: () => void;
};

type Props = {
  storeHydrated: boolean;
  primaryCta: PrimaryCta;
  pendingSession: Session | null | undefined;
  feedbackDue: boolean;
  onViewPendingSession: () => void;
  onFeedback: () => void;
  cycleId: MicrocycleId | null;
  cycleDone: boolean;
  cyclePhase: MicrocyclePhaseInfo | null;
  onManageCycle: () => void;
};

function accessibleLabelCycle(cyclePhase: MicrocyclePhaseInfo | null): string {
  if (!cyclePhase) return "Gérer mon cycle";
  return `Gérer mon cycle, séance ${cyclePhase.sessionNumber} sur ${cyclePhase.total}, ${cyclePhase.label}`;
}

function HomeSessionCardSkeleton() {
  return (
    <DaCard style={styles.carte} testID="home-session-card-skeleton">
      <View style={styles.skeletonKicker} />
      <View style={styles.skeletonTitre} />
      <View style={styles.skeletonMeta} />
      <View style={styles.skeletonBouton} />
    </DaCard>
  );
}

function HomeSessionCardInner({
  storeHydrated,
  primaryCta,
  pendingSession,
  feedbackDue,
  onViewPendingSession,
  onFeedback,
  cycleId,
  cycleDone,
  cyclePhase,
  onManageCycle,
}: Props) {
  if (!storeHydrated) return <HomeSessionCardSkeleton />;

  const { kind } = primaryCta;
  const enAttente = kind === "start_today" || kind === "start_pending";
  // Présence réelle d'une séance en attente — INDÉPENDANTE de `kind` : la
  // branche "recovery" (tsb <= -15) est évaluée AVANT les branches
  // start_today/start_pending dans computePrimaryCtaKind (usePrimaryCta.ts).
  // Un joueur très fatigué AVEC une séance en attente obtient donc
  // kind === "recovery" tout en ayant une vraie `pendingSession` — les accès
  // "Voir la séance" / relance feedback doivent survivre dans ce cas (règle 4
  // du dépôt : le feedback débloque la génération suivante).
  const hasPending = Boolean(pendingSession);
  const pendingDescription = decrireSeanceEnAttente(pendingSession);
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleMetaTexte = cyclePhase
    ? `Séance ${cyclePhase.sessionNumber} sur ${cyclePhase.total} · ${cyclePhase.label}`
    : null;

  let kicker: string;
  let titre: string;
  let meta: string | null;
  let metaPressable = false;

  if (enAttente) {
    kicker = "TA SÉANCE EST PRÊTE";
    titre = pendingDescription.titre;
    meta = pendingDescription.meta;
  } else if (kind === "day_off") {
    kicker = "TA PROCHAINE SÉANCE";
    titre = cycleLabel ?? "Ta prochaine séance";
    meta = cycleMetaTexte;
    metaPressable = Boolean(cyclePhase);
  } else if (kind === "recovery") {
    kicker = "AUJOURD'HUI";
    titre = cycleLabel ?? "Récupération";
    meta = cycleLabel ? cycleMetaTexte : null;
    metaPressable = Boolean(cycleLabel && cyclePhase);
  } else if (kind === "choose_cycle") {
    kicker = "TON PROGRAMME";
    titre = cycleDone ? "Cycle terminé" : "Choisis ton cycle";
    meta = primaryCta.sub ?? null;
  } else {
    // "prepare"
    kicker = "TA PROCHAINE SÉANCE";
    titre = cycleLabel ?? "Ta prochaine séance";
    meta = cycleMetaTexte;
    metaPressable = Boolean(cyclePhase);
  }

  return (
    <DaCard style={styles.carte}>
      {/* Kicker → titre : 8. Titre → méta : 4 (F2) — l'un et l'autre bien plus
          serrés que le rythme de 16 qui sépare les autres blocs de la carte. */}
      <View style={styles.enTeteGroupe}>
        <DaKicker>{kicker}</DaKicker>
        {metaPressable ? (
          // Cycle gérable : UN SEUL Pressable enveloppe titre + méta — la
          // cible tactile est le bloc entier (≥ 44), le chevron reste centré
          // verticalement même si la méta passe sur 2 lignes.
          <Pressable
            onPress={onManageCycle}
            style={styles.titreMetaPressable}
            accessibilityRole="button"
            accessibilityLabel={accessibleLabelCycle(cyclePhase)}
          >
            <View style={styles.titreMetaColonneFlex}>
              <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE} numberOfLines={2}>
                {titre}
              </Text>
              {meta ? (
                <Text style={styles.metaTexte} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
                  {meta}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={da.colors.sub} />
          </Pressable>
        ) : (
          <View style={styles.titreMetaColonne}>
            <Text style={styles.titre} maxFontSizeMultiplier={PLAFOND_TITRE} numberOfLines={2}>
              {titre}
            </Text>
            {meta ? (
              <Text style={styles.metaTexteSeul} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
                {meta}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <HomePitchIllustration />

      {kind === "recovery" && primaryCta.sub ? (
        <DaNotice tone="warn" message={primaryCta.sub} flat />
      ) : null}

      <HomePrimaryCTA label={primaryCta.label} onPress={primaryCta.onPress} disabled={primaryCta.disabled} />

      {kind === "day_off" && primaryCta.sub ? (
        <Text style={styles.sousBouton} maxFontSizeMultiplier={PLAFOND_TEXTE} numberOfLines={2}>
          {primaryCta.sub}
        </Text>
      ) : null}

      {hasPending ? (
        <View style={styles.actionsSecondaires}>
          {/* Redondant si le titre/méta de la carte vient déjà de la séance
              en attente (enAttente) — seul le cas "recovery + séance en
              attente" a besoin de le dire explicitement. */}
          {!enAttente ? (
            <Text
              style={styles.pendingLigne}
              maxFontSizeMultiplier={PLAFOND_TEXTE}
              numberOfLines={2}
            >
              {`Ta séance est prête : ${pendingDescription.titre}`}
            </Text>
          ) : null}
          <DaTextButton label="Voir la séance" onPress={onViewPendingSession} />
          {feedbackDue ? (
            // PAS `live` : c'est un état persistant affiché à chaque visite de
            // l'accueil, pas un événement — un lecteur d'écran ne doit pas le
            // réannoncer à chaque affichage. `live` reste réservé à l'échec de
            // génération (screens/newSession).
            <DaNotice
              tone="warn"
              message="Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante."
              flat
            >
              <DaTextButton label="Comment ça s'est passé ?" onPress={onFeedback} />
            </DaNotice>
          ) : null}
        </View>
      ) : null}
    </DaCard>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: da.spacing.md,
  },
  enTeteGroupe: {
    gap: 8,
  },
  titreMetaColonne: {
    gap: 4,
  },
  titreMetaColonneFlex: {
    flex: 1,
    gap: 4,
  },
  titreMetaPressable: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: da.spacing.xs,
  },
  titre: {
    ...da.typography.title,
    color: da.colors.text,
  },
  metaTexte: {
    ...da.typography.body,
    color: da.colors.sub,
  },
  metaTexteSeul: {
    ...da.typography.body,
    color: da.colors.sub,
  },
  sousBouton: {
    ...da.typography.secondary,
    color: da.colors.sub,
    textAlign: "center",
  },
  actionsSecondaires: {
    gap: da.spacing.xs,
  },
  pendingLigne: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  skeletonKicker: {
    minHeight: 16,
    width: 140,
    borderRadius: 4,
    backgroundColor: da.colors.disabledBg,
  },
  skeletonTitre: {
    minHeight: 30,
    width: "70%",
    borderRadius: 6,
    backgroundColor: da.colors.disabledBg,
  },
  skeletonMeta: {
    minHeight: 20,
    width: "50%",
    borderRadius: 4,
    backgroundColor: da.colors.disabledBg,
  },
  skeletonBouton: {
    minHeight: 56,
    borderRadius: da.radius.button,
    backgroundColor: da.colors.disabledBg,
  },
});

export default React.memo(HomeSessionCardInner);
