import { Link, useNavigate } from "@tanstack/react-router";
import { useWallet, shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const { connected, publicKey, connect, connecting, disconnect } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    await connect();
    toast.success("Wallet connected", {
      description: "You're ready to send and receive privately.",
    });
    navigate({ to: "/dashboard" });
  };

  const handleDisconnect = () => {
    disconnect();
    toast("Wallet disconnected");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 group" aria-label="CloakPay home">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            {/* Minimal monogram mark */}
            <span className="font-display text-[13px] font-semibold text-background">C</span>
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
            Cloak<span className="text-muted-foreground">Pay</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {connected && (
            <>
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                activeProps={{ className: "text-foreground bg-secondary" }}
              >
                Dashboard
              </Link>
              <Link
                to="/create"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                activeProps={{ className: "text-foreground bg-secondary" }}
              >
                New link
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning-foreground">
            <span className="h-1 w-1 rounded-full bg-warning animate-pulse-glow" />
            Devnet
          </span>
          {connected && publicKey ? (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-mono text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {shortAddress(publicKey)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDisconnect}
                aria-label="Disconnect wallet"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={connecting} variant="hero" size="sm">
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
