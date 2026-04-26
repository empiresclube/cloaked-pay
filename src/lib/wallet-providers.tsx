/**
 * Solana wallet providers (real integration).
 *
 * Wraps the app with @solana/wallet-adapter providers so Phantom / Solflare
 * (and any browser wallet that implements the Wallet Standard) can connect.
 *
 * Network and RPC endpoint are configured via Vite env vars:
 *   VITE_SOLANA_NETWORK   = "devnet" | "testnet" | "mainnet-beta"   (default: devnet)
 *   VITE_SOLANA_RPC_URL   = optional custom RPC                     (default: clusterApiUrl)
 */

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

function resolveEndpoint(): string {
  const custom = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;
  if (custom && custom.length > 0) return custom;
  const network = (import.meta.env.VITE_SOLANA_NETWORK as Cluster | undefined) ?? "devnet";
  return clusterApiUrl(network);
}

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(resolveEndpoint, []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
