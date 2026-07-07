// utils/__tests__/errorHandler.test.ts
// classifyError : un 429 (rate limit backend) doit être distingué d'une
// erreur de validation — confirmé par le battery test prod (50 appels vers
// /api/fks/generate, cf. rateLimit.ts côté backend).

import { classifyError, ErrorType, BackendError, getErrorTitle } from "../errorHandler";

describe("classifyError — status 429 (rate limit)", () => {
  test("classe un 429 en RATE_LIMIT, pas en VALIDATION", () => {
    const err = new BackendError(429, "Too Many Requests", '{"error":"rate_limited","kind":"cooldown"}');
    const appError = classifyError(err);
    expect(appError.type).toBe(ErrorType.RATE_LIMIT);
    expect(appError.type).not.toBe(ErrorType.VALIDATION);
  });

  test("le message utilisateur ne dit jamais que les données sont invalides", () => {
    const err = new BackendError(429, "Too Many Requests", "rate_limited");
    const appError = classifyError(err);
    expect(appError.userMessage.toLowerCase()).not.toContain("formulaire");
    expect(appError.userMessage.toLowerCase()).not.toContain("invalide");
  });

  test("utilise retry-after quand présent pour un message précis", () => {
    const err = new BackendError(429, "Too Many Requests", "rate_limited", undefined, 12);
    const appError = classifyError(err);
    expect(appError.userMessage).toContain("12 secondes");
  });

  test("message générique quand retry-after absent", () => {
    const err = new BackendError(429, "Too Many Requests", "rate_limited");
    const appError = classifyError(err);
    expect(appError.userMessage).toBe(
      "Tu as généré plusieurs séances très rapidement. Attends quelques secondes et réessaie."
    );
  });

  test("un 429 est marqué retryable (l'utilisateur peut réessayer après le cooldown)", () => {
    const err = new BackendError(429, "Too Many Requests", "rate_limited");
    const appError = classifyError(err);
    expect(appError.retryable).toBe(true);
  });

  test("un vrai 4xx (ex: 400) reste classé VALIDATION", () => {
    const err = new BackendError(400, "Bad Request", "bad payload");
    const appError = classifyError(err);
    expect(appError.type).toBe(ErrorType.VALIDATION);
  });

  test("getErrorTitle renvoie un titre dédié pour RATE_LIMIT", () => {
    expect(getErrorTitle(ErrorType.RATE_LIMIT)).toBe("Trop de générations");
  });

  test("un 5xx reste classé SERVER (comportement inchangé)", () => {
    const err = new BackendError(500, "Internal Server Error", "boom");
    const appError = classifyError(err);
    expect(appError.type).toBe(ErrorType.SERVER);
  });
});
