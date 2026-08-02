// state/__tests__/coachAuthorityGate.test.ts
//
// LE JETON D'AUTORITE, ET LE SIGNAL DE PURGE.
//
// Ce que ces tests protegent :
//
//  1. UNE REPONSE PARTIE SOUS UNE AUTORITE MORTE N'EST PAS ECRITE. C'est le
//     piege central du lot : la lecture part avant la revocation et revient
//     apres la purge. Le jeton la reconnait, meme si le club et l'ecran n'ont
//     pas bouge d'un pouce.
//  2. LE TEMOIN. Sous l'autorite COURANTE, la meme reponse est bien appliquee.
//     Sans ce temoin, un garde-fou qui refuserait tout passerait le test 1 sans
//     rien prouver.
//  3. UNE AUTORITE STABLE NE BLOQUE RIEN. Deux instantanes identiques ne bougent
//     pas le jeton : un garde-fou qui se declencherait a chaque rafraichissement
//     serait une panne, pas une protection.
//  4. TOUTE PERTE D'AUTORITE DECLENCHE LA PURGE — y compris `chargement`
//     (revalidation) et y compris `indetermine` (on ne sait pas).

import {
  canCommitCoachData,
  currentCoachAuthorityToken,
  onCoachDataPurge,
  publishCoachAuthority,
  readCoachAuthority,
  resetCoachAuthorityGateForTests,
  type CoachPurgeRaison,
} from "../coachAuthorityGate";

beforeEach(() => {
  resetCoachAuthorityGateForTests();
});

describe("portillon non branche — fail-open assume, et documente", () => {
  test("sans autorite publiee, une ecriture coach passe", () => {
    // Choix assume (cf. l'entete du module) : ce portillon n'est pas un controle
    // d'acces, il empeche une donnee DEJA autorisee de survivre a la perte de son
    // autorisation. Ferme par defaut, il viderait silencieusement tout ecran
    // coach monte hors du navigateur (tests, previsualisation).
    expect(readCoachAuthority()).toBeNull();
    expect(canCommitCoachData(0)).toBe(true);
    expect(canCommitCoachData(99)).toBe(true);
  });

  test("des la premiere publication, le portillon fait autorite", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    expect(canCommitCoachData(0)).toBe(false);
    expect(canCommitCoachData(1)).toBe(true);
  });
});

describe("le jeton reconnait une reponse partie sous une autre autorite", () => {
  test("revoquee pendant le vol → la reponse est IGNOREE", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 4 });
    const capture = currentCoachAuthorityToken(); // depart de la lecture

    publishCoachAuthority({ statut: "refuse", jeton: 5 }); // revocation

    expect(canCommitCoachData(capture)).toBe(false);
  });

  test("TEMOIN — sous l'autorite courante, la meme reponse est APPLIQUEE", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 4 });
    const capture = currentCoachAuthorityToken();

    expect(canCommitCoachData(capture)).toBe(true);
  });

  test("une autorite stable n'invalide rien, meme apres re-publication a l'identique", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 7 });
    const capture = currentCoachAuthorityToken();
    publishCoachAuthority({ statut: "autorise", jeton: 7 });
    expect(canCommitCoachData(capture)).toBe(true);
  });

  test("meme jeton mais statut ferme → refus (l'invariant tient localement)", () => {
    // Aujourd'hui, tout changement de statut incremente le jeton — l'egalite
    // suffirait donc. Verifier AUSSI le statut evite de faire dependre cet
    // invariant du comportement d'un autre fichier.
    publishCoachAuthority({ statut: "autorise", jeton: 3 });
    publishCoachAuthority({ statut: "indetermine", jeton: 3 });
    expect(canCommitCoachData(3)).toBe(false);
  });

  test("le retour de l'autorite ne ressuscite pas une reponse ancienne", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const capture = currentCoachAuthorityToken();
    publishCoachAuthority({ statut: "chargement", jeton: 2 });
    publishCoachAuthority({ statut: "autorise", jeton: 3 });
    expect(canCommitCoachData(capture)).toBe(false);
  });
});

describe("le signal de purge", () => {
  const collecter = () => {
    const raisons: CoachPurgeRaison[] = [];
    onCoachDataPurge((r) => raisons.push(r));
    return raisons;
  };

  test("`autorise` ne purge JAMAIS", () => {
    const raisons = collecter();
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    publishCoachAuthority({ statut: "autorise", jeton: 2 });
    expect(raisons).toEqual([]);
  });

  test("revocation → purge", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const raisons = collecter();
    publishCoachAuthority({ statut: "refuse", jeton: 2 });
    expect(raisons).toEqual(["revocation"]);
  });

  test("revalidation (`chargement`) → purge, meme si rien n'est encore decide", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const raisons = collecter();
    publishCoachAuthority({ statut: "chargement", jeton: 2 });
    expect(raisons).toEqual(["revalidation"]);
  });

  test("incertitude (`indetermine`) → purge", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const raisons = collecter();
    publishCoachAuthority({ statut: "indetermine", jeton: 2 });
    expect(raisons).toEqual(["incertitude"]);
  });

  test("le `chargement` initial ne declenche pas de purge inutile", () => {
    // Au demarrage, il n'y a rien a purger et personne n'a rien charge : une
    // rafale de purges au boot ne protegerait rien et brouillerait les tests.
    const raisons = collecter();
    publishCoachAuthority({ statut: "chargement", jeton: 1 });
    expect(raisons).toEqual([]);
  });

  test("un abonne qui leve n'empeche pas les autres d'etre purges", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const vus: string[] = [];
    onCoachDataPurge(() => {
      throw new Error("abonne casse");
    });
    onCoachDataPurge(() => vus.push("second"));
    publishCoachAuthority({ statut: "refuse", jeton: 2 });
    expect(vus).toEqual(["second"]);
  });

  test("un desabonnement pendant la diffusion ne fait pas sauter les suivants", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const vus: string[] = [];
    const stop = onCoachDataPurge(() => {
      vus.push("premier");
      stop();
    });
    onCoachDataPurge(() => vus.push("second"));
    publishCoachAuthority({ statut: "refuse", jeton: 2 });
    expect(vus).toEqual(["premier", "second"]);
  });

  test("desabonne = plus jamais notifie", () => {
    publishCoachAuthority({ statut: "autorise", jeton: 1 });
    const vus: string[] = [];
    const stop = onCoachDataPurge(() => vus.push("x"));
    stop();
    publishCoachAuthority({ statut: "refuse", jeton: 2 });
    expect(vus).toEqual([]);
  });
});
