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
export { useCloak } from "./provider";
export { CloakProvider } from "./provider";
