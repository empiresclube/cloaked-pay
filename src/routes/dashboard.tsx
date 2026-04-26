import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useWallet, shortAddress } from "@/lib/wallet";
import { linksStore } from "@/lib/storage";
import type { PaymentLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShareLink } from "@/components/ShareLink";
import {
  Plus,
  Link as LinkIcon,
  Copy,
  Check,
  Eye,
  Lock,
  Trash2,
  ArrowUpRight,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CloakPay" },
      { name: "description", content: "Manage your private payment links." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { connected, publicKey, connect, connecting } = useWallet();
  const navigate = useNavigate();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    const refresh = () => setLinks(linksStore.forOwner(publicKey));
    refresh();
    window.addEventListener("cloak:links-updated", refresh);
    return () => window.removeEventListener("cloak:links-updated", refresh);
  }, [publicKey]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold">Connect to continue</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your Solana wallet to access your private dashboard.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-8"
            onClick={async () => {
              await connect();
              navigate({ to: "/dashboard" });
            }}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </Button>
        </div>
      </div>
    );
  }

  const totalPaid = links
    .filter((l) => l.status === "paid")
    .reduce((sum, l) => sum + l.amount, 0);
  const pendingCount = links.filter((l) => l.status === "pending").length;

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Welcome back
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              Your payments
            </h1>
          </div>
          <Button asChild variant="hero" size="lg">
            <Link to="/create">
              <Plus className="h-4 w-4" />
              New payment link
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard label="Total received (private)" value={`${totalPaid.toFixed(2)}`} suffix="USDC/USDT" />
          <StatCard label="Pending links" value={pendingCount.toString()} />
          <StatCard label="Total links" value={links.length.toString()} />
        </div>

        {/* Viewing key card */}
        <div className="mt-8 rounded-2xl border border-border bg-gradient-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium">Your viewing key</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Used to decrypt your private payment history. Keep it secret.
                </p>
              </div>
            </div>
            <Button variant="soft" size="sm" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Reveal"}
            </Button>
          </div>
          {showKey && publicKey && (
            <div className="mt-4 rounded-lg border border-border bg-background/50 p-3 font-mono text-xs break-all">
              vk_{publicKey.slice(0, 32)}…{publicKey.slice(-8)}
            </div>
          )}
        </div>

        {/* Links list */}
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold">Payment links</h2>
          {links.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/40 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LinkIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-medium">No links yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first payment link in under a minute.
              </p>
              <Button asChild variant="hero" size="sm" className="mt-6">
                <Link to="/create">
                  <Plus className="h-4 w-4" />
                  Create link
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-card">
              <div className="grid grid-cols-12 gap-4 border-b border-border px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              {links.map((link) => (
                <div
                  key={link.id}
                  className="grid grid-cols-12 items-center gap-4 border-b border-border/50 px-5 py-4 last:border-b-0 transition-colors hover:bg-surface/40"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="truncate font-medium">
                      {link.description || "Payment request"}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      /pay/{link.id} · stealth {shortAddress(link.stealthAddress, 4)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-display text-base font-semibold tabular-nums">
                      {link.amount.toFixed(2)}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">{link.token}</span>
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={link.status} />
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(link.id)}
                      aria-label="Copy link"
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button asChild variant="ghost" size="sm" aria-label="Open link">
                      <Link to="/pay/$id" params={{ id: link.id }}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => linksStore.remove(link.id)}
                      aria-label="Delete link"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentLink["status"] }) {
  const map = {
    paid: { label: "Paid", cls: "bg-success/15 text-success" },
    pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
