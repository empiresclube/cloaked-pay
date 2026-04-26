/**
 * Cloak service factory.
 *
 * Single place to switch between mock and real implementations. The rest
 * of the app never imports a concrete service — it goes through the React
 * provider in `./provider.tsx`, which calls `getCloakService()`.
 *
 * To enable the real SDK later:
 *   1. Implement `CloakService` in a new file `./real-service.ts`
 *   2. Replace the body of `getCloakService()` to return it (optionally
 *      gated by an env flag like `import.meta.env.VITE_CLOAK_REAL`).
 */

import type { CloakService } from "./types";
import { mockCloakService } from "./mock-service";

let instance: CloakService | null = null;

export function getCloakService(): CloakService {
  if (instance) return instance;
  // Future: check env flag here and return RealCloakService instead
  instance = mockCloakService;
  return instance;
}

/** Test/dev helper to inject a custom implementation (e.g. for Storybook). */
export function __setCloakService(svc: CloakService) {
  instance = svc;
}
