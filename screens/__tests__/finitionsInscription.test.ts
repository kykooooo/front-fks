// screens/__tests__/finitionsInscription.test.ts
//
// LES PETITES CHOSES QUI MENTENT — P2 de l'audit d'inscription du 05/09.
//
// Chacune est minuscule et chacune trompe quelqu'un :
//  . `autoComplete="name"` sur un champ Prénom → iOS propose le NOM COMPLET du
//    contact, la valeur devient `firstName` et le coach lit « Kyllian Le Bris »
//    dans son effectif (P2-02) ;
//  . trois codes Firebase non traités → un message par défaut qui envoie relire
//    une saisie parfaitement juste, indéfiniment (P2-03) ;
//  . `aaaaaaaaaa` affiché « Fort » (P2-04) ;
//  . un objectif persisté AVEC un accent, à trois lignes du commentaire qui
//    l'interdit (P2-05) ;
//  . aucun plafond d'agrandissement sur un bloc à réserve fixe (P2-10).

import { readFileSync } from "fs";
import { resolve } from "path";

import { forceMotDePasse } from "../../domain/passwordStrength";
import {
  OBJECTIF_ENCAISSER,
  OBJECTIF_ENCAISSER_LEGACY,
  normalizeMainObjective,
} from "../../domain/mainObjective";
import { displayObjective } from "../../utils/profileDisplayLabels";
import { recommendMicrocycle } from "../../domain/recommendMicrocycle";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("champs de saisie — le bon jeton d'autoremplissage", () => {
  test("les deux champs Prénom demandent un PRÉNOM", () => {
    for (const chemin of ["screens/RegisterScreen.tsx", "screens/ProfileSetupScreen.tsx"]) {
      const source = lire(chemin);
      expect(source).toContain('autoComplete="given-name"');
      expect(source).toContain('textContentType="givenName"');
    }
    // Et plus jamais le jeton « nom complet » sur l'inscription.
    expect(lire("screens/RegisterScreen.tsx")).not.toContain('autoComplete="name"');
  });

  test("le code club ne reçoit aucune suggestion du trousseau", () => {
    const setup = lire("screens/ProfileSetupScreen.tsx");
    const champ = setup.slice(setup.indexOf('placeholder="Ex: ABCDE-FGHJK"'));
    const bloc = champ.slice(0, 700);
    expect(bloc).toContain('autoComplete="off"');
    expect(bloc).toContain('autoCapitalize="characters"');
    expect(bloc).toContain("autoCorrect={false}");
  });

  test("le prénom déjà donné à l'inscription est annoncé comme tel, et reste corrigeable", () => {
    const setup = lire("screens/ProfileSetupScreen.tsx");
    expect(setup).toContain("Déjà renseigné à l'inscription. Corrige-le si besoin.");
    // Le champ n'est PAS verrouillé : on informe, on n'empêche pas.
    const champ = setup.slice(setup.indexOf('placeholder="Ex: Kylian"'));
    expect(champ.slice(0, 500)).not.toContain("editable={false}");
  });
});

describe("messages Firebase — aucun ne renvoie relire une saisie juste", () => {
  const register = lire("screens/RegisterScreen.tsx");
  const login = lire("screens/LoginScreen.tsx");

  test("inscription : provider désactivé et identifiant refusé sont traités", () => {
    expect(register).toContain('case "auth/operation-not-allowed":');
    expect(register).toContain('case "auth/invalid-credential":');
    expect(register).toContain(
      "L'inscription est momentanément indisponible. Réessaie plus tard ou écris à kyllian@fks-app.com.",
    );
  });

  test("connexion : un compte désactivé le dit", () => {
    expect(login).toContain('case "auth/user-disabled":');
    expect(login).toContain(
      "Ce compte est désactivé. Écris à kyllian@fks-app.com pour le réactiver.",
    );
  });

  test("tous les messages sont en français, aucun jargon Firebase ne fuit", () => {
    for (const source of [register, login]) {
      const mapping = source.slice(source.indexOf("switch (code)"), source.indexOf("default:"));
      const messages = mapping.match(/return "([^"]+)"/g) ?? [];
      expect(messages.length).toBeGreaterThanOrEqual(5);
      for (const m of messages) {
        expect(m).not.toMatch(/[Mm]issing|permission|credential is|auth\//);
      }
    }
  });
});

describe("force du mot de passe — longueur ET variété", () => {
  test("dix lettres identiques ne sont pas « Fort »", () => {
    expect(forceMotDePasse("aaaaaaaaaa")).toBeLessThan(3);
  });

  test("rien saisi = rien affiché ; trop court = Faible", () => {
    expect(forceMotDePasse("")).toBe(0);
    expect(forceMotDePasse("abc")).toBe(1);
  });

  test("un vrai mot de passe monte à Fort", () => {
    expect(forceMotDePasse("Kyllian2026!")).toBe(3);
    expect(forceMotDePasse("marvin2026FKS")).toBe(3);
  });

  test("la jauge INFORME, elle ne bloque pas : seul le minimum Firebase bloque", () => {
    const register = lire("screens/RegisterScreen.tsx");
    expect(register).toContain("const canSubmit = emailLooksValid && pwd.length >= 6 && consentAccepted;");
    // La jauge ne sert qu'à peindre des barres, jamais à autoriser l'envoi.
    const conditionEnvoi = register.slice(register.indexOf("const canSubmit"), register.indexOf("const fail"));
    expect(conditionEnvoi).not.toContain("pwdStrength");
    expect(conditionEnvoi).not.toContain("forceMotDePasse");
  });
});

describe("objectif « encaisser » — désaccentué à l'écriture, reconnu à la lecture", () => {
  test("la valeur écrite ne porte plus d'accent", () => {
    expect(OBJECTIF_ENCAISSER).toBe("Mieux encaisser les entrainements et les matchs");
    expect(OBJECTIF_ENCAISSER).not.toMatch(/[éèêàçîôû]/i);
    // Et c'est bien elle que le questionnaire propose.
    expect(lire("screens/ProfileSetupScreen.tsx")).toContain("OBJECTIF_ENCAISSER,");
  });

  test("un profil d'avant le 05/09 est reconnu, sans migration", () => {
    expect(normalizeMainObjective(OBJECTIF_ENCAISSER_LEGACY)).toBe(OBJECTIF_ENCAISSER);
    // Le questionnaire normalise à la lecture : sinon la carte d'un ancien
    // profil n'apparaîtrait pas sélectionnée.
    expect(lire("screens/ProfileSetupScreen.tsx")).toContain(
      "normalizeMainObjective(d.mainObjective)",
    );
  });

  test("aucune autre valeur n'est touchée, et rien n'est inventé", () => {
    expect(normalizeMainObjective("Etre en forme toute la saison")).toBe(
      "Etre en forme toute la saison",
    );
    expect(normalizeMainObjective(null)).toBeNull();
    expect(normalizeMainObjective("   ")).toBeNull();
    expect(normalizeMainObjective(42)).toBeNull();
  });

  test("la recommandation de cycle donne le MÊME résultat pour les deux formes", () => {
    // Le matching cherche « encaisser », identique dans les deux : c'est ce qui
    // rend la migration inutile.
    const ancienne = recommendMicrocycle({
      mainObjective: OBJECTIF_ENCAISSER_LEGACY,
      lastTestPlaylist: null,
    });
    const nouvelle = recommendMicrocycle({
      mainObjective: OBJECTIF_ENCAISSER,
      lastTestPlaylist: null,
    });
    expect(nouvelle.id).toBe(ancienne.id);
    expect(nouvelle.id).toBe("endurance");
  });

  test("l'affichage reste accentué pour les deux formes", () => {
    expect(displayObjective(OBJECTIF_ENCAISSER)).toBe(OBJECTIF_ENCAISSER_LEGACY);
    // L'ancienne valeur est déjà accentuée : rendue telle quelle.
    expect(displayObjective(OBJECTIF_ENCAISSER_LEGACY)).toBe(OBJECTIF_ENCAISSER_LEGACY);
  });
});

describe("agrandissement du texte — les blocs à réserve fixe sont bornés", () => {
  test("les cinq écrans du parcours posent un plafond sur leurs textes contraints", () => {
    for (const chemin of [
      "screens/WelcomeScreen.tsx",
      "screens/LoginScreen.tsx",
      "screens/RegisterScreen.tsx",
      "screens/ProfileSetupScreen.tsx",
      "screens/CoachOnboardingScreen.tsx",
    ]) {
      const source = lire(chemin);
      expect(source).toContain("const PLAFOND_TITRE = 1.2;");
      expect(source).toContain("maxFontSizeMultiplier={PLAFOND_TITRE}");
    }
  });

  test("le cap GLOBAL de l'app reste en place et plus haut : on borne, on ne fige pas", () => {
    const global = lire("config/textScaling.ts");
    expect(global).toContain("export const MAX_FONT_SCALE = 1.3;");
    // Et il est bien appliqué avant tout rendu.
    expect(lire("App.tsx")).toContain('import "./config/textScaling"');
  });
});
