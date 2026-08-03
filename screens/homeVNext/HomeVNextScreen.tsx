// screens/homeVNext/HomeVNextScreen.tsx
// =============================================================================
// Home vNext — L'ECRAN
// =============================================================================
//
// C'EST L'ONGLET ACCUEIL DU JOUEUR. L'entete disait le contraire (« ce n'est pas
// le Home de production, cet ecran n'entre pas dans RootNavigator ») : c'etait
// vrai du prototype, ca ne l'est plus depuis le lot de cablage. Le chemin reel
// est `navigation/RootNavigator.tsx` -> `HomeVNextContainer` -> cet ecran, et
// l'ancien `screens/HomeScreen.tsx` ne survit que comme repli d'interrupteur
// (`config/homeFeatures.ts`).
//
// -----------------------------------------------------------------------------
// CE QUE CET ECRAN NE FAIT TOUJOURS PAS — ET C'EST VOLONTAIRE
// -----------------------------------------------------------------------------
// Il ne lit AUCUN store, n'appelle AUCUN hook metier, ne fait AUCUN fetch, ne
// declenche AUCUNE generation. Il recoit un `HomeVNextViewModel` en prop et le
// rend. Les stores sont lus un cran au-dessus (`HomeVNextContainer` ->
// `useHomeVNextViewModel`), et c'est ce qui garantit que cet ecran ne peut rien
// affirmer que le ViewModel n'ait pas deja autorise — la propriete qui a survecu
// au branchement, et celle qu'il ne faut pas perdre en ajoutant « juste un
// useStore » ici.
//
// Les actions restent des callbacks optionnels : le conteneur les fournit en
// production, les tests et les fixtures s'en passent.
//
// -----------------------------------------------------------------------------
// L'ORDRE, ET POURQUOI IL FINIT TOT
// -----------------------------------------------------------------------------
// L'ordre suit `HOME_VNEXT_SECTION_ORDER` du contrat :
//   en-tete · action (+ pourquoi + cycle) · semaine · forme · conseil · sortie
//
// L'avis de fiabilite (hors-ligne) n'est pas une section du contrat : c'est une
// qualification de tout ce qui suit, donc il se place juste sous l'en-tete,
// avant le premier chiffre.
//
// Chaque bloc DISPARAIT quand le ViewModel le met a `null`. Aucun emplacement
// reserve, aucune carte vide, aucun "—" a la place d'une valeur. Un joueur sans
// club, sans tendance et sans conseil obtient un ecran court et complet, pas un
// ecran a trous (doctrine 10).
//
// -----------------------------------------------------------------------------
// DEUX RAILS, PAS SEPT
// -----------------------------------------------------------------------------
// L'audit releve un rail de texte gauche qui flotte sur 7 valeurs. Ici il y en
// a exactement deux, tous deux derives du meme 16 :
//   - rail d'ecran (16 px du bord)  : en-tete, avis, aplat, pourquoi, lien,
//                                     cycle, conseil, sortie, bords des cartes ;
//   - rail de carte (32 px du bord) : tout le contenu a l'interieur d'une carte.
// =============================================================================

import React from "react";
import { StyleSheet, View } from "react-native";

import { Screen } from "../../components/ui/Screen";
import { HomeVNextActionBlock } from "../../components/homeVNext/HomeVNextAction";
import { HomeVNextDataNotice } from "../../components/homeVNext/HomeVNextDataNotice";
import { HomeVNextDemarrage } from "../../components/homeVNext/HomeVNextDemarrage";
import { HomeVNextExit } from "../../components/homeVNext/HomeVNextExit";
import { HomeVNextForm } from "../../components/homeVNext/HomeVNextForm";
import { HomeVNextHeader } from "../../components/homeVNext/HomeVNextHeader";
import { HomeVNextNote } from "../../components/homeVNext/HomeVNextNote";
import { HomeVNextProgression } from "../../components/homeVNext/HomeVNextProgression";
import { HomeVNextSkeleton } from "../../components/homeVNext/HomeVNextSkeleton";
import { HomeVNextWeek } from "../../components/homeVNext/HomeVNextWeek";
import { HomeVNextPresentation } from "../../components/homeVNext/homeVNextPresentation";
import type { EchelleTypoId } from "../../components/homeVNext/homeVNextTypo";
import { espacement } from "../../components/homeVNext/homeVNextTokens";
import type { ProgressionViewModel } from "./progressionViewModel";
import type { ActionTarget, HomeVNextViewModel } from "./viewModel";

// =============================================================================
// LES DEUX VARIANTES
// =============================================================================
//
// La variante 1 est celle que le fondateur a regardee et validee. Elle ne bouge
// pas d'un pixel : c'est le defaut, et elle reste rendable telle quelle pour que
// les deux puissent etre comparees cote a cote.
//
// La variante 2 ne change QUE le bas de l'ecran :
//   - le lien flottant "Voir ma progression" disparait ;
//   - la carte "MA PROGRESSION" prend la place de la carte "MA FORME", et le
//     lien devient son pied.
//
// POURQUOI LA CARTE REMPLACE AUSSI "MA FORME", et pas seulement le lien :
//
//   1. Les deux blocs sont alimentes par la MEME serie de points. L'adaptateur
//      de demonstration `progressionInputDepuisHome` (fixtures.ts) recopie
//      `HomeVNextInput.formTrend.points` dans l'entree de la carte. Les garder
//      tous les deux dessinerait deux fois la meme courbe sur un meme ecran.
//   2. `buildProgressionViewModel` le demande explicitement : il emet le
//      protoWarning "Composition : cette carte et le bloc Ma forme parlent tous
//      les deux de la tendance. En variante 2, un seul des deux doit rester a
//      l'ecran".
//   3. La carte contient tout ce que "MA FORME" contient — la courbe, sa portee,
//      sa periode — et en plus un fait mesure, une comparaison de test terrain
//      et l'acces au detail. Garder les deux, c'est garder le sous-ensemble.
//
// CE QUE CE CHOIX COUTE, et qui doit etre arbitre : le cas
// `form.reason === "reprise_en_cours"` de la variante 1 ("Ta forme sera de
// nouveau mesuree apres ta premiere seance de reprise") n'a AUCUN equivalent
// dans `ProgressionViewModel`, qui ne connait pas la notion de reprise. Apres une
// longue interruption, la variante 2 dit "Encore 3 jours enregistres" — honnete,
// mais moins precis. C'est signale dans le compte rendu.
// =============================================================================

/** Laquelle des deux propositions est rendue. */
export type HomeVNextVariante = "v1" | "v2";

/**
 * Ordre de rendu de la variante 2. A comparer avec `HOME_VNEXT_SECTION_ORDER`
 * (viewModel.ts) : "form" et "exit" y sont remplaces par une seule section.
 */
export const HOME_VNEXT_SECTION_ORDER_V2 = [
  "header",
  "action", // action + why + cycle forment UN bloc visuel
  "week",
  "progression", // absorbe "form" ET "exit"
  "note",
] as const;

// =============================================================================
// LES VARIANTES DE DEMARRAGE — L'ECRAN DU NOUVEAU JOUEUR
// =============================================================================
//
// L'ecran d'un compte neuf fait 399 px sur 729 visibles : en-tete, aplat,
// carte « Ta tendance se construit ». Rien d'autre, parce qu'il n'y a rien
// d'autre de vrai a dire. Decision du fondateur (03/08) : plus de presence,
// sans rien inventer.
//
// CE QUI CHANGE PAR RAPPORT A L'ECRAN ACTUEL
// -----------------------------------------------------------------------------
//   1. L'action passe en TRAITEMENT HERO (prop `hero` de `HomeVNextActionBlock`).
//      Elle ne gagne aucun mot : elle gagne un palier typographique, de l'air et
//      une hauteur plancher. Sur un compte neuf, elle EST le rang 1 de l'ecran.
//   2. Une carte de demarrage remplace « MA FORME ». Ce n'est pas un choix de
//      rendu : le ViewModel a deja mis `form` a `null` (§5.8 bis), parce que les
//      deux blocs disaient la meme chose.
//
// L'ORDRE, ET CE QU'IL A DE PARTICULIER
// -----------------------------------------------------------------------------
// Il est RIGOUREUSEMENT celui de la variante 1, a une substitution pres : la
// carte de demarrage prend la place exacte de « MA FORME ». Le joueur qui
// reviendra demain, sa premiere seance faite, retrouvera une section au meme
// endroit — pas un ecran qui s'est reorganise dans son dos.
//
// `week`, `note` et `exit` restent dans l'ordre et restent `null` : sur un
// compte a zero seance, le ViewModel les refuse deja tous les trois.
// =============================================================================

export const HOME_VNEXT_SECTION_ORDER_DEMARRAGE = [
  "header",
  "action", // en traitement hero
  "week", // toujours null a zero seance (§5.8)
  "demarrage", // prend la place de "form", que le ViewModel a mis a null
  "note", // toujours null a zero seance
  "exit", // toujours null a zero seance (§5.10)
] as const;

type HomeVNextScreenPropsCommunes = {
  /** Tout ce que l'ecran a le droit d'afficher. Seule entree. */
  vm: HomeVNextViewModel;
  /** Action principale. Sans callback : aucun effet. */
  onAction?: (target: ActionTarget) => void;
  /** Action secondaire (le lien sous l'aplat). */
  onSecondaryAction?: (target: ActionTarget) => void;
  /**
   * Ouverture de l'ecran Progression.
   * En variante 1 : le lien de sortie en bas d'ecran.
   * En variante 2 : le pied "Voir ma progression" de la carte progression.
   * Meme destination, donc un seul callback.
   */
  onExit?: (target: "progression") => void;
  /**
   * Largeur en pixels du trace de la courbe (de forme en v1, de progression
   * en v2).
   *
   * A NE PASSER QUE depuis un environnement qui rend l'ecran en une seule
   * passe, sans cycle de layout (rendu statique en chaine de caracteres,
   * capture serveur) : la longueur d'un segment oblique est une hypotenuse et
   * ne peut pas s'exprimer en pourcentage. Valeur attendue :
   * largeurDeL'appareil - 64 (marge d'ecran 16x2 + marge de carte 16x2).
   *
   * Dans l'app, ne rien passer : `onLayout` mesure tout seul.
   */
  largeurCourbe?: number;

  /**
   * Echelle typographique rendue.
   *
   * Defaut : `ECHELLE_PAR_DEFAUT` = « allegee », celle que le fondateur a
   * imposee. « actuelle » rend l'ecran exactement comme a l'iteration
   * precedente, pour la comparaison cote a cote. Les deux jeux vivent dans
   * `components/homeVNext/homeVNextTypo.ts` (`ECHELLES`).
   */
  echelle?: EchelleTypoId;

  /**
   * SURCHARGE du reglage « reduire les animations », pour les tests et le
   * visualiseur uniquement.
   *
   * En production on ne passe RIEN : `HomeVNextPresentation` lit alors le
   * reglage reel du telephone via `hooks/useReduceMotion`.
   *
   * Consequence a l'ecran quand il vaut `true` : plus AUCUN mouvement. L'action du jour reste
   * parfaitement identifiable — c'est le seul aplat colore de l'ecran — et son
   * enfoncement reste signale par un assombrissement.
   */
  reduceMotion?: boolean;
};

/**
 * Union discriminee volontaire : demander la variante 2 SANS fournir le
 * ViewModel de progression ne compile pas. Le rendu ne peut donc pas retomber
 * silencieusement sur la variante 1 en croyant rendre la 2.
 */
export type HomeVNextScreenProps = HomeVNextScreenPropsCommunes &
  (
    | { variante?: "v1" }
    | {
        variante: "v2";
        /** Le resume de progression, deja calcule par `buildProgressionViewModel`. */
        progression: ProgressionViewModel;
      }
  );

export function HomeVNextScreen(props: HomeVNextScreenProps) {
  const { vm, onAction, onSecondaryAction, onExit, largeurCourbe, echelle, reduceMotion } = props;
  const variante: HomeVNextVariante = props.variante ?? "v1";
  const progression = props.variante === "v2" ? props.progression : null;

  // ---------------------------------------------------------------------------
  // D1 — LE SECOND VERROU SUR LA PASTILLE D'ETAT
  // ---------------------------------------------------------------------------
  // Decision du fondateur (2026-07-28) : en variante 2, aucun jugement global sur
  // la forme du joueur. La regle est deja appliquee A LA SOURCE, dans
  // `buildHomeVNextViewModel(input, { variante: "v2" })` (§5.7) — c'est la que
  // vit la decision, et c'est la qu'elle est expliquee au visualiseur.
  //
  // POURQUOI LA REPETER ICI, alors que le principe du prototype est que l'ecran
  // n'affirme rien que le ViewModel n'ait autorise : parce que la variante est
  // declaree DEUX FOIS, a deux endroits qui ne se parlent pas — l'option du
  // ViewModel et cette prop. Un appelant qui construit son ViewModel sans
  // l'option et rend l'ecran avec `variante="v2"` obtient un ecran « Progression
  // integree » COIFFE D'UNE PASTILLE. Ce n'est pas theorique : plusieurs montages
  // de test faisaient exactement ca.
  //
  // Ce verrou ne fabrique rien et n'affirme rien : il RETIRE. C'est la seule
  // forme de decision qu'un composant a le droit de prendre sur du contenu, et
  // elle va toujours dans le sens de la prudence.
  const header = variante === "v2" ? { ...vm.header, stateChip: null } : vm.header;
  // `<Screen>` est la SEULE source de verite de la safe area (regle d'or du
  // projet). Aucun `SafeAreaView edges={...}`, aucun `paddingTop` magique,
  // aucune `StatusBar` locale : il n'y en a qu'une, globale, dans `App.tsx`.
  //
  // `HomeVNextPresentation` pose l'echelle typographique et le reglage de
  // mouvement pour tout le sous-arbre. Il est A L'INTERIEUR de `<Screen>` : ce
  // n'est pas un conteneur de mise en page, il ne rend aucun element, il ne
  // deplace donc rien.
  return (
    <Screen scroll contentContainerStyle={styles.contenu}>
      <HomeVNextPresentation echelle={echelle} reduceMotion={reduceMotion}>
        {vm.dataState === "hydrating" ? (
          <HomeVNextSkeleton />
        ) : (
          <>
            <HomeVNextHeader header={header} />

            {vm.dataNotice ? (
              <Section>
                <HomeVNextDataNotice notice={vm.dataNotice} />
              </Section>
            ) : null}

            <Section>
              <HomeVNextActionBlock
                action={vm.action}
                why={vm.why}
                cycle={vm.cycle}
                onAction={onAction}
                onSecondaryAction={onSecondaryAction}
                // Le traitement hero est commande PAR LA DONNEE, pas par une
                // prop de l'appelant : il n'apparait que quand le ViewModel a
                // reellement construit un bloc de demarrage. Impossible, donc,
                // de rendre un aplat hero sur un ecran qui a par ailleurs une
                // semaine, une tendance et un lien de sortie a montrer.
                hero={vm.demarrage !== null}
              />
            </Section>

            {vm.week ? (
              <Section>
                <HomeVNextWeek week={vm.week} />
              </Section>
            ) : null}

            {/*
              LE SEUL ENDROIT OU LES VARIANTES DIVERGENT — TROIS CAS, UN SEUL
              EMPLACEMENT.

              v2       : la carte progression, qui absorbe "MA FORME" et le lien
                         de sortie.
              demarrage: la carte de demarrage (V-A ou V-B), qui absorbe
                         "MA FORME" — decision prise A LA SOURCE, dans le
                         ViewModel (§5.8 bis), qui a deja mis `vm.form` a `null`.
              v1       : "MA FORME", inchangee.

              L'ecran n'arbitre donc rien : les trois branches sont mutuellement
              exclusives PAR LES DONNEES qu'il recoit, jamais par une condition
              qu'il inventerait.
            */}
            {progression !== null ? (
              <Section>
                <HomeVNextProgression
                  progression={progression}
                  onDetail={onExit}
                  largeurCourbe={largeurCourbe}
                />
              </Section>
            ) : vm.demarrage !== null ? (
              <Section>
                <HomeVNextDemarrage demarrage={vm.demarrage} />
              </Section>
            ) : vm.form ? (
              <Section>
                <HomeVNextForm form={vm.form} largeurCourbe={largeurCourbe} />
              </Section>
            ) : null}

            {vm.note ? (
              <Section>
                <HomeVNextNote note={vm.note} />
              </Section>
            ) : null}

            {/*
              Le lien de sortie n'existe QUE en variante 1. En variante 2 il n'a
              pas ete supprime : il a demenage dans le pied de la carte, ce qui est
              precisement la demande du fondateur.
            */}
            {variante === "v1" && vm.exit ? (
              <Section>
                <HomeVNextExit exit={vm.exit} onPress={onExit} />
              </Section>
            ) : null}
          </>
        )}
      </HomeVNextPresentation>
    </Screen>
  );
}

/**
 * Un seul rythme vertical entre les sections. Le Home de production en melange
 * trois (14 / 16 / 10) ; ici tout vient de `espacement.entreSections`.
 */
function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: espacement.ecranX,
    paddingTop: espacement.entreSections,
    // Respiration finale AVANT la tab bar. `<Screen>` a deja applique l'inset
    // bas (home indicator) ; ces 24 px s'ajoutent par-dessus. L'ecran finit net,
    // sans les 70 px de vide du Home actuel, et rien n'est coupe.
    paddingBottom: espacement.finDEcran,
  },
  section: {
    marginTop: espacement.entreSections,
  },
});
