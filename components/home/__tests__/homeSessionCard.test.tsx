// components/home/__tests__/homeSessionCard.test.tsx
// Rendu de la carte « prochaine séance » (SPEC_DA_ACCUEIL_SEANCE.md §2.3) :
// pour chaque état du tableau, le bon kicker/titre/bouton, « Voir la séance »
// seulement avec une séance en attente, la relance feedback seulement si
// `feedbackDue`, bouton désactivé en `day_off`. Même méthode que
// components/home/__tests__/homeProgressionCard.test.tsx.
//
// NOTE D'EXECUTION : depuis un worktree, lancer avec
// `npx jest --config jest.worktree.config.js components/home/__tests__`.

import React from "react";
import { Text } from "react-native";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import HomeSessionCard from "../HomeSessionCard";
import type { PrimaryCtaKind } from "../../../hooks/home/usePrimaryCta";
import type { Session } from "../../../domain/types";
import type { MicrocyclePhaseInfo } from "../../../utils/microcycleUtils";

type Props = React.ComponentProps<typeof HomeSessionCard>;

const CYCLE_PHASE: MicrocyclePhaseInfo = {
  key: "build_1",
  label: "Montée en puissance",
  meaning: "Ça grimpe.",
  sessionNumber: 5,
  total: 12,
};

function sessionEnAttente(overrides: Partial<Session> = {}): Session {
  return {
    date: "2026-09-17",
    id: "s1",
    dateISO: "2026-09-17",
    focus: "mixed",
    phase: "Playlist",
    intensity: "moderate",
    volumeScore: 1,
    exercises: [],
    aiV2: { title: "Fractionné court", focusPrimary: "speed", durationMin: 40 },
    ...overrides,
  };
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    storeHydrated: true,
    primaryCta: {
      label: "Préparer ma séance",
      sub: "On te prépare un programme adapté en 2 min.",
      kind: "prepare",
      disabled: false,
      onPress: jest.fn(),
    },
    pendingSession: null,
    feedbackDue: false,
    onViewPendingSession: jest.fn(),
    onFeedback: jest.fn(),
    cycleId: "force",
    cycleDone: false,
    cyclePhase: CYCLE_PHASE,
    onManageCycle: jest.fn(),
    ...overrides,
  };
}

function monter(props: Props) {
  let rendu: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    rendu = TestRenderer.create(<HomeSessionCard {...props} />);
  });
  if (!rendu) throw new Error("rendu impossible");
  return rendu as TestRenderer.ReactTestRenderer;
}

function demonter(rendu: TestRenderer.ReactTestRenderer) {
  act(() => {
    rendu.unmount();
  });
}

function textes(instance: ReactTestInstance): string[] {
  return instance
    .findAllByType(Text)
    .flatMap((n) =>
      React.Children.toArray(n.props.children as React.ReactNode).filter(
        (c): c is string => typeof c === "string"
      )
    );
}

function corpus(instance: ReactTestInstance): string {
  return textes(instance).join("\n");
}

/**
 * Le bouton (rôle "button") dont l'`accessibilityLabel` vérifie `pred` —
 * `deep: false` : un `Pressable` composite ET le nœud hôte qu'il rend
 * portent tous les deux `accessibilityRole`/`accessibilityLabel` ; sans
 * cette garde, chaque bouton serait trouvé deux fois. Ne filtre PAS sur
 * `typeof onPress === "function"` : un bouton désactivé (day_off) a
 * légitimement `onPress: undefined`.
 */
function boutonPar(
  racine: ReactTestInstance,
  pred: (label: string) => boolean
): ReactTestInstance | undefined {
  return racine.findAll(
    (n) =>
      n.props.accessibilityRole === "button" &&
      typeof n.props.accessibilityLabel === "string" &&
      pred(n.props.accessibilityLabel as string),
    { deep: false }
  )[0];
}

describe("HomeSessionCard — squelette d'hydratation", () => {
  test("!storeHydrated : aucun texte de verdict, pas de bouton principal", () => {
    const rendu = monter(baseProps({ storeHydrated: false }));
    expect(corpus(rendu.root)).toBe("");
    expect(rendu.root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
    demonter(rendu);
  });
});

describe("HomeSessionCard — kind: prepare", () => {
  test("kicker, titre = libellé du cycle, méta = séance N sur total · phase, bouton = label du CTA", () => {
    const rendu = monter(baseProps());
    const t = corpus(rendu.root);
    expect(t).toContain("TA PROCHAINE SÉANCE");
    expect(t).toContain("Duels & puissance"); // MICROCYCLES.force.label
    expect(t).toContain("Séance 5 sur 12 · Montée en puissance");
    expect(t).toContain("Préparer ma séance");
    demonter(rendu);
  });

  test("la ligne méta cycle est pressable et ouvre CycleModal via onManageCycle", () => {
    const onManageCycle = jest.fn();
    const rendu = monter(baseProps({ onManageCycle }));
    const ligneMeta = boutonPar(rendu.root, (l) => l.startsWith("Gérer mon cycle"));
    expect(ligneMeta).toBeDefined();
    act(() => {
      (ligneMeta!.props as { onPress: () => void }).onPress();
    });
    expect(onManageCycle).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("cyclePhase null → aucune méta inventée", () => {
    const rendu = monter(baseProps({ cyclePhase: null }));
    expect(corpus(rendu.root)).not.toContain("Séance");
    demonter(rendu);
  });

  test("aucune note d'attention, aucun « Voir la séance »", () => {
    const rendu = monter(baseProps());
    expect(corpus(rendu.root)).not.toContain("Voir la séance");
    demonter(rendu);
  });
});

describe("HomeSessionCard — kind: start_today / start_pending (séance en attente)", () => {
  const KINDS: PrimaryCtaKind[] = ["start_today", "start_pending"];

  test.each(KINDS)("%s : kicker + titre/méta issus de decrireSeanceEnAttente, bouton = label du CTA", (kind) => {
    const rendu = monter(
      baseProps({
        primaryCta: { label: "C'est parti !", kind, disabled: false, onPress: jest.fn() },
        pendingSession: sessionEnAttente(),
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("TA SÉANCE EST PRÊTE");
    expect(t).toContain("Fractionné court");
    expect(t).toContain("Vitesse");
    expect(t).toContain("40 min");
    expect(t).toContain("C'est parti !");
    demonter(rendu);
  });

  test("« Voir la séance » est présent avec une séance en attente et appelle onViewPendingSession", () => {
    const onViewPendingSession = jest.fn();
    const rendu = monter(
      baseProps({
        primaryCta: { label: "Ma séance est prête", kind: "start_pending", disabled: false, onPress: jest.fn() },
        pendingSession: sessionEnAttente(),
        onViewPendingSession,
      })
    );
    expect(corpus(rendu.root)).toContain("Voir la séance");
    const bouton = boutonPar(rendu.root, (l) => l === "Voir la séance");
    expect(bouton).toBeDefined();
    act(() => {
      (bouton!.props as { onPress: () => void }).onPress();
    });
    expect(onViewPendingSession).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("feedbackDue = false : aucune relance feedback", () => {
    const rendu = monter(
      baseProps({
        primaryCta: { label: "Ma séance est prête", kind: "start_pending", disabled: false, onPress: jest.fn() },
        pendingSession: sessionEnAttente(),
        feedbackDue: false,
      })
    );
    expect(corpus(rendu.root)).not.toContain("Comment ça s'est passé");
    demonter(rendu);
  });

  test("feedbackDue = true : la note + « Comment ça s'est passé ? » apparaissent et appellent onFeedback", () => {
    const onFeedback = jest.fn();
    const rendu = monter(
      baseProps({
        primaryCta: { label: "Ma séance est prête", kind: "start_pending", disabled: false, onPress: jest.fn() },
        pendingSession: sessionEnAttente(),
        feedbackDue: true,
        onFeedback,
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante.");
    expect(t).toContain("Comment ça s'est passé ?");
    const bouton = boutonPar(rendu.root, (l) => l === "Comment ça s'est passé ?");
    expect(bouton).toBeDefined();
    act(() => {
      (bouton!.props as { onPress: () => void }).onPress();
    });
    expect(onFeedback).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("la ligne méta cycle n'est jamais pressable en état « séance en attente »", () => {
    const rendu = monter(
      baseProps({
        primaryCta: { label: "Ma séance est prête", kind: "start_pending", disabled: false, onPress: jest.fn() },
        pendingSession: sessionEnAttente(),
      })
    );
    const ligneMeta = boutonPar(rendu.root, (l) => l.startsWith("Gérer mon cycle"));
    expect(ligneMeta).toBeUndefined();
    demonter(rendu);
  });
});

describe("HomeSessionCard — kind: day_off", () => {
  test("bouton désactivé, sous-texte = primaryCta.sub, méta = ligne cycle", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée off",
          sub: "Tu as déjà fait ta séance aujourd'hui.",
          kind: "day_off",
          disabled: true,
          onPress: undefined,
        },
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("Journée off");
    expect(t).toContain("Tu as déjà fait ta séance aujourd'hui.");
    const bouton = boutonPar(rendu.root, (l) => l === "Journée off");
    expect(bouton).toBeDefined();
    expect(
      (bouton!.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState?.disabled
    ).toBe(true);
    expect((bouton!.props as { disabled?: boolean }).disabled).toBe(true);
    demonter(rendu);
  });
});

describe("HomeSessionCard — kind: recovery", () => {
  test("cycle actif : titre = libellé du cycle, méta cycle affichée, note d'attention avec primaryCta.sub", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          kind: "recovery",
          disabled: false,
          onPress: jest.fn(),
        },
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("AUJOURD'HUI");
    expect(t).toContain("Duels & puissance");
    expect(t).toContain("Ton corps a besoin de souffler. Fais une séance légère.");
    expect(t).toContain("Journée récup");
    demonter(rendu);
  });

  test("sans cycle actif : titre = « Récupération », aucune méta", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          kind: "recovery",
          disabled: false,
          onPress: jest.fn(),
        },
        cycleId: null,
        cyclePhase: null,
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("Récupération");
    expect(t).not.toContain("Séance 5 sur 12");
    demonter(rendu);
  });

  // RÉGRESSION CORRIGÉE (rework orchestrateur) : dans usePrimaryCta,
  // computePrimaryCtaKind évalue tsb <= -15 ("recovery") AVANT
  // isPendingToday/hasPendingSession. Un joueur très fatigué AVEC une séance
  // en attente obtient donc kind === "recovery" tout en ayant une vraie
  // `pendingSession` — "Voir la séance" et la relance feedback (qui débloque
  // la génération suivante, règle 4 du dépôt) ne doivent PAS disparaître
  // dans cet état : ils dépendent de la PRÉSENCE de `pendingSession`, pas de
  // `kind`.
  test("recovery + séance en attente : « Ta séance est prête » + « Voir la séance » apparaissent, et le bouton reste « Journée récup »", () => {
    const onViewPendingSession = jest.fn();
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          kind: "recovery",
          disabled: false,
          onPress: jest.fn(),
        },
        pendingSession: sessionEnAttente(),
        onViewPendingSession,
      })
    );
    const t = corpus(rendu.root);
    // Le gabarit "recovery" (kicker, titre de cycle, note, bouton) est conservé.
    expect(t).toContain("AUJOURD'HUI");
    expect(t).toContain("Journée récup");
    // L'accès à la séance en attente survit, explicité par la ligne dédiée.
    expect(t).toContain("Ta séance est prête : Fractionné court");
    expect(t).toContain("Voir la séance");
    const bouton = boutonPar(rendu.root, (l) => l === "Voir la séance");
    expect(bouton).toBeDefined();
    act(() => {
      (bouton!.props as { onPress: () => void }).onPress();
    });
    expect(onViewPendingSession).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("recovery + séance en attente + feedbackDue : la relance feedback apparaît et appelle onFeedback", () => {
    const onFeedback = jest.fn();
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          kind: "recovery",
          disabled: false,
          onPress: jest.fn(),
        },
        pendingSession: sessionEnAttente(),
        feedbackDue: true,
        onFeedback,
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante.");
    expect(t).toContain("Comment ça s'est passé ?");
    const bouton = boutonPar(rendu.root, (l) => l === "Comment ça s'est passé ?");
    expect(bouton).toBeDefined();
    act(() => {
      (bouton!.props as { onPress: () => void }).onPress();
    });
    expect(onFeedback).toHaveBeenCalledTimes(1);
    demonter(rendu);
  });

  test("recovery sans séance en attente : ni « Voir la séance » ni relance feedback", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          kind: "recovery",
          disabled: false,
          onPress: jest.fn(),
        },
        pendingSession: null,
        feedbackDue: false,
      })
    );
    const t = corpus(rendu.root);
    expect(t).not.toContain("Voir la séance");
    expect(t).not.toContain("Ta séance est prête");
    expect(t).not.toContain("Comment ça s'est passé");
    demonter(rendu);
  });
});

describe("HomeSessionCard — kind: choose_cycle", () => {
  test("cycle non terminé (aucun cycle) : « Choisis ton cycle », méta = primaryCta.sub", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Choisir mon cycle",
          sub: "5 cycles, 12 séances chacun.",
          kind: "choose_cycle",
          disabled: false,
          onPress: jest.fn(),
        },
        cycleId: null,
        cycleDone: false,
        cyclePhase: null,
      })
    );
    const t = corpus(rendu.root);
    expect(t).toContain("TON PROGRAMME");
    expect(t).toContain("Choisis ton cycle");
    expect(t).toContain("5 cycles, 12 séances chacun.");
    demonter(rendu);
  });

  test("cycle terminé : « Cycle terminé »", () => {
    const rendu = monter(
      baseProps({
        primaryCta: {
          label: "Choisir mon cycle",
          sub: "5 cycles, 12 séances chacun.",
          kind: "choose_cycle",
          disabled: false,
          onPress: jest.fn(),
        },
        cycleDone: true,
        cyclePhase: null,
      })
    );
    expect(corpus(rendu.root)).toContain("Cycle terminé");
    demonter(rendu);
  });
});
