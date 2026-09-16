// screens/__tests__/profilParametresParcours.test.ts
//
// PROFIL / PARAMÈTRES — ce que le joueur peut atteindre, et ce qui a disparu.
//
// Tests-source assumés : les deux écrans tirent Firebase, expo-file-system,
// expo-sharing, expo-updates et une dizaine de stores ; les monter n'ajouterait
// rien sur la NAVIGATION (un `nav.navigate` mocké) par rapport à lire le
// câblage. Le comportement des réglages, lui, est testé en exécution ailleurs
// (analyticsOptOut, notificationPreferences, settingsStorePreferences, exportLocal).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
/** Un commentaire qui cite un ancien libellé n'est pas un libellé affiché. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const profil = sansCommentaires(lire("screens/ProfileScreen.tsx"));
const parametres = sansCommentaires(lire("screens/SettingsScreen.tsx"));
const routine = sansCommentaires(lire("screens/RoutineScreen.tsx"));

describe("Profil — identité et actions en tête, accès au suivi sans doublon", () => {
  test("« Modifier mon profil » et « Paramètres » précèdent le programme et les trophées", () => {
    const iActions = profil.indexOf('label="Modifier mon profil"');
    const iParams = profil.indexOf("nav.navigate('Settings')");
    const iProgramme = profil.indexOf('title="Programme"');
    const iTrophees = profil.indexOf('title="Trophées"');
    expect(iActions).toBeGreaterThan(-1);
    expect(iParams).toBeGreaterThan(-1);
    expect(iActions).toBeLessThan(iProgramme);
    expect(iParams).toBeLessThan(iProgramme);
    expect(iProgramme).toBeLessThan(iTrophees);
  });

  test("le suivi détaillé mène vers ses pages au lieu d'être recopié", () => {
    for (const cible of ["nav.navigate('Progression')", "nav.navigate('SessionHistory')", "nav.navigate('MonCorps'", "nav.navigate('Tests'"]) {
      expect(profil).toContain(cible);
    }
    // Les blocs « Ta forme » (TSB + intensité 7 jours) et « Ta régularité »
    // faisaient doublon avec Progression : retirés.
    expect(profil).not.toContain('title="Ta forme"');
    expect(profil).not.toContain('title="Ta régularité"');
    expect(profil).not.toContain("Intensité 7 jours");
  });

  test("planning, objectif et programme restent visibles", () => {
    expect(profil).toContain('title="Mon rythme"');
    expect(profil).toContain('title="Ta semaine"');
    expect(profil).toContain('title="Programme"');
    expect(profil).toContain("mainObjectiveDisplay");
  });

  test("règle d'or : le socle Screen, pas de SafeAreaView à la main", () => {
    expect(profil).toContain("import { Screen } from '../components/ui/Screen'");
    expect(profil).not.toContain("SafeAreaView");
  });
});

describe("Paramètres — cinq groupes, lignes actionnables, plus d'options mortes", () => {
  test("les cinq groupes dans l'ordre", () => {
    const groupes = ["Mon compte", "Notifications", "Préférences de l'application", "Données et confidentialité", "Aide et informations"];
    const positions = groupes.map((g) => parametres.indexOf(`<SectionHeader title="${g}" />`));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("navigation : profil, confidentialité, mentions légales, suppression de compte", () => {
    for (const cible of ['nav.navigate("ProfileSetup")', 'nav.navigate("PrivacyPolicy")', 'nav.navigate("LegalNotice")', 'nav.navigate("DeleteAccount")']) {
      expect(parametres).toContain(cible);
    }
    expect(parametres).toContain("signOut(auth)");
  });

  test("les options sans effet ont disparu de l'écran, le badge « Vérifié » aussi", () => {
    for (const mort of ["privateMode", "distanceUnit", "weightUnit", '"Vérifié"', "Mode privé", "Données anonymisées", 'label="Local"']) {
      expect(parametres).not.toContain(mort);
    }
  });

  test("les sons n'apparaissent que là où ils existent (web)", () => {
    const iSons = parametres.indexOf('title="Sons"');
    expect(iSons).toBeGreaterThan(-1);
    const avant = parametres.slice(Math.max(0, iSons - 400), iSons);
    expect(avant).toContain('Platform.OS === "web"');
  });

  test("statistiques d'utilisation : appliquées au SDK, libellé honnête (pas « anonymisées »)", () => {
    expect(parametres).toContain("setAnalyticsEnabled(value)");
    expect(parametres).toContain("associés à ton compte");
    expect(parametres).not.toMatch(/anonymis/i);
  });

  test("l'export est nommé pour ce qu'il est : des données locales, pas une sauvegarde", () => {
    expect(parametres).toContain("Exporter mes données locales");
    expect(parametres).toContain("Pas une sauvegarde restaurable");
    expect(parametres).not.toContain("toutes tes données");
    expect(parametres).toContain("buildLocalExport(");
    expect(parametres).toContain("bodyInjuries: lireBlessures()");
  });

  test("le contact ouvre un brouillon vers l'adresse déjà vérifiée du projet, sans envoyer", () => {
    expect(parametres).toContain('SUPPORT_EMAIL = "kyllian@fks-app.com"');
    expect(parametres).toMatch(/Linking\.openURL\(url\)/);
    expect(parametres).toContain("mailto:${SUPPORT_EMAIL}");
    expect(parametres).not.toMatch(/send_email|sendMail|MailComposer/);
  });

  test("libellés : ni « Haptics », ni « Reset » en titre, ni jargon", () => {
    const titres = parametres.match(/title=\{?"([^"]+)"/g) ?? [];
    for (const t of titres) {
      expect(t).not.toMatch(/Haptics|Reset\b|Debug/i);
    }
  });

  test("le thème annonce un redémarrage et passe par expo-updates en production", () => {
    expect(parametres).toContain("Updates.reloadAsync()");
    expect(parametres).not.toContain("DevSettings");
    expect(parametres).toContain("Appliqué au prochain démarrage");
  });

  test("les outils de développement restent derrière DEV_FLAGS.ENABLED", () => {
    const i = parametres.indexOf('title="Outils de développement"');
    expect(i).toBeGreaterThan(-1);
    expect(parametres.slice(i - 200, i)).toContain("DEV_FLAGS.ENABLED &&");
  });
});

describe("Routine — le rappel affiché est celui que le service programme", () => {
  test("plus de stratégie « veille / matin / 2h avant » : une heure fixe, lue du service", () => {
    expect(routine).not.toContain("reminderStrategy");
    expect(routine).not.toContain("REMINDER_LABELS");
    expect(routine).toContain('from "../services/notifications"');
    expect(routine).toContain("SESSION_REMINDER_TIME");
    expect(routine).toContain("Tous les jours à ${HEURE_RAPPEL}");
  });
});
