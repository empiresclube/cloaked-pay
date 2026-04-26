import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useWallet } from "@/lib/wallet";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shield, Eye, Zap, ArrowRight, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloakPay — Private crypto payments on Solana" },
      {
        name: "description",
        content:
          "Stripe-style payment links with full on-chain privacy. Accept USDC and USDT without revealing amounts or addresses.",
      },
      { property: "og:title", content: "CloakPay — Private crypto payments" },
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              Powered by Cloak SDK on Solana
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-7xl">
              <span className="text-gradient">Get paid privately.</span>
              <br />
              <span className="text-foreground/90">In one link.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
              Payment links that hide amounts and addresses on-chain. Like Stripe — but
              your customers and revenue stay yours alone.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={handleStart} disabled={connecting} variant="hero" size="xl">
                {connecting ? "Connecting…" : connected ? "Open dashboard" : "Start accepting payments"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" size="xl">
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              No signup. No fees. Connect your Solana wallet and you're live.
            </p>
          </div>

          {/* Floating preview card */}
          <div className="relative mx-auto mt-20 max-w-md">
            <div className="absolute -inset-8 bg-gradient-glow blur-3xl opacity-70" />
            <div className="relative rounded-2xl border border-border-strong bg-gradient-card p-6 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Payment request</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold tracking-tight">
                  ••••
                </span>
                <span className="text-lg text-muted-foreground">USDC</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Coffee with Sarah
              </div>
              <Button variant="hero" size="lg" className="mt-6 w-full">
                Pay privately
              </Button>
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3 w-3" />
                Secured by Cloak
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="border-t border-border/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Privacy that just works.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Three primitives. Zero friction. Built on Solana's speed and Cloak's
              cryptography.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Lock,
                title: "Hidden amounts",
                desc: "Transfer values are encrypted on-chain. No one sees what you charged.",
              },
              {
                icon: Eye,
                title: "Stealth addresses",
                desc: "Each payment lands on a fresh address. Your main wallet stays unlinked.",
              },
              {
                icon: Zap,
                title: "Solana fast",
                desc: "Sub-second confirmations and fractions of a cent in fees.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-border-strong hover:shadow-elegant"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-border/60 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="space-y-12">
            {[
              { n: "01", t: "Connect your Solana wallet", d: "One click. Your keys never leave your device." },
              { n: "02", t: "Create a payment link", d: "Set an amount and description. Get a shareable link in seconds." },
              { n: "03", t: "Get paid privately", d: "Funds land on a fresh stealth address. Only you can see them — with your viewing key." },
            ].map((s) => (
              <div key={s.n} className="flex gap-6 md:gap-10">
                <div className="font-mono text-sm text-primary tabular-nums">{s.n}</div>
                <div className="flex-1 border-l border-border pl-6 md:pl-10 pb-12 last:pb-0">
                  <h3 className="font-display text-xl font-semibold">{s.t}</h3>
                  <p className="mt-2 text-muted-foreground">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-gradient-card p-8 md:p-12 text-center">
            <h3 className="font-display text-2xl font-semibold md:text-3xl">
              Ready in under a minute.
            </h3>
            <p className="mt-3 text-muted-foreground">
              No accounts, no KYC, no platform fees.
            </p>
            <Button onClick={handleStart} variant="hero" size="lg" className="mt-6">
              {connected ? "Open dashboard" : "Connect wallet"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            CloakPay · Private payments on Solana
          </div>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
