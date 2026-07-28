// domain/__tests__/coachAuthority.test.ts
//
// LES QUATRE ETATS DE L'AUTORITE COACH, ET CE QUE CHACUN OUVRE OU FERME.
//
// Ce que ces tests protegent, dans l'ordre d'importance :
//
//  1. UN SEUL ETAT OUVRE. `autorise` — c'est-a-dire une appartenance LUE et
//     porteuse d'un role d'encadrement. Les trois autres ferment.
//  2. LES TROIS AUTRES PURGENT, `chargement` COMPRIS. C'est le point
//     contre-intuitif du lot : une revalidation en cours n'est pas une raison de
//     garder l'effectif a l'ecran « en attendant ».
//  3. L'INCERTITUDE N'EST PAS UN REFUS, ET RECIPROQUEMENT. Les fondre serait
//     rouvrir le trou : si « on ne sait pas » se comportait comme « on sait que
//     oui », couper le reseau figerait un acces revoque ; s'il se comportait
//     comme un refus SILENCIEUX, un coach hors reseau croirait a une panne.
//  4. UN POINTEUR DE CLUB AMBIGU EST REFUSE, JAMAIS RESOLU AU PREMIER ELEMENT.

import {
  COACH_ACCESS_UNCONFIRMED_COPY,
  ouvreEspaceCoach,
  purgeDonneesCoach,
  resolveClubPointer,
  resolveCoachAuthority,
  type CoachAuthorityStatut,
} from "../coachAuthority";
import { resolveAppSpace, type ClubMembershipReading } from "../appSpace";

const lu = (role: unknown): ClubMembershipReading => ({ statut: "lu", role });

const TOUS: CoachAuthorityStatut[] = ["chargement", "autorise", "refuse", "indetermine"];

describe("resolveCoachAuthority — quatre etats, jamais trois", () => {
  test("appartenance lue et encadrante → autorise", () => {
    expect(resolveCoachAuthority(lu("owner"))).toBe("autorise");
    expect(resolveCoachAuthority(lu("coach"))).toBe("autorise");
  });

  test("appartenance lue et NON encadrante → refuse (un fait, pas une incertitude)", () => {
    for (const role of ["player", "removed", "admin", "", null, undefined, 42, {}]) {
      expect(resolveCoachAuthority(lu(role))).toBe("refuse");
    }
  });

  test("premier instantane pas encore arrive → chargement", () => {
    expect(resolveCoachAuthority({ statut: "en-attente" })).toBe("chargement");
  });

  test("lecture en echec → indetermine (et surtout PAS refuse)", () => {
    expect(resolveCoachAuthority({ statut: "illisible" })).toBe("indetermine");
  });

  test("aucun club rattache → refuse, pas indetermine", () => {
    // Ne pas avoir de club n'est pas une question sans reponse : c'est une
    // reponse. Rien a attendre, rien a reessayer, aucun ecran d'erreur a
    // montrer a quelqu'un qui n'a jamais eu d'espace coach.
    expect(resolveCoachAuthority({ statut: "aucun-club" })).toBe("refuse");
  });
});

describe("ce que chaque etat ouvre — et ce qu'il purge", () => {
  test("SEUL `autorise` ouvre l'espace coach", () => {
    for (const statut of TOUS) {
      expect(ouvreEspaceCoach(statut)).toBe(statut === "autorise");
    }
  });

  test("les trois autres purgent — `chargement` compris", () => {
    expect(purgeDonneesCoach("chargement")).toBe(true);
    expect(purgeDonneesCoach("refuse")).toBe(true);
    expect(purgeDonneesCoach("indetermine")).toBe(true);
    expect(purgeDonneesCoach("autorise")).toBe(false);
  });

  test("aucun etat n'ouvre sans garder, ni ne ferme sans purger", () => {
    // L'invariant structurant : « ferme » et « purge » sont le meme predicat.
    // Un etat qui fermerait l'affichage en gardant la donnee la laisserait
    // attendre la prochaine occasion de reapparaitre.
    for (const statut of TOUS) {
      expect(purgeDonneesCoach(statut)).toBe(!ouvreEspaceCoach(statut));
    }
  });
});

describe("coherence avec la derivation d'espace deja en place", () => {
  test("`autorise` et « espace coach » disent exactement la meme chose", () => {
    // Il n'y a qu'une source d'autorite dans cette application. Si ces deux
    // fonctions divergeaient un jour, l'une ouvrirait un espace que l'autre
    // considere ferme — et la purge se declencherait sous un ecran coach vivant.
    const lectures: ClubMembershipReading[] = [
      { statut: "en-attente" },
      { statut: "illisible" },
      { statut: "aucun-club" },
      lu("owner"),
      lu("coach"),
      lu("player"),
      lu("removed"),
      lu(null),
      lu("admin"),
    ];
    for (const lecture of lectures) {
      expect(ouvreEspaceCoach(resolveCoachAuthority(lecture))).toBe(
        resolveAppSpace(lecture) === "coach",
      );
    }
  });
});

describe("la copie du « je ne sais pas »", () => {
  test("elle ne diagnostique pas, et elle dit ce qui a ete fait des donnees", () => {
    const corps = COACH_ACCESS_UNCONFIRMED_COPY.corps;
    // Le constat porte sur la VERIFICATION, pas sur une cause affirmee.
    expect(corps).toContain("vérifier tes accès");
    // Ce qui a ete fait des donnees est annonce : un ecran vide sans un mot
    // laisserait croire a une perte.
    expect(corps).toContain("effacées de cet appareil");
    expect(corps).toContain("rien n'est perdu");
    // Ni promesse de panne, ni accusation de retrait.
    expect(corps).not.toContain("Une erreur est survenue");
    expect(corps).not.toContain("non autorisé");
  });
});

describe("resolveClubPointer — un refus explicite plutot qu'un choix implicite", () => {
  test("chaine simple : le club, nettoye de ses espaces", () => {
    expect(resolveClubPointer(" clubX ")).toEqual({ statut: "unique", clubId: "clubX" });
  });

  test("absent, vide ou mal type → aucun club", () => {
    for (const raw of [null, undefined, "", "   ", 42, true, {}]) {
      expect(resolveClubPointer(raw)).toEqual({ statut: "aucun" });
    }
  });

  test("PLUSIEURS clubs → `ambigu`, et surtout pas le premier de la liste", () => {
    // Un code qui prend [0] d'une liste est une bombe a retardement
    // silencieuse : il ouvrirait l'espace d'un club que personne n'a demande,
    // et personne ne saurait dire lequel ni pourquoi.
    const p = resolveClubPointer(["clubA", "clubB"]);
    expect(p.statut).toBe("ambigu");
    expect(JSON.stringify(p)).not.toContain("clubA");
  });

  test("liste d'un seul element exploitable : ce n'est pas un choix", () => {
    expect(resolveClubPointer(["clubA", "", 7])).toEqual({ statut: "unique", clubId: "clubA" });
  });

  test("liste vide ou sans element exploitable → aucun club", () => {
    expect(resolveClubPointer([])).toEqual({ statut: "aucun" });
    expect(resolveClubPointer(["", "  ", null])).toEqual({ statut: "aucun" });
  });

  test("un pointeur ambigu ne peut JAMAIS produire un clubId", () => {
    // La navigation et useCoachClub lisent tous deux ce resultat en ne retenant
    // que `unique`. Ce test verrouille la propriete a la source.
    const p = resolveClubPointer(["a", "b", "c"]);
    expect("clubId" in p).toBe(false);
  });
});
