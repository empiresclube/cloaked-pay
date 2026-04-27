/**
 * Real Cloak SDK service — devnet.
 *
 * Implements `CloakService` using the high-level `CloakSDK` class from
 * `@cloak.dev/sdk`. This is the runtime path used after a wallet connects.
 *
 * Privacy model (per Cloak docs):
 *   - A *note* is a private commitment created from a wallet's spend key.
 *   - `privateTransfer(connection, note, recipients)` deposits the note,
 *     generates a Groth16 ZK proof in the browser, and withdraws to the
 *     listed recipients via the Cloak relay — all in one call.
 *   - The on-chain link between sender and recipient is hidden by the
 *     shielded pool; the recipient sees regular SOL land in their wallet.
 *
 * One note per payment link (1:1 mapping):
 *   When a payer pays a CloakPay link, we call `sdk.privateTransfer(...)`
 *   with the link's `amount` and the merchant's wallet as the single
 *   recipient. No "shielded balance" accounting on the payer side — funds
 *   flow public → shielded → public in a single user action, mirroring the
 *   Stripe-style "Pay" UX.
 *
 * SOL only on devnet:
 *   The shield pool is denominated in SOL. USDC private paths require swap
 *   routes that don't exist on devnet, so we surface a clear error.
 */

import type {
  CloakSDK as CloakSDKType,
  CloakNote,
  Network,
  WalletAdapter,
} from "@cloak.dev/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

import "./buffer-polyfill";
import type {
  Address,
  CloakService,
  DepositParams,
  OperationProgress,
  OperationResult,
  PrivateSendParams,
  ShieldedBalance,
  ShieldedNote,
  StealthAddress,
  ViewingKey,
  ViewingKeyRef,
  WithdrawParams,
} from "./types";
import type { TokenSymbol } from "../types";

/* ─────────────────────────────────────────────────── Lazy SDK loader ── */

type CloakSdkModule = typeof import("@cloak.dev/sdk");
let sdkModulePromise: Promise<CloakSdkModule> | null = null;

async function loadSdk(): Promise<CloakSdkModule> {
  if (!sdkModulePromise) {
    await import("./buffer-polyfill");
    sdkModulePromise = import("@cloak.dev/sdk");
  }
  return sdkModulePromise;
}

/* ───────────────────────────────────────────────────── Network resolution ── */

function resolveNetwork(): Network {
  const raw = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? "devnet";
  if (raw === "mainnet-beta" || raw === "mainnet") return "mainnet";
  if (raw === "testnet") return "testnet";
  if (raw === "localnet") return "localnet";
  return "devnet";
}

function resolveRpcUrl(): string {
  const custom = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;
  if (custom && custom.length > 0) return custom;
  const network = resolveNetwork();
  if (network === "mainnet") return "https://api.mainnet-beta.solana.com";
  if (network === "testnet") return "https://api.testnet.solana.com";
  if (network === "localnet") return "http://127.0.0.1:8899";
  return "https://api.devnet.solana.com";
}

/* ─────────────────────────────────── Phase mapping (SDK → app phases) ── */

function mapDepositPhase(status: string): OperationProgress["phase"] {
  if (status.includes("note")) return "preparing";
  if (status.includes("simulat") || status.includes("creating")) return "preparing";
  if (status.includes("send")) return "submitting";
  if (status.includes("confirm")) return "confirming";
  if (status.includes("indexer") || status.includes("proof")) return "confirming";
  if (status === "complete") return "success";
  return "preparing";
}

function mapTransferPhase(status: string): OperationProgress["phase"] {
  const s = status.toLowerCase();
  if (s.includes("deposit")) return "preparing";
  if (s.includes("proof") || s.includes("proving") || s.includes("generating"))
    return "proving";
  if (s.includes("submit") || s.includes("relay") || s.includes("send"))
    return "submitting";
  if (s.includes("confirm") || s.includes("waiting")) return "confirming";
  if (s.includes("complete") || s.includes("success")) return "success";
  return "preparing";
}

function progressEmitter(onProgress?: (p: OperationProgress) => void) {
  return (phase: OperationProgress["phase"], message: string, progress: number) => {
    onProgress?.({ phase, message, progress });
  };
}

/* ──────────────────────────────────────────────────── Helpers ── */

const SOL_DECIMALS = 9;

function solToLamports(amount: number): number {
  return Math.round(amount * 1_000_000_000);
}

function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

function ensureSolToken(token: TokenSymbol) {
  if (token !== "SOL") {
    throw new Error(
      `${token} private transfers require mainnet swap routes. Switch this link to SOL to test on devnet.`,
    );
  }
}

/** Friendly mapping for the most common Cloak/Solana errors. */
function humanizeError(e: unknown): string {
  if (!e) return "Unknown error.";
  const msg = (e as Error).message ?? String(e);
  if (/insufficient/i.test(msg)) {
    return "Insufficient SOL in your wallet. Top up at https://faucet.solana.com (devnet).";
  }
  if (/user rejected|reject/i.test(msg)) return "Wallet signature rejected.";
  if (/blockhash/i.test(msg)) return "Network busy — please try again.";
  if (/circuit/i.test(msg)) {
    return "Couldn't load ZK circuits. Check your connection and retry.";
  }
  if (/MIN_DEPOSIT|too small/i.test(msg)) {
    return "Minimum amount is 0.01 SOL on Cloak.";
  }
  return msg;
}

/* ─────────────────────────────────────────── Service implementation ── */

class CloakSdkService implements CloakService {
  private sdk: CloakSDKType | null = null;
  private wallet: WalletAdapter | null = null;
  private connection: Connection | null = null;
  private currentOwner: string | null = null;

  /** Called by the React provider every time the wallet adapter changes. */
  setWallet(wallet: WalletAdapter | null) {
    if (this.wallet === wallet) return;
    this.wallet = wallet;
    // Force SDK rebuild on next call — wallet identity changed.
    this.sdk = null;
    this.currentOwner = wallet?.publicKey?.toBase58() ?? null;
  }

  /** Lazy-initialize the connection (RPC). */
  private getConnection(): Connection {
    if (!this.connection) {
      this.connection = new Connection(resolveRpcUrl(), "confirmed");
    }
    return this.connection;
  }

  private async getSdk(): Promise<CloakSDKType> {
    if (!this.wallet || !this.wallet.publicKey) {
      throw new Error("Connect your wallet first.");
    }
    if (this.sdk) return this.sdk;

    const mod = await loadSdk();
    this.sdk = new mod.CloakSDK({
      wallet: this.wallet,
      network: resolveNetwork(),
      storage: new mod.LocalStorageAdapter(
        `cloak.notes.${this.currentOwner}`,
        `cloak.keys.${this.currentOwner}`,
      ),
    });
    return this.sdk;
  }

  /* ── Stealth addresses ──────────────────────────────────────────── */

  /**
   * For real Cloak transfers the "stealth" property comes from the
   * commitment generated per note, not from a separate address. So we
   * return the recipient's actual wallet address as the on-chain
   * destination (where the withdraw lands), and a viewing-key reference
   * derived from the recipient's pubkey for the dashboard UI.
   */
  async deriveStealthAddress(recipient: Address): Promise<StealthAddress> {
    const mod = await loadSdk();
    if (!mod.isValidSolanaAddress(recipient)) {
      throw new Error(`Recipient ${recipient} is not a valid Solana address.`);
    }
    return {
      address: recipient,
      viewingKeyRef: `vk_${recipient.slice(0, 16)}`,
      ephemeralPubkey: recipient,
    };
  }

  /* ── Shielded balance & notes (computed from real notes) ────────── */

  async getShieldedBalance(
    owner: Address,
    token: TokenSymbol,
  ): Promise<ShieldedBalance> {
    if (token !== "SOL" || !this.wallet?.publicKey) {
      return { token, available: 0, pending: 0, noteCount: 0 };
    }
    void owner;
    try {
      const sdk = await this.getSdk();
      const mod = await loadSdk();
      const notes = (await sdk.loadNotes()).filter(
        (n) => n.network === resolveNetwork() && mod.isWithdrawable(n),
      );
      const lamports = notes.reduce((sum, n) => sum + n.amount, 0);
      return {
        token: "SOL",
        available: lamportsToSol(lamports),
        pending: 0,
        noteCount: notes.length,
      };
    } catch {
      return { token, available: 0, pending: 0, noteCount: 0 };
    }
  }

  async listNotes(
    owner: Address,
    viewingKey: ViewingKey,
  ): Promise<ShieldedNote[]> {
    void owner;
    void viewingKey;
    if (!this.wallet?.publicKey) return [];
    const sdk = await this.getSdk();
    const notes = await sdk.loadNotes();
    return notes
      .filter((n) => n.network === resolveNetwork())
      .map<ShieldedNote>((n) => ({
        id: n.commitment,
        token: "SOL",
        amount: lamportsToSol(n.amount),
        confirmedAt: n.timestamp,
        spent: false,
        memo: undefined,
        stealthAddress: n.commitment,
      }));
  }

  /* ── Deposit ────────────────────────────────────────────────────── */

  async deposit({
    payer,
    amount,
    token,
    onProgress,
  }: DepositParams): Promise<OperationResult> {
    ensureSolToken(token);
    void payer;
    const emit = progressEmitter(onProgress);
    const sdk = await this.getSdk();
    const connection = this.getConnection();

    const lamports = solToLamports(amount);

    try {
      const result = await sdk.deposit(connection, lamports, {
        onProgress: (status) => {
          emit(mapDepositPhase(String(status)), `Depositing… (${status})`, 0.5);
        },
      });
      emit("success", "Deposited.", 1);

      const balance = await this.getShieldedBalance(payer, "SOL");
      return {
        signature: result.signature,
        confirmedAt: Date.now(),
        balanceAfter: balance,
      };
    } catch (e) {
      throw new Error(humanizeError(e));
    }
  }

  /* ── Private send (one-shot deposit + transfer to recipient) ────── */

  async privateSend(params: PrivateSendParams): Promise<OperationResult> {
    const { payer, to, amount, token, onProgress } = params;
    ensureSolToken(token);

    if (!this.wallet?.publicKey) {
      throw new Error("Connect your wallet first.");
    }
    void payer;

    const emit = progressEmitter(onProgress);
    const sdk = await this.getSdk();
    const mod = await loadSdk();
    const connection = this.getConnection();

    const recipientPk = (() => {
      try {
        return new PublicKey(to.address);
      } catch {
        throw new Error(`Recipient ${to.address} is not a valid Solana address.`);
      }
    })();

    const lamports = solToLamports(amount);
    if (lamports < mod.MIN_DEPOSIT_LAMPORTS) {
      throw new Error(
        `Minimum amount is ${lamportsToSol(mod.MIN_DEPOSIT_LAMPORTS)} SOL on Cloak (devnet).`,
      );
    }
    // Total fee = fixed (0.005 SOL) + variable (0.3%). User must hold lamports + fee.
    const totalFee = mod.calculateFee(lamports);
    const totalNeeded = lamports + totalFee;

    emit("preparing", "Preparing private transfer…", 0.1);

    try {
      // 1) Generate a fresh note with the exact amount.
      const note: CloakNote = await sdk.generateNote(lamports);

      emit("preparing", "Note created. Awaiting wallet signature…", 0.2);

      // 2) privateTransfer: deposits, builds proof, and withdraws to recipient.
      const result = await sdk.privateTransfer(
        connection,
        note,
        [{ recipient: recipientPk, amount: lamports - totalFee }],
        {
          onProgress: (status) => {
            emit(
              mapTransferPhase(String(status)),
              `Transferring… (${status})`,
              0.5,
            );
          },
          onProofProgress: (pct) => {
            emit("proving", `Generating zero-knowledge proof… ${pct}%`, 0.3 + pct / 200);
          },
        },
      );

      emit("success", "Payment confirmed on Solana.", 1);

      return {
        signature: result.signature,
        confirmedAt: Date.now(),
        balanceAfter: { token: "SOL", available: 0, pending: 0, noteCount: 0 },
      };
    } catch (e) {
      // Surface min-balance check after-the-fact for clearer UX.
      const msg = (e as Error).message ?? String(e);
      if (/insufficient/i.test(msg)) {
        throw new Error(
          `Need ≈${lamportsToSol(totalNeeded).toFixed(4)} SOL in your wallet ` +
            `(${amount} SOL + ${lamportsToSol(totalFee).toFixed(4)} SOL fee). ` +
            `Top up at https://faucet.solana.com on devnet.`,
        );
      }
      throw new Error(humanizeError(e));
    }
  }

  /* ── Withdraw (shielded → public) ───────────────────────────────── */

  async withdraw({
    owner,
    amount,
    token,
    to,
    onProgress,
  }: WithdrawParams): Promise<OperationResult> {
    ensureSolToken(token);
    void owner;
    const emit = progressEmitter(onProgress);
    const sdk = await this.getSdk();
    const mod = await loadSdk();
    const connection = this.getConnection();

    const lamports = solToLamports(amount);
    const notes = (await sdk.loadNotes()).filter((n) => mod.isWithdrawable(n));
    const note = notes.find((n) => n.amount >= lamports);
    if (!note) {
      throw new Error("No shielded note big enough to cover this withdrawal.");
    }

    const recipientPk = new PublicKey(to);

    emit("preparing", "Preparing withdrawal…", 0.2);

    try {
      const result = await sdk.withdraw(connection, note, recipientPk, {
        withdrawAll: true,
        onProgress: (status) => {
          emit(mapTransferPhase(String(status)), `Withdrawing… (${status})`, 0.5);
        },
      });
      emit("success", "Withdrawal confirmed.", 1);

      const balance = await this.getShieldedBalance(owner, "SOL");
      return {
        signature: result.signature,
        confirmedAt: Date.now(),
        balanceAfter: balance,
      };
    } catch (e) {
      throw new Error(humanizeError(e));
    }
  }

  /* ── Viewing keys ───────────────────────────────────────────────── */

  async generateViewingKey(
    owner: Address,
    scope: ViewingKey["scope"] = "full",
    label?: string,
  ): Promise<ViewingKey> {
    const ref = `vk_${owner.slice(0, 16)}_${Date.now().toString(36)}`;
    return {
      ref,
      secret: `${owner}:${scope}:${label ?? "default"}`,
      createdAt: Date.now(),
      owner,
      scope,
      label,
    };
  }

  async listViewingKeys(_owner: Address): Promise<ViewingKey[]> {
    return [];
  }

  async revokeViewingKey(_ref: ViewingKeyRef): Promise<void> {
    return;
  }
}

export const cloakSdkService = new CloakSdkService();

/* ─────────────────────────────────────────────── Pure SDK utilities ── */

export const cloakUtils = {
  formatAmount: async (amount: number, decimals: number = SOL_DECIMALS) => {
    const mod = await loadSdk();
    return mod.formatAmount(amount, decimals);
  },
  getExplorerUrl: async (signature: string, cluster: string = "devnet") => {
    const mod = await loadSdk();
    return mod.getExplorerUrl(signature, cluster);
  },
  isValidSolanaAddress: async (addr: string) => {
    const mod = await loadSdk();
    return mod.isValidSolanaAddress(addr);
  },
};

/** Synchronous explorer URL builder — used in render paths. */
export function explorerUrl(signature: string, cluster?: string): string {
  const c = cluster ?? resolveNetwork();
  const param = c === "mainnet" ? "" : `?cluster=${c === "mainnet-beta" ? "mainnet-beta" : c}`;
  return `https://explorer.solana.com/tx/${signature}${param}`;
}
