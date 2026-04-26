/**
 * Mock Solana wallet context.
 * Real integration: wrap with @solana/wallet-adapter-react and replace
 * the connect() implementation with wallet.connect() from the chosen adapter.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

const STORAGE_KEY = "cloak_wallet_pubkey";

function fakePubkey(): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const arr = new Uint8Array(44);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < 44; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setPublicKey(saved);
  }, []);

  const connect = async () => {
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 600));
    const key = fakePubkey();
    window.localStorage.setItem(STORAGE_KEY, key);
    setPublicKey(key);
    setConnecting(false);
  };

  const disconnect = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPublicKey(null);
  };

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        connected: !!publicKey,
        connecting,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
