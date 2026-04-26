/**
 * Wallet façade — unified API used by the rest of the app.
 *
 * Internally backed by @solana/wallet-adapter-react (Phantom, Solflare, …).
 * Exposes the same shape the app already uses:
 *   { publicKey: string | null, connected, connecting, connect(), disconnect() }
 *
 * Connect opens the wallet adapter modal so the user can pick a wallet.
 */

import { useCallback } from "react";
import {
  useWallet as useAdapterWallet,
  type WalletContextState,
} from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export { SolanaWalletProviders as WalletProvider } from "./wallet-providers";

interface WalletState {
  publicKey: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const adapter: WalletContextState = useAdapterWallet();
  const { setVisible } = useWalletModal();

  const connect = useCallback(async () => {
    // If a wallet is already selected, try to connect directly; otherwise open the picker.
    if (adapter.wallet && !adapter.connected) {
      try {
        await adapter.connect();
        return;
      } catch {
        // fall through to modal
      }
    }
    setVisible(true);
  }, [adapter, setVisible]);

  const disconnect = useCallback(() => {
    void adapter.disconnect();
  }, [adapter]);

  return {
    publicKey: adapter.publicKey ? adapter.publicKey.toBase58() : null,
    connected: adapter.connected,
    connecting: adapter.connecting,
    connect,
    disconnect,
  };
}

export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
