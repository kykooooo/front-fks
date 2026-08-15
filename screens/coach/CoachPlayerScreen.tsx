// screens/coach/CoachPlayerScreen.tsx
//
// FICHE JOUEUR v2 — l'écran que le coach ouvre quand une ligne d'effectif
// l'interpelle. Il doit répondre en quelques secondes à : que s'est-il passé,
// qu'est-ce qui était prévu, qu'est-ce qui a réellement été fait, et pourquoi.
//
// CE QUE CET ÉCRAN NE FAIT PAS (et pourquoi) :
//  - AUCUN calcul métier. Statut, signaux, assiduité, chronologie viennent de
//    `domain/coachView` ; les données viennent de `hooks/coach/useCoachPlayer`.
//    Si un chiffre manque ici, il se calcule DANS le domaine, jamais dans le JSX.
//  - AUCUNE donnée de santé. Douleur, fatigue, ressenti, RPE, TSB/ATL/CTL sont
//    interdits au coach côté serveur : on ne les reconstitue pas, même par
//    déduction (les raisons d'écart arrivent d'une allowlist NON INVERSIBLE, où
//    douleur / fatigue / autre produisent toutes le même « Autre raison »).
//  - AUCUNE écriture. Le coach observe ; il ne modifie pas un programme.
//
// PIÈGE DE VOCABULAIRE VERROUILLÉ ICI.
// « Ajusté par FKS » (le moteur a allégé la prescription) et « adapté / sauté »
// (le joueur a modifié SA séance) sont deux informations différentes. L'ancienne
// fiche les affichait toutes deux sous « Adaptée » : le coach croyait lire un
// comportement du joueur alors que c'était une décision de l'application. Les
// deux vocabulaires ne se mélangent jamais dans cet écran.
//
// ÉTAT DÉGRADÉ ASSUMÉ. Tant que la boucle de suivi joueur n'est pas déployée,
// `execution` est absente : on le DIT en toutes lettres. Aucune barre à 0 %,
// aucun compteur inventé — un zéro se lirait comme « il n'a rien fait ».

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { CoachScreen, useCoachLayout } from "../../components/coach/CoachScreen";
import { CoachSectionCard } from "../../components/coach/CoachSectionCard";
import { CoachSignalRow } from "../../components/coach/CoachSignalRow";
import { CoachStatusPill } from "../../components/coach/CoachStatusPill";
import { CoachMetric } from "../../components/coach/CoachMetric";
import { CoachSkeleton } from "../../components/coach/CoachSkeleton";
import { CoachEmptyState } from "../../components/coach/CoachEmptyState";
import { CoachErrorState } from "../../components/coach/CoachErrorState";
import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  provenanceTone,
  type CoachIconName,
  type CoachProvenance,
} from "../../components/coach/coachTheme";
import { useCoachPlayer } from "../../hooks/coach/useCoachPlayer";
import { useCoachNowMs } from "../../hooks/coach/useCoachNowMs";
import {
  useClubMemberGeste,
  type ClubMemberGeste,
} from "../../hooks/coach/useRemoveClubMember";
import {
  buildExecutionBreakdown,
  buildFreshness,
  buildPlayerTimeline,
  coachAgeCategoryLabel,
  coachDonneesPartiellesNote,
  coachIdentityLine,
  coachLevelLabel,
  coachPositionLabel,
  coachStatusLabel,
  coachStatusPrecision,
  timelineEventDateLabel,
  ASSIDUITE_JOURS,
  ASSIDUITE_JOURS_COURTS,
  type CoachAssiduiteView,
  type CoachExecutionView,
  type CoachPlayerView,
  type CoachSessionView,
  type CoachSignalSource,
  type CoachTimelineEvent,
} from "../../domain/coachView";
import { formatDayFR, toDateKey } from "../../utils/dateHelpers";
import { showToast } from "../../utils/toast";

/** Paramètres de route (mêmes clés de lecture que l'ancienne fiche). */
export type CoachPlayerScreenParams = { clubId: string; playerUid: string };

type CoachPlayerRoute = RouteProp<
  { CoachPlayerDetail: CoachPlayerScreenParams },
  "CoachPlayerDetail"
>;

/**
 * Traduction des provenances du DOMAINE vers celles du design system.
 * Deux vocabulaires parce que les deux couches sont indépendantes ; la
 * correspondance est bijective et vit ici, à la frontière, plutôt que d'imposer
 * les mots de l'un à l'autre.
 */
const PROVENANCE_PAR_SOURCE: Record<CoachSignalSource, CoachProvenance> = {
  declare: "player",
  execution: "execution",
  moteur: "fks",
  calcule: "computed",
  absent: "missing",
};

// ─── Écran ───────────────────────────────────────────────────────────────────

export default function CoachPlayerScreen() {
  const route = useRoute<CoachPlayerRoute>();
  const navigation = useNavigation();
  const clubId = route.params?.clubId ?? null;
  const playerUid = route.params?.playerUid ?? null;

  const { view, status, fetchedAt, staleRefreshCount, isRefreshing, refresh } = useCoachPlayer(
    clubId,
    playerUid,
  );

  // Le titre du header portait « Joueur » en dur : incohérent devant une équipe
  // féminine, et sans valeur (le coach sait qu'il ouvre un joueur). On met le
  // prénom dès qu'on le connaît, un intitulé neutre sinon.
  //
  // Les COULEURS de l'en-tête ne sont plus posées ici : elles le sont une seule
  // fois sur le CoachStack (navigation/RootNavigator), pour que tous les écrans
  // du stack — y compris ceux partagés avec l'espace joueur — soient cohérents.
  useLayoutEffect(() => {
    const prenom = (view?.prenom ?? "").trim();
    navigation.setOptions?.({
      title: prenom || "Fiche joueur",
    });
  }, [navigation, view?.prenom]);

  // Refresh raté dont le contenu a été CONSERVÉ : le hook compte l'événement,
  // l'écran est le seul à parler à l'utilisateur (cf. useCoachPlayer).
  const staleSeenRef = useRef(0);
  useEffect(() => {
    if (staleRefreshCount > staleSeenRef.current) {
      staleSeenRef.current = staleRefreshCount;
      showToast({
        type: "warn",
        title: "Mise à jour impossible",
        message: "Dernières données affichées.",
      });
    }
  }, [staleRefreshCount]);

  const onBack = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  // Horloge du COACH : le projecteur serveur n'envoie que des dates absolues,
  // tout le relatif au présent se calcule ici. L'instant est lu HORS RENDU
  // (`useCoachNowMs`) et rafraîchi périodiquement : le rendu reste idempotent, et
  // une fiche laissée ouverte ne continue pas d'annoncer "à l'instant" ni de
  // raisonner sur la veille après minuit.
  const nowMs = useCoachNowMs();
  // Chaîne primitive -> les mémos en dessous restent stables tant que le jour ne
  // change pas, même si l'horloge bat toutes les 30 s.
  const todayKey = useMemo(() => toDateKey(new Date(nowMs)), [nowMs]);
  const timeline = useMemo(
    () => (view ? buildPlayerTimeline(view, todayKey) : []),
    [view, todayKey],
  );
  const fraicheur = buildFreshness(fetchedAt, nowMs);

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={refresh}
      tintColor={coachColors.accent}
    />
  );

  return (
    <CoachScreen
      refreshControl={refreshControl}
      contentContainerStyle={styles.content}
      testID="coach-player-screen"
    >
      {status === "loading" ? (
        // Squelette de FICHE (pas de liste) : l'œil se place avant l'arrivée
        // des données et l'écran ne saute pas au remplissage.
        <View style={styles.stack}>
          <CoachSkeleton variant="card" />
          <CoachSkeleton variant="card" />
        </View>
      ) : status === "unavailable" ? (
        // Lecture IMPOSSIBLE (droits ou réseau) — à ne pas confondre avec
        // « il n'y a rien à lire ». L'ancienne fiche affichait un cadenas dans
        // les deux cas, ce qui laissait croire à un problème de droits.
        <CoachErrorState
          variant="unexpected"
          subject="fiche"
          action={{ onPress: refresh, accessibilityHint: "Relance la lecture de la fiche" }}
          footnote={fraicheur.libelle}
        />
      ) : status === "restricted" ? (
        // DÉCISION SERVEUR : l'accès au suivi de ce joueur n'est pas autorisé.
        // Ni une erreur (rien n'est cassé), ni une attente (rien n'arrivera tout
        // seul) : deux états déjà pris par les branches voisines. Aucune donnée
        // de suivi n'est rendue ici — il n'y en a d'ailleurs aucune à rendre, le
        // serveur n'ayant même pas produit de projection.
        <CoachEmptyState
          variant="accessRestricted"
          footnote={fraicheur.libelle}
          testID="coach-player-restricted"
        />
      ) : status === "notFound" || !view ? (
        // Le club connaît ce joueur, mais aucune projection n'existe encore :
        // ce n'est ni une erreur, ni un refus d'accès.
        <CoachEmptyState
          variant="syncPending"
          action={{ onPress: refresh, accessibilityHint: "Relance la lecture de la fiche" }}
          footnote={fraicheur.libelle}
        />
      ) : (
        <>
          <IdentiteBloc view={view} fraicheurLibelle={fraicheur.libelle} />
          <StatutSection view={view} />
          <PrevuRealiseSection view={view} />
          <AjustementsSection
            labels={view.ajustementsMoteur}
            aUneSeance={Boolean(view.seancePrevue || view.seanceFaite)}
          />
          <HistoriqueSection evenements={timeline} />
          <AssiduiteSection assiduite={view.assiduite} />
          <ActionsSection onBack={onBack} onRefresh={refresh} refreshing={isRefreshing} />
          <EffectifSection
            clubId={clubId}
            playerUid={playerUid}
            prenom={(view.prenom ?? "").trim()}
            onRetireEtRevenir={onBack}
          />
          <PiedDePage />
        </>
      )}
    </CoachScreen>
  );
}

// ─── 1. Identité sportive ────────────────────────────────────────────────────

function IdentiteBloc({
  view,
  fraicheurLibelle,
}: {
  view: CoachPlayerView;
  fraicheurLibelle: string;
}) {
  const prenom = (view.prenom ?? "").trim() || "Joueur sans prénom";
  // Poste, niveau et catégorie sont DÉCLARÉS par le joueur : on ne comble pas
  // les trous, on dit simplement que le profil n'est pas terminé.
  //
  // ACCENTS : les valeurs PERSISTÉES s'écrivent « Regional » et « Defenseur »
  // sans accent — elles sont comparées à une allowlist serveur, on ne les touche
  // pas. `coachLevelLabel` / `coachPositionLabel` ne changent que le RENDU
  // (domain/coachView/identityLabels), jamais la donnée ni les comparaisons.
  const meta = coachIdentityLine([
    coachPositionLabel(view.poste),
    coachLevelLabel(view.niveau),
    coachAgeCategoryLabel(view.categorieAge),
  ]);
  // « Rien à signaler » quand il manque des données n'est pas un constat, c'est
  // un silence. La pastille reste courte (la place manque) et la phrase entière
  // se lit juste en dessous — le lecteur d'écran l'entend via `fullLabel`.
  const precisionStatut = coachStatusPrecision(view.statut, view.donneesPartielles);

  return (
    <View style={styles.identite}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTexte} numberOfLines={1}>
          {view.initiale}
        </Text>
      </View>

      <View style={styles.identiteCorps}>
        <Text style={styles.prenom} numberOfLines={1}>
          {prenom}
        </Text>
        <Text style={styles.identiteMeta} numberOfLines={2}>
          {meta || "Profil à compléter"}
        </Text>
        <View style={styles.identitePastille}>
          <CoachStatusPill level={view.statut} size="md" fullLabel={precisionStatut} />
        </View>
        {precisionStatut ? (
          <Text
            style={styles.identitePrecision}
            numberOfLines={2}
            testID="coach-player-statut-precision"
          >
            {precisionStatut}
          </Text>
        ) : null}
        <Text style={styles.fraicheur} numberOfLines={1}>
          {fraicheurLibelle}
        </Text>
      </View>
    </View>
  );
}

// ─── 2. Statut du jour ───────────────────────────────────────────────────────

function StatutSection({ view }: { view: CoachPlayerView }) {
  const signaux = view.signaux;
  // Le titre du vide dit exactement ce qu'il vaut : « Rien à signaler » tout
  // court affirmerait que l'app a tout regardé. Ici il y a la place pour la
  // phrase entière, on ne la raccourcit donc pas.
  const titreVide = coachStatusLabel("normal", view.donneesPartielles);
  const noteDonnees = coachDonneesPartiellesNote(view.donneesPartielles);

  return (
    <CoachSectionCard
      title="Statut du jour"
      subtitle="Ce qui demande — ou non — ta lecture aujourd'hui."
      noPadding
      testID="coach-player-statut"
    >
      {signaux.length === 0 ? (
        <CoachSignalRow
          title={titreVide}
          why={
            view.donneesPartielles
              ? "Aucun fait connu ne demande de vérification, mais l'app ne connaît pas tout de ce joueur."
              : "Aucun fait connu ne demande de vérification aujourd'hui."
          }
          provenance={view.donneesPartielles ? "missing" : "computed"}
          level="normal"
        />
      ) : (
        signaux.map((signal, index) => (
          <View key={signal.code} style={index > 0 ? styles.separateur : undefined}>
            <CoachSignalRow
              title={signal.titre}
              why={signal.pourquoi}
              provenance={PROVENANCE_PAR_SOURCE[signal.source]}
              level={signal.level}
            />
          </View>
        ))
      )}

      {/* Affichée MÊME quand des signaux existent : une liste de signaux fondée
          sur des données partielles reste une liste partielle. Le dire une fois,
          sous la carte, suffit — le répéter par signal ferait du bruit. */}
      {noteDonnees && signaux.length > 0 ? (
        <Text
          style={styles.statutNote}
          numberOfLines={3}
          testID="coach-player-statut-note"
        >
          {noteDonnees}
        </Text>
      ) : null}
    </CoachSectionCard>
  );
}

// ─── 3. Prévu vs réalisé ─────────────────────────────────────────────────────
// LA section de l'écran. Prescription et réalisation se disputaient un seul
// champ serveur : elles coexistent enfin, côte à côte, et se lisent d'un trait.

function PrevuRealiseSection({ view }: { view: CoachPlayerView }) {
  const { columns } = useCoachLayout();
  const deuxColonnes = columns === 2;

  // Ni prescription ni réalisation : on l'annonce UNE fois au lieu d'empiler
  // trois blocs vides qui donneraient l'impression d'un écran cassé.
  if (!view.seancePrevue && !view.seanceFaite) {
    return (
      <CoachSectionCard
        title="Prévu vs réalisé"
        subtitle="Ce que FKS avait prescrit, et ce que le joueur a réellement fait."
        testID="coach-player-prevu-realise"
      >
        <CoachEmptyState variant="playerWithoutSession" />
      </CoachSectionCard>
    );
  }

  return (
    <CoachSectionCard
      title="Prévu vs réalisé"
      subtitle="Ce que FKS avait prescrit, et ce que le joueur a réellement fait."
      testID="coach-player-prevu-realise"
    >
      <View style={deuxColonnes ? styles.paireRangee : styles.paireColonne}>
        <View style={deuxColonnes ? styles.paireCellule : styles.paireEmpilee}>
          <SeanceBloc
            icone="clipboard-outline"
            titre="Prescrit par FKS"
            provenance="fks"
            session={view.seancePrevue}
            texteVide="Aucune séance prévue n'est enregistrée pour ce joueur."
          />
        </View>

        <View style={deuxColonnes ? styles.paireCellule : styles.paireEmpilee}>
          <SeanceBloc
            icone="checkmark-done-outline"
            titre="Réalisé par le joueur"
            provenance="execution"
            session={view.seanceFaite}
            texteVide="Aucune séance terminée n'est enregistrée pour ce joueur."
          />
          <ExecutionBloc execution={view.execution} />
        </View>
      </View>
    </CoachSectionCard>
  );
}

/** Faits d'une séance : on n'écrit QUE ce que le serveur a transmis. */
function SeanceBloc({
  icone,
  titre,
  provenance,
  session,
  texteVide,
}: {
  icone: CoachIconName;
  titre: string;
  provenance: CoachProvenance;
  session: CoachSessionView | null;
  texteVide: string;
}) {
  const faits = session ? seanceFaits(session) : [];
  const sousTitre = (session?.titre ?? "").trim();

  return (
    <View style={styles.bloc}>
      <View style={styles.blocEntete}>
        <Ionicons name={icone} size={16} color={coachColors.accent} />
        <Text style={styles.blocTitre} numberOfLines={1}>
          {titre}
        </Text>
      </View>

      {!session ? (
        <Text style={styles.blocVide} numberOfLines={3}>
          {texteVide}
        </Text>
      ) : (
        <>
          {sousTitre ? (
            <Text style={styles.blocSousTitre} numberOfLines={2}>
              {sousTitre}
            </Text>
          ) : null}

          {faits.length > 0 ? (
            faits.map((fait) => (
              <FaitLigne key={fait.label} icone={fait.icone} label={fait.label} valeur={fait.valeur} />
            ))
          ) : (
            <Text style={styles.blocVide} numberOfLines={2}>
              Aucun détail n'a été transmis pour cette séance.
            </Text>
          )}
        </>
      )}

      <ProvenanceLigne provenance={provenance} />
    </View>
  );
}

/**
 * Exécution réelle. ABSENTE aujourd'hui pour tout le monde (la boucle de suivi
 * joueur n'est pas déployée) : on affiche un état dégradé explicite, jamais des
 * compteurs à zéro qui se liraient comme « il n'a rien fait ».
 */
function ExecutionBloc({ execution }: { execution: CoachExecutionView | null }) {
  if (!execution) {
    return (
      <View style={[styles.bloc, styles.blocDegrade]} testID="coach-player-execution-absente">
        <View style={styles.blocEntete}>
          <Ionicons name="remove-circle-outline" size={16} color={coachColors.muted} />
          <Text style={styles.blocTitre} numberOfLines={2}>
            Détail du réalisé pas encore disponible
          </Text>
        </View>
        <Text style={styles.blocVide} numberOfLines={4}>
          Le détail des exercices faits, adaptés ou sautés remonte quand le joueur termine une
          séance avec la nouvelle version de l'application. Cette partie se remplira d'elle-même.
        </Text>
        <ProvenanceLigne provenance="missing" />
      </View>
    );
  }

  // LE CALCUL, PAS SEULEMENT SON RÉSULTAT (cf. domain/coachView/execution).
  // `null` ici ne peut pas arriver (execution est non nulle), mais la fonction
  // est écrite pour accepter l'absence : on ne force donc rien.
  const detail = buildExecutionBreakdown(execution);
  const verifiable = detail?.verifiable === true ? detail : null;

  return (
    <View style={styles.bloc} testID="coach-player-execution">
      <View style={styles.blocEntete}>
        <Ionicons name="stats-chart-outline" size={16} color={coachColors.accent} />
        <Text style={styles.blocTitre} numberOfLines={2}>
          {execution.statutLibelle ?? "Détail de la réalisation"}
        </Text>
      </View>

      <View style={styles.metriques}>
        {/* PRUDENCE DE LIBELLÉ, alignée sur `domain/coachView/attention`. Ce
            pourcentage est un COMPTAGE d'exercices remonté par l'application,
            pas une mesure d'effort ni une note de performance. « Séance
            réalisée : 55 % » se lisait comme un rendement du joueur ; le
            libellé et la précision disent maintenant ce que le chiffre compte
            vraiment, dans les mêmes mots que le signal d'attention. */}
        <CoachMetric
          label="Exercices réalisés"
          value={execution.pourcentage}
          unit="%"
          icon="pie-chart-outline"
          hint="part des exercices prévus, pas une mesure d'effort"
        />
        {/* `?? null` : un document ancien peut ne pas porter le champ du tout.
            `CoachMetric` ne distingue « 0 mesuré » de « rien » que sur `null` —
            un `undefined` s'afficherait tel quel sous les yeux du coach. */}
        <CoachMetric
          label="Exercices de la séance"
          value={execution.total ?? null}
          icon="list-outline"
          hint="dénominateur du pourcentage"
        />
      </View>

      {/* DÉCOMPTE EXCLUSIF. Un exercice n'est rangé que dans UNE case : c'est ce
          qui permet de vérifier que les cases se somment au total, donc que rien
          ne se chevauche. Aucun graphique, aucune barre de progression : des
          chiffres et une phrase, le coach doit pouvoir refaire l'addition. */}
      {verifiable ? (
        <View style={styles.calcul} testID="coach-player-execution-calcul">
          {verifiable.lignes.map((ligne) => (
            <View
              key={ligne.cle}
              style={styles.calculLigne}
              accessible
              accessibilityLabel={`${ligne.libelle} : ${ligne.nombre}`}
            >
              <Text style={styles.calculLibelle} numberOfLines={2}>
                {ligne.libelle}
              </Text>
              <Text style={styles.calculNombre} numberOfLines={1}>
                {ligne.nombre}
              </Text>
            </View>
          ))}

          <View
            style={[styles.calculLigne, styles.calculTotal]}
            accessible
            accessibilityLabel={`Total des exercices de la séance : ${verifiable.total}`}
          >
            <Text style={styles.calculLibelleFort} numberOfLines={2}>
              Total des exercices
            </Text>
            <Text style={styles.calculNombreFort} numberOfLines={1}>
              {verifiable.total}
            </Text>
          </View>

          <Text style={styles.calculOperation} numberOfLines={2}>
            {verifiable.calcul}
          </Text>

          {verifiable.regle.map((phrase) => (
            <Text key={phrase} style={styles.calculRegle} numberOfLines={4}>
              {phrase}
            </Text>
          ))}
        </View>
      ) : (
        // Détail non vérifiable : on affiche les compteurs bruts comme avant, on
        // NE fabrique aucune formule, et on dit pourquoi elle manque.
        <>
          <View style={styles.metriques}>
            <CoachMetric label="Exercices faits" value={execution.fait} icon="checkmark-outline" />
            <CoachMetric label="Adaptés" value={execution.adapte} icon="swap-horizontal-outline" />
          </View>
          <View style={styles.metriques}>
            <CoachMetric label="Sautés" value={execution.saute} icon="play-skip-forward-outline" />
            <CoachMetric label="Remplacés" value={execution.remplace} icon="repeat-outline" />
          </View>
          <Text
            style={styles.calculRegle}
            numberOfLines={4}
            testID="coach-player-execution-calcul-absent"
          >
            {detail && !detail.verifiable
              ? detail.texte
              : "Le calcul de ce pourcentage ne peut pas être affiché : le détail par exercice n'a pas été transmis."}
          </Text>
        </>
      )}

      {execution.raisons.length > 0 ? (
        <View style={styles.raisons}>
          <Text style={styles.raisonsTitre} numberOfLines={1}>
            Raisons indiquées par le joueur
          </Text>
          <View style={styles.raisonsListe}>
            {execution.raisons.map((raison) => (
              <View key={raison} style={styles.raisonPuce}>
                <Text style={styles.raisonTexte} numberOfLines={1}>
                  {raison}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <ProvenanceLigne provenance="execution" />
    </View>
  );
}

// ─── 4. Pourquoi cette séance (ajustements du MOTEUR) ────────────────────────

/**
 * @param aUneSeance une séance (prévue OU faite) est-elle connue pour ce joueur ?
 *
 * POURQUOI ce drapeau. Sans lui, une liste d'ajustements vide était affirmée
 * « Séance standard : aucun ajustement automatique n'a été appliqué » — y compris
 * pour un joueur dont AUCUNE séance n'est connue. On affirmait alors quelque chose
 * sur une séance qui n'existe pas : une absence de donnée présentée comme une
 * mesure, exactement ce que cet écran s'interdit ailleurs.
 */
function AjustementsSection({
  labels,
  aUneSeance,
}: {
  labels: string[];
  aUneSeance: boolean;
}) {
  return (
    <CoachSectionCard
      title="Pourquoi cette séance"
      subtitle="Ajustements décidés automatiquement par FKS — pas des choix du joueur."
      testID="coach-player-ajustements"
    >
      {labels.length === 0 && !aUneSeance ? (
        // Aucune séance connue : on ne se prononce PAS sur des ajustements qui
        // n'ont jamais eu lieu de s'appliquer. Provenance "donnée absente".
        <>
          <View style={styles.ligneSimple}>
            <Ionicons name="help-circle-outline" size={16} color={coachColors.muted} />
            <Text style={styles.ligneTexte} numberOfLines={3}>
              Aucune séance connue pour ce joueur : il n'y a rien à expliquer pour l'instant.
            </Text>
          </View>
          <ProvenanceLigne provenance="missing" />
        </>
      ) : labels.length === 0 ? (
        <>
          <View style={styles.ligneSimple}>
            <Ionicons name="checkmark-circle-outline" size={16} color={coachColors.sub} />
            <Text style={styles.ligneTexte} numberOfLines={2}>
              Séance standard : aucun ajustement automatique n'a été appliqué.
            </Text>
          </View>
          <ProvenanceLigne provenance="fks" />
        </>
      ) : (
        <>
          <View style={styles.ligneSimple}>
            <Ionicons name="options-outline" size={16} color={coachColors.accent} />
            <Text style={styles.ligneTexteFort} numberOfLines={2}>
              Séance ajustée par FKS
            </Text>
          </View>
          {/* TOUS les motifs, sans troncature : la liste tronquée à quatre de
              l'ancienne fiche cachait précisément ce qui explique la séance. */}
          {labels.map((label) => (
            <View key={label} style={styles.ligneSimple}>
              <Ionicons name="ellipse" size={6} color={coachColors.muted} />
              <Text style={styles.ligneTexte} numberOfLines={3}>
                {label}
              </Text>
            </View>
          ))}
          <ProvenanceLigne provenance="fks" />
        </>
      )}
    </CoachSectionCard>
  );
}

// ─── 5. Historique ───────────────────────────────────────────────────────────

function HistoriqueSection({ evenements }: { evenements: CoachTimelineEvent[] }) {
  return (
    <CoachSectionCard
      title="Historique"
      subtitle="Faits datés, du plus récent au plus ancien."
      testID="coach-player-historique"
    >
      {evenements.length === 0 ? (
        <View style={styles.ligneSimple}>
          <Ionicons name="time-outline" size={16} color={coachColors.muted} />
          <Text style={styles.ligneTexte} numberOfLines={2}>
            Aucun fait enregistré pour l'instant.
          </Text>
        </View>
      ) : (
        evenements.map((evenement, index) => (
          <View
            key={evenement.id}
            style={[styles.evenement, index > 0 && styles.evenementSuivant]}
          >
            <Text style={styles.evenementDate} numberOfLines={1}>
              {timelineEventDateLabel(evenement)}
            </Text>
            <Text style={styles.evenementLibelle} numberOfLines={2}>
              {evenement.libelle}
            </Text>
            {evenement.contexte ? (
              <Text style={styles.evenementContexte} numberOfLines={3}>
                {evenement.contexte}
              </Text>
            ) : null}
            <ProvenanceLigne provenance={PROVENANCE_PAR_SOURCE[evenement.source]} />
          </View>
        ))
      )}
    </CoachSectionCard>
  );
}

// ─── 6. Assiduité ────────────────────────────────────────────────────────────
// Un comptage de FAITS datés, sur deux fenêtres explicites. Aucun classement
// entre joueurs, aucune note, aucune cible imposée.

function AssiduiteSection({ assiduite }: { assiduite: CoachAssiduiteView | null }) {
  if (!assiduite) {
    return (
      <CoachSectionCard
        title="Assiduité"
        subtitle={`Jours avec une séance terminée, sur les ${ASSIDUITE_JOURS} derniers jours.`}
        testID="coach-player-assiduite"
      >
        <View style={styles.ligneSimple}>
          <Ionicons name="help-circle-outline" size={16} color={coachColors.muted} />
          <Text style={styles.ligneTexte} numberOfLines={3}>
            Assiduité indisponible : la fenêtre d'activité n'est pas encore transmise pour ce
            joueur.
          </Text>
        </View>
        <ProvenanceLigne provenance="missing" />
      </CoachSectionCard>
    );
  }

  const premierJour = assiduite.jours[0]?.dateKey ?? null;

  return (
    <CoachSectionCard
      title="Assiduité"
      subtitle={`Séances terminées sur les ${ASSIDUITE_JOURS} derniers jours.`}
      testID="coach-player-assiduite"
    >
      {/* « jours avec séance » et non « séances » : la fenêtre serveur est une
          liste de DATES dédupliquées, deux séances faites le même jour n'y
          laissent qu'une trace. Annoncer des séances afficherait un
          sous-comptage que le coach n'aurait aucun moyen de repérer. */}
      <View style={styles.metriques}>
        <CoachMetric
          label={`${ASSIDUITE_JOURS_COURTS} derniers jours`}
          value={assiduite.faitesSur7j}
          icon="calendar-outline"
          hint="jours avec séance"
        />
        <CoachMetric
          label={`${ASSIDUITE_JOURS} derniers jours`}
          value={assiduite.faitesSur14j}
          icon="calendar-number-outline"
          hint="jours avec séance"
        />
      </View>

      <View style={styles.jours}>
        {assiduite.jours.map((jour) => (
          <View
            key={jour.dateKey}
            accessible
            accessibilityLabel={`${formatDayFR(jour.dateKey) || jour.dateKey} : ${
              jour.fait ? "séance terminée" : "aucune séance"
            }`}
            style={[styles.jour, jour.fait ? styles.jourFait : styles.jourVide]}
          >
            {jour.fait ? (
              <Ionicons name="checkmark" size={13} color={coachColors.success} />
            ) : null}
          </View>
        ))}
      </View>

      <Text style={styles.joursLegende} numberOfLines={2}>
        {premierJour
          ? `Case cochée = séance terminée ce jour-là. Du ${formatDayFR(premierJour)} à aujourd'hui.`
          : "Case cochée = séance terminée ce jour-là."}
      </Text>

      <ProvenanceLigne provenance="computed" />
    </CoachSectionCard>
  );
}

// ─── 7. Actions ──────────────────────────────────────────────────────────────
// UNIQUEMENT des actions réelles. Pas de messagerie, pas de note de suivi, pas
// de modification de programme : le produit ne les permet pas, un bouton mort
// détruirait la confiance plus sûrement qu'une fonction absente.

function ActionsSection({
  onBack,
  onRefresh,
  refreshing,
}: {
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <CoachSectionCard title="Actions" testID="coach-player-actions">
      <View style={styles.actions}>
        <ActionBouton
          icone="people-outline"
          label="Revenir à l'effectif"
          onPress={onBack}
          hint="Retourne à la liste des joueurs du club"
        />
        <ActionBouton
          icone="refresh-outline"
          label={refreshing ? "Actualisation…" : "Actualiser"}
          onPress={onRefresh}
          hint="Relit les données de ce joueur"
          disabled={refreshing}
        />
      </View>
    </CoachSectionCard>
  );
}

function ActionBouton({
  icone,
  label,
  onPress,
  hint,
  disabled = false,
  testID,
}: {
  icone: CoachIconName;
  label: string;
  onPress: () => void;
  hint: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.actionPressee,
        disabled && styles.actionDesactivee,
      ]}
      testID={testID}
    >
      <Ionicons name={icone} size={16} color={coachColors.accent} />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── 7 bis. Effectif du club : LES TROIS FORMES DE RETRAIT ───────────────────
//
// LES SEULES ÉCRITURES DE CET ÉCRAN, et elles sont irréversibles côté club.
//
// ─── POURQUOI TROIS GESTES, ET NON UN ───────────────────────────────────────
// « Retirer un membre » est ambigu depuis qu'une personne peut être encadrante
// ET joueuse. Un seul bouton obligeait le coach à deviner ce qu'il allait
// casser : arrêter le suivi d'un entraîneur-joueur lui retirait aussi son espace
// coach, sans que rien ne le dise. Trois gestes, trois portées, trois phrases.
//
// ─── LA HIÉRARCHIE, QUI EST LE VRAI SUJET D'INTERFACE ───────────────────────
// Trois boutons côte à côte auraient remplacé une ambiguïté par une hésitation.
// L'écran les classe donc par fréquence ET par gravité :
//  . « Arrêter le suivi » — le geste COURANT (un joueur a quitté l'équipe) reste
//    immédiat : un appui pour ouvrir la confirmation, un pour confirmer ;
//  . les deux gestes LOURDS vivent derrière un dépliant « Autres actions » : il
//    faut trois appuis, dont un qui ne fait rien d'autre que révéler. On ne les
//    déclenche pas par erreur en visant le bouton d'à côté.
// Aucune couleur nouvelle : le geste courant reprend le ton des actions, les
// deux lourds le ton `danger` déjà défini dans le thème coach.
//
// ─── CE QUE CHAQUE CONFIRMATION DOIT DIRE ───────────────────────────────────
// Deux paragraphes, toujours : CE QUE ÇA FAIT, et CE QUE ÇA CONSERVE. Le second
// n'est pas une politesse — c'est lui qui distingue les trois gestes, et c'est
// exactement l'information qui manquait. La phrase verrouillée (« le retrait du
// club ne supprime JAMAIS le compte FKS ») reste écrite noir sur blanc.
//
// ─── NE JAMAIS ANTICIPER LE VERDICT ─────────────────────────────────────────
// Les trois actions sont proposées à tout le monde ; c'est le serveur qui
// refuse, et son refus est affiché tel quel. Masquer un bouton « au cas où »
// aurait demandé de dupliquer le prédicat d'autorité dans l'écran — donc de le
// laisser dériver. Le PROPRIÉTAIRE et l'ENCADRANT arrivent donc ici par la voie
// normale : échecs typés OWNER_TRANSFER_REQUIRED et STAFF_OWNER_ONLY, que
// `services/clubMembers` traduit en phrases qui nomment le geste à faire.

/** Ce que l'écran dit d'un geste, avant et après. Écrit une seule fois. */
type GesteCopy = {
  /** Libellé du bouton qui OUVRE la confirmation. */
  bouton: string;
  /** Aide vocale de ce bouton (lecteur d'écran). */
  hint: string;
  titre: (nom: string) => string;
  /** CE QUE ÇA FAIT. */
  fait: (nom: string) => string;
  /** CE QUE ÇA CONSERVE. */
  conserve: (nom: string) => string;
  /** Libellé du bouton de confirmation. */
  confirmer: string;
  enCours: string;
  succes: (nom: string) => string;
  dejaFait: (nom: string) => string;
  toastTitre: string;
  toastDejaFait: string;
  toastMessage: (nom: string) => string;
};

const GESTE_COPY: Record<ClubMemberGeste, GesteCopy> = {
  "arret-suivi": {
    bouton: "Arrêter le suivi",
    hint: "Retire ce joueur de l'effectif suivi. Son compte FKS n'est pas supprimé.",
    titre: (nom) => `Arrêter le suivi de ${nom} ?`,
    fait: (nom) =>
      `Ce que fait ce geste : ${nom} sort de l'effectif suivi. Sa fiche disparaît de ta liste et tu ne verras plus ses séances.`,
    conserve: (nom) =>
      `Ce qui est conservé : son compte FKS, ses séances et son historique personnel restent intacts. Si ${nom} fait partie de l'encadrement du club, il garde tous ses accès d'encadrant.`,
    confirmer: "Confirmer l'arrêt du suivi",
    enCours: "Arrêt…",
    succes: (nom) =>
      `Le suivi de ${nom} est arrêté. Son compte FKS, ses séances et son historique personnel n'ont pas été touchés.`,
    dejaFait: (nom) => `${nom} ne faisait déjà plus partie de l'effectif suivi de ce club.`,
    toastTitre: "Suivi arrêté",
    toastDejaFait: "Déjà arrêté",
    toastMessage: (nom) => `${nom} ne fait plus partie de l'effectif suivi. Son compte FKS reste intact.`,
  },
  "retrait-encadrement": {
    bouton: "Retirer les accès d'encadrement",
    hint: "Retire les droits d'encadrement de ce compte. Son suivi de joueur, s'il en a un, continue.",
    titre: (nom) => `Retirer les accès d'encadrement de ${nom} ?`,
    fait: (nom) =>
      `Ce que fait ce geste : ${nom} perd l'espace coach — plus d'effectif, plus de cadre de la semaine, plus de directive. Le changement est immédiat, sans reconnexion.`,
    conserve: (nom) =>
      `Ce qui est conservé : si ${nom} est joueur de l'effectif, son suivi continue exactement comme avant et sa fiche reste ici. Son compte FKS n'est jamais supprimé.`,
    confirmer: "Confirmer le retrait des accès",
    enCours: "Retrait…",
    succes: (nom) =>
      `${nom} n'a plus les accès d'encadrement de ce club. S'il est joueur de l'effectif, son suivi continue.`,
    dejaFait: (nom) => `${nom} n'avait déjà plus d'accès d'encadrement sur ce club.`,
    toastTitre: "Accès d'encadrement retirés",
    toastDejaFait: "Déjà retirés",
    toastMessage: (nom) => `${nom} n'encadre plus ce club. Son compte FKS reste intact.`,
  },
  "retrait-complet": {
    bouton: "Retirer du club",
    hint: "Retire ce membre du club : suivi et encadrement. Le compte FKS du joueur n'est pas supprimé.",
    titre: (nom) => `Retirer ${nom} de l'effectif ?`,
    fait: (nom) =>
      `Ce que fait ce retrait : ${nom} ne fait plus partie de l'effectif de ce club, ni comme joueur ni comme encadrant. Vous ne verrez plus son suivi, et il ne verra plus le cadre de la semaine ni la directive.`,
    // La phrase que le produit doit tenir, mot pour mot.
    conserve: () =>
      "Le retrait du club ne supprime JAMAIS le compte FKS du joueur. Son compte, ses séances et son historique personnel lui appartiennent et restent intacts.",
    confirmer: "Confirmer le retrait",
    enCours: "Retrait…",
    succes: (nom) =>
      `${nom} a été retiré de l'effectif. Son compte FKS, ses séances et son historique personnel n'ont pas été touchés.`,
    dejaFait: (nom) => `${nom} ne faisait déjà plus partie de l'effectif de ce club.`,
    toastTitre: "Membre retiré",
    toastDejaFait: "Déjà retiré",
    toastMessage: (nom) => `${nom} ne fait plus partie de l'effectif. Son compte FKS reste intact.`,
  },
};

/** Suffixes de testID, alignés sur les noms de gestes. */
const GESTE_TESTID: Record<ClubMemberGeste, string> = {
  "arret-suivi": "suivi",
  "retrait-encadrement": "encadrement",
  "retrait-complet": "retrait",
};

function EffectifSection({
  clubId,
  playerUid,
  prenom,
  onRetireEtRevenir,
}: {
  clubId: string | null;
  playerUid: string | null;
  prenom: string;
  onRetireEtRevenir: () => void;
}) {
  // Quel geste a sa confirmation ouverte, s'il y en a un. UN SEUL à la fois :
  // deux confirmations ouvertes côte à côte, ce serait le choix multiple qu'on
  // vient justement d'éviter.
  const [confirmation, setConfirmation] = useState<ClubMemberGeste | null>(null);
  const [autresOuvertes, setAutresOuvertes] = useState(false);

  // Un hook par geste : chacun garde son propre état, attaché à sa propre cible
  // (club, membre, geste). Le « fait » de l'un ne peut donc pas s'afficher sous
  // le bouton de l'autre.
  const suivi = useClubMemberGeste("arret-suivi", clubId, playerUid);
  const encadrement = useClubMemberGeste("retrait-encadrement", clubId, playerUid);
  const complet = useClubMemberGeste("retrait-complet", clubId, playerUid);
  const etats: Record<ClubMemberGeste, ReturnType<typeof useClubMemberGeste>> = {
    "arret-suivi": suivi,
    "retrait-encadrement": encadrement,
    "retrait-complet": complet,
  };

  const nom = prenom || "ce joueur";

  // Un geste a abouti : on le dit ici ET par un toast — le seul message qui
  // survit à la navigation vers l'effectif.
  const abouti = (["arret-suivi", "retrait-encadrement", "retrait-complet"] as const).find(
    (geste) => etats[geste].phase.kind === "done",
  );
  const dejaAnnonceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!abouti) return;
    const phase = etats[abouti].phase;
    if (phase.kind !== "done" || dejaAnnonceRef.current === abouti) return;
    dejaAnnonceRef.current = abouti;
    const copy = GESTE_COPY[abouti];
    showToast({
      type: "success",
      title: phase.alreadyRemoved ? copy.toastDejaFait : copy.toastTitre,
      // Le rappel « le compte n'est pas supprimé » est répété ICI aussi : c'est
      // le moment où le doute arrive, une fois le geste fait.
      message: phase.alreadyRemoved ? copy.dejaFait(nom) : copy.toastMessage(nom),
    });
    // `etats` est reconstruit à chaque rendu : le dépendre ferait tourner l'effet
    // en boucle. `abouti` et la phase qu'il désigne suffisent à dater l'annonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abouti, nom]);

  if (abouti) {
    const phase = etats[abouti].phase;
    const copy = GESTE_COPY[abouti];
    return (
      <CoachSectionCard title="Effectif du club" testID="coach-player-retrait">
        <Text style={styles.retraitTexte} numberOfLines={5} testID="coach-player-geste-fait">
          {phase.kind === "done" && phase.alreadyRemoved ? copy.dejaFait(nom) : copy.succes(nom)}
        </Text>
        <View style={styles.actions}>
          <ActionBouton
            icone="people-outline"
            label="Revenir à l'effectif"
            onPress={onRetireEtRevenir}
            hint="Retourne à la liste des joueurs du club"
          />
        </View>
      </CoachSectionCard>
    );
  }

  if (confirmation) {
    const copy = GESTE_COPY[confirmation];
    const { phase, isRemoving, remove, reset } = etats[confirmation];
    return (
      <CoachSectionCard title="Effectif du club" testID="coach-player-retrait">
        <Text style={styles.retraitTitreConfirme} numberOfLines={3}>
          {copy.titre(nom)}
        </Text>
        <Text style={styles.retraitTexte} numberOfLines={6} testID="coach-player-retrait-portee">
          {copy.fait(nom)}
        </Text>
        {/* CE QUI EST CONSERVÉ. Pour le retrait complet, c'est la phrase
            verrouillée par test, mot pour mot. */}
        <Text style={styles.retraitTexteFort} numberOfLines={6} testID="coach-player-retrait-compte">
          {copy.conserve(nom)}
        </Text>
        {phase.kind === "failed" ? (
          <Text style={styles.retraitErreur} numberOfLines={4} testID="coach-player-retrait-erreur">
            {phase.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <ActionBouton
            icone="close-outline"
            label="Annuler"
            onPress={() => {
              reset();
              setConfirmation(null);
            }}
            hint="Ferme la confirmation sans rien changer"
            disabled={isRemoving}
            testID="coach-player-retrait-annuler"
          />
          <RetraitBouton
            label={isRemoving ? copy.enCours : copy.confirmer}
            onPress={remove}
            disabled={isRemoving}
            testID={`coach-player-${GESTE_TESTID[confirmation]}-confirmer`}
          />
        </View>
      </CoachSectionCard>
    );
  }

  return (
    <CoachSectionCard title="Effectif du club" testID="coach-player-retrait">
      <Text style={styles.retraitTexte} numberOfLines={4}>
        {`Arrêter le suivi de ${nom} met fin à son suivi côté club. Son compte FKS n'est jamais concerné.`}
      </Text>
      <View style={styles.actions}>
        <ActionBouton
          icone="person-remove-outline"
          label={GESTE_COPY["arret-suivi"].bouton}
          onPress={() => setConfirmation("arret-suivi")}
          hint={GESTE_COPY["arret-suivi"].hint}
          testID="coach-player-suivi-ouvrir"
        />
      </View>

      {/* LE DÉPLIANT. Les gestes lourds ne sont pas cachés — ils sont RANGÉS, et
          il faut un appui de plus pour les atteindre. */}
      <Pressable
        onPress={() => setAutresOuvertes((ouvert) => !ouvert)}
        accessibilityRole="button"
        accessibilityLabel="Autres actions sur ce compte"
        accessibilityHint="Affiche le retrait des accès d'encadrement et le retrait complet du club"
        accessibilityState={{ expanded: autresOuvertes }}
        style={styles.deplierZone}
        testID="coach-player-autres-ouvrir"
      >
        <Ionicons
          name={autresOuvertes ? "chevron-up-outline" : "chevron-down-outline"}
          size={14}
          color={coachColors.sub}
        />
        <Text style={styles.deplierTexte} numberOfLines={1}>
          Autres actions sur ce compte
        </Text>
      </Pressable>

      {autresOuvertes ? (
        <View style={styles.autresActions} testID="coach-player-autres">
          <Text style={styles.retraitTexte} numberOfLines={4}>
            {`Ces deux actions vont plus loin que l'arrêt du suivi. Elles ne suppriment jamais le compte FKS de ${nom}.`}
          </Text>
          <View style={styles.actions}>
            <RetraitBouton
              label={GESTE_COPY["retrait-encadrement"].bouton}
              onPress={() => setConfirmation("retrait-encadrement")}
              hint={GESTE_COPY["retrait-encadrement"].hint}
              testID="coach-player-encadrement-ouvrir"
            />
          </View>
          <View style={styles.actions}>
            <RetraitBouton
              label={GESTE_COPY["retrait-complet"].bouton}
              onPress={() => setConfirmation("retrait-complet")}
              hint={GESTE_COPY["retrait-complet"].hint}
              testID="coach-player-retrait-ouvrir"
            />
          </View>
        </View>
      ) : null}
    </CoachSectionCard>
  );
}

/**
 * Bouton de retrait. Reprend EXACTEMENT la forme d'`ActionBouton` (même hauteur,
 * même rayon, même icône à gauche) et n'en change que le ton, avec le rouge
 * brique DÉJÀ défini dans le thème coach (`danger`) : aucune cinquième couleur
 * n'entre dans le design system pour ce lot.
 */
function RetraitBouton({
  label,
  onPress,
  hint = "Retire ce membre de l'effectif du club. Le compte FKS du joueur n'est pas supprimé.",
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Aide vocale : chaque geste dit ce qu'il fait, jamais une phrase générique. */
  hint?: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        styles.actionRetrait,
        pressed && styles.actionPressee,
        disabled && styles.actionDesactivee,
      ]}
      testID={testID}
    >
      <Ionicons name="person-remove-outline" size={16} color={coachColors.danger} />
      {/* Deux lignes autorisées : « Retirer les accès d'encadrement » ne tient
          pas sur une ligne quand la police système grossit, et un libellé
          d'action tronqué au milieu est pire qu'un bouton plus haut. */}
      <Text
        style={[styles.actionLabel, styles.actionLabelRetrait, styles.actionLabelLong]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── 8. Pied de page ─────────────────────────────────────────────────────────
// Court, dit une fois. L'ancien bloc « Garde-fous FKS » répétait le même pavé
// sur chaque fiche : à force, plus personne ne le lit.

function PiedDePage() {
  return (
    <View style={styles.pied}>
      <Ionicons name="lock-closed-outline" size={13} color={coachColors.muted} />
      <Text style={styles.piedTexte} numberOfLines={4}>
        Lecture seule. Aucune donnée de santé (douleur, fatigue, ressenti) n'est transmise à
        l'encadrement.
      </Text>
    </View>
  );
}

// ─── Briques partagées ───────────────────────────────────────────────────────

/** Mention de provenance : d'où vient ce qu'on vient de lire. Toujours affichée. */
function ProvenanceLigne({
  provenance,
  style,
}: {
  provenance: CoachProvenance;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = provenanceTone(provenance);
  return (
    <View style={[styles.provenance, style]}>
      <Ionicons name={tone.icone} size={11} color={coachColors.muted} />
      <Text style={styles.provenanceTexte} numberOfLines={1}>
        {tone.libelle}
      </Text>
    </View>
  );
}

function FaitLigne({
  icone,
  label,
  valeur,
}: {
  icone: CoachIconName;
  label: string;
  valeur: string;
}) {
  return (
    <View style={styles.fait} accessible accessibilityLabel={`${label} : ${valeur}`}>
      <Ionicons name={icone} size={14} color={coachColors.muted} />
      <Text style={styles.faitLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.faitValeur} numberOfLines={2}>
        {valeur}
      </Text>
    </View>
  );
}

type Fait = { icone: CoachIconName; label: string; valeur: string };

/**
 * Mise en forme des faits d'une séance. On ne fabrique AUCUNE ligne pour une
 * information absente : une colonne de tirets ne dit rien de plus que le vide,
 * et le bloc annonce déjà quand rien n'a été transmis.
 */
function seanceFaits(session: CoachSessionView): Fait[] {
  const faits: Fait[] = [];
  if (session.dateKey) {
    faits.push({
      icone: "calendar-outline",
      label: "Date",
      valeur: formatDayFR(session.dateKey) || session.dateKey,
    });
  }
  if (session.focus) faits.push({ icone: "flag-outline", label: "Type", valeur: session.focus });
  if (session.intensite) {
    faits.push({ icone: "speedometer-outline", label: "Intensité", valeur: session.intensite });
  }
  if (session.dureeMin !== null) {
    faits.push({ icone: "time-outline", label: "Durée", valeur: `${session.dureeMin} min` });
  }
  if (session.nbBlocs !== null) {
    faits.push({ icone: "layers-outline", label: "Blocs", valeur: String(session.nbBlocs) });
  }
  return faits;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: coachSpacing.md, gap: coachSpacing.md },
  stack: { gap: coachSpacing.md },

  // Identité
  identite: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.sm,
    padding: coachSpacing.md,
    backgroundColor: coachColors.card,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: coachRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: coachColors.accentSoft,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
  },
  avatarTexte: {
    fontSize: coachType.titreSection.fontSize,
    lineHeight: coachType.titreSection.lineHeight,
    fontWeight: "800",
    color: coachColors.accent,
  },
  identiteCorps: { flex: 1, flexShrink: 1, gap: 2 },
  prenom: {
    fontSize: coachType.titreEcran.fontSize,
    lineHeight: coachType.titreEcran.lineHeight,
    fontWeight: coachType.titreEcran.fontWeight,
    letterSpacing: coachType.titreEcran.letterSpacing,
    color: coachColors.text,
  },
  identiteMeta: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  identitePastille: { marginTop: coachSpacing.xs, alignSelf: "flex-start" },
  identitePrecision: {
    marginTop: coachSpacing.xxs,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  fraicheur: {
    marginTop: coachSpacing.xxs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    color: coachColors.muted,
  },

  // Signaux
  separateur: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderSoft,
  },
  statutNote: {
    paddingHorizontal: coachSpacing.md,
    paddingBottom: coachSpacing.sm,
    paddingTop: coachSpacing.xs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    color: coachColors.muted,
  },

  // Prévu vs réalisé
  paireColonne: { gap: coachSpacing.sm },
  paireRangee: { flexDirection: "row", alignItems: "flex-start", gap: coachSpacing.sm },
  paireCellule: { flex: 1, gap: coachSpacing.sm },
  // Même écart entre les blocs quand ils sont empilés (téléphone) : sans `flex`,
  // qui étirerait la cellule dans une pile verticale.
  paireEmpilee: { gap: coachSpacing.sm },
  bloc: {
    gap: coachSpacing.xxs,
    padding: coachSpacing.sm,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
    // minHeight (jamais height) : le contenu serveur peut passer sur deux lignes.
    minHeight: coachLayout.rowMinHeight,
  },
  blocDegrade: { backgroundColor: coachColors.neutralSoft, borderColor: coachColors.neutralBorder },
  blocEntete: { flexDirection: "row", alignItems: "center", gap: coachSpacing.xs },
  blocTitre: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  blocSousTitre: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  blocVide: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },

  fait: { flexDirection: "row", alignItems: "center", gap: coachSpacing.xs, minHeight: 22 },
  faitLabel: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
  },
  faitValeur: {
    flex: 1,
    flexShrink: 1,
    textAlign: "right",
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.text,
  },

  metriques: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xs },

  // Décompte exclusif + règle de calcul
  calcul: {
    marginTop: coachSpacing.xs,
    padding: coachSpacing.sm,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.cardAlt,
    gap: 2,
  },
  calculLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    // minHeight (jamais height) : un libellé de catégorie peut passer sur deux
    // lignes quand la police système grossit.
    minHeight: 22,
  },
  calculTotal: {
    marginTop: coachSpacing.xxs,
    paddingTop: coachSpacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderStrong,
  },
  calculLibelle: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  calculLibelleFort: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  calculNombre: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.text,
  },
  calculNombreFort: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "800",
    color: coachColors.text,
  },
  calculOperation: {
    marginTop: coachSpacing.xs,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  calculRegle: {
    marginTop: coachSpacing.xxs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    color: coachColors.muted,
  },

  raisons: { gap: coachSpacing.xxs, marginTop: coachSpacing.xxs },
  raisonsTitre: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },
  raisonsListe: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xxs },
  raisonPuce: {
    paddingVertical: 3,
    paddingHorizontal: coachSpacing.xs,
    borderRadius: coachRadius.pill,
    borderWidth: 1,
    borderColor: coachColors.neutralBorder,
    backgroundColor: coachColors.neutralSoft,
  },
  raisonTexte: {
    fontSize: coachType.micro.fontSize + 1,
    lineHeight: coachType.micro.lineHeight + 1,
    fontWeight: "600",
    color: coachColors.neutralText,
  },

  // Lignes simples (ajustements, états courts)
  ligneSimple: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    minHeight: 24,
  },
  ligneTexte: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    color: coachColors.text,
  },
  ligneTexteFort: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },

  // Historique
  evenement: { gap: 2, paddingVertical: coachSpacing.xs },
  evenementSuivant: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderSoft,
  },
  evenementDate: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },
  evenementLibelle: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
  },
  evenementContexte: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },

  // Assiduité
  jours: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xxs, marginTop: coachSpacing.xs },
  jour: {
    width: 22,
    height: 22,
    borderRadius: coachRadius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  jourFait: { backgroundColor: coachColors.successSoft, borderColor: coachColors.successBorder },
  jourVide: { backgroundColor: coachColors.cardAlt, borderColor: coachColors.border },
  joursLegende: {
    marginTop: coachSpacing.xs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },

  // Actions
  actions: { flexDirection: "row", flexWrap: "wrap", gap: coachSpacing.xs },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    // Zone tactile réelle : 44 pt.
    minHeight: coachLayout.minTouchSize,
    paddingHorizontal: coachSpacing.md,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
  },
  actionPressee: { opacity: 0.75 },
  actionDesactivee: {
    borderColor: coachColors.border,
    backgroundColor: coachColors.cardAlt,
    opacity: 0.7,
  },
  actionLabel: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.accent,
  },

  // Retrait de l'effectif : même géométrie que les autres actions, ton `danger`
  // du thème coach (aucune couleur nouvelle). Le rouge n'est JAMAIS seul à dire
  // que l'action est à part : l'icône, le libellé et la confirmation le disent
  // aussi, pour qui ne distingue pas les teintes.
  actionRetrait: {
    borderColor: coachColors.dangerBorder,
    backgroundColor: coachColors.dangerSoft,
  },
  actionLabelRetrait: { color: coachColors.danger },
  // Libellé long : il rétrécit et passe à la ligne au lieu d'être coupé.
  actionLabelLong: { flexShrink: 1, paddingVertical: coachSpacing.xs },

  // Dépliant « Autres actions » : discret par construction (pas de fond, pas de
  // bordure), mais avec une vraie zone tactile de 44 pt.
  deplierZone: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    minHeight: coachLayout.minTouchSize,
    marginTop: coachSpacing.xs,
  },
  deplierTexte: {
    flexShrink: 1,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.sub,
  },
  autresActions: {
    gap: coachSpacing.xs,
    paddingTop: coachSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.borderSoft,
  },

  retraitTitreConfirme: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: coachType.corpsFort.fontWeight,
    color: coachColors.text,
    marginBottom: coachSpacing.xxs,
  },
  retraitTexte: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
    marginBottom: coachSpacing.xs,
  },
  retraitTexteFort: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.text,
    marginBottom: coachSpacing.xs,
  },
  retraitErreur: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.danger,
    marginBottom: coachSpacing.xs,
  },

  // Provenance + pied de page
  provenance: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xxs,
    marginTop: coachSpacing.xxs,
  },
  provenanceTexte: {
    flexShrink: 1,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: coachType.micro.fontWeight,
    letterSpacing: coachType.micro.letterSpacing,
    color: coachColors.muted,
  },
  pied: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.xs,
    paddingHorizontal: coachSpacing.xs,
    paddingBottom: coachSpacing.xs,
  },
  piedTexte: {
    flex: 1,
    flexShrink: 1,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },
});
