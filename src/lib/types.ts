/**
 * App-level domain types.
 *
 * On devnet we ship privacy in **SOL** because the Cloak shield-pool program
 * is denominated in SOL. USDC/USDT private flows depend on swap and pool
 * routes that only exist on mainnet, so we keep the union open at the type
 * level but mark them disabled in the UI selectors.
 */

export type TokenSymbol = "SOL" | "USDC" | "USDT";

export type PaymentStatus = "pending" | "paid" | "expired";

export interface PaymentLink {
  id: string;
  amount: number;
  token: TokenSymbol;
  description?: string;
  createdAt: number;
  status: PaymentStatus;
  /** Cloak — recipient's real wallet (on devnet the link pays a real pubkey). */
  stealthAddress: string;
  /** Encrypted memo / viewing key reference (placeholder for real Cloak data). */
  viewingKeyRef: string;
  // Set when paid
  paidAt?: number;
  txSignature?: string;
  /** Owner wallet (creator). */
  owner: string;
}
