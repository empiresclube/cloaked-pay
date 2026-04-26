export type TokenSymbol = "USDC" | "USDT";

export type PaymentStatus = "pending" | "paid" | "expired";

export interface PaymentLink {
  id: string;
  amount: number;
  token: TokenSymbol;
  description?: string;
  createdAt: number;
  status: PaymentStatus;
  // Cloak — stealth recipient address (derived, not the user's main wallet)
  stealthAddress: string;
  // Encrypted memo / viewing key reference (placeholder for real Cloak data)
  viewingKeyRef: string;
  // Set when paid
  paidAt?: number;
  txSignature?: string;
  // Owner wallet (creator)
  owner: string;
}
