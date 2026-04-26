import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareLinkProps {
  url: string;
  label?: string;
}

export function ShareLink({ url, label = "Share this link" }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: "Paste it anywhere to request payment." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy", { description: "Copy the link manually." });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Payment request", url });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-stretch gap-2 rounded-xl border border-border bg-background/60 p-1.5">
          <code className="flex-1 truncate self-center px-3 text-sm font-mono">{url}</code>
          <Button
            onClick={handleCopy}
            variant={copied ? "soft" : "default"}
            size="sm"
            className="shrink-0"
          >
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
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background/60 p-6">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <QRCodeSVG
            value={url}
            size={168}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f0d18"
            marginSize={0}
          />
        </div>
        <p className="text-xs text-muted-foreground">Scan to pay from any wallet</p>
        <Button onClick={handleShare} variant="ghost" size="sm">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      </div>
    </div>
  );
}
