/**
 * Public API of the Cloak module.
 *
 * UI imports from `@/lib/cloak` — never reach into internal files.
 * This boundary lets us reorganize the module freely without touching pages.
 */

export type {
  Address,
  Amount,
  TxSignature,
  ViewingKeyRef,
  StealthAddress,
  ShieldedBalance,
  ShieldedNote,
  ViewingKey,
  OperationKind,
  OperationPhase,
  OperationProgress,
  OperationResult,
  DepositParams,
  PrivateSendParams,
  WithdrawParams,
  CloakService,
} from "./types";

export { getCloakService } from "./service";
export {
  useCloak,
  useShieldedBalance,
  usePrivateSend,
  deriveStealthAddressFor,
} from "./provider";
export { CloakProvider } from "./provider";
export { cloakUtils, explorerUrl } from "./sdk-service";

/** Generates a short, shareable payment link ID. */
export function generateLinkId(): string {
  const HEX = "0123456789abcdef";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < arr.length; i++)
    out += HEX[arr[i] & 0x0f] + HEX[(arr[i] >> 4) & 0x0f];
  return out;
}
