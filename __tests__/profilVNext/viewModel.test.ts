// __tests__/profilVNext/viewModel.test.ts
// =============================================================================
// Le contrat du Profil vNext, verrouille au moment ou on code.
// La liste des champs autorises est ECRITE A LA MAIN, jamais derivee de la
// sortie : un instantane genere validerait n'importe quel ajout futur, soit
// exactement l'inverse du but (patron du Home, README du harnais).
// =============================================================================

import {
  buildProfilVNextViewModel,
  PROFIL_VARIANTES,
  PROFIL_VARIANTE_PAR_DEFAUT,
  PROFIL_VNEXT_SEUILS,
  type ProfilVNextInput,
} from "../../screens/profilVNext/viewModel";
import { PROFIL_VNEXT_FIXTURES } from "../../screens/profilVNext/fixtures";

const fixture = (id: string): ProfilVNextInput => {
  const f = PROFIL_VNEXT_FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`fixture inconnue : ${id}`);
  return f.input;
};

// -----------------------------------------------------------------------------
// 1. Les champs autorises — la liste ecrite a la main
// -----------------------------------------------------------------------------
// Le Profil refondu ne raconte pas : tout champ qui n'est pas dans ces listes
// fait echouer le test EN SE NOMMANT. C'est la barriere contre le retour des
// stats (forme, trophees, streaks, compteur hebdo, phase).
// -----------------------------------------------------------------------------

const CHAMPS_VM = ["variante", "identite", "rythme", "controles", "protoWarnings"].sort();
const CHAMPS_IDENTITE_PRETE = ["kind", "prenom", "poste", "niveau", "pied", "objectif"].sort();
const CHAMPS_RYTHME = ["fksParSemaine", "clubParSemaine", "matchsParSemaine"].sort();
const CHAMPS_LIGNE = ["id", "label", "fait", "cible"].sort();
const CHAMPS_FAIT = ["texte", "source"].sort();

describe("contrat : aucun champ au-dela de la liste ecrite a la main", () => {
  for (const f of PROFIL_VNEXT_FIXTURES) {
    for (const v of PROFIL_VARIANTES) {
      it(`${f.id} / ${v.id}`, () => {
        const vm = buildProfilVNextViewModel(f.input, { variante: v.id });
        expect(Object.keys(vm).sort()).toEqual(CHAMPS_VM);
        if (vm.identite.kind === "prete") {
          expect(Object.keys(vm.identite).sort()).toEqual(CHAMPS_IDENTITE_PRETE);
        } else {
          expect(Object.keys(vm.identite).sort()).toEqual(["kind"]);
        }
        expect(Object.keys(vm.rythme).sort()).toEqual(CHAMPS_RYTHME);
        for (const ligne of vm.controles) {
          expect(Object.keys(ligne).sort()).toEqual(CHAMPS_LIGNE);
          if (ligne.fait != null) {
            expect(Object.keys(ligne.fait).sort()).toEqual(CHAMPS_FAIT);
          }
        }
      });
    }
  }

  it("les concepts interdits par l'audit n'existent dans AUCUN texte produit par l'ecran", () => {
    // P0-1/P0-2 (etat de forme calcule), P0-3/P0-4 (regularite, trophees),
    // P1-7 (compteur hebdo), P1-8 (jeton Playlist). Si l'un revient, il se
    // nomme. L'OBJECTIF DECLARE est exempt : « Être en forme toute la saison »
    // est une declaration du joueur, pas un etat calcule — seuls les textes
    // que l'ecran FABRIQUE (labels, faits) sont soumis a la regle.
    const interdits = [/forme/i, /série/i, /serie/i, /trophée/i, /playlist/i, /tsb/i, /régularité/i];
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const vm = buildProfilVNextViewModel(f.input, { variante: "informe" });
      const textesFabriques: string[] = [];
      for (const l of vm.controles) {
        textesFabriques.push(l.label, l.fait?.texte ?? "");
      }
      const tout = textesFabriques.join(" | ");
      for (const motif of interdits) {
        expect(tout).not.toMatch(motif);
      }
    }
  });

  it("le Profil n'a aucun seuil d'affichage — et le declare", () => {
    expect(PROFIL_VNEXT_SEUILS).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 2. L'identite ne se fabrique pas
// -----------------------------------------------------------------------------

describe("identite", () => {
  it("en chargement, l'ecran n'a RIEN a afficher (pas de « Joueur » fabrique)", () => {
    const vm = buildProfilVNextViewModel(fixture("chargement"));
    expect(vm.identite).toEqual({ kind: "chargement" });
  });

  it("les valeurs persistees sans accents deviennent des libelles accentues", () => {
    const vm = buildProfilVNextViewModel(fixture("compte-neuf"));
    if (vm.identite.kind !== "prete") throw new Error("identite attendue prete");
    expect(vm.identite.poste).toBe("Défenseur"); // persiste : "Defenseur"
    expect(vm.identite.objectif).toBe("Être en forme toute la saison"); // persiste : "Etre..."
  });

  it("une valeur persistee inconnue est affichee telle quelle ET signalee", () => {
    const input = fixture("joueur-complet");
    const vm = buildProfilVNextViewModel({
      ...input,
      profil: { ...input.profil, position: "Libero" },
    });
    if (vm.identite.kind !== "prete") throw new Error("identite attendue prete");
    expect(vm.identite.poste).toBe("Libero");
    expect(vm.protoWarnings.some((w) => w.includes("Libero"))).toBe(true);
  });

  it("un champ absent reste null — jamais un placeholder", () => {
    const vm = buildProfilVNextViewModel(fixture("profil-partiel"));
    if (vm.identite.kind !== "prete") throw new Error("identite attendue prete");
    expect(vm.identite.pied).toBeNull();
    expect(vm.identite.objectif).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3. Le rythme ne s'invente pas
// -----------------------------------------------------------------------------

describe("rythme", () => {
  it("null reste null (pas de « ?? 2 », le defaut P1-7 de l'audit)", () => {
    const vm = buildProfilVNextViewModel(fixture("profil-partiel"));
    expect(vm.rythme.fksParSemaine).toBeNull();
    expect(vm.rythme.matchsParSemaine).toBeNull();
    expect(vm.rythme.clubParSemaine).toBe(3);
  });

  it("zero est une declaration, pas une absence", () => {
    const input = fixture("joueur-complet");
    const vm = buildProfilVNextViewModel({
      ...input,
      profil: { ...input.profil, matchesPerWeek: 0 },
    });
    expect(vm.rythme.matchsParSemaine).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// 4. Les lignes de controle
// -----------------------------------------------------------------------------

describe("controles", () => {
  it("les trois usages reels ouvrent la liste, dans cet ordre", () => {
    const vm = buildProfilVNextViewModel(fixture("joueur-complet"));
    expect(vm.controles.slice(0, 3).map((l) => l.id)).toEqual([
      "modifier_profil",
      "reglages",
      "historique",
    ]);
  });

  it("variante pure : AUCUN fait sur aucune ligne", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const vm = buildProfilVNextViewModel(f.input, { variante: "pur" });
      expect(vm.controles.every((l) => l.fait === null)).toBe(true);
    }
  });

  it("le fait cycle suit l'arithmetique du Home : index 3 -> « Séance 4 sur 12 »", () => {
    const vm = buildProfilVNextViewModel(fixture("joueur-complet"), { variante: "informe" });
    const cycle = vm.controles.find((l) => l.id === "cycle");
    expect(cycle?.fait?.texte).toBe("Duels & puissance · Séance 4 sur 12");
    expect(cycle?.fait?.source).toBe("store_cycle");
  });

  it("sans cycle actif : label « Choisir mon cycle », aucun fait — pas de « 0/12 »", () => {
    const vm = buildProfilVNextViewModel(fixture("sans-cycle"), { variante: "informe" });
    const cycle = vm.controles.find((l) => l.id === "cycle");
    expect(cycle?.label).toBe("Choisir mon cycle");
    expect(cycle?.fait).toBeNull();
  });

  it("aucun test -> aucun fait sur la ligne tests (l'absence est un etat)", () => {
    const vm = buildProfilVNextViewModel(fixture("compte-neuf"), { variante: "informe" });
    const tests = vm.controles.find((l) => l.id === "tests");
    expect(tests?.fait).toBeNull();
  });

  it("le fait tests date en jour LOCAL via la chaine canonique", () => {
    const vm = buildProfilVNextViewModel(fixture("joueur-complet"), { variante: "informe" });
    const tests = vm.controles.find((l) => l.id === "tests");
    expect(tests?.fait?.texte).toMatch(/^Dernier relevé : /);
    expect(tests?.fait?.source).toBe("tests_canonique");
  });

  it("sans club : « Rejoindre un club », sans fait ; avec club : nom + badge", () => {
    const sans = buildProfilVNextViewModel(fixture("compte-neuf"), { variante: "informe" });
    expect(sans.controles.find((l) => l.id === "club")?.label).toBe("Rejoindre un club");
    expect(sans.controles.find((l) => l.id === "club")?.fait).toBeNull();

    const avec = buildProfilVNextViewModel(fixture("proprietaire-club"), { variante: "informe" });
    expect(avec.controles.find((l) => l.id === "club")?.fait?.texte).toBe(
      "FC Rouen Sapins · Propriétaire-joueur"
    );
  });

  it("clubId present mais nom irresolu : pas de fait, un protoWarning", () => {
    const input = fixture("joueur-complet");
    const vm = buildProfilVNextViewModel(
      { ...input, club: { clubId: "c1", nom: null, badge: null } },
      { variante: "informe" }
    );
    expect(vm.controles.find((l) => l.id === "club")?.fait).toBeNull();
    expect(vm.protoWarnings.some((w) => w.startsWith("club:"))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 5. Le selecteur est pur et deterministe
// -----------------------------------------------------------------------------

describe("purete", () => {
  it("deux appels identiques rendent la meme valeur (aucune horloge implicite)", () => {
    const a = buildProfilVNextViewModel(fixture("joueur-complet"));
    const b = buildProfilVNextViewModel(fixture("joueur-complet"));
    expect(a).toEqual(b);
  });

  it("la variante par defaut est celle declaree", () => {
    const vm = buildProfilVNextViewModel(fixture("joueur-complet"));
    expect(vm.variante).toBe(PROFIL_VARIANTE_PAR_DEFAUT);
  });
});
