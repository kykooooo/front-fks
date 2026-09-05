// navigation/__tests__/gardeProfilJoueur.test.ts
//
// LE COACH QUI « S'ENTRAÎNE AUSSI » NE DOIT PLUS ENTRER AVEC UN PROFIL VIDE.
//
// Chemin réel (audit d'inscription 2026-09, P1-04) : la création de club pose
// `profileCompleted: true` sans écrire un seul champ joueur ; le coach active
// « Je m'entraîne aussi », l'espace revient à "player", le navigateur voit un
// profil « complété » et ouvre l'app joueur. Poste, catégorie, niveau : absents.
// Le questionnaire n'était JAMAIS proposé, et le moteur dosait sans aucun
// plafond d'âge (erratum 4 : `getAgeCategoryCaps(null)` rend `null`, donc ni
// familles interdites, ni volume, ni contacts plyo, ni sprint, ni durée).
//
// Deux gardes, à deux étages, parce qu'aucune ne couvre l'autre :
//   . le PORTILLON, qui ramène au questionnaire ;
//   . la GÉNÉRATION, qui refuse d'appeler le backend sans catégorie — un profil
//     peut se vider par le haut (édition) sans repasser par le portillon.

import { readFileSync } from "fs";
import { resolve } from "path";

import { TOAST_CATEGORIE_MANQUANTE } from "../../screens/newSession/gardeCategorieAge";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
const navigateur = lire("navigation/RootNavigator.tsx");
const generation = lire("screens/NewSessionScreen.tsx");
const setup = lire("screens/ProfileSetupScreen.tsx");

describe("le portillon regarde les CHAMPS, plus seulement le drapeau", () => {
  test("la complétude joueur est lue dans l'instantané du profil", () => {
    expect(navigateur).toContain('from "../domain/playerProfile"');
    expect(navigateur).toContain("setProfilJoueurComplet(isPlayerProfileComplete(data))");
  });

  test("un profil « complété » aux champs joueur absents rouvre le questionnaire", () => {
    expect(navigateur).toContain(
      "if (profileCompleted === false || profilJoueurComplet === false || rattachementClubEnCours) {",
    );
  });

  test("l'espace coach est tranché AVANT : un encadrant n'est jamais renvoyé au questionnaire", () => {
    const indexCoach = navigateur.indexOf('if (appSpace.space === "coach")');
    const indexPortillon = navigateur.indexOf(
      "if (profileCompleted === false || profilJoueurComplet === false || rattachementClubEnCours) {",
    );
    expect(indexCoach).toBeGreaterThan(-1);
    expect(indexPortillon).toBeGreaterThan(indexCoach);
  });

  test("une lecture de profil en échec ne conclut pas « complet »", () => {
    // Deny-first : sans instantané, on ne laisse pas passer un profil qu'on n'a
    // pas lu — on ouvre le questionnaire, qui repréremplit ce qui existe.
    const brancheErreur = navigateur.slice(navigateur.indexOf("Erreur lors du check profil"));
    expect(brancheErreur.slice(0, 400)).toContain("setProfilJoueurComplet(false)");
  });

  test("le pont local ferme les DEUX conditions, sinon le questionnaire se rejoue", () => {
    const gate = navigateur.slice(navigateur.indexOf('name="ProfileSetupGate"'));
    expect(gate.slice(0, 800)).toContain("setProfileCompleted(true)");
    expect(gate.slice(0, 800)).toContain("setProfilJoueurComplet(true)");
  });
});

describe("le questionnaire ne doit rien casser de ce qui n'est pas à lui", () => {
  test("`clubId` n'est jamais écrit à null : la clé est OMISE quand on n'en connaît pas", () => {
    // Un `merge` avec `null` EFFACE. Le préremplissage est asynchrone : sur le
    // chemin neuf (un coach qui remplit son profil joueur), écrire `null` aurait
    // détaché le coach de son propre club.
    expect(setup).toContain("...(existingClubId ? { clubId: existingClubId } : {})");
    expect(setup).not.toContain("clubId: existingClubId,");
  });

  test("il n'écrit ni `role` ni `accessRole`", () => {
    // `accessRole` vit sur l'appartenance, interdite au client par les règles ;
    // `role` ne décide plus rien depuis « un compte, un espace ».
    const payload = setup.slice(setup.indexOf("saveProfile: () =>"), setup.indexOf("joinClub:"));
    expect(payload).not.toMatch(/\brole\s*:/);
    expect(payload).not.toMatch(/accessRole/);
  });
});

describe("la génération refuse de partir sans catégorie d'âge", () => {
  test("la garde existe AVANT tout appel backend", () => {
    const bloc = generation.slice(generation.indexOf("const handleGenerate"));
    const avantCycle = bloc.slice(0, bloc.indexOf("if (!cycleId)"));
    expect(avantCycle).toContain("if (categorieAgeManquante)");
    expect(avantCycle).toContain("return;");
  });

  test("le message est celui décidé, et il mène au questionnaire", () => {
    // Écrit une seule fois, dans screens/newSession/gardeCategorieAge — la
    // règle est posée à deux endroits de l'écran et doit dire la même chose.
    expect(TOAST_CATEGORIE_MANQUANTE.message).toBe(
      "Complète ton profil pour des séances adaptées à ta catégorie.",
    );
    expect(generation).toContain("TOAST_CATEGORIE_MANQUANTE");
    expect(generation).toContain('nav.navigate("ProfileSetup")');
  });

  test("la source est le contexte IA (lecture fraîche), pas le store local", () => {
    // Le store peut n'avoir jamais été synchronisé sur une installation neuve :
    // s'y fier bloquerait un joueur parfaitement en règle.
    expect(generation).toContain(
      "const categorieAgeManquante = !!aiContext && categorieAgeAbsente(aiContext);",
    );
  });

  test("tant que le contexte n'est pas chargé, on ne conclut RIEN à l'affichage", () => {
    // `!!aiContext &&` : ne pas savoir n'est pas « absent » (règle 12).
    expect(generation).toContain("!!aiContext && categorieAgeAbsente(aiContext)");
    expect(generation).not.toContain("categorieAgeAbsente(aiContext);\n");
  });

  test("mais au moment de payer, on rejoue la garde sur le contexte FRAIS", () => {
    // La garde du lot A échouait OUVERTE : `aiContext` reste `null` quand le
    // chargeur d'ouverture n'a pas tourné (aucun cycle actif, ou échec), donc
    // `categorieAgeManquante` valait faux et la génération partait avec
    // `age_category: null` — soit AUCUN plafond d'âge côté moteur (R5 de la
    // contre-vérification du 05/09). Détail dans
    // screens/newSession/__tests__/gardeCategorieAge.test.ts.
    const iContexte = generation.indexOf("const ctx = await buildAIPromptContext();");
    const iGarde = generation.indexOf("if (categorieAgeAbsente(ctx)) {");
    expect(iContexte).toBeGreaterThan(-1);
    expect(iGarde).toBeGreaterThan(iContexte);
    expect(iGarde).toBeLessThan(generation.indexOf("prepareBackendContext("));
  });

  test("aucun sélecteur de lieu/matériel ne s'affiche derrière la carte", () => {
    expect(generation).toContain("!categorieAgeManquante && cycleId && !cycleCompleted ? (");
  });
});
