// domain/coachAuthority.ts
//
// L'AUTORITE COACH, EN QUATRE ETATS — et ce que chacun ouvre ou ferme.
//
// ─── LE DEFAUT CORRIGE ICI ──────────────────────────────────────────────────
// `domain/appSpace.resolveAppSpace` repond a UNE question : quel espace afficher,
// coach ou joueur. Elle y repond bien, mais elle FOND deux situations qui n'ont
// rien a voir :
//
//   . « l'appartenance dit que tu n'es pas encadrant »   → un fait etabli ;
//   . « l'appartenance n'a pas pu etre lue »             → une question sans reponse.
//
// Les deux retombent sur l'espace joueur, ce qui est le bon default-deny pour
// l'AFFICHAGE. Mais pour la DONNEE deja chargee en memoire, les confondre est un
// trou : tant qu'on ne distingue pas « on sait que non » de « on ne sait pas »,
// on ne peut pas ecrire la regle qui compte — celle qui dit qu'une question sans
// reponse doit fermer ET vider, exactement comme un refus.
//
// ─── POURQUOI L'INCERTITUDE FERME, ELLE AUSSI ───────────────────────────────
// Decision produit, prise pour le pilote : « je n'autoriserais pas un espace
// Coach hors ligne : conserver des donnees de joueurs sans pouvoir verifier les
// droits serait un mauvais compromis ».
//
// Le raisonnement tient en une phrase : si l'incertitude conservait l'affichage,
// il suffirait de couper le reseau pour figer indefiniment un acces revoque.
// Le mode avion deviendrait la faille. On preferera toujours un ecran honnete
// qui dit « je n'ai pas pu verifier » a un ecran qui montre l'effectif d'hier
// avec l'assurance d'aujourd'hui.
//
// ─── CE QUE CE MODULE N'EST PAS ─────────────────────────────────────────────
// Il n'accorde AUCUN droit. Les droits sont accordes par les regles Firestore et
// par les Cloud Functions, et par elles seules. Ici on decide de ce que
// l'application AFFICHE et de ce qu'elle GARDE en memoire. Un ecran ferme ne
// protege rien contre un attaquant — il protege un coach retire de continuer a
// lire, de bonne foi, des donnees qui ne le regardent plus.

import { isClubStaffRole } from "./clubRoles";
import type { ClubMembershipReading } from "./appSpace";

/**
 * Les QUATRE etats de l'autorite coach, exigence produit mot pour mot :
 * « loading ; authorized confirme ; unauthorized ; unconfirmed/error ».
 *
 *  - `chargement`   : on n'a pas encore de reponse. Ni oui, ni non ;
 *  - `autorise`     : appartenance LUE et porteuse d'un role d'encadrement.
 *                     C'est le seul etat CONFIRME qui ouvre quoi que ce soit ;
 *  - `refuse`       : appartenance LUE, et elle ne donne pas l'encadrement
 *                     (joueur, pierre tombale, role inconnu, aucun club) ;
 *  - `indetermine`  : la lecture a echoue ou n'a pas abouti. On ne sait pas.
 */
export type CoachAuthorityStatut = "chargement" | "autorise" | "refuse" | "indetermine";

/**
 * LA derivation. Elle prend la MEME lecture que `resolveAppSpace` — il n'y a
 * qu'une source d'autorite dans cette application, et c'est
 * `clubs/{clubId}/members/{uid}.role`.
 *
 * `aucun-club` donne `refuse` et NON `indetermine` : ne pas avoir de club n'est
 * pas une question sans reponse, c'est une reponse. Il n'y a rien a attendre,
 * rien a reessayer, et surtout aucun ecran d'erreur a montrer a un joueur qui
 * n'a jamais eu d'espace coach.
 */
export function resolveCoachAuthority(lecture: ClubMembershipReading): CoachAuthorityStatut {
  switch (lecture.statut) {
    case "en-attente":
      return "chargement";
    case "illisible":
      return "indetermine";
    case "aucun-club":
      return "refuse";
    case "lu":
      // SEULES les permissions d'encadrement sont regardées. Le statut de
      // joueur n'entre pas ici : un entraineur-joueur garde son autorite coach
      // pleine et entiere, et un joueur pur n'en obtient jamais. Melanger les
      // deux axes rouvrirait exactement le defaut que le modele vient de fermer.
      return isClubStaffRole(lecture.accessRole) ? "autorise" : "refuse";
  }
}

/**
 * L'espace coach s'ouvre-t-il ? UN SEUL etat le permet, et c'est le seul qui
 * soit a la fois lu et confirme.
 */
export function ouvreEspaceCoach(statut: CoachAuthorityStatut): boolean {
  return statut === "autorise";
}

/**
 * Faut-il PURGER les donnees coach deja chargees ?
 *
 * La reponse est le complement exact de la precedente, et c'est volontaire : il
 * ne doit exister aucun etat ou l'on ferme l'affichage tout en gardant la donnee.
 * Un ecran ferme sur une donnee encore en memoire, c'est une donnee qui attend
 * la prochaine occasion de reapparaitre.
 *
 * `chargement` purge AUSSI. C'est ce qui rend la revalidation au retour au
 * premier plan reellement protectrice : on vide d'abord, on reaffiche seulement
 * apres confirmation. L'inverse — garder « en attendant » — reafficherait la
 * donnee avant de savoir si elle est encore permise.
 */
export function purgeDonneesCoach(statut: CoachAuthorityStatut): boolean {
  return !ouvreEspaceCoach(statut);
}

/**
 * CE QU'ON DIT AU COACH QUAND ON N'A PAS PU VERIFIER.
 *
 * Deux mensonges a eviter, dans les deux sens :
 *   . « Une erreur est survenue »  → il croit l'application cassee et attend ;
 *   . « Acces non autorise »       → il croit avoir ete retire du club, alors
 *                                    qu'il est peut-etre juste dans un tunnel.
 *
 * On dit donc exactement ce qui est vrai : la verification n'a pas abouti, et
 * elle demande du reseau. On annonce aussi ce qui a ete fait de ses donnees —
 * un ecran vide sans explication laisserait croire a une perte.
 */
export const COACH_ACCESS_UNCONFIRMED_COPY = {
  titre: "Accès non vérifié",
  corps:
    "Impossible de vérifier tes accès — reconnecte-toi au réseau pour retrouver ton effectif. Les données affichées ont été effacées de cet appareil ; rien n'est perdu côté FKS.",
  action: "Réessayer",
} as const;

/**
 * CE QUE `users/{uid}.clubId` DESIGNE — et le refus explicite quand il en
 * designe plusieurs.
 *
 * Aujourd'hui ce champ porte un club et un seul. Le jour ou l'appartenance
 * multiple arrivera, la tentation sera de prendre le premier element de la
 * liste : c'est une bombe a retardement silencieuse, parce qu'un choix implicite
 * ne se voit pas — l'application ouvrirait l'espace d'un club que personne n'a
 * demande, et personne ne saurait dire lequel ni pourquoi.
 *
 * On pose donc le refus MAINTENANT, tant qu'il ne coute rien : plusieurs clubs
 * possibles = `ambigu` = aucun club retenu, donc aucun espace coach. Le jour ou
 * la fonctionnalite existera, il faudra ecrire un vrai selecteur — et ce test
 * tombera pour le rappeler.
 */
export type ClubPointer =
  | { statut: "aucun" }
  | { statut: "unique"; clubId: string }
  | { statut: "ambigu"; nombre: number };

export function resolveClubPointer(raw: unknown): ClubPointer {
  if (Array.isArray(raw)) {
    const valides = raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (valides.length === 0) return { statut: "aucun" };
    // Un seul element exploitable : ce n'est pas un choix, c'est le meme club.
    if (valides.length === 1) return { statut: "unique", clubId: valides[0].trim() };
    return { statut: "ambigu", nombre: valides.length };
  }
  if (typeof raw !== "string") return { statut: "aucun" };
  const clubId = raw.trim();
  return clubId ? { statut: "unique", clubId } : { statut: "aucun" };
}
