#!/usr/bin/env ts-node

import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

async function pickCertPair(dir: string) {
  const entries = await readdir(dir);
  const pem = entries.filter((f) => f.endsWith(".pem"));
  // Match localhost.pem or localhost+N.pem
  const candidates = pem
    .map((cert) => {
      const m = cert.match(/^localhost(?:\+(\d+))?\.pem$/);
      if (!m) return null;
      const base = `localhost${m[1] ? `+${m[1]}` : ""}`;
      const key = `${base}-key.pem`;
      if (!pem.includes(key)) return null;
      const score = m[1] ? Number(m[1]) : 0;
      return { cert: path.resolve(dir, cert), key: path.resolve(dir, key), score };
    })
    .filter(Boolean) as Array<{ cert: string; key: string; score: number }>;

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

async function main() {
  const root = process.cwd();
  const certsDir = path.resolve(root, "certs");
  const port = String(process.env.PORT || 8443);

  const pair = await pickCertPair(certsDir);
  if (!pair) {
    console.error(
      "No mkcert certs found in certs/. Generate with: mkcert -install && (cd certs && mkcert localhost 127.0.0.1 ::1)",
    );
    process.exit(1);
  }

  console.log(`Serving HTTPS on https://localhost:${port}`);
  console.log(`Cert: ${pair.cert}`);
  console.log(`Key:  ${pair.key}`);

  const child = spawn("npx", ["serve", "--ssl-cert", pair.cert, "--ssl-key", pair.key, "-l", port], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error("Failed to start serve:", err?.message || err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Error:", err?.message || err);
  process.exit(1);
});
