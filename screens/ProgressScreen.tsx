// screens/ProgressScreen.tsx
// =============================================================================
// LA PAGE PROGRESSION — CE QU'ELLE A LE DROIT DE DIRE
// =============================================================================
//
// Cette page a longtemps ouvert sur un verdict ("TA FORME : Frais") et une
// courbe de 30 jours. Les deux etaient faux sur un compte neuf, et faux de la
// meme facon : la serie repartait des constantes d'amorcage ATL0/CTL0 avec 45
// jours de chauffe, si bien qu'un joueur n'ayant JAMAIS rien enregistre lisait
// une trajectoire — celle de la decroissance de deux constantes. Le libelle
// d'etat, lui, venait de `useLoadStore.tsb`, initialise a `CTL0 - ATL0` : le
// fameux « TSB initial = +3 ». Deux chiffres inventes, l'un sous l'autre.
//
// -----------------------------------------------------------------------------
// CE QUI LES REMPLACE : LE RESUME CANONIQUE
// -----------------------------------------------------------------------------
// `useProgressionViewModel()` rend EXACTEMENT le ViewModel que la carte de
// l'accueil affiche — meme selecteur pur, meme etat de stores, meme fenetre.
// C'est tout l'objet du resume canonique : le joueur qui tape « Voir ma
// progression » retrouve les chiffres qu'il vient de lire, pas une seconde
// version calculee autrement.
//
// Ce ViewModel est une union discriminee sur `state` :
//   - "empty"      : aucune seance terminee. Trois reperes, aucune courbe.
//   - "collecting" : des faits reels, mais pas encore de tendance affichable.
//   - "ready"      : la courbe, avec sa portee ecrite dessous.
// `courbe: null` est un type LITTERAL dans les deux premiers etats : une courbe
// y est impossible a rendre, pas seulement deconseillee.
//
// -----------------------------------------------------------------------------
// CE QUE CETTE PAGE GARDE EN PROPRE, ET POURQUOI
// -----------------------------------------------------------------------------
// Le calendrier du mois, les stats du mois et la liste COMPLETE des comparaisons
// de tests. Ce sont les trois blocs que la carte de l'accueil ne peut pas
// contenir — c'est meme la seule raison pour laquelle son pied « Voir ma
// progression » existe. Ils sont recalcules ici, mais sur les MEMES predicats
// canoniques (`domain/resumeCanonique.ts`), jamais sur `s.completed` a la main.
//
// -----------------------------------------------------------------------------
// CE QUI A DISPARU, ET CE QUI NE REVIENDRA PAS SANS SOURCE
// -----------------------------------------------------------------------------
//   - le hero « TA FORME » et sa pastille de couleur (verdict global sans
//     source) ;
//   - la serie ATL0/CTL0 de 30 jours (amorcage affiche comme une mesure) ;
//   - les deux definitions de streak et l'accomplissement « 7 jours d'affilee »
//     (decision fermee du fondateur : purge des streaks) ;
//   - l'accomplissement « Cycle termine », deduit de `seances / 12` — un proxy
//     que le code lui-meme documentait comme tel, faute de compteur persiste ;
//   - l'accomplissement « 30 jours d'activite », compte sur un ensemble qui
//     melangeait les charges club auto-injectees aux faits reels ;
//   - l'ecart d'effort avec le mois dernier : `dailyApplied` est indecomposable
//     (auto et reel s'y additionnent), donc l'ecart ne dit pas ce qu'il annonce.
// =============================================================================

import React, { useLayoutEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { Screen } from "../components/ui/Screen";
import { useNavigation } from "@react-navigation/native";
import { format, startOfMonth, endOfMonth, addDays, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { useSettingsStore } from "../state/settingsStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { Card } from "../components/ui/Card";
import { toDateKey } from "../utils/dateHelpers";
import { getSessionDuration } from "../utils/sessionHelpers";
import { estChargeExterneManuelle, estSeanceFksTerminee } from "../domain/resumeCanonique";
import { TonSuiviSection } from "../components/progress/TonSuiviSection";
import { useProgressionViewModel } from "../hooks/useProgressionViewModel";
import { useTrackingProgress } from "../hooks/useTrackingProgress";
import type {
  ProgressionComparaisonTest,
  ProgressionFait,
} from "./homeVNext/progressionViewModel";

const palette = theme.colors;

// =============================================================================
// LES ACCOMPLISSEMENTS QUI RESTENT — TROIS COMPTES, ZERO DEDUCTION
// =============================================================================
//
// Les trois survivants comptent la MEME chose (des seances FKS terminees), avec
// le meme predicat que le resume canonique et que le compteur hebdo de
// l'accueil. Un joueur ne peut donc pas lire « 12 seances terminees » en haut de
// page et « 10 / 10 » verrouille plus bas.
//
// Les trois autres sont partis parce qu'aucun ne reposait sur un fait constate :
// deux sur des streaks (purge decidee), un sur un proxy `seances / 12`.
// =============================================================================

type Accomplissement = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valeur: string;
  couleur: string;
  atteint: boolean;
};

/** Les paliers, dans l'ordre. `seuil` est la seule donnee variable. */
const PALIERS: readonly { id: string; seuil: number; icon: keyof typeof Ionicons.glyphMap; label: string; couleur: string }[] = [
  { id: "premiere_seance", seuil: 1, icon: "flash", label: "Première séance", couleur: "#ff7a1a" },
  { id: "dix_seances", seuil: 10, icon: "trophy", label: "10 séances", couleur: "#8b5cf6" },
  { id: "cinquante_seances", seuil: 50, icon: "medal", label: "50 séances", couleur: "#f59e0b" },
];

function construireAccomplissements(seancesTerminees: number): Accomplissement[] {
  return PALIERS.map((palier) => {
    const atteint = seancesTerminees >= palier.seuil;
    return {
      id: palier.id,
      icon: palier.icon,
      label: palier.label,
      // Le compte affiche n'est JAMAIS borne au seuil : un joueur a 63 seances
      // lit « Débloqué », pas « 50 / 50 », et la fraction dit le vrai reste.
      valeur: atteint ? "Débloqué" : `${seancesTerminees} / ${palier.seuil}`,
      couleur: palier.couleur,
      atteint,
    };
  });
}

// =============================================================================
// L'ECRAN
// =============================================================================

export default function ProgressScreen() {
  const navigation = useNavigation<any>();
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const sessions = useSessionsStore((s) => s.sessions ?? []);
  const externalLoads = useExternalStore((s) => s.externalLoads ?? []);
  const weekStart = useSettingsStore((s) => s.weekStart);

  /** LE resume canonique. Le meme que la carte de l'accueil, au champ pres. */
  const progression = useProgressionViewModel();
  /**
   * Lu ici pour UNE chose : le bandeau de reprise, qui monte en haut de page.
   * Il vivait dans « Ton suivi », c'est-a-dire sous le resume — un joueur qui
   * revient apres trois semaines d'arret devait donc lire ses chiffres avant
   * d'apprendre qu'ils datent. `TonSuiviSection` ne le rend plus.
   */
  const tracking = useTrackingProgress();

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      title: "Progression",
    });
  }, [navigation]);

  const today = devNowISO ? new Date(devNowISO) : new Date();
  const todayKey = toDateKey(today);
  const monthKey = todayKey.slice(0, 7);

  // ───────────────────────────────────────────────────────────────────────────
  // LES FAITS DU MOIS — sur les predicats canoniques, jamais sur `s.completed`
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Jours ou l'app a VU quelque chose de reel : seance FKS terminee, ou charge
   * externe SAISIE par le joueur.
   *
   * Les charges club/match auto-injectees sont exclues. Elles sont deduites des
   * cases cochees au profil, pas constatees : les pointer sur le calendrier
   * afficherait des jours « actifs » ou le joueur n'a rien fait de la sorte, et
   * contredirait la phrase de portee imprimee sous la courbe.
   */
  const joursActifs = useMemo(() => {
    const jours = new Set<string>();
    for (const s of sessions) {
      if (!estSeanceFksTerminee(s as any)) continue;
      const cle = toDateKey((s as any)?.dateISO ?? (s as any)?.date);
      if (cle) jours.add(cle);
    }
    for (const c of externalLoads) {
      if (!estChargeExterneManuelle(c as any)) continue;
      const cle = toDateKey((c as any)?.dateISO ?? (c as any)?.date);
      if (cle) jours.add(cle);
    }
    return jours;
  }, [sessions, externalLoads]);

  const seancesTerminees = useMemo(
    () => sessions.filter((s: any) => estSeanceFksTerminee(s)),
    [sessions]
  );

  const seancesDuMois = useMemo(
    () =>
      seancesTerminees.filter((s: any) =>
        toDateKey(s?.dateISO ?? s?.date).startsWith(monthKey)
      ),
    [seancesTerminees, monthKey]
  );

  const moisPrecedent = useMemo(() => {
    const d = startOfMonth(today);
    d.setDate(0);
    return toDateKey(d).slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  const seancesMoisPrecedent = useMemo(
    () =>
      seancesTerminees.filter((s: any) =>
        toDateKey(s?.dateISO ?? s?.date).startsWith(moisPrecedent)
      ),
    [seancesTerminees, moisPrecedent]
  );

  const effortMoyen = useMemo(() => {
    const valeurs = seancesDuMois
      .map((s: any) => s?.feedback?.rpe ?? s?.rpe)
      .filter((v: any) => Number.isFinite(v)) as number[];
    if (!valeurs.length) return null;
    return Number((valeurs.reduce((a, b) => a + b, 0) / valeurs.length).toFixed(1));
  }, [seancesDuMois]);

  const dureeMoyenne = useMemo(() => {
    const valeurs = seancesDuMois
      .map((s: any) => getSessionDuration(s))
      .filter((v: any): v is number => Number.isFinite(v));
    if (!valeurs.length) return null;
    return Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
  }, [seancesDuMois]);

  const ecartSeances = seancesDuMois.length - seancesMoisPrecedent.length;

  const accomplissements = useMemo(
    () => construireAccomplissements(seancesTerminees.length),
    [seancesTerminees.length]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // LE CALENDRIER DU MOIS
  // ───────────────────────────────────────────────────────────────────────────

  const joursDuCalendrier = useMemo(() => {
    const debut = startOfMonth(today);
    const fin = endOfMonth(today);
    const jours: { key: string; label: string; actif: boolean; aujourdhui: boolean }[] = [];
    const videsEnTete = weekStart === "sun" ? getDay(debut) : (getDay(debut) + 6) % 7;
    for (let i = 0; i < videsEnTete; i += 1) {
      jours.push({ key: `vide_${i}`, label: "", actif: false, aujourdhui: false });
    }
    for (let d = debut; d <= fin; d = addDays(d, 1)) {
      const key = toDateKey(d);
      jours.push({ key, label: String(d.getDate()), actif: joursActifs.has(key), aujourdhui: key === todayKey });
    }
    return jours;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joursActifs, todayKey, weekStart]);

  // ───────────────────────────────────────────────────────────────────────────
  // LA COURBE — uniquement quand le ViewModel en a construit une
  // ───────────────────────────────────────────────────────────────────────────

  const courbe = progression.state === "ready" ? progression.courbe : null;
  const points = courbe?.points ?? [];

  /**
   * Les comparaisons de tests n'existent PAS dans l'etat "empty" — c'est le
   * contrat, pas un oubli : sur un compte sans la moindre seance terminee, la
   * page ne dit rien d'autre que ses trois reperes. La carte entiere disparait
   * donc, au lieu d'afficher une explication d'absence a cote d'une autre.
   */
  const comparaisons = progression.state === "empty" ? null : progression.comparaisonsTests;

  const [largeurGraphe, setLargeurGraphe] = useState(0);
  const hauteurGraphe = 110;
  const marge = 8;
  const margeGauche = 24;
  const margeDroite = 8;
  const tsbMin = -20;
  const tsbMax = 20;

  const versY = (valeur: number) => {
    const borne = Math.max(tsbMin, Math.min(tsbMax, valeur));
    const ratio = (borne - tsbMin) / (tsbMax - tsbMin);
    return marge + (1 - ratio) * (hauteurGraphe - marge * 2);
  };

  const pointsTraces = useMemo(() => {
    if (!largeurGraphe || points.length < 2) return [];
    const largeurInterne = Math.max(10, largeurGraphe - margeGauche - margeDroite);
    const pas = largeurInterne / (points.length - 1);
    return points.map((v, i) => ({ x: margeGauche + i * pas, y: versY(v), v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largeurGraphe, points]);

  const chemin = useMemo(
    () => pointsTraces.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" "),
    [pointsTraces]
  );

  const mesurerGraphe = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout.width;
    if (l && l !== largeurGraphe) setLargeurGraphe(l);
  };

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      {/* ═══════════ BANDEAU REPRISE — avant tout chiffre ═══════════ */}
      {tracking.resumption ? (
        <View style={styles.bandeauReprise}>
          <Ionicons name="leaf-outline" size={18} color={palette.warn} />
          <Text style={styles.texteReprise}>{tracking.resumption.message}</Text>
        </View>
      ) : null}

      {/* ═══════════ LE RESUME CANONIQUE ═══════════ */}
      <Card variant="surface" style={styles.carte}>
        <Text style={styles.titreSection}>{progression.titre}</Text>

        {/* --- "empty" : trois reperes, aucun chiffre --- */}
        {progression.state === "empty" ? (
          <>
            {progression.reperes.map((r) => (
              <View key={r.numero} style={styles.ligneRepere}>
                <Text style={styles.numeroRepere}>{r.numero}</Text>
                <Text style={styles.texteRepere}>{r.texte}</Text>
              </View>
            ))}
            <Text style={styles.mention}>{progression.mention}</Text>
          </>
        ) : null}

        {/* --- "collecting" : les faits reels, et ce qui manque --- */}
        {progression.state === "collecting" ? (
          <>
            {progression.faits.map((f: ProgressionFait) => (
              <View key={f.cle} style={styles.ligneFait}>
                <Text style={styles.libelleFait} numberOfLines={2}>
                  {f.libelle}
                </Text>
                <Text style={styles.valeurFait}>{f.valeur}</Text>
              </View>
            ))}
            {/*
              L'ETAT DE CONSTRUCTION, ECRIT PLUTOT QUE DESSINE. Le ViewModel dit
              ce qui manque et combien ; la page ne fabrique pas une courbe plate
              en attendant.
            */}
            <Text style={styles.mention}>{progression.tendanceIndisponible.explication}</Text>
          </>
        ) : null}

        {/* --- "ready" : la courbe, et le fait qui l'accompagne --- */}
        {progression.state === "ready" && courbe ? (
          <>
            <View style={styles.zoneGraphe} onLayout={mesurerGraphe}>
              <Svg width={largeurGraphe} height={hauteurGraphe}>
                <Line
                  x1={margeGauche}
                  y1={versY(0)}
                  x2={Math.max(margeGauche, largeurGraphe - margeDroite)}
                  y2={versY(0)}
                  stroke={palette.borderSoft}
                  strokeWidth={1}
                />
                <Line
                  x1={margeGauche}
                  y1={versY(-10)}
                  x2={Math.max(margeGauche, largeurGraphe - margeDroite)}
                  y2={versY(-10)}
                  stroke="rgba(245, 158, 11, 0.3)"
                  strokeWidth={1}
                />
                {chemin ? (
                  <Path d={chemin} stroke={palette.accent} strokeWidth={2.4} fill="none" />
                ) : null}
                {pointsTraces.map((p, idx) => (
                  <Circle
                    key={`point_${idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={idx === pointsTraces.length - 1 ? 5 : 2.5}
                    fill={palette.accent}
                  />
                ))}
              </Svg>
              <Text style={[styles.repereAxe, { top: versY(0) - 8 }]}>0</Text>
              <Text style={[styles.repereAxe, { top: versY(-10) - 8, color: "#f59e0b" }]}>-10</Text>
            </View>
            <Text style={styles.periode}>{courbe.periodeLabel}</Text>
            {/*
              LA PORTEE. Champ NON nullable du contrat : il est impossible de
              construire une courbe sans dire sur quoi elle est calculee. C'est
              la mention « seances FKS uniquement » que la page n'a jamais eue.
            */}
            <Text style={styles.portee}>{courbe.portee}</Text>
            <View style={styles.ligneFait}>
              <Text style={styles.libelleFait} numberOfLines={2}>
                {progression.resume.libelle}
              </Text>
              <Text style={styles.valeurFait}>{progression.resume.valeur}</Text>
            </View>
          </>
        ) : null}
      </Card>

      {/* ═══════════ TON SUIVI — empile sous le resume ═══════════ */}
      {/*
        LES DEUX COMPTEURS SE SUIVENT, ET LEURS LIBELLES PORTENT LA DIFFERENCE.
        Au-dessus : « Séances terminées depuis tes débuts » (cumul, sans borne).
        Ici : « N séances suivies » (fenetre de 28 jours de la boucle de suivi,
        `domain/tracking/config.ts`). Ce sont deux mesures differentes de deux
        choses differentes ; c'est le mot qui le dit, pas la taille du texte.
      */}
      <TonSuiviSection />

      {/* ═══════════ EVOLUTION DES TESTS — la liste COMPLETE ═══════════ */}
      {comparaisons ? (
      <Card variant="surface" style={styles.carte}>
        <View style={styles.ligneTitreIcone}>
          <Ionicons name="analytics" size={18} color={palette.accent} />
          <Text style={styles.titreSection}>Évolution tests</Text>
        </View>
        {comparaisons.possible ? (
          <>
            <Text style={styles.sousTitre}>Dernières valeurs connues, tous tests confondus</Text>
            {comparaisons.comparaisons.map((c: ProgressionComparaisonTest) => {
              // TROIS SENS, PAS UN BOOLEEN. L'ancienne page faisait tomber
              // l'ecart exactement nul dans « pas ameliore » et l'affichait en
              // rouge, fleche vers le bas : une valeur identique n'est pas une
              // regression.
              const couleur =
                c.sens === "amelioration"
                  ? "#16a34a"
                  : c.sens === "regression"
                    ? "#ef4444"
                    : palette.sub;
              const icone =
                c.sens === "amelioration"
                  ? "trending-up"
                  : c.sens === "regression"
                    ? "trending-down"
                    : "remove";
              return (
                <View key={c.champ} style={styles.ligneTest}>
                  <View style={styles.libelleTestBloc}>
                    <Text style={styles.libelleTest} numberOfLines={1}>
                      {c.label}
                    </Text>
                  </View>
                  <Text style={styles.valeurAvant}>{c.avantAffiche}</Text>
                  <Ionicons name="arrow-forward" size={14} color={palette.muted} />
                  <Text style={styles.valeurApres}>{c.apresAffiche}</Text>
                  <View style={[styles.pastilleEcart, { backgroundColor: `${couleur}1f` }]}>
                    <Ionicons name={icone} size={12} color={couleur} />
                    <Text style={[styles.texteEcart, { color: couleur }]}>{c.ecartAffiche}</Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          // L'ABSENCE EST EXPLIQUEE, PAS MASQUEE. L'ancienne page cachait toute
          // la carte des qu'aucune paire n'etait comparable : le joueur ne
          // savait pas s'il manquait un test ou si la fonction etait cassee.
          <Text style={styles.mention}>{comparaisons.explication}</Text>
        )}
      </Card>
      ) : null}

      {/* ═══════════ CALENDRIER ═══════════ */}
      <Card variant="surface" style={styles.carte}>
        <Text style={styles.titreSection}>Calendrier</Text>
        <Text style={styles.sousTitre}>{format(today, "MMMM yyyy", { locale: fr })}</Text>
        <View style={styles.enTeteCalendrier}>
          {(weekStart === "sun"
            ? ["D", "L", "M", "M", "J", "V", "S"]
            : ["L", "M", "M", "J", "V", "S", "D"]
          ).map((d, i) => (
            <Text key={`jour_${i}_${d}`} style={styles.jourSemaine}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.grilleCalendrier}>
          {joursDuCalendrier.map((jour) => (
            <View key={jour.key} style={styles.celluleCalendrier}>
              {jour.label ? (
                <View
                  style={[
                    styles.pastilleJour,
                    jour.actif && styles.pastilleJourActive,
                    jour.aujourdhui && styles.pastilleJourAujourdhui,
                  ]}
                >
                  <Text style={[styles.texteJour, jour.actif && styles.texteJourActif]}>
                    {jour.label}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.legendeCalendrier}>
          <View style={[styles.pointLegende, { backgroundColor: palette.accent }]} />
          {/*
            LE LIBELLE DIT EXACTEMENT CE QUI EST POINTE. « Seance / effort »
            laissait croire que les entrainements club comptaient : ils sont
            injectes automatiquement d'apres le profil, et ils ne sont pas ici.
          */}
          <Text style={styles.texteLegende}>Séance FKS terminée ou charge que tu as saisie</Text>
        </View>
      </Card>

      {/* ═══════════ STATS DU MOIS ═══════════ */}
      <Card variant="surface" style={styles.carte}>
        <Text style={styles.titreSection}>Stats du mois</Text>
        <View style={styles.grilleStats}>
          <View style={styles.blocStat}>
            <Ionicons name="barbell-outline" size={16} color={palette.accent} />
            <Text style={styles.libelleStat}>Séances</Text>
            <Text style={styles.valeurStat}>{seancesDuMois.length}</Text>
          </View>
          <View style={styles.blocStat}>
            <Ionicons name="speedometer-outline" size={16} color={palette.warn} />
            <Text style={styles.libelleStat}>Effort moyen</Text>
            <Text style={styles.valeurStat}>{effortMoyen ? `${effortMoyen} / 10` : "—"}</Text>
          </View>
          <View style={styles.blocStat}>
            <Ionicons name="time-outline" size={16} color={palette.info} />
            <Text style={styles.libelleStat}>Durée moy.</Text>
            <Text style={styles.valeurStat}>{dureeMoyenne ? `${dureeMoyenne} min` : "—"}</Text>
          </View>
        </View>

        <View style={styles.ligneComparaison}>
          <Text style={styles.libelleComparaison}>vs mois dernier</Text>
          <View
            style={[
              styles.pastilleEcart,
              {
                backgroundColor:
                  ecartSeances >= 0 ? "rgba(22,163,74,0.12)" : "rgba(239,68,68,0.12)",
              },
            ]}
          >
            <Ionicons
              name={ecartSeances >= 0 ? "trending-up" : "trending-down"}
              size={12}
              color={ecartSeances >= 0 ? "#16a34a" : "#ef4444"}
            />
            <Text style={[styles.texteEcart, { color: ecartSeances >= 0 ? "#16a34a" : "#ef4444" }]}>
              {ecartSeances >= 0 ? "+" : ""}
              {ecartSeances} séances
            </Text>
          </View>
        </View>
      </Card>

      {/* ═══════════ ACCOMPLISSEMENTS ═══════════ */}
      <Card variant="surface" style={styles.carte}>
        <Text style={styles.titreSection}>Accomplissements</Text>
        <View style={styles.grilleAccomplissements}>
          {accomplissements.map((a) => (
            <View
              key={a.id}
              style={[styles.blocAccomplissement, !a.atteint && styles.blocAccomplissementVerrouille]}
            >
              <View
                style={[
                  styles.iconeAccomplissement,
                  { backgroundColor: a.atteint ? `${a.couleur}20` : palette.cardSoft },
                ]}
              >
                <Ionicons
                  name={a.atteint ? a.icon : "lock-closed"}
                  size={20}
                  color={a.atteint ? a.couleur : palette.muted}
                />
              </View>
              <Text style={[styles.libelleAccomplissement, !a.atteint && { color: palette.muted }]}>
                {a.label}
              </Text>
              <Text style={[styles.valeurAccomplissement, a.atteint && { color: a.couleur }]}>
                {a.valeur}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  carte: {
    padding: 16,
    borderRadius: 24,
    gap: 10,
  },

  // ─── Bandeau reprise ───
  bandeauReprise: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(245,158,11,0.10)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.24)",
  },
  texteReprise: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: palette.text,
    fontWeight: "600",
    minHeight: 19,
  },

  // ─── Titres ───
  titreSection: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
    minHeight: 20,
  },
  ligneTitreIcone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sousTitre: {
    fontSize: 12,
    color: palette.sub,
    minHeight: 16,
  },

  // ─── Etat "empty" ───
  ligneRepere: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  numeroRepere: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.accent,
    minWidth: 16,
  },
  texteRepere: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: palette.text,
    minHeight: 19,
  },

  // ─── Faits ───
  ligneFait: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  libelleFait: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    minHeight: 18,
  },
  valeurFait: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
  },

  /** Toute phrase qui explique une ABSENCE. Un seul style pour toutes. */
  mention: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.sub,
    minHeight: 18,
  },

  // ─── Courbe ───
  zoneGraphe: {
    marginTop: 4,
    minHeight: 110,
  },
  repereAxe: {
    position: "absolute",
    left: 0,
    fontSize: 10,
    color: palette.muted,
  },
  periode: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.text,
    minHeight: 16,
  },
  portee: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
    minHeight: 17,
  },

  // ─── Tests ───
  ligneTest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  libelleTestBloc: {
    flex: 1,
  },
  libelleTest: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.text,
    minHeight: 18,
  },
  valeurAvant: {
    fontSize: 12,
    color: palette.sub,
  },
  valeurApres: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.text,
  },
  pastilleEcart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  texteEcart: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ─── Calendrier ───
  enTeteCalendrier: {
    flexDirection: "row",
  },
  jourSemaine: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: palette.sub,
  },
  grilleCalendrier: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  celluleCalendrier: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleJour: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.cardSoft,
  },
  pastilleJourActive: {
    backgroundColor: palette.accent,
  },
  pastilleJourAujourdhui: {
    borderWidth: 2,
    borderColor: palette.text,
  },
  texteJour: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "600",
  },
  texteJourActif: {
    color: "#0b0b0c",
    fontWeight: "800",
  },
  legendeCalendrier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pointLegende: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  texteLegende: {
    flex: 1,
    fontSize: 12,
    color: palette.sub,
    minHeight: 16,
  },

  // ─── Stats ───
  grilleStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  blocStat: {
    flexGrow: 1,
    flexBasis: "30%",
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.cardSoft,
    gap: 4,
  },
  libelleStat: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "600",
    minHeight: 15,
  },
  valeurStat: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  ligneComparaison: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  libelleComparaison: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "600",
  },

  // ─── Accomplissements ───
  grilleAccomplissements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  blocAccomplissement: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.cardSoft,
    gap: 6,
  },
  blocAccomplissementVerrouille: {
    opacity: 0.7,
  },
  iconeAccomplissement: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  libelleAccomplissement: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.text,
    textAlign: "center",
    minHeight: 15,
  },
  valeurAccomplissement: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.sub,
  },
});
