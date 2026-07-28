// hooks/useAppSpace.ts
//
// L'ESPACE AFFICHÉ, EN TEMPS RÉEL, DÉRIVÉ DE L'AUTORITÉ SERVEUR.
//
// Ce hook ne décide de rien : il ABONNE l'application à sa propre appartenance
// au club (`clubs/{clubId}/members/{uid}`) et passe ce qu'il lit à la dérivation
// pure (`domain/appSpace.resolveAppSpace`).
//
// ─── POURQUOI UN ABONNEMENT, ET PAS UNE LECTURE PONCTUELLE ──────────────────
// L'exigence est « aucune reconnexion manuelle ». Le dépôt s'appuie déjà sur des
// abonnements temps réel (`onSnapshot` sur `users/{uid}` dans RootNavigator,
// `startFirestoreWatch` dans le store) : un abonnement de plus sur UN document
// suit exactement le même modèle, et il donne les trois propriétés demandées
// sans une ligne de code spécial :
//
//  . BASCULE IMMÉDIATE. Quand le transfert de propriété écrit `role: "owner"`
//    sur l'appartenance du successeur, l'instantané arrive sur son téléphone et
//    l'espace change. Aucun bouton, aucune reconnexion, aucun redémarrage.
//  . REDÉMARRAGE À FROID. Il n'y a rien à restaurer : l'abonnement se repose au
//    démarrage et relit la même source. L'espace ne dépend d'aucun cache que
//    l'application aurait écrit elle-même — donc d'aucun cache qu'on pourrait
//    falsifier ou oublier d'invalider.
//  . RETRAIT ET RÉTROGRADATION. Le même chemin ferme l'espace coach quand
//    l'appartenance devient une pierre tombale ou disparaît.
//
// Alternative écartée, et pourquoi : forcer un rafraîchissement de jeton
// (`getIdToken(true)`) ne servirait à rien ici. Aucune revendication personnalisée
// ne porte le rôle — l'autorité vit dans des DOCUMENTS, pas dans le jeton. Un
// rafraîchissement de jeton relirait donc exactement la même chose, en plus lent.
//
// ─── LA SEULE MÉMOIRE LOCALE, ET CE QU'ELLE NE FAIT PAS ─────────────────────
// Ce hook ne met JAMAIS en cache l'AUTORITÉ. Écrire « cet appareil est un espace
// coach » dans AsyncStorage créerait précisément la seconde source de vérité
// qu'on refuse : un cache client, falsifiable et désynchronisable. Le seul cache
// d'autorité en jeu est celui du SDK Firestore, qui est déjà la source.
//
// Ce qu'il mémorise, depuis le lot « entraîneur-joueur », c'est le DERNIER
// ESPACE CHOISI (`hooks/useAppSpacePreference`) — et uniquement pour les comptes
// à qui le serveur ouvre RÉELLEMENT les deux. Cette mémoire n'ouvre rien : elle
// choisit entre deux écrans déjà autorisés. Un compte qui perd l'encadrement
// bascule vers l'espace joueur même si sa préférence dit « coach » ; un
// encadrant sans suivi sportif reste dans l'espace coach même si elle dit
// « player ». Les deux cas sont testés.
//
// ─── CE QUE CE LOT AJOUTE : LA SESSION OUVERTE ──────────────────────────────
// `services/firebase` initialise Firestore SANS cache local persistant : fermer
// l'application vide déjà tout. Le risque n'est donc pas le redémarrage, c'est
// la SESSION OUVERTE — un coach laisse l'app ouverte des jours. Les règles
// Firestore bloquent les NOUVELLES lectures dès la révocation, elles n'effacent
// rien de ce que l'application a déjà chargé en mémoire.
//
// Deux mécanismes répondent à ça, et tous deux passent par ce fichier :
//
//  1. QUATRE ÉTATS, PAS DEUX (`domain/coachAuthority`). `illisible` ne se fond
//     plus dans « espace joueur » : il devient `indetermine`, un état qui FERME
//     l'espace coach ET purge, exactement comme un refus. Sans ça, couper le
//     réseau figerait indéfiniment un accès révoqué.
//  2. REVALIDATION AU RETOUR AU PREMIER PLAN. Le SDK Firestore ne signale pas
//     l'obsolescence : hors ligne, l'abonnement ne remonte ni instantané ni
//     erreur — il se tait, et le dernier état lu reste vrai pour l'application.
//     Au retour de l'application au premier plan, on repose donc l'abonnement,
//     on repasse en `chargement` (donc purge, donc pas d'espace coach), et on
//     n'affiche à nouveau qu'après confirmation. Si rien n'arrive dans le délai
//     imparti, on tombe en `indetermine` — jamais en « on garde ce qu'on avait ».

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../services/firebase";
import {
  espacesDisponibles,
  readMembershipAccessRole,
  resolveAppSpace,
  type AppSpace,
  type AppSpaceDecision,
  type ClubMembershipReading,
} from "../domain/appSpace";
import { resolveCoachAuthority, type CoachAuthorityStatut } from "../domain/coachAuthority";
import { isClubStaffRole, type ClubAccessRole } from "../domain/clubRoles";
import { publishCoachAuthority } from "../state/coachAuthorityGate";
import { useAppSpacePreference } from "./useAppSpacePreference";

/**
 * Délai au-delà duquel une REVALIDATION qui n'a pas abouti devient un
 * `indetermine`.
 *
 * Il ne s'applique QU'À la revalidation, jamais au démarrage à froid. La raison
 * est asymétrique : au démarrage, il n'y a aucune donnée coach en mémoire à
 * protéger et l'application affiche déjà son écran de chargement ; au retour au
 * premier plan, la donnée est là, et une attente sans fin la laisserait
 * réapparaître à la première confirmation tardive.
 *
 * 8 s : au-delà, un réseau mobile dégradé a de toute façon échoué, et laisser un
 * coach devant un écran de chargement plus longtemps sans rien lui dire serait
 * la « panne » qu'on cherche justement à ne pas simuler.
 */
export const APP_SPACE_REVALIDATION_TIMEOUT_MS = 8_000;

export type AppSpaceState = {
  /**
   * Ce que la navigation doit faire, `en-attente` compris. C'est la valeur à
   * consulter pour savoir s'il faut encore afficher l'écran de chargement.
   */
  decision: AppSpaceDecision;
  /**
   * L'espace à afficher une fois la décision prise. Vaut `"player"` tant que la
   * décision est `en-attente` : ne l'utilise JAMAIS sans avoir testé `decision`,
   * sinon l'espace joueur clignote devant un coach au démarrage.
   */
  space: AppSpace;
  /**
   * L'autorité coach en QUATRE états (cf. `domain/coachAuthority`). C'est elle
   * qui décide de l'affichage ET de la purge ; `space` n'en est qu'une lecture
   * appauvrie, conservée pour l'aiguillage joueur.
   */
  autorite: CoachAuthorityStatut;
  /**
   * L'autorité coach a-t-elle été CONFIRMÉE au moins une fois pour ce couple
   * (compte, club) ?
   *
   * Cette mémoire n'ouvre RIEN — elle ne fait que choisir entre deux états déjà
   * fermés : afficher l'espace joueur (défaut silencieux), ou dire honnêtement
   * « je n'ai pas pu vérifier tes accès ». Montrer ce second écran à un joueur
   * qui n'a jamais encadré serait un mensonge de plus ; le cacher à un coach qui
   * vient d'être coupé du réseau en serait un autre.
   */
  autoriteDejaConfirmee: boolean;
  /**
   * Permission d'encadrement lue, ou `null`. Pour DIRE l'état, jamais pour
   * ouvrir un droit.
   */
  membershipAccessRole: ClubAccessRole | null;
  /** La lecture de l'appartenance a échoué (incident, pas un refus attendu). */
  membershipUnreadable: boolean;
  /**
   * La personne a-t-elle RÉELLEMENT les deux espaces ? C'est la seule condition
   * d'affichage du sélecteur Joueur/Coach — et elle est dérivée du serveur, pas
   * de la préférence locale.
   */
  peutChoisirEspace: boolean;
  /**
   * Mémorise l'espace choisi. N'a d'effet que si les deux sont ouverts : la
   * préférence CHOISIT, elle n'OUVRE jamais (cf. domain/appSpace).
   */
  choisirEspace: (espace: AppSpace) => void;
  /** Repose l'abonnement et repasse par `chargement` (bouton « Réessayer »). */
  revalider: () => void;
};

export type UseAppSpaceOptions = {
  /** Délai de revalidation. Injectable pour les tests ; jamais en production. */
  delaiRevalidationMs?: number;
};

/** Ce qui a été reçu du serveur, et de quoi ça parle. */
type Recu = {
  /** Couple (compte, club) + numéro de revalidation : de quel abonnement ça vient. */
  cle: string;
  /** Couple (compte, club) seul : ce qui survit à une revalidation. */
  cleBase: string;
  lecture: ClubMembershipReading;
  /**
   * L'autorité d'encadrement a-t-elle été confirmée pour ce `cleBase` ?
   * Portée par l'état reçu plutôt que par un état séparé : une mémoire qui vit
   * à côté finit toujours par se désynchroniser d'un rendu.
   */
  confirmeCoach: boolean;
};

/**
 * @param uid    compte connecté, ou `null` (déconnecté : aucun abonnement).
 * @param clubId `users/{uid}.clubId`, ou `null`.
 *
 * SUR `clubId`, QUI EST ÉCRIVABLE PAR L'UTILISATEUR. Ce champ ne dit pas QUI
 * on est, il dit OÙ regarder. Le pointer ailleurs ne fabrique aucune
 * appartenance : on lirait `clubs/{autre}/members/{uid}`, qui n'existe pas, donc
 * espace joueur. Le falsifier ne peut que se retirer un accès à soi-même, jamais
 * en obtenir un. Ce qui DÉCIDE reste le rôle, et lui, aucun client ne l'écrit.
 */
export function useAppSpace(
  params: { uid: string | null; clubId: string | null },
  options?: UseAppSpaceOptions,
): AppSpaceState {
  const uid = params.uid;
  const clubId = params.clubId;

  // Clé de l'abonnement en cours. Elle sert à savoir, PENDANT LE RENDU, si
  // l'instantané que l'on détient décrit bien le couple (compte, club) courant.
  // Sans elle, un changement de compte afficherait une fraction de seconde
  // l'espace dérivé de l'appartenance du compte précédent.
  const cleBase = uid && clubId ? `${uid} ${clubId}` : null;

  // Numéro de revalidation. Le faire entrer dans la clé d'abonnement est ce qui
  // rend la revalidation HONNÊTE : l'instantané précédent cesse mécaniquement de
  // décrire l'abonnement courant, donc la lecture retombe en `en-attente` — on
  // ne peut pas réafficher « en attendant ».
  const [revalidation, setRevalidation] = useState(0);
  const cle = cleBase ? `${cleBase} ${revalidation}` : null;

  // État MINIMAL : uniquement ce qui vient du serveur, et la clé qui dit de quoi
  // il parle. Tout le reste est dérivé pendant le rendu — donc aucun `setState`
  // au montage, et aucun rendu en cascade.
  const [recu, setRecu] = useState<Recu | null>(null);

  const revalider = useCallback(() => {
    setRevalidation((n) => n + 1);
  }, []);

  // ── RETOUR AU PREMIER PLAN ────────────────────────────────────────────────
  // On ne se fie PAS à l'état précédent tel quel : sur iOS, revenir depuis le
  // sélecteur d'applications passe par `background → inactive → active`, donc
  // l'état juste avant `active` est `inactive`, pas `background`. On mémorise
  // donc « a-t-on vu le fond depuis le dernier retour ». Corollaire voulu : les
  // `inactive` passagers (centre de contrôle, bannière de notification, appel
  // entrant) ne déclenchent RIEN — sinon chaque bascule d'écran purgerait
  // l'effectif du coach en pleine consultation.
  useEffect(() => {
    if (!cleBase) return undefined;
    let vuEnFond = false;
    const sub = AppState.addEventListener("change", (etat) => {
      if (etat === "background") {
        vuEnFond = true;
        return;
      }
      if (etat === "active" && vuEnFond) {
        vuEnFond = false;
        setRevalidation((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, [cleBase]);

  // ── L'ABONNEMENT ──────────────────────────────────────────────────────────
  const delaiRevalidation = options?.delaiRevalidationMs ?? APP_SPACE_REVALIDATION_TIMEOUT_MS;
  // Le délai est stabilisé par ref (même motif que les hooks coach) : un
  // littéral passé par l'appelant ne doit pas reposer l'abonnement à chaque rendu.
  const delaiRef = useRef(delaiRevalidation);
  useEffect(() => {
    delaiRef.current = delaiRevalidation;
  });

  useEffect(() => {
    if (!cle || !cleBase || !uid || !clubId) return undefined;
    // `annule` couvre la fenêtre entre le démontage et l'arrivée d'un instantané
    // déjà en vol : `unsubscribe()` coupe la source, il ne rembobine pas ce qui
    // a déjà été émis.
    let annule = false;

    // Une lecture qui ÉCHOUE et une revalidation qui N'ABOUTIT PAS sont le même
    // fait pour l'application : on ne sait pas. Même écriture, donc.
    const marquerIllisible = () => {
      if (annule) return;
      setRecu((prev) => ({
        cle,
        cleBase,
        lecture: { statut: "illisible" },
        // La mémoire d'une autorité confirmée SURVIT à l'incertitude : c'est
        // elle qui permet de dire « je n'ai pas pu vérifier TES accès » plutôt
        // que de reverser un coach dans l'espace joueur sans un mot.
        confirmeCoach: prev?.cleBase === cleBase ? prev.confirmeCoach : false,
      }));
    };

    // Délai de garde : UNIQUEMENT sur revalidation (cf. la constante).
    const minuteur =
      revalidation > 0 ? setTimeout(marquerIllisible, delaiRef.current) : null;
    const arreterMinuteur = () => {
      if (minuteur !== null) clearTimeout(minuteur);
    };

    const unsubscribe = onSnapshot(
      doc(db, "clubs", clubId, "members", uid),
      (snap) => {
        if (annule) return;
        arreterMinuteur();
        // LES DEUX AXES SONT LUS ENSEMBLE, depuis le même instantané : c'est ce
        // qui rend impossible d'afficher un état mi-ancien mi-nouveau.
        const donnees = snap.exists() ? snap.data() : null;
        const accessRole = donnees?.accessRole ?? null;
        const playerStatus = donnees?.playerStatus ?? null;
        setRecu({
          cle,
          cleBase,
          lecture: { statut: "lu", accessRole, playerStatus },
          // Une lecture ABOUTIE fait autorité dans les deux sens : elle pose la
          // mémoire pour un encadrant, et elle l'efface pour tous les autres.
          confirmeCoach: isClubStaffRole(accessRole),
        });
      },
      () => {
        // Échec de lecture. On ne DEVINE pas : `illisible` est un état nommé, et
        // il ferme l'espace coach comme un refus (`indetermine`). Firestore
        // démonte l'abonnement après une erreur ; il sera reposé au prochain
        // changement de compte/club, au prochain retour au premier plan, ou par
        // le bouton « Réessayer ».
        arreterMinuteur();
        marquerIllisible();
      },
    );
    return () => {
      annule = true;
      arreterMinuteur();
      unsubscribe();
    };
  }, [cle, cleBase, uid, clubId, revalidation]);

  // ── DÉRIVATION PENDANT LE RENDU ───────────────────────────────────────────
  // Faite ici, et pas dans un effet : l'aiguillage doit changer DANS LE MÊME
  // rendu que l'instantané qui le motive. Un état intermédiaire laisserait
  // l'espace coach affiché une image de plus après une révocation — « en temps
  // réel » ne supporte pas une image de retard.
  const lecture: ClubMembershipReading = !cle
    ? { statut: "aucun-club" }
    : recu?.cle === cle
      ? recu.lecture
      : { statut: "en-attente" };

  // La préférence locale ne pèse QUE sur le cas « les deux espaces sont
  // ouverts » (cf. domain/appSpace). Le hook est monté inconditionnellement —
  // les hooks React n'admettent pas d'être appelés sous condition — mais son
  // attente n'est consultée que dans ce cas-là.
  const { preference, choisirEspace } = useAppSpacePreference(uid);

  const espaces = espacesDisponibles(lecture);
  const decision = resolveAppSpace(lecture, preference);
  const autorite = resolveCoachAuthority(lecture);
  const membershipAccessRole = readMembershipAccessRole(lecture);
  const autoriteDejaConfirmee = Boolean(cleBase && recu?.cleBase === cleBase && recu.confirmeCoach);

  // ── PUBLICATION DE L'AUTORITÉ (et donc de la purge) ───────────────────────
  // Le jeton est incrémenté à chaque CHANGEMENT d'autorité — compte, club,
  // statut ou rôle. Deux instantanés identiques ne le bougent pas : une lecture
  // coach en vol sous une autorité stable doit pouvoir aboutir, sinon le
  // garde-fou deviendrait un blocage permanent.
  const identite = `${uid ?? ""}|${clubId ?? ""}|${autorite}|${membershipAccessRole ?? ""}`;
  const identiteRef = useRef<string | null>(null);
  const jetonRef = useRef(0);
  useEffect(() => {
    if (identiteRef.current === identite) return;
    identiteRef.current = identite;
    jetonRef.current += 1;
    // Publication APRÈS le rendu : à cet instant, React a déjà démonté l'espace
    // coach si l'autorité l'exigeait. La purge arrive donc sur un arbre déjà
    // fermé — elle couvre ce que le démontage ne couvre pas (stores, caches).
    publishCoachAuthority({ statut: autorite, jeton: jetonRef.current });
  }, [identite, autorite]);

  return {
    decision,
    space: decision === "coach" ? "coach" : "player",
    autorite,
    autoriteDejaConfirmee,
    membershipAccessRole,
    membershipUnreadable: lecture.statut === "illisible",
    // DÉRIVÉ DU SERVEUR, jamais de la préférence : le sélecteur n'apparaît que
    // si les deux espaces sont réellement ouverts.
    peutChoisirEspace: espaces.coach && espaces.joueur,
    choisirEspace,
    revalider,
  };
}
