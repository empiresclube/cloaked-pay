import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { linksStore } from "@/lib/storage";
import { useWallet, shortAddress } from "@/lib/wallet";
import {
  getCloakService,
  explorerUrl,
  type StealthAddress,
} from "@/lib/cloak";
import type { PaymentLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Shield,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
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
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Link not found
        </h1>
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

const PHASE_COPY: Record<
  Exclude<Phase, "idle" | "success" | "error">,
  { label: string; sub: string }
> = {
  preparing: { label: "Preparing transfer", sub: "Building the encrypted instruction" },
  signing: { label: "Generating zero-knowledge proof", sub: "Keeps the amount hidden" },
  confirming: { label: "Confirming on Solana", sub: "Usually under a second" },
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
  const isProcessing =
    phase === "preparing" || phase === "signing" || phase === "confirming";

  const handlePay = async () => {
    if (!connected || !publicKey) {
      await connect();
      toast.success("Wallet connected", {
        description: "You can now complete the payment.",
      });
      return;
    }
    setError(null);
    const t = toast.loading("Preparing private transfer…");

    const recipient: StealthAddress = {
      address: link.stealthAddress,
      viewingKeyRef: link.viewingKeyRef,
      ephemeralPubkey: link.stealthAddress,
    };

    try {
      const result = await getCloakService().privateSend({
        payer: publicKey,
        to: recipient,
        amount: link.amount,
        token: link.token,
        memo: link.description,
        autoDeposit: true,
        merchantUtxoPubkeyHex: link.merchantUtxoPubkeyHex,
        onProgress: (p) => {
          if (p.phase === "preparing") {
            setPhase("preparing");
            toast.loading(p.message, { id: t });
          } else if (p.phase === "proving") {
            setPhase("signing");
            toast.loading(p.message, { id: t });
          } else if (p.phase === "submitting" || p.phase === "confirming") {
            setPhase("confirming");
            toast.loading(p.message, { id: t });
          }
        },
      });

      if (
        result.depositLeafIndex !== undefined &&
        result.depositBlindingHex !== undefined &&
        result.depositLamports !== undefined
      ) {
        linksStore.markPaid(link.id, {
          txSignature: result.signature,
          depositLeafIndex: result.depositLeafIndex,
          depositBlindingHex: result.depositBlindingHex,
          depositLamports: result.depositLamports,
        });
      } else {
        linksStore.updateStatus(link.id, "paid", result.signature);
      }
      setPhase("success");
      toast.success("Payment sent privately", {
        id: t,
        description: `${link.amount} ${link.token} confirmed on Solana devnet.`,
      });
    } catch (e) {
      const msg = (e as Error).message || "Something went wrong.";
      setError(msg);
      setPhase("error");
      toast.error("Payment failed", { id: t, description: msg });
    }
  };

  return (
    <div className="min-h-screen bg-surface/40">
      <Header />

      <main className="mx-auto max-w-md px-6 py-10 md:py-16">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-5 -ml-2 text-muted-foreground"
        >
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </Button>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-floating animate-fade-up">
          {/* Trust ribbon */}
          <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2.5 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="h-3 w-3 text-success" />
              Verified · cloakpay.app
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
              Solana devnet
            </div>
          </div>

          {/* Amount */}
          <div className="px-8 pt-10 pb-7 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-medium text-foreground">
              <Lock className="h-3 w-3" />
              Encrypted payment
            </div>

            <div className="mt-7 flex items-baseline justify-center gap-2.5">
              <span className="font-display text-[68px] leading-none font-semibold tracking-[-0.04em] tabular-nums text-foreground">
                {link.amount}
              </span>
              <span className="text-xl font-medium text-muted-foreground">
                {link.token}
              </span>
            </div>

            <p className="mx-auto mt-5 max-w-xs text-[15px] text-foreground/80 leading-relaxed">
              {link.description || "Payment request"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Requested{" "}
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(link.createdAt),
              )}
            </p>
          </div>

          {/* Action area */}
          <div className="border-t border-border px-7 py-6 md:px-8">
            {isPaid ? (
              <SuccessState link={link} />
            ) : (
              <>
                {isProcessing && <ProcessingState phase={phase} />}

                {!isProcessing && phase === "error" && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
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
                  {!connecting && phase === "idle" &&
                    (connected
                      ? `Pay ${link.amount} ${link.token}`
                      : "Connect wallet to pay")}
                  {!connecting && phase === "preparing" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                    </>
                  )}
                  {!connecting && phase === "signing" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating proof
                    </>
                  )}
                  {!connecting && phase === "confirming" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Confirming
                    </>
                  )}
                  {!connecting && phase === "error" && "Try again"}
                </Button>

                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Real on-chain transfer on Solana devnet · ZK proof generated in
                  your browser.
                </p>

                <div className="mt-6 space-y-2.5 border-t border-border pt-5 text-xs">
                  <Row label="Network" value="Solana devnet" />
                  <Row label="Protocol fee" value="0.005 SOL + 0.3%" />
                  <Row label="Privacy" value="Shielded pool" hint="Cloak ZK" />
                  <Row label="Proof time" value="~5–30s" hint="In-browser" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Secured by Cloak · Built on Solana
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────── Sub-components ─ */

function ProcessingState({
  phase,
}: {
  phase: Exclude<Phase, "idle" | "success" | "error">;
}) {
  const copy = PHASE_COPY[phase];
  const steps: Array<typeof phase> = ["preparing", "signing", "confirming"];
  const currentIdx = steps.indexOf(phase);

  return (
    <div className="mb-5 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{copy.label}</p>
          <p className="truncate text-xs text-muted-foreground">{copy.sub}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-0.5 flex-1 rounded-full transition-colors ${
              i <= currentIdx ? "bg-foreground" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-foreground">
        {value}
        {hint && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-sans font-medium text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
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
    <div className="text-center animate-fade-up">
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-success/15 animate-pulse-glow" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2 className="h-6 w-6" strokeWidth={2.25} />
        </div>
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">
        Payment sent
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {link.amount} {link.token} confirmed privately on Solana devnet.
      </p>
      {link.txSignature && (
        <div className="mt-6 space-y-2">
          <button
            onClick={copySig}
            className="group mx-auto flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface/60 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Transaction signature
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-foreground">
                {shortAddress(link.txSignature, 10)}
              </p>
            </div>
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          </button>
          <a
            href={explorerUrl(link.txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/60 p-3 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground"
          >
            View on Solana Explorer
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <Button asChild variant="hero" size="lg" className="mt-6 w-full">
        <Link to="/">Done</Link>
      </Button>
    </div>
  );
}
