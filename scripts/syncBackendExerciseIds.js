const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "engine", "exerciseBank.ts");
const targetPath = path.join(__dirname, "..", "engine", "backendExerciseIds.ts");

const content = fs.readFileSync(filePath, "utf8");
const idPattern = /id:\s*["']([a-z0-9_+-]+)["']/gi;
const ids = [];
const seen = new Set();
for (const match of content.matchAll(idPattern)) {
  const id = match[1];
  if (!seen.has(id)) {
    seen.add(id);
    ids.push(id);
  }
}

const formatted = ids.map((id) => `  "${id}",`).join("\n");
const header = `// engine/backendExerciseIds.ts\nexport const BACKEND_EXERCISE_IDS = [\n${formatted}\n] as const;\n\nexport type BackendExerciseId = (typeof BACKEND_EXERCISE_IDS)[number];\n`;

fs.writeFileSync(targetPath, header);
console.log(`✅ Synced ${ids.length} IDs to backendExerciseIds.ts`);
