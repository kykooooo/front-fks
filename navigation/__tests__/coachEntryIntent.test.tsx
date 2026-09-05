// navigation/__tests__/coachEntryIntent.test.tsx
//
// UN COACH PEUT-IL ENTRER SANS TRAVERSER LE QUESTIONNAIRE JOUEUR ?
//
// Recette téléphone du 03/08 : « comment un coach est obligé de faire
// l'inscription ?! il devrait y avoir un truc pour accéder direct ». Le seul
// chemin coach existant était un lien en pied de la PREMIÈRE étape du setup
// joueur — après le prénom, le poste, la catégorie, le niveau, le pied fort.
//
// Ce que cette suite protège, dans l'ordre du parcours :
//
//  1. l'entrée existe sur l'écran d'accueil, elle est SECONDAIRE (elle ne
//     dispute pas sa place au CTA joueur), et elle produit une INTENTION ;
//  2. cette intention ne contamine pas le chemin joueur : « Commencer » et
//     « J'ai déjà un compte » n'en portent aucune ;
//  3. la navigation la consomme pour choisir l'écran d'ARRIVÉE, et rien d'autre.
//     En particulier elle n'écrit ni ne lit `users/{uid}.role` : ce champ est
//     écrivable par le client, il ne décide plus d'aucun espace depuis le lot
//     « un compte, un espace » (domain/appSpace.ts), et une intention d'écran
//     n'est pas une autorité ;
//  4. l'espace DÉRIVÉ (appartenance au club) est tranché AVANT elle — un coach
//     déjà rattaché n'a pas besoin d'intention, et un joueur ne peut pas s'en
//     fabriquer une ;
//  5. l'écran d'arrivée n'est pas un cul-de-sac : quand la création de club est
//     la première route de la pile, « Retour » ne mènerait nulle part.
//
// Méthode : rendu réel pour l'écran d'accueil (le geste et ce qu'il produit),
// lecture de source pour le navigateur — le monter demanderait Firebase, la
// navigation et l'intégralité des écrans. Même parti pris, et même raison, que
// `rootNavigatorSpaceWiring.test.ts` / `coachAccessInvariants.test.ts`.

import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import WelcomeScreen from "../../screens/WelcomeScreen";
import CoachOnboardingScreen from "../../screens/CoachOnboardingScreen";
import { resolveAppSpace, type ClubMembershipReading } from "../../domain/appSpace";

// L'écran de création de club lit sa navigation par le hook. On la remplace par
// une navigation qu'on pilote : c'est exactement la variable qui décide du geste
// de sortie affiché (peut-on revenir en arrière, oui ou non).
const mockNavigation = { canGoBack: jest.fn(() => false), goBack: jest.fn(), navigate: jest.fn() };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

const racine = resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");
const navigateur = lire("navigation/RootNavigator.tsx");

/**
 * Retire les commentaires (lignes doubles-slash et blocs) avant une recherche
 * de motif anti-régression. SANS ce retrait, un motif large se déclenche sur
 * sa PROPRE documentation : ce fichier explique en prose l'ancien champ qu'il
 * vient de retirer (« AVANT, on lisait users/{uid}.role === "coach" »), et
 * cette phrase contient elle-même `.role` et `role ===`. Naïf (ne gère pas un
 * commentaire ouvert à l'intérieur d'une chaîne), mais suffisant ici : ce
 * fichier n'en contient aucun (vérifié).
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// Métriques figées : sans elles, SafeAreaProvider attend une mesure native qui
// n'arrive jamais en test et ne rend aucun enfant.
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montes: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (montes.length) montes.pop()?.unmount();
  });
  mockNavigation.canGoBack.mockClear();
  mockNavigation.goBack.mockClear();
  mockNavigation.navigate.mockClear();
});

/** Déclenche le `onPress` d'une commande trouvée dans l'arbre rendu. */
function presser(cible: TestRenderer.ReactTestInstance): unknown {
  return (cible.props.onPress as () => unknown)();
}

/** Rend l'écran d'accueil et renvoie de quoi appuyer sur ses commandes. */
async function rendreAccueil() {
  const onComplete = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  // `await act(async ...)` : Ionicons charge sa police via un setState async.
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeScreen onComplete={onComplete} />
      </SafeAreaProvider>
    );
  });
  montes.push(renderer);

  /** La commande qui porte ce libellé d'accessibilité, et son `onPress`. */
  const commande = (label: string) => {
    const trouves = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function",
      { deep: true }
    );
    return trouves[0];
  };

  const appuyer = async (label: string) => {
    const cible = commande(label);
    expect(cible).toBeDefined();
    await act(async () => {
      await presser(cible);
    });
  };

  return { onComplete, renderer, commande, appuyer };
}

const LABEL_COACH = "Je suis coach, créer mon club";
const LABEL_INSCRIPTION = "Commencer l'inscription";
const LABEL_CONNEXION = "J'ai déjà un compte, me connecter";

describe("écran d'accueil — l'entrée coach existe et reste secondaire", () => {
  test("le libellé « Je suis coach » est affiché et tappable", async () => {
    const { commande } = await rendreAccueil();
    expect(commande(LABEL_COACH)).toBeDefined();
  });

  test("elle ne dispute pas sa place au CTA joueur", async () => {
    // Le seul CTA primaire de l'écran reste « Commencer » (règle d'or : un seul
    // par écran). L'entrée coach est un lien, pas un second bouton — la source
    // le dit sans ambiguïté : elle ne passe pas par le composant <Button>.
    const source = lire("screens/WelcomeScreen.tsx");
    const blocCoach = source.slice(source.indexOf("accessibilityLabel=\"Je suis coach"));
    expect(blocCoach.slice(0, 400)).not.toContain("<Button");
    // Et le CTA joueur, lui, est bien le Button primaire.
    expect(source).toMatch(/label="Commencer"[\s\S]{0,200}variant="primary"/);
  });
});

describe("écran d'accueil — ce que chaque geste déclare", () => {
  test("« Je suis coach » → inscription, AVEC l'intention coach", async () => {
    const { onComplete, appuyer } = await rendreAccueil();
    await appuyer(LABEL_COACH);
    expect(onComplete).toHaveBeenCalledWith("register", { intentionCoach: true });
  });

  test("« Commencer » → inscription joueur, SANS intention coach", async () => {
    const { onComplete, appuyer } = await rendreAccueil();
    await appuyer(LABEL_INSCRIPTION);
    // Un joueur ne devient pas coach par accident : l'appel ne porte aucune
    // intention (ni `true`, ni un objet qu'on pourrait mal lire plus tard).
    expect(onComplete).toHaveBeenCalledWith("register");
    const [, options] = onComplete.mock.calls[0];
    expect(options?.intentionCoach).toBeFalsy();
  });

  test("« J'ai déjà un compte » → connexion, SANS intention coach", async () => {
    const { onComplete, appuyer } = await rendreAccueil();
    await appuyer(LABEL_CONNEXION);
    expect(onComplete).toHaveBeenCalledWith("login");
    const [, options] = onComplete.mock.calls[0];
    expect(options?.intentionCoach).toBeFalsy();
  });

  test("chaque geste passe par le hook haptique central, jamais par expo-haptics", async () => {
    const source = lire("screens/WelcomeScreen.tsx");
    expect(source).toContain("useHaptics()");
    expect(source).not.toContain("expo-haptics");
    // Les trois gestes de sortie de l'écran donnent un retour au doigt.
    for (const handler of ["handleStart", "handleLogin", "handleCoach"]) {
      const bloc = source.slice(source.indexOf(`const ${handler} =`));
      expect(bloc.slice(0, 300)).toMatch(/haptics\.impact(Light|Medium)\(\)/);
    }
  });
});

describe("navigation — l'intention choisit un ÉCRAN, jamais un droit", () => {
  test("elle remonte de l'accueil jusqu'à un état de navigation", () => {
    // L'écran d'accueil la rend ; le navigateur la range dans son propre état.
    expect(navigateur).toContain("const [intentionCoach, setIntentionCoach] = useState(false)");
    expect(navigateur).toContain("onWelcomeComplete?.(options)");
    // Les trois boutons de l'accueil sont exclusifs : « Je suis coach » pose,
    // les deux autres oublient (mémoire ET disque).
    const brancheAccueil = navigateur.slice(navigateur.indexOf("onWelcomeComplete={(options) => {"));
    expect(brancheAccueil.slice(0, 800)).toContain("setIntentionCoach(true)");
    expect(brancheAccueil.slice(0, 800)).toContain("oublierIntentionCoach()");
  });

  test("le portillon d'onboarding arrive sur la création de club si elle est posée", () => {
    expect(navigateur).toContain(
      'initialRouteName={intentionCoach && !clubId ? "CoachOnboarding" : "ProfileSetupGate"}'
    );
    // Et l'écran de création est bien déclaré dans CE navigateur-là (sinon la
    // route initiale pointerait dans le vide).
    const gate = navigateur.slice(navigateur.indexOf('key="nav-gate"'));
    expect(gate).toContain('name="CoachOnboarding"');
    expect(gate).toContain('name="ProfileSetupGate"');
  });

  test("elle n'est écrite NULLE PART en base — ni dans `users/{uid}.role`, ni ailleurs", () => {
    // Le champ client falsifiable ne revient pas par la fenêtre.
    //
    // Motif élargi (revue du 03/08) : `/data\?\.role/` seul ne voyait qu'UNE
    // façon d'y accéder — `data?.role` avec chaînage optionnel. `data.role`
    // sans le `?`, `snap.data().role`, une réaffectation `role = ...`, une clé
    // d'objet `role: ...`, ou une déstructuration `const { role } = ...`
    // seraient tous passés au travers du motif d'origine. On cherche donc le
    // même fait par trois motifs, chacun couvrant une syntaxe différente pour
    // LIRE ce champ :
    //  - tout ACCÈS PROPRIÉTÉ, quel que soit l'objet devant (`\.role\b`) ;
    //  - toute CLÉ D'OBJET ou (RÉ)AFFECTATION (`\brole\s*[:=]`) ;
    //  - toute DÉSTRUCTURATION, `role` en première position ou non
    //    (`[{,]\s*role\s*[,}]`).
    // On retire d'abord les commentaires (cf. `sansCommentaires`) : ce fichier
    // EXPLIQUE l'ancien champ en prose (« AVANT, on lisait
    // `users/{uid}.role === "coach"` », dans le commentaire qui dit pourquoi
    // il a disparu) — sans ce retrait, le motif élargi se déclencherait sur sa
    // propre documentation.
    const code = sansCommentaires(navigateur);
    expect(code).not.toMatch(/\.role\b/);
    expect(code).not.toMatch(/\brole\s*[:=]/);
    expect(code).not.toMatch(/[{,]\s*role\s*[,}]/);
    for (const chemin of [
      "navigation/RootNavigator.tsx",
      "screens/WelcomeScreen.tsx",
      "screens/CoachOnboardingScreen.tsx",
      "screens/ProfileSetupScreen.tsx",
    ]) {
      expect(lire(chemin)).not.toMatch(/role:\s*"coach"/);
    }
    // L'écran d'accueil n'écrit rien du tout EN BASE : l'intention vit en
    // mémoire et sur le disque local (AsyncStorage), jamais dans Firestore.
    const accueil = lire("screens/WelcomeScreen.tsx");
    expect(accueil).not.toMatch(/setDoc|updateDoc|firebase\/firestore/);
  });

  test("l'espace DÉRIVÉ est tranché avant elle", () => {
    // Un coach déjà rattaché à son club voit l'espace coach sans aucune
    // intention ; et une intention ne peut pas ouvrir cet espace, puisque la
    // branche qui le décide est évaluée AVANT le portillon d'onboarding.
    const indexEspaceCoach = navigateur.indexOf('appSpace.space === "coach"');
    // Ancre : le retour conditionnel du portillon lui-même. Depuis la garde
    // de complétude joueur (audit 2026-09, P1-04), il teste DEUX conditions —
    // le drapeau, et les champs de dosage réellement présents.
    const indexPortillon = navigateur.indexOf(
      "if (profileCompleted === false || profilJoueurComplet === false)"
    );
    expect(indexEspaceCoach).toBeGreaterThan(-1);
    expect(indexPortillon).toBeGreaterThan(-1);
    expect(indexEspaceCoach).toBeLessThan(indexPortillon);

    // Preuve que le rôle applicatif n'entre pas dans la dérivation : il n'en
    // est même pas un paramètre (cf. domain/appSpace.ts).
    //
    // `resolveAppSpace).toHaveLength(1)` (motif d'origine) est un piège :
    // `Function.length` ignore tout paramètre porteur d'une valeur par défaut
    // — exactement le cas de `preference = null` ici. Un TROISIÈME paramètre
    // `role = null` passerait donc inaperçu de `toHaveLength(1)`, qui resterait
    // à 1, alors qu'il rouvrirait exactement la faille que ce lot ferme. Deux
    // preuves qui ne partagent pas cet angle mort :
    //
    //  1. la SIGNATURE RÉELLE déclarée dans la source (pas celle, appauvrie,
    //     que `Function.length` expose) — exactement deux paramètres, et aucun
    //     ne s'appelle (ni ne contient) "role" ;
    const domaine = lire("domain/appSpace.ts");
    const signature = domaine.match(/export function resolveAppSpace\(([\s\S]*?)\)\s*:\s*AppSpaceDecision/);
    expect(signature).not.toBeNull();
    const parametres = (signature as RegExpMatchArray)[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    expect(parametres).toHaveLength(2);
    expect(parametres.some((p) => /role/i.test(p))).toBe(false);

    //  2. l'EFFET : un troisième argument piège, porteur d'un rôle, ne change
    //     RIEN à la décision — la fonction ne le lit même pas. Scénario où la
    //     préférence pèse réellement (les deux espaces ouverts), pour que
    //     l'assertion soit sensible à un vrai changement de comportement, pas
    //     seulement à une signature TypeScript.
    const lectureEntraineurJoueur: ClubMembershipReading = {
      statut: "lu",
      accessRole: "coach",
      playerStatus: "active",
    };
    const sansPiege = resolveAppSpace(lectureEntraineurJoueur, "player");
    const avecPiege = (resolveAppSpace as (...args: unknown[]) => ReturnType<typeof resolveAppSpace>)(
      lectureEntraineurJoueur,
      "player",
      "coach",
    );
    expect(sansPiege).toBe("player");
    expect(avecPiege).toBe(sansPiege);
  });

  test("elle meurt avec la session : une VRAIE déconnexion l'oublie, le boot non", () => {
    // Sans l'oubli, le compte SUIVANT atterrirait sur la création de club sans
    // que personne l'ait demandé. Mais l'oubli ne doit PAS frapper le `null` de
    // démarrage : Firebase répond `null` avant d'avoir restauré la session, et
    // une intention posée au lancement précédent doit précisément survivre à ce
    // moment-là (c'est tout l'objet de sa persistance, audit 2026-09 P1-02).
    const ancre = "if (!uidCourant && compteDejaConnecteRef.current)";
    const index = navigateur.indexOf(ancre);
    expect(index).toBeGreaterThan(-1);
    const bloc = navigateur.slice(index, index + 400);
    expect(bloc).toContain("await effacerIntentionCoach()");
    // Un seul effet possède la lecture ET l'effacement : les séparer rouvrirait
    // la course « effacement en vol pendant que la relecture répond ».
    expect(bloc).toContain("lireIntentionCoach()");
  });

  test("le chemin coach → « Je m'entraîne aussi » : l'intention consommée ne re-route plus", () => {
    // Chemin réel qui exposait le bug (revue du 03/08) : un coach déclare son
    // intention sur l'accueil, s'inscrit, crée son club — l'appartenance fait
    // basculer `appSpace.space` sur "coach" (branche 6bis), ce portillon
    // d'onboarding se démonte, plus personne ne le regarde. Puis il tape
    // « Je m'entraîne aussi » (hooks/useAppSpace) : l'espace revient à
    // "player" alors que son profil joueur n'est toujours pas rempli. Ce
    // portillon se REMONTE — pour la première fois depuis la création du
    // club. Sans remise à zéro de l'intention à CE moment précis (pas
    // seulement à la déconnexion, déjà couverte par le test précédent, ni au
    // renoncement explicite « Je suis joueur finalement », couvert plus bas),
    // il relirait une intention vieille de l'inscription et reposerait ce
    // coach déjà membre d'un club sur la création de club au lieu du
    // questionnaire joueur qu'il vient précisément de demander.
    //
    // DEPUIS L'AUDIT DU 05/09, la remise à zéro n'est plus câblée sur « on
    // atteint le portillon » mais sur un FAIT du compte : il a déjà un club.
    // La différence compte, et elle est la raison du changement — l'ancienne
    // version consommait l'intention à la SECONDE où le portillon s'affichait,
    // donc AVANT même que le coach ait tapé « Créer mon club ». App tuée à cet
    // instant : l'intention était déjà brûlée, et il retombait au questionnaire
    // joueur. Le club, lui, est un fait durable et vérifiable.
    const ancreEffet = "if (clubId) {";
    const indexEffet = navigateur.indexOf(ancreEffet);
    expect(indexEffet).toBeGreaterThan(-1);
    const effet = navigateur.slice(Math.max(0, indexEffet - 400), indexEffet + 300);

    expect(effet).toContain("useEffect(() => {");
    expect(effet).toContain("oublierIntentionCoach()");
    // Et la route d'arrivée porte la même ceinture, pour la fraction de seconde
    // où l'effet n'a pas encore couru (cf. test du portillon plus haut).
    expect(navigateur).toContain("intentionCoach && !clubId");

    // Déclaré AVANT le premier retour conditionnel du composant : les hooks
    // de React s'exécutent à CHAQUE rendu, quelle que soit la branche JSX
    // retournée ensuite — donc y compris lors du rendu où l'espace vient tout
    // juste de basculer de "coach" à "player", avant même que ce portillon ne
    // soit remonté. Un `useEffect` placé APRÈS un retour conditionnel violerait
    // les règles des hooks (appel conditionnel) ; le trouver avant le premier
    // `if (...) return` est donc aussi la preuve qu'il s'exécute à chaque rendu.
    const indexPremierRetour = navigateur.indexOf("if (welcomeDone === null)");
    expect(indexPremierRetour).toBeGreaterThan(-1);
    expect(indexEffet).toBeLessThan(indexPremierRetour);

    // QUATRE fins de vie, chacune pour un chemin qu'aucune autre ne couvre :
    //  1. déconnexion (testée plus haut) — aucune session ne se termine ici ;
    //  2. le compte a un club (celle-ci) — le chemin coach → « Je m'entraîne
    //     aussi », où personne ne tape « Je suis joueur finalement » ;
    //  3. compte joueur déjà configuré — on le dit, on ne casse rien ;
    //  4. renoncement explicite (testé plus bas, création de club).
    for (const chemin of [
      "if (!uidCourant && compteDejaConnecteRef.current)",
      "if (clubId) {",
      'if (profileCompleted === true && appSpace.space !== "coach")',
      "onRetourJoueur={() => {",
    ]) {
      expect(navigateur).toContain(chemin);
    }
    // Le message du cas 3 ne promet rien qu'on ne sait pas tenir : aucun chemin
    // client ne transforme un compte joueur en compte coach (il faudrait une
    // Cloud Function et une revue sécurité).
    expect(navigateur).toContain(
      "Ton compte est un compte joueur. Pour créer un club, utilise un autre compte."
    );
  });
});

describe("création de club — jamais un cul-de-sac", () => {
  const ecran = lire("screens/CoachOnboardingScreen.tsx");

  /** Rend l'écran de création de club avec la navigation qu'on lui donne. */
  async function rendreCreationClub(options: {
    peutRevenir: boolean;
    onRetourJoueur?: () => void;
  }) {
    mockNavigation.canGoBack.mockReturnValue(options.peutRevenir);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <CoachOnboardingScreen onRetourJoueur={options.onRetourJoueur} />
        </SafeAreaProvider>
      );
    });
    montes.push(renderer);
    const sortie = (label: string) =>
      renderer.root.findAll(
        (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === "function",
        { deep: true }
      )[0];
    return { renderer, sortie };
  }

  test("point d'ARRIVÉE (rien derrière) : la sortie proposée renonce à l'espace coach", async () => {
    const onRetourJoueur = jest.fn();
    const { sortie } = await rendreCreationClub({ peutRevenir: false, onRetourJoueur });
    // « Retour » serait un bouton qui ment : il n'y a rien derrière.
    expect(sortie("Retour")).toBeUndefined();
    const renoncer = sortie("Je suis joueur finalement");
    expect(renoncer).toBeDefined();
    await act(async () => {
      await presser(renoncer);
    });
    expect(onRetourJoueur).toHaveBeenCalledTimes(1);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  test("ouvert depuis le profil (il y a un arrière) : « Retour » revient, comme avant", async () => {
    const onRetourJoueur = jest.fn();
    const { sortie } = await rendreCreationClub({ peutRevenir: true, onRetourJoueur });
    expect(sortie("Je suis joueur finalement")).toBeUndefined();
    const retour = sortie("Retour");
    expect(retour).toBeDefined();
    await act(async () => {
      await presser(retour);
    });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(onRetourJoueur).not.toHaveBeenCalled();
  });

  test("le navigateur fournit la sortie quand cet écran est le point d'arrivée", () => {
    const gate = navigateur.slice(navigateur.indexOf('key="nav-gate"'));
    expect(gate).toContain("onRetourJoueur={() => {");
    // La sortie OUBLIE l'intention — mémoire ET disque, sinon le prochain
    // démarrage reposerait la personne sur la création de club qu'elle vient de
    // refuser — et repose le questionnaire joueur comme unique écran de la pile.
    expect(gate).toContain("oublierIntentionCoach()");
    expect(gate).toContain('routes: [{ name: "ProfileSetupGate" }]');
  });

  test("l'écran choisit le geste VRAI : revenir s'il y a un arrière, renoncer sinon", () => {
    expect(ecran).toContain("navigation.canGoBack?.()");
    expect(ecran).toContain("Je suis joueur finalement");
    expect(ecran).toContain('label: "Retour"');
  });

  test("le chemin de secours historique reste ouvert dans le setup joueur", () => {
    // Un coach qui a déjà passé l'écran d'accueil (relance de l'app, compte créé
    // en joueur) doit encore trouver sa porte.
    expect(lire("screens/ProfileSetupScreen.tsx")).toContain(
      "Tu fais partie du staff ? Crée ton club coach"
    );
  });
});
