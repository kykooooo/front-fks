// hooks/useMonClub.ts
//
// « SUIS-JE DANS UN CLUB ? » — la seule question que l'onglet Profil pose.
//
// Elle existe parce que l'inscription pouvait échouer au rattachement sans
// laisser AUCUNE trace : le joueur croyait avoir rejoint son club, le coach ne
// le voyait jamais dans son effectif, et l'app ne le disait nulle part (P0-01
// de l'audit d'inscription du 05/09). Une rangée « Mon club » qui dit « Aucun
// club » est le seul indicateur permanent qui rattrape ce silence.
//
// CE HOOK NE DÉCIDE RIEN, ET N'ACCORDE RIEN. Il lit `users/{uid}.clubId` — OÙ
// regarder, jamais QUI on est — et le nom du club pour l'afficher. L'autorité
// (espace coach, droits) reste dérivée de l'appartenance
// `clubs/{clubId}/members/{uid}`, côté serveur (domain/appSpace.ts).
//
// `chargement` est un état À PART ENTIÈRE : tant qu'on ne SAIT pas, on
// n'affiche pas « Aucun club » — ce serait annoncer une absence qu'on n'a pas
// constatée (règle 12, jamais de valeur de remplissage).

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../services/firebase";

export type MonClub = {
  /** `null` = aucun club rattaché. `undefined` n'existe pas ici : voir `chargement`. */
  clubId: string | null;
  /** Nom lisible du club, `null` tant qu'il n'a pas pu être lu. */
  clubName: string | null;
  chargement: boolean;
};

export function useMonClub(): MonClub {
  const uid = auth.currentUser?.uid ?? null;
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  // Pas de compte = rien à charger, et l'état de départ le dit dès le premier
  // rendu (plutôt qu'un `setChargement(false)` dans l'effet, qui serait un
  // rendu de plus pour une réponse déjà connue).
  const [chargement, setChargement] = useState(() => !!uid);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.data() as { clubId?: unknown } | undefined;
        const brut = typeof data?.clubId === "string" ? data.clubId.trim() : "";
        setClubId(brut || null);
        setChargement(false);
      },
      // Une lecture refusée ou coupée n'invente pas une absence de club : on
      // sort du chargement, le nom reste inconnu, et la rangée le dit.
      () => setChargement(false),
    );
  }, [uid]);

  useEffect(() => {
    if (!clubId) {
      // Remise à zéro SYNCHRONE assumée : sans elle, le nom du club précédent
      // resterait affiché après un départ de club — un nom qui ne correspond
      // plus à rien est pire qu'un vide.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClubName(null);
      return;
    }
    let vivant = true;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, "clubs", clubId));
        const nom = (snap.data() as { name?: unknown } | undefined)?.name;
        if (vivant) setClubName(typeof nom === "string" && nom.trim() ? nom.trim() : null);
      } catch {
        if (vivant) setClubName(null);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [clubId]);

  return { clubId, clubName, chargement };
}
