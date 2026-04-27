/**
 * Backwards-compatible shim — the real devnet SDK service lives in
 * `./sdk-service.ts`. We keep the `mockCloakService` export so legacy
 * imports continue to compile.
 */
export { cloakSdkService as mockCloakService } from "./sdk-service";
