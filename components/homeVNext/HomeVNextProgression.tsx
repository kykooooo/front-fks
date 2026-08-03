// components/homeVNext/HomeVNextProgression.tsx
// =============================================================================
// VARIANTE 2 — LA CARTE "MA PROGRESSION"
// =============================================================================
//
// Ce que cette carte remplace : le lien flottant "Voir ma progression" qui, en
// variante 1, se retrouve seul sous les cartes et parait ajoute apres coup. Ici
// il n'y a plus de lien orphelin — il y a une carte de contenu, et le lien
// devient le PIED de cette carte, sous un filet, a l'interieur de la meme
// surface.
//
// -----------------------------------------------------------------------------
// CE COMPOSANT NE DECIDE RIEN
// -----------------------------------------------------------------------------
// Tout vient de `ProgressionViewModel` :
//   - quels faits existent            -> `faits` (un fait inconnu n'y est pas)
//   - s'il y a une courbe             -> `courbe` (type `null` hors de "ready")
//   - si le pied a le droit d'exister -> `detail.affiche`
//   - ce que dit la portee            -> `courbe.portee`
// Le composant ne calcule aucun chiffre, n'accorde aucun pluriel, ne comble
// aucune absence. Il place, il ne juge pas.
//
// -----------------------------------------------------------------------------
// LE TITRE : "MA PROGRESSION"
// -----------------------------------------------------------------------------
// Le fondateur autorisait "Ma progression" ou "Ma tendance FKS". Retenu :
// "MA PROGRESSION", pour trois raisons.
//
//   1. La carte n'est pas qu'une tendance. Dans deux de ses trois etats il n'y a
//      AUCUNE tendance a l'ecran, et dans tous les etats elle peut porter une
//      comparaison de tests terrain — qui n'est pas une mesure de charge FKS
//      mais un chrono ou un metre. "Ma tendance FKS" serait faux sur ce contenu.
//   2. Le ViewModel parle deja cette langue ("TA PROGRESSION SE CONSTRUIT"), et
//      la destination du pied est l'ecran Progression. Un seul mot du haut en bas.
//   3. La voix reste celle du joueur, comme "MA SEMAINE" juste au-dessus. Les
//      titres du ViewModel disent "TA ..." (l'app parle au joueur) ; melanger
//      "MA SEMAINE" et "TA PROGRESSION" dans deux titres de section qui se
//      suivent ferait bafouiller l'ecran.
//
// R3 n'est PAS porte par le titre mais par la ligne de portee, imprimee sous la
// courbe a chaque fois qu'une courbe existe — exactement ou la variante 1 la
// place deja pour "MA FORME". Un titre ne peut pas qualifier une mesure qui
// n'est pas encore a l'ecran.
//
// -----------------------------------------------------------------------------
// ACCESSIBILITE : UN SEUL ELEMENT TACTILE, ET CE N'EST PAS LA CARTE
// -----------------------------------------------------------------------------
// Le fondateur autorisait la carte entiere pressable "si l'accessibilite reste
// claire". Elle ne le reste pas, et voici la mesure exacte du probleme.
//
// Rendre la carte pressable oblige a poser `accessible` sur son conteneur
// (`Pressable` le fait par defaut : `accessible: accessible !== false`). Or un
// conteneur `accessible` FUSIONNE tout son sous-arbre en UN seul noeud : les
// libelles internes sont ignores au profit du libelle du conteneur. Consequences
// mesurables sur cette carte :
//
//   - la ligne de PORTEE ("Calcule sur tes seances FKS uniquement — tes
//     entrainements club n'y sont pas comptes") cesse d'etre un element a part.
//     Soit on la noie dans un libelle unique de ~50 mots, soit on la perd. La
//     perdre viole R3 pour les utilisateurs de lecteur d'ecran ; la noyer rend
//     l'annonce inecoutable. R3 n'est pas negociable, donc l'option tombe.
//   - le libelle descriptif de la courbe, ecrit avec soin, disparait au profit
//     de celui du conteneur.
//   - les faits ne sont plus parcourables un par un : "76 min / Minutes
//     realisees" n'est plus un element, c'est un fragment de phrase.
//
// Et une carte pressable QUI CONTIENT un pied pressable serait un defaut franc
// (double annonce, cible ambigue, focus incoherent).
//
// D'ou la decision : LE PIED EST LE SEUL ELEMENT TACTILE.
//   - Il porte un libelle EXPLICITE — "Voir ma progression" — donc la demande du
//     fondateur (un lien qui dit, hors contexte, ce qu'il ouvre) est tenue.
//   - Il fait toute la largeur de la carte, `minHeight` 44 pt, plus un `hitSlop`
//     qui va chercher le padding bas de la carte : la cible est bien plus grande
//     que le lien de la variante 1, qui etait en `alignSelf: "flex-start"` et ne
//     faisait donc que la largeur de son texte.
//   - Le contenu reste parcourable element par element, la portee comprise.
//   - Il n'existe QUE dans l'etat "ready" : dans les deux autres, le ViewModel
//     met `detail.affiche` a `false` et il n'y a aucun element tactile du tout.
//     Aucun lien orphelin ne peut donc reapparaitre.
//
// Ce qui reste a l'oeil du fondateur : le pied est visuellement INTEGRE (meme
// surface, meme rayon, filet de separation), il ne flotte plus sous les cartes.
// C'est la plainte a laquelle la variante 2 repond.
//
// -----------------------------------------------------------------------------
// HIERARCHIE : AUCUN APLAT ICI
// -----------------------------------------------------------------------------
// Le seul aplat colore de l'ecran reste l'action du jour. Cette carte est une
// `Card variant="surface"`, comme "MA SEMAINE" : fond blanc, bordure d'un
// cheveu. Les deux seules couleurs qu'elle pose sont des TEINTES a 10 % sous du
// texte sombre (pastilles de reperes) et une couleur de TEXTE (le vert des
// progres) — jamais un fond colore sous du texte clair.
// =============================================================================

import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../constants/theme";
import type {
  ProgressionComparaisonTest,
  ProgressionDetail,
  ProgressionFait,
  ProgressionRepere,
  ProgressionSensTest,
  ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";
import { MARQUEURS } from "./homeVNextMarqueurs";
import { stylesParEchelle, usePressionAnimee, useStylesEchelle } from "./homeVNextPresentation";
import { CarteSection, Chevron, Filet } from "./HomeVNextPrimitives";
import { plafondDuRole, type EchelleTypo } from "./homeVNextTypo";
import { couleurs, espacement, TAILLE_TACTILE_MIN } from "./homeVNextTokens";
import { HomeVNextSparkline } from "./HomeVNextSparkline";

// -----------------------------------------------------------------------------
// Constantes de rendu
// -----------------------------------------------------------------------------

/** Titre de section, deja en capitales comme "MA SEMAINE" et "MA FORME". */
const TITRE_SECTION = "MA PROGRESSION";

/**
 * Le meme titre, en forme lisible a voix haute. Sert a composer le libelle vocal
 * du pied — et seulement quand celui-ci ne nomme pas deja sa destination.
 */
const TITRE_LISIBLE = "Ma progression";

/** Ou mene le pied. Une seule destination possible dans le contrat. */
const DESTINATION_DETAIL = "Ouvre ton écran de progression";

/**
 * Libelle vocal du pied.
 *
 * Le libelle du ViewModel nomme desormais sa destination (« Voir ma
 * progression ») : c'est la correction du defaut « deux liens, le meme texte,
 * deux destinations » — sur une journee ordinaire, le lien sous l'action du jour
 * ouvre la SEANCE et portait, lui aussi, « Voir le detail ».
 *
 * Consequence ici : prefixer systematiquement du titre de la carte donnerait
 * « Ma progression, Voir ma progression » — un begaiement a l'oreille pour zero
 * information de plus. On ne prefixe donc que si le libelle ne se suffit pas.
 * La demande du fondateur (un libelle explicite hors contexte) reste tenue dans
 * les deux cas : c'est la condition, pas le prefixe, qui compte.
 */
export function libelleVocalDuPied(label: string): string {
  const nommeDejaLaDestination = label.toLowerCase().includes(TITRE_LISIBLE.toLowerCase());
  return nommeDejaLaDestination ? label : `${TITRE_LISIBLE}, ${label}`;
}

/**
 * TEINTE DES PASTILLES DE REPERES — 10 % de `theme.colors.accent` (#2A4D8F)
 * sur la carte blanche, soit #EAEDF4.
 *
 * Ce n'est PAS un aplat : le texte pose dessus est l'accent lui-meme, sombre sur
 * clair. Contraste mesure avec la formule WCAG 2.1 (luminance relative apres
 * linearisation sRGB) : L(#2A4D8F) = 0.0778, L(#EAEDF4) = 0.8460, ratio =
 * (0.8460 + 0.05) / (0.0778 + 0.05) = **7.01:1**. Tres au-dessus du 4.5:1 exige.
 *
 * Precedent dans le prototype : `ACCUSE_PASTILLE` (`HomeVNextAction.tsx`) fait
 * exactement la meme chose avec le vert. `constants/theme.ts` n'est pas modifie.
 */
const REPERE_PASTILLE = "rgba(42,77,143,0.10)";

/**
 * Mot qui dit le SENS d'un ecart de test. Trois mots pour trois valeurs — jamais
 * une fleche : sur un sprint, mieux veut dire PLUS PETIT, et une fleche
 * descendante sur une amelioration est precisement l'ambiguite que
 * `screens/ProgressScreen.tsx` (:645-647) n'evite pas.
 */
const MOT_SENS: Record<ProgressionSensTest, string> = {
  amelioration: "en progrès",
  regression: "en retrait",
  identique: "identique",
};

/**
 * Couleur du sens. Le vert de reussite pour un progres ; RIEN pour un retrait.
 *
 * Volontairement PAS de rouge, et ce n'est pas de la complaisance : le chiffre,
 * lui, est imprime avec son signe exact dans les deux cas, et le ViewModel a
 * deja refuse de choisir la comparaison la plus flatteuse (il prend la plus
 * RECENTE). Ce qui change ici est l'emphase, pas le fait. Deux mesures espacees
 * de quelques semaines ne sont pas un verdict sur un joueur, et un chiffre rouge
 * en page d'accueil se lit comme un reproche — ce que la doctrine du prototype
 * interdit partout ailleurs.
 *
 * `theme.colors.success` (#15803D) mesure 5.02:1 sur la carte blanche : conforme
 * AA sans retouche.
 */
const COULEUR_SENS: Record<ProgressionSensTest, string> = {
  amelioration: theme.colors.success,
  regression: couleurs.texteSecondaire,
  identique: couleurs.texteSecondaire,
};

/**
 * Retire l'unite entre parentheses a la FIN d'un libelle de test, quand cette
 * unite est deja imprimee sur chacune des valeurs de la meme ligne.
 *
 * Sans ca, le bloc ecrit quatre fois "cm" en deux lignes :
 *   Saut en longueur (cm)        +9 cm
 *   218 cm → 227 cm            en progrès
 *
 * CE QUE CETTE FONCTION NE PEUT PAS FAIRE, par construction :
 *   - toucher un nombre, un signe, une unite affichee sur une VALEUR : elle ne
 *     recoit que le libelle ;
 *   - retirer autre chose que la chaine exacte ` (${unite})` en fin de libelle ;
 *   - agir quand l'unite est vide ("Goblet squat reps" reste entier) ;
 *   - agir quand le libelle ne se termine pas par cette parenthese ("1 km", dont
 *     l'unite canonique est "s", n'est pas touche).
 * Les 17 libelles de `FIELD_DEFS` ont ete relus un par un pour le verifier.
 *
 * L'unite reste lue trois fois dans le bloc (valeur avant, valeur apres, ecart).
 * Rien n'est cache : c'est une repetition qui saute, pas une information.
 */
export function libelleSansUniteRepetee(label: string, unite: string): string {
  if (unite.length === 0) return label;
  const suffixe = ` (${unite})`;
  return label.endsWith(suffixe) ? label.slice(0, -suffixe.length) : label;
}

// -----------------------------------------------------------------------------

export type HomeVNextProgressionProps = {
  /** Tout ce que la carte a le droit d'afficher. Seule entree. */
  progression: ProgressionViewModel;
  /**
   * Ouverture de l'ecran Progression depuis le pied. Sans callback, appuyer ne
   * fait rien : un prototype ne navigue pas.
   */
  onDetail?: (target: "progression") => void;
  /**
   * Largeur de trace imposee, en pixels. A ne passer que depuis un environnement
   * qui rend en une seule passe (voir `HomeVNextSparkline`). Dans l'app, ne rien
   * passer : `onLayout` mesure tout seul.
   */
  largeurCourbe?: number;
};

export function HomeVNextProgression({
  progression,
  onDetail,
  largeurCourbe,
}: HomeVNextProgressionProps) {
  // Aucun style lu a ce niveau : ce composant ne fait que placer ses trois etats
  // et son pied. Le seul texte qu'il rendait lui-meme etait l'etat physique
  // global, supprime par D1.
  //
  // La legende de droite ne dit la periode que lorsqu'une courbe la couvre
  // reellement. Pas de courbe, pas de periode : il n'y a rien a dater.
  const legende = progression.state === "ready" ? progression.courbe.periodeLabel : null;

  return (
    <CarteSection titre={TITRE_SECTION} legende={legende}>
      <View testID={MARQUEURS.progression}>
        {progression.state === "empty" ? <ContenuVide vm={progression} /> : null}
        {progression.state === "collecting" ? <ContenuEnCours vm={progression} /> : null}
        {progression.state === "ready" ? (
          <ContenuPret vm={progression} largeurCourbe={largeurCourbe} />
        ) : null}

        {/*
          R4 / D1 — AUCUN ETAT PHYSIQUE GLOBAL.
          Il n'y a plus rien a rendre ici, et ce n'est pas un oubli : le champ
          `etatGlobal` a ete SUPPRIME du ViewModel (§2 bis de
          progressionViewModel.ts). Ce composant ne peut donc plus ecrire « En
          forme » ou « Pret a performer », meme par accident — la donnee n'existe
          pas dans son type d'entree.
          Ce que la carte dit toujours, et qui n'est pas un jugement : la PORTEE
          de la courbe, sous le trace, qui nomme ce qui est compte et ce qui ne
          l'est pas.
        */}

        <PiedEventuel detail={progression.detail} onDetail={onDetail} />
      </View>
    </CarteSection>
  );
}

/**
 * Le pied n'existe QUE si le ViewModel l'autorise. La decision a ete prise dans
 * `progressionViewModel.ts` (champ `detail`, avec son `motif` renseigne dans les
 * deux sens) : ici on lit un verdict, on ne le rejoue pas.
 *
 * Les trois verifications ci-dessous ne sont pas trois regles, c'est UNE regle
 * plus le narrowing dont TypeScript a besoin pour prouver que `label` et
 * `target` ne sont pas nuls quand `affiche` vaut `true`.
 */
function PiedEventuel({
  detail,
  onDetail,
}: {
  detail: ProgressionDetail;
  onDetail?: (target: "progression") => void;
}) {
  if (!detail.affiche || detail.label === null || detail.target === null) return null;
  const target = detail.target;
  return <PiedDetail label={detail.label} onPress={() => onDetail?.(target)} />;
}

// =============================================================================
// ETAT 1 — "empty" : la progression demarre
// =============================================================================
// Compacte et utile : ce que le joueur va obtenir, dans l'ordre ou il va
// l'obtenir. Aucun graphique (le type l'interdit : `courbe` y vaut `null`),
// aucun compteur a zero, aucun aplat concurrent — "Choisir mon cycle" reste la
// seule action de l'ecran.
// =============================================================================

function ContenuVide({ vm }: { vm: Extract<ProgressionViewModel, { state: "empty" }> }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View>
      <Text style={styles.entete} numberOfLines={2}>
        {vm.titre}
      </Text>

      <View style={styles.reperes}>
        {vm.reperes.map((repere) => (
          <LigneRepere key={repere.numero} repere={repere} />
        ))}
      </View>

      <Text style={styles.mention} numberOfLines={2}>
        {vm.mention}
      </Text>
    </View>
  );
}

/** Un repere numerote. Noeud d'accessibilite a part : la liste se parcourt. */
function LigneRepere({ repere }: { repere: ProgressionRepere }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View
      style={styles.repereLigne}
      accessible
      accessibilityLabel={`Étape ${repere.numero} : ${repere.texte}`}
    >
      <View
        style={styles.pastille}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.pastilleTexte} numberOfLines={1}>
          {String(repere.numero)}
        </Text>
      </View>
      <Text
        style={styles.repereTexte}
        numberOfLines={2}
        importantForAccessibility="no-hide-descendants"
      >
        {repere.texte}
      </Text>
    </View>
  );
}

// =============================================================================
// ETAT 2 — "collecting" : des faits, pas encore de tendance
// =============================================================================
// La densite vient des FAITS, pas du decor : un releve de lignes, chacune un
// chiffre reellement mesure, separees d'un filet. Un fait dont la donnee manque
// n'est pas dans la liste — le ViewModel l'a deja retire (R1), la vue n'a donc
// aucun "0" ni "—" a rendre.
//
// CE QUI N'EST PAS AFFICHE, ET POURQUOI :
//
//   - `tendanceIndisponible.explication` ("Encore 2 seances avant d'afficher une
//     tendance.") n'est PAS rendu : le dernier fait de la liste dit deja
//     "Avant d'afficher une tendance / Encore 2 seances", mot pour mot les memes
//     mots dans l'autre ordre. Les deux ensemble, c'est la meme phrase deux fois
//     dans un espace de trois centimetres.
//
//   - la comparaison de tests n'est rendue ici QUE si elle existe reellement.
//     L'explication d'une comparaison impossible ("Tes tests terrain
//     apparaitront ici des que...") est tue dans cet etat : la carte porte deja
//     une ligne "voici ce qui manque". Deux "pas encore" a la suite reconstruisent
//     exactement la grande carte vide que la variante 2 doit supprimer.
//     En "ready", ou la carte est riche par ailleurs, l'explication est affichee.
// =============================================================================

function ContenuEnCours({ vm }: { vm: Extract<ProgressionViewModel, { state: "collecting" }> }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View>
      <Text style={styles.entete} numberOfLines={2}>
        {vm.titre}
      </Text>

      <Releve faits={vm.faits} />

      {/*
        UN SEUL repere de test, deja choisi par la regle du §5 bis du ViewModel
        (objectif du cycle actif, sinon mesure la plus recente, sinon ordre de
        departage fige). La vue ne choisit rien : elle n'a meme pas la liste.
      */}
      {vm.repereTest ? <BlocTest comparaison={vm.repereTest.comparaison} /> : null}
    </View>
  );
}

// =============================================================================
// ETAT 3 — "ready" : la tendance existe
// =============================================================================
// Le titre du ViewModel ("TA PROGRESSION") n'est PAS rendu comme entete dans cet
// etat : il repeterait mot pour mot le titre de section juste au-dessus. Dans
// les deux autres etats il porte une information que le titre de section n'a pas
// ("... DEMARRE ICI", "... SE CONSTRUIT"), donc il est rendu.
// =============================================================================

function ContenuPret({
  vm,
  largeurCourbe,
}: {
  vm: Extract<ProgressionViewModel, { state: "ready" }>;
  largeurCourbe?: number;
}) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View>
      <HomeVNextSparkline
        points={vm.courbe.points}
        largeur={largeurCourbe}
        // Descriptif, jamais interpretatif : on annonce ce qui est dessine et
        // sur quoi c'est calcule. Dire "en hausse" serait une affirmation
        // produite par la vue — or seul le ViewModel decide de ce que l'app a le
        // droit d'affirmer.
        accessibilityLabel={`Courbe de ta progression sur ${vm.courbe.periodeLabel}. ${vm.courbe.portee}`}
      />

      {/*
        R3 — la portee, en toutes lettres, sous la courbe. Element
        d'accessibilite A PART : un lecteur d'ecran doit pouvoir l'atteindre
        sans avoir a ecouter toute la carte.
      */}
      <Text
        style={styles.portee}
        numberOfLines={3}
        testID={MARQUEURS.progressionPortee}
      >
        {vm.courbe.portee}
      </Text>

      {/*
        LE CUMUL, EN LIGNE DE METADONNEE (demande du fondateur : « compacter,
        sans perdre le sens »). Voir `FaitCompact` pour ce que ce choix garde et
        ce qu'il coute.
      */}
      <FaitCompact fait={vm.resume} />

      {vm.repereTest ? (
        <BlocTest comparaison={vm.repereTest.comparaison} />
      ) : !vm.comparaisonsTests.possible ? (
        <>
          <Filet style={styles.filet} />
          {/*
            4 lignes et non 3. MESURE, pas prudence : a 375 px en texte x1,3,
            l'explication de `aucune_paire_comparable` (126 caracteres) demandait
            une 4e ligne et se faisait couper — 24 px de texte reellement caches,
            releves par le verificateur de la variante 2. Or cette phrase EST
            l'information : elle dit pourquoi aucun ecart n'est affiche. La
            couper laisse le joueur devant un "pas encore" sans raison.
            Le plafond reste pose (une phrase du contrat ne doit jamais pousser
            la carte sans limite), il est juste au bon endroit.
          */}
          <Text style={styles.explication} numberOfLines={4}>
            {vm.comparaisonsTests.explication}
          </Text>
        </>
      ) : null}
    </View>
  );
}

// =============================================================================
// LE RELEVE DE FAITS
// =============================================================================

/**
 * Un releve de lignes "libelle / valeur", separees d'un filet.
 *
 * Le composant ne formate rien : `libelle` et `valeur` arrivent deja accordes et
 * suffixes par le ViewModel ("76 min", "Séances terminées"). Il n'a donc aucune
 * facon d'inventer un chiffre.
 */
function Releve({ faits }: { faits: readonly ProgressionFait[] }) {
  const styles = useStylesEchelle(STYLES);
  if (faits.length === 0) return null;
  return (
    <View>
      {faits.map((fait, index) => (
        <View key={fait.cle}>
          {/* Filet AVANT chaque ligne : il separe la ligne de ce qui precede
              (entete ou ligne precedente), et jamais rien du vide. */}
          <Filet style={index === 0 ? styles.filet : styles.filetInterne} />
          <View
            style={styles.faitLigne}
            accessible
            accessibilityLabel={`${fait.libelle} : ${fait.valeur}`}
            testID={MARQUEURS.progressionFait}
          >
            <Text
              style={styles.faitLibelle}
              numberOfLines={2}
              importantForAccessibility="no-hide-descendants"
            >
              {fait.libelle}
            </Text>
            <Text
              style={styles.faitValeur}
              numberOfLines={2}
              importantForAccessibility="no-hide-descendants"
            >
              {fait.valeur}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * LE MEME FAIT, EN UNE LIGNE DE METADONNEE.
 *
 * Utilise dans le seul etat "ready", ou la carte porte deja une courbe, sa
 * portee, une comparaison de test et un pied. Le cumul y est un REPERE, pas le
 * contenu de la carte : il descend donc au rang de metadonnee, comme la portee
 * juste au-dessus. Dans l'etat "collecting", ou les faits SONT le contenu (il
 * n'y a ni courbe ni rien d'autre), ils gardent leur releve en lignes pleines.
 *
 * CE QUE CETTE FORME ECONOMISE, calcule sur les tokens (taille de texte normale,
 * libelle sur une ligne) :
 *   AVANT — filet : marge 12 (`espacement.interne`) + trait ~0,5 (hairline)
 *           ligne : marge 8 (`espacement.serre`) + `minHeight` 22 ....... 42,5 px
 *   APRES — ligne : marge 8 + hauteur de ligne 16 (palier `meta`) ....... 24,0 px
 *   soit ~18 px de moins.
 * Aucune zone tactile touchee, aucun mot retire : les deux seules choses que le
 * fondateur a interdites pour gagner de la hauteur. Le libelle, lui, s'ALLONGE
 * (« depuis tes débuts »).
 *
 * CE QU'ELLE NE CHANGE PAS :
 *   - le LIBELLE et la VALEUR restent deux textes distincts, ecrits par le
 *     ViewModel, affiches tels quels. Le composant ne compose aucune phrase, ne
 *     recalcule aucun accord, n'invente aucun chiffre ;
 *   - la ligne reste un noeud d'accessibilite a part, annonce « libelle :
 *     valeur », exactement comme la ligne de releve ;
 *   - elle garde le marqueur `progressionFait` : le compteur de faits du
 *     verificateur voit toujours une ligne, et R1 (« un fait sans donnee
 *     DISPARAIT ») reste verifiable de la meme facon.
 *
 * POURQUOI PAS DANS L'EN-TETE DE LA CARTE, l'autre emplacement autorise : la
 * legende de l'en-tete porte deja la periode de la courbe (« 7 derniers jours »)
 * et vit sur la ligne du titre. Y ajouter « 12 séances terminées depuis tes
 * débuts » ferait tronquer « MA PROGRESSION » des 375 px — et bien avant en
 * texte agrandi, puisque ni le titre ni la legende ne sont bornes en largeur.
 * Le gain de hauteur aurait ete paye par une troncature du titre.
 */
function FaitCompact({ fait }: { fait: ProgressionFait }) {
  const styles = useStylesEchelle(STYLES);
  return (
    <View
      style={styles.compactLigne}
      accessible
      accessibilityLabel={`${fait.libelle} : ${fait.valeur}`}
      testID={MARQUEURS.progressionFait}
    >
      <Text
        style={styles.compactLibelle}
        numberOfLines={2}
        importantForAccessibility="no-hide-descendants"
      >
        {fait.libelle}
      </Text>
      <Text
        style={styles.compactValeur}
        numberOfLines={1}
        importantForAccessibility="no-hide-descendants"
      >
        {fait.valeur}
      </Text>
    </View>
  );
}

// =============================================================================
// LA COMPARAISON DE TEST TERRAIN
// =============================================================================

/**
 * Une seule comparaison : la plus RECENTE, choisie par le ViewModel. La carte
 * n'en montre pas plus — la liste complete est precisement ce que la page
 * Progression apporte en plus, et c'est l'une des raisons pour lesquelles le
 * pied "Voir ma progression" existe dans cet etat.
 *
 * La fleche "→" est un caractere de texte ordinaire (aucune police d'icone dans
 * ce prototype), et elle n'est jamais lue : le bloc est un noeud
 * d'accessibilite unique dont le libelle dit "puis".
 */
function BlocTest({ comparaison }: { comparaison: ProgressionComparaisonTest }) {
  const styles = useStylesEchelle(STYLES);
  const mot = MOT_SENS[comparaison.sens];
  const couleur = COULEUR_SENS[comparaison.sens];
  const label = libelleSansUniteRepetee(comparaison.label, comparaison.unite);

  return (
    <>
      <Filet style={styles.filetInterne} />
      <View
        style={styles.test}
        accessible
        accessibilityLabel={`${label} : ${comparaison.avantAffiche} puis ${comparaison.apresAffiche}, soit ${comparaison.ecartAffiche}, ${mot}.`}
        testID={MARQUEURS.progressionTest}
      >
        <View style={styles.testLigne} importantForAccessibility="no-hide-descendants">
          <Text style={styles.testLabel} numberOfLines={2}>
            {label}
          </Text>
          <Text style={[styles.testEcart, { color: couleur }]} numberOfLines={1}>
            {comparaison.ecartAffiche}
          </Text>
        </View>
        <View style={styles.testLigne} importantForAccessibility="no-hide-descendants">
          <Text style={styles.testValeurs} numberOfLines={2}>
            {`${comparaison.avantAffiche} → ${comparaison.apresAffiche}`}
          </Text>
          <Text style={[styles.testSens, { color: couleur }]} numberOfLines={1}>
            {mot}
          </Text>
        </View>
      </View>
    </>
  );
}

// =============================================================================
// LE PIED "VOIR MA PROGRESSION"
// =============================================================================

/**
 * Le SEUL element tactile de la carte (voir l'en-tete du fichier).
 *
 * Toute la largeur, `minHeight` 44 pt, `hitSlop` qui va chercher le padding bas
 * de la carte. `accessibilityRole="link"` : c'est le role que le prototype a
 * deja choisi pour cette meme navigation en variante 1 (`HomeVNextLink`), et
 * deux roles differents pour une meme destination selon la variante rendraient
 * la comparaison des deux ecrans impossible a interpreter.
 */
function PiedDetail({ label, onPress }: { label: string; onPress?: () => void }) {
  const styles = useStylesEchelle(STYLES);
  // Animation partagee, declenchee par le doigt et par rien d'autre.
  const { pression, onPressIn, onPressOut } = usePressionAnimee();

  // Un estompement, pas un mouvement : conserve meme quand le joueur a demande
  // « reduire les animations » (le systeme lui-meme substitue des fondus aux
  // transitions glissees).
  const opacity = pression.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });

  return (
    <>
      <Filet style={styles.filetInterne} />
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="link"
        // LIBELLE EXPLICITE, demande par le fondateur : un lien doit dire, hors
        // contexte, ce qu'il ouvre.
        accessibilityLabel={libelleVocalDuPied(label)}
        accessibilityHint={DESTINATION_DETAIL}
        // La cible deborde jusqu'au bord bas de la carte, sans agrandir le bloc.
        hitSlop={{ top: 0, bottom: espacement.carte, left: espacement.carte, right: espacement.carte }}
        testID={MARQUEURS.progressionDetail}
        style={styles.pied}
      >
        <Animated.View
          style={[styles.piedContenu, { opacity }]}
          importantForAccessibility="no-hide-descendants"
        >
          {/* Libelle de destination : information, donc aucun plafond. */}
          <Text style={styles.piedTexte} numberOfLines={1} {...plafondDuRole("lien")}>
            {label}
          </Text>
          <Chevron color={couleurs.lien} size={7} thickness={1.8} />
        </Animated.View>
      </Pressable>
    </>
  );
}

// -----------------------------------------------------------------------------

const creerStyles = (t: EchelleTypo) =>
  StyleSheet.create({
    entete: {
      // Meme palier que "1 séance sur 2" dans Ma semaine et que "Ta tendance se
      // construit" dans Ma forme : une seule convention de titrage de contenu.
      ...t.valeur,
      color: couleurs.texte,
    },

    // --- Etat vide -----------------------------------------------------------
    reperes: {
      marginTop: espacement.interne,
      gap: espacement.serre,
    },
    repereLigne: {
      flexDirection: "row",
      alignItems: "center",
      gap: espacement.serre,
    },
    pastille: {
      // Element a taille intrinseque (comme la coche et la marque de l'entete de
      // section), pas une largeur de mise en page : rien ne peut deborder.
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: REPERE_PASTILLE,
      alignItems: "center",
      justifyContent: "center",
    },
    pastilleTexte: {
      // Petit label pose sur du contenu : 700 en allegee, contre 800 ecrit en
      // dur auparavant.
      ...t.metaAppuyee,
      color: couleurs.lien,
    },
    repereTexte: {
      ...t.corps,
      color: couleurs.texte,
      // Largeur en flex, jamais en px.
      flex: 1,
      minWidth: 0,
    },
    mention: {
      ...t.meta,
      color: couleurs.texteSecondaire,
      marginTop: espacement.interne,
    },

    // --- Releve de faits -----------------------------------------------------
    filet: {
      marginTop: espacement.interne,
    },
    filetInterne: {
      marginTop: espacement.serre,
    },
    faitLigne: {
      flexDirection: "row",
      // `center` et non `baseline` : le libelle peut passer a deux lignes quand la
      // valeur n'en fait qu'une ("Minutes réalisées (sur 2 séances chronométrées)"
      // face a "76 min"). Un alignement par la ligne de base laisserait alors la
      // valeur accrochee en haut ; centrer tient dans tous les cas de repli.
      // C'est aussi ce que fait deja `HomeVNextAction` pour sa rangee.
      alignItems: "center",
      justifyContent: "space-between",
      gap: espacement.interne,
      marginTop: espacement.serre,
      // `minHeight`, jamais `height` : la ligne doit pouvoir grandir si le systeme
      // agrandit le texte.
      minHeight: 22,
    },
    faitLibelle: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      flex: 1,
      minWidth: 0,
    },
    faitValeur: {
      ...t.valeur,
      color: couleurs.texte,
      textAlign: "right",
      // Garde-fou de largeur, en POURCENTAGE et non en pixels : certaines valeurs
      // sont des phrases ("Encore 2 jours enregistrés"). Sans plafond, elles
      // ecraseraient le libelle a 320 px de large.
      maxWidth: "56%",
    },

    // --- Comparaison de test -------------------------------------------------
    test: {
      marginTop: espacement.serre,
    },
    testLigne: {
      flexDirection: "row",
      // Meme raison que `faitLigne` : un nom d'exercice peut passer a deux lignes.
      alignItems: "center",
      justifyContent: "space-between",
      gap: espacement.interne,
    },
    testLabel: {
      ...t.corps,
      color: couleurs.texte,
      flex: 1,
      minWidth: 0,
    },
    testEcart: {
      ...t.valeur,
      textAlign: "right",
      maxWidth: "42%",
    },
    testValeurs: {
      ...t.meta,
      color: couleurs.texteSecondaire,
      flex: 1,
      minWidth: 0,
      marginTop: 2,
    },
    testSens: {
      ...t.meta,
      textAlign: "right",
      maxWidth: "42%",
      marginTop: 2,
    },

    explication: {
      ...t.corps,
      color: couleurs.texteSecondaire,
      marginTop: espacement.serre,
    },

    portee: {
      // R3 : la portee de la mesure. Information, jamais plafonnee.
      ...t.meta,
      color: couleurs.texteSecondaire,
      marginTop: espacement.serre,
    },

    // --- Le cumul, en ligne de metadonnee ------------------------------------
    compactLigne: {
      flexDirection: "row",
      // `center`, comme les autres rangees de la carte : le libelle peut passer a
      // deux lignes quand la valeur n'en fait qu'une.
      alignItems: "center",
      justifyContent: "space-between",
      gap: espacement.interne,
      marginTop: espacement.serre,
    },
    compactLibelle: {
      // Palier `meta`, celui de la portee juste au-dessus : les deux lignes
      // forment une seule zone de contexte sous la courbe.
      ...t.meta,
      color: couleurs.texteSecondaire,
      flex: 1,
      minWidth: 0,
    },
    compactValeur: {
      // Meme TAILLE que son libelle, graisse d'appui : le chiffre se trouve sans
      // que la ligne redevienne un titre. La distinction avec le compteur de
      // "Ma semaine" est portee par le libelle (« depuis tes débuts »), jamais
      // par la taille — c'est la consigne du fondateur, mot pour mot.
      ...t.emphaseMeta,
      color: couleurs.texte,
      textAlign: "right",
      // Garde-fou de largeur en POURCENTAGE : certaines valeurs sont des phrases
      // ("Encore 2 jours enregistrés").
      maxWidth: "56%",
    },

    // --- Pied ----------------------------------------------------------------
    pied: {
      // Plancher tactile. `minHeight`, jamais `height`.
      minHeight: TAILLE_TACTILE_MIN,
      justifyContent: "center",
      // Toute la largeur de la carte : la cible n'est plus un bout de texte perdu
      // a gauche, comme le lien flottant de la variante 1.
      alignSelf: "stretch",
    },
    piedContenu: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: espacement.serre,
    },
    piedTexte: {
      ...t.lien,
      color: couleurs.lien,
      flexShrink: 1,
    },
  });

const STYLES = stylesParEchelle(creerStyles);
