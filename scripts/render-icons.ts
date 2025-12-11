/**
 * Render PNG icons from an SVG source using sharp.
 *
 * Usage:
 *   ts-node scripts/render-icons.ts
 *   (or) node -r ts-node/register scripts/render-icons.ts
 *
 * Optional args:
 *   --src=<path-to-svg>   Defaults to ../icons/icon.svg
 *   --out=<icons-dir>     Defaults to ../icons
 *   --sizes=192,512       Comma-separated list of sizes (px), defaults to 192,512
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

type CliOptions = {
  src: string;
  outDir: string;
  sizes: number[];
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const getArg = (name: string, fallback?: string) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
  };

  const src = getArg("src", path.resolve(__dirname, "../icons/icon.svg"))!;
  const outDir = getArg("out", path.resolve(__dirname, "../icons"))!;
  const sizesArg = getArg("sizes", "192,512")!;
  const sizes = sizesArg
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (sizes.length === 0) {
    throw new Error("No valid sizes specified. Use --sizes=192,512");
  }

  return { src, outDir, sizes };
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function renderPngFromSvg(
  svgPath: string,
  outPath: string,
  size: number,
) {
  const svgExists = await fileExists(svgPath);
  if (!svgExists) {
    throw new Error(`Source SVG not found: ${svgPath}`);
  }

  // Render PNG with transparent background, fit within size x size.
  // We set density to improve rasterization quality from SVG.
  const density = Math.max(72, Math.floor(size)); // heuristic: at least 72, up to size
  const svgBuffer = await fs.readFile(svgPath);

  const image = sharp(svgBuffer, { density })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    });

  const outBuffer = await image.toBuffer();
  await fs.writeFile(outPath, outBuffer);
}

async function main() {
  const { src, outDir, sizes } = parseArgs();

  console.log(`Rendering icons from: ${src}`);
  console.log(`Output directory:    ${outDir}`);
  console.log(`Sizes:               ${sizes.join(", ")}`);

  await ensureDir(outDir);

  for (const size of sizes) {
    const outName = `icon-${size}.png`;
    const outPath = path.resolve(outDir, outName);
    console.log(`-> Rendering ${outName} (${size}x${size})`);
    await renderPngFromSvg(src, outPath, size);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Error rendering icons:", err?.message || err);
  process.exit(1);
});
