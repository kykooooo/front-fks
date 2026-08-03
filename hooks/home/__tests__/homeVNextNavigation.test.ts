// hooks/home/__tests__/homeVNextNavigation.test.ts
//
// OU MENE CHAQUE ACTION DU HOME VNEXT — ET SURTOUT : QUE FAIT-ELLE QUAND ELLE
// NE PEUT PAS ABOUTIR ?
//
// Cette suite est organisee autour de la seule question qui a une chance de mal
// tourner en production. Les quatre cibles simples (generation, choix de cycle,
// retour, aucune) sont des constantes : les verifier est une formalite. Les deux
// autres — `session_live` et `session_preview` — dependent d'un JSON qui vit
// dans le store et qui PEUT MANQUER. C'est la que cette suite passe son temps.
//
// Ce qu'elle verrouille, dans l'ordre :
//   1. la traduction elle-meme (cible -> route + parametres) ;
//   2. le fait que la seance visee est bien CELLE QUE LE VIEWMODEL A VUE, pas
//      celle qui se trouve etre selectionnee au moment du tap ;
//   3. les trois manieres dont le contenu peut manquer, qui doivent toutes finir
//      en `indisponible` et JAMAIS en navigation vers un ecran vide.

import {
  resoudreDestinationHome,
  type ContexteNavigationHome,
} from "../homeVNextNavigation";
import type { Session } from "../../../domain/types";

const V2 = { title: "Force bas du corps", durationMin: 45 } as Record<string, unknown>;

function seance(partiel: Partial<Session> & { id: string }): Session {
  return {
    dateISO: "2026-08-03T10:00:00.000Z",
    ...partiel,
  } as Session;
}

function contexte(sur: Partial<ContexteNavigationHome> = {}): ContexteNavigationHome {
  return {
    pendingSessionId: "s1",
    sessions: [seance({ id: "s1", aiV2: V2 })],
    lastAiSessionV2: null,
    ...sur,
  };
}

describe("Les quatre cibles qui ne dependent d'aucune donnee", () => {
  test("generation ouvre l'onglet Seance, pas l'ecran de la pile", () => {
    // La distinction compte : l'onglet garde la tab bar, l'ecran de pile la
    // recouvre et impose un "retour". L'ancien Home ouvrait l'onglet.
    expect(resoudreDestinationHome("generation", contexte())).toEqual({
      kind: "navigate",
      route: "NewSession",
    });
  });

  test("choix_cycle ouvre la modale en mode SELECT, jamais en mode manage", () => {
    // "manage" est le mode « gerer un cycle en cours ». Cette cible n'est emise
    // que lorsqu'aucun cycle n'est actif : y envoyer le joueur lui montrerait un
    // ecran de gestion sans rien a gerer.
    expect(resoudreDestinationHome("choix_cycle", contexte())).toEqual({
      kind: "navigate",
      route: "CycleModal",
      params: { mode: "select", origin: "home" },
    });
  });

  test("feedback emporte l'identifiant de la seance vue a l'ecran", () => {
    expect(resoudreDestinationHome("feedback", contexte())).toEqual({
      kind: "navigate",
      route: "Feedback",
      params: { sessionId: "s1" },
    });
  });

  test("feedback sans identifiant ouvre quand meme l'ecran, qui sait choisir", () => {
    // Un toast d'erreur serait ici une impasse : l'ecran de retour sait
    // selectionner la seance tout seul. On ne bloque pas le joueur sur un ecart
    // d'etat qui n'est pas de son fait.
    expect(resoudreDestinationHome("feedback", contexte({ pendingSessionId: null }))).toEqual({
      kind: "navigate",
      route: "Feedback",
    });
  });

  test("aucune ne navigue nulle part", () => {
    expect(resoudreDestinationHome("aucune", contexte())).toEqual({ kind: "aucune" });
  });
});

describe("Les deux cibles qui transportent le contenu de la seance", () => {
  test("session_live part avec le v2, le jour prevu et l'identifiant", () => {
    expect(resoudreDestinationHome("session_live", contexte())).toEqual({
      kind: "navigate",
      route: "SessionLive",
      params: { v2: V2, plannedDateISO: "2026-08-03", sessionId: "s1" },
    });
  });

  test("session_preview vise le meme contenu, un autre ecran", () => {
    const instruction = resoudreDestinationHome("session_preview", contexte());
    expect(instruction).toMatchObject({ kind: "navigate", route: "SessionPreview" });
    expect(instruction).toMatchObject({ params: { v2: V2, sessionId: "s1" } });
  });

  test("le jour transmis est le jour LOCAL de la seance, pas son horodatage brut", () => {
    // Une seance datee du 3 aout a 23 h reste le 3 aout. `toDateKey` est la
    // seule conversion autorisee dans le depot (regle n°9 du CLAUDE.md) ; passer
    // `dateISO` tel quel enverrait une chaine avec une heure a un ecran qui
    // attend une cle de jour.
    const instruction = resoudreDestinationHome(
      "session_live",
      contexte({
        sessions: [seance({ id: "s1", aiV2: V2, dateISO: "2026-08-03T23:30:00" })],
      })
    );
    expect(instruction).toMatchObject({ params: { plannedDateISO: "2026-08-03" } });
  });

  test("la seance visee est celle du ViewModel, meme si le store en contient d'autres", () => {
    // Le scenario reel : un watcher Firestore ajoute une seance entre le calcul
    // du ViewModel et le tap. Le joueur doit partir sur la seance QU'IL A LUE.
    const instruction = resoudreDestinationHome(
      "session_live",
      contexte({
        pendingSessionId: "s1",
        sessions: [
          seance({ id: "s2", aiV2: { title: "Arrivee apres coup" } }),
          seance({ id: "s1", aiV2: V2 }),
        ],
      })
    );
    expect(instruction).toMatchObject({ params: { sessionId: "s1", v2: V2 } });
  });
});

describe("Le repli de contenu, dans son ordre exact", () => {
  test("aiV2 gagne sur ai", () => {
    const ancien = { title: "Format historique" };
    const instruction = resoudreDestinationHome(
      "session_live",
      contexte({ sessions: [seance({ id: "s1", aiV2: V2, ai: ancien })] })
    );
    expect(instruction).toMatchObject({ params: { v2: V2 } });
  });

  test("ai sert quand aiV2 manque", () => {
    const ancien = { title: "Format historique" };
    const instruction = resoudreDestinationHome(
      "session_live",
      contexte({ sessions: [seance({ id: "s1", ai: ancien })] })
    );
    expect(instruction).toMatchObject({ params: { v2: ancien } });
  });

  test("le dernier v2 genere sert de dernier recours", () => {
    // Ce repli couvre les seances creees avant que le contenu soit stocke sur la
    // seance elle-meme. Sans lui, un joueur au long cours perdrait l'acces a sa
    // propre seance du jour.
    const dernier = { title: "Dernier genere" };
    const instruction = resoudreDestinationHome(
      "session_live",
      contexte({
        sessions: [seance({ id: "s1" })],
        lastAiSessionV2: { v2: dernier },
      })
    );
    expect(instruction).toMatchObject({ params: { v2: dernier } });
  });
});

describe("Ce qui arrive quand le contenu manque — jamais un ecran vide", () => {
  const attendu = {
    kind: "indisponible",
    titre: "Séance indisponible",
    message: "Le contenu de cette séance est introuvable. Relance une génération.",
  };

  test("aucune seance en attente", () => {
    expect(resoudreDestinationHome("session_live", contexte({ pendingSessionId: null }))).toEqual(
      attendu
    );
  });

  test("l'identifiant ne correspond a aucune seance du store", () => {
    expect(
      resoudreDestinationHome("session_preview", contexte({ pendingSessionId: "disparue" }))
    ).toEqual(attendu);
  });

  test("la seance existe mais n'a aucun contenu, et aucun repli n'est disponible", () => {
    expect(
      resoudreDestinationHome(
        "session_live",
        contexte({ sessions: [seance({ id: "s1" })], lastAiSessionV2: null })
      )
    ).toEqual(attendu);
  });

  test("aucun de ces cas ne produit une navigation", () => {
    // La propriete qui compte vraiment : quoi qu'il manque, on ne part pas.
    const casLimites: ContexteNavigationHome[] = [
      contexte({ pendingSessionId: null }),
      contexte({ pendingSessionId: "disparue" }),
      contexte({ sessions: [seance({ id: "s1" })], lastAiSessionV2: null }),
      contexte({ sessions: [] }),
    ];
    for (const cas of casLimites) {
      expect(resoudreDestinationHome("session_live", cas).kind).not.toBe("navigate");
      expect(resoudreDestinationHome("session_preview", cas).kind).not.toBe("navigate");
    }
  });
});
