// utils/__tests__/profileDisplayLabels.test.ts
//
// LE PROFIL N'AFFICHE PLUS LES VALEURS PERSISTÉES SANS ACCENTS (P1-20).
//
// Convention du projet : les valeurs de profil sont persistées SANS accents
// (allowlists Cloud Functions, matching substring de recommendMicrocycle).
// Le setup les affichait accentuées via ses maps locales — le héro du Profil,
// lui, relisait le brut : « Defenseur · Regional », « Gagner en vitesse /
// explosivite ». Les maps sont désormais partagées.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  displayPosition,
  displayLevel,
  displayObjective,
} from "../profileDisplayLabels";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("les libellés accentués — exécutés", () => {
  test("les trois valeurs fautives de l'inventaire s'affichent accentuées", () => {
    expect(displayPosition("Defenseur")).toBe("Défenseur");
    expect(displayLevel("Regional")).toBe("Régional");
    expect(displayObjective("Gagner en vitesse / explosivite")).toBe(
      "Gagner en vitesse / explosivité"
    );
  });

  test("valeur inconnue = rendue telle quelle, null = null (règle 12)", () => {
    expect(displayPosition("Milieu")).toBe("Milieu");
    expect(displayObjective(null)).toBeNull();
    expect(displayLevel(undefined)).toBeUndefined();
  });
});

describe("le câblage — source", () => {
  test("le héro du Profil passe par les libellés partagés", () => {
    const source = lire("screens/ProfileScreen.tsx");
    expect(source).toMatch(/labelize\(displayLevel\(profile\?\.level\)\)/);
    expect(source).toMatch(/labelize\(displayPosition\(profile\?\.position\)\)/);
    expect(source).toMatch(/\{mainObjectiveDisplay\}/);
  });

  test("la valeur BRUTE reste celle du matching de cycle (jamais l'accentuée)", () => {
    const source = lire("screens/ProfileScreen.tsx");
    expect(source).toMatch(/recommendMicrocycle\(\{ mainObjective,/);
  });

  test("le setup consomme les mêmes maps partagées (une seule implémentation)", () => {
    const source = lire("screens/ProfileSetupScreen.tsx");
    expect(source).toMatch(/from "\.\.\/utils\/profileDisplayLabels"/);
    expect(source).not.toMatch(/const POSITION_DISPLAY_LABELS/);
  });
});
