// screens/newSession/__tests__/materielSansChoix.test.tsx
//
// RIEN DE COCHÉ = RIEN DE DÉCLARÉ.
//
// `useEnvironmentEquipment` (hooks.ts) remplissait la sélection vide avec le
// PREMIER élément autorisé du catalogue : « barbell » en salle, « indoor_small »
// à la maison, « field » sur terrain. Conséquences réelles (22/09/2026) :
//   - salle sans coche : la liste n'étant plus vide, `handleGenerate` n'envoyait
//     plus « équipement standard » — le joueur recevait une séance « barre seule »
//     pendant que l'écran promettait « Équipement standard inclus » ;
//   - maison sans coche : « indoor_small » (jamais affiché à l'écran) est élargi
//     par le moteur en élastiques + haltères — pendant que l'écran promettait
//     « au poids du corps » (règle 2 : le filtre matériel est prioritaire).
// Seule exception conservée : le terrain lui-même sur « Terrain » (« field »),
// sans lequel le moteur retire tous les sprints, courses et jeux réduits.
//
// Le catalogue est lu dans la SOURCE de NewSessionScreen : c'est son ORDRE réel
// qui décidait de ce qui était déclaré à la place du joueur.

import fs from "fs";
import path from "path";
import React, { useEffect, useState } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useEnvironmentEquipment } from "../hooks";

type Args = Parameters<typeof useEnvironmentEquipment>;
type Environnement = Args[0];
type Catalogue = Args[2];
type Options = Args[4];

function lireCatalogueReel(): Catalogue {
  const source = fs
    .readFileSync(path.resolve(__dirname, "..", "..", "NewSessionScreen.tsx"), "utf8")
    .replace(/\r\n/g, "\n");
  const debut = source.indexOf("export const EQUIPMENT_CATALOG = [");
  const fin = source.indexOf("];", debut);
  const bloc = source.slice(debut, fin);
  return [...bloc.matchAll(/\{ id: "([^"]+)", label: "[^"]*", source: "([^"]+)" \}/g)].map((m) => ({
    id: m[1],
    source: m[2],
  }));
}

const CATALOGUE = lireCatalogueReel();

function Sonde(props: {
  environment: Environnement;
  disponible: string[];
  initial: string[];
  options?: Options;
  onSelection: (selection: string[]) => void;
}) {
  const [selection, setSelection] = useState<string[]>(props.initial);
  useEnvironmentEquipment(props.environment, props.disponible, CATALOGUE, setSelection, props.options);
  const { onSelection } = props;
  useEffect(() => {
    onSelection(selection);
  }, [selection, onSelection]);
  return null;
}

function selectionApres(params: { environment: Environnement; disponible?: string[]; initial?: string[]; options?: Options }): string[] {
  let derniere: string[] = [];
  const noter = (selection: string[]) => {
    derniere = selection;
  };
  act(() => {
    TestRenderer.create(
      <Sonde
        environment={params.environment}
        disponible={params.disponible ?? []}
        initial={params.initial ?? []}
        options={params.options}
        onSelection={noter}
      />
    );
  });
  return derniere;
}

describe("le catalogue lu est bien le vrai", () => {
  test("ordre réel : la salle commence par la barre, le terrain par le terrain, la maison par le petit espace", () => {
    expect(CATALOGUE.length).toBeGreaterThan(20);
    expect(CATALOGUE.find((c) => c.source === "gym")?.id).toBe("barbell");
    expect(CATALOGUE.find((c) => c.source === "pitch")?.id).toBe("field");
    expect(CATALOGUE.find((c) => c.source === "home")?.id).toBe("indoor_small");
  });
});

describe("rien de coché = rien de déclaré", () => {
  test("salle, rien de déclaré ni coché → sélection VIDE (handleGenerate enverra l'équipement standard)", () => {
    expect(selectionApres({ environment: ["gym"] })).toEqual([]);
  });

  test("maison, rien de déclaré ni coché → sélection VIDE (poids du corps), jamais « indoor_small »", () => {
    expect(selectionApres({ environment: ["home"] })).toEqual([]);
  });

  test("terrain, rien de coché → le terrain lui-même, et rien d'autre", () => {
    expect(selectionApres({ environment: ["pitch"] })).toEqual(["field"]);
  });

  test("terrain + maison, rien de coché → le terrain seul (le matériel maison se coche)", () => {
    expect(selectionApres({ environment: ["pitch", "home"] })).toEqual(["field"]);
  });
});

describe("ce qui ne change pas", () => {
  test("un choix du joueur compatible avec le lieu est conservé", () => {
    expect(selectionApres({ environment: ["home"], initial: ["minibands"] })).toEqual(["minibands"]);
  });

  test("un choix incompatible avec le nouveau lieu est retiré, sans rien inventer à la place", () => {
    expect(selectionApres({ environment: ["home"], initial: ["barbell"] })).toEqual([]);
  });

  test("salle avec « machines » coché → équipement standard + poids du corps", () => {
    expect(selectionApres({ environment: ["gym"], options: { gymMachinesEnabled: true } })).toEqual(["gym_full", "bodyweight"]);
  });

  test("terrain avec « petit matériel » coché → terrain + cônes/plots/échelle/haies/élastiques + poids du corps", () => {
    const sel = selectionApres({ environment: ["pitch"], options: { pitchSmallGearEnabled: true } });
    expect(sel).toEqual(expect.arrayContaining(["field", "cones", "flat_markers", "speed_ladder", "mini_hurdles", "minibands", "long_bands", "bodyweight"]));
  });

  test("matériel déclaré au profil et compatible → conservé tel quel", () => {
    expect(selectionApres({ environment: ["home"], disponible: ["minibands", "sandbag"], initial: ["minibands", "sandbag"] })).toEqual(["minibands", "sandbag"]);
  });
});
