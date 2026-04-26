import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { linksStore } from "@/lib/storage";
import { deriveStealthAddress, generateLinkId } from "@/lib/cloak";
import type { PaymentLink, TokenSymbol } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShareLink } from "@/components/ShareLink";
import { ArrowLeft, Lock, CheckCircle2, Sparkles } from "lucide-react";
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
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="font-display text-2xl font-semibold">Connect first</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your wallet to create payment links.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-6"
            onClick={async () => {
              await connect();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !publicKey) return;

    const { stealthAddress, viewingKeyRef } = deriveStealthAddress(publicKey);
    const link: PaymentLink = {
      id: generateLinkId(),
      amount: amt,
      token,
      description: description.trim() || undefined,
      createdAt: Date.now(),
      status: "pending",
      stealthAddress,
      viewingKeyRef,
      owner: publicKey,
    };
    linksStore.create(link);
    setCreated(link);
  };

  const copyUrl = () => {
    if (!created) return;
    const url = `${window.location.origin}/pay/${created.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (created) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${created.id}`;
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-xl px-6 py-16">
          <div className="rounded-2xl border border-border bg-gradient-card p-8 text-center shadow-elegant">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-semibold">Link ready to share</h1>
            <p className="mt-2 text-muted-foreground">
              Share this link to receive {created.amount.toFixed(2)} {created.token} privately.
            </p>

            <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2">
              <code className="flex-1 truncate px-3 text-left text-sm">{url}</code>
              <Button onClick={copyUrl} variant={copied ? "soft" : "default"} size="sm">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>

            <div className="mt-8 flex gap-3 justify-center">
              <Button asChild variant="ghost">
                <Link to="/dashboard">Back to dashboard</Link>
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>

        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Create a payment link
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set how much you want to receive. We'll handle the privacy.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-border bg-gradient-card p-6 md:p-8"
        >
          <div className="space-y-6">
            <div>
              <Label htmlFor="amount" className="text-sm font-medium">
                Amount
              </Label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-14 text-2xl font-display font-semibold tabular-nums tracking-tight"
                  />
                </div>
                <div className="flex rounded-md border border-input bg-input p-1">
                  {(["USDC", "USDT"] as TokenSymbol[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setToken(t)}
                      className={`rounded px-4 text-sm font-medium transition-colors ${
                        token === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="desc" className="text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="desc"
                placeholder="What's this for? e.g. Design work, March invoice…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 resize-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Visible only to the payer on the payment page. Never on-chain.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Create payment link
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
