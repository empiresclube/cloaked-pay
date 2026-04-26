/**
 * Buffer polyfill for the browser.
 *
 * The Cloak SDK depends on packages (snarkjs, ffjavascript, bs58) that
 * expect Node's `Buffer` global. Vite/browser bundles don't ship one, so
 * we mount the npm `buffer` package onto `globalThis` before any SDK code
 * runs. Imported for side-effects from `./service.ts`.
 */
import { Buffer as BufferPolyfill } from "buffer";

if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer: typeof BufferPolyfill }).Buffer = BufferPolyfill;
}

export {};
