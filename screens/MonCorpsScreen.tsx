// screens/MonCorpsScreen.tsx
// =============================================================================
// « MON CORPS » — LE SEUL ENDROIT OU UNE GENE SE DECLARE ET SE MET A JOUR
// =============================================================================
//
// CE QUE CET ECRAN REPARE
// -----------------------------------------------------------------------------
// Avant lui, une blessure ne pouvait se declarer QUE dans le feedback de fin de
// seance, et donc ne pouvait plus se corriger des qu'aucune seance n'etait
// validable : le joueur bloque restait bloque (DESIGN_MON_CORPS.md §T2). Il ne
// pouvait pas non plus en declarer deux le meme jour (§T5), ni supprimer quoi
// que ce soit (§2.8 point 2). Tout ca existe ici.
//
// CE QUE CET ECRAN NE FAIT JAMAIS
// -----------------------------------------------------------------------------
// Nommer une pathologie, estimer un delai de retour, dire si c'est grave,
// comparer a d'autres joueurs (charte INJURY_IA_CHARTER). Il n'affiche aucun
// compteur (« 0 blessure », « 4 genes cette saison ») : un chiffre faux qui a
// l'air vrai est pire que pas de chiffre. Il n'affiche pas non plus un nombre
// de jours : la relance POSE UNE QUESTION, elle ne recite pas un decompte.
//
// SOCLE VISUEL (CLAUDE.md regle 13)
// -----------------------------------------------------------------------------
// `<Screen>` seul maitre de la safe area, aucune `SafeAreaView edges`, aucune
// `StatusBar` locale, `minHeight` jamais `height`, `numberOfLines` sur la note
// libre (contenu saisi, longueur non maitrisee). Animations conditionnees a
// `useReduceMotion`. Haptique via `useHaptics()` — et RIEN DE FESTIF sur un
// geste de sante : `impactLight`, jamais `success()`.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";

import { Screen } from "../components/ui/Screen";
import { theme } from "../constants/theme";
import {
  AVERTISSEMENT_ZONE_AUTRE,
  BODY_AREAS,
  LIBELLE_GRAVITE,
  LIBELLE_ZONE,
  LIGNE_STOCKAGE_LOCAL,
} from "../domain/monCorps/zones";
import type { BodyArea, BodyInjurySeverity, BodyInjurySource } from "../domain/types";
import { useHaptics } from "../hooks/useHaptics";
import { useReduceMotion } from "../hooks/useReduceMotion";
import {
  ajouterGene,
  changerGraviteBlessure,
  changerStatutBlessure,
  supprimerGene,
} from "../hooks/monCorps/monCorpsActions";
import { useMonCorpsViewModel, type LigneGene } from "../hooks/monCorps/useMonCorpsViewModel";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { showToast } from "../utils/toast";

const C = theme.colors;

// Plafonds d'agrandissement : SEULS les textes d'affichage sont bornes (titres
// de section, libelles de puces). Tout ce qui porte une information — la zone,
// la gravite, la date, la note du joueur — grandit sans limite. C'est la meme
// politique que `components/homeVNext/homeVNextTypo.ts`.
const PLAFOND_TITRE = 1.2;
const PLAFOND_PUCE = 1.3;

const NOTE_MAX = 140;

// --- Une carte de gêne ------------------------------------------------------

function CarteGene({
  ligne,
  onStatut,
  onGravite,
  onSupprimer,
}: {
  ligne: LigneGene;
  onStatut: (id: string, statut: "active" | "recovering" | "healed") => void;
  onGravite: (id: string, gravite: BodyInjurySeverity) => void;
  onSupprimer: (id: string, zoneLabel: string) => void;
}) {
  return (
    <View style={[styles.carte, ligne.aRelancer && styles.carteRelance]}>
      <View style={styles.carteEnTete}>
        <Text style={styles.carteZone}>{ligne.zoneLabel}</Text>
        {ligne.statut === "recovering" ? (
          <View style={styles.pastille}>
            <Text style={styles.pastilleTexte} maxFontSizeMultiplier={PLAFOND_PUCE}>
              En reprise
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.carteMeta}>
        {[ligne.graviteLabelCourt, ligne.dateRelative, ligne.sourceLabel]
          .filter(Boolean)
          .join(" · ")}
      </Text>

      {ligne.note ? (
        <Text style={styles.carteNote} numberOfLines={3}>
          « {ligne.note} »
        </Text>
      ) : null}

      {ligne.aRelancer ? (
        <Text style={styles.relanceTexte}>Toujours gênant ?</Text>
      ) : null}

      <Text style={styles.sousTitreAction}>Où en es-tu ?</Text>
      <View style={styles.rangeeBoutons}>
        {(
          [
            ["active", "Toujours là"],
            ["recovering", "En reprise"],
            ["healed", "C'est guéri"],
          ] as const
        ).map(([statut, libelle]) => (
          <TouchableOpacity
            key={statut}
            style={[styles.puce, ligne.statut === statut && styles.puceActive]}
            onPress={() => onStatut(ligne.id, statut)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              statut === "healed"
                ? `Marquer la gêne ${ligne.zoneLabel} comme guérie`
                : statut === "recovering"
                  ? `Marquer la gêne ${ligne.zoneLabel} comme en reprise`
                  : `Marquer la gêne ${ligne.zoneLabel} comme toujours là`
            }
          >
            <Text
              style={[styles.puceTexte, ligne.statut === statut && styles.puceTexteActive]}
              maxFontSizeMultiplier={PLAFOND_PUCE}
            >
              {libelle}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sousTitreAction}>À quel point ?</Text>
      <View style={styles.rangeeBoutons}>
        {([1, 2, 3] as BodyInjurySeverity[]).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.puce, ligne.gravite === g && styles.puceActive]}
            onPress={() => onGravite(ligne.id, g)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Régler la gêne ${ligne.zoneLabel} sur : ${LIBELLE_GRAVITE[g]}`}
          >
            <Text
              style={[styles.puceTexte, ligne.gravite === g && styles.puceTexteActive]}
              maxFontSizeMultiplier={PLAFOND_PUCE}
            >
              {LIBELLE_GRAVITE[g]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.lienSupprimer}
        onPress={() => onSupprimer(ligne.id, ligne.zoneLabel)}
        hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer définitivement la gêne ${ligne.zoneLabel}`}
      >
        <Text style={styles.lienSupprimerTexte}>Supprimer</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- L'écran ----------------------------------------------------------------

export default function MonCorpsScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "MonCorps">>();
  const vm = useMonCorpsViewModel();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();

  const sourceParDefaut: BodyInjurySource = route.params?.source ?? "manual";
  const [formulaireOuvert, setFormulaireOuvert] = useState<boolean>(
    Boolean(route.params?.ouvrirAjout)
  );
  const [zone, setZone] = useState<BodyArea | null>(null);
  const [gravite, setGravite] = useState<BodyInjurySeverity | null>(null);
  const [note, setNote] = useState("");
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);

  // Apparition du formulaire : une seule opacité, jamais de stagger, et rien du
  // tout si le système demande de réduire les animations.
  // `useMemo` et non `useRef(...).current` : lire `.current` pendant le rendu
  // est exactement ce que la regle react-hooks/refs interdit, et cet ecran est
  // neuf — pas la peine d'y importer une dette qui existe ailleurs.
  const apparition = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (!formulaireOuvert) return;
    if (reduceMotion) {
      apparition.setValue(1);
      return;
    }
    Animated.timing(apparition, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [formulaireOuvert, reduceMotion, apparition]);

  const reinitialiserFormulaire = useCallback(() => {
    setZone(null);
    setGravite(null);
    setNote("");
  }, []);

  const onStatut = useCallback(
    (id: string, statut: "active" | "recovering" | "healed") => {
      haptics.impactLight();
      changerStatutBlessure(id, statut);
      showToast({
        type: "info",
        title: "C'est noté",
        message:
          statut === "healed"
            ? "FKS ne tiendra plus compte de cette gêne."
            : statut === "recovering"
              ? "FKS ménagera cette zone sans brider toute la séance."
              : "FKS continue d'adapter tes séances.",
      });
    },
    [haptics]
  );

  const onGravite = useCallback(
    (id: string, valeur: BodyInjurySeverity) => {
      haptics.impactLight();
      changerGraviteBlessure(id, valeur);
    },
    [haptics]
  );

  const onSupprimer = useCallback(
    (id: string, zoneLabel: string) => {
      haptics.impactLight();
      supprimerGene(id);
      showToast({
        type: "info",
        title: "Supprimée",
        message: `La gêne « ${zoneLabel} » a été effacée de ton téléphone.`,
      });
    },
    [haptics]
  );

  const onEnregistrer = useCallback(() => {
    if (!zone || !gravite) return;
    haptics.impactLight();
    ajouterGene({ zone, gravite, source: sourceParDefaut, note });
    reinitialiserFormulaire();
    setFormulaireOuvert(false);
    showToast({
      type: "info",
      title: "Gêne enregistrée",
      message: "FKS en tiendra compte dès ta prochaine séance.",
    });
  }, [zone, gravite, note, sourceParDefaut, haptics, reinitialiserFormulaire]);

  const peutEnregistrer = zone !== null && gravite !== null;

  return (
    <Screen scroll contentContainerStyle={styles.contenu}>
      <Text style={styles.intro}>
        Dis-nous où ça coince : FKS écarte les exercices qui sollicitent la zone et
        allège l'intensité tant que c'est nécessaire.
      </Text>

      {/* ÉTAT VIDE — une phrase, pas un zéro (CLAUDE.md règle 12). */}
      {vm.vide ? (
        <View style={styles.blocVide}>
          <Text style={styles.videTitre} maxFontSizeMultiplier={PLAFOND_TITRE}>
            Aucune gêne déclarée
          </Text>
          <Text style={styles.videTexte}>
            Si une gêne apparaît, dis-le ici : FKS adaptera tes séances.
          </Text>
        </View>
      ) : null}

      {vm.enCours.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitre} maxFontSizeMultiplier={PLAFOND_TITRE}>
            Ce qui gêne en ce moment
          </Text>
          {vm.enCours.map((ligne) => (
            <CarteGene
              key={ligne.id}
              ligne={ligne}
              onStatut={onStatut}
              onGravite={onGravite}
              onSupprimer={onSupprimer}
            />
          ))}
        </View>
      ) : null}

      {/* AJOUT */}
      {formulaireOuvert ? (
        <Animated.View style={[styles.formulaire, { opacity: apparition }]}>
          <Text style={styles.sectionTitre} maxFontSizeMultiplier={PLAFOND_TITRE}>
            Signaler une gêne
          </Text>

          <Text style={styles.champLabel}>Où ?</Text>
          <View style={styles.rangeeBoutons}>
            {BODY_AREAS.map((z) => (
              <TouchableOpacity
                key={z}
                style={[styles.puce, zone === z && styles.puceActive]}
                onPress={() => {
                  haptics.impactLight();
                  setZone(z);
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Zone : ${LIBELLE_ZONE[z]}`}
                accessibilityState={{ selected: zone === z }}
              >
                <Text
                  style={[styles.puceTexte, zone === z && styles.puceTexteActive]}
                  maxFontSizeMultiplier={PLAFOND_PUCE}
                >
                  {LIBELLE_ZONE[z]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Ce qu'on dit franchement de « autre » : sans zone, aucun exercice
              ne peut être écarté (§T6). Mieux vaut le dire que le laisser croire. */}
          {zone === "autre" ? <Text style={styles.avertissement}>{AVERTISSEMENT_ZONE_AUTRE}</Text> : null}

          <Text style={styles.champLabel}>Ça t'empêche de quoi ?</Text>
          <View style={styles.colonneBoutons}>
            {([1, 2, 3] as BodyInjurySeverity[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.puceLarge, gravite === g && styles.puceActive]}
                onPress={() => {
                  haptics.impactLight();
                  setGravite(g);
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={LIBELLE_GRAVITE[g]}
                accessibilityState={{ selected: gravite === g }}
              >
                <Text
                  style={[styles.puceTexte, gravite === g && styles.puceTexteActive]}
                >
                  {LIBELLE_GRAVITE[g]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.champLabel}>Un mot, si tu veux (facultatif)</Text>
          <TextInput
            style={styles.champNote}
            value={note}
            onChangeText={setNote}
            placeholder="Ex : ça tire à la descente"
            placeholderTextColor={C.sub}
            maxLength={NOTE_MAX}
            multiline
            accessibilityLabel="Note libre sur cette gêne"
          />

          <View style={styles.rangeeActionsFormulaire}>
            <TouchableOpacity
              style={[styles.boutonPrincipal, !peutEnregistrer && styles.boutonDesactive]}
              onPress={onEnregistrer}
              disabled={!peutEnregistrer}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer cette gêne"
              accessibilityState={{ disabled: !peutEnregistrer }}
            >
              <Text style={styles.boutonPrincipalTexte} maxFontSizeMultiplier={PLAFOND_TITRE}>
                Enregistrer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonSecondaire}
              onPress={() => {
                haptics.impactLight();
                reinitialiserFormulaire();
                setFormulaireOuvert(false);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Annuler"
            >
              <Text style={styles.boutonSecondaireTexte} maxFontSizeMultiplier={PLAFOND_TITRE}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <TouchableOpacity
          style={styles.boutonPrincipal}
          onPress={() => {
            haptics.impactLight();
            setFormulaireOuvert(true);
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Signaler une gêne"
        >
          <Ionicons name="add" size={18} color={C.background} />
          <Text style={styles.boutonPrincipalTexte} maxFontSizeMultiplier={PLAFOND_TITRE}>
            Signaler une gêne
          </Text>
        </TouchableOpacity>
      )}

      {/* HISTORIQUE REPLIÉ (D9) : la liste, jamais un compteur. */}
      {vm.passees.length > 0 ? (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.lienHistorique}
            onPress={() => {
              haptics.impactLight();
              setHistoriqueOuvert((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              historiqueOuvert ? "Masquer les gênes passées" : "Voir les gênes passées"
            }
            accessibilityState={{ expanded: historiqueOuvert }}
          >
            <Text style={styles.lienHistoriqueTexte}>
              {historiqueOuvert ? "Masquer les gênes passées" : "Voir les gênes passées"}
            </Text>
            <Ionicons
              name={historiqueOuvert ? "chevron-up" : "chevron-down"}
              size={16}
              color={C.sub}
            />
          </TouchableOpacity>

          {historiqueOuvert
            ? vm.passees.map((ligne) => (
                <View key={ligne.id} style={styles.lignePassee}>
                  <Text style={styles.lignePasseeZone}>{ligne.zoneLabel}</Text>
                  <Text style={styles.carteMeta}>
                    {[ligne.graviteLabelCourt, ligne.dateRelative].filter(Boolean).join(" · ")}
                  </Text>
                  <TouchableOpacity
                    style={styles.lienSupprimer}
                    onPress={() => onSupprimer(ligne.id, ligne.zoneLabel)}
                    hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer définitivement la gêne ${ligne.zoneLabel}`}
                  >
                    <Text style={styles.lienSupprimerTexte}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {/* La SEULE phrase de stockage de l'app, et elle ne parle QUE du détail
          des gênes. Le score de douleur du feedback, lui, est bien synchronisé
          sur nos serveurs — écrire « tout reste sur ton téléphone » serait faux
          (erratum 3 du design). */}
      <Text style={styles.lignePrivee}>{LIGNE_STOCKAGE_LOCAL}</Text>
      <Text style={styles.lignePrivee}>
        Elles ne sont pas sauvegardées en ligne : si tu changes de téléphone, tu
        devras les redéclarer.
      </Text>

      {/* Pied d'écran : le rappel qui n'est jamais de trop sur un écran de santé. */}
      <Text style={styles.disclaimer}>
        FKS n'est pas un professionnel de santé et ne pose aucun diagnostic. En cas
        de doute, consulte un médecin ou un kiné.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, gap: 16, paddingBottom: 32 },
  intro: { fontSize: 14, lineHeight: 20, color: C.sub },

  blocVide: {
    minHeight: 96,
    justifyContent: "center",
    gap: 6,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceSoft,
  },
  videTitre: { fontSize: 16, fontWeight: "700", color: C.text },
  videTexte: { fontSize: 14, lineHeight: 20, color: C.sub },

  section: { gap: 12 },
  sectionTitre: { fontSize: 15, fontWeight: "700", color: C.text },

  carte: {
    minHeight: 120,
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  carteRelance: { borderColor: C.warn },
  carteEnTete: { flexDirection: "row", alignItems: "center", gap: 8 },
  carteZone: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text },
  carteMeta: { fontSize: 12, lineHeight: 16, color: C.sub },
  carteNote: { fontSize: 14, lineHeight: 20, color: C.text, fontStyle: "italic" },
  relanceTexte: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: C.warn },

  pastille: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.accentSoft,
  },
  pastilleTexte: { fontSize: 12, fontWeight: "700", color: C.accent },

  sousTitreAction: { fontSize: 12, fontWeight: "700", color: C.sub, marginTop: 4 },
  rangeeBoutons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colonneBoutons: { gap: 8 },

  puce: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
  },
  puceLarge: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
  },
  puceActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  puceTexte: { fontSize: 13, fontWeight: "600", color: C.sub },
  puceTexteActive: { color: C.accent },

  formulaire: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceSoft,
  },
  champLabel: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 4 },
  avertissement: { fontSize: 13, lineHeight: 18, color: C.warn },
  champNote: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    color: C.text,
    fontSize: 14,
    padding: 12,
    textAlignVertical: "top",
  },
  rangeeActionsFormulaire: { gap: 8, marginTop: 4 },

  boutonPrincipal: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: C.accent,
  },
  boutonPrincipalTexte: { fontSize: 15, fontWeight: "700", color: C.background },
  boutonDesactive: { opacity: 0.45 },
  boutonSecondaire: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  boutonSecondaireTexte: { fontSize: 14, fontWeight: "600", color: C.sub },

  lienSupprimer: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  lienSupprimerTexte: { fontSize: 13, fontWeight: "600", color: C.danger },

  lienHistorique: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lienHistoriqueTexte: { fontSize: 14, fontWeight: "600", color: C.sub },
  lignePassee: {
    minHeight: 64,
    gap: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderSoft,
    backgroundColor: C.surfaceSoft,
  },
  lignePasseeZone: { fontSize: 14, fontWeight: "700", color: C.text },

  lignePrivee: { fontSize: 12, lineHeight: 16, color: C.sub },
  disclaimer: { fontSize: 11, lineHeight: 15, color: C.sub, marginTop: 4 },
});
