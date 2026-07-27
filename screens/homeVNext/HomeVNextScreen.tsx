// screens/homeVNext/HomeVNextScreen.tsx
// =============================================================================
// PROTOTYPE Home vNext — L'ECRAN
// =============================================================================
//
// PROTOTYPE destine a etre REGARDE et valide. Ce n'est pas le Home de
// production : `screens/HomeScreen.tsx` n'est pas touche, et cet ecran n'entre
// pas dans `navigation/RootNavigator.tsx`.
//
// -----------------------------------------------------------------------------
// CE QUE CET ECRAN NE FAIT PAS
// -----------------------------------------------------------------------------
// Il ne lit AUCUN store, n'appelle AUCUN hook metier, ne fait AUCUN fetch, ne
// declenche AUCUNE generation. Il recoit un `HomeVNextViewModel` en prop et le
// rend. C'est ce qui le rend affichable dans un visualiseur et testable sans
// monter la moitie de l'app — et c'est aussi ce qui garantit qu'il ne peut rien
// affirmer que le ViewModel n'ait pas deja autorise.
//
// Les actions sont des callbacks optionnels. Sans callback, appuyer ne fait
// rien : un prototype ne navigue pas.
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
import { HomeVNextExit } from "../../components/homeVNext/HomeVNextExit";
import { HomeVNextForm } from "../../components/homeVNext/HomeVNextForm";
import { HomeVNextHeader } from "../../components/homeVNext/HomeVNextHeader";
import { HomeVNextNote } from "../../components/homeVNext/HomeVNextNote";
import { HomeVNextSkeleton } from "../../components/homeVNext/HomeVNextSkeleton";
import { HomeVNextWeek } from "../../components/homeVNext/HomeVNextWeek";
import { espacement } from "../../components/homeVNext/homeVNextTokens";
import type { ActionTarget, HomeVNextViewModel } from "./viewModel";

export type HomeVNextScreenProps = {
  /** Tout ce que l'ecran a le droit d'afficher. Seule entree. */
  vm: HomeVNextViewModel;
  /** Action principale. Sans callback : aucun effet. */
  onAction?: (target: ActionTarget) => void;
  /** Action secondaire (le lien sous l'aplat). */
  onSecondaryAction?: (target: ActionTarget) => void;
  /** Lien de sortie en bas d'ecran. */
  onExit?: (target: "progression") => void;
  /**
   * Largeur en pixels du trace de la courbe de forme.
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
};

export function HomeVNextScreen({
  vm,
  onAction,
  onSecondaryAction,
  onExit,
  largeurCourbe,
}: HomeVNextScreenProps) {
  // `<Screen>` est la SEULE source de verite de la safe area (regle d'or du
  // projet). Aucun `SafeAreaView edges={...}`, aucun `paddingTop` magique,
  // aucune `StatusBar` locale : il n'y en a qu'une, globale, dans `App.tsx`.
  return (
    <Screen scroll contentContainerStyle={styles.contenu}>
      {vm.dataState === "hydrating" ? (
        <HomeVNextSkeleton />
      ) : (
        <>
          <HomeVNextHeader header={vm.header} />

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
            />
          </Section>

          {vm.week ? (
            <Section>
              <HomeVNextWeek week={vm.week} />
            </Section>
          ) : null}

          {vm.form ? (
            <Section>
              <HomeVNextForm form={vm.form} largeurCourbe={largeurCourbe} />
            </Section>
          ) : null}

          {vm.note ? (
            <Section>
              <HomeVNextNote note={vm.note} />
            </Section>
          ) : null}

          {vm.exit ? (
            <Section>
              <HomeVNextExit exit={vm.exit} onPress={onExit} />
            </Section>
          ) : null}
        </>
      )}
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
