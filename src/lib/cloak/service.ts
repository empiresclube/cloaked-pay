/**
 * Cloak service factory.
 *
 * Returns the real `CloakSdkService` singleton. The React provider in
 * `./provider.tsx` is responsible for injecting the connected wallet
 * adapter via `setWallet()` whenever it changes.
 *
 * The mock service is kept around as a safe SSR fallback (no wallet
 * available, no real RPC) — see `mock-service.ts`.
 */

import "./buffer-polyfill"; // must run before SDK code touches `Buffer`
import type { CloakService } from "./types";
import { cloakSdkService } from "./sdk-service";
import { mockCloakService } from "./mock-service";

let instance: CloakService = cloakSdkService;

export function getCloakService(): CloakService {
  return instance;
}

/** Test/dev helper to inject a custom implementation (e.g. for Storybook). */
export function __setCloakService(svc: CloakService) {
  instance = svc;
}

/** Force the mock service (used by SSR / pre-wallet states). */
export function useMockCloakService() {
  instance = mockCloakService;
}
