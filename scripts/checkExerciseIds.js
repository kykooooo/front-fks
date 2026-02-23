const fs = require("fs");
const path = require("path");

const readIdsFromFile = (filePath, idPattern = /["']([a-z0-9_+-]+)["']/gi) => {
  const content = fs.readFileSync(filePath, "utf8");
  const matches = [...content.matchAll(idPattern)];
  const ids = matches.map((m) => m[1]);
  return new Set(ids);
};

const baseDir = path.resolve(__dirname, "..");
const bankPath = path.join(baseDir, "engine", "exerciseBank.ts");
const backendPath = path.join(baseDir, "engine", "backendExerciseIds.ts");

const bankIds = readIdsFromFile(bankPath, /id:\s*["']([a-z0-9_+-]+)["']/gi);
const backendIds = readIdsFromFile(backendPath, /["']([a-z0-9_+-]+)["'],?/gi);

const missing = [...bankIds].filter((id) => !backendIds.has(id));
const extra = [...backendIds].filter((id) => !bankIds.has(id));

if (missing.length === 0 && extra.length === 0) {
  console.log("✅ backendExerciseIds.ts already matches exerciseBank.ts");
  process.exit(0);
}

if (missing.length) {
  console.log("⚠️ Missing in backendExerciseIds.ts:");
  missing.forEach((id) => console.log("  -", id));
}
if (extra.length) {
  console.log("⚠️ Extra in backendExerciseIds.ts but not in exerciseBank.ts:");
  extra.forEach((id) => console.log("  -", id));
}

process.exit(missing.length || extra.length ? 1 : 0);
