import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { linksStore, merchantUtxoStore } from "@/lib/storage";
import { deriveStealthAddressFor, generateLinkId, cloakSdkService } from "@/lib/cloak";
import type { PaymentLink, TokenSymbol } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShareLink } from "@/components/ShareLink";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "New payment link — CloakPay" },
      { name: "description", content: "Create a private payment link in seconds." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { connected, publicKey, connect, connecting } = useWallet();
  const navigate = useNavigate();

  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<TokenSymbol>("SOL");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<PaymentLink | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
            Connect first
          </h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to create payment links.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-7"
            onClick={async () => {
              await connect();
              toast.success("Wallet connected");
              navigate({ to: "/create" });
            }}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !publicKey) {
      toast.error("Enter an amount", {
        description: "Amount must be greater than zero.",
      });
      return;
    }
    if (token === "SOL" && amt < 0.01) {
      toast.error("Minimum is 0.01 SOL", {
        description: "Cloak shield pool requires at least 0.01 SOL per note.",
      });
      return;
    }
    setSubmitting(true);

    try {
      // The recipient address IS the merchant's wallet — the privacy comes
      // from the shielded pool hop, not from a separate stealth pubkey.
      const stealth = await deriveStealthAddressFor(publicKey);

      // Generate a fresh Cloak UTXO keypair for this link. The private key
      // stays in localStorage on this device; the public key travels in
      // the link so the payer can deposit straight into the merchant's UTXO.
      const utxo = await cloakSdkService.generateMerchantUtxoKeypair();

      const link: PaymentLink = {
        id: generateLinkId(),
        amount: amt,
        token,
        description: description.trim() || undefined,
        createdAt: Date.now(),
        status: "pending",
        stealthAddress: stealth.address,
        viewingKeyRef: stealth.viewingKeyRef,
        merchantUtxoPubkeyHex: utxo.publicKeyHex,
        owner: publicKey,
      };
      merchantUtxoStore.save({
        linkId: link.id,
        privateKeyHex: utxo.privateKeyHex,
        publicKeyHex: utxo.publicKeyHex,
        createdAt: Date.now(),
      });
      linksStore.create(link);
      setCreated(link);
      toast.success("Payment link created", {
        description: `Ready to receive ${amt} ${token} privately.`,
      });
    } catch (err) {
      toast.error("Couldn't create link", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${created.id}`;
    return (
      <div className="min-h-screen bg-surface/40">
        <Header />
        <main className="mx-auto max-w-xl px-6 py-12 md:py-20">
          <div className="rounded-2xl border border-border bg-card p-7 md:p-10 shadow-soft animate-fade-up">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-success/15 animate-pulse-glow" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-foreground">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={2.25} />
                </div>
              </div>
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
                Your link is live
              </h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Anyone with this link can pay you{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {created.amount} {created.token}
                </span>{" "}
                privately on devnet. You'll see it here when it's paid.
              </p>
            </div>

            <div className="mt-8">
              <ShareLink url={url} />
            </div>

            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button asChild variant="ghost">
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4" /> Back to dashboard
                </Link>
              </Button>
              <Button asChild variant="hero">
                <Link to="/pay/$id" params={{ id: created.id }}>
                  Preview link
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/40">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>

        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          New payment link
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">
          How much would you like to receive?
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
          We'll generate a private link your customer can pay in one tap.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-soft"
        >
          <div className="space-y-7">
            <div>
              <Label htmlFor="amount" className="text-sm font-medium text-foreground">
                Amount
              </Label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0.01"
                    placeholder="0.05"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-14 text-3xl font-display font-semibold tabular-nums tracking-[-0.02em] border-border focus-visible:ring-ring"
                  />
                </div>
                <div className="flex rounded-lg border border-border bg-secondary p-1">
                  {(["SOL", "USDC", "USDT"] as TokenSymbol[]).map((t) => {
                    const disabled = t !== "SOL";
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => !disabled && setToken(t)}
                        disabled={disabled}
                        title={disabled ? "Mainnet only — use SOL on devnet" : undefined}
                        className={`rounded-md px-4 text-sm font-medium transition-all ${
                          token === t
                            ? "bg-card text-foreground shadow-xs"
                            : disabled
                              ? "text-muted-foreground/40 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t}
                        {disabled && (
                          <span className="ml-1 text-[9px] uppercase tracking-wider opacity-60">
                            soon
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Minimum 0.01 SOL · Cloak shield-pool fee ≈ 0.005 SOL + 0.3%.
              </p>
            </div>

            <div>
              <Label htmlFor="desc" className="text-sm font-medium text-foreground">
                Description{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="desc"
                placeholder="What's this for? e.g. Design work, March invoice…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 resize-none border-border"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Visible only to the payer on the payment page. Never on-chain.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A fresh stealth address will be generated for this link. The amount
                will be encrypted on-chain via Cloak. Only you — using your viewing
                key — will see the payment in your dashboard.
              </p>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              className="w-full"
              disabled={!amount || parseFloat(amount) <= 0 || submitting}
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating private link…
                </>
              ) : (
                "Create payment link"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
