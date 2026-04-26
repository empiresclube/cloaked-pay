#!/usr/bin/env node
/**
 * Post-build script: creates a SPA index.html in dist/client so the
 * TanStack Start client bundle can be served as a pure static SPA on
 * Vercel (or any static host). Reads the Vite manifest to find the
 * correct hashed entry filenames.
 *
 * Run automatically by `bun run build:spa`.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const manifestPath = path.join(clientDir, ".vite", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error(`[build-spa] manifest not found at ${manifestPath}`);
  console.error("[build-spa] run `bun run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Find the main entry — TanStack Start emits it as "src/start.tsx" or similar.
const entry =
  Object.values(manifest).find((e) => e.isEntry && (e.src?.includes("start") || e.name === "main")) ??
  Object.values(manifest).find((e) => e.isEntry);

if (!entry) {
  console.error("[build-spa] no entry found in manifest");
  console.error("[build-spa] available entries:", Object.keys(manifest));
  process.exit(1);
}

const cssLinks = (entry.css ?? [])
  .map((href) => `    <link rel="stylesheet" href="/${href}" />`)
  .join("\n");

const preloadLinks = (entry.imports ?? [])
  .map((key) => manifest[key]?.file)
  .filter(Boolean)
  .map((file) => `    <link rel="modulepreload" href="/${file}" />`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CloakPay — Private crypto payments</title>
    <meta name="description" content="Stripe-style payment links with full on-chain privacy on Solana." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
${cssLinks}
${preloadLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entry.file}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(clientDir, "index.html"), html);
console.log(`[build-spa] wrote dist/client/index.html (entry: ${entry.file})`);
