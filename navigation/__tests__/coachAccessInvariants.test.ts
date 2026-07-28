// navigation/__tests__/coachAccessInvariants.test.ts
//
// LES SEPT INVARIANTS D'ACCÈS À L'ESPACE COACH, UN PAR UN.
//
// Ils sont écrits ici ENSEMBLE et NUMÉROTÉS parce qu'ils forment une liste que
// quelqu'un doit pouvoir relire d'un trait avant une mise en production. Chacun
// est vérifié soit sur le comportement (fonctions pures de `domain/`), soit sur
// la source du navigateur quand le comportement n'est pas atteignable sans
// monter Firebase et l'intégralité des écrans — même méthode que
// `rootNavigatorSpaceWiring.test.ts`, et pour la même raison.
//
// Ce fichier ne DUPLIQUE pas les suites existantes : quand un invariant est déjà
// prouvé ailleurs, il est vérifié ici sous l'angle de l'ACCÈS, et le renvoi est
// écrit noir sur blanc.

import { readFileSync } from "fs";
import { resolve } from "path";

import { resolveAppSpace, type ClubMembershipReading } from "../../domain/appSpace";
import {
  ouvreEspaceCoach,
  resolveClubPointer,
  resolveCoachAuthority,
} from "../../domain/coachAuthority";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
const navigateur = lire("navigation/RootNavigator.tsx");

const lu = (role: unknown): ClubMembershipReading => ({ statut: "lu", role });
/** L'espace coach s'ouvre-t-il, pour de vrai, sur cette lecture ? */
const ouvre = (lecture: ClubMembershipReading) => ouvreEspaceCoach(resolveCoachAuthority(lecture));

describe("INVARIANT 1 — l'existence d'une appartenance ne suffit pas", () => {
  test("il faut le rôle d'encadrement ET une appartenance active", () => {
    // Encadrement + actif : ouvre.
    expect(ouvre(lu("owner"))).toBe(true);
    expect(ouvre(lu("coach"))).toBe(true);
    // Appartenance bien réelle, mais sans encadrement : n'ouvre pas.
    expect(ouvre(lu("player"))).toBe(false);
    // Encadrement révoqué (pierre tombale) : l'appartenance EXISTE encore en
    // base, elle n'est simplement plus active. Elle n'ouvre rien.
    expect(ouvre(lu("removed"))).toBe(false);
  });
});

describe("INVARIANT 2 — player, pending, revoked, absent, inconnu n'ouvrent JAMAIS", () => {
  test.each([
    ["player", "player"],
    ["pending", "pending"],
    ["revoked", "revoked"],
    ["removed (la pierre tombale du serveur)", "removed"],
    ["valeur absente", null],
    ["valeur non renseignée", undefined],
    ["chaîne vide", ""],
    ["casse différente", "OWNER"],
    ["rôle inventé", "admin"],
    ["booléen", true],
    ["objet", {}],
    ["tableau contenant le bon rôle", ["owner"]],
  ])("%s → aucun espace coach", (_nom, role) => {
    expect(ouvre(lu(role))).toBe(false);
  });
});

describe("INVARIANT 3 — pendant le chargement ou sur erreur, AUCUN accès par défaut", () => {
  test("chargement : ni coach, ni joueur — on attend", () => {
    expect(ouvre({ statut: "en-attente" })).toBe(false);
    expect(resolveAppSpace({ statut: "en-attente" })).toBe("en-attente");
  });

  test("erreur de lecture : `indetermine`, et surtout pas d'espace coach", () => {
    expect(resolveCoachAuthority({ statut: "illisible" })).toBe("indetermine");
    expect(ouvre({ statut: "illisible" })).toBe(false);
  });

  test("le navigateur attend AVANT de choisir un espace", () => {
    expect(navigateur).toContain('appSpace.decision === "en-attente"');
    expect(navigateur.indexOf('appSpace.decision === "en-attente"')).toBeLessThan(
      navigateur.indexOf('appSpace.space === "coach"'),
    );
  });

  test("une autorité invérifiable ne tombe pas dans l'espace coach", () => {
    // L'écran d'accès non vérifié est branché AVANT le choix de l'espace coach.
    expect(navigateur).toContain('appSpace.autorite === "indetermine"');
    expect(navigateur.indexOf('appSpace.autorite === "indetermine"')).toBeLessThan(
      navigateur.indexOf('appSpace.space === "coach"'),
    );
  });
});

describe("INVARIANT 4 — la pierre tombale fait disparaître l'espace coach en temps réel", () => {
  test("`removed` ferme, sur la même lecture", () => {
    expect(ouvre(lu("coach"))).toBe(true);
    expect(ouvre(lu("removed"))).toBe(false);
  });

  test("l'aiguillage est calculé PENDANT le rendu, pas dans un effet", () => {
    // Un état intermédiaire laisserait l'espace coach affiché une image de plus
    // après la révocation. « Temps réel » ne supporte pas une image de retard.
    // La bascule elle-même est prouvée dans hooks/__tests__/useAppSpace.test.tsx
    // (« la pierre tombale purge, EN TEMPS RÉEL, sur le même montage »).
    const hook = lire("hooks/useAppSpace.ts");
    const derivation = hook.indexOf("const decision = resolveAppSpace(lecture)");
    expect(derivation).toBeGreaterThan(-1);
    // La dérivation ne passe par aucun `setState` : elle est faite au rendu.
    expect(hook.slice(derivation, derivation + 400)).not.toContain("setState");
  });
});

describe("INVARIANT 5 — les actions sensibles sont autorisées côté SERVEUR, jamais par la navigation", () => {
  test("le retrait d'un membre appelle le serveur sans pré-juger du rôle", () => {
    const hook = lire("hooks/coach/useRemoveClubMember.ts");
    // Aucun prédicat de rôle ici : le front qui anticipe un refus finit toujours
    // par se tromper dans un sens (bouton caché à tort) ou dans l'autre
    // (promesse non tenue).
    expect(hook).not.toMatch(/isClubStaffRole|CLUB_STAFF_ROLES|role\s*===\s*"(owner|coach)"/);
    expect(hook).toContain("removeClubMemberCall(clubId, memberUid)");
  });

  test("la dérivation d'espace n'accorde aucun droit : elle choisit un écran", () => {
    const domaine = lire("domain/coachAuthority.ts");
    expect(domaine).toContain("Il n'accorde AUCUN droit");
    // Et elle ne sait rien écrire : aucun appel Firestore dans le domaine.
    expect(domaine).not.toMatch(/setDoc|updateDoc|deleteDoc|httpsCallable/);
  });

  test("le portillon d'autorité ne supprime rien en base", () => {
    const portillon = lire("state/coachAuthorityGate.ts");
    expect(portillon).not.toMatch(/setDoc|updateDoc|deleteDoc|httpsCallable|firebase/);
  });
});

describe("INVARIANT 6 — falsifier `clubId` ou l'ancien champ client n'ouvre rien", () => {
  test("`users/{uid}.role` n'est plus lu pour router", () => {
    expect(navigateur).not.toMatch(/data\?\.role/);
    // Et il n'est même pas un paramètre de la dérivation (preuve la plus courte).
    expect(resolveAppSpace).toHaveLength(1);
  });

  test("pointer `clubId` ailleurs ne fabrique aucune appartenance", () => {
    // On lirait `clubs/{autre}/members/{uid}`, qui n'existe pas → rôle absent.
    // Le comportement complet est prouvé dans hooks/__tests__/useAppSpace.test.tsx.
    expect(ouvre(lu(null))).toBe(false);
  });

  test("aucun rôle applicatif n'est écrit côté application", () => {
    for (const chemin of [
      "repositories/clubsRepo.ts",
      "screens/CoachOnboardingScreen.tsx",
      "components/settings/ClubManagementCard.tsx",
    ]) {
      expect(lire(chemin)).not.toMatch(/role:\s*"coach"/);
    }
  });
});

describe("INVARIANT 7 — plusieurs clubs : un refus explicite, jamais le premier de la liste", () => {
  test("un pointeur ambigu ne produit AUCUN club", () => {
    const p = resolveClubPointer(["clubA", "clubB"]);
    expect(p.statut).toBe("ambigu");
    expect("clubId" in p).toBe(false);
  });

  test("le navigateur ne retient qu'un pointeur `unique`", () => {
    expect(navigateur).toContain("resolveClubPointer(data?.clubId)");
    expect(navigateur).toContain('pointeur.statut === "unique" ? pointeur.clubId : null');
  });

  test("le contexte club lit le pointeur de la MÊME façon que le navigateur", () => {
    // Deux endroits qui lisent le même champ doivent le lire pareil, sinon l'un
    // ouvre ce que l'autre ferme.
    const hook = lire("hooks/coach/useCoachClub.ts");
    expect(hook).toContain("resolveClubPointer(raw)");
    expect(hook).toContain('pointeur.statut === "unique" ? pointeur.clubId : null');
  });

  test("personne ne prend `[0]` d'une liste de clubs", () => {
    for (const chemin of [
      "navigation/RootNavigator.tsx",
      "hooks/useAppSpace.ts",
      "hooks/coach/useCoachClub.ts",
      "domain/coachAuthority.ts",
    ]) {
      const source = lire(chemin);
      expect(source).not.toMatch(/clubIds?\s*\[\s*0\s*\]/);
      expect(source).not.toMatch(/clubs\s*\[\s*0\s*\]/);
    }
  });
});
