/**
 * Mock Cloak service.
 *
 * Implements the full `CloakService` contract using simulated cryptography
 * and localStorage persistence. Behavior matches what we expect from the
 * real Cloak SDK so that the UI works identically when you swap it in.
 *
 * To wire the real SDK:
 *   1. Create `RealCloakService` implementing `CloakService`
 *   2. Inside, instantiate the Cloak client with the user's wallet
 *   3. Map each method to the appropriate SDK call
 *   4. Export it from `./service.ts` (or pick via env flag)
 *
 * Method-by-method porting notes are inline at each implementation.
 */

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

/* ─────────────────────────────────────────────────────── Helpers ── */

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

function rand(alphabet: string, length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

const fakeBase58 = (len = 44) => rand(BASE58, len);
const fakeHex = (len = 64) => rand(HEX, len);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ───────────────────────────────────────────────────── Storage layer ── */
/* Isolated so swapping persistence (e.g. IndexedDB, backend) is one change */

const STORAGE = {
  balances: "cloak.shielded_balances.v1",
  notes: "cloak.notes.v1",
  viewingKeys: "cloak.viewing_keys.v1",
};

interface BalanceMap {
  [ownerAndToken: string]: ShieldedBalance;
}

function balKey(owner: Address, token: TokenSymbol) {
  return `${owner}:${token}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("cloak:state-updated"));
}

function loadBalance(owner: Address, token: TokenSymbol): ShieldedBalance {
  const map = readJSON<BalanceMap>(STORAGE.balances, {});
  return (
    map[balKey(owner, token)] ?? {
      token,
      available: 0,
      pending: 0,
      noteCount: 0,
    }
  );
}

function saveBalance(owner: Address, balance: ShieldedBalance) {
  const map = readJSON<BalanceMap>(STORAGE.balances, {});
  map[balKey(owner, balance.token)] = balance;
  writeJSON(STORAGE.balances, map);
}

/* ──────────────────────────────────────────────── Progress helper ── */

function progressEmitter(onProgress?: (p: OperationProgress) => void) {
  return (phase: OperationProgress["phase"], message: string, progress: number) => {
    onProgress?.({ phase, message, progress });
  };
}

/* ────────────────────────────────────────────── Service implementation ── */

class MockCloakService implements CloakService {
  /* ── Stealth addresses ──────────────────────────────────────────── */

  /**
   * Derives a one-time stealth address for `recipient`.
   *
   * REAL CLOAK: use the recipient's published meta-address + a fresh
   * ephemeral key to derive a stealth address only the recipient can detect
   * with their viewing key. Returns `(stealthAddress, ephemeralPubkey)`.
   */
  async deriveStealthAddress(recipient: Address): Promise<StealthAddress> {
    void recipient;
    await sleep(50);
    return {
      address: fakeBase58(44),
      viewingKeyRef: `vk_${fakeHex(32)}`,
      ephemeralPubkey: fakeBase58(44),
    };
  }

  /* ── Shielded balance & notes ───────────────────────────────────── */

  async getShieldedBalance(owner: Address, token: TokenSymbol): Promise<ShieldedBalance> {
    return loadBalance(owner, token);
  }

  /**
   * REAL CLOAK: scan the on-chain Merkle tree of commitments, attempt to
   * decrypt each note with `viewingKey.secret`, return successes.
   */
  async listNotes(owner: Address, viewingKey: ViewingKey): Promise<ShieldedNote[]> {
    void viewingKey;
    return readJSON<ShieldedNote[]>(STORAGE.notes, []).filter(
      (n) => n.stealthAddress && !n.spent && n.id.startsWith(owner.slice(0, 4)),
    );
  }

  /* ── Deposit (public → shielded) ────────────────────────────────── */

  /**
   * REAL CLOAK: build a deposit instruction that locks `amount` of `token`
   * in the shielded pool program and creates a commitment owned by the
   * caller. No ZK proof needed for deposit — just an SPL token transfer
   * + commitment insertion.
   */
  async deposit({ payer, amount, token, onProgress }: DepositParams): Promise<OperationResult> {
    const emit = progressEmitter(onProgress);

    emit("preparing", "Preparing deposit instruction…", 0.2);
    await sleep(500);

    emit("submitting", "Sending to Solana…", 0.6);
    await sleep(700);

    emit("confirming", "Confirming on Solana…", 0.85);
    await sleep(600);

    // Update local shielded balance
    const balance = loadBalance(payer, token);
    const updated: ShieldedBalance = {
      ...balance,
      available: balance.available + amount,
      noteCount: balance.noteCount + 1,
    };
    saveBalance(payer, updated);

    emit("success", "Deposited successfully.", 1);

    return {
      signature: fakeBase58(88),
      confirmedAt: Date.now(),
      balanceAfter: updated,
    };
  }

  /* ── Private send (shielded → stealth) ──────────────────────────── */

  /**
   * REAL CLOAK: build a transfer with a ZK proof that
   *   (a) inputs are valid unspent notes the sender owns,
   *   (b) inputs ≥ outputs + fee,
   *   (c) outputs are valid commitments to the stealth recipient,
   * then submit it. Amounts and recipient stay encrypted on-chain.
   *
   * The `autoDeposit` flag handles the common UX: payer has public USDC
   * but nothing in the shielded pool. We deposit just-in-time and then
   * send, behind a single user confirmation.
   */
  async privateSend(params: PrivateSendParams): Promise<OperationResult> {
    const { payer, to, amount, token, memo, autoDeposit, onProgress } = params;
    const emit = progressEmitter(onProgress);

    let balance = loadBalance(payer, token);

    // Just-in-time deposit if needed (UX: payer doesn't think in "shielded balance")
    if (balance.available < amount) {
      if (!autoDeposit) {
        throw new Error(
          `Insufficient shielded balance. Have ${balance.available} ${token}, need ${amount}.`,
        );
      }
      emit("preparing", "Topping up shielded balance…", 0.1);
      await this.deposit({
        payer,
        amount: amount - balance.available,
        token,
        // suppress nested progress reporting
      });
      balance = loadBalance(payer, token);
    }

    emit("preparing", "Building shielded transfer…", 0.3);
    await sleep(500);

    emit("proving", "Generating zero-knowledge proof…", 0.55);
    await sleep(900);

    emit("submitting", "Submitting to Solana…", 0.8);
    await sleep(500);

    emit("confirming", "Confirming on Solana…", 0.92);
    await sleep(400);

    // Spend from sender's shielded balance
    const updated: ShieldedBalance = {
      ...balance,
      available: balance.available - amount,
      noteCount: Math.max(0, balance.noteCount - 1),
    };
    saveBalance(payer, updated);

    // Append a note destined to the recipient (decryptable with their viewing key)
    const notes = readJSON<ShieldedNote[]>(STORAGE.notes, []);
    notes.push({
      // Note IDs are prefixed with first 4 chars of the recipient's
      // *stealth viewing key ref* so listNotes can simulate decryption.
      // In real Cloak, the SDK decides ownership cryptographically.
      id: `${to.viewingKeyRef.slice(3, 7)}_${fakeHex(16)}`,
      token,
      amount,
      confirmedAt: Date.now(),
      spent: false,
      memo,
      stealthAddress: to.address,
    });
    writeJSON(STORAGE.notes, notes);

    emit("success", "Payment sent privately.", 1);

    return {
      signature: fakeBase58(88),
      confirmedAt: Date.now(),
      balanceAfter: updated,
    };
  }

  /* ── Withdraw (shielded → public) ───────────────────────────────── */

  /**
   * REAL CLOAK: similar to privateSend but the output is a public SPL
   * transfer to `to`. Requires a ZK proof that the input note is valid
   * and unspent. Useful for cashing out to a CEX or hot wallet.
   */
  async withdraw({ owner, amount, token, to, onProgress }: WithdrawParams): Promise<OperationResult> {
    void to;
    const emit = progressEmitter(onProgress);

    const balance = loadBalance(owner, token);
    if (balance.available < amount) {
      throw new Error(`Insufficient shielded balance to withdraw ${amount} ${token}.`);
    }

    emit("preparing", "Preparing withdrawal…", 0.2);
    await sleep(500);

    emit("proving", "Generating proof…", 0.55);
    await sleep(800);

    emit("submitting", "Submitting to Solana…", 0.8);
    await sleep(500);

    emit("confirming", "Confirming on Solana…", 0.92);
    await sleep(400);

    const updated: ShieldedBalance = {
      ...balance,
      available: balance.available - amount,
      noteCount: Math.max(0, balance.noteCount - 1),
    };
    saveBalance(owner, updated);

    emit("success", "Withdrawal confirmed.", 1);

    return {
      signature: fakeBase58(88),
      confirmedAt: Date.now(),
      balanceAfter: updated,
    };
  }

  /* ── Viewing keys ───────────────────────────────────────────────── */

  /**
   * REAL CLOAK: derive a viewing key from the wallet's secret key + a
   * deterministic salt (or generate a fresh one and encrypt-store it).
   * `scope='incoming'` is a key that decrypts only inbound notes — safe
   * to share with an accountant. `scope='full'` also reveals outbound.
   */
  async generateViewingKey(
    owner: Address,
    scope: ViewingKey["scope"] = "full",
    label?: string,
  ): Promise<ViewingKey> {
    const key: ViewingKey = {
      ref: `vk_${fakeHex(16)}`,
      secret: fakeHex(64),
      createdAt: Date.now(),
      owner,
      scope,
      label,
    };
    const all = readJSON<ViewingKey[]>(STORAGE.viewingKeys, []);
    all.push(key);
    writeJSON(STORAGE.viewingKeys, all);
    return key;
  }

  async listViewingKeys(owner: Address): Promise<ViewingKey[]> {
    return readJSON<ViewingKey[]>(STORAGE.viewingKeys, []).filter((k) => k.owner === owner);
  }

  async revokeViewingKey(ref: ViewingKeyRef): Promise<void> {
    const all = readJSON<ViewingKey[]>(STORAGE.viewingKeys, []);
    writeJSON(
      STORAGE.viewingKeys,
      all.filter((k) => k.ref !== ref),
    );
  }
}

export const mockCloakService: CloakService = new MockCloakService();
