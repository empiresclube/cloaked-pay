import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { linksStore } from "@/lib/storage";
import { useWallet, shortAddress } from "@/lib/wallet";
import { executePrivateTransfer } from "@/lib/cloak";
import type { PaymentLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Check,
  Shield,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Zap,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$id")({
  head: () => ({
    meta: [
      { title: "Payment request — CloakPay" },
      {
        name: "description",
        content: "Pay privately with USDC or USDT on Solana. Encrypted on-chain.",
      },
    ],
  }),
  component: PayPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Link not found</h1>
        <p className="mt-2 text-muted-foreground">
          This payment request doesn't exist, was deleted, or the URL is incorrect.
        </p>
        <Button asChild variant="hero" size="lg" className="mt-8">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  ),
});

type Phase = "idle" | "preparing" | "signing" | "confirming" | "success" | "error";

const PHASE_COPY: Record<Exclude<Phase, "idle" | "success" | "error">, { label: string; sub: string }> = {
  preparing: { label: "Preparing transfer", sub: "Building the encrypted instruction…" },
  signing: { label: "Generating zero-knowledge proof", sub: "This keeps the amount hidden." },
  confirming: { label: "Confirming on Solana", sub: "Usually under a second." },
};

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
        <div className="mx-auto flex max-w-md items-center justify-center px-6 py-32 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading payment request…
        </div>
      </div>
    );
  }
  if (link === null) throw notFound();

  const isPaid = link.status === "paid" || phase === "success";
  const isProcessing = phase === "preparing" || phase === "signing" || phase === "confirming";

  const handlePay = async () => {
    if (!connected || !publicKey) {
      await connect();
      toast.success("Wallet connected", { description: "You can now complete the payment." });
      return;
    }
    setError(null);
    const t = toast.loading("Preparing private transfer…");
    try {
      setPhase("preparing");
      await new Promise((r) => setTimeout(r, 700));
      setPhase("signing");
      toast.loading("Generating zero-knowledge proof…", { id: t });
      await new Promise((r) => setTimeout(r, 900));
      setPhase("confirming");
      toast.loading("Confirming on Solana…", { id: t });
      const result = await executePrivateTransfer({
        to: link.stealthAddress,
        amount: link.amount,
        token: link.token,
        payerPubkey: publicKey,
      });
      linksStore.updateStatus(link.id, "paid", result.signature);
      setPhase("success");
      toast.success("Payment sent privately", {
        id: t,
        description: `${link.amount.toFixed(2)} ${link.token} confirmed on Solana.`,
      });
    } catch (e) {
      const msg = (e as Error).message || "Something went wrong.";
      setError(msg);
      setPhase("error");
      toast.error("Payment failed", { id: t, description: msg });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-md px-6 py-10 md:py-14">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </Button>

        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-glow blur-3xl opacity-40" />
          <div className="relative overflow-hidden rounded-3xl border border-border-strong bg-gradient-card shadow-lg backdrop-blur-xl">
            {/* Trust ribbon */}
            <div className="flex items-center justify-between border-b border-border/60 bg-background/30 px-5 py-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3 w-3 text-success" />
                Verified · cloakpay.app
              </div>
              <div className="flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
                Solana mainnet
              </div>
            </div>

            {/* Amount */}
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Lock className="h-3 w-3" />
                Encrypted payment
              </div>
              <div className="mt-6 flex items-baseline justify-center gap-2">
                <span className="font-display text-6xl font-semibold tracking-tight tabular-nums">
                  {link.amount.toFixed(2)}
                </span>
                <span className="text-xl text-muted-foreground">{link.token}</span>
              </div>
              {link.description ? (
                <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
                  {link.description}
                </p>
              ) : (
                <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
                  Payment request
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Requested{" "}
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                  new Date(link.createdAt),
                )}
              </p>
            </div>

            {/* Action area */}
            <div className="border-t border-border/60 px-6 py-6 md:px-8">
              {isPaid ? (
                <SuccessState link={link} />
              ) : (
                <>
                  {isProcessing && <ProcessingState phase={phase} />}

                  {!isProcessing && phase === "error" && (
                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Transfer failed</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {error || "Please try again."}
                        </p>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handlePay}
                    variant="hero"
                    size="xl"
                    className="w-full"
                    disabled={connecting || isProcessing}
                  >
                    {connecting && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Connecting wallet…
                      </>
                    )}
                    {!connecting && phase === "idle" && (connected ? `Pay ${link.amount.toFixed(2)} ${link.token}` : "Connect wallet to pay")}
                    {!connecting && phase === "preparing" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                      </>
                    )}
                    {!connecting && phase === "signing" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Signing…
                      </>
                    )}
                    {!connecting && phase === "confirming" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
                      </>
                    )}
                    {!connecting && phase === "error" && "Try again"}
                  </Button>

                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    By continuing, you authorize a private transfer from your wallet.
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs">
                    <Row label="Network" value="Solana" />
                    <Row label="Network fee" value="≈ $0.00025" hint="Paid in SOL" />
                    <Row label="Recipient" value="Stealth address" hint="Hidden" />
                    <Row label="Amount visibility" value="Encrypted" hint="Cloak ZK" />
                  </div>
                </>
              )}
            </div>

            {/* Trust footer */}
            <div className="grid grid-cols-3 border-t border-border/60 bg-background/20">
              <TrustItem icon={Eye} label="No tracking" />
              <TrustItem icon={Lock} label="ZK-private" />
              <TrustItem icon={Zap} label="Sub-second" />
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

function ProcessingState({ phase }: { phase: Exclude<Phase, "idle" | "success" | "error"> }) {
  const copy = PHASE_COPY[phase];
  const steps: Array<typeof phase> = ["preparing", "signing", "confirming"];
  const currentIdx = steps.indexOf(phase);

  return (
    <div className="mb-5 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{copy.label}</p>
          <p className="truncate text-xs text-muted-foreground">{copy.sub}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentIdx ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-foreground/90">
        {value}
        {hint && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: typeof Lock;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2 py-3 text-[11px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary/80" />
      {label}
    </div>
  );
}

function SuccessState({ link }: { link: PaymentLink }) {
  const copySig = () => {
    if (!link.txSignature) return;
    navigator.clipboard.writeText(link.txSignature);
    toast.success("Receipt ID copied");
  };
  return (
    <div className="text-center">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-success/20 animate-pulse-glow" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.25} />
        </div>
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold">Payment sent</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {link.amount.toFixed(2)} {link.token} confirmed privately on Solana.
      </p>
      {link.txSignature && (
        <button
          onClick={copySig}
          className="mt-6 group mx-auto flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background/50 p-3 text-left transition-colors hover:border-border-strong"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Receipt ID
            </p>
            <p className="mt-0.5 truncate font-mono text-xs">
              {shortAddress(link.txSignature, 10)}
            </p>
          </div>
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </button>
      )}
      <Button asChild variant="hero" size="lg" className="mt-6 w-full">
        <Link to="/">Done</Link>
      </Button>
    </div>
  );
}
