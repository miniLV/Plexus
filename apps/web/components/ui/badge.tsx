import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-2 h-5 text-[11px] font-medium tracking-[0.01em]",
  {
    variants: {
      variant: {
        team: "bg-plexus-info/15 text-plexus-info",
        personal: "bg-plexus-accent-faint text-plexus-accent",
        synced: "bg-plexus-ok/15 text-plexus-ok",
        divergent: "bg-plexus-warn/15 text-plexus-warn",
        native: "bg-plexus-text-3/15 text-plexus-text-3",
        beta: "bg-plexus-accent-faint text-plexus-accent border border-plexus-accent/25",
        danger: "bg-plexus-err/13 text-plexus-err",
        outline: "border border-plexus-border text-plexus-text-2",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** A small coloured dot used inside or beside badges. */
export function StatusDot({
  className,
  tone = "ok",
}: {
  className?: string;
  tone?: "ok" | "warn" | "err" | "info" | "accent" | "mute";
}) {
  const tones: Record<typeof tone, string> = {
    ok: "bg-plexus-ok",
    warn: "bg-plexus-warn",
    err: "bg-plexus-err",
    info: "bg-plexus-info",
    accent: "bg-plexus-accent",
    mute: "bg-plexus-text-3",
  };
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", tones[tone], className)} />;
}
