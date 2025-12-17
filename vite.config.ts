import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { defineConfig } from "vite";

/**
 * Minimal Vite config to enable HTTPS using mkcert-generated certs.
 *
 * Expected cert files (created by `mkcert` and your existing npm scripts):
 * - certs/localhost+2.pem
 * - certs/localhost+2-key.pem
 *
 * If the cert files are missing, Vite will fall back to HTTP and log a warning.
 */

const rootDir = path.dirname(fileURLToPath(import.meta.url));
let resolvedConfig: import("vite").ResolvedConfig;

function resolveCert(file: string) {
  const p = path.resolve(rootDir, "certs", file);
  return fs.existsSync(p) ? p : null;
}

const certFile = resolveCert("localhost+2.pem");
const keyFile = resolveCert("localhost+2-key.pem");

const httpsConfig =
  certFile && keyFile
    ? {
        cert: fs.readFileSync(certFile),
        key: fs.readFileSync(keyFile),
      }
    : undefined;

// Helpful log to indicate protocol choice
if (!httpsConfig) {
  // eslint-disable-next-line no-console
  console.warn(
    "[vite] HTTPS disabled: mkcert files not found at certs/localhost+2.pem and certs/localhost+2-key.pem.\n" +
      "Run `npm run certs:install` then `npm run certs:generate` to create local dev certificates.",
  );
} else {
  // eslint-disable-next-line no-console
  console.log("[vite] HTTPS enabled with mkcert-generated certificates.");
}

export default defineConfig({
  plugins: [
    {
      name: "request-logger",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          console.log(`[vite] ${req.method} ${req.url}`);
          next();
        });
      },
    },
    {
      name: "service-worker-builder",
      apply: "build",
      configResolved(config) {
        resolvedConfig = config;
      },
      async closeBundle() {
        const root = resolvedConfig?.root ?? process.cwd();
        const outDir = path.resolve(
          root,
          resolvedConfig?.build?.outDir ?? "dist",
        );
        const swSrc = path.resolve(root, "src", "service-worker.ts");
        const swOut = path.join(outDir, "service-worker.js");

        if (!fs.existsSync(swSrc)) {
          console.warn(
            "[sw-builder] src/service-worker.ts not found; skipping",
          );
          return;
        }

        await esbuild({
          entryPoints: [swSrc],
          outfile: swOut,
          bundle: true,
          format: "iife",
          platform: "browser",
          target: "es2020",
          sourcemap: false,
        });

        console.log(`[sw-builder] emitted ${path.relative(root, swOut)}`);
      },
    },
  ],
  server: {
    https: httpsConfig,
    port: 5173,
    open: false,
  },
});
