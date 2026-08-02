// hooks/useAppSpacePreference.ts
//
// LA MÉMOIRE LOCALE DU DERNIER ESPACE UTILISÉ (Joueur / Coach).
//
// Exigence produit, mot pour mot : « si une personne possède les deux espaces,
// l'application propose un sélecteur Joueur/Coach et MÉMORISE LOCALEMENT le
// dernier espace utilisé ».
//
// ─── CE QUE CETTE MÉMOIRE N'EST PAS ─────────────────────────────────────────
// Ce n'est PAS une source d'autorité, et c'est le point le plus important du
// fichier. Ce qu'elle contient ne peut RIEN ouvrir : `resolveAppSpace`
// (domain/appSpace) l'applique UNIQUEMENT quand le serveur a déjà accordé les
// deux espaces. Une valeur falsifiée dans le stockage local choisit donc entre
// deux écrans autorisés, elle n'en déverrouille aucun.
//
// Corollaire, testé : un compte qui perd l'encadrement bascule vers l'espace
// joueur même si sa préférence dit « coach ». La préférence n'est pas effacée
// pour autant — s'il retrouve l'encadrement, son choix d'avant est toujours là.
// L'effacer aurait été une punition silencieuse pour une révocation subie.
//
// ─── POURQUOI AsyncStorage, ET PAS UN TROISIÈME MÉCANISME ───────────────────
// Le dépôt persiste déjà localement de deux façons : le middleware `persist` de
// Zustand, et des clés AsyncStorage nommées dans `constants/storage.ts`
// (WELCOME_DONE, ONBOARDING_START_TS, snapshots par compte…). Cette préférence
// est exactement de la même nature que WELCOME_DONE — un drapeau d'interface,
// par appareil — donc elle emprunte le même chemin, avec sa clé déclarée au même
// endroit. Inventer un troisième mécanisme aurait ajouté un endroit de plus où
// oublier d'effacer quelque chose.
//
// ─── PAR COMPTE, ET EFFACÉE AVEC LE COMPTE ──────────────────────────────────
// La clé porte l'uid (`STORAGE_KEYS.APP_SPACE_PREFERENCE`) : sur un téléphone
// partagé, le choix d'un compte n'est pas hérité par le suivant. Et elle figure
// dans `localAccountKeysToPurge` : supprimer son compte l'emporte avec le reste.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../constants/storage";
import type { AppSpace } from "../domain/appSpace";

/** Valeur reconnue, ou `null`. Tout le reste est traité comme « rien de choisi ». */
export function normalizeAppSpacePreference(value: unknown): AppSpace | null {
  return value === "coach" || value === "player" ? value : null;
}

export type AppSpacePreferenceState = {
  /**
   * `"en-attente"` tant que le stockage n'a pas répondu, puis l'espace mémorisé
   * ou `null` si aucun choix n'a jamais été fait.
   *
   * L'attente est réelle mais elle ne coûte à personne : `resolveAppSpace` ne
   * la consulte que lorsque les DEUX espaces sont ouverts. Un joueur ordinaire
   * comme un coach ordinaire sont aiguillés sans jamais l'attendre.
   */
  preference: AppSpace | null | "en-attente";
  /** Mémorise un choix. L'état local change tout de suite ; l'écriture suit. */
  choisirEspace: (espace: AppSpace) => void;
};

/**
 * Ce qui a été lu (ou choisi), ET pour quel compte. Le couple est indissociable :
 * une valeur sans son compte ne dit pas de qui elle parle, et c'est comme ça
 * qu'une lecture lente portant sur le compte précédent finirait par s'appliquer
 * au suivant.
 */
type Connu = { compte: string; valeur: AppSpace | null };

export function useAppSpacePreference(uid: string | null): AppSpacePreferenceState {
  const [connu, setConnu] = useState<Connu | null>(null);

  useEffect(() => {
    // Déconnecté : rien à lire. Aucun `setState` ici — l'état est DÉRIVÉ pendant
    // le rendu (plus bas), donc il n'y a rien à remettre à zéro.
    if (!uid) return undefined;
    let annule = false;
    (async () => {
      let valeur: AppSpace | null = null;
      try {
        valeur = normalizeAppSpacePreference(
          await AsyncStorage.getItem(STORAGE_KEYS.APP_SPACE_PREFERENCE(uid)),
        );
      } catch {
        // Stockage illisible : on ne bloque pas l'application sur un drapeau
        // d'interface. `null` = « rien de choisi », donc le défaut s'applique.
        valeur = null;
      }
      if (!annule) setConnu({ compte: uid, valeur });
    })();
    return () => {
      annule = true;
    };
  }, [uid]);

  // DÉRIVATION PENDANT LE RENDU. Elle rend impossible d'afficher la préférence
  // d'un autre compte : tant que ce qu'on détient ne parle pas du compte courant,
  // la réponse est « en attente », jamais la valeur d'avant.
  const preference: AppSpace | null | "en-attente" =
    uid === null ? null : connu?.compte === uid ? connu.valeur : "en-attente";

  // Dépend de `uid`, et c'est volontaire : la fonction porte ainsi le compte
  // auquel le choix se rapporte. Une version stable devrait lire l'uid dans une
  // ref — donc pendant le rendu — et un changement de compte pendant une
  // écriture lente écrirait le choix sous la mauvaise clé.
  const choisirEspace = useCallback(
    (espace: AppSpace) => {
      // L'état local d'abord : la bascule doit être immédiate à l'écran, pas
      // suspendue à une écriture disque. Si l'écriture échoue, le choix vaut
      // pour la session en cours et sera simplement oublié au redémarrage — ce
      // qui est exactement le comportement d'avant ce lot, donc jamais une
      // régression.
      if (!uid) return;
      setConnu({ compte: uid, valeur: espace });
      AsyncStorage.setItem(STORAGE_KEYS.APP_SPACE_PREFERENCE(uid), espace).catch(() => {});
    },
    [uid],
  );

  return { preference, choisirEspace };
}
