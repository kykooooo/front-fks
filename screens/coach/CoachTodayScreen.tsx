// screens/coach/CoachTodayScreen.tsx
//
// ÉCRAN D'ATTERRISSAGE DU COACH. Il répond à une seule question :
// « que dois-je regarder maintenant ? »
//
// LE DÉFAUT MESURÉ QU'IL CORRIGE.
// Sur l'écran actuel, environ 580 px de résumé (bandeau KPI + bulletin de la
// semaine + compteurs d'onglet) précèdent la première ligne de joueur : au
// chargement, la réponse à "qui dois-je appeler ?" est HORS ÉCRAN. Ici, la
// section "À vérifier aujourd'hui" est le premier contenu après un en-tête de
// deux lignes. Les chiffres viennent après, la semaine encore après.
//
// CE QUE CET ÉCRAN NE FAIT PAS.
//  - aucune règle métier : les seuils, les statuts, les phrases et les
//    comptages viennent de domain/coachView (attention, roster, week, today) ;
//  - aucune lecture Firestore : elle vit dans hooks/coach/** ;
//  - aucun score, aucun classement, aucune prédiction. Une file d'attention.
//
// HORLOGE. Le projecteur serveur est volontairement sans horloge : il ne
// projette que des faits à date absolue. Tout le relatif au présent
// ("aujourd'hui", "cette semaine", "il y a 12 jours") est calculé ICI, avec
// l'horloge du coach, et injectable via la prop `now` (tests, horloge virtuelle).

import React, { useMemo } from "react";
import { Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { CoachColumns, CoachScreen } from "../../components/coach/CoachScreen";
import { CoachEmptyState } from "../../components/coach/CoachEmptyState";
import { CoachErrorState } from "../../components/coach/CoachErrorState";
import { CoachMetric } from "../../components/coach/CoachMetric";
import { CoachPlayerRow } from "../../components/coach/CoachPlayerRow";
import { CoachSectionCard } from "../../components/coach/CoachSectionCard";
import { CoachSignalRow } from "../../components/coach/CoachSignalRow";
import { CoachSkeleton } from "../../components/coach/CoachSkeleton";
import { CoachStateBlock } from "../../components/coach/CoachStateBlock";
import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
} from "../../components/coach/coachTheme";

import { useCoachAttention } from "../../hooks/coach/useCoachAttention";
import { useCoachClub } from "../../hooks/coach/useCoachClub";
import { useCoachRoster } from "../../hooks/coach/useCoachRoster";
import { useCoachNowMs } from "../../hooks/coach/useCoachNowMs";
import { useHaptics } from "../../hooks/useHaptics";

import {
  INACTIVITE_CHECK_JOURS,
  buildFreshness,
  buildWeekDigest,
  coachStatusPrecision,
  type CoachRosterFilter,
} from "../../domain/coachView";
// Import par chemin (et non par le baril) : `today.ts` est un module neuf, et
// plusieurs lots d'écrans sont écrits en parallèle sur cette branche — modifier
// `domain/coachView/index.ts` créerait un conflit de merge pour un `export *`.
import {
  COACH_TODAY_ATTENTION_MAX,
  buildTodayActivity,
  buildTodayAttentionEntries,
  buildTodayCoverageNotes,
  buildTodayEmptyReason,
  buildTodayEmptyTitle,
  buildTodaySourcesLabel,
  formatTodayLabel,
  memberWordFor,
} from "../../domain/coachView/today";

import { toDateKey } from "../../utils/dateHelpers";
import { showToast } from "../../utils/toast";

/**
 * Noms de routes visés par cet écran. Ils sont exportés pour que le lot de
 * câblage (RootNavigator) déclare EXACTEMENT ces noms : c'est le contrat, pas
 * une supposition enfouie dans un `navigate()`.
 */
export const COACH_TODAY_ROUTES = {
  playerDetail: "CoachPlayerDetail",
  roster: "CoachRoster",
  week: "CoachWeek",
} as const;

/** Phrases de la semaine affichées : au-delà, ce n'est plus un résumé. */
const PHRASES_SEMAINE_MAX = 3;

export type CoachTodayScreenProps = {
  /** Ouvre la fiche d'un joueur. Défaut : navigation vers `CoachPlayerDetail`. */
  onOpenPlayer?: (playerUid: string, clubId: string) => void;
  /** Ouvre l'effectif filtré. Défaut : navigation vers `CoachRoster`. */
  onOpenRoster?: (filter: CoachRosterFilter, clubId: string) => void;
  /** Ouvre l'écran Semaine. Défaut : navigation vers `CoachWeek`. */
  onOpenWeek?: (clubId: string) => void;
  /** Partage du code d'invitation. Défaut : feuille de partage système. */
  onShareInviteCode?: (code: string) => void;
  /** Horloge injectable (tests / horloge virtuelle de dev). */
  now?: () => number;
};

export default function CoachTodayScreen({
  onOpenPlayer,
  onOpenRoster,
  onOpenWeek,
  onShareInviteCode,
  now,
}: CoachTodayScreenProps) {
  const haptics = useHaptics();
  // `any` assumé : l'espace coach n'a pas encore de type de navigation dédié
  // (même choix que CoachHomeScreen), et le lot de câblage le posera.
  const navigation = useNavigation<any>();

  const clockOptions = useMemo(() => (now ? { now } : undefined), [now]);

  // Instant courant lu HORS RENDU (cf. hooks/coach/useCoachNowMs) : un corps de
  // rendu qui lit l'heure n'est pas idempotent, et surtout il ne se rafraîchit
  // que par hasard — au gré des changements d'état. L'horloge injectée en test
  // reste honorée.
  const nowMs = useCoachNowMs({ now });

  const club = useCoachClub(clockOptions);
  const roster = useCoachRoster(club.clubId, clockOptions);
  const attention = useCoachAttention(roster.views);

  // Jour du coach, ANCRÉ sur la dernière lecture réussie. C'est exactement
  // l'horloge avec laquelle `useCoachRoster` a construit les vues : "aujourd'hui"
  // désigne donc le même jour ici et dans les signaux qu'on affiche. Sans ancrage,
  // un passage de minuit entre la lecture et le rendu ferait cohabiter deux
  // "aujourd'hui" différents sur le même écran.
  const todayKey = useMemo(
    () => toDateKey(new Date(roster.fetchedAt ?? nowMs)),
    [roster.fetchedAt, nowMs],
  );

  const memberWord = memberWordFor(club.teamGender);

  // ── Modèles de lecture (tout le calcul vit dans domain/coachView) ──────────
  const entries = useMemo(
    () => buildTodayAttentionEntries(attention.aVerifier, todayKey),
    [attention.aVerifier, todayKey],
  );
  const activite = useMemo(
    () => buildTodayActivity(roster.views, todayKey),
    [roster.views, todayKey],
  );
  const notes = useMemo(
    () => buildTodayCoverageNotes(roster.pendingCount, roster.unreadableCount),
    [roster.pendingCount, roster.unreadableCount],
  );
  const digest = useMemo(
    () => buildWeekDigest(roster.views, club.weekKey, todayKey, { memberWord }),
    [roster.views, club.weekKey, todayKey, memberWord],
  );
  // Fraîcheur : suit le battement de `nowMs`, et non les hasards du cycle de
  // rendu — sinon le libellé "Mis à jour il y a N min" resterait figé sur sa
  // valeur de montage tant qu'aucun état ne bouge.
  const fraicheur = buildFreshness(roster.fetchedAt, nowMs);

  // ── Actions ───────────────────────────────────────────────────────────────
  const refreshAll = () => {
    haptics.impactLight();
    club.refresh();
    roster.refresh();
  };

  /**
   * Navigation tolérante : tant que le lot de câblage n'a pas déclaré les
   * routes, un `navigate` vers un écran inconnu lève. On préfère un message
   * honnête à un écran qui plante sous le doigt d'un entraîneur en démonstration.
   */
  const go = (route: string, params: Record<string, unknown>) => {
    try {
      navigation.navigate(route, params);
    } catch {
      showToast({
        type: "warn",
        title: "Écran indisponible",
        message: "Cette partie de l'espace coach n'est pas encore accessible.",
      });
    }
  };

  const openPlayer = (playerUid: string) => {
    if (!club.clubId) return;
    haptics.impactLight();
    if (onOpenPlayer) {
      onOpenPlayer(playerUid, club.clubId);
      return;
    }
    go(COACH_TODAY_ROUTES.playerDetail, { clubId: club.clubId, playerUid });
  };

  const openRoster = (filter: CoachRosterFilter) => {
    if (!club.clubId) return;
    haptics.impactLight();
    if (onOpenRoster) {
      onOpenRoster(filter, club.clubId);
      return;
    }
    go(COACH_TODAY_ROUTES.roster, { clubId: club.clubId, filter });
  };

  const openWeek = () => {
    if (!club.clubId) return;
    haptics.impactLight();
    if (onOpenWeek) {
      onOpenWeek(club.clubId);
      return;
    }
    go(COACH_TODAY_ROUTES.week, { clubId: club.clubId });
  };

  const shareInviteCode = () => {
    const code = club.inviteCode;
    if (!code) return;
    haptics.impactLight();
    if (onShareInviteCode) {
      onShareInviteCode(code);
      return;
    }
    Share.share({ message: `Rejoins notre club sur FKS avec le code : ${code}` }).catch(() => {
      // Partage annulé par l'utilisateur : rien à signaler.
    });
  };

  // ── En-tête : deux lignes, pas une de plus ────────────────────────────────
  // Le club, le jour, la fraîcheur, un bouton d'actualisation. Tout ce qui
  // n'aide pas à décider descend plus bas (le code club vit dans l'écran Semaine).
  const metaLine = [
    formatTodayLabel(todayKey),
    roster.fetchedAt !== null ? fraicheur.libelle : null,
    roster.isStale ? "mise à jour impossible" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.clubName} numberOfLines={1}>
          {club.clubName ?? "Espace coach"}
        </Text>
        {metaLine ? (
          <Text style={styles.headerMeta} numberOfLines={2}>
            {metaLine}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={refreshAll}
        accessibilityRole="button"
        accessibilityLabel="Actualiser les données"
        accessibilityHint="Relit les informations du club et de l'effectif"
        style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
        testID="coach-today-refresh"
      >
        <Ionicons name="refresh" size={19} color={coachColors.accent} />
      </Pressable>
    </View>
  );

  const refreshControl = (
    <RefreshControl
      refreshing={roster.isRefreshing || club.isRefreshing}
      onRefresh={refreshAll}
      tintColor={coachColors.accent}
    />
  );

  const screen = (body: React.ReactNode, wide = false) => (
    <CoachScreen
      header={header}
      refreshControl={refreshControl}
      contentContainerStyle={styles.content}
      wide={wide}
      testID="coach-today"
    >
      {body}
    </CoachScreen>
  );

  // ── États de premier rang ─────────────────────────────────────────────────
  // Ils sont traités AVANT tout contenu : un écran qui affiche des compteurs à
  // zéro alors qu'il n'a rien pu lire ment au coach.

  if (club.status === "loading") {
    return screen(
      <View style={styles.stack}>
        <CoachSkeleton variant="card" />
        <CoachSkeleton variant="list" rows={4} />
      </View>,
    );
  }

  if (club.status === "error") {
    // On ne sait PAS distinguer "réseau" de "droits retirés" : les hooks ne
    // remontent pas le code d'erreur Firestore. On prend donc la formulation qui
    // n'invente aucune cause, plutôt que d'accuser à tort la connexion du coach.
    return screen(
      <View style={styles.blockCard}>
        <CoachErrorState
          variant="unexpected"
          subject="club"
          action={{ onPress: refreshAll, accessibilityHint: "Relance la lecture des données" }}
          footnote={roster.fetchedAt !== null ? fraicheur.libelle : null}
          testID="coach-today-error"
        />
      </View>,
    );
  }

  if (club.status === "notInClub") {
    // Aucune variante de `CoachEmptyState` ne couvre "compte sans club" : ce
    // n'est ni un club vide ni une erreur. On compose donc directement le bloc.
    return screen(
      <View style={styles.blockCard}>
        <CoachStateBlock
          icon="people-circle-outline"
          title="Aucun club rattaché à ce compte"
          body="Ce compte n'est associé à aucun club. Créez votre club pour ouvrir votre espace, ou contactez FKS si vous pensez qu'il s'agit d'une erreur."
          level="unknown"
          testID="coach-today-no-club"
        />
      </View>,
    );
  }

  if (roster.status === "loading") {
    return screen(
      <View style={styles.stack}>
        <CoachSkeleton variant="list" rows={4} />
        <CoachSkeleton variant="card" />
      </View>,
    );
  }

  if (roster.status === "unavailable") {
    // Le club a été lu, l'effectif non. On ne SAIT pas pourquoi : les hooks ne
    // remontent aucun code d'erreur. On nomme donc ce qui n'a pas pu être
    // chargé, on propose de réessayer, et on formule la suite au conditionnel —
    // envoyer le coach vérifier son wifi quand c'est son accès au club qui a
    // sauté le ferait chercher au mauvais endroit.
    return screen(
      <View style={styles.blockCard}>
        <CoachErrorState
          variant="network"
          subject="effectif"
          action={{ onPress: refreshAll, accessibilityHint: "Relance la lecture de l'effectif" }}
          footnote={roster.fetchedAt !== null ? fraicheur.libelle : null}
          testID="coach-today-error"
        />
      </View>,
    );
  }

  if (roster.memberCount === 0) {
    // Club vide : le code d'invitation est LA sortie utile, on le met en avant
    // au lieu d'obliger le coach à aller le chercher dans un autre écran.
    return screen(
      <View style={styles.blockCard}>
        <CoachEmptyState
          variant="clubWithoutPlayers"
          action={
            club.inviteCode
              ? { onPress: shareInviteCode, accessibilityHint: "Ouvre le partage du code d'invitation" }
              : null
          }
          footnote={club.inviteCode ? `Code d'invitation : ${club.inviteCode}` : null}
          testID="coach-today-empty-club"
        />
      </View>,
    );
  }

  // ── 1. À vérifier aujourd'hui (LE contenu prioritaire) ────────────────────
  const visibles = entries.slice(0, COACH_TODAY_ATTENTION_MAX);
  const totalAVerifier = attention.counts.a_verifier;
  const sourcesLabel = buildTodaySourcesLabel(visibles);

  const attentionAction =
    totalAVerifier > 0
      ? {
          label: "Voir tout",
          onPress: () => openRoster("a_verifier"),
          accessibilityHint: "Ouvre l'effectif filtré sur les profils à vérifier",
        }
      : attention.counts.a_surveiller > 0
        ? {
            label: "À surveiller",
            onPress: () => openRoster("a_surveiller"),
            accessibilityHint: "Ouvre l'effectif filtré sur les profils à surveiller",
          }
        : undefined;

  const attentionCard = (
    <CoachSectionCard
      title="À vérifier aujourd'hui"
      subtitle={
        totalAVerifier > visibles.length
          ? `${visibles.length} profils affichés sur ${totalAVerifier}`
          : null
      }
      action={attentionAction}
      noPadding
      testID="coach-today-attention"
    >
      <View>
        {visibles.length > 0
          ? visibles.map((entry, index) => (
              <View
                key={entry.playerUid}
                style={index > 0 ? styles.rowDivider : undefined}
              >
                <CoachPlayerRow
                  firstName={entry.prenom}
                  meta={entry.raison}
                  statusLevel={entry.statut}
                  statusLabel={entry.statutLibelle}
                  statusPrecision={coachStatusPrecision(entry.statut, entry.donneesPartielles)}
                  activityLabel={entry.complement}
                  onPress={() => openPlayer(entry.playerUid)}
                  testID={`coach-today-entry-${entry.playerUid}`}
                />
              </View>
            ))
          : (
            // « Rien à vérifier aujourd'hui » est un CONSTAT : il n'est vrai que
            // si l'app a pu tout regarder. Tant qu'il manque des données sur au
            // moins un membre, le titre le dit — et la provenance passe à
            // « donnée absente », parce que c'est exactement ce qui borne le
            // constat.
            <CoachSignalRow
              title={buildTodayEmptyTitle(activite.membresDonneesPartielles)}
              why={buildTodayEmptyReason(
                roster.readyCount,
                attention.counts.a_surveiller,
                memberWord,
                activite.membresDonneesPartielles,
              )}
              provenance={activite.membresDonneesPartielles > 0 ? "missing" : "computed"}
              level="normal"
              testID="coach-today-attention-empty"
            />
          )}

        {/* Ce que la liste ne couvre PAS : profils non lus, projections en
            préparation. Placés ici, au contact du constat qu'ils nuancent —
            "rien à vérifier" n'est vrai que pour ce qu'on a réussi à lire. */}
        {notes.map((note) => (
          <View key={note.id} style={styles.rowDivider}>
            <CoachSignalRow
              title={note.titre}
              why={note.pourquoi}
              provenance="missing"
              level={note.niveau}
              testID={`coach-today-note-${note.id}`}
            />
          </View>
        ))}

        {sourcesLabel ? (
          <Text style={styles.sources} numberOfLines={2}>
            {sourcesLabel}
          </Text>
        ) : null}
      </View>
    </CoachSectionCard>
  );

  // ── 2. Aujourd'hui dans le groupe (4 chiffres, pas un de plus) ────────────
  // Chaque chiffre distingue ZÉRO (mesure) de INDISPONIBLE (pas de mesure) :
  // c'est `CoachMetric` qui porte la distinction, on lui passe `null` ou un nombre.
  const groupeCard = (
    <CoachSectionCard
      title="Aujourd'hui dans le groupe"
      subtitle={
        activite.membresSansDonnees > 0
          ? `Activité non mesurable pour ${activite.membresSansDonnees} profil${activite.membresSansDonnees > 1 ? "s" : ""}`
          : null
      }
      testID="coach-today-group"
    >
      <View style={styles.metrics}>
        {/* On compte des MEMBRES, jamais des séances : la projection ne transmet
            que des dates dédupliquées, donc deux séances faites le même jour n'y
            laissent qu'une trace. Écrire "séances faites" ici afficherait un
            sous-comptage sans que le coach puisse le savoir. */}
        <CoachMetric
          label="Ont fait leur séance"
          value={activite.membresActifs}
          icon="checkmark-done-outline"
          hint={
            activite.membresAvecDonnees > 0
              ? `Sur ${activite.membresAvecDonnees} profil${activite.membresAvecDonnees > 1 ? "s" : ""} suivi${activite.membresAvecDonnees > 1 ? "s" : ""}`
              : null
          }
          testID="coach-today-metric-done"
        />
        {/* Ces deux chiffres comptent des PROFILS, pas des séances : le serveur ne
            projette qu'UNE séance prévue par joueur, additionner des "séances
            manquées" serait inventer un total qu'on ne connaît pas. Les hints le
            disent, pour qu'un coach puisse expliquer chaque nombre affiché. */}
        <CoachMetric
          label="Séance prévue non faite"
          value={attention.counts.seance_non_faite}
          icon="alert-circle-outline"
          // Formulation raccourcie APRÈS capture : la version longue ("…n'a pas
          // été suivie d'une séance terminée") sortait de la tuile dès qu'un
          // grand écran passe la grille à trois colonnes. Le sens est le même,
          // et l'unité comptée (des profils, pas des séances) reste écrite.
          hint="Profils dont la séance préparée n'a pas été terminée"
          testID="coach-today-metric-missed"
        />
        <CoachMetric
          label="Sans donnée récente"
          value={attention.counts.aucune_donnee_recente}
          icon="help-circle-outline"
          hint={`Profils sans séance terminée depuis ${INACTIVITE_CHECK_JOURS} jours ou plus`}
          testID="coach-today-metric-silent"
        />
        <CoachMetric
          label="Effectif"
          value={roster.memberCount}
          icon="people-outline"
          hint={`${memberWord.charAt(0).toLocaleUpperCase("fr-FR")}${memberWord.slice(1)}s rattachés au club`}
          testID="coach-today-metric-roster"
        />
      </View>
    </CoachSectionCard>
  );

  // ── 3. Cette semaine (2 à 3 phrases, aucun graphique) ─────────────────────
  const semaineCard = (
    <CoachSectionCard
      title="Cette semaine"
      action={{
        label: "Voir la semaine",
        onPress: openWeek,
        accessibilityHint: "Ouvre le détail de la semaine du club",
      }}
      testID="coach-today-week"
    >
      <View style={styles.phrases}>
        {digest.phrases.slice(0, PHRASES_SEMAINE_MAX).map((phrase) => (
          <Text key={phrase} style={styles.phrase} numberOfLines={3}>
            {phrase}
          </Text>
        ))}
      </View>
    </CoachSectionCard>
  );

  return screen(
    <CoachColumns
      primary={attentionCard}
      secondary={
        <View style={styles.stack}>
          {groupeCard}
          {semaineCard}
        </View>
      }
    />,
    true,
  );
}

const styles = StyleSheet.create({
  content: {
    padding: coachSpacing.md,
    gap: coachSpacing.md,
  },
  stack: { gap: coachSpacing.md },

  // ── En-tête ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.sm,
    paddingHorizontal: coachSpacing.md,
    paddingVertical: coachSpacing.sm,
  },
  headerText: { flex: 1, flexShrink: 1, gap: 2 },
  clubName: {
    fontSize: coachType.titreEcran.fontSize,
    lineHeight: coachType.titreEcran.lineHeight,
    fontWeight: coachType.titreEcran.fontWeight,
    letterSpacing: coachType.titreEcran.letterSpacing,
    color: coachColors.text,
  },
  headerMeta: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  refreshBtn: {
    // Zone tactile pleine : ce bouton est la seule sortie quand les données
    // affichées datent, il ne doit jamais se rater au pouce.
    minWidth: coachLayout.minTouchSize,
    minHeight: coachLayout.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
    flexShrink: 0,
  },
  refreshBtnPressed: { opacity: 0.7 },

  // ── Blocs d'état (vide, erreur, sans club) ──
  blockCard: {
    backgroundColor: coachColors.card,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
    overflow: "hidden",
  },

  // ── Listes ──
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderSoft,
  },
  sources: {
    paddingHorizontal: coachSpacing.md,
    paddingTop: coachSpacing.xs,
    paddingBottom: coachSpacing.sm,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },

  // ── Chiffres ──
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: coachSpacing.xs,
  },

  // ── Semaine ──
  phrases: { gap: coachSpacing.xs },
  phrase: {
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    color: coachColors.sub,
  },
});
