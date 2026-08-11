#!/usr/bin/env node
/**
 * Générateur du contenu éditorial des fiches exercice (pont catalogue V2 → front).
 *
 * Lit les fiches du catalogue V2 (source de vérité éditoriale, LECTURE SEULE) et
 * produit `engine/generated/exerciseContentV2.ts` : nom français, description,
 * mise en place, étapes numérotées, bons gestes, « À éviter », matériel, sécurité.
 *
 * Usage :
 *   node scripts/generateExerciseContent.js [--catalog <dir>] [--check]
 *
 *   --catalog <dir>  Dossier `src/catalog` du repo catalogue (défaut : worktree
 *                    readiness3 ; surchargable aussi via env FKS_CATALOG_DIR).
 *   --check          Ne rien écrire ; échoue si le fichier généré n'est pas à jour.
 *
 * Garanties :
 *   - DÉTERMINISTE et IDEMPOTENT : mêmes données source → fichier identique
 *     (tri stable, aucun timestamp de génération ; l'en-tête porte un hash du
 *     contenu source et la date la plus récente PRÉSENTE dans les données).
 *   - Doctrine « zéro ballon » : toute fiche V2 dont le matériel ou les textes
 *     évoquent un ballon (football/medball/swiss/fitball) est EXCLUE et listée.
 *   - Collisions d'alias : si plusieurs ids front pointent vers la même fiche V2
 *     (ex. accélérations 5/10/15/20 m → « Accélération »), le nom front actuel
 *     est conservé (pas de doublons de noms en bibliothèque) : le générateur
 *     n'émet pas de `name` pour ces entrées, l'overlay garde alors l'existant.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "engine", "generated", "exerciseContentV2.ts");
const DEFAULT_CATALOG = "C:/Users/Gamer/fks-worktrees/readiness3/src/catalog";

const FAMILIES = [
  "force",
  "speed-acceleration",
  "cod",
  "plyo",
  "core-mobility",
  "conditioning-rsa",
  "situations",
  "protocols-tests",
];

// Matériel « ballon » : doctrine zéro ballon, ces fiches ne sont pas servies.
const BALL_EQUIPMENT = new Set(["football", "medball", "swiss_ball", "home_swiss_ball", "fitball"]);
const BALL_WORDS = /(swiss|fitball|medball|médecine-ball|ballon)/i;
// « sans ballon » est une NÉGATION (ex. « Speed dribbles — sans ballon ») : tolérée.
const stripBallNegations = (t) => t.replace(/sans ballon/gi, "");

// Nettoyage doctrine (zéro ballon) : options « ballon » retirées d'un texte V2 par
// remplacement EXPLICITE et déclaré — jamais de réécriture silencieuse. Chaque
// application est listée dans le résumé du script (et au rapport de chantier).
const DOCTRINE_TEXT_FIXES = {
  core_deadbug_loaded: [["haltère léger ou medball", "haltère léger"]],
};

// Notes éditoriales INTERNES du catalogue V2 : jamais montrées au joueur.
// - une puce entière qui est une note de curation est supprimée ;
// - une fiche qui porte encore un marqueur de chantier (_A_VALIDER) est exclue
//   (le repli legacy s'applique) ;
// - une description jargon (« canonique paramétrable », « presets legacy ») n'est
//   pas émise : la description front actuelle est conservée.
const INTERNAL_NOTE_DROP = /(=\s*paramètre|\(une seule fiche\))/i;
const INTERNAL_MARKER_EXCLUDE = /_A_VALIDER/;
const INTERNAL_DESCRIPTION_OMIT = /(canonique paramétrable|presets? legacy)/i;
// Réparations d'accents : mots qui n'existent pas en français sans leur accent,
// trouvés désaccentués dans une fiche V2 source (signalés au chantier catalogue).
// Réparation mécanique mot entier, sans changement de sens.
const ACCENT_REPAIRS = [
  [/\brecuperation\b/g, "récupération"],
  [/\bRecuperation\b/g, "Récupération"],
  [/\breaction\b/g, "réaction"],
  [/\bReaction\b/g, "Réaction"],
];

// Notes de provenance « legacy » : les chiffres restent, le jargon disparaît.
// ⚠ L'ORDRE compte : les règles qui préservent un chiffre passent avant la
// suppression générique des parenthèses contenant « legacy ».
const GLOBAL_TEXT_FIXES = [
  [" Le legacy autorisait aussi une version buste penché — non retenue comme fiche séparée.", ""],
  [", donnée legacy)", ")"],
  [/\((\d[^()]*?) en legacy\)/gi, "($1)"],
  [/\(repère legacy ([^)]+)\)/gi, "(repère : $1)"],
  ["Volume legacy :", "Volume :"],
  ["Structure legacy :", "Structure :"],
  [/\s*\([^()]*legacy[^()]*\)/gi, ""],
  [/\s*\(paramètre[^)]*\)/gi, ""],
];

// Matériel V2 → clés front (EquipmentKey de screens/videoLibrary/videoLibraryConfig.ts).
// Les lieux purs (home/gym/small_space) vivent dans `environments` côté V2 ; quand la
// V2 met un lieu dans equipment (field/track), on le montre comme « Terrain dégagé ».
const EQUIPMENT_MAP = {
  bodyweight: "bodyweight",
  home_dumbbells: "dumbbell",
  home_dumbbells_light: "dumbbell",
  dumbbells_light: "dumbbell",
  dumbbells_medium: "dumbbell",
  barbell: "barbell",
  trap_bar: "barbell",
  kettlebell: "kettlebell",
  home_kettlebell: "kettlebell",
  long_bands: "band",
  minibands: "band",
  cable_machine: "machine",
  hack_squat_machine: "machine",
  hamstring_curl_machine: "machine",
  hip_abductor_machine: "machine",
  hip_adductor_machine: "machine",
  lat_pulldown_machine: "machine",
  leg_extension_machine: "machine",
  leg_press: "machine",
  machine_chest_press: "machine",
  back_extension: "machine",
  belt_squat: "machine",
  trx: "trx",
  suspension_trainer: "trx",
  rings: "trx",
  box_plyo: "box",
  bench: "bench",
  nordic_bench: "bench",
  bike: "bike",
  rower: "rower",
  treadmill: "treadmill",
  field: "field",
  track: "field",
  street_area: "field",
  cones: "cones",
  flat_markers: "cones",
  wall: "wall",
  pullup_bar: "pullup_bar",
  sled: "sled",
  squat_rack: "rack",
  backpack: "backpack",
  partner: "partner",
  stopwatch: "stopwatch",
  smartphone: "smartphone",
  table: "table",
  water_bottles: "bottles",
  jump_rope: "rope",
  ab_wheel: "abwheel",
};

const args = process.argv.slice(2);
const checkMode = args.includes("--check");
const catalogArgIdx = args.indexOf("--catalog");
const catalogDir =
  (catalogArgIdx >= 0 && args[catalogArgIdx + 1]) ||
  process.env.FKS_CATALOG_DIR ||
  DEFAULT_CATALOG;
const dataDir = path.join(catalogDir, "data");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ─── 1. Charger le catalogue V2 (lecture seule) ───
const sourceBuffers = [];
const v2ById = new Map();
let latestReviewedAt = "";
for (const family of FAMILIES) {
  const p = path.join(dataDir, `${family}.json`);
  sourceBuffers.push(fs.readFileSync(p));
  const parsed = readJson(p);
  for (const entry of parsed.exercises || []) {
    v2ById.set(entry.id, entry);
    const reviewed = entry.review && entry.review.sportReviewedAt;
    if (reviewed && reviewed > latestReviewedAt) latestReviewedAt = reviewed;
  }
}
const aliasesPath = path.join(dataDir, "aliases.json");
sourceBuffers.push(fs.readFileSync(aliasesPath));
const aliasesRaw = readJson(aliasesPath).aliases || {};
const aliasMap = new Map(
  Array.isArray(aliasesRaw)
    ? aliasesRaw.map((a) => [a.alias, typeof a === "string" ? a : a.target])
    : Object.entries(aliasesRaw).map(([k, v]) => [k, typeof v === "string" ? v : v.target])
);
const sourceHash = crypto.createHash("sha256").update(Buffer.concat(sourceBuffers)).digest("hex").slice(0, 12);

// ─── 2. La liste des ids servis par le front (mêmes sources que EXERCISE_BANK) ───
const bankSource = fs.readFileSync(path.join(ROOT, "engine", "exerciseBank.ts"), "utf8");
const backendSource = fs.readFileSync(path.join(ROOT, "engine", "backendExerciseIds.ts"), "utf8");
const frontIds = new Set();
for (const m of bankSource.matchAll(/\{ id: '([^']+)'/g)) frontIds.add(m[1]);
for (const m of backendSource.matchAll(/"([a-z0-9_A-Z]+)"/g)) frontIds.add(m[1]);
if (frontIds.size < 300) {
  throw new Error(`Extraction des ids front suspecte : ${frontIds.size} ids (< 300)`);
}

// ─── 3. Résolution id front → fiche V2 ───
const resolve = (frontId) => {
  if (v2ById.has(frontId)) return v2ById.get(frontId);
  const target = aliasMap.get(frontId);
  if (target && v2ById.has(target)) return v2ById.get(target);
  return null;
};

const sortedFrontIds = [...frontIds].sort();
const bySource = new Map(); // sourceId -> [frontIds]
for (const id of sortedFrontIds) {
  const fiche = resolve(id);
  if (!fiche) continue;
  if (!bySource.has(fiche.id)) bySource.set(fiche.id, []);
  bySource.get(fiche.id).push(id);
}

// ─── 4. Construire les entrées ───
const clean = (s) => (typeof s === "string" ? s.trim() : "");
const entries = [];
const skippedBall = [];
const orphans = [];
const unknownEquipment = new Map();
const missingAvoid = [];
const doctrineFixesApplied = [];
const internalNotesDropped = [];
const skippedInternalMarkers = [];
const descriptionsOmitted = [];
const collisionGroups = [];
for (const [sourceId, ids] of bySource) if (ids.length > 1) collisionGroups.push(`${sourceId} ← ${ids.join(", ")}`);

for (const frontId of sortedFrontIds) {
  const fiche = resolve(frontId);
  if (!fiche) {
    orphans.push(frontId);
    continue;
  }
  const fixes = DOCTRINE_TEXT_FIXES[fiche.id] || [];
  const sanitize = (s) => {
    let out = clean(s);
    for (const [find, replace] of fixes) {
      if (out.includes(find)) {
        out = out.split(find).join(replace);
        doctrineFixesApplied.push(`${frontId}: « ${find} » → « ${replace} »`);
      }
    }
    for (const [find, replace] of GLOBAL_TEXT_FIXES) {
      out = typeof find === "string" ? out.split(find).join(replace) : out.replace(find, replace);
    }
    for (const [find, replace] of ACCENT_REPAIRS) out = out.replace(find, replace);
    return out.trim();
  };
  const dropInternal = (list, kind) =>
    list.filter((t) => {
      if (INTERNAL_NOTE_DROP.test(t)) {
        internalNotesDropped.push(`${frontId} (${kind}): « ${t} »`);
        return false;
      }
      return true;
    });
  const execution = fiche.execution || {};
  const steps = dropInternal((execution.steps || []).map(sanitize).filter(Boolean), "step");
  const cues = dropInternal((execution.cues || []).map(sanitize).filter(Boolean), "cue");
  const avoid = dropInternal((execution.commonMistakes || []).map(sanitize).filter(Boolean), "avoid");
  const setupParts = ((fiche.setup && fiche.setup.instructions) || []).map(sanitize).filter(Boolean);
  const name = sanitize(fiche.name);
  const rawDescription = sanitize(fiche.description);
  const omitDescription = INTERNAL_DESCRIPTION_OMIT.test(rawDescription);
  if (omitDescription) descriptionsOmitted.push(`${frontId} (fiche V2 ${fiche.id})`);
  const description = omitDescription ? undefined : rawDescription;

  const equipmentV2 = fiche.equipment || [];
  const texts = [name, rawDescription, ...setupParts, ...steps, ...cues, ...avoid];
  if (equipmentV2.some((e) => BALL_EQUIPMENT.has(e)) || texts.some((t) => BALL_WORDS.test(stripBallNegations(t)))) {
    skippedBall.push(`${frontId} (fiche V2 ${fiche.id})`);
    continue;
  }
  if (texts.some((t) => INTERNAL_MARKER_EXCLUDE.test(t))) {
    skippedInternalMarkers.push(`${frontId} (fiche V2 ${fiche.id})`);
    continue;
  }
  if (steps.length === 0) {
    // Sans étapes, la fiche n'apporte rien de plus que le repli legacy.
    continue;
  }
  if (avoid.length === 0) missingAvoid.push(frontId);

  const equipment = [];
  for (const eq of equipmentV2) {
    const mapped = EQUIPMENT_MAP[eq];
    if (!mapped) {
      unknownEquipment.set(eq, (unknownEquipment.get(eq) || 0) + 1);
      continue;
    }
    if (!equipment.includes(mapped)) equipment.push(mapped);
  }

  const isCollision = (bySource.get(fiche.id) || []).length > 1;
  entries.push({
    frontId,
    // En collision d'alias, pas de nom généré : l'overlay conserve le nom front
    // actuel (« Accélération 10m » ≠ « Accélération 20m »).
    name: isCollision ? undefined : name,
    description,
    setup: setupParts.length ? setupParts.join(" ") : undefined,
    steps,
    cues,
    avoid,
    equipment,
    safetyExclude: ((fiche.safety && fiche.safety.excludeWhenReported) || []).map(clean).filter(Boolean),
    sourceId: fiche.id,
  });
}

// ─── 5. Émettre le fichier TS (déterministe) ───
const str = (s) => JSON.stringify(s);
const strArr = (arr) => `[${arr.map(str).join(", ")}]`;
const lines = [];
lines.push("// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.");
lines.push("// Source : catalogue V2 (readiness3 src/catalog, lecture seule).");
lines.push(`// Hash du contenu source : ${sourceHash} — données revues jusqu'au ${latestReviewedAt.slice(0, 10)}.`);
lines.push("// Régénérer : node scripts/generateExerciseContent.js  (idempotent)");
lines.push("");
lines.push("export type GeneratedExerciseContent = {");
lines.push("  /** Nom français V2 — absent quand plusieurs ids front partagent la même fiche (le nom front est conservé). */");
lines.push("  name?: string;");
lines.push("  /** Description une ligne (V2) — absente quand la description V2 est du jargon interne (la description front est conservée). */");
lines.push("  description?: string;");
lines.push("  /** Mise en place (V2 setup), optionnelle. */");
lines.push("  setup?: string;");
lines.push("  /** Comment le faire — étapes numérotées (V2 execution.steps). */");
lines.push("  steps: string[];");
lines.push("  /** Un bon geste (V2 execution.cues). */");
lines.push("  cues: string[];");
lines.push("  /** À éviter (V2 execution.commonMistakes). */");
lines.push("  avoid: string[];");
lines.push("  /** Matériel (clés EquipmentKey du front). */");
lines.push("  equipment: string[];");
lines.push("  /** Sécurité V2 (excludeWhenReported) — PAS affichée au joueur pour l'instant (décision produit en attente) ; générée pour que le branchement futur soit trivial. */");
lines.push("  safetyExclude: string[];");
lines.push("  /** Id de la fiche V2 source (différent de l'id front en cas d'alias). */");
lines.push("  sourceId: string;");
lines.push("};");
lines.push("");
lines.push("export const EXERCISE_CONTENT_V2: Record<string, GeneratedExerciseContent> = {");
for (const e of entries) {
  const fields = [];
  if (e.name !== undefined) fields.push(`name: ${str(e.name)}`);
  if (e.description !== undefined) fields.push(`description: ${str(e.description)}`);
  if (e.setup !== undefined) fields.push(`setup: ${str(e.setup)}`);
  fields.push(`steps: ${strArr(e.steps)}`);
  fields.push(`cues: ${strArr(e.cues)}`);
  fields.push(`avoid: ${strArr(e.avoid)}`);
  fields.push(`equipment: ${strArr(e.equipment)}`);
  fields.push(`safetyExclude: ${strArr(e.safetyExclude)}`);
  fields.push(`sourceId: ${str(e.sourceId)}`);
  lines.push(`  ${str(e.frontId)}: {`);
  for (const f of fields) lines.push(`    ${f},`);
  lines.push("  },");
}
lines.push("};");
lines.push("");
const output = lines.join("\n");

if (checkMode) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (current !== output) {
    console.error("✗ engine/generated/exerciseContentV2.ts n'est PAS à jour avec le catalogue V2.");
    process.exit(1);
  }
  console.log("✓ Fichier généré à jour (hash source " + sourceHash + ").");
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output, "utf8");

// ─── 6. Résumé honnête ───
console.log(`Fiches V2 chargées : ${v2ById.size} — ids front : ${frontIds.size}`);
console.log(`Générées : ${entries.length} | orphelins (pas de fiche V2) : ${orphans.length} | exclues ballon : ${skippedBall.length}`);
console.log(`Orphelins : ${orphans.join(", ")}`);
console.log(`Exclues ballon :\n  ${skippedBall.join("\n  ")}`);
console.log(`Sans « À éviter » (fiche V2 sans commonMistakes) : ${missingAvoid.join(", ") || "aucune"}`);
console.log(`Nettoyages doctrine appliqués : ${doctrineFixesApplied.length ? "\n  " + doctrineFixesApplied.join("\n  ") : "aucun"}`);
console.log(`Exclues marqueur de chantier (_A_VALIDER, repli legacy) : ${skippedInternalMarkers.join(", ") || "aucune"}`);
console.log(`Notes internes retirées (${internalNotesDropped.length}) :${internalNotesDropped.length ? "\n  " + [...new Set(internalNotesDropped.map((x) => x.split(": ")[1]))].join("\n  ") : " aucune"}`);
console.log(`Descriptions jargon non émises (description front conservée) : ${descriptionsOmitted.length}`);
console.log(`Groupes de collision (nom front conservé) : ${collisionGroups.length}`);
for (const g of collisionGroups) console.log(`  ${g}`);
if (unknownEquipment.size) {
  console.log(`⚠ Matériel V2 sans correspondance front (à ajouter à EQUIPMENT_MAP) :`);
  for (const [k, v] of unknownEquipment) console.log(`  ${k} (${v} fiches)`);
}
console.log(`Écrit : ${path.relative(ROOT, OUTPUT)} (hash source ${sourceHash})`);
