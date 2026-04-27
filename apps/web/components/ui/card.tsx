import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-plexus-border bg-plexus-surface",
        "transition-colors duration-plexus-normal ease-plexus-out",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHover = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn("hover:border-plexus-border-strong hover:-translate-y-px", className)}
      {...props}
    />
  ),
);
CardHover.displayName = "CardHover";
