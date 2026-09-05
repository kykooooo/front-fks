// screens/profileSetup/__tests__/codeClubRefuse.test.ts
//
// UN CODE CLUB REFUSÉ NE DOIT PLUS DISPARAÎTRE AU BOUT DE 2,2 SECONDES.
//
// Scénario mesuré par l'audit d'inscription du 05/09 (P0-01, reclassé P1-haut) :
// une joueuse tape le code que son coach lui dicte sur le parking, se trompe
// d'une lettre (l'alphabet des codes exclut I, L, O, 0, 1 — elle ne le sait
// pas), remplit les 4 étapes, valide. Le profil s'enregistre, le serveur refuse
// le code, un toast orange s'affiche 2 200 ms PENDANT que l'écran bascule vers
// l'accueil. Elle range son téléphone en croyant avoir rejoint son club. Rien,
// nulle part, ne dit le contraire. Le coach ouvre son effectif : elle n'y est
// pas.
//
// Cette suite verrouille les trois pièces du correctif :
//  1. le rattachement remonte l'état d'accès réel du serveur (`coachAccess`) ;
//  2. la formulation ne promet jamais plus que ce que le serveur a dit ;
//  3. l'écran s'ARRÊTE sur un état persistant au lieu de passer son chemin, et
//     l'onglet Profil porte un indicateur permanent.

import { readFileSync } from "fs";
import { resolve } from "path";

import { saveProfileThenAttachClub, type JoinAttempt } from "../attachClub";
import { messageRattachementReussi } from "../../../domain/clubJoinMessages";

const racine = resolve(__dirname, "..", "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

const joinOk = (over: Partial<Extract<JoinAttempt, { ok: true }>> = {}): JoinAttempt => ({
  ok: true,
  clubId: "clubX",
  clubName: "AS Test",
  alreadyMember: false,
  coachAccess: "not_required",
  ...over,
});

describe("l'état d'accès remonte du serveur jusqu'à l'écran", () => {
  test("le rattachement transporte `coachAccess`", async () => {
    const outcome = await saveProfileThenAttachClub(
      { saveProfile: async () => {}, joinClub: async () => joinOk({ coachAccess: "pending" }) },
      "ABCDE-FGHJK",
    );
    expect(outcome.status).toBe("joined");
    expect(outcome.coachAccess).toBe("pending");
  });

  test("une réponse qui ne le porte pas ne devient pas un état inventé", async () => {
    const outcome = await saveProfileThenAttachClub(
      { saveProfile: async () => {}, joinClub: async () => joinOk({ coachAccess: undefined }) },
      "ABCDE-FGHJK",
    );
    expect(outcome.coachAccess).toBeNull();
  });

  test("le service lit le champ de la callable et refuse les valeurs exotiques", () => {
    const service = lire("services/clubInvites.ts");
    // Le champ est demandé dans le type de réponse ET normalisé (deny-first).
    expect(service).toContain("coachAccess?: unknown");
    expect(service).toContain("normalizeCoachAccess(res.data?.coachAccess)");
  });
});

describe("ce qu'on ose annoncer au joueur", () => {
  test("club en validation manuelle : « en attente », jamais « tu as rejoint »", () => {
    const copie = messageRattachementReussi("AS Test", "pending");
    expect(copie.title).toContain("Demande envoyée");
    expect(copie.message).toBe("En attente de validation du coach.");
    expect(copie.message).not.toContain("rejoint");
  });

  test("club en politique par défaut : le rattachement est effectif, on le dit", () => {
    const copie = messageRattachementReussi("AS Test", "not_required");
    expect(copie.message).toBe("Tu as rejoint AS Test.");
  });

  test("état inconnu : message neutre, aucune promesse d'attente ni de suivi", () => {
    const copie = messageRattachementReussi(null, null);
    expect(copie.message).toBe("Tu as rejoint ton club.");
  });

  test("les deux surfaces de rattachement parlent la MÊME langue", () => {
    // L'inscription et la carte des réglages appellent la même fonction : une
    // seule formulation à tenir, pas deux qui divergent au premier correctif.
    expect(lire("screens/ProfileSetupScreen.tsx")).toContain("messageRattachementReussi(");
    expect(lire("components/settings/ClubManagementCard.tsx")).toContain(
      "messageRattachementReussi(",
    );
  });
});

describe("l'écran s'arrête, et l'app garde la trace", () => {
  const setup = lire("screens/ProfileSetupScreen.tsx");

  test("échec du code : un état persistant, pas un toast qui s'évapore", () => {
    // Le chemin d'échec pose l'état et RETOURNE : il ne tombe plus dans la
    // sortie d'écran (`terminer()`), qui emmenait le joueur vers l'accueil
    // pendant que le toast disparaissait.
    const depuisEchec = setup.slice(setup.indexOf('if (attach.status === "failed")'));
    const bloc = depuisEchec.slice(0, depuisEchec.indexOf("return;"));
    expect(bloc).toContain("setEchecClub(");
    // CE QUI EST INTERDIT, C'EST DE LAISSER PARTIR L'ÉCRAN — pas le toast.
    // Le lot A avait supprimé le toast au motif que la carte le remplaçait ;
    // le jour où la carte manquait son affichage, le joueur n'avait plus
    // AUCUN message, donc moins bien qu'avant le lot (R1 de la
    // contre-vérification du 05/09). Il revient EN PLUS, jamais À LA PLACE.
    expect(bloc).toContain("showToast(");
    expect(bloc).not.toContain("terminer()");
    // Les textes exacts de la carte.
    expect(setup).toContain("Ton profil est enregistré.");
    expect(setup).toContain("Le code club n'a pas été reconnu.");
    expect(setup).toContain("Réessayer le code");
    expect(setup).toContain("Plus tard");
  });

  test("« Réessayer » rejoue le SEUL appel qui a échoué, pas la sauvegarde du profil", () => {
    const bloc = setup.slice(setup.indexOf("const reessayerCodeClub"));
    const corps = bloc.slice(0, 1600);
    expect(corps).toContain("joinClubWithInviteCode(");
    // Le profil est déjà en base : le réécrire serait une seconde écriture pour
    // rien, et un second risque de panne sur un chemin qui vient de réussir.
    expect(corps).not.toContain("saveProfileThenAttachClub");
    expect(corps).not.toContain("setDoc(");
    // Anti double-tap : la vérification en cours verrouille le bouton.
    expect(corps).toContain("if (reessaiClubEnCours) return;");
  });

  test("l'onglet Profil porte l'indicateur permanent « Mon club »", () => {
    const profil = lire("screens/ProfileScreen.tsx");
    expect(profil).toContain("Mon club");
    expect(profil).toContain("Aucun club — rejoindre avec un code");
    // Il MÈNE à la carte des réglages, il ne la duplique pas (une seule
    // implémentation du rattachement).
    expect(profil).toContain("useMonClub()");
    expect(profil).not.toContain("joinClubWithInviteCode");
  });

  test("les textes qui indiquent où réessayer disent le chemin RÉEL", () => {
    // Avant : « depuis Profil » / « depuis ton profil », alors que l'onglet
    // Profil n'avait aucune trace de club — le chemin vrai passait par
    // Réglages, trois écrans plus loin, sans que rien ne le dise.
    expect(lire("screens/profileSetup/attachClub.ts")).toContain("Profil → Mon club");
    expect(setup).toContain("depuis Profil → Mon club");
  });

  test("aucun texte joueur en anglais sur ce chemin", () => {
    const textes = [
      messageRattachementReussi("AS Test", "pending"),
      messageRattachementReussi("AS Test", "not_required"),
      messageRattachementReussi(null, null),
    ]
      .flatMap((c) => [c.title, c.message])
      .join(" ");
    expect(textes).not.toMatch(/\b(pending|approved|club joined|welcome|error|failed)\b/i);
  });
});
