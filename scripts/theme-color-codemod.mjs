import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/Gamer/front-fks";
const targets = ["screens", "components"];

const colorMap = new Map([
  ["#fff", "theme.colors.white"],
  ["#FFFFFF", "theme.colors.white"],
  ["#ffffff", "theme.colors.white"],
  ["#000", "theme.colors.black"],
  ["#000000", "theme.colors.black"],
  ["#ff7a1a", "theme.colors.accent"],
  ["#ff9a4a", "theme.colors.accentAlt"],
  ["#3b82f6", "theme.colors.blue500"],
  ["#2563eb", "theme.colors.blue600"],
  ["#60a5fa", "theme.colors.blue400"],
  ["#8b5cf6", "theme.colors.violet500"],
  ["#a78bfa", "theme.colors.violet400"],
  ["#06b6d4", "theme.colors.cyan500"],
  ["#22d3ee", "theme.colors.cyan400"],
  ["#14b8a6", "theme.colors.teal500"],
  ["#2dd4bf", "theme.colors.teal400"],
  ["#10b981", "theme.colors.emerald500"],
  ["#34d399", "theme.colors.emerald400"],
  ["#22c55e", "theme.colors.green500"],
  ["#16a34a", "theme.colors.green600"],
  ["#4ade80", "theme.colors.green400"],
  ["#f59e0b", "theme.colors.amber500"],
  ["#fbbf24", "theme.colors.amber400"],
  ["#d97706", "theme.colors.orange600"],
  ["#ef4444", "theme.colors.red500"],
  ["#dc2626", "theme.colors.red600"],
  ["#fb7185", "theme.colors.rose400"],
  ["#6b7280", "theme.colors.gray500"],
  ["#9ca3af", "theme.colors.gray400"],
  ["#f8fafc", "theme.colors.slate50"],
  ["#f87171", "theme.colors.rose300"],
  ["#84cc16", "theme.colors.lime500"],
  ["#f97316", "theme.colors.orange500"],
  ["#9fb0c8", "theme.colors.steel300"],
  ["#a855f7", "theme.colors.purple500"],
  ["#ec4899", "theme.colors.pink500"],
  ["#050507", "theme.colors.ink950"],
  ["#0b0d12", "theme.colors.ink930"],
  ["#12161d", "theme.colors.ink920"],
  ["#0d0d10", "theme.colors.ink910"],
  ["#131316", "theme.colors.ink900"],
  ["#0f0f17", "theme.colors.ink880"],
  ["#0f0f0f", "theme.colors.ink870"],
  ["#1a1a1a", "theme.colors.neutral850"],
  ["#1a1a2a", "theme.colors.plum900"],
  ["#0f170f", "theme.colors.forest950"],
  ["#1a2a1a", "theme.colors.forest900"],
  ["#0a0f17", "theme.colors.navy950"],
  ["#0f1a2a", "theme.colors.navy900"],
  ["#170f0a", "theme.colors.ember950"],
  ["#2a1a0f", "theme.colors.ember900"],
  ["rgba(255,255,255,0.9)", "theme.colors.white90"],
  ["rgba(255,255,255,0.85)", "theme.colors.white85"],
  ["rgba(255,255,255,0.8)", "theme.colors.white80"],
  ["rgba(255,255,255,0.7)", "theme.colors.white70"],
  ["rgba(255,255,255,0.62)", "theme.colors.white62"],
  ["rgba(255,255,255,0.45)", "theme.colors.white45"],
  ["rgba(255,255,255,0.35)", "theme.colors.white35"],
  ["rgba(255,255,255,0.3)", "theme.colors.white30"],
  ["rgba(255,255,255,0.2)", "theme.colors.white20"],
  ["rgba(255,255,255,0.5)", "theme.colors.white50"],
  ["rgba(255, 255, 255, 0.5)", "theme.colors.white50"],
  ["rgba(255,255,255,0.12)", "theme.colors.white12"],
  ["rgba(255,255,255,0.10)", "theme.colors.white10"],
  ["rgba(255,255,255,0.1)", "theme.colors.white10"],
  ["rgba(255,255,255,0.08)", "theme.colors.white08"],
  ["rgba(255,255,255,0.07)", "theme.colors.white07"],
  ["rgba(255,255,255,0.06)", "theme.colors.white06"],
  ["rgba(255,255,255,0.05)", "theme.colors.white05"],
  ["rgba(255,255,255,0.04)", "theme.colors.white04"],
  ["rgba(255,255,255,0.03)", "theme.colors.white03"],
  ["rgba(0,0,0,0.15)", "theme.colors.black15"],
  ["rgba(0,0,0,0.08)", "theme.colors.black08"],
  ["rgba(0,0,0,0.25)", "theme.colors.black25"],
  ["rgba(0,0,0,0.5)", "theme.colors.black50"],
  ["rgba(0,0,0,0.55)", "theme.colors.black55"],
  ["rgba(0,0,0,0.6)", "theme.colors.black60"],
  ["rgba(0,0,0,0.65)", "theme.colors.black65"],
  ["rgba(0,0,0,0.7)", "theme.colors.black70"],
  ["rgba(0, 0, 0, 0.7)", "theme.colors.black70"],
  ["rgba(0,0,0,0.88)", "theme.colors.black88"],
  ["rgba(7,7,9,0.72)", "theme.colors.black72"],
  ["rgba(9, 11, 16, 0.55)", "theme.colors.slate55"],
  ["rgba(31, 36, 48, 0.6)", "theme.colors.slate60"],
  ["rgba(255,122,26,0.12)", "theme.colors.accentSoft12"],
  ["rgba(255,122,26,0.04)", "theme.colors.accentSoft04"],
  ["rgba(255,122,26,0.08)", "theme.colors.accentSoft08"],
  ["rgba(255,122,26,0.1)", "theme.colors.accentSoft10"],
  ["rgba(255,122,26,0.10)", "theme.colors.accentSoft10"],
  ["rgba(255,122,26,0.24)", "theme.colors.accentSoft24"],
  ["rgba(255,122,26,0.15)", "theme.colors.accentSoft15"],
  ["rgba(255,122,26,0.28)", "theme.colors.accentSoft28"],
  ["rgba(255,122,26,0.45)", "theme.colors.accentSoft45"],
  ["rgba(22,163,74,0.12)", "theme.colors.greenSoft12"],
  ["rgba(34, 197, 94, 0.1)", "theme.colors.green500Soft10"],
  ["rgba(34, 197, 94, 0.12)", "theme.colors.green500Soft12"],
  ["rgba(34, 197, 94, 0.15)", "theme.colors.green500Soft15"],
  ["rgba(34, 197, 94, 0.4)", "theme.colors.green500Soft40"],
  ["rgba(22, 163, 74, 0.08)", "theme.colors.greenSoft08"],
  ["rgba(22, 163, 74, 0.15)", "theme.colors.greenSoft15"],
  ["rgba(34, 197, 94, 0.2)", "theme.colors.greenSoft20"],
  ["rgba(34, 197, 94, 0.12)", "theme.colors.green500Soft12"],
  ["rgba(34, 197, 94, 0.15)", "theme.colors.green500Soft15"],
  ["rgba(245, 158, 11, 0.10)", "theme.colors.amberSoft10"],
  ["rgba(245, 158, 11, 0.06)", "theme.colors.amberSoft06"],
  ["rgba(245, 158, 11, 0.08)", "theme.colors.amberSoft08"],
  ["rgba(245, 158, 11, 0.12)", "theme.colors.amberSoft12"],
  ["rgba(245,158,11,0.14)", "theme.colors.amberSoft14"],
  ["rgba(245, 158, 11, 0.15)", "theme.colors.amberSoft15"],
  ["rgba(245,158,11,0.15)", "theme.colors.amberSoft15"],
  ["rgba(245, 158, 11, 0.18)", "theme.colors.amberSoft18"],
  ["rgba(245, 158, 11, 0.3)", "theme.colors.amberSoft30"],
  ["rgba(239,68,68,0.12)", "theme.colors.redSoft12"],
  ["rgba(220, 38, 38, 0.10)", "theme.colors.red600Soft10"],
  ["rgba(239, 68, 68, 0.05)", "theme.colors.redSoft05"],
  ["rgba(239,68,68,0.06)", "theme.colors.redSoft06"],
  ["rgba(239, 68, 68, 0.10)", "theme.colors.redSoft10"],
  ["rgba(239, 68, 68, 0.15)", "theme.colors.redSoft15"],
  ["rgba(239, 68, 68, 0.18)", "theme.colors.redSoft18"],
  ["rgba(37, 99, 235, 0.08)", "theme.colors.blueSoft08"],
  ["rgba(37, 99, 235, 0.12)", "theme.colors.blueSoft12"],
  ["rgba(37,99,235,0.12)", "theme.colors.blueSoft12"],
  ["rgba(37, 99, 235, 0.15)", "theme.colors.blueSoft15"],
  ["rgba(59, 130, 246, 0.08)", "theme.colors.blue500Soft08"],
  ["rgba(59, 130, 246, 0.15)", "theme.colors.blue500Soft15"],
  ["rgba(96,165,250,0.02)", "theme.colors.skySoft02"],
  ["rgba(96,165,250,0.10)", "theme.colors.skySoft10"],
  ["rgba(139, 92, 246, 0.06)", "theme.colors.violetSoft06"],
  ["rgba(139, 92, 246, 0.08)", "theme.colors.violetSoft08"],
  ["rgba(139, 92, 246, 0.12)", "theme.colors.violetSoft12"],
  ["rgba(139, 92, 246, 0.15)", "theme.colors.violetSoft15"],
  ["rgba(139,92,246,0.15)", "theme.colors.violetSoft15"],
  ["rgba(14,165,233,0.08)", "theme.colors.infoBrightSoft08"],
  ["rgba(6,182,212,0.15)", "theme.colors.cyanSoft15"],
  ["rgba(20, 184, 166, 0.15)", "theme.colors.tealSoft15"],
  ["rgba(161,161,170,0.10)", "theme.colors.graySoft10"],
  ["rgba(5,5,9,0.8)", "theme.colors.panel80"],
  ["rgba(5,7,12,0.88)", "theme.colors.panel88Alt"],
  ["rgba(17,20,28,0.92)", "theme.colors.panel92Alt"],
  ["rgba(20,20,20,0.04)", "theme.colors.neutralSoft04"],
  ["rgba(205,127,50,0.12)", "theme.colors.bronzeSoft12"],
  ["rgba(205,127,50,0.4)", "theme.colors.bronzeSoft40"],
  ["rgba(192,192,192,0.12)", "theme.colors.silverSoft12"],
  ["rgba(192,192,192,0.4)", "theme.colors.silverSoft40"],
  ["rgba(255,193,37,0.14)", "theme.colors.goldSoft14"],
  ["rgba(255,193,37,0.5)", "theme.colors.goldSoft50"],
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "__tests__", ".claude", "android", "ios", "dist", "build"].includes(entry.name)) {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function ensureThemeImport(source, filePath, needsTheme) {
  if (!needsTheme) return source;

  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']([^"']*constants\/theme)["'];?/;
  const match = source.match(importRegex);
  if (match) {
    const names = match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.includes("theme")) names.push("theme");
    const replacement = `import { ${names.join(", ")} } from "${match[2]}";`;
    return source.replace(importRegex, replacement);
  }

  const relativeThemePath = path
    .relative(path.dirname(filePath), path.join(root, "constants", "theme"))
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "");
  const importPath = relativeThemePath.startsWith(".") ? relativeThemePath : `./${relativeThemePath}`;
  const importLine = `import { theme } from "${importPath}";\n`;

  const lastImportMatch = [...source.matchAll(/^import .*;$/gm)].pop();
  if (lastImportMatch) {
    const idx = lastImportMatch.index + lastImportMatch[0].length;
    return `${source.slice(0, idx)}\n${importLine}${source.slice(idx)}`;
  }

  return `${importLine}${source}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceThemeColors(source) {
  let next = source;
  let needsTheme = false;

  for (const [literal, token] of colorMap.entries()) {
    const escaped = escapeRegExp(literal);

    next = next.replace(
      new RegExp(`(color|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|textShadowColor|placeholderTextColor|fallbackColor|gradientColor)=(["'])${escaped}\\2`, "g"),
      (_, prop) => {
        needsTheme = true;
        return `${prop}={${token}}`;
      }
    );

    next = next.replace(new RegExp(`(["'])${escaped}\\1`, "g"), () => {
      needsTheme = true;
      return token;
    });
  }

  return { source: next, needsTheme };
}

const files = targets.flatMap((target) => walk(path.join(root, target)));
let changedCount = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  const replaced = replaceThemeColors(original);
  let next = ensureThemeImport(replaced.source, filePath, replaced.needsTheme);
  next = next.replace(/\r?\n{3,}/g, "\n\n");
  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
    changedCount += 1;
  }
}

console.log(`theme-color-codemod updated ${changedCount} files`);
