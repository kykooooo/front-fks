// scripts/compress-hero-images.mjs
// Compresse les images hero/slide qui pèsent 2-2.3MB chacune vers <300KB.
// Backup des originaux dans assets/images/_originals/ avant compression.
//
// Usage : node scripts/compress-hero-images.mjs
//
// Paramètres :
//   - largeur max 1200px (suffit pour iPhone Pro Max 1290px width à 1x density)
//   - JPEG quality 82 (sweet spot qualité/poids)
//   - mozjpeg pour compression optimale

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "assets", "images");
const BACKUP_DIR = path.join(IMAGES_DIR, "_originals");

const TARGETS = [
  "slide1-ball.jpg",
  "slide2-sprint.jpg",
  "slide3-tunnel.jpg",
  "hero-dark.jpg",
  "hero-light.jpg",
];

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 82;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileSize(filepath) {
  const stat = await fs.stat(filepath);
  return stat.size;
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function compressOne(filename) {
  const srcPath = path.join(IMAGES_DIR, filename);
  const backupPath = path.join(BACKUP_DIR, filename);

  // 1. Backup original (seule fois — skip si déjà backup)
  try {
    await fs.access(backupPath);
    console.log(`  ↳ backup déjà présent (skip copy)`);
  } catch {
    await fs.copyFile(srcPath, backupPath);
    console.log(`  ↳ backup créé : _originals/${filename}`);
  }

  const sizeBefore = await fileSize(srcPath);

  // 2. Compresser depuis le backup (source propre) vers l'original
  const tempPath = srcPath + ".tmp";
  await sharp(backupPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(tempPath);

  // 3. Replace original
  await fs.rename(tempPath, srcPath);

  const sizeAfter = await fileSize(srcPath);
  const ratio = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);
  return { sizeBefore, sizeAfter, ratio };
}

async function main() {
  console.log(`Compression ${TARGETS.length} images (max ${MAX_WIDTH}px, JPEG q${JPEG_QUALITY}, mozjpeg)\n`);
  await ensureDir(BACKUP_DIR);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const filename of TARGETS) {
    console.log(`→ ${filename}`);
    try {
      const { sizeBefore, sizeAfter, ratio } = await compressOne(filename);
      totalBefore += sizeBefore;
      totalAfter += sizeAfter;
      console.log(`  ${formatKB(sizeBefore)} → ${formatKB(sizeAfter)} (−${ratio}%)`);
    } catch (err) {
      console.error(`  ✘ erreur : ${err.message}`);
    }
  }

  const totalRatio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(`\n✓ Total : ${formatKB(totalBefore)} → ${formatKB(totalAfter)} (−${totalRatio}%)`);
  console.log(`  Originaux sauvegardés dans : assets/images/_originals/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
