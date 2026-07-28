// hooks/coach/__tests__/useRemoveClubMember.test.tsx
//
// L'INVARIANT VERROUILLÉ ICI : l'état d'un retrait n'appartient qu'à la cible sur
// laquelle le geste a été fait. Un « retiré » (ou un message d'échec) affiché sur
// le mauvais joueur serait le pire mensonge possible de la fiche coach.
//
// Il tient au rendu, plus dans un effet de remise à zéro : ces tests le prouvent
// dans les deux cas où un effet arrivait de toute façon trop tard — le changement
// de fiche lui-même, et la réponse serveur qui revient APRÈS ce changement.

import { renderHook, flush, deferred, actAsync } from "./hookHarness";

jest.mock("../../../services/clubMembers", () => ({
  removeClubMember: jest.fn(),
  deactivateClubPlayer: jest.fn(),
  revokeClubStaffAccess: jest.fn(),
}));

import {
  deactivateClubPlayer,
  removeClubMember,
  revokeClubStaffAccess,
} from "../../../services/clubMembers";
import { useClubMemberGeste, useRemoveClubMember } from "../useRemoveClubMember";
import type { RemoveMemberOutcome } from "../../../services/clubMembers";

const removeMock = removeClubMember as jest.MockedFunction<typeof removeClubMember>;
const suiviMock = deactivateClubPlayer as jest.MockedFunction<typeof deactivateClubPlayer>;
const encadrementMock = revokeClubStaffAccess as jest.MockedFunction<
  typeof revokeClubStaffAccess
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useRemoveClubMember — le retrait", () => {
  test("état neutre au montage, aucun appel tant que le coach n'a rien demandé", async () => {
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    expect(h.current.phase).toEqual({ kind: "idle" });
    expect(h.current.isRemoving).toBe(false);
    expect(removeMock).not.toHaveBeenCalled();
    await h.unmount();
  });

  test("retrait abouti → pending puis done, sans toucher au cache local", async () => {
    const d = deferred<RemoveMemberOutcome>();
    removeMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    expect(h.current.phase).toEqual({ kind: "pending" });
    expect(h.current.isRemoving).toBe(true);

    d.resolve({ ok: true, alreadyRemoved: false });
    await flush();
    expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: false });
    expect(h.current.isRemoving).toBe(false);
    expect(removeMock).toHaveBeenCalledWith("clubX", "p1");
    await h.unmount();
  });

  test("échec serveur → failed, message du service repris tel quel", async () => {
    removeMock.mockResolvedValue({
      ok: false,
      reason: "ownerTransferRequired",
      message: "Transférez d'abord la propriété du club.",
    });
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();
    expect(h.current.phase).toEqual({
      kind: "failed",
      reason: "ownerTransferRequired",
      message: "Transférez d'abord la propriété du club.",
    });
    await h.unmount();
  });

  test("un geste à la fois : un second appui pendant l'appel n'émet pas un second retrait", async () => {
    const d = deferred<RemoveMemberOutcome>();
    removeMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await actAsync(() => h.current.remove());
    expect(removeMock).toHaveBeenCalledTimes(1);

    d.resolve({ ok: true, alreadyRemoved: false });
    await flush();
    await h.unmount();
  });

  test("reset ramène à idle, et reste sans effet pendant l'appel", async () => {
    const d = deferred<RemoveMemberOutcome>();
    removeMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await actAsync(() => h.current.reset());
    // Appel en vol : on ne prétend pas être revenu à zéro pendant que le serveur
    // travaille encore.
    expect(h.current.phase).toEqual({ kind: "pending" });

    d.resolve({ ok: true, alreadyRemoved: false });
    await flush();
    await actAsync(() => h.current.reset());
    expect(h.current.phase).toEqual({ kind: "idle" });
    await h.unmount();
  });
});

describe("useRemoveClubMember — l'état n'appartient qu'à sa cible", () => {
  test("changement de joueur : le « retiré » du précédent n'est PAS affiché", async () => {
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: false });
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();
    expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: false });

    await h.rerender(() => useRemoveClubMember("clubX", "p2"));
    expect(h.current.phase).toEqual({ kind: "idle" });
    expect(h.current.isRemoving).toBe(false);
    await h.unmount();
  });

  test("changement de club (même uid) : l'échec du précédent n'est PAS affiché", async () => {
    removeMock.mockResolvedValue({
      ok: false,
      reason: "denied",
      message: "Retrait impossible avec ce compte.",
    });
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();
    expect(h.current.phase.kind).toBe("failed");

    await h.rerender(() => useRemoveClubMember("clubY", "p1"));
    expect(h.current.phase).toEqual({ kind: "idle" });
    await h.unmount();
  });

  test("réponse revenue APRÈS le changement de fiche : elle ne s'affiche jamais sur la nouvelle", async () => {
    const d = deferred<RemoveMemberOutcome>();
    removeMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    // Le coach quitte la fiche de p1 avant que le serveur ait répondu.
    await h.rerender(() => useRemoveClubMember("clubX", "p2"));
    expect(h.current.phase).toEqual({ kind: "idle" });

    d.resolve({ ok: true, alreadyRemoved: false });
    await flush();
    // La réponse concerne p1 : sur la fiche de p2, il ne s'est rien passé.
    expect(h.current.phase).toEqual({ kind: "idle" });
    expect(h.current.isRemoving).toBe(false);
    await h.unmount();
  });

  test("retour sur la fiche d'origine : l'état retrouvé est bien le sien", async () => {
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: true });
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();
    await h.rerender(() => useRemoveClubMember("clubX", "p2"));
    expect(h.current.phase).toEqual({ kind: "idle" });

    await h.rerender(() => useRemoveClubMember("clubX", "p1"));
    expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: true });
    await h.unmount();
  });

  test("cible incomplète (pas de club, pas d'uid) : aucun appel, état neutre", async () => {
    const h = await renderHook(() => useRemoveClubMember(null, "p1"));

    await actAsync(() => h.current.remove());
    expect(removeMock).not.toHaveBeenCalled();
    expect(h.current.phase).toEqual({ kind: "idle" });
    await h.unmount();
  });
});

// ─── LES TROIS GESTES ────────────────────────────────────────────────────────
//
// L'invariant ajouté ici : le GESTE fait partie de la cible d'un état. Deux
// gestes montés sur la MÊME fiche ne doivent jamais partager un « fait » — sinon
// « suivi arrêté » s'afficherait sous le bouton « retirer du club ».

describe("useClubMemberGeste — un geste, un service, un état", () => {
  test("chaque geste appelle SON service, et lui seul", async () => {
    const cas = [
      ["arret-suivi", suiviMock],
      ["retrait-encadrement", encadrementMock],
      ["retrait-complet", removeMock],
    ] as const;

    for (const [geste, attendu] of cas) {
      jest.clearAllMocks();
      attendu.mockResolvedValue({ ok: true, alreadyRemoved: false });
      const h = await renderHook(() => useClubMemberGeste(geste, "clubX", "p1"));

      await actAsync(() => h.current.remove());
      await flush();

      expect(attendu).toHaveBeenCalledWith("clubX", "p1");
      expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: false });
      for (const [, autre] of cas) {
        if (autre !== attendu) expect(autre).not.toHaveBeenCalled();
      }
      await h.unmount();
    }
  });

  test("changement de GESTE sur la même fiche : l'état du précédent n'est PAS affiché", async () => {
    suiviMock.mockResolvedValue({ ok: true, alreadyRemoved: false });
    const h = await renderHook(() => useClubMemberGeste("arret-suivi", "clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();
    expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: false });

    // Même club, même joueur, AUTRE geste : rien n'a eu lieu de ce côté-là.
    await h.rerender(() => useClubMemberGeste("retrait-complet", "clubX", "p1"));
    expect(h.current.phase).toEqual({ kind: "idle" });
    expect(h.current.isRemoving).toBe(false);

    // Et l'état du premier geste est retrouvé intact en y revenant.
    await h.rerender(() => useClubMemberGeste("arret-suivi", "clubX", "p1"));
    expect(h.current.phase).toEqual({ kind: "done", alreadyRemoved: false });
    await h.unmount();
  });

  test("un refus typé remonte tel quel, sans être traduit une seconde fois", async () => {
    encadrementMock.mockResolvedValue({
      ok: false,
      reason: "staffOwnerOnly",
      message: "Seul le propriétaire du club peut modifier ses accès.",
    });
    const h = await renderHook(() => useClubMemberGeste("retrait-encadrement", "clubX", "c2"));

    await actAsync(() => h.current.remove());
    await flush();

    expect(h.current.phase).toEqual({
      kind: "failed",
      reason: "staffOwnerOnly",
      message: "Seul le propriétaire du club peut modifier ses accès.",
    });
    await h.unmount();
  });

  test("useRemoveClubMember reste l'alias du retrait COMPLET", async () => {
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: false });
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));

    await actAsync(() => h.current.remove());
    await flush();

    expect(removeMock).toHaveBeenCalledWith("clubX", "p1");
    expect(suiviMock).not.toHaveBeenCalled();
    expect(encadrementMock).not.toHaveBeenCalled();
    await h.unmount();
  });
});
