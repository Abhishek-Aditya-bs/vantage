/**
 * Share dialog — QR + copyable join link for the current space.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/brand/QrCode";
import { formatCode } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  joinUrl: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  code,
  joinUrl,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ title: "Link copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy", tone: "error" });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite to this space"
      description={`Code ${formatCode(code)} — anyone with this can join the wall.`}
    >
      <div className="flex flex-col items-center gap-5">
        <QrCode value={joinUrl} size={208} />
        <div className="w-full">
          <div className="flex items-stretch gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
              {joinUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="Copy join link"
            >
              {copied ? (
                <Check className="size-4 text-live" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
