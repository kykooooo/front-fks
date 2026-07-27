// screens/coach/CoachRosterScreen.tsx
//
// ÉCRAN « EFFECTIF ».
//
// Une seule promesse : retrouver un joueur vite, et comprendre son état récent
// SANS ouvrir sa fiche. Tout ce qui ne sert pas à décider « j'ouvre cette fiche
// ou pas » n'a rien à faire ici — le détail vit dans la fiche joueur.
//
// CE QUE CET ÉCRAN NE FAIT PAS (et pourquoi c'est volontaire).
//  1. Il ne calcule AUCUNE règle métier. Recherche, filtres, tri, compteurs :
//     tout vient de `domain/coachView/roster` (module pur, testé à part). Ici on
//     branche des contrôles sur des fonctions, on ne réinvente pas de seuil.
//  2. Il ne lit AUCUN champ brut de la projection serveur. Il consomme des
//     `CoachPlayerView` produits par `toCoachPlayerViews` via `useCoachRoster`.
//  3. Il n'affiche AUCUN filtre douleur / fatigue : cette donnée est interdite
//     au coach côté serveur. Un filtre qui ne pourrait jamais rien renvoyer
//     serait une fausse promesse — pire qu'une absence.
//  4. Il ne passe PAS en deux colonnes sur grand écran. `CoachScreen` le permet
//     au-delà de 900 pt, mais une liste de noms lue en deux colonnes se scanne
//     MOINS bien qu'une seule colonne étroite : l'œil doit repartir en haut à
//     droite après chaque colonne. On garde donc la largeur de lecture (720 pt),
//     centrée. C'est le « si et seulement si la lisibilité y gagne » appliqué.
//
// SANS HORLOGE SERVEUR : aucune date relative n'est calculée dans ce fichier.
// `useCoachRoster` fige `todayKey` avec l'horloge du coach au moment de la
// lecture, et le domaine en dérive « Hier », « Il y a 6 jours », etc.

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CoachScreen } from "../../components/coach/CoachScreen";
import { CoachPlayerRow } from "../../components/coach/CoachPlayerRow";
import { CoachSkeleton } from "../../components/coach/CoachSkeleton";
import { CoachEmptyState } from "../../components/coach/CoachEmptyState";
import { CoachErrorState } from "../../components/coach/CoachErrorState";
import { CoachStateBlock } from "../../components/coach/CoachStateBlock";
import {
  coachColors,
  coachLayout,
  coachRadius,
  coachSpacing,
  coachType,
  type CoachIconName,
} from "../../components/coach/coachTheme";
import {
  buildCoachRoster,
  countCoachRosterFilters,
  COACH_ROSTER_FILTERS,
  COACH_ROSTER_FILTER_LABEL,
  COACH_ROSTER_SORTS,
  COACH_ROSTER_SORT_LABEL,
  type CoachRosterFilter,
  type CoachRosterSort,
} from "../../domain/coachView/roster";
import { INACTIVITE_CHECK_JOURS } from "../../domain/coachView/attention";
import {
  coachAgeCategoryLabel,
  coachIdentityLine,
  coachPositionLabel,
} from "../../domain/coachView/identityLabels";
import { coachStatusPrecision } from "../../domain/coachView/statusLabel";
import { coachAccessRosterCopy } from "../../domain/coachAccess";
import type { CoachPlayerView } from "../../domain/coachView/types";
import { MEMBERS_FETCH_LIMIT } from "../../repositories/clubsRepo";
import { useCoachClub } from "../../hooks/coach/useCoachClub";
import { useCoachRoster } from "../../hooks/coach/useCoachRoster";
import { useHaptics } from "../../hooks/useHaptics";
import type { CoachStackParamList } from "../../navigation/RootNavigator";

/**
 * Plafond de lecture de l'effectif. Ce n'est PAS une copie : c'est la constante
 * du repository elle-même (`MEMBERS_FETCH_LIMIT`, repositories/clubsRepo.ts),
 * celle qui borne réellement la requête Firestore. Le plafond était jusqu'ici
 * SILENCIEUX — un club de 210 membres en affichait 200 sans jamais le dire — et
 * il est désormais annoncé en pied de liste dès qu'il est atteint. Un nombre
 * recopié à la main aurait fini par annoncer un plafond faux.
 */
const PLAFOND_LECTURE_EFFECTIF = MEMBERS_FETCH_LIMIT;

/**
 * Largeur du bord de défilement des filtres (voile + bouton).
 *
 * MESURÉ, pas choisi au hasard : à 375 pt la rangée de six puces fait 853 pt et
 * n'en montre que 343 — 510 pt de filtres restaient INVISIBLES sans que rien ne
 * le signale. Le défaut existe aussi à 768 et à 1280 pt (la colonne de lecture
 * est plafonnée à 720 pt : 165 pt de filtres masqués). 56 pt laissent la place à
 * un dégradé qui dissout franchement le texte plutôt que de le guillotiner, et à
 * un bouton dont la cible tactile atteint la taille réglementaire.
 */
const BORD_DEFILEMENT_LARGEUR = 56;

/**
 * Fond de l'espace coach en version TRANSPARENTE, pour le départ du dégradé.
 *
 * On n'écrit PAS `"transparent"` : sur iOS comme sur Android, un dégradé qui
 * part du noir transparent vire au gris sale en son milieu. Le dégradé doit
 * partir de la MÊME couleur que le fond, alpha à zéro.
 * Dérivé de `coachColors.bg` (#F6F5F2).
 */
const VOILE_TRANSPARENT = "rgba(246, 245, 242, 0)";

/** Tolérance de mesure : sous 1 pt, la rangée est considérée en butée. */
const BUTEE_TOLERANCE = 1;

type CoachNavigation = NativeStackNavigationProp<CoachStackParamList>;

// ─── Copie des vides EXPLICATIFS ─────────────────────────────────────────────
// Un filtre qui ne renvoie rien n'est pas une panne. Mais ce n'est pas non plus
// automatiquement une bonne nouvelle : un filtre bâti sur des faits (« séance
// préparée restée sans séance terminée », « séance adaptée par le joueur ») est
// TOUT AUSSI VIDE quand aucun fait de ce type ne remonte du tout. Conclure
// « tout va bien » à la place du coach, c'est maquiller une absence de donnée en
// mesure rassurante — exactement ce que le reste de l'espace coach s'interdit.
//
// RÈGLE APPLIQUÉE À CHAQUE TEXTE CI-DESSOUS :
//  1. dire ce que le filtre a cherché, précisément ;
//  2. ne PAS conclure sur ce qui n'a pas été mesuré ;
//  3. quand l'absence de donnée est une explication possible du vide, renvoyer
//     vers le filtre qui la rend visible (« Sans donnée récente »).
type VideCopy = { icone: CoachIconName; titre: string; corps: string };

const VIDE_PAR_FILTRE: Record<CoachRosterFilter, VideCopy> = {
  tous: {
    icone: "people-outline",
    titre: "Aucun joueur à afficher",
    corps: "L'effectif est vide pour le moment.",
  },
  // Ce filtre ne retient que le statut HAUT. Il est aussi vide devant un groupe
  // entier dont on ne sait rien (statut « indisponible ») : on ne dit donc plus
  // « c'est plutôt bon signe ».
  a_verifier: {
    icone: "checkmark-circle-outline",
    titre: "Personne à vérifier",
    corps:
      "Aucun fait connu ne demande une lecture de votre part aujourd'hui. Ce filtre ne dit rien des joueurs dont aucune donnée ne remonte : ils apparaissent dans « Sans donnée récente ».",
  },
  a_surveiller: {
    icone: "checkmark-circle-outline",
    titre: "Personne à surveiller",
    corps:
      "Aucun signal léger en attente. Les joueurs dont on ne sait rien restent visibles dans le filtre « Sans donnée récente ».",
  },
  // Vide pour DEUX raisons indiscernables ici : soit chaque séance préparée a
  // été suivie d'une séance terminée, soit aucune séance préparée ne remonte.
  // On nomme les deux plutôt que d'affirmer la première.
  seance_non_faite: {
    icone: "checkmark-done-outline",
    titre: "Aucune séance en attente dans ce filtre",
    corps:
      "Ce filtre reste vide aussi bien quand les séances préparées ont été suivies d'une séance terminée que lorsqu'aucune séance préparée ne remonte. Pour savoir de qui l'app n'a aucune nouvelle, ouvrez « Sans donnée récente ».",
  },
  seance_adaptee: {
    icone: "options-outline",
    titre: "Aucune séance adaptée par un joueur",
    corps:
      "Personne n'a signalé avoir modifié, sauté ou remplacé un exercice. Le détail de ce qui a été réellement fait ne remonte pas encore pour tous les joueurs : ce vide peut aussi venir de là.",
  },
  // Seul vide réellement CONCLUANT de la liste : ce filtre retient aussi les
  // joueurs sans aucune donnée, donc s'il est vide, chaque joueur a bien une
  // trace datée récente. On peut l'affirmer.
  aucune_donnee_recente: {
    icone: "time-outline",
    titre: "Tout le monde a une trace récente",
    corps: `Chaque joueur a une séance terminée enregistrée il y a moins de ${INACTIVITE_CHECK_JOURS} jours.`,
  },
};

// ─── Petites compositions de libellés (présentation, pas de calcul) ──────────

/**
 * Ligne d'activité de la ligne d'effectif. `derniereActivite.libelle` vient du
 * domaine (« Aujourd'hui », « Hier », « Il y a 6 jours ») : on ne fait que
 * l'habiller. `null` → `CoachPlayerRow` écrit lui-même « Aucune séance
 * enregistrée » : l'absence est dite, jamais masquée.
 */
function libelleActivite(view: CoachPlayerView): string | null {
  const activite = view.derniereActivite;
  if (!activite) return null;
  return `Séance faite ${activite.libelle.toLocaleLowerCase("fr-FR")}`;
}

/**
 * Contexte court sous le prénom : poste et catégorie, tels que DÉCLARÉS.
 *
 * ACCENTS : la valeur persistée s'écrit « Defenseur » sans accent parce qu'elle
 * est comparée à une allowlist serveur. `coachPositionLabel` n'accentue que le
 * RENDU (domain/coachView/identityLabels) — la donnée, la recherche et les
 * filtres continuent de travailler sur la valeur brute.
 */
function libelleMeta(view: CoachPlayerView): string | null {
  const ligne = coachIdentityLine([
    coachPositionLabel(view.poste),
    coachAgeCategoryLabel(view.categorieAge),
  ]);
  if (ligne) return ligne;
  // Rien de déclaré : on le dit plutôt que de laisser une ligne muette.
  return view.profilComplet ? null : "Profil à compléter";
}

/** Mot d'effectif accordé au type d'équipe (le club de Laurent est féminin). */
function motMembre(genre: "female" | "male" | "mixed" | null, pluriel: boolean): string {
  const base = genre === "female" ? "joueuse" : genre === "male" ? "joueur" : "membre";
  return pluriel ? `${base}s` : base;
}

export type CoachRosterScreenProps = {
  /**
   * Filtre pré-sélectionné à l'arrivée. Renseigné par la tab bar
   * (`navigation/CoachTabs`) à partir des paramètres de route quand le coach
   * arrive depuis « Aujourd'hui » (« Voir tout » sur les profils à vérifier).
   *
   * POURQUOI une prop et pas `useRoute()` : l'écran reste montable seul, sans
   * conteneur de navigation. Le filtre reste MODIFIABLE ensuite — c'est un point
   * de départ, pas un verrou.
   */
  filtreInitial?: CoachRosterFilter | null;
};

export default function CoachRosterScreen({ filtreInitial = null }: CoachRosterScreenProps = {}) {
  const navigation = useNavigation<CoachNavigation>();
  const haptics = useHaptics();

  const club = useCoachClub();
  const roster = useCoachRoster(club.clubId);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CoachRosterFilter>(filtreInitial ?? "tous");
  const [sort, setSort] = useState<CoachRosterSort>("priorite");

  // Nouvelle demande d'arrivée filtrée (le coach revient d'« Aujourd'hui » en
  // demandant une autre puce) : on repositionne le filtre.
  //
  // POURQUOI PENDANT LE RENDU ET PAS DANS UN EFFET. Un effet aurait affiché un
  // premier rendu avec l'ANCIEN filtre, puis un second avec le bon : le coach
  // verrait la liste complète clignoter avant de se filtrer. Ajuster l'état
  // pendant le rendu est le motif prévu par React pour « une valeur dérivée d'une
  // prop qui doit rester modifiable ensuite » : React relance le rendu
  // immédiatement, sans jamais peindre l'état intermédiaire.
  //
  // La mémoire `filtreApplique` est ce qui rend l'ajustement NON répétitif : sans
  // elle, chaque rendu réimposerait `filtreInitial` et le coach ne pourrait plus
  // changer de puce.
  const [filtreApplique, setFiltreApplique] = useState<CoachRosterFilter | null>(filtreInitial);
  if (filtreInitial && filtreInitial !== filtreApplique) {
    setFiltreApplique(filtreInitial);
    setFilter(filtreInitial);
  }

  const { views } = roster;

  // Compteurs calculés sur la liste COMPLÈTE : une puce doit annoncer combien de
  // joueurs elle contient, indépendamment de la recherche en cours (sinon les
  // chiffres bougent sous les doigts pendant la frappe).
  const compteurs = useMemo(() => countCoachRosterFilters(views), [views]);
  const visibles = useMemo(
    () => buildCoachRoster(views, { query, filter, sort }),
    [views, query, filter, sort],
  );

  const requete = query.trim();
  const genre = club.teamGender;

  // ── Rangée de filtres : rendre le défilement VISIBLE ───────────────────────
  // La rangée de puces déborde à TOUTES les largeurs testées (510 pt masqués à
  // 375, 165 pt à 768 comme à 1280). Jusqu'ici rien ne le disait : une puce
  // tranchée au bord droit ressemblait à un défaut d'affichage, pas à une
  // invitation à faire glisser — trois filtres sur six restaient introuvables.
  // On mesure donc la rangée pour savoir de quel côté il reste quelque chose,
  // et on l'annonce (voile + bouton) uniquement quand c'est VRAI.
  const pucesRef = useRef<ScrollView | null>(null);
  const [pucesVisible, setPucesVisible] = useState(0);
  const [pucesContenu, setPucesContenu] = useState(0);
  const [pucesOffset, setPucesOffset] = useState(0);

  const pucesMasqueGauche = pucesOffset > BUTEE_TOLERANCE;
  const pucesMasqueDroite = pucesContenu - pucesVisible - pucesOffset > BUTEE_TOLERANCE;

  const onPucesLayout = useCallback((e: LayoutChangeEvent) => {
    setPucesVisible(e.nativeEvent.layout.width);
  }, []);
  const onPucesContenu = useCallback((largeur: number) => {
    setPucesContenu(largeur);
  }, []);
  const onPucesScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPucesOffset(e.nativeEvent.contentOffset.x);
  }, []);

  /**
   * Fait glisser la rangée d'environ un écran de puces. On ne saute pas à la
   * fin : le coach doit garder le fil de ce qui défile, sinon le bouton devient
   * une téléportation et il ne sait plus quels filtres il a survolés.
   */
  const defilerPuces = useCallback(
    (sens: 1 | -1) => {
      haptics.impactLight();
      const pas = Math.max(120, pucesVisible * 0.75);
      const maxi = Math.max(0, pucesContenu - pucesVisible);
      const cible = Math.min(maxi, Math.max(0, pucesOffset + sens * pas));
      pucesRef.current?.scrollTo({ x: cible, animated: true });
    },
    [haptics, pucesContenu, pucesOffset, pucesVisible],
  );

  const onSelectFilter = useCallback(
    (next: CoachRosterFilter) => {
      haptics.impactLight();
      setFilter(next);
    },
    [haptics],
  );

  const onSelectSort = useCallback(
    (next: CoachRosterSort) => {
      haptics.impactLight();
      setSort(next);
    },
    [haptics],
  );

  const onOpenPlayer = useCallback(
    (view: CoachPlayerView) => {
      if (!club.clubId) return;
      haptics.impactLight();
      navigation.navigate("CoachPlayerDetail", {
        clubId: club.clubId,
        playerUid: view.playerUid,
      });
    },
    [club.clubId, haptics, navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CoachPlayerView>) => (
      <CoachPlayerRow
        firstName={item.prenom}
        meta={libelleMeta(item)}
        statusLevel={item.statut}
        // « Rien à signaler » alors qu'il manque des données n'est pas un
        // constat : la nuance s'écrit sous la ligne (la pastille reste courte).
        statusPrecision={coachStatusPrecision(item.statut, item.donneesPartielles)}
        activityLabel={libelleActivite(item)}
        onPress={() => onOpenPlayer(item)}
        testID={`coach-roster-row-${item.playerUid}`}
      />
    ),
    [onOpenPlayer],
  );

  // ── En-tête collé : recherche + filtres, les deux outils qu'on garde sous le
  //    pouce en permanence. Le tri, lui, se règle une fois : il scrolle.
  const header = (
    <View style={styles.header}>
      <Text style={styles.titre} numberOfLines={1}>
        Effectif
      </Text>

      <View style={styles.rechercheRow}>
        <Ionicons name="search" size={17} color={coachColors.muted} />
        <TextInput
          style={styles.rechercheInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un prénom, un poste"
          placeholderTextColor={coachColors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Rechercher un joueur"
          accessibilityHint="La recherche porte sur le prénom, le poste et le niveau"
          testID="coach-roster-search"
        />
        {requete ? (
          <Pressable
            onPress={() => setQuery("")}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            hitSlop={10}
            style={styles.effacer}
            testID="coach-roster-search-clear"
          >
            <Ionicons name="close-circle" size={18} color={coachColors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* La rangée déborde volontairement des marges de l'en-tête : une puce qui
          se dissout au BORD DE L'ÉCRAN se lit comme « ça continue », alors que
          la même puce tranchée à 16 pt du bord se lit comme un bug. */}
      <View style={styles.pucesZone}>
        <ScrollView
          ref={pucesRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.puces}
          onLayout={onPucesLayout}
          onContentSizeChange={onPucesContenu}
          onScroll={onPucesScroll}
          // 32 ms : assez fin pour que le voile suive le doigt, assez large pour
          // ne pas re-rendre l'en-tête à chaque image.
          scrollEventThrottle={32}
        >
          {COACH_ROSTER_FILTERS.map((cle) => {
            const actif = filter === cle;
            const libelle = COACH_ROSTER_FILTER_LABEL[cle];
            const nombre = compteurs[cle];
            return (
              <Pressable
                key={cle}
                onPress={() => onSelectFilter(cle)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                accessibilityLabel={`${libelle}, ${nombre} ${motMembre(genre, nombre > 1)}`}
                style={({ pressed }) => [
                  styles.puce,
                  actif && styles.puceActive,
                  pressed && styles.pucePressee,
                ]}
                testID={`coach-roster-filter-${cle}`}
              >
                {/* La couleur n'est JAMAIS seule à dire quelle puce est active :
                    coche + texte gras + fond teinté, lisibles en plein soleil. */}
                {actif ? (
                  <Ionicons name="checkmark" size={13} color={coachColors.accent} />
                ) : null}
                <Text
                  style={[styles.puceTexte, actif && styles.puceTexteActif]}
                  numberOfLines={1}
                >
                  {libelle}
                </Text>
                <Text style={[styles.puceNombre, actif && styles.puceNombreActif]}>
                  {nombre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {pucesMasqueGauche ? (
          <BordDefilement cote="gauche" onPress={() => defilerPuces(-1)} />
        ) : null}
        {pucesMasqueDroite ? (
          <BordDefilement cote="droite" onPress={() => defilerPuces(1)} />
        ) : null}
      </View>

      {roster.status === "ready" && views.length > 0 ? (
        <Text
          style={styles.compteur}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
          testID="coach-roster-count"
        >
          {requete
            ? `${visibles.length} résultat${visibles.length > 1 ? "s" : ""} pour « ${requete} »`
            : `${visibles.length} ${motMembre(genre, visibles.length > 1)} sur ${views.length}`}
        </Text>
      ) : null}
    </View>
  );

  // ── Bandeaux d'honnêteté : ce qu'on n'a pas pu lire, et depuis quand ────────
  const bandeaux = (
    <View style={styles.bandeaux}>
      {roster.isStale ? (
        <Bandeau
          icone="cloud-offline-outline"
          titre="Mise à jour impossible"
          corps="Les informations affichées sont celles de la dernière lecture réussie."
          testID="coach-roster-stale"
        />
      ) : null}
      {roster.restrictedCount > 0 ? (
        // TROISIÈME état, distinct des deux suivants : le serveur n'ouvre pas
        // l'accès. On le dit sans dramatiser et SANS laisser croire que ces
        // joueurs ne s'entraînent pas — ils ne sont simplement pas affichables.
        <Bandeau
          icone="lock-closed-outline"
          titre={coachAccessRosterCopy(roster.restrictedCount).titre}
          corps={coachAccessRosterCopy(roster.restrictedCount).corps}
          testID="coach-roster-restricted"
        />
      ) : null}
      {roster.pendingCount > 0 ? (
        <Bandeau
          icone="sync-outline"
          titre={`${roster.pendingCount} profil${roster.pendingCount > 1 ? "s" : ""} en préparation`}
          corps="Ces joueurs apparaîtront d'eux-mêmes dès que FKS aura préparé leurs données."
          testID="coach-roster-pending"
        />
      ) : null}
      {roster.unreadableCount > 0 ? (
        <Bandeau
          icone="help-circle-outline"
          titre={`${roster.unreadableCount} profil${roster.unreadableCount > 1 ? "s" : ""} non lu${roster.unreadableCount > 1 ? "s" : ""}`}
          corps="Leur lecture a échoué : ils ne sont donc ni dans la liste, ni dans les compteurs."
          testID="coach-roster-unreadable"
        />
      ) : null}
    </View>
  );

  // ── Tri : contrôle discret, jamais un gros bloc en haut de l'écran ──────────
  const triRow = (
    <View style={styles.triRow}>
      <Text style={styles.triLabel}>Trier</Text>
      {COACH_ROSTER_SORTS.map((cle) => {
        const actif = sort === cle;
        return (
          <Pressable
            key={cle}
            onPress={() => onSelectSort(cle)}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={COACH_ROSTER_SORT_LABEL[cle]}
            style={({ pressed }) => [styles.tri, pressed && styles.pucePressee]}
            testID={`coach-roster-sort-${cle}`}
          >
            <Text style={[styles.triTexte, actif && styles.triTexteActif]} numberOfLines={1}>
              {COACH_ROSTER_SORT_LABEL[cle]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const listHeader = (
    <View>
      {bandeaux}
      {triRow}
      <View style={styles.listeHaut} />
    </View>
  );

  // Plafond de lecture ATTEINT : on le dit, au lieu de laisser croire que le
  // club compte exactement 200 membres.
  const listFooter =
    roster.memberCount >= PLAFOND_LECTURE_EFFECTIF ? (
      <Text style={styles.plafond} numberOfLines={3} testID="coach-roster-limit-note">
        {`Seuls les ${PLAFOND_LECTURE_EFFECTIF} premiers membres du club sont lus. Si votre effectif est plus grand, les suivants n'apparaissent pas dans cette liste.`}
      </Text>
    ) : null;

  const videFiltre = () => {
    // Recherche infructueuse : on distingue « rien ne correspond à ce mot » de
    // « ce filtre est vide ». Ce n'est pas la même information.
    if (requete) {
      return (
        <CoachStateBlock
          icon="search-outline"
          title="Aucun résultat"
          body={`Aucun joueur ne correspond à « ${requete} ». La recherche porte sur le prénom, le poste et le niveau.`}
          action={{ label: "Effacer la recherche", onPress: () => setQuery("") }}
          testID="coach-roster-empty"
        />
      );
    }
    const copie = VIDE_PAR_FILTRE[filter] ?? VIDE_PAR_FILTRE.tous;
    return (
      <CoachStateBlock
        icon={copie.icone}
        title={copie.titre}
        body={copie.corps}
        level={filter === "tous" ? "unknown" : "normal"}
        action={
          filter === "tous"
            ? null
            : { label: "Voir tout l'effectif", onPress: () => setFilter("tous") }
        }
        testID="coach-roster-empty"
      />
    );
  };

  // ── États de premier rang, dans l'ordre où ils priment ──────────────────────

  // Coach sans club : ce n'est ni un vide ni une erreur, c'est un état produit.
  if (club.status === "notInClub") {
    return (
      <CoachScreen testID="coach-roster">
        <CoachStateBlock
          icon="shield-outline"
          title="Aucun club rattaché"
          body="Votre compte n'est rattaché à aucun club. Créez votre club depuis l'accueil, puis partagez son code d'invitation à vos joueurs."
          testID="coach-roster-no-club"
        />
      </CoachScreen>
    );
  }

  if (club.status === "loading" || roster.status === "loading") {
    return (
      <CoachScreen header={header} scroll={false} testID="coach-roster">
        <View style={styles.chargement}>
          <CoachSkeleton variant="list" rows={6} testID="coach-roster-skeleton" />
        </View>
      </CoachScreen>
    );
  }

  // Lecture du club refusée alors qu'on n'a jamais rien lu : rien à afficher.
  if (club.status === "error" && !club.clubId) {
    return (
      <CoachScreen testID="coach-roster">
        <CoachErrorState
          variant="unexpected"
          subject="club"
          action={{ onPress: club.refresh }}
          testID="coach-roster-error"
        />
      </CoachScreen>
    );
  }

  // Effectif totalement illisible (permissions, réseau) : on ne montre AUCUN
  // compteur — un « 0 joueur » ici serait un mensonge, pas une mesure.
  if (roster.status === "unavailable" && views.length === 0) {
    return (
      <CoachScreen testID="coach-roster">
        <CoachErrorState
          variant="unexpected"
          subject="effectif"
          action={{ onPress: roster.refresh }}
          footnote="Aucun effectif n'a pu être lu pour ce club."
          testID="coach-roster-error"
        />
      </CoachScreen>
    );
  }

  // Club réellement sans joueur lisible : vide expliqué (jamais une erreur).
  //
  // TROIS vides différents, et surtout PAS le même message :
  //  - des projections arrivent  → "Synchronisation en cours" (attendre suffit) ;
  //  - l'effectif existe mais n'est pas consultable → on le DIT. Afficher ici
  //    "Aucun joueur dans l'effectif" serait un mensonge : les joueurs sont bien
  //    là, et ils s'entraînent peut-être très bien ;
  //  - personne n'a rejoint     → le vrai club vide.
  if (views.length === 0) {
    if (roster.pendingCount === 0 && roster.restrictedCount > 0) {
      const copie = coachAccessRosterCopy(roster.restrictedCount);
      return (
        <CoachScreen testID="coach-roster">
          <CoachStateBlock
            icon="lock-closed-outline"
            title={copie.titre}
            body={copie.corps}
            testID="coach-roster-empty-restricted"
          />
        </CoachScreen>
      );
    }
    return (
      <CoachScreen testID="coach-roster">
        <CoachEmptyState
          variant={roster.pendingCount > 0 ? "syncPending" : "clubWithoutPlayers"}
          action={roster.pendingCount > 0 ? { onPress: roster.refresh } : null}
          testID="coach-roster-empty-club"
        />
      </CoachScreen>
    );
  }

  return (
    <CoachScreen header={header} scroll={false} testID="coach-roster">
      <FlatList
        data={visibles}
        keyExtractor={(item) => item.playerUid}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={videFiltre()}
        ItemSeparatorComponent={Separateur}
        contentContainerStyle={styles.listeContenu}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Chargement progressif : un effectif peut monter à 200 lignes. On rend
        // une première fenêtre courte, le reste arrive au fil du défilement.
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={roster.isRefreshing}
            onRefresh={roster.refresh}
            tintColor={coachColors.accent}
          />
        }
        testID="coach-roster-list"
      />
    </CoachScreen>
  );
}

function Separateur() {
  return <View style={styles.separateur} />;
}

/**
 * Bord de défilement de la rangée de filtres : le signe qu'il RESTE des filtres
 * de ce côté-là.
 *
 * DEUX SIGNAUX, JAMAIS UN SEUL.
 *  1. Un dégradé vers le fond : la puce suivante est AMORCÉE et se dissout, au
 *     lieu d'être tranchée net en plein mot. C'est ce qui transforme un bord
 *     qui ressemble à un bug en un bord qui dit « ça continue ».
 *  2. Un vrai bouton, avec son chevron, son rôle et son libellé. Le dégradé est
 *     purement visuel : il ne dit rien à un lecteur d'écran, il ne se touche
 *     pas, et il disparaît pour qui voit mal les nuances. Le bouton, lui, est
 *     annonçable, atteignable au pouce et ne dépend d'aucune couleur.
 *
 * Il n'est rendu que lorsqu'il reste RÉELLEMENT quelque chose à faire défiler —
 * une flèche permanente qui ne mène nulle part serait une fausse promesse.
 */
function BordDefilement({
  cote,
  onPress,
}: {
  cote: "gauche" | "droite";
  onPress: () => void;
}) {
  const versLaDroite = cote === "droite";
  return (
    // `box-none` : la zone du dégradé laisse passer le doigt vers les puces,
    // seul le bouton capte le toucher.
    <View
      pointerEvents="box-none"
      style={[styles.bord, versLaDroite ? styles.bordDroite : styles.bordGauche]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          versLaDroite
            ? [VOILE_TRANSPARENT, coachColors.bg]
            : [coachColors.bg, VOILE_TRANSPARENT]
        }
        // MESURÉ à la capture : à 100 % la teinte n'était pleine qu'au tout
        // dernier pixel, et le chevron se posait sur des lettres encore lisibles
        // à 30 % — on lisait un glyphe collé sur « Séan », soit exactement le
        // « défaut d'affichage » qu'on cherche à faire disparaître. Le dégradé
        // est donc plein AVANT le bouton, qui repose sur un fond net.
        locations={versLaDroite ? [0, 0.62] : [0.38, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={versLaDroite ? "Filtres suivants" : "Filtres précédents"}
        accessibilityHint="Fait défiler la rangée de filtres"
        // Le bouton mesure 32 pt de large pour ne pas masquer une puce entière ;
        // le hitSlop ramène la cible réelle à 44 pt, comme les puces elles-mêmes.
        hitSlop={{ top: 0, bottom: 0, left: 6, right: 6 }}
        style={({ pressed }) => [styles.bordBouton, pressed && styles.pucePressee]}
        testID={`coach-roster-filters-${cote}`}
      >
        {/* Même pastille que les puces (fond blanc, contour, rayon) : le coach
            reconnaît un CONTRÔLE, pas un glyphe décoratif tombé là. */}
        <View style={styles.bordPastille}>
          <Ionicons
            name={versLaDroite ? "chevron-forward" : "chevron-back"}
            size={16}
            color={coachColors.accent}
          />
        </View>
      </Pressable>
    </View>
  );
}

function Bandeau({
  icone,
  titre,
  corps,
  testID,
}: {
  icone: CoachIconName;
  titre: string;
  corps: string;
  testID?: string;
}) {
  return (
    <View style={styles.bandeau} testID={testID}>
      <Ionicons name={icone} size={18} color={coachColors.sub} />
      <View style={styles.bandeauTexte}>
        <Text style={styles.bandeauTitre} numberOfLines={2}>
          {titre}
        </Text>
        <Text style={styles.bandeauCorps} numberOfLines={3}>
          {corps}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── En-tête collé ──
  header: {
    paddingHorizontal: coachSpacing.md,
    paddingTop: coachSpacing.sm,
    paddingBottom: coachSpacing.xs,
    gap: coachSpacing.xs,
  },
  titre: {
    fontSize: coachType.titreEcran.fontSize,
    lineHeight: coachType.titreEcran.lineHeight,
    fontWeight: coachType.titreEcran.fontWeight,
    letterSpacing: coachType.titreEcran.letterSpacing,
    color: coachColors.text,
  },
  rechercheRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xs,
    paddingHorizontal: coachSpacing.sm,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
    // minHeight (jamais height) : le champ suit la taille de police système.
    minHeight: coachLayout.minTouchSize,
  },
  rechercheInput: {
    flex: 1,
    paddingVertical: coachSpacing.xs,
    fontSize: coachType.corps.fontSize,
    lineHeight: coachType.corps.lineHeight,
    color: coachColors.text,
  },
  effacer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: coachLayout.minTouchSize,
    minWidth: 28,
  },
  // La rangée reprend les 16 pt de marge de l'en-tête en NÉGATIF puis les rend
  // en marge intérieure : les puces restent alignées sur le titre et le champ de
  // recherche, mais elles peuvent glisser jusqu'au bord réel de l'écran.
  pucesZone: {
    marginHorizontal: -coachSpacing.md,
    // Le voile est posé PAR-DESSUS la rangée : sans cette référence, il se
    // positionnerait sur l'en-tête entier.
    position: "relative",
  },
  puces: {
    gap: coachSpacing.xs,
    paddingHorizontal: coachSpacing.md,
    paddingVertical: 2,
  },
  puce: {
    flexDirection: "row",
    alignItems: "center",
    gap: coachSpacing.xxs + 2,
    paddingHorizontal: coachSpacing.sm,
    // Zone tactile >= 44 pt, sans grossir visuellement la puce.
    minHeight: coachLayout.minTouchSize,
    borderRadius: coachRadius.pill,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
  },
  puceActive: {
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.accentSoft,
  },
  pucePressee: { opacity: 0.6 },
  puceTexte: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.sub,
  },
  puceTexteActif: { color: coachColors.accent, fontWeight: "800" },
  puceNombre: {
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    fontWeight: "700",
    color: coachColors.muted,
  },
  puceNombreActif: { color: coachColors.accent },

  // ── Bords de défilement de la rangée de filtres ──
  bord: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: BORD_DEFILEMENT_LARGEUR,
    justifyContent: "center",
  },
  bordGauche: { left: 0, alignItems: "flex-start" },
  bordDroite: { right: 0, alignItems: "flex-end" },
  bordBouton: {
    width: 32,
    // minHeight (jamais height) : le bouton suit la hauteur d'une puce quand la
    // police système grossit.
    minHeight: coachLayout.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
  },
  bordPastille: {
    width: 28,
    height: 28,
    borderRadius: coachRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: coachColors.accentBorder,
    backgroundColor: coachColors.card,
  },
  compteur: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
  },

  // ── Corps ──
  chargement: { padding: coachSpacing.md },
  listeContenu: { paddingBottom: coachSpacing.xxl },
  listeHaut: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: coachColors.border,
  },
  separateur: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: coachColors.borderSoft,
  },
  plafond: {
    paddingHorizontal: coachSpacing.md,
    paddingVertical: coachSpacing.sm,
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
  },

  // ── Bandeaux ──
  bandeaux: { gap: coachSpacing.xs },
  bandeau: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: coachSpacing.sm,
    marginHorizontal: coachSpacing.md,
    marginTop: coachSpacing.sm,
    padding: coachSpacing.sm,
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
  },
  bandeauTexte: { flex: 1, gap: 2 },
  bandeauTitre: {
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: coachType.corpsFort.fontWeight,
    color: coachColors.text,
  },
  bandeauCorps: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },

  // ── Tri ──
  triRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: coachSpacing.xxs,
    paddingHorizontal: coachSpacing.md,
    paddingTop: coachSpacing.sm,
    paddingBottom: coachSpacing.xs,
  },
  triLabel: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.muted,
    marginRight: coachSpacing.xxs,
  },
  tri: {
    justifyContent: "center",
    minHeight: coachLayout.minTouchSize,
    // MESURÉ à la capture : à 8 pt de marge intérieure, "Trier" + les trois tris
    // dépassaient de ~20 pt la largeur utile d'un écran de 375 pt. La ligne
    // passait donc sur deux niveaux, "Par dernière séance" atterrissant seul
    // sous "Trier" — on ne lisait plus trois options d'un même groupe. À 4 pt le
    // rang tient sur une ligne à 375 pt ; `flexWrap` reste en filet pour les
    // écrans plus étroits (320 pt) et les grandes tailles de police système.
    paddingHorizontal: coachSpacing.xxs,
    borderRadius: coachRadius.chip,
  },
  triTexte: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "600",
    color: coachColors.sub,
  },
  // Actif = gras + couleur d'accent + soulignement : trois signaux, dont deux
  // qui survivent au daltonisme et au plein soleil.
  triTexteActif: {
    color: coachColors.accent,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
