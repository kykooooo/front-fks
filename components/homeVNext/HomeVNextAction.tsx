// components/homeVNext/HomeVNextAction.tsx
// =============================================================================
// SECTION 2 — LE BLOC D'ACTION (action + pourquoi + repere de cycle)
// =============================================================================
//
// Le ViewModel impose deja qu'il n'y ait QU'UNE action (`action` est un objet,
// jamais un tableau). Ce composant impose la contrepartie visuelle :
//
//   - un SEUL aplat colore sur tout l'ecran, et c'est celui-la ;
//   - l'action secondaire est un lien texte, jamais un aplat concurrent
//     (l'audit releve un "Historique" blanc plein qui pese plus lourd que le
//     "Voir la seance" en contour juste a cote) ;
//   - le repere de cycle n'est PAS tapable : le ViewModel ne lui donne aucune
//     destination, on n'en invente pas une, et l'ecran evite ainsi une seconde
//     cible tactile a cote du CTA.
//
// LE "POURQUOI" EST SOUS L'APLAT, PAS DEDANS.
// Le wireframe de l'audit le placait a l'interieur du rectangle orange. Deux
// raisons de le sortir : du texte long en blanc sur orange se lit moins bien
// que du texte sombre sur fond clair ; et l'aplat reste compact (76 px), ce qui
// laisse la carte "Ma semaine" au-dessus de la ligne de flottaison.
//
// POURQUOI PAS `components/ui/Button` POUR L'APLAT :
//   1. `Button` n'accepte qu'un `label: string` et rend un seul `Text` — il n'a
//      aucun emplacement pour le sous-titre, qui porte ici l'identite de la
//      seance ("Force bas du corps · 45 min · Modérée").
//   2. `variant="primary"` code en dur `theme.colors.cta` (#F2741B), soit le
//      2.88:1 mesure en P1.17 — precisement le defaut a corriger.
//   3. `Button` force `borderRadius: theme.radius.pill`, incompatible avec un
//      bloc de deux lignes.
// Le plancher tactile est tenu autrement : l'aplat fait au minimum 76 pt de
// haut, soit bien au-dela des 44 pt exiges.
// =============================================================================

import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../constants/theme";
import type {
  ActionTarget,
  CycleBlock,
  HomeVNextAction as ActionData,
  WhyLine,
  WhySource,
} from "../../screens/homeVNext/viewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { Chevron, Coche, Filet, HomeVNextLink } from "./HomeVNextPrimitives";
import { couleurs, espacement, rayons, typo } from "./homeVNextTokens";

// -----------------------------------------------------------------------------
// Textes de rendu
// -----------------------------------------------------------------------------

/**
 * Ou mene vraiment l'action — annonce vocalement.
 *
 * L'audit (§3.5) montre que le CTA actuel ment sur sa destination : "Préparer
 * ma séance / On te prépare un programme adapté en 2 min" ouvre en realite un
 * menu de 4 tuiles, et parfois le choix de cycle. Ici la destination vient du
 * champ `target` du ViewModel, donc elle ne peut pas diverger du libelle.
 */
const DESTINATION: Record<ActionTarget, string | undefined> = {
  session_live: "Ouvre ta séance",
  session_preview: "Ouvre le détail de la séance",
  generation: "Ouvre la préparation de séance",
  choix_cycle: "Ouvre le choix de cycle",
  feedback: "Ouvre ton retour de séance",
  aucune: undefined,
};

/**
 * Prefixe de la ligne "pourquoi", choisi d'apres la SOURCE de la phrase.
 *
 * `match_proche` n'en recoit aucun : "Tu as noté un match demain." n'est pas la
 * raison d'une seance (dans cet etat, aucune seance n'existe encore). Coller
 * "Pourquoi :" devant en ferait une justification inventee — exactement ce que
 * la doctrine 4 interdit.
 */
const PREFIXE_POURQUOI: Record<WhySource, string | null> = {
  session_theme: "Pourquoi : ",
  player_context: "Pourquoi : ",
  rationale: "Pourquoi : ",
  match_proche: null,
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Teinte de la confirmation : le vert du theme, tres dilue.
 * Le texte de la carte reste sombre — #141A24 mesure a 14.6:1 sur la carte
 * teintee, le secondaire #586374 a 5.09:1. C'est une TEINTE, pas un aplat
 * (texte sombre sur fond clair), donc la regle "un seul aplat colore" tient.
 */
const ACCUSE_PASTILLE = "rgba(21,128,61,0.12)";
const ACCUSE_FOND = "rgba(21,128,61,0.08)";
const ACCUSE_BORDURE = "rgba(21,128,61,0.22)";

// -----------------------------------------------------------------------------

export type HomeVNextActionProps = {
  action: ActionData;
  why: WhyLine | null;
  cycle: CycleBlock;
  onAction?: (target: ActionTarget) => void;
  onSecondaryAction?: (target: ActionTarget) => void;
};

export function HomeVNextActionBlock({
  action,
  why,
  cycle,
  onAction,
  onSecondaryAction,
}: HomeVNextActionProps) {
  const secondaire = action.secondary;
  const gapFilet = secondaire ? espacement.serre : espacement.interne;

  return (
    <View style={styles.groupe}>
      {action.emphasis === "aplat" ? (
        <Aplat action={action} onPress={() => onAction?.(action.target)} />
      ) : (
        <AccuseReception action={action} />
      )}

      {why ? <LignePourquoi why={why} /> : null}

      {secondaire ? (
        <HomeVNextLink
          label={secondaire.label}
          onPress={() => onSecondaryAction?.(secondaire.target)}
          accessibilityHint={DESTINATION[secondaire.target]}
          testID={MARQUEURS.lienSecondaire}
          style={styles.lienSecondaire}
        />
      ) : null}

      {cycle ? (
        <>
          <Filet style={{ marginTop: gapFilet }} />
          <RepereCycle cycle={cycle} />
        </>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// L'aplat — le seul de l'ecran
// -----------------------------------------------------------------------------

function Aplat({ action, onPress }: { action: ActionData; onPress: () => void }) {
  // `useState` paresseux plutot que `useRef(...).current` : meme stabilite, sans
  // lire un ref pendant le rendu (regle `react-hooks/refs`).
  const [anim] = React.useState(() => new Animated.Value(0));

  const enfoncer = () =>
    Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  const relacher = () =>
    Animated.timing(anim, { toValue: 0, duration: 100, useNativeDriver: true }).start();

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const voileOpacite = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] });

  // Un seul noeud d'accessibilite pour tout le bloc : libelle et sous-titre sont
  // lus ensemble, comme un footballeur les lit — pas en deux arrets separes.
  const annonce = action.sublabel ? `${action.label}. ${action.sublabel}` : action.label;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={enfoncer}
        onPressOut={relacher}
        accessibilityRole="button"
        accessibilityLabel={annonce}
        accessibilityHint={DESTINATION[action.target]}
        // Deux marqueurs, deux questions differentes :
        //   `testID`   -> "combien d'emplacements d'action sur cet ecran ?" (1)
        //   `nativeID` -> "combien d'aplats colores ?" (1 au plus)
        testID={MARQUEURS.actionPrincipale}
        nativeID={MARQUEURS.aplat}
        style={styles.aplat}
      >
        <Animated.View style={[styles.voilePression, { opacity: voileOpacite }]} />
        <View style={styles.aplatContenu} importantForAccessibility="no-hide-descendants">
          <View style={styles.aplatTextes}>
            <Text style={styles.aplatLabel} numberOfLines={2}>
              {action.label}
            </Text>
            {action.sublabel ? (
              // Contenu backend (titre de seance) -> borne, toujours.
              <Text style={styles.aplatSousTitre} numberOfLines={2}>
                {action.sublabel}
              </Text>
            ) : null}
          </View>
          <Chevron color={couleurs.texteSurAction} size={10} thickness={2.5} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// L'accuse de reception — la journee est faite
// -----------------------------------------------------------------------------

/**
 * Pas de bouton gris desactive (defaut E3 de l'audit) : un bouton mort occupe
 * la place sans rien offrir. Ici la place sert a confirmer ce qui a ete fait.
 *
 * Ce bloc n'est PAS tapable : le ViewModel donne `target: "aucune"`. Le rendre
 * pressable ouvrirait une destination que le contrat ne fournit pas.
 */
function AccuseReception({ action }: { action: ActionData }) {
  const annonce = action.sublabel
    ? `Fait. ${action.label}. ${action.sublabel}`
    : `Fait. ${action.label}`;

  return (
    <View
      style={styles.accuse}
      accessible
      accessibilityLabel={annonce}
      // Meme emplacement d'action que l'aplat — d'ou le meme `testID` : le
      // compteur "une seule action principale" doit valoir 1 ici aussi.
      testID={MARQUEURS.actionPrincipale}
      nativeID={MARQUEURS.accuseReception}
    >
      <Coche color={theme.colors.success} background={ACCUSE_PASTILLE} />
      <View style={styles.accuseTextes} importantForAccessibility="no-hide-descendants">
        <Text style={styles.accuseLabel} numberOfLines={2}>
          {action.label}
        </Text>
        {action.sublabel ? (
          <Text style={styles.accuseSousTitre} numberOfLines={2}>
            {action.sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// La ligne "pourquoi"
// -----------------------------------------------------------------------------

function LignePourquoi({ why }: { why: WhyLine }) {
  const prefixe = PREFIXE_POURQUOI[why.source];
  return (
    <Text
      style={styles.pourquoi}
      numberOfLines={3}
      accessibilityLabel={prefixe ? `${prefixe}${why.text}` : why.text}
    >
      {prefixe ? <Text style={styles.pourquoiPrefixe}>{prefixe}</Text> : null}
      {why.text}
    </Text>
  );
}

// -----------------------------------------------------------------------------
// Le repere de cycle
// -----------------------------------------------------------------------------

function RepereCycle({ cycle }: { cycle: NonNullable<CycleBlock> }) {
  if (cycle.kind === "en_pause") {
    // Variante SANS libelle de phase : apres une interruption longue, l'ecran ne
    // peut pas affirmer une montee en charge qui n'a pas eu lieu. C'est l'etat
    // E6 de l'audit ("Montée en puissance" affiche apres 24 jours d'arret).
    const pause = `${cycle.cycleLabel} · en pause depuis ${pluriel(cycle.pausedDays, "jour")}`;
    const reprise = `Tu en étais à la séance ${cycle.sessionNumber} sur ${cycle.totalSessions}.`;
    return (
      <View style={styles.cycle} accessible accessibilityLabel={`${pause}. ${reprise}`}>
        <Text style={styles.cycleTexte} numberOfLines={2}>
          <Text style={styles.cycleLabel}>{cycle.cycleLabel}</Text>
          {` · en pause depuis ${pluriel(cycle.pausedDays, "jour")}`}
        </Text>
        <Text style={styles.cycleTexteSecondaire} numberOfLines={2}>
          {reprise}
        </Text>
      </View>
    );
  }

  const suite = ` · Séance ${cycle.sessionNumber} sur ${cycle.totalSessions} · ${cycle.phaseLabel}`;
  return (
    <View style={styles.cycle} accessible accessibilityLabel={`${cycle.cycleLabel}${suite}`}>
      <Text style={styles.cycleTexte} numberOfLines={2}>
        <Text style={styles.cycleLabel}>{cycle.cycleLabel}</Text>
        {suite}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  groupe: {
    // Action + pourquoi + cycle forment UN bloc visuel (HOME_VNEXT_SECTION_ORDER).
    width: "100%",
  },

  aplat: {
    backgroundColor: couleurs.action,
    borderRadius: rayons.carte,
    padding: espacement.carte,
    // `minHeight`, jamais `height` : si le systeme agrandit le texte, le bloc
    // grandit au lieu de couper.
    minHeight: 76,
    justifyContent: "center",
    overflow: "hidden",
    ...theme.shadow.soft,
  },
  voilePression: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    // Dans le style, pas en prop : la prop `pointerEvents` est depreciee.
    pointerEvents: "none",
  },
  aplatContenu: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacement.interne,
  },
  aplatTextes: {
    // Largeur en flex, jamais en px : le `width: 140` du Home actuel fait
    // deborder le bouton voisin a 320 px.
    flex: 1,
    minWidth: 0,
  },
  aplatLabel: {
    ...typo.actionLabel,
    // Blanc PLEIN. Sur #B4530C, du blanc a 90 % retombe a 4.39:1.
    color: couleurs.texteSurAction,
  },
  aplatSousTitre: {
    ...typo.body,
    color: couleurs.texteSurAction,
    marginTop: 4,
    // La hierarchie se fait par la taille et la graisse (17/800 vs 13/600),
    // jamais par la transparence.
  },

  accuse: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacement.interne,
    backgroundColor: ACCUSE_FOND,
    borderWidth: 1,
    borderColor: ACCUSE_BORDURE,
    borderRadius: rayons.carte,
    padding: espacement.carte,
    minHeight: 76,
  },
  accuseTextes: {
    flex: 1,
    minWidth: 0,
  },
  accuseLabel: {
    ...typo.actionLabel,
    color: couleurs.texte,
  },
  accuseSousTitre: {
    ...typo.body,
    color: couleurs.texteSecondaire,
    marginTop: 4,
  },

  pourquoi: {
    ...typo.body,
    color: couleurs.texte,
    marginTop: espacement.interne,
  },
  pourquoiPrefixe: {
    fontWeight: "800",
    color: couleurs.texte,
  },

  lienSecondaire: {
    marginTop: espacement.serre,
  },

  cycle: {
    marginTop: espacement.interne,
  },
  cycleTexte: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
  },
  cycleLabel: {
    fontWeight: "700",
    color: couleurs.texte,
  },
  cycleTexteSecondaire: {
    ...typo.caption,
    color: couleurs.texteSecondaire,
    marginTop: 2,
  },
});
