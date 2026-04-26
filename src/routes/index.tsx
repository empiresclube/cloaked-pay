import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Eye, Zap, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloakPay — Private payment links on Solana" },
      {
        name: "description",
        content:
          "Stripe-style payment links with on-chain privacy. Accept USDC and USDT without revealing amounts or addresses.",
      },
      { property: "og:title", content: "CloakPay — Private payment links" },
      {
        property: "og:description",
        content: "Private payment links for Solana. Powered by Cloak.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { connected, connect, connecting } = useWallet();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!connected) await connect();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* ─────────────────────────────────────── Hero ─ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="absolute inset-0 bg-gradient-hero" />

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-36 md:pb-36">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Powered by Cloak SDK on Solana
            </div>

            <h1 className="mt-8 font-display text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground md:text-[72px]">
              Get paid in stablecoins.
              <br />
              <span className="text-muted-foreground">Privately.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-muted-foreground md:text-lg">
              Payment links for USDC and USDT where the amount and the recipient
              stay encrypted on-chain. The simplicity of Stripe — without the
              public ledger.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={handleStart}
                disabled={connecting}
                variant="hero"
                size="xl"
              >
                {connecting
                  ? "Connecting…"
                  : connected
                    ? "Open dashboard"
                    : "Start accepting payments"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" size="xl">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> No signup
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> No platform fees
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" /> Self-custodial
              </span>
            </div>
          </div>

          {/* ─── Floating preview card ─ */}
          <div className="relative mx-auto mt-24 max-w-sm animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-12 bg-gradient-glow blur-2xl" />
            <div className="relative rounded-2xl border border-border-strong bg-card p-7 shadow-floating">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>Payment request</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              </div>

              <div className="mt-7 flex items-baseline gap-2">
                <span className="font-display text-[56px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                  250
                </span>
                <span className="text-lg font-medium text-muted-foreground">USDC</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Design retainer · March
              </p>

              <Button variant="hero" size="lg" className="mt-7 w-full">
                Pay 250 USDC
              </Button>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-[11px]">
                <Stat label="Fee" value="$0.0003" />
                <Stat label="Settles" value="<1s" />
                <Stat label="Visible" value="Encrypted" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────── Features ─ */}
      <section id="how-it-works" className="border-t border-border bg-surface/50 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Built for clarity
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Privacy that just works.
            </h2>
            <p className="mt-4 text-[17px] text-muted-foreground leading-relaxed">
              Three primitives, zero friction. Built on Solana's settlement and
              Cloak's zero-knowledge cryptography.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {[
              {
                icon: Lock,
                title: "Hidden amounts",
                desc: "Transfer values are encrypted on-chain. No one can see what you charged or what you paid.",
              },
              {
                icon: Eye,
                title: "Stealth addresses",
                desc: "Each payment lands on a fresh, unlinkable address. Your main wallet stays private.",
              },
              {
                icon: Zap,
                title: "Settles in <1 second",
                desc: "Solana speed at fractions of a cent in fees. No batching, no waiting, no hidden costs.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-card p-8 transition-colors hover:bg-card/80"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <h3 className="mt-6 font-display text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────── Steps ─ */}
      <section className="border-t border-border py-28">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              From wallet to paid in three steps.
            </h2>
          </div>

          <div className="mt-16 space-y-2">
            {[
              {
                n: "01",
                t: "Connect your wallet",
                d: "Solana wallet, one click. Your keys never leave your device.",
              },
              {
                n: "02",
                t: "Create a payment link",
                d: "Set an amount, write what it's for, share the link. That's it.",
              },
              {
                n: "03",
                t: "Get paid privately",
                d: "Funds land on a fresh stealth address. Only you — with your viewing key — can see them.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="group flex items-start gap-6 rounded-xl border border-transparent p-6 transition-colors hover:border-border hover:bg-surface"
              >
                <div className="font-mono text-sm tabular-nums text-muted-foreground pt-0.5">
                  {s.n}
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {s.t}
                  </h3>
                  <p className="mt-1.5 text-muted-foreground leading-relaxed">
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 rounded-2xl border border-border bg-gradient-card p-10 text-center shadow-soft md:p-14">
            <h3 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Ready in under a minute.
            </h3>
            <p className="mt-3 text-muted-foreground">
              No accounts, no KYC, no platform fees.
            </p>
            <Button onClick={handleStart} variant="hero" size="lg" className="mt-7">
              {connected ? "Open dashboard" : "Connect wallet"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────── Footer ─ */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground">
              <span className="font-display text-[10px] font-semibold text-background">C</span>
            </div>
            CloakPay · Private payments on Solana
          </div>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a
              href="https://cloak.ag"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Cloak
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-xs tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
