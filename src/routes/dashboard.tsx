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
  const [shareLinkId, setShareLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    const refresh = () => setLinks(linksStore.forOwner(publicKey));
    refresh();
    window.addEventListener("cloak:links-updated", refresh);
    return () => window.removeEventListener("cloak:links-updated", refresh);
  }, [publicKey]);

  const sharedLink = shareLinkId ? links.find((l) => l.id === shareLinkId) : null;

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
            Connect to continue
          </h1>
          <p className="mt-2 text-muted-foreground">
            Connect your Solana wallet to access your private dashboard.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-8"
            onClick={async () => {
              await connect();
              toast.success("Wallet connected");
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
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const removeLink = (link: PaymentLink) => {
    linksStore.remove(link.id);
    toast("Link deleted", {
      description: `${link.amount.toFixed(2)} ${link.token} request removed.`,
    });
  };

  return (
    <div className="min-h-screen bg-surface/40">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Welcome back
            </p>
            <h1 className="mt-2 font-display text-[32px] font-semibold tracking-[-0.02em]">
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
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          <StatCard
            label="Total received"
            value={totalPaid.toFixed(2)}
            suffix="USDC"
          />
          <StatCard label="Pending" value={pendingCount.toString()} />
          <StatCard label="Total links" value={links.length.toString()} />
        </div>

        {/* Viewing key card */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Your viewing key
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Used to decrypt your private payment history. Keep it secret.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? "Hide" : "Reveal"}
            </Button>
          </div>
          {showKey && publicKey && (
            <div className="mt-4 rounded-lg border border-border bg-surface/60 p-3 font-mono text-xs break-all text-foreground/80 animate-fade-up">
              vk_{publicKey.slice(0, 32)}…{publicKey.slice(-8)}
            </div>
          )}
        </div>

        {/* Links list */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Payment links
            </h2>
            {links.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {links.length} total
              </span>
            )}
          </div>

          {links.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                <LinkIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-medium text-foreground">No links yet</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
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
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="grid grid-cols-12 gap-4 border-b border-border bg-surface/40 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              {links.map((link) => (
                <div
                  key={link.id}
                  className="grid grid-cols-12 items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-surface/40"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {link.description || "Payment request"}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      /pay/{link.id} · stealth {shortAddress(link.stealthAddress, 4)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-display text-base font-semibold tabular-nums text-foreground">
                      {link.amount.toFixed(2)}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {link.token}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={link.status} />
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShareLinkId(link.id)}
                      aria-label="Share with QR code"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(link.id)}
                      aria-label="Copy link"
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label="Open link"
                    >
                      <Link to="/pay/$id" params={{ id: link.id }}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(link)}
                      aria-label="Delete link"
                    >
                      <Trash2 className="h-4 w-4 hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Share dialog */}
      <Dialog
        open={!!sharedLink}
        onOpenChange={(open) => !open && setShareLinkId(null)}
      >
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              Share payment link
            </DialogTitle>
            <DialogDescription>
              {sharedLink && (
                <>
                  Request{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {sharedLink.amount.toFixed(2)} {sharedLink.token}
                  </span>{" "}
                  privately.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {sharedLink && (
            <div className="mt-2">
              <ShareLink
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${sharedLink.id}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="bg-card p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-medium text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentLink["status"] }) {
  const map = {
    paid: { label: "Paid", cls: "bg-success/10 text-success border-success/20" },
    pending: {
      label: "Pending",
      cls: "bg-warning/10 text-warning-foreground border-warning/30",
    },
    expired: {
      label: "Expired",
      cls: "bg-secondary text-muted-foreground border-border",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
