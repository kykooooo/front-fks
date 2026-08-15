// __tests__/notifPermissionBoot.test.ts
//
// LA PERMISSION NOTIFICATIONS EST-ELLE DEMANDÉE AU BON MOMENT, ET RÉGLAGES
// DIT-IL LA VÉRITÉ ?
//
// P1-26 inventaire clubs (15/08) : `auth.currentUser` lu UNE fois au boot est
// null pour un compte neuf (l'inscription arrive après) et souvent null au
// démarrage à froid (restauration auth asynchrone). La permission n'était
// jamais demandée de toute la première session, aucun rappel programmé —
// pendant que Réglages affichait « Notifs activées ». Tests-source (App.tsx
// est intestable sans runtime natif ; la logique est un câblage d'effets).

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..");
const appSource = readFileSync(resolve(racine, "App.tsx"), "utf8");
const notifSource = readFileSync(resolve(racine, "services", "notifications.ts"), "utf8");

describe("App — l'effet notifications suit l'état auth réel", () => {
  test("onAuthStateChanged alimente authUid (plus de lecture one-shot)", () => {
    expect(appSource).toMatch(/onAuthStateChanged\(auth, \(u\) => setAuthUid\(u\?\.uid \?\? null\)\)/);
  });

  test("l'effet rejoue à la connexion : authUid est dans les deps", () => {
    expect(appSource).toMatch(/\}, \[hydrated, themeMode, notificationsEnabled, authUid\]\);/);
    expect(appSource).toMatch(/if \(authUid && notificationsEnabled\)/);
    // La lecture directe one-shot ne pilote plus l'effet.
    expect(appSource).not.toMatch(/if \(auth\.currentUser && notificationsEnabled\)/);
  });
});

describe("Réglages honnête — la permission décide, pas le token", () => {
  test("les rappels ne partent que si la permission est accordée", () => {
    expect(appSource).toMatch(/granted === true/);
    expect(appSource).toMatch(/scheduleAllNotifications\(\)/);
  });

  test("refus réel → le réglage repasse OFF (jamais sur un signal ambigu)", () => {
    expect(appSource).toMatch(/granted === false/);
    expect(appSource).toMatch(/updateSettings\(\{ notificationsEnabled: false \}\)/);
  });

  test("isNotificationPermissionGranted : null = on ne conclut rien (web/échec)", () => {
    expect(notifSource).toMatch(/export async function isNotificationPermissionGranted/);
    expect(notifSource).toMatch(/if \(Platform\.OS === "web"\) return null/);
    expect(notifSource).toMatch(/status === "granted"/);
  });
});
