import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { linksStore } from "@/lib/storage";
import { useWallet } from "@/lib/wallet";
import { executePrivateTransfer } from "@/lib/cloak";
import type { PaymentLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Lock, Check, Shield, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/pay/$id")({
  head: () => ({
    meta: [
      { title: "Payment request — CloakPay" },
      { name: "description", content: "Pay privately with USDC or USDT on Solana." },
    ],
  }),
  component: PayPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h1 className="font-display text-3xl font-semibold">Link not found</h1>
        <p className="mt-2 text-muted-foreground">
          This payment link doesn't exist or has been removed.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-8">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  ),
});

type Phase = "idle" | "preparing" | "signing" | "confirming" | "success" | "error";

function PayPage() {
  const { id } = Route.useParams();
  const { connected, publicKey, connect, connecting } = useWallet();
  const [link, setLink] = useState<PaymentLink | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setLink(linksStore.get(id) ?? null);
    refresh();
    window.addEventListener("cloak:links-updated", refresh);
    return () => window.removeEventListener("cloak:links-updated", refresh);
  }, [id]);

  if (link === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-6 py-32 text-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (link === null) {
    throw notFound();
  }

  const isPaid = link.status === "paid" || phase === "success";

  const handlePay = async () => {
    if (!connected || !publicKey) {
      await connect();
      return;
    }
    setError(null);
    try {
      setPhase("preparing");
      await new Promise((r) => setTimeout(r, 600));
      setPhase("signing");
      await new Promise((r) => setTimeout(r, 800));
      setPhase("confirming");
      const result = await executePrivateTransfer({
        to: link.stealthAddress,
        amount: link.amount,
        token: link.token,
        payerPubkey: publicKey,
      });
      linksStore.updateStatus(link.id, "paid", result.signature);
      setPhase("success");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-md px-6 py-12 md:py-16">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </Button>

        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-glow blur-3xl opacity-50" />
          <div className="relative overflow-hidden rounded-3xl border border-border-strong bg-gradient-card shadow-lg backdrop-blur-xl">
            {/* Top: amount */}
            <div className="border-b border-border/60 p-8 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                <Lock className="h-3 w-3" />
                Private payment request
              </div>
              <div className="mt-6 flex items-baseline justify-center gap-2">
                <span className="font-display text-6xl font-semibold tracking-tight tabular-nums">
                  {link.amount.toFixed(2)}
                </span>
                <span className="text-xl text-muted-foreground">{link.token}</span>
              </div>
              {link.description && (
                <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
                  {link.description}
                </p>
              )}
            </div>

            {/* Bottom: action */}
            <div className="p-6 md:p-8">
              {isPaid ? (
                <SuccessState link={link} />
              ) : (
                <>
                  <Button
                    onClick={handlePay}
                    variant="hero"
                    size="xl"
                    className="w-full"
                    disabled={connecting || phase === "preparing" || phase === "signing" || phase === "confirming"}
                  >
                    {phase === "idle" && (connected ? "Pay privately" : "Connect wallet to pay")}
                    {phase === "preparing" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                      </>
                    )}
                    {phase === "signing" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating proof…
                      </>
                    )}
                    {phase === "confirming" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirming on Solana…
                      </>
                    )}
                    {phase === "error" && "Try again"}
                    {connecting && "Connecting…"}
                  </Button>

                  {error && (
                    <p className="mt-3 text-center text-xs text-destructive">{error}</p>
                  )}

                  <div className="mt-6 space-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
                    <Row label="Network" value="Solana" />
                    <Row label="Recipient" value="Hidden (stealth)" />
                    <Row label="Amount on-chain" value="Encrypted" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3 w-3 text-primary" />
          Secured by Cloak · Built on Solana
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-mono text-foreground/80">{value}</span>
    </div>
  );
}

function SuccessState({ link }: { link: PaymentLink }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-7 w-7" strokeWidth={2.5} />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold">Payment sent</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your transfer is confirmed on Solana. The recipient sees only what they
        need to.
      </p>
      {link.txSignature && (
        <div className="mt-6 rounded-lg border border-border bg-background/50 p-3 font-mono text-[10px] break-all text-muted-foreground">
          {link.txSignature.slice(0, 32)}…{link.txSignature.slice(-8)}
        </div>
      )}
      <Button asChild variant="ghost" className="mt-6">
        <Link to="/">Done</Link>
      </Button>
    </div>
  );
}
