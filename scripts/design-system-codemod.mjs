import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/Gamer/front-fks";
const targets = ["screens", "components"];

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

function ensureThemeImport(source, filePath, needsType, needsRadius) {
  if (!needsType && !needsRadius) return source;

  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']([^"']*constants\/theme)["'];?/;
  const match = source.match(importRegex);
  if (match) {
    const names = match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.includes("theme")) names.push("theme");
    if (needsType && !names.includes("TYPE")) names.push("TYPE");
    if (needsRadius && !names.includes("RADIUS")) names.push("RADIUS");
    const replacement = `import { ${names.join(", ")} } from "${match[2]}";`;
    return source.replace(importRegex, replacement);
  }

  const relativeThemePath = path
    .relative(path.dirname(filePath), path.join(root, "constants", "theme"))
    .replace(/\\/g, "/")
    .replace(/\.tsx?$/, "");
  const importPath = relativeThemePath.startsWith(".") ? relativeThemePath : `./${relativeThemePath}`;
  const additions = ["theme"];
  if (needsType) additions.push("TYPE");
  if (needsRadius) additions.push("RADIUS");
  const importLine = `import { ${additions.join(", ")} } from "${importPath}";\n`;

  const lastImportMatch = [...source.matchAll(/^import .*;$/gm)].pop();
  if (lastImportMatch) {
    const idx = lastImportMatch.index + lastImportMatch[0].length;
    return `${source.slice(0, idx)}\n${importLine}${source.slice(idx)}`;
  }

  return `${importLine}${source}`;
}

function mapFontSize(size) {
  if (size >= 64) return "TYPE.display.lg.fontSize";
  if (size >= 42) return "TYPE.display.md.fontSize";
  if (size >= 32) return "TYPE.display.sm.fontSize";
  if (size >= 26) return "TYPE.hero.fontSize";
  if (size >= 20) return "TYPE.title.fontSize";
  if (size >= 17) return "TYPE.subtitle.fontSize";
  if (size >= 14) return "TYPE.body.fontSize";
  if (size >= 12) return "TYPE.caption.fontSize";
  return "TYPE.micro.fontSize";
}

function mapRadius(size) {
  if (size >= 44) return "RADIUS.pill";
  if (size >= 19) return "RADIUS.xl";
  if (size >= 15) return "RADIUS.lg";
  if (size >= 11) return "RADIUS.md";
  if (size >= 7) return "RADIUS.sm";
  return "RADIUS.xs";
}

function replaceLinewise(source) {
  const lines = source.split("\n");
  let needsType = false;
  let needsRadius = false;

  const nextLines = lines.map((line) => {
    let next = line;

    next = next.replace(/fontSize:\s*(\d+)/g, (_, raw) => {
      needsType = true;
      return `fontSize: ${mapFontSize(Number(raw))}`;
    });

    next = next.replace(/fontSize:\s*theme\.typography\.[a-zA-Z0-9_]+\.fontSize/g, () => {
      needsType = true;
      return "fontSize: TYPE.body.fontSize";
    });

    next = next.replace(/borderRadius:\s*theme\.radius\.xxl/g, () => {
      needsRadius = true;
      return "borderRadius: RADIUS.xl";
    });

    next = next.replace(/borderRadius:\s*theme\.radius\.(sm|md|lg|xl|pill)/g, (_, token) => {
      needsRadius = true;
      return `borderRadius: RADIUS.${token}`;
    });

    next = next.replace(/borderRadius:\s*(\d+)/g, (_, raw) => {
      needsRadius = true;
      return `borderRadius: ${mapRadius(Number(raw))}`;
    });

    return next;
  });

  return {
    source: nextLines.join("\n"),
    needsType,
    needsRadius,
  };
}

const files = targets.flatMap((target) => walk(path.join(root, target)));
let changedCount = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  const replaced = replaceLinewise(original);
  let next = ensureThemeImport(replaced.source, filePath, replaced.needsType, replaced.needsRadius);
  next = next.replace(/\r?\n{3,}/g, "\n\n");
  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
    changedCount += 1;
  }
}

console.log(`design-system-codemod updated ${changedCount} files`);
