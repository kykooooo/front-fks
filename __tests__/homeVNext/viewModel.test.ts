// __tests__/homeVNext/viewModel.test.ts
// =============================================================================
// PROTOTYPE Home vNext — tests de LOGIQUE PURE
// =============================================================================
//
// Ces tests ne rendent aucun composant. Ils verifient que le selecteur respecte
// la doctrine produit sur les 14 etats, et que la cascade de l'action corrige
// bien les defauts d'ordonnancement releves dans l'audit.
//
// NOTE D'EXECUTION : la config jest du depot ignore `.claude/worktrees/`
// (`testPathIgnorePatterns`) — depuis ce worktree, `npx jest` liste 0 test et
// sort en SUCCES. Ce fichier est ecrit pour etre execute par l'agent
// d'integration avec une config dediee, pas par la commande par defaut.
// =============================================================================

import {
  buildHomeVNextViewModel,
  tauxDeRecoupement,
  HOME_VNEXT_SEUILS,
  SEANCES_MIN_POUR_TENDANCE,
  POINTS_MIN_POUR_COURBE,
  JOURS_SANS_SEANCE_POUR_REPRISE,
  JOURS_MATCH_PROCHE,
  NOTE_RECOUPEMENT_MAX,
  SEANCES_POUR_SORTIR_DU_DEMARRAGE,
  type ActionKind,
  type ActionTarget,
  type HomeVNextInput,
  type HomeVNextViewModel,
} from "../../screens/homeVNext/viewModel";
import {
  HOME_VNEXT_FIXTURES,
  HOME_VNEXT_FIXTURES_RENDU,
  getHomeVNextFixture,
  FIXTURE_TODAY_KEY,
  type HomeVNextFixture,
} from "../../screens/homeVNext/fixtures";
import { LIBELLES_ETAT_INTERDITS } from "./libellesEtatInterdits";

// -----------------------------------------------------------------------------
// Outils de test
// -----------------------------------------------------------------------------

const KINDS_VALIDES: ActionKind[] = [
  "commencer",
  "reprendre_seance",
  "voir_seance_terminee",
  "preparer_prochaine",
  "reprendre_programme",
  "completer_info",
  "reessayer",
];

const TARGETS_VALIDES: ActionTarget[] = [
  "session_live",
  "session_preview",
  "generation",
  "choix_cycle",
  "feedback",
  "aucune",
];

/**
 * Vocabulaire interdit dans TOUT le ViewModel : la metrique "serie" (et sa
 * traduction "streak", et sa periphrase "jours d'affilee") est bannie du
 * prototype — ni le mot, ni la metrique, ni une flamme.
 *
 * Le motif est volontairement etroit ("serie"/"series", avec ou sans accent)
 * pour ne pas confondre avec "seance". Si un jour un texte backend legitime
 * contient "series" (ex : "3 series de 8"), il faudra restreindre ce scan aux
 * champs que le selecteur redige lui-meme.
 */
const MOTIF_SERIE_INTERDIT = /(streak|s[eé]ries?\b|jours d'affil)/i;

/**
 * Toutes les entrees soumises aux invariants : les 14 etats produit PLUS le cas
 * de resistance aux textes longs. Ce dernier n'est pas un etat du produit — il
 * ne compte donc pas dans les 14 que le contrat verifie plus bas — mais il doit
 * respecter exactement les memes regles : pas de "serie", pas de tendance sous
 * le seuil, pas de "pourquoi" sans source.
 */
function toutesLesFixtures(): HomeVNextFixture[] {
  return [...HOME_VNEXT_FIXTURES_RENDU];
}

/** Clone profond simple — les fixtures ne contiennent que du JSON. */
function cloner(input: HomeVNextInput): HomeVNextInput {
  return JSON.parse(JSON.stringify(input)) as HomeVNextInput;
}

/** Toutes les chaines lisibles du ViewModel, mises a plat. */
function textesVisibles(vm: HomeVNextViewModel): string[] {
  const out: string[] = [
    vm.header.greeting,
    vm.header.dateLabel,
    vm.header.stateChip?.label ?? "",
    vm.action.label,
    vm.action.sublabel ?? "",
    vm.action.secondary?.label ?? "",
    vm.why?.text ?? "",
    vm.dataNotice ?? "",
    vm.note?.title ?? "",
    vm.note?.message ?? "",
    vm.exit?.label ?? "",
    vm.week?.message ?? "",
  ];
  if (vm.cycle) {
    out.push(vm.cycle.cycleLabel);
    if (vm.cycle.kind === "en_cours") out.push(vm.cycle.phaseLabel);
  }
  if (vm.form) {
    if (vm.form.kind === "available") out.push(vm.form.scope, vm.form.periodLabel);
    else out.push(vm.form.title, vm.form.message);
  }
  return out.filter((s) => s.length > 0);
}

// -----------------------------------------------------------------------------
// 1. Invariants verifies sur les 14 etats
// -----------------------------------------------------------------------------

describe("Home vNext — invariants sur les 14 etats", () => {
  it("expose bien 14 fixtures, toutes marquees fictives et toutes distinctes", () => {
    expect(HOME_VNEXT_FIXTURES).toHaveLength(14);
    const ids = HOME_VNEXT_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(14);
    for (const f of HOME_VNEXT_FIXTURES) {
      expect(f.__fictif).toBe(true);
      expect(f.titre.length).toBeGreaterThan(0);
      expect(f.resume.length).toBeGreaterThan(0);
    }
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — une seule action, valide, jamais dupliquee",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);

      // `action` est UN objet, pas un tableau : deux CTA sont impossibles.
      expect(Array.isArray(vm.action)).toBe(false);
      expect(KINDS_VALIDES).toContain(vm.action.kind);
      expect(TARGETS_VALIDES).toContain(vm.action.target);
      expect(["aplat", "accuse_reception"]).toContain(vm.action.emphasis);
      expect(vm.action.label.trim().length).toBeGreaterThan(0);

      // Au plus UNE action secondaire, et elle ne repete jamais la principale.
      if (vm.action.secondary) {
        expect(vm.action.secondary.label).not.toBe(vm.action.label);
        expect(TARGETS_VALIDES).toContain(vm.action.secondary.target);
      }

      // Un accuse de reception ne navigue nulle part et n'a pas de secondaire.
      if (vm.action.emphasis === "accuse_reception") {
        expect(vm.action.target).toBe("aucune");
        expect(vm.action.secondary).toBeNull();
      }
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — aucune occurrence du vocabulaire 'serie' / 'streak'",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const serialise = JSON.stringify(vm);
      expect(MOTIF_SERIE_INTERDIT.test(serialise)).toBe(false);
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — jamais de 'pourquoi' sans source dans l'entree",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      if (vm.why === null) return;

      const p = fixture.input.pendingSession;
      switch (vm.why.source) {
        case "session_theme":
          expect(p?.sessionTheme ?? "").not.toBe("");
          break;
        case "player_context":
          expect(p?.playerContextSummary ?? "").not.toBe("");
          break;
        case "rationale":
          expect(p?.rationale ?? "").not.toBe("");
          break;
        case "match_proche":
          expect(fixture.input.nextMatch).not.toBeNull();
          break;
        default:
          throw new Error(`source de 'pourquoi' inconnue : ${String(vm.why.source)}`);
      }
      expect(vm.why.text.trim().length).toBeGreaterThan(0);
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — jamais de tendance affichee sous le seuil",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      const nbTerminees = fixture.input.completedSessions.length;

      if (nbTerminees < SEANCES_MIN_POUR_TENDANCE) {
        expect(vm.form?.kind).not.toBe("available");
      }

      if (vm.form && vm.form.kind === "available") {
        expect(nbTerminees).toBeGreaterThanOrEqual(SEANCES_MIN_POUR_TENDANCE);
        expect(vm.form.points.length).toBeGreaterThanOrEqual(POINTS_MIN_POUR_COURBE);
        // La portee est obligatoire et non vide : interdit de faire passer la
        // tendance pour une mesure complete de l'etat physique.
        expect(vm.form.scope.trim().length).toBeGreaterThan(0);
        expect(vm.form.scope.toLowerCase()).toContain("fks");
      }
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — l'etat du jour n'est affiche que si la tendance l'est",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      if (vm.header.stateChip !== null) {
        expect(vm.form?.kind).toBe("available");
      }
    }
  );

  // ---------------------------------------------------------------------------
  // D1 — LA PASTILLE N'EXISTE PLUS EN VARIANTE 2
  // ---------------------------------------------------------------------------
  // Defaut trouve en regardant l'ECRAN ENTIER : la pastille d'en-tete annoncait
  // un etat physique GLOBAL (« En forme », « Un peu chargé ») pendant que la
  // carte, 200 px plus bas, ecrivait « tes entraînements club n'y sont pas
  // comptés ».
  //
  // A l'iteration precedente, la regle etait CONDITIONNELLE : la pastille
  // revenait si l'appelant passait `chargesClubCapturees: true`. Le fondateur a
  // tranche autrement apres avoir regarde l'ecran (D1, 2026-07-28) : retrait
  // COMPLET en variante 2, parce que le modele de charge part encore de valeurs
  // initiales artificielles (ATL0/CTL0) — aucun drapeau d'entree ne peut rendre
  // ce libelle honnete aujourd'hui.
  //
  // Les tests ci-dessous verifient donc l'inverse de ce qu'ils verifiaient : non
  // plus « la pastille revient quand les charges sont connues », mais « aucune
  // entree, aucune option, aucun etat ne peut la faire revenir ».
  // La variante 1 garde la sienne — c'est l'ecart a comparer.
  // ---------------------------------------------------------------------------
  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — variante 1 inchangee : les options par defaut ne modifient RIEN",
    (_id, fixture) => {
      const sansOptions = buildHomeVNextViewModel(fixture.input);
      expect(JSON.stringify(buildHomeVNextViewModel(fixture.input, {}))).toBe(
        JSON.stringify(sansOptions)
      );
      expect(JSON.stringify(buildHomeVNextViewModel(fixture.input, { variante: "v1" }))).toBe(
        JSON.stringify(sansOptions)
      );
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — variante 2 : aucune pastille d'etat, sur AUCUN des 15 etats",
    (_id, fixture) => {
      const v2 = buildHomeVNextViewModel(fixture.input, { variante: "v2" });
      expect(v2.header.stateChip).toBeNull();
    }
  );

  it("variante 2 : aucune option ne peut faire revenir la pastille (D1)", () => {
    // L'option `chargesClubCapturees` a ete SUPPRIMEE du type `HomeVNextOptions`.
    // Le compilateur refuse donc deja de la passer. Ce test prouve qu'a
    // l'execution non plus rien ne revient : on force la vieille option par un
    // cast, exactement comme le ferait un appelant JavaScript (le visualiseur du
    // prototype en est un).
    const f = getHomeVNextFixture("tendance-disponible")!;
    const v1 = buildHomeVNextViewModel(f.input);
    expect(v1.header.stateChip).not.toBeNull();

    const optionsForcees = {
      variante: "v2",
      chargesClubCapturees: true,
    } as unknown as Parameters<typeof buildHomeVNextViewModel>[1];

    expect(buildHomeVNextViewModel(f.input, { variante: "v2" }).header.stateChip).toBeNull();
    expect(buildHomeVNextViewModel(f.input, optionsForcees).header.stateChip).toBeNull();
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — variante 2 : aucun libelle d'etat ne survit nulle part dans le ViewModel",
    (_id, fixture) => {
      // Pas seulement la pastille : le libelle ne doit reapparaitre dans AUCUN
      // champ affichable (sous-titre, message, conseil, metadonnee). Les
      // `protoWarnings` sont exclus — ils sont destines au visualiseur, et c'est
      // precisement leur role de NOMMER ce qui a ete retire.
      const v2 = buildHomeVNextViewModel(fixture.input, { variante: "v2" });
      const affichable = { ...v2, protoWarnings: [] };
      const corpus = JSON.stringify(affichable);
      for (const interdit of LIBELLES_ETAT_INTERDITS) {
        expect(corpus).not.toContain(interdit);
      }
    }
  );

  it("variante 2 : le retrait de la pastille est ECRIT, jamais silencieux", () => {
    const f = getHomeVNextFixture("tendance-disponible")!;
    const v2 = buildHomeVNextViewModel(f.input, { variante: "v2" });
    const avertissement = v2.protoWarnings.find((w) => w.startsWith("D1 "));
    expect(avertissement).toBeDefined();
    // Il nomme le libelle retire : sans ca, le visualiseur ne pourrait pas dire
    // au fondateur ce que la variante 1 affiche a la place.
    expect(avertissement).toContain(
      buildHomeVNextViewModel(f.input).header.stateChip!.label
    );
    // Et il n'apparait QUE la ou il y avait reellement quelque chose a retirer.
    const sansTendance = getHomeVNextFixture("nouveau-joueur")!;
    expect(
      buildHomeVNextViewModel(sansTendance.input, { variante: "v2" }).protoWarnings.some((w) =>
        w.startsWith("D1 ")
      )
    ).toBe(false);
  });

  it("variante 2 : le SEUL ecart avec la variante 1 est la pastille d'etat", () => {
    // Garde-fou de perimetre. Si un jour l'option `variante` se mettait a changer
    // autre chose — un libelle, un bloc, un seuil — ce test tombe. Le fondateur
    // compare deux ecrans : ils ne doivent differer que la ou c'est voulu.
    for (const f of toutesLesFixtures()) {
      const v1 = buildHomeVNextViewModel(f.input);
      const v2 = buildHomeVNextViewModel(f.input, { variante: "v2" });
      expect({
        id: f.id,
        vm: JSON.stringify({
          ...v2,
          header: { ...v2.header, stateChip: v1.header.stateChip },
          protoWarnings: v2.protoWarnings.filter((w) => !w.startsWith("D1 ")),
        }),
      }).toEqual({ id: f.id, vm: JSON.stringify(v1) });
    }
  });

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — le conseil ne recoupe jamais le reste de l'ecran",
    (_id, fixture) => {
      const vm = buildHomeVNextViewModel(fixture.input);
      if (vm.note === null) return;
      const corpus = textesVisibles(vm).filter(
        (t) => t !== vm.note?.message && t !== vm.note?.title
      );
      expect(tauxDeRecoupement(vm.note.message, corpus)).toBeLessThanOrEqual(
        NOTE_RECOUPEMENT_MAX
      );
    }
  );

  it.each(toutesLesFixtures().map((f) => [f.id, f] as const))(
    "%s — fonction pure : deux appels donnent le meme resultat",
    (_id, fixture) => {
      const a = buildHomeVNextViewModel(fixture.input);
      const b = buildHomeVNextViewModel(fixture.input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  );

  it("aucune fixture ne produit d'incoherence de date detectee par le selecteur", () => {
    for (const f of HOME_VNEXT_FIXTURES) {
      const vm = buildHomeVNextViewModel(f.input);
      const incoherences = vm.protoWarnings.filter((w) => w.startsWith("Incoherence d'entree"));
      expect(incoherences).toEqual([]);
    }
  });
});

// -----------------------------------------------------------------------------
// 2. La cascade de l'action
// -----------------------------------------------------------------------------

describe("Home vNext — cascade de l'action", () => {
  const base = () => {
    const f = getHomeVNextFixture("seance-prevue-aujourdhui");
    if (!f) throw new Error("fixture seance-prevue-aujourdhui introuvable");
    return cloner(f.input);
  };

  it("l'erreur de generation passe avant tout le reste", () => {
    const input = base();
    input.generationError = { cause: "reseau", whenISO: "2026-07-30T09:00:00" };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("reessayer");
  });

  it("le retour de seance du passe avant la seance commencee", () => {
    const input = base();
    // Seance d'hier, menee a son terme, sans retour du joueur.
    input.pendingSession = {
      ...input.pendingSession!,
      dateKey: "2026-07-29",
      status: "terminee",
      feedbackGiven: false,
    };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("completer_info");
    expect(vm.action.target).toBe("feedback");
    // Une seule voix : le haut ne dit pas "vas-y" pendant que le bas dit
    // "raconte-moi" (defaut P1.3 / P1.31 de l'audit).
    expect(vm.action.label.toLowerCase()).toContain("comment");
  });

  it("la seance commencee passe avant la seance du jour non commencee", () => {
    const input = base();
    input.pendingSession = { ...input.pendingSession!, status: "commencee" };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("reprendre_seance");
  });

  it("une seance prete pour aujourd'hui n'est jamais effacee par une bascule recuperation", () => {
    // L'ancienne cascade basculait sur "Journee recup" des que le TSB passait
    // sous -15, en effacant la seance du jour. Le selecteur n'a plus AUCUNE
    // branche derivee d'un indicateur de charge : quelle que soit la tendance
    // fournie, la seance du jour reste l'action.
    const input = base();
    input.formTrend = {
      points: [
        { dateKey: "2026-07-26", value: -18.2 },
        { dateKey: "2026-07-27", value: -21.4 },
        { dateKey: "2026-07-28", value: -24.9 },
        { dateKey: "2026-07-29", value: -26.1 },
        { dateKey: "2026-07-30", value: -28.7 },
      ],
      stateLabel: "Charge tres haute",
      observedDayCount: 5,
      autoClubDaysExcluded: 0,
    };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("commencer");
    expect(vm.action.target).toBe("session_live");
  });

  it("une seance datee de demain n'est jamais annoncee comme prete, et porte sa date", () => {
    const input = base();
    input.pendingSession = { ...input.pendingSession!, dateKey: "2026-07-31" };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("preparer_prochaine");
    expect(vm.action.target).toBe("session_preview");
    expect(vm.action.label.toLowerCase()).toContain("demain");
    expect(vm.action.sublabel ?? "").toContain("31 juillet");
    // Le mot "prete" ne doit apparaitre nulle part.
    expect(/pr[eéê]te/i.test(JSON.stringify(vm.action))).toBe(false);
  });

  it("une journee faite produit un accuse de reception, jamais un bouton desactive", () => {
    const f = getHomeVNextFixture("seance-terminee");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.action.kind).toBe("voir_seance_terminee");
    expect(vm.action.emphasis).toBe("accuse_reception");
    expect(vm.action.target).toBe("aucune");
    // Ce qui vient d'etre accompli est nomme.
    expect(vm.action.sublabel ?? "").toContain("min");
  });

  it("sans cycle actif, l'action dit la vraie destination", () => {
    const f = getHomeVNextFixture("nouveau-joueur");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.action.kind).toBe("completer_info");
    expect(vm.action.target).toBe("choix_cycle");
    expect(vm.action.label.toLowerCase()).toContain("cycle");
  });

  it("un cycle boucle est reconnu, et ne renvoie pas vers une generation impossible", () => {
    const input = base();
    input.microcycleSessionIndex = 12;
    input.pendingSession = null;
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("completer_info");
    expect(vm.action.target).toBe("choix_cycle");
    expect(vm.action.sublabel ?? "").toContain("12");
    expect(vm.cycle).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3. Reprise apres interruption
// -----------------------------------------------------------------------------

describe("Home vNext — reprise apres interruption", () => {
  const reprise = () => {
    const f = getHomeVNextFixture("reprise-longue-interruption");
    if (!f) throw new Error("fixture reprise-longue-interruption introuvable");
    return f;
  };

  it("apres une interruption longue : action de reprise, cycle en pause, aucune forme affirmee", () => {
    const vm = buildHomeVNextViewModel(reprise().input);

    expect(vm.action.kind).toBe("reprendre_programme");

    // Le cycle ne peut PAS porter de libelle de phase dans cette variante :
    // "Montee en puissance" apres 24 jours d'arret devient impossible a ecrire.
    expect(vm.cycle?.kind).toBe("en_pause");
    expect(vm.cycle && "phaseLabel" in vm.cycle).toBe(false);
    if (vm.cycle && vm.cycle.kind === "en_pause") {
      expect(vm.cycle.pausedDays).toBeGreaterThanOrEqual(JOURS_SANS_SEANCE_POUR_REPRISE);
    }

    // Aucun etat de forme, aucune courbe — meme si l'entree en fournit une.
    expect(reprise().input.formTrend).not.toBeNull();
    expect(vm.header.stateChip).toBeNull();
    expect(vm.form?.kind).toBe("insufficient");
    if (vm.form && vm.form.kind === "insufficient") {
      expect(vm.form.reason).toBe("reprise_en_cours");
    }

    // Aucun reproche, aucun compteur de semaine a zero.
    expect(vm.week).toBeNull();
  });

  it("la reprise annonce au FUTUR ce que le moteur ne sait pas encore faire", () => {
    const vm = buildHomeVNextViewModel(reprise().input);
    expect(vm.action.sublabel ?? "").toContain("préparera");
    expect(
      vm.protoWarnings.some((w) => w.toLowerCase().includes("reprise progressive"))
    ).toBe(true);
  });

  it("une seance deja prevue pour aujourd'hui prime sur la reprise", () => {
    const input = cloner(reprise().input);
    input.pendingSession = {
      id: "p-reprise",
      dateKey: FIXTURE_TODAY_KEY,
      status: "non_commencee",
      feedbackGiven: false,
      title: "Remise en route",
      durationMin: 30,
      focusPrimaryLabel: "Mobilité",
      intensityLabel: "Facile",
      sessionTheme: null,
      rationale: null,
      playerContextTitle: null,
      playerContextSummary: null,
      coachingTips: [],
    };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).toBe("commencer");
  });

  it("en dessous du seuil, aucun accueil de reprise n'est declenche", () => {
    const input = cloner(reprise().input);
    const veille = JOURS_SANS_SEANCE_POUR_REPRISE - 1;
    // Derniere seance juste sous le seuil (le selecteur derive lui-meme la valeur).
    const d = new Date(`${FIXTURE_TODAY_KEY}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - veille);
    const cle = d.toISOString().slice(0, 10);
    input.completedSessions = input.completedSessions.map((s, i) =>
      i === input.completedSessions.length - 1 ? { ...s, dateKey: cle } : s
    );
    input.daysSinceLastSession = veille;
    const vm = buildHomeVNextViewModel(input);
    expect(vm.action.kind).not.toBe("reprendre_programme");
    expect(vm.cycle?.kind).toBe("en_cours");
  });
});

// -----------------------------------------------------------------------------
// 4. Le Home ne depend jamais d'un club
// -----------------------------------------------------------------------------

describe("Home vNext — independance vis-a-vis du club", () => {
  it("une directive club non appliquee ne change RIEN a l'ecran produit", () => {
    const sans = getHomeVNextFixture("directive-club-absente");
    const avec = getHomeVNextFixture("directive-club-non-appliquee");
    const vmSans = buildHomeVNextViewModel(sans!.input);
    const vmAvec = buildHomeVNextViewModel(avec!.input);

    // On neutralise les `protoWarnings` des deux cotes : ce sont des notes de
    // chantier destinees au visualiseur, elles ne font pas partie de l'ecran
    // produit. Ecrit ainsi plutot qu'en destructurant : deux variables mises au
    // rebut faisaient echouer le lint (`@typescript-eslint/no-unused-vars`),
    // et cette forme dit plus clairement ce qu'on compare.
    const ecranProduit = (vm: typeof vmSans) => JSON.stringify({ ...vm, protoWarnings: [] });
    expect(ecranProduit(vmAvec)).toBe(ecranProduit(vmSans));
  });

  it("la directive non appliquee laisse une trace explicite pour le visualiseur", () => {
    const avec = getHomeVNextFixture("directive-club-non-appliquee");
    const vm = buildHomeVNextViewModel(avec!.input);
    expect(vm.protoWarnings.length).toBeGreaterThanOrEqual(2);
    expect(vm.protoWarnings.some((w) => w.includes("directive club"))).toBe(true);
    // Et nulle part dans l'ecran produit on ne trouve la consigne du coach.
    const produit = JSON.stringify({ ...vm, protoWarnings: [] });
    expect(produit.includes("lève le pied")).toBe(false);
    expect(produit.toLowerCase().includes("coach")).toBe(false);
  });

  it("un joueur sans club obtient un ecran complet", () => {
    const f = getHomeVNextFixture("joueur-autonome-sans-club");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.action.kind).toBe("commencer");
    expect(vm.why).not.toBeNull();
    expect(vm.cycle).not.toBeNull();
    expect(vm.week).not.toBeNull();
    expect(vm.form?.kind).toBe("available");
    expect(vm.note).not.toBeNull();
    expect(vm.exit).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 5. Honnetete des donnees
// -----------------------------------------------------------------------------

describe("Home vNext — honnetete des donnees", () => {
  it("un compte neuf n'affirme aucun etat, aucune tendance, aucun compteur, aucun reproche", () => {
    const f = getHomeVNextFixture("nouveau-joueur");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.header.stateChip).toBeNull();
    expect(vm.form?.kind).toBe("insufficient");
    expect(vm.week).toBeNull(); // pas de "0 sur 2" des la premiere ouverture
    expect(vm.note).toBeNull(); // pas de conseil fourre-tout type "mobilite oubliee"
    expect(vm.exit).toBeNull(); // pas de lien vers un ecran vide de sens
    expect(vm.why).toBeNull();
  });

  it("le selecteur corrige et signale une entree incoherente sur les jours d'inactivite", () => {
    const f = getHomeVNextFixture("jour-sans-seance");
    const input = cloner(f!.input);
    input.daysSinceLastSession = 40; // contredit completedSessions
    const vm = buildHomeVNextViewModel(input);
    expect(vm.protoWarnings.some((w) => w.startsWith("Incoherence d'entree"))).toBe(true);
    // La valeur derivee des seances fait foi : pas de bascule en mode reprise.
    expect(vm.action.kind).not.toBe("reprendre_programme");
  });

  it("hors-ligne : l'ecran le dit, sans bloquer l'action", () => {
    const f = getHomeVNextFixture("hors-ligne");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.dataState).toBe("stale_offline");
    expect(vm.dataNotice).not.toBeNull();
    expect(vm.action.kind).toBe("commencer");
  });

  it("non hydrate : l'etat de donnees l'annonce et le rendu doit squeletter", () => {
    const f = getHomeVNextFixture("seance-prevue-aujourdhui");
    const input = cloner(f!.input);
    input.storeHydrated = false;
    const vm = buildHomeVNextViewModel(input);
    expect(vm.dataState).toBe("hydrating");
    expect(vm.protoWarnings.some((w) => w.includes("squeletter"))).toBe(true);
  });

  it("un match issu d'un jour coche au profil est presente comme tel", () => {
    const f = getHomeVNextFixture("jour-sans-seance");
    const vm = buildHomeVNextViewModel(f!.input);
    expect(vm.why?.source).toBe("match_proche");
    expect(vm.why?.text ?? "").toContain("noté");
    expect(vm.protoWarnings.some((w) => w.includes("jour de semaine"))).toBe(true);
  });

  it("un match hors fenetre n'apparait nulle part", () => {
    const f = getHomeVNextFixture("jour-sans-seance");
    const input = cloner(f!.input);
    input.nextMatch = { dateKey: "2026-08-15", source: "profil_jour_recurrent" };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.why).toBeNull();
    expect(JSON.stringify(vm).toLowerCase().includes("match")).toBe(false);
  });

  it("le compteur de semaine est borne en formulation quand l'objectif est depasse", () => {
    const f = getHomeVNextFixture("jour-sans-seance");
    const input = cloner(f!.input);
    input.fksSessionsCompletedThisWeek = 3; // objectif = 2
    const vm = buildHomeVNextViewModel(input);
    expect(vm.week?.goalExceeded).toBe(true);
    expect(vm.week?.message ?? "").toContain("dépassé");
  });
});

// -----------------------------------------------------------------------------
// 6. Les seuils sont exposes, pas caches
// -----------------------------------------------------------------------------

describe("Home vNext — seuils d'affichage", () => {
  it("les six seuils sont exportes avec leur valeur et leur role", () => {
    expect(HOME_VNEXT_SEUILS).toHaveLength(6);
    const parNom = Object.fromEntries(HOME_VNEXT_SEUILS.map((s) => [s.nom, s.valeur]));
    expect(parNom.SEANCES_MIN_POUR_TENDANCE).toBe(SEANCES_MIN_POUR_TENDANCE);
    expect(parNom.POINTS_MIN_POUR_COURBE).toBe(POINTS_MIN_POUR_COURBE);
    expect(parNom.JOURS_SANS_SEANCE_POUR_REPRISE).toBe(JOURS_SANS_SEANCE_POUR_REPRISE);
    expect(parNom.JOURS_MATCH_PROCHE).toBe(JOURS_MATCH_PROCHE);
    expect(parNom.NOTE_RECOUPEMENT_MAX).toBe(NOTE_RECOUPEMENT_MAX);
    expect(parNom.SEANCES_POUR_SORTIR_DU_DEMARRAGE).toBe(SEANCES_POUR_SORTIR_DU_DEMARRAGE);
    for (const s of HOME_VNEXT_SEUILS) {
      expect(s.role.trim().length).toBeGreaterThan(0);
    }
  });

  it("le test de recoupement detecte reellement une redite", () => {
    const corpus = ["Tu as deux jours de charge dans les jambes, on baisse l'intensité"];
    // Redite quasi mot pour mot -> doit etre au-dessus du seuil.
    expect(
      tauxDeRecoupement("Deux jours de charge dans les jambes : baisse l'intensité", corpus)
    ).toBeGreaterThan(NOTE_RECOUPEMENT_MAX);
    // Information reellement differente -> en dessous.
    expect(
      tauxDeRecoupement("Pose bien le talon au sol sur les fentes.", corpus)
    ).toBeLessThanOrEqual(NOTE_RECOUPEMENT_MAX);
  });

  it("un conseil qui repete le 'pourquoi' est supprime", () => {
    const f = getHomeVNextFixture("seance-prevue-aujourdhui");
    const input = cloner(f!.input);
    input.pendingSession = {
      ...input.pendingSession!,
      coachingTips: [
        // Reprend le theme de seance presque mot pour mot.
        "Tu as deux jours de charge dans les jambes, on garde le volume et on baisse l'intensité",
      ],
    };
    const vm = buildHomeVNextViewModel(input);
    expect(vm.note).toBeNull();
  });
});
