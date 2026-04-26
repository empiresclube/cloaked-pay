import { Link, useNavigate } from "@tanstack/react-router";
import { useWallet, shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";

export function Header() {
  const { connected, publicKey, connect, connecting, disconnect } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    await connect();
    navigate({ to: "/dashboard" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <Shield className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Cloak<span className="text-primary">Pay</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {connected && (
            <>
              <Link
                to="/dashboard"
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Dashboard
              </Link>
              <Link
                to="/create"
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                New link
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {connected && publicKey ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
                {shortAddress(publicKey)}
              </div>
              <Button variant="ghost" size="icon" onClick={disconnect} aria-label="Disconnect">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
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
