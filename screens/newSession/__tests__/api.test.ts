// screens/newSession/__tests__/api.test.ts
// fetchV2 — résilience au cold start Render : un fetch qui échoue en
// "Network request failed"/"Failed to fetch" (coupure système iOS ~60s,
// AVANT notre AbortController à 90s) doit retenter une fois, comme pour
// ETIMEDOUT. Sans ce fix, le retry ne se déclenchait que sur ETIMEDOUT
// (screens/newSession/api.ts:191 avant correctif) et un cold start iOS
// tombait directement en fallback.

import { fetchV2 } from "../api";

const originalFetch = global.fetch;

describe("fetchV2 — reveil serveur (cold start)", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("un 1er echec reseau (Failed to fetch) declenche un retry qui reussit, sans throw", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: {} }),
      });
    }) as any;

    const onRetry = jest.fn();
    const { v2 } = await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith("network");
    expect(v2).toBeTruthy();
  });

  test("un 1er echec reseau (Network request failed, message RN) retry aussi", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error("Network request failed"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: {} }),
      });
    }) as any;

    const onRetry = jest.fn();
    await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledWith("network");
  });

  test("comportement existant conserve : un timeout (AbortError) retente aussi", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        return Promise.reject(abortError);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ v2: {} }),
      });
    }) as any;

    const onRetry = jest.fn();
    await fetchV2({ some: "ctx" }, { onRetry });

    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledWith("timeout");
  });

  test("une erreur non reseau/non timeout (ex: 400) ne retente pas", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "bad payload",
        headers: { get: () => null },
      });
    }) as any;

    await expect(fetchV2({ some: "ctx" })).rejects.toMatchObject({ status: 400 });
    expect(callCount).toBe(1);
  });

  test("si les 2 essais echouent en reseau, l'erreur reseau remonte (pour le fallback UI)", async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.reject(new TypeError("Failed to fetch"))) as any;

    await expect(fetchV2({ some: "ctx" })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});
