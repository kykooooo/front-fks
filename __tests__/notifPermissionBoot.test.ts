// __tests__/notifPermissionBoot.test.ts
//
// LE CÂBLAGE DES RAPPELS AU DÉMARRAGE — App.tsx est intestable sans runtime
// natif ; ce test-source vérifie que l'app passe bien par la coordination
// (services/notificationSync), dont le COMPORTEMENT est prouvé en exécution
// dans services/__tests__/notificationSync.test.ts.
//
// Historique : P1-26 (15/08) — `auth.currentUser` lu une fois au boot était
// null pour un compte neuf, la permission n'était jamais demandée. Puis
// (16/09) : une opération lancée avant une déconnexion ou une bascule OFF
// pouvait reposer des rappels en arrivant en dernier, et un démarrage avec la
// préférence OFF ne vidait jamais le planificateur.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..");
const appSource = readFileSync(resolve(racine, "App.tsx"), "utf8");
const notifSource = readFileSync(resolve(racine, "services", "notifications.ts"), "utf8");

describe("App — l'effet rappels suit l'état auth réel, et le distingue de l'état inconnu", () => {
  test("onAuthStateChanged alimente authUid ET authResolved", () => {
    expect(appSource).toMatch(/setAuthUid\(u\?\.uid \?\? null\);/);
    expect(appSource).toMatch(/setAuthResolved\(true\);/);
    expect(appSource).not.toMatch(/if \(auth\.currentUser && notificationsEnabled\)/);
  });

  test("la réconciliation attend l'auth résolue puis rejoue sur compte, préférence et rappel — OFF compris", () => {
    expect(appSource).toMatch(/if \(!hydrated \|\| !authResolved\) return;/);
    expect(appSource).toMatch(/\}, \[sync, hydrated, authResolved, authUid, notificationsEnabled, sessionReminders\]\);/);
    // Plus de garde « seulement si ON » : l'état OFF et la déconnexion vident aussi.
    expect(appSource).not.toMatch(/if \(authUid && notificationsEnabled\) \{/);
  });

  test("une seule coordination, qui relit le contexte courant par référence", () => {
    expect(appSource).toMatch(/createNotificationSync\(\)/);
    expect(appSource).toMatch(/sync\.setContext\(\{ authResolved, uid: authUid, notificationsEnabled, sessionReminders \}\)/);
    expect(appSource).toMatch(/installNotificationSync\(sync\)/);
    expect(appSource).toMatch(/sync\.reconcile\(\{/);
    // Plus d'appel direct au service depuis App : la coordination est la seule porte.
    expect(appSource).not.toMatch(/applyNotificationPreferences\(/);
    expect(appSource).not.toMatch(/registerForPushNotifications\(/);
  });

  test("la permission n'est demandée qu'avec un compte connecté et la préférence ON", () => {
    expect(appSource).toMatch(/requestPermission: Boolean\(authUid && notificationsEnabled\)/);
  });

  test("refus réel → le réglage repasse OFF (jamais sur un signal ambigu)", () => {
    expect(appSource).toMatch(/onPermissionDenied: \(\) => \{/);
    expect(appSource).toMatch(/updateSettings\(\{ notificationsEnabled: false \}\)/);
  });
});

describe("Service — la permission décide, pas le token", () => {
  test("isNotificationPermissionGranted : null = on ne conclut rien (web/échec)", () => {
    expect(notifSource).toMatch(/export async function isNotificationPermissionGranted/);
    expect(notifSource).toMatch(/if \(Platform\.OS === "web"\) return null/);
    expect(notifSource).toMatch(/status === "granted"/);
  });

  test("le service accepte un test de péremption et le relit avant de programmer", () => {
    expect(notifSource).toMatch(/isStale\?: \(\) => boolean;/);
    expect(notifSource).toMatch(/if \(isStale\(\)\) return perime\(\);\s*\n\s*await scheduleAllNotifications\(\);/);
  });
});

describe("Déconnexion et suppression de compte : nettoyage terminal AVANT de couper la session", () => {
  test("Réglages attend la purge avant signOut", () => {
    const settings = readFileSync(resolve(racine, "screens", "SettingsScreen.tsx"), "utf8");
    const iPurge = settings.indexOf("await purgeNotifications();");
    const iSignOut = settings.indexOf("await signOut(auth);");
    expect(iPurge).toBeGreaterThan(-1);
    expect(iPurge).toBeLessThan(iSignOut);
  });

  test("la suppression de compte attend la purge en PREMIER (pas après signOut et les purges de stores)", () => {
    const deletion = readFileSync(resolve(racine, "services", "accountDeletion.ts"), "utf8");
    const corps = deletion.slice(deletion.indexOf("export async function finalizeLocalAccountDeletion"));
    const iPurge = corps.indexOf("await purgeNotifications();");
    const iSignOut = corps.indexOf("await signOut(auth);");
    const iReset = corps.indexOf("resetForUser(null)");
    expect(iPurge).toBeGreaterThan(-1);
    expect(iPurge).toBeLessThan(iSignOut);
    expect(iPurge).toBeLessThan(iReset);
    // Plus d'annulation immédiate hors file : elle passait AVANT une écriture en vol.
    expect(corps).not.toContain("cancelAllScheduled()");
    expect(corps).not.toContain("invalidateNotificationSync()");
  });
});
