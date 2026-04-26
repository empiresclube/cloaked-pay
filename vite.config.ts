// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When deploying to Vercel, set DEPLOY_TARGET=vercel so we:
//   - disable the Cloudflare plugin
//   - tell TanStack Start to emit a Vercel-compatible build (Node serverless)
const isVercel = process.env.DEPLOY_TARGET === "vercel" || !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  tanstackStart: isVercel ? { target: "vercel" } : undefined,
});
