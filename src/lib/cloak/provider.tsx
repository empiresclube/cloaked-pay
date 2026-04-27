/**
 * React integration for the Cloak service.
 *
 * Wraps the imperative `CloakService` in idiomatic React hooks:
 *   - `useCloak()` returns the singleton service + helpers
 *   - `useShieldedBalance(token)` reactive shielded balance for current wallet
 *   - `usePrivateSend()` stateful hook with progress for one-click pay UX
 *
 * Also injects the connected `@solana/wallet-adapter-react` adapter into the
 * `CloakSdkService` singleton whenever the wallet changes, so all SDK calls
 * use the user's real signing keys.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";
import { getCloakService } from "./service";
import { cloakSdkService } from "./sdk-service";
import type {
  CloakService,
  OperationProgress,
  PrivateSendParams,
  ShieldedBalance,
  StealthAddress,
} from "./types";
import type { TokenSymbol } from "../types";
import { useWallet } from "../wallet";

interface CloakContextValue {
  service: CloakService;
}

const CloakContext = createContext<CloakContextValue | null>(null);

export function CloakProvider({ children }: { children: ReactNode }) {
  const adapter = useAdapterWallet();
  const service = getCloakService();

  // Push the wallet adapter down into the SDK whenever it changes.
  useEffect(() => {
    if (adapter.connected && adapter.publicKey && adapter.signTransaction) {
      cloakSdkService.setWallet({
        publicKey: adapter.publicKey,
        signTransaction: adapter.signTransaction.bind(adapter) as never,
        signAllTransactions: adapter.signAllTransactions?.bind(adapter) as never,
        sendTransaction: adapter.sendTransaction.bind(adapter) as never,
      });
      cloakSdkService.setSignMessage(
        adapter.signMessage ? adapter.signMessage.bind(adapter) : null,
      );
    } else {
      cloakSdkService.setWallet(null);
      cloakSdkService.setSignMessage(null);
    }
  }, [adapter.connected, adapter.publicKey, adapter.signTransaction, adapter.sendTransaction, adapter.signAllTransactions, adapter.signMessage, adapter]);

  return <CloakContext.Provider value={{ service }}>{children}</CloakContext.Provider>;
}

export function useCloak(): CloakContextValue {
  const ctx = useContext(CloakContext);
  if (!ctx) throw new Error("useCloak must be used inside <CloakProvider>");
  return ctx;
}

/* ────────────────────────────────────────── Reactive shielded balance ── */

export function useShieldedBalance(token: TokenSymbol): {
  balance: ShieldedBalance | null;
  refresh: () => void;
} {
  const { service } = useCloak();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<ShieldedBalance | null>(null);

  const refresh = useCallback(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    service.getShieldedBalance(publicKey, token).then(setBalance).catch(() => {
      setBalance({ token, available: 0, pending: 0, noteCount: 0 });
    });
  }, [service, publicKey, token]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("cloak:state-updated", handler);
    return () => window.removeEventListener("cloak:state-updated", handler);
  }, [refresh]);

  return { balance, refresh };
}

/* ────────────────────────────────────────────── Private send hook ── */

interface PrivateSendState {
  progress: OperationProgress | null;
  isLoading: boolean;
  error: string | null;
  signature: string | null;
}

const INITIAL: PrivateSendState = {
  progress: null,
  isLoading: false,
  error: null,
  signature: null,
};

export function usePrivateSend() {
  const { service } = useCloak();
  const [state, setState] = useState<PrivateSendState>(INITIAL);

  const send = useCallback(
    async (params: Omit<PrivateSendParams, "onProgress">): Promise<string | null> => {
      setState({ ...INITIAL, isLoading: true });
      try {
        const result = await service.privateSend({
          ...params,
          onProgress: (p) => setState((s) => ({ ...s, progress: p })),
        });
        setState({
          progress: { phase: "success", message: "Payment sent privately.", progress: 1 },
          isLoading: false,
          error: null,
          signature: result.signature,
        });
        return result.signature;
      } catch (e) {
        const msg = (e as Error).message ?? "Unknown error";
        setState({
          progress: { phase: "error", message: msg, progress: 1 },
          isLoading: false,
          error: msg,
          signature: null,
        });
        return null;
      }
    },
    [service],
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, send, reset };
}

/* ────────────────────────────────────────────── Helper for routes ── */

export async function deriveStealthAddressFor(recipient: string): Promise<StealthAddress> {
  return getCloakService().deriveStealthAddress(recipient);
}
