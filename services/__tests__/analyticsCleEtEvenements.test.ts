// services/__tests__/analyticsCleEtEvenements.test.ts
//
// LE FUNNEL D'INSCRIPTION ÉTAIT AVEUGLE, ET C'EST PIRE QUE DE NE PAS MESURER :
// on CROYAIT mesurer.
//
// P1-01 de l'audit d'inscription : `app.json` porte `AMPLITUDE_API_KEY: ""`, et
// `app.config.js` se contentait de `extra.AMPLITUDE_API_KEY ?? ""` — sans
// jamais lire l'environnement, contrairement à `SENTRY_DSN` juste au-dessus.
// La clé était donc vide dans TOUS les builds, `initAnalytics` sortait
// immédiatement, `trackEvent` ne faisait rien, et les 14 événements posés en
// juillet étaient du code mort en production.
//
// Ce test protège le CÂBLAGE (lire l'environnement) et l'ABSENCE DE SECRET dans
// le dépôt. La clé elle-même est un geste humain : `.env.local` en dev, secret
// EAS en build cloud.

import { readFileSync } from "fs";
import { resolve } from "path";

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

describe("clé Amplitude — lue depuis l'environnement, jamais commitée", () => {
  const config = lire("app.config.js");

  test("app.config.js lit EXPO_PUBLIC_AMPLITUDE_API_KEY", () => {
    expect(config).toContain("process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY");
    expect(config).toMatch(
      /AMPLITUDE_API_KEY:\s*\r?\n?\s*process\.env\.EXPO_PUBLIC_AMPLITUDE_API_KEY/,
    );
  });

  test("même idiome que SENTRY_DSN : l'environnement d'abord, le repli ensuite", () => {
    expect(config).toMatch(/SENTRY_DSN:\s*process\.env\.EXPO_PUBLIC_SENTRY_DSN/);
    expect(config).toMatch(/EXPO_PUBLIC_AMPLITUDE_API_KEY \?\? extra\.AMPLITUDE_API_KEY \?\? ""/);
  });

  test("aucune clé en dur dans le dépôt", () => {
    // `app.json` garde une valeur VIDE (repli documenté) ; toute autre valeur
    // serait un secret commité.
    const appJson = JSON.parse(lire("app.json")) as {
      expo?: { extra?: Record<string, unknown> };
    };
    expect(appJson.expo?.extra?.AMPLITUDE_API_KEY).toBe("");
    // Et le service ne fabrique aucune valeur de repli : il lit la cle dans le
    // bundle (process.env, inline a l'export) puis dans le manifeste (extra), via
    // l'unique lecture partagee (utils/valeurConfig) — jamais une valeur en dur.
    const service = lire("services/analytics.ts");
    expect(service).toContain("premiereValeurNonVide(");
    expect(service).toContain("process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY");
    expect(service).toContain("Constants.expoConfig?.extra?.AMPLITUDE_API_KEY");
    expect(service).not.toMatch(/apiKeys*=s*["'][A-Za-z0-9]{8,}["']/);
  });

  test("sans clé, rien ne part — et rien ne casse", () => {
    const service = lire("services/analytics.ts");
    expect(service).toContain("if (!apiKey || analyticsReady) return;");
    expect(service).toContain("if (!analyticsReady) return;");
  });
});

describe("register_failed — le pendant manquant de login_failed", () => {
  const register = lire("screens/RegisterScreen.tsx");

  test("l'événement est posé sur le chemin d'échec, avec le code d'erreur", () => {
    // Le code vient du service (services/registerAccount), qui ne rend QUE lui.
    expect(register).toContain('trackEvent("register_failed", { code: issue.code })');
  });

  test("aucune donnée personnelle dans la charge utile", () => {
    // Le funnel mesure des CODES, jamais des identités : ni email, ni prénom,
    // ni mot de passe ne doivent approcher d'un `trackEvent`.
    const appels = register.match(/trackEvent\([^)]*\)/g) ?? [];
    expect(appels.length).toBeGreaterThan(0);
    for (const appel of appels) {
      expect(appel).not.toMatch(/email|emailTrimmed|pwd|name|cleanName|firstName/i);
    }
  });

  test("il vit sur la branche « compte non créé », qui sort AVANT le succès", () => {
    const indexBranche = register.indexOf('if (issue.status === "failed") {');
    const indexEchec = register.indexOf('trackEvent("register_failed"');
    const indexSucces = register.indexOf('trackEvent("register_success")');
    expect(indexBranche).toBeGreaterThan(-1);
    expect(indexEchec).toBeGreaterThan(indexBranche);
    // La branche d'échec se termine par un return avant tout register_success.
    const branche = register.slice(indexEchec, indexSucces);
    expect(branche).toContain("Compte non créé");
    expect(branche).toContain("return;");
    expect(indexSucces).toBeGreaterThan(indexEchec);
  });
});
