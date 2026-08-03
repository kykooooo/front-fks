// components/coach/CoachSelfPlayerCard.tsx
//
// « JE M'ENTRAÎNE AUSSI » — et son geste inverse, « Arrêter mon suivi ».
//
// ─── LE BESOIN, MOT POUR MOT ────────────────────────────────────────────────
// En club amateur, l'entraîneur joue. Jusqu'ici, le SEUL moyen pour lui d'entrer
// dans l'effectif suivi de son propre club était de générer un code
// d'invitation, de le lire, puis de le retaper : techniquement cohérent,
// mauvais comme expérience. Le code d'invitation existe pour authentifier
// quelqu'un qui vient de DEHORS ; ici l'appartenance est déjà établie.
//
// ─── POURQUOI CETTE CARTE VIT DANS L'ONGLET « SEMAINE » ─────────────────────
// L'onglet Aujourd'hui est l'ATTERRISSAGE : une file de lecture qu'un coach
// ouvre en trois secondes au bord du terrain. Y poser une carte de réglage —
// affichée une fois, actionnée une fois, puis inutile — lui volerait de
// l'attention à chaque ouverture, pour un geste qu'on ne fait qu'une seule fois.
//
// L'onglet Semaine est déjà l'onglet des « réglages de fait » de l'espace coach :
// il porte le code club, le cadre de la semaine, le sélecteur Joueur/Coach et
// l'accès légal. Cette carte s'y range NATURELLEMENT, et surtout elle s'y range
// JUSTE AVANT le sélecteur d'espace — parce qu'elle est exactement ce qui le
// fait apparaître. Activer son suivi ouvre le second espace ; le sélecteur, la
// ligne d'en dessous, sert à y aller. La séquence se lit toute seule.
//
// ─── ELLE NE DÉCIDE RIEN ────────────────────────────────────────────────────
// L'état affiché vient du serveur, relayé par `state/appSpaceGate` (le même
// instantané d'appartenance que le sélecteur d'espace — aucun second
// abonnement). Le composant ne devine pas, n'anticipe aucun refus, et n'ouvre
// aucun droit : il appelle, et il affiche la réponse.
//
// ─── TROIS ÉTATS, ET UN QUI N'AFFICHE RIEN ──────────────────────────────────
//  . `inactif` -> « Je m'entraîne aussi » (+ la divulgation coach-safe) ;
//  . `actif`   -> « Arrêter mon suivi comme joueur » ;
//  . `inconnu` -> RIEN. Tant que la lecture n'a pas abouti, proposer l'un ou
//    l'autre serait un pari — et se tromper de geste, ici, promet soit de
//    retirer ce qui n'existe pas, soit d'ajouter ce qui existe déjà.
//
// ─── AUCUNE CINQUIÈME COULEUR ───────────────────────────────────────────────
// Tout vient de `coachTheme` : accent pour l'action qui ouvre, bordure neutre
// pour celle qui ferme. Aucune teinte n'est définie ici.

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CoachSectionCard } from "./CoachSectionCard";
import { coachColors, coachLayout, coachRadius, coachSpacing, coachType } from "./coachTheme";
import { ClubDataDisclosure } from "../club/ClubDataDisclosure";
import { useAppSpaceSwitch } from "../AppSpaceSwitch";
import { useHaptics } from "../../hooks/useHaptics";
import { deactivateClubPlayer, enrollSelfAsClubPlayer } from "../../services/clubMembers";
import { showToast } from "../../utils/toast";

/**
 * Ce que la carte annonce AVANT le geste. Écrit une seule fois, et volontairement
 * concret : « tu apparaîtras dans ton effectif » est un fait vérifiable dès la
 * seconde suivante, contrairement à une promesse de bénéfice.
 */
export const SELF_PLAYER_COPY = {
  titreInactif: "T'entraîner avec FKS",
  sousTitreInactif: "Ton compte encadre ce club, sans suivi d'entraînement",
  bouton: "Je m'entraîne aussi",
  /**
   * CE QUE ÇA CHANGE, dit à l'écran, avant d'appuyer. Deux conséquences, les
   * deux vraies, et la seconde est celle qu'on serait tenté de taire.
   */
  effet:
    "Tu apparaîtras dans l'effectif suivi de ton propre club, et tes séances seront visibles par l'encadrement — selon le contrat ci-dessous, le même que pour tes joueurs.",
  /**
   * La sortie, dite ICI et pas seulement dans la divulgation partagée : celle-ci
   * parle de « quitter ton club depuis ton profil », ce qui n'est pas le geste
   * d'un encadrant (et le propriétaire, lui, ne peut pas quitter son club).
   */
  sortie:
    "Réversible à tout moment depuis cette carte : arrêter ton suivi ne touche pas à tes accès d'encadrement.",

  titreActif: "Ton suivi de joueur",
  sousTitreActif: "Tu es dans l'effectif suivi de ton club",
  boutonArret: "Arrêter mon suivi comme joueur",
  effetArret:
    "Ta fiche disparaît de l'effectif suivi. Tes accès d'encadrement et ton historique personnel ne sont pas touchés.",
} as const;

export type CoachSelfPlayerCardProps = {
  /** Club affiché par l'écran hôte. Sans lui, aucun geste n'est possible. */
  clubId: string | null;
  /** Compte connecté, pour le geste d'arrêt (qui vise un membre : soi-même). */
  uid: string | null;
  testID?: string;
};

export function CoachSelfPlayerCard({ clubId, uid, testID }: CoachSelfPlayerCardProps) {
  const { suiviJoueur } = useAppSpaceSwitch();
  const haptics = useHaptics();
  const [enCours, setEnCours] = useState(false);

  // Le composant peut être démonté pendant un appel long : on ne touche plus à
  // l'état après coup (même précaution que l'écran hôte).
  const monte = useRef(true);
  React.useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const activer = useCallback(async () => {
    if (!clubId || enCours) return;
    haptics.impactLight();
    setEnCours(true);
    try {
      const res = await enrollSelfAsClubPlayer(clubId);
      if (!monte.current) return;
      if (!res.ok) {
        haptics.error();
        showToast({ type: "error", title: "Activation impossible", message: res.message });
        return;
      }
      haptics.success();
      showToast({
        type: "success",
        title: res.alreadyActive ? "Suivi déjà actif" : "Suivi activé",
        // On dit la VÉRITÉ du serveur, y compris quand elle est décevante : sous
        // une politique d'approbation, la fiche n'apparaît pas tout de suite, et
        // annoncer le contraire ferait chercher un bug là où il n'y en a pas.
        message: res.coachAccessGranted
          ? "Tu apparais dans l'effectif suivi de ton club."
          : "Ton suivi est actif. Ta fiche restera masquée tant que ton club ne l'aura pas autorisée.",
      });
    } finally {
      if (monte.current) setEnCours(false);
    }
  }, [clubId, enCours, haptics]);

  const arreter = useCallback(async () => {
    if (!clubId || !uid || enCours) return;
    haptics.impactLight();
    setEnCours(true);
    try {
      // LA CALLABLE EXISTANTE, sur soi-même : la matrice serveur l'autorise
      // déjà (`estSoiMeme`). Écrire une seconde porte « arrêter mon suivi »
      // aurait dupliqué une décision qui existe et qui marche.
      const res = await deactivateClubPlayer(clubId, uid);
      if (!monte.current) return;
      if (!res.ok) {
        haptics.error();
        showToast({ type: "error", title: "Arrêt impossible", message: res.message });
        return;
      }
      haptics.success();
      showToast({
        type: "success",
        title: res.alreadyRemoved ? "Suivi déjà arrêté" : "Suivi arrêté",
        message: "Tu n'apparais plus dans l'effectif suivi. Tes accès d'encadrement sont intacts.",
      });
    } finally {
      if (monte.current) setEnCours(false);
    }
  }, [clubId, uid, enCours, haptics]);

  // TANT QU'ON NE SAIT PAS, ON N'AFFICHE RIEN. Pas de carte vide, pas de bouton
  // grisé : un geste dont on ignore le sens ne se propose pas.
  if (suiviJoueur === "inconnu") return null;

  if (suiviJoueur === "actif") {
    const desactive = enCours || !clubId || !uid;
    return (
      <CoachSectionCard
        testID={testID ?? "coach-self-player"}
        title={SELF_PLAYER_COPY.titreActif}
        subtitle={SELF_PLAYER_COPY.sousTitreActif}
      >
        <View style={styles.corps}>
          <Text style={styles.explication} numberOfLines={4}>
            {SELF_PLAYER_COPY.effetArret}
          </Text>
          <Pressable
            testID="coach-self-player-stop"
            onPress={arreter}
            disabled={desactive}
            accessibilityRole="button"
            accessibilityLabel={SELF_PLAYER_COPY.boutonArret}
            accessibilityState={{ disabled: desactive, busy: enCours }}
            style={({ pressed }) => [
              styles.boutonSecondaire,
              desactive && styles.boutonDesactive,
              pressed && !desactive && styles.boutonPresse,
            ]}
          >
            <Ionicons name="pause-circle-outline" size={16} color={coachColors.sub} />
            <Text style={styles.libelleSecondaire} numberOfLines={1}>
              {enCours ? "Arrêt en cours..." : SELF_PLAYER_COPY.boutonArret}
            </Text>
          </Pressable>
        </View>
      </CoachSectionCard>
    );
  }

  const desactive = enCours || !clubId;
  return (
    <CoachSectionCard
      testID={testID ?? "coach-self-player"}
      title={SELF_PLAYER_COPY.titreInactif}
      subtitle={SELF_PLAYER_COPY.sousTitreInactif}
    >
      <View style={styles.corps}>
        <Text style={styles.explication} numberOfLines={5}>
          {SELF_PLAYER_COPY.effet}
        </Text>

        {/* LA DIVULGATION COACH-SAFE, réutilisée telle quelle : mêmes phrases
            que celles lues par un joueur qui saisit son code, alignées par test
            sur le contrat réel. Elle INFORME et ne bloque rien — aucune case,
            aucune condition, et le bouton ci-dessous ne dépend pas d'elle. */}
        <ClubDataDisclosure variant="coach" style={styles.divulgation} />

        <Text style={styles.sortie} numberOfLines={3}>
          {SELF_PLAYER_COPY.sortie}
        </Text>

        <Pressable
          testID="coach-self-player-enroll"
          onPress={activer}
          disabled={desactive}
          accessibilityRole="button"
          accessibilityLabel={SELF_PLAYER_COPY.bouton}
          accessibilityState={{ disabled: desactive, busy: enCours }}
          style={({ pressed }) => [
            styles.boutonPrincipal,
            desactive && styles.boutonPrincipalDesactive,
            pressed && !desactive && styles.boutonPresse,
          ]}
        >
          <Text style={styles.libellePrincipal} numberOfLines={1}>
            {enCours ? "Activation..." : SELF_PLAYER_COPY.bouton}
          </Text>
        </Pressable>
      </View>
    </CoachSectionCard>
  );
}

const styles = StyleSheet.create({
  corps: { gap: coachSpacing.xs },
  explication: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    color: coachColors.sub,
  },
  divulgation: { marginTop: coachSpacing.xs },
  sortie: {
    marginTop: coachSpacing.xxs,
    fontSize: coachType.micro.fontSize,
    lineHeight: coachType.micro.lineHeight,
    color: coachColors.muted,
  },
  boutonPrincipal: {
    marginTop: coachSpacing.sm,
    // minHeight (jamais height) : cible tactile réelle même en grande police.
    minHeight: coachLayout.minTouchSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: coachSpacing.lg,
    borderRadius: coachRadius.chip,
    backgroundColor: coachColors.accent,
  },
  boutonPrincipalDesactive: { backgroundColor: coachColors.neutralBorder },
  libellePrincipal: {
    color: "#FFFFFF",
    fontSize: coachType.corpsFort.fontSize,
    lineHeight: coachType.corpsFort.lineHeight,
    fontWeight: "700",
    textAlign: "center",
  },
  // L'ARRÊT est volontairement SECONDAIRE : c'est un retrait, pas une action
  // qu'on met en avant. Bordure neutre plutôt qu'un rouge d'alerte — rien n'est
  // détruit, et l'historique personnel n'est pas touché.
  boutonSecondaire: {
    marginTop: coachSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: coachSpacing.xxs + 2,
    minHeight: coachLayout.minTouchSize,
    paddingHorizontal: coachSpacing.md,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: coachColors.border,
    backgroundColor: coachColors.card,
  },
  libelleSecondaire: {
    fontSize: coachType.legende.fontSize,
    lineHeight: coachType.legende.lineHeight,
    fontWeight: "700",
    color: coachColors.sub,
  },
  boutonPresse: { opacity: 0.8 },
  boutonDesactive: { opacity: 0.45 },
});
