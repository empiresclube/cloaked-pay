/**
 * Real Cloak SDK service — devnet (UTXO API).
 *
 * Implements `CloakService` using the **low-level UTXO API** of
 * `@cloak.dev/sdk-devnet` (`transact` + `createUtxo` + `fullWithdraw`).
 *
 * Why not the high-level `CloakSDK` class?
 *   The legacy `CloakSDK.deposit()` / `.privateTransfer()` methods build a
 *   4-account deposit instruction that the deployed devnet program
 *   (`Zc1k…27h`) rejects with "Missing required accounts" (0x1063).
 *   The devnet program expects the new UTXO transaction layout, which is
 *   what `transact()` produces. See https://docs.cloak.ag/development/devnet.
 *
 * One UTXO per payment link:
 *   When a merchant creates a link, the UI generates a UTXO keypair and
 *   keeps the private key in localStorage. The link carries only the
 *   public key. When a payer pays, we deposit straight into that UTXO via
 *   `transact({ outputUtxos: [merchantUtxo], externalAmount: amount })` —
 *   no intermediate "shielded balance" on the payer side. Later the
 *   merchant withdraws to a regular wallet via `fullWithdraw`.
 *
 * SOL only on devnet.
 */

import type {
  Network,
  Utxo,
  UtxoKeypair,
  WalletAdapter,
} from "@cloak.dev/sdk-devnet";
import { Connection, PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";

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

type CloakSdkModule = typeof import("@cloak.dev/sdk-devnet");
let sdkModulePromise: Promise<CloakSdkModule> | null = null;

async function loadSdk(): Promise<CloakSdkModule> {
  if (!sdkModulePromise) {
    await import("./buffer-polyfill");
    sdkModulePromise = import("@cloak.dev/sdk-devnet");
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

function resolveRelayUrl(): string {
  const custom = import.meta.env.VITE_CLOAK_RELAY_URL as string | undefined;
  if (custom && custom.length > 0) return custom;
  return "https://api.devnet.cloak.ag";
}

/* ──────────────────────────────────────────────────── Helpers ── */

const SOL_DECIMALS = 9;

function solToLamports(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000_000));
}

function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / 1_000_000_000;
}

function ensureSolToken(token: TokenSymbol) {
  if (token !== "SOL") {
    throw new Error(
      `${token} private transfers are not supported on devnet. Switch this link to SOL.`,
    );
  }
}

function progressEmitter(onProgress?: (p: OperationProgress) => void) {
  return (phase: OperationProgress["phase"], message: string, progress: number) => {
    onProgress?.({ phase, message, progress });
  };
}

/** Map relay/sdk progress strings to our internal phases. */
function mapPhase(status: string): OperationProgress["phase"] {
  const s = status.toLowerCase();
  if (s.includes("proof") || s.includes("proving") || s.includes("generating"))
    return "proving";
  if (s.includes("submit") || s.includes("relay") || s.includes("send"))
    return "submitting";
  if (s.includes("confirm") || s.includes("waiting")) return "confirming";
  if (s.includes("complete") || s.includes("success")) return "success";
  return "preparing";
}

/** Extract the deepest, most informative message from a thrown error. */
function extractMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  const err = e as {
    message?: string;
    error?: unknown;
    cause?: unknown;
    originalError?: unknown;
    relayMessage?: string;
    logs?: string[];
    category?: string;
    name?: string;
  };
  const parts: string[] = [];
  if (err.name && err.name !== "Error") parts.push(err.name);
  if (err.category) parts.push(`[${err.category}]`);
  if (err.message) parts.push(err.message);
  if (err.relayMessage) parts.push(`relay: ${err.relayMessage}`);
  if (err.logs?.length) parts.push(`logs: ${err.logs.slice(-2).join(" | ")}`);
  const inner =
    (err.originalError ? extractMessage(err.originalError) : "") ||
    (err.cause ? extractMessage(err.cause) : "") ||
    (err.error ? extractMessage(err.error) : "");
  if (inner && !parts.join(" ").includes(inner)) parts.push(`→ ${inner}`);
  const out = parts.filter(Boolean).join(" ").trim();
  return out || JSON.stringify(e);
}

/** Friendly mapping for the most common Cloak/Solana errors. */
function humanizeError(e: unknown): string {
  // eslint-disable-next-line no-console
  console.error("[CloakPay] Operation failed:", e);
  if (!e) return "Unknown error.";
  const msg = extractMessage(e);
  if (!msg) return "Unknown error (see console for details).";
  if (/0x1063|missing required accounts/i.test(msg)) {
    return "Cloak devnet SDK out of sync with the deployed program. Update @cloak.dev/sdk-devnet and retry.";
  }
  if (/0x1001|RootNotFound|root not found/i.test(msg)) {
    return "Merkle root moved while we were preparing the transaction. Try again.";
  }
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
  if (/relay|indexer|fetch/i.test(msg)) {
    return `Cloak relay/indexer unavailable on this network. ${msg}`;
  }
  return msg;
}

/* ─────────────────────────────── Deterministic blinding per link ── */

/** Field modulus used by Cloak's UTXO commitments (BN254 scalar field). */
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Derive a deterministic blinding (bigint) from any string seed. */
async function deterministicBlinding(seed: string): Promise<bigint> {
  const enc = new TextEncoder().encode(`cloakpay:blinding:${seed}`);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hash);
  let value = 0n;
  for (let i = 0; i < 32; i++) value = (value << 8n) | BigInt(bytes[i]);
  return value % FIELD_MODULUS;
}

/* ─────────────────────────────────────────── Service implementation ── */

class CloakSdkService implements CloakService {
  private wallet: WalletAdapter | null = null;
  private signMessage:
    | ((message: Uint8Array) => Promise<Uint8Array>)
    | null = null;
  private connection: Connection | null = null;

  /** Called by the React provider every time the wallet adapter changes. */
  setWallet(wallet: WalletAdapter | null) {
    this.wallet = wallet;
  }

  setSignMessage(fn: ((message: Uint8Array) => Promise<Uint8Array>) | null) {
    this.signMessage = fn;
  }

  /** Lazy-initialize the connection (RPC). */
  private getConnection(): Connection {
    if (!this.connection) {
      this.connection = new Connection(resolveRpcUrl(), "confirmed");
    }
    return this.connection;
  }

  private requireWallet(): WalletAdapter & { publicKey: PublicKey } {
    if (!this.wallet || !this.wallet.publicKey) {
      throw new Error("Connect your wallet first.");
    }
    return this.wallet as WalletAdapter & { publicKey: PublicKey };
  }

  /* ── Stealth addresses ──────────────────────────────────────────── */

  /**
   * On devnet the on-chain destination of a private payment is the merchant's
   * **own Solana wallet** (used as the depositor for the shielded pool entry).
   * The actual privacy primitive — the recipient UTXO inside the pool — is
   * created at link-time in the UI (`generateUtxoKeypair`) and embedded into
   * the link as a hex pubkey.
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

  /* ── Shielded balance & notes (no-op on devnet UTXO model) ──────── */

  async getShieldedBalance(
    _owner: Address,
    token: TokenSymbol,
  ): Promise<ShieldedBalance> {
    return { token, available: 0, pending: 0, noteCount: 0 };
  }

  async listNotes(
    _owner: Address,
    _viewingKey: ViewingKey,
  ): Promise<ShieldedNote[]> {
    return [];
  }

  /* ── Deposit (kept for API completeness — not used by the link flow) ── */

  async deposit({
    payer,
    amount,
    token,
    onProgress,
  }: DepositParams): Promise<OperationResult> {
    ensureSolToken(token);
    void payer;
    onProgress?.({
      phase: "error",
      message: "Direct deposits aren't used by CloakPay — use a payment link.",
      progress: 1,
    });
    throw new Error(
      `Use a payment link to deposit ${amount} ${token} privately.`,
    );
  }

  /* ── Private send (one-shot deposit into the merchant's UTXO) ───── */

  async privateSend(params: PrivateSendParams): Promise<OperationResult> {
    const { to, amount, token, merchantUtxoPubkeyHex, onProgress } = params;
    ensureSolToken(token);

    const wallet = this.requireWallet();
    if (!merchantUtxoPubkeyHex) {
      throw new Error(
        "Payment link is missing the merchant UTXO pubkey. Ask the merchant to recreate the link.",
      );
    }

    const emit = progressEmitter(onProgress);
    const mod = await loadSdk();
    const connection = this.getConnection();

    // Validate recipient as Solana address (used as deposit-source identity).
    try {
      // eslint-disable-next-line no-new
      new PublicKey(to.address);
    } catch {
      throw new Error(`Recipient ${to.address} is not a valid Solana address.`);
    }

    const lamports = solToLamports(amount);
    if (lamports < BigInt(mod.MIN_DEPOSIT_LAMPORTS)) {
      throw new Error(
        `Minimum amount is ${lamportsToSol(mod.MIN_DEPOSIT_LAMPORTS)} SOL on Cloak (devnet).`,
      );
    }

    emit("preparing", "Preparing private deposit…", 0.1);

    try {
      // 1. Reconstruct the merchant's UTXO public key from the link.
      const merchantPubKey = mod.hexToBigint(merchantUtxoPubkeyHex);
      // We don't know the merchant's UTXO private key (and shouldn't) — but
      // `transact` only needs the *public* limb to build the output commitment.
      // We pass privateKey = 0n; this UTXO can't be spent until the merchant
      // reconstructs the keypair on their side using the saved private key.
      const merchantKeypair: UtxoKeypair = {
        privateKey: 0n,
        publicKey: merchantPubKey,
      };

      // Deterministic blinding so the merchant can rebuild the same UTXO.
      const linkSeed = `${merchantUtxoPubkeyHex}:${lamports.toString()}`;
      const blinding = await deterministicBlinding(linkSeed);

      // 2. Build the deposit output UTXO (manual so we can pin the blinding).
      const outputUtxo: Utxo = {
        amount: lamports,
        keypair: merchantKeypair,
        blinding,
        mintAddress: mod.NATIVE_SOL_MINT,
      };
      outputUtxo.commitment = await mod.computeUtxoCommitment(outputUtxo);

      // 3. Padding zero UTXO required by the circuit.
      const zeroUtxo = await mod.createZeroUtxo(mod.NATIVE_SOL_MINT);

      emit("preparing", "Awaiting wallet signature…", 0.2);

      // 4. Submit through the relay — `transact` builds the proof and ix.
      const signTx = wallet.signTransaction
        ? <T extends Transaction | VersionedTransaction>(tx: T) =>
            wallet.signTransaction!(tx as never) as Promise<T>
        : undefined;

      const result = await mod.transact(
        {
          inputUtxos: [zeroUtxo],
          outputUtxos: [outputUtxo],
          externalAmount: lamports,
          depositor: wallet.publicKey,
        },
        {
          connection,
          programId: mod.CLOAK_PROGRAM_ID,
          relayUrl: resolveRelayUrl(),
          signTransaction: signTx,
          signMessage: this.signMessage ?? undefined,
          depositorPublicKey: wallet.publicKey,
          walletPublicKey: wallet.publicKey,
          enforceViewingKeyRegistration: false,
          onProgress: (status: string) => {
            emit(mapPhase(String(status)), `Cloak: ${status}`, 0.5);
          },
          onProofProgress: (pct: number) => {
            emit("proving", `Generating zero-knowledge proof… ${pct}%`, 0.3 + pct / 200);
          },
        },
      );

      emit("success", "Payment confirmed on Solana devnet.", 1);

      const leafIndex = result.commitmentIndices?.[0] ?? 0;

      return {
        signature: result.signature,
        confirmedAt: Date.now(),
        depositLeafIndex: leafIndex,
        depositBlindingHex: mod.bigintToHex(blinding),
        depositLamports: Number(lamports),
        balanceAfter: { token: "SOL", available: 0, pending: 0, noteCount: 0 },
      };
    } catch (e) {
      throw new Error(humanizeError(e));
    }
  }

  /* ── Withdraw (shielded merchant UTXO → public wallet) ──────────── */

  async withdraw({
    owner,
    amount,
    token,
    to,
    merchantUtxoPrivateKeyHex,
    depositLamports,
    onProgress,
  }: WithdrawParams & {
    merchantUtxoPrivateKeyHex?: string;
    depositLamports?: number;
    depositLeafIndex?: number;
    depositBlindingHex?: string;
  }): Promise<OperationResult> {
    ensureSolToken(token);
    void owner;
    void amount;

    const wallet = this.requireWallet();
    const emit = progressEmitter(onProgress);
    const mod = await loadSdk();
    const connection = this.getConnection();

    if (!merchantUtxoPrivateKeyHex) {
      throw new Error(
        "Missing merchant UTXO private key for this link. It only exists on the device that created the link.",
      );
    }

    const extra = arguments[0] as {
      depositLeafIndex?: number;
      depositBlindingHex?: string;
    };
    const leafIndex = extra.depositLeafIndex;
    const blindingHex = extra.depositBlindingHex;
    if (leafIndex === undefined || blindingHex === undefined || depositLamports === undefined) {
      throw new Error(
        "This link doesn't have a recorded deposit yet — wait for the payer to complete the transfer.",
      );
    }

    try {
      // 1. Rebuild the merchant UTXO from the link metadata.
      const privateKey = mod.hexToBigint(merchantUtxoPrivateKeyHex);
      const publicKey = await mod.derivePublicKey(privateKey);
      const blinding = mod.hexToBigint(blindingHex);
      const lamports = BigInt(depositLamports);

      const inputUtxo: Utxo = {
        amount: lamports,
        keypair: { privateKey, publicKey },
        blinding,
        mintAddress: mod.NATIVE_SOL_MINT,
        index: leafIndex,
      };
      inputUtxo.commitment = await mod.computeUtxoCommitment(inputUtxo);

      const recipientPk = new PublicKey(to);

      emit("preparing", "Preparing withdrawal…", 0.2);

      const signTx = wallet.signTransaction
        ? <T extends Transaction | VersionedTransaction>(tx: T) =>
            wallet.signTransaction!(tx as never) as Promise<T>
        : undefined;

      const result = await mod.fullWithdraw([inputUtxo], recipientPk, {
        connection,
        programId: mod.CLOAK_PROGRAM_ID,
        relayUrl: resolveRelayUrl(),
        signTransaction: signTx,
        signMessage: this.signMessage ?? undefined,
        depositorPublicKey: wallet.publicKey,
        walletPublicKey: wallet.publicKey,
        enforceViewingKeyRegistration: false,
        onProgress: (status: string) => {
          emit(mapPhase(String(status)), `Cloak: ${status}`, 0.5);
        },
        onProofProgress: (pct: number) => {
          emit("proving", `Generating withdraw proof… ${pct}%`, 0.3 + pct / 200);
        },
      });

      emit("success", "Withdrawal confirmed.", 1);

      return {
        signature: result.signature,
        confirmedAt: Date.now(),
        balanceAfter: { token: "SOL", available: 0, pending: 0, noteCount: 0 },
      };
    } catch (e) {
      throw new Error(humanizeError(e));
    }
  }

  /* ── Viewing keys (placeholder — UI-only) ──────────────────────── */

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

  /* ── Helpers exposed to the UI for link creation ──────────────── */

  /** Generate a fresh UTXO keypair for a new payment link. */
  async generateMerchantUtxoKeypair(): Promise<{
    privateKeyHex: string;
    publicKeyHex: string;
  }> {
    const mod = await loadSdk();
    const kp = await mod.generateUtxoKeypair();
    return {
      privateKeyHex: mod.bigintToHex(kp.privateKey),
      publicKeyHex: mod.bigintToHex(kp.publicKey),
    };
  }
}

export const cloakSdkService = new CloakSdkService();

/* ─────────────────────────────────────────────── Pure SDK utilities ── */

export const cloakUtils = {
  formatAmount: async (amount: number, decimals: number = SOL_DECIMALS) => {
    const mod = await loadSdk();
    return mod.formatAmount(amount, decimals);
  },
  getExplorerUrl: async (signature: string, cluster: Network = "devnet") => {
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
