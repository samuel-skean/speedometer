/**
 * Render PNG icons from an SVG source using sharp.
 *
 * samuel-skean: I believe the below usage instructions are out of date. Use `tsx scripts/render-icons.ts` instead.
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
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import sharp from "sharp";

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ["src", "out", "sizes"],
    default: {
      src: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../icons/icon.svg",
      ),
      out: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../icons",
      ),
      sizes: "192,512",
    },
  });
  const src = argv.src;
  const outDir = argv.out;
  const sizesArg = argv.sizes;
  const sizes = sizesArg
    .split(",")
    .map((s: string) => Number(s.trim()))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  if (sizes.length === 0) {
    throw new Error("No valid sizes specified. Use --sizes=192,512");
  }
  return { src, outDir, sizes };
}
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}
async function fileExists(p: string) {
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
