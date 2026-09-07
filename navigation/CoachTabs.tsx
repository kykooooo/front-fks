// navigation/CoachTabs.tsx
//
// TAB BAR DE L'ESPACE COACH (3 onglets).
//
// POURQUOI ELLE EXISTE.
// L'espace coach n'avait qu'un seul écran (`CoachHomeScreen`) qui empilait un
// bandeau de chiffres, un bulletin de semaine, un segmenté maison et trois
// listes. Le coach devait scroller pour atteindre la réponse à « qui dois-je
// appeler ? ». On sépare donc les trois questions du terrain en trois écrans,
// et on les met à portée de pouce en permanence :
//   Aujourd'hui -> « que dois-je regarder maintenant ? »
//   Effectif    -> « où en est CE joueur ? »
//   Semaine     -> « que s'est-il passé, et quel cadre je donne ? »
//
// CONVENTIONS REPRISES DE LA TAB BAR JOUEUR (RootNavigator > MainTabs) :
//   - `createBottomTabNavigator` + `headerShown: false` (chaque écran coach
//     dessine son propre en-tête, calé sur la largeur de contenu du socle) ;
//   - libellés TOUJOURS visibles sous l'icône (jamais l'icône seule) ;
//   - `SwipeTabsWrapper` pour le balayage depuis les bords de l'écran.
//
// CE QUI CHANGE PAR RAPPORT À LA TAB BAR JOUEUR : les couleurs. L'espace coach
// est clair (`components/coach/coachTheme`), l'espace joueur est sombre
// (`constants/theme`). Utiliser la palette joueur ici poserait une barre noire
// sous des écrans blancs — c'est exactement la rupture visuelle que ce lot
// corrige, on ne la réintroduit pas par le bas.
//
// ACCESSIBILITÉ. La couleur n'est jamais seule à dire l'onglet actif : l'icône
// passe de sa variante contour à sa variante pleine, et le libellé reste écrit.
// Chaque onglet porte un `accessibilityLabel` explicite (le libellé court
// « Semaine » ne suffit pas à un lecteur d'écran hors contexte).
//
// ONGLET D'ATTERRISSAGE : IL N'EST PLUS FIXE (correctif du 07/09).
// « Aujourd'hui » reste l'atterrissage par défaut, mais un club SANS AUCUN
// JOUEUR ouvre sur « Semaine » — voir `domain/coachView/landing.ts` pour le
// pourquoi, et le composant de portillon en bas de ce fichier pour le comment.

import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import CoachTodayScreen from "../screens/coach/CoachTodayScreen";
import CoachRosterScreen from "../screens/coach/CoachRosterScreen";
import CoachWeekScreen from "../screens/coach/CoachWeekScreen";
import { SwipeTabsWrapper } from "../components/SwipeTabsWrapper";
import { CoachScreen } from "../components/coach/CoachScreen";
import { CoachSkeleton } from "../components/coach/CoachSkeleton";
import { coachColors, coachSpacing } from "../components/coach/coachTheme";
import { useCoachLandingTab } from "../hooks/coach/useCoachLandingTab";
import type { CoachLandingTab } from "../domain/coachView/landing";
import type { CoachRosterFilter } from "../domain/coachView/roster";

/**
 * Noms de routes des onglets.
 *
 * ⚠️ CONTRAT : `CoachTodayScreen` exporte `COACH_TODAY_ROUTES` et navigue vers
 * exactement ces noms (`CoachRoster`, `CoachWeek`). Les renommer ici casserait
 * la navigation depuis l'écran d'atterrissage sans qu'aucun test ne le voie.
 */
export type CoachTabsParamList = {
  CoachToday: undefined;
  /** `filter` : filtre pré-sélectionné quand on arrive depuis « Aujourd'hui ». */
  CoachRoster: { clubId?: string; filter?: CoachRosterFilter } | undefined;
  CoachWeek: { clubId?: string } | undefined;
};

const Tabs = createBottomTabNavigator<CoachTabsParamList>();

/**
 * Ordre de lecture ET ordre de balayage : les deux doivent coïncider.
 * Exporté pour que le test de câblage vérifie que les noms de routes visés par
 * `CoachTodayScreen` existent bien ici (contrat par chaîne de caractères, donc
 * invisible au compilateur).
 */
export const COACH_TAB_ORDER: Array<keyof CoachTabsParamList> = [
  "CoachToday",
  "CoachRoster",
  "CoachWeek",
];

/** Icônes : variante pleine quand l'onglet est actif, contour sinon. */
const TAB_ICONS: Record<
  keyof CoachTabsParamList,
  { active: React.ComponentProps<typeof Ionicons>["name"]; inactive: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  CoachToday: { active: "today", inactive: "today-outline" },
  CoachRoster: { active: "people", inactive: "people-outline" },
  CoachWeek: { active: "calendar", inactive: "calendar-outline" },
};

/** Libellés de lecteur d'écran : ils disent ce que l'onglet CONTIENT. */
const TAB_A11Y_LABELS: Record<keyof CoachTabsParamList, string> = {
  CoachToday: "Aujourd'hui, ce qu'il faut regarder maintenant",
  CoachRoster: "Effectif, la liste des joueurs du club",
  CoachWeek: "Semaine, le bilan et le cadre de la semaine",
};

/** Ce que le navigateur passe au rendu d'une icône d'onglet. */
type TabIconProps = { color: string; size: number; focused: boolean };

/**
 * Rendus d'icônes construits UNE FOIS, au chargement du module.
 *
 * POURQUOI pas une flèche écrite directement dans `screenOptions` : une fonction
 * qui renvoie du JSX et qui naît à chaque rendu est un composant dont l'identité
 * change à chaque fois — React démonte et remonte alors l'icône au lieu de la
 * mettre à jour (et ESLint le signale, `react/no-unstable-nested-components`).
 * Ici les trois rendus existent avant le premier rendu et ne changent jamais.
 */
const TAB_ICON_RENDERERS: Record<
  keyof CoachTabsParamList,
  (props: TabIconProps) => React.ReactElement
> = {
  CoachToday: renduIcone("CoachToday"),
  CoachRoster: renduIcone("CoachRoster"),
  CoachWeek: renduIcone("CoachWeek"),
};

function renduIcone(name: keyof CoachTabsParamList) {
  const icones = TAB_ICONS[name];
  const Icone = ({ color, size, focused }: TabIconProps) => (
    <Ionicons name={focused ? icones.active : icones.inactive} size={size} color={color} />
  );
  Icone.displayName = `CoachTabIcon(${name})`;
  return Icone;
}

/**
 * La tab bar elle-même. Elle ne DÉCIDE de rien : on lui dit sur quel onglet
 * ouvrir, elle l'applique. `initialRouteName` n'est lu qu'une fois, au montage
 * du navigateur — c'est précisément pour ça que la décision doit être prise
 * avant, par le portillon ci-dessous, et pas par un `navigate()` d'après-coup
 * qui ferait clignoter l'écran.
 */
export function CoachTabsNavigator({
  initialRouteName,
}: {
  initialRouteName: CoachLandingTab;
}) {
  return (
    <Tabs.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => {
        const name = route.name as keyof CoachTabsParamList;
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: coachColors.card,
            borderTopColor: coachColors.border,
          },
          tabBarActiveTintColor: coachColors.accent, // 8,21:1 sur card
          tabBarInactiveTintColor: coachColors.muted, // 5,71:1 sur card
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          tabBarAccessibilityLabel: TAB_A11Y_LABELS[name],
          tabBarIcon: TAB_ICON_RENDERERS[name],
        };
      }}
    >
      <Tabs.Screen name="CoachToday" options={{ title: "Aujourd'hui" }}>
        {() => (
          <SwipeTabsWrapper currentTab="CoachToday" tabOrder={COACH_TAB_ORDER}>
            <CoachTodayScreen />
          </SwipeTabsWrapper>
        )}
      </Tabs.Screen>

      <Tabs.Screen name="CoachRoster" options={{ title: "Effectif" }}>
        {/* Le filtre d'arrivée est lu ICI, sur la prop `route` fournie par le
            navigateur, et passé à l'écran en simple prop. L'écran n'appelle donc
            pas `useRoute` : il reste montable seul (tests, prévisualisation). */}
        {({ route }) => (
          <SwipeTabsWrapper currentTab="CoachRoster" tabOrder={COACH_TAB_ORDER}>
            <CoachRosterScreen filtreInitial={route.params?.filter ?? null} />
          </SwipeTabsWrapper>
        )}
      </Tabs.Screen>

      <Tabs.Screen name="CoachWeek" options={{ title: "Semaine" }}>
        {() => (
          <SwipeTabsWrapper currentTab="CoachWeek" tabOrder={COACH_TAB_ORDER}>
            <CoachWeekScreen />
          </SwipeTabsWrapper>
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

/**
 * PORTILLON D'ATTERRISSAGE.
 *
 * Il lit l'effectif (via `useCoachLandingTab`, qui délègue à la même couche que
 * les écrans), attend la réponse, PUIS monte la tab bar sur le bon onglet.
 *
 * POURQUOI ATTENDRE PLUTÔT QUE CORRIGER APRÈS COUP. Monter « Aujourd'hui » puis
 * sauter sur « Semaine » afficherait un dixième de seconde d'écran vide avant de
 * basculer : le coach verrait une app qui hésite. Ici la tab bar naît déjà au
 * bon endroit, et ne bouge plus.
 *
 * CE QUE LE SQUELETTE DIT, ET CE QU'IL NE DIT PAS. Il annonce « du contenu
 * arrive », rien d'autre : aucun compteur, aucun zéro, aucun titre d'onglet —
 * on ne connaît pas encore la réponse, on ne fait pas semblant.
 *
 * Le portillon ne monte la tab bar qu'une fois, tant que le club ne change pas :
 * `useCoachLandingTab` ne retombe sur « pas décidable » qu'en cas de changement
 * de club, où re-décider est justement ce qu'on veut.
 */
export default function CoachTabs() {
  const onglet = useCoachLandingTab();

  if (onglet === null) {
    return (
      <CoachScreen testID="coach-tabs-landing">
        <View style={styles.landing}>
          <CoachSkeleton variant="card" />
          <CoachSkeleton variant="list" rows={4} />
        </View>
      </CoachScreen>
    );
  }

  return <CoachTabsNavigator initialRouteName={onglet} />;
}

const styles = StyleSheet.create({
  landing: { padding: coachSpacing.md, gap: coachSpacing.md },
});
