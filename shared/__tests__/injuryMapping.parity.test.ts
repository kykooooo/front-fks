// shared/__tests__/injuryMapping.parity.test.ts
//
// Parité BYTE-IDENTIQUE exigée entre :
//   - Frontend : shared/injuryMapping.ts (ce repo)
//   - Backend  : C:/Users/Gamer/fks/src/shared/injuryMapping.ts
// (cf. en-tête du fichier partagé + /sync-check point #6 côté backend).
//
// Si le repo backend n'est pas présent sur la machine (CI front isolée),
// le test de diff est SKIPPÉ avec un warning — la parité reste alors
// couverte par /sync-check avant tout déploiement. Sur le poste de dev
// (les deux repos côte à côte), toute divergence fait échouer la suite.

import * as fs from "fs";
import * as path from "path";
import {
  INJURY_AREA_TO_BACKEND_PAIN,
  mapAreaToPain,
  type InjuryAreaFR,
} from "../injuryMapping";
import {
  BODY_AREAS,
  ZONES_PARTAGEES,
  mapBodyAreaToPain,
} from "../../domain/monCorps/zones";

const FRONT_FILE = path.resolve(__dirname, "..", "injuryMapping.ts");

const BACKEND_CANDIDATES: string[] = [
  process.env.FKS_BACKEND_DIR
    ? path.join(process.env.FKS_BACKEND_DIR, "src", "shared", "injuryMapping.ts")
    : "",
  // Les deux repos vivent côte à côte : <root>/front-fks et <root>/fks
  path.resolve(__dirname, "..", "..", "..", "fks", "src", "shared", "injuryMapping.ts"),
].filter(Boolean);

const backendFile = BACKEND_CANDIDATES.find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

describe("shared/injuryMapping.ts — parité front ↔ back", () => {
  if (!backendFile) {
    // eslint-disable-next-line no-console
    console.warn(
      "[injuryMapping.parity] Repo backend introuvable (candidats: " +
        BACKEND_CANDIDATES.join(", ") +
        ") — diff byte-identique skippé. La parité doit être vérifiée par /sync-check."
    );
  }

  (backendFile ? it : it.skip)("le fichier front est byte-identique au fichier backend", () => {
    // Normalisation CRLF→LF avant comparaison : sur Windows, autocrlf=true
    // matérialise les checkouts en CRLF selon le MOMENT où chaque fichier a été
    // extrait — les blobs git, eux, sont LF des deux côtés (c'est la parité qui
    // compte). Sans ça, le test échoue ou passe selon l'historique du checkout.
    const normalize = (buf: Buffer) => buf.toString("utf8").replace(/\r\n/g, "\n");
    const front = normalize(fs.readFileSync(FRONT_FILE));
    const back = normalize(fs.readFileSync(backendFile as string));
    if (front !== back) {
      const frontLines = front.split("\n");
      const backLines = back.split("\n");
      let firstDiff = 0;
      while (
        firstDiff < Math.max(frontLines.length, backLines.length) &&
        frontLines[firstDiff] === backLines[firstDiff]
      ) {
        firstDiff++;
      }
      throw new Error(
        `injuryMapping.ts a divergé du backend (première différence ligne ${firstDiff + 1}).\n` +
          `  front: ${JSON.stringify(frontLines[firstDiff] ?? "<EOF>")}\n` +
          `  back : ${JSON.stringify(backLines[firstDiff] ?? "<EOF>")}\n` +
          `Resynchroniser les deux copies (byte à byte) — voir l'en-tête du fichier.`
      );
    }
  });

  it("chaque zone du référentiel PARTAGÉ (hors 'autre') a un token backend", () => {
    for (const area of ZONES_PARTAGEES) {
      if (area === "autre") {
        expect(mapAreaToPain(area)).toBeNull();
      } else {
        expect(mapAreaToPain(area)).toEqual(expect.any(String));
      }
    }
  });

  // ------------------------------------------------------------------------
  // « aine » : la zone AJOUTÉE CÔTÉ FRONT SEULEMENT, et pourquoi c'est légitime.
  //
  // Décision D11 : la pubalgie / gêne aux adducteurs est la blessure n°1 du
  // footballeur amateur, et le backend sait DÉJÀ la traiter — `groin_pain` est
  // dans `BackendPainToken` ci-dessous, dans `Contraindication` côté moteur, et
  // des exercices sont annotés avec. Ce qui manquait, c'était la zone française
  // que le joueur peut cocher.
  //
  // Le lot 1 est front-only : écrire `aine` DANS ce fichier partagé le ferait
  // diverger de sa copie backend et casserait la parité byte-à-byte vérifiée
  // ci-dessus. L'extension vit donc dans `domain/monCorps/zones.ts`, du côté qui
  // préserve la parité. Le contrat réseau, lui, est inchangé : le backend reçoit
  // `groin_pain`, un jeton qu'il connaît.
  //
  // Ces deux tests figent l'écart, pour qu'il reste un choix documenté et pas
  // une dérive : `aine` N'EST PAS dans le fichier partagé, elle EST mappée
  // côté front.
  // ------------------------------------------------------------------------
  it("« aine » n'est PAS dans le fichier partagé (front-only tant qu'aucune PR backend jumelle)", () => {
    expect(mapAreaToPain("aine")).toBeNull();
    expect(ZONES_PARTAGEES).not.toContain("aine");
  });

  it("« aine » est bien déclarable côté joueur et produit groin_pain", () => {
    expect(BODY_AREAS).toContain("aine");
    expect(mapBodyAreaToPain("aine")).toBe("groin_pain");
    expect(mapBodyAreaToPain(" Aine ")).toBe("groin_pain");
  });

  it("le référentiel joueur = le référentiel partagé + « aine », rien d'autre", () => {
    expect([...BODY_AREAS].sort()).toEqual([...ZONES_PARTAGEES, "aine"].sort());
  });

  it("hors « aine », le mapping joueur est celui du fichier partagé", () => {
    for (const zone of ZONES_PARTAGEES) {
      expect(mapBodyAreaToPain(zone)).toBe(mapAreaToPain(zone));
    }
  });

  it("le mapping couvre les 9 zones filtrables avec les tokens attendus", () => {
    expect(INJURY_AREA_TO_BACKEND_PAIN).toEqual({
      cheville: "ankle_pain",
      genou: "knee_pain",
      ischio: "hamstring_acute",
      quadriceps: "quad_pain",
      mollet: "calf_pain",
      hanche: "hip_pain",
      dos: "back_pain",
      "épaule": "shoulder_pain",
      poignet: "wrist_pain",
    } satisfies Partial<Record<InjuryAreaFR, string>>);
  });

  it("mapAreaToPain est tolérant (casse, espaces) et refuse l'inconnu", () => {
    expect(mapAreaToPain(" Cheville ")).toBe("ankle_pain");
    expect(mapAreaToPain("GENOU")).toBe("knee_pain");
    expect(mapAreaToPain("autre")).toBeNull();
    expect(mapAreaToPain("zone_inconnue")).toBeNull();
    expect(mapAreaToPain(null)).toBeNull();
    expect(mapAreaToPain(undefined)).toBeNull();
  });
});
