/**
 * Cloak SDK — Type definitions
 *
 * These types describe the shape of every operation the app performs against
 * a privacy-preserving payments backend on Solana. They are intentionally
 * SDK-agnostic so we can swap a `MockCloakService` for a real `CloakService`
 * implementation without touching UI code.
 *
 * Conceptual model (Cloak / shielded-pool style):
 *
 *   Public balance ──deposit──▶  Shielded balance  ──privateSend──▶  Stealth address
 *                                       │
 *                                       └──withdraw──▶ Public balance
 *
 *   - Deposit: move public USDC/USDT into the shielded pool (amount becomes
 *     encrypted on-chain, owned by a Cloak commitment derived from your keys).
 *   - Private send: move shielded value to a recipient's stealth address;
 *     amount and recipient are hidden via ZK proofs.
 *   - Viewing key: a derived secret that lets a third party decrypt notes
 *     destined to you (e.g. for accountants, the dashboard, or compliance).
 */

import type { TokenSymbol } from "../types";

/** Solana base58 public key, as a string. */
export type Address = string;

/** Lamports-style integer amount (we use display floats in UI; SDK should use integer minor units). */
export type Amount = number;

/** A 64-char hex string that identifies a derived viewing key. */
export type ViewingKeyRef = string;

/** A 88-char base58 transaction signature. */
export type TxSignature = string;

/* ───────────────────────────────────────────────────────────── Stealth ── */

export interface StealthAddress {
  /** The one-time recipient address visible on-chain. */
  address: Address;
  /** Reference to the viewing key needed to detect notes sent here. */
  viewingKeyRef: ViewingKeyRef;
  /** Ephemeral public key included in the memo so the recipient can decrypt. */
  ephemeralPubkey: Address;
}

/* ────────────────────────────────────────────────────────── Shielded ── */

/**
 * A user's view of their shielded balance.
 * In a real Cloak SDK this is computed by scanning notes with the viewing key.
 */
export interface ShieldedBalance {
  token: TokenSymbol;
  /** Human-readable amount currently spendable in the shielded pool. */
  available: Amount;
  /** Pending deposits that haven't reached enough confirmations yet. */
  pending: Amount;
  /** Total notes available to spend (UTXO count, useful for fee estimation). */
  noteCount: number;
}

/* ──────────────────────────────────────────────────────────── Notes ── */

/**
 * A "note" is a single shielded-pool UTXO destined to the local viewer.
 * Together with `viewingKeyRef`, the SDK can list/detect these.
 */
export interface ShieldedNote {
  id: string;
  token: TokenSymbol;
  amount: Amount;
  /** ms timestamp of the on-chain confirmation. */
  confirmedAt: number;
  /** Whether this note has been spent. */
  spent: boolean;
  /** Optional encrypted memo only the recipient can read. */
  memo?: string;
  /** The stealth address this note was sent to (decrypted locally). */
  stealthAddress: Address;
}

/* ────────────────────────────────────────────────────────── Operations ── */

export type OperationKind = "deposit" | "private_send" | "withdraw";

export type OperationPhase =
  | "idle"
  | "preparing" // building instruction
  | "proving" // generating ZK proof
  | "submitting" // sending tx to Solana
  | "confirming" // waiting for confirmation
  | "success"
  | "error";

export interface OperationProgress {
  phase: OperationPhase;
  message: string;
  /** 0–1, monotonically increasing. */
  progress: number;
}

export interface OperationResult {
  signature: TxSignature;
  confirmedAt: number;
  /** Updated balance after this op. */
  balanceAfter?: ShieldedBalance;
  /** Devnet only: leaf index of the output UTXO inserted into the Merkle tree. */
  depositLeafIndex?: number;
  /** Devnet only: blinding (hex bigint) used when building the output UTXO. */
  depositBlindingHex?: string;
  /** Devnet only: lamports deposited (post-fee). */
  depositLamports?: number;
}

/* ─────────────────────────────────────────────── Operation parameters ── */

export interface DepositParams {
  payer: Address;
  amount: Amount;
  token: TokenSymbol;
  onProgress?: (p: OperationProgress) => void;
}

export interface PrivateSendParams {
  payer: Address;
  to: StealthAddress;
  amount: Amount;
  token: TokenSymbol;
  /** Optional encrypted memo (visible only to recipient with viewing key). */
  memo?: string;
  /**
   * If true and the user has insufficient shielded balance, the SDK will
   * auto-deposit the missing amount first ("just-in-time deposit").
   * This is what enables the one-click pay UX on payment links.
   */
  autoDeposit?: boolean;
  /**
   * Hex-encoded Cloak UTXO public key (bigint) of the merchant. The payer
   * deposits SOL into this UTXO, which only the merchant can later spend
   * (because they hold the matching private key in localStorage).
   */
  merchantUtxoPubkeyHex?: string;
  onProgress?: (p: OperationProgress) => void;
}

export interface WithdrawParams {
  owner: Address;
  amount: Amount;
  token: TokenSymbol;
  /** Public Solana address to receive the unshielded funds. */
  to: Address;
  /**
   * Hex private key (bigint) of the merchant UTXO funded by a paid link.
   * Required on devnet — `withdraw` rebuilds the UTXO from the link's
   * deposit so the merchant can pull funds back to a public wallet.
   */
  merchantUtxoPrivateKeyHex?: string;
  /** Lamports the link deposited (used to reconstruct the UTXO). */
  depositLamports?: number;
  onProgress?: (p: OperationProgress) => void;
}

/* ─────────────────────────────────────────────────── Viewing keys ── */

export interface ViewingKey {
  /** Stable identifier, safe to display. */
  ref: ViewingKeyRef;
  /** The actual secret. NEVER log or transmit beyond user-initiated share. */
  secret: string;
  /** ms timestamp. */
  createdAt: number;
  /** Owner pubkey — the wallet this key is derived from. */
  owner: Address;
  /** Optional human label ("Accountant Q1 2026"). */
  label?: string;
  /** Optional scope: 'full' decrypts all, 'incoming' only decrypts received notes. */
  scope: "full" | "incoming";
}

/* ─────────────────────────────────────────────────── Service contract ── */

/**
 * The single integration surface for the application.
 *
 * Replace `MockCloakService` with a real implementation against the Cloak
 * SDK. UI never imports any concrete service — only this interface via
 * the React provider.
 */
export interface CloakService {
  /* Stealth addresses ─────────────────────────────────────────────── */
  deriveStealthAddress(recipient: Address): Promise<StealthAddress>;

  /* Shielded pool ─────────────────────────────────────────────────── */
  getShieldedBalance(owner: Address, token: TokenSymbol): Promise<ShieldedBalance>;
  listNotes(owner: Address, viewingKey: ViewingKey): Promise<ShieldedNote[]>;

  /* Operations ────────────────────────────────────────────────────── */
  deposit(params: DepositParams): Promise<OperationResult>;
  privateSend(params: PrivateSendParams): Promise<OperationResult>;
  withdraw(params: WithdrawParams): Promise<OperationResult>;

  /* Viewing keys ──────────────────────────────────────────────────── */
  generateViewingKey(owner: Address, scope?: ViewingKey["scope"], label?: string): Promise<ViewingKey>;
  listViewingKeys(owner: Address): Promise<ViewingKey[]>;
  revokeViewingKey(ref: ViewingKeyRef): Promise<void>;
}
